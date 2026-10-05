// Restaura un backup hecho con scripts/backup-db.mjs en una base Postgres VACÍA.
//
// Uso (en el VPS, dentro del contenedor de la app):
//   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm \
//     -v ./backups/<carpeta>/db:/restore app node scripts/restore-db.mjs /restore
//
// 1. Si la base no tiene tablas, aplica las migraciones SQL (carpeta migrations/).
// 2. Inserta las filas de cada tables/<schema>.<tabla>.json en una sola transacción.
// 3. Verifica que los conteos coincidan con manifest.json.
// Se niega a correr si las tablas ya tienen datos, para no mezclar ni duplicar.

import pg from "pg"
import fs from "node:fs"
import path from "node:path"

const dir = process.argv[2]
const connectionString = process.env.DATABASE_URL
if (!dir || !fs.existsSync(path.join(dir, "manifest.json"))) {
  console.error("Uso: node scripts/restore-db.mjs <carpeta-db-del-backup>  (debe contener manifest.json)")
  process.exit(1)
}
if (!connectionString) {
  console.error("Falta DATABASE_URL")
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"))
const migrationsDir = fs.existsSync("migrations") ? "migrations" : "netlify/database/migrations"
const quote = (s) => `"${s.replace(/"/g, '""')}"`

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
})
await client.connect()

try {
  const { rows: [{ count }] } = await client.query(
    "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'"
  )
  if (count === 0) {
    for (const m of fs.readdirSync(migrationsDir).sort()) {
      const sql = fs.readFileSync(path.join(migrationsDir, m, "migration.sql"), "utf8")
      await client.query(sql)
      console.log(`migración aplicada: ${m}`)
    }
  }

  await client.query("BEGIN")
  // Sin chequeo de foreign keys mientras se carga: el orden de las tablas no importa
  await client.query("SET LOCAL session_replication_role = replica")

  for (const table of Object.keys(manifest.tables)) {
    const [schema, name] = table.split(".")
    const ident = `${quote(schema)}.${quote(name)}`
    const { rows: [{ n }] } = await client.query(`SELECT count(*)::int AS n FROM ${ident}`)
    if (n > 0) throw new Error(`${table} ya tiene ${n} filas; restaurar solo sobre una base vacía`)

    const rows = JSON.parse(fs.readFileSync(path.join(dir, "tables", `${table}.json`), "utf8"))
    for (const row of rows) {
      const cols = Object.keys(row)
      const values = cols.map((c) => row[c])
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ")
      await client.query(`INSERT INTO ${ident} (${cols.map(quote).join(", ")}) VALUES (${placeholders})`, values)
    }
    console.log(`${table}: ${rows.length} filas`)
  }

  await client.query("COMMIT")

  let ok = true
  for (const [table, expected] of Object.entries(manifest.tables)) {
    const [schema, name] = table.split(".")
    const { rows: [{ n }] } = await client.query(`SELECT count(*)::int AS n FROM ${quote(schema)}.${quote(name)}`)
    if (n !== expected) { ok = false; console.error(`DIFERENCIA en ${table}: esperado ${expected}, hay ${n}`) }
  }
  console.log(ok ? "\nRestauración completa y verificada." : "\nRestauración con diferencias, revisar arriba.")
  if (!ok) process.exitCode = 1
} catch (err) {
  await client.query("ROLLBACK").catch(() => {})
  console.error("Restauración falló:", err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
