// Backup de la base de datos de producción (Netlify DB / Postgres) a JSON local.
//
// Uso (PowerShell):
//   node scripts/backup-db.mjs [carpeta-destino]
// Pide la connection string de Netlify DB por consola (o la toma de
// $env:BACKUP_DATABASE_URL si está definida).
//
// Genera <carpeta-destino>/db/ (por defecto backups/<timestamp>/db/) con un JSON
// por tabla, el schema de Prisma, las migraciones de Netlify y un manifest.json
// con conteos. El directorio backups/ está en .gitignore: contiene datos
// personales y hashes de contraseñas.

import pg from "pg"
import fs from "node:fs"
import path from "node:path"
import readline from "node:readline/promises"

let connectionString = process.env.BACKUP_DATABASE_URL
if (!connectionString) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  connectionString = (await rl.question("Connection string de Netlify DB (postgresql://...): ")).trim()
  rl.close()
}
if (!connectionString) {
  console.error("Sin connection string, no se puede hacer el backup.")
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const outDir = path.join(process.argv[2] || path.join("backups", stamp), "db")
fs.mkdirSync(path.join(outDir, "tables"), { recursive: true })

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

try {
  // Snapshot consistente: todas las lecturas ven el mismo estado de la DB
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")

  const { rows: tables } = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name
  `)

  const manifest = { createdAt: new Date().toISOString(), tables: {} }

  for (const { table_schema, table_name } of tables) {
    const ident = `"${table_schema.replace(/"/g, '""')}"."${table_name.replace(/"/g, '""')}"`
    const { rows } = await client.query(`SELECT * FROM ${ident}`)
    const file = path.join(outDir, "tables", `${table_schema}.${table_name}.json`)
    fs.writeFileSync(file, JSON.stringify(rows, null, 2))
    manifest.tables[`${table_schema}.${table_name}`] = rows.length
    console.log(`${table_schema}.${table_name}: ${rows.length} filas`)
  }

  const { rows: [{ version }] } = await client.query("SELECT version()")
  manifest.serverVersion = version

  await client.query("COMMIT")

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2))
  fs.copyFileSync("prisma/schema.prisma", path.join(outDir, "schema.prisma"))
  fs.cpSync("netlify/database/migrations", path.join(outDir, "migrations"), { recursive: true })

  console.log(`\nBackup listo en ${outDir}`)
} catch (err) {
  await client.query("ROLLBACK").catch(() => {})
  console.error("Backup falló:", err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
