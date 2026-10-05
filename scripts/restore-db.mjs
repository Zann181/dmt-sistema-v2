// Restaura un backup hecho con scripts/backup-db.mjs en Postgres (Neon).
//
// Uso (PowerShell):
//   node scripts/restore-db.mjs backups/<carpeta>/db              # base vacía
//   node scripts/restore-db.mjs backups/<carpeta>/db --reemplazar # borra los datos actuales y carga el backup
//
// Pide la connection string DIRECTA de Neon (sin "-pooler" en el host) por consola,
// o la toma de $env:DATABASE_URL_UNPOOLED / $env:DATABASE_URL.
//
// 1. Aplica las migraciones pendientes con `prisma migrate deploy` (crea las tablas si no existen).
// 2. Inserta las filas en orden de dependencias (foreign keys), en una transacción.
// 3. Verifica que los conteos coincidan con manifest.json.

import pg from "pg"
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import readline from "node:readline/promises"

const dir = process.argv[2]
const replace = process.argv.includes("--reemplazar")
if (!dir || !fs.existsSync(path.join(dir, "manifest.json"))) {
  console.error("Uso: node scripts/restore-db.mjs <carpeta-db-del-backup> [--reemplazar]  (debe contener manifest.json)")
  process.exit(1)
}

let connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!connectionString) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  connectionString = (await rl.question("Connection string DIRECTA de Neon (postgresql://...): ")).trim()
  rl.close()
}
if (!connectionString) {
  console.error("Sin connection string, no se puede restaurar.")
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"))
const tables = Object.keys(manifest.tables).map((t) => t.split(".")[1])
const quote = (s) => `"${s.replace(/"/g, '""')}"`
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString)

const client = new pg.Client({ connectionString, ...(isLocal ? { ssl: false } : {}) })
await client.connect()

// Orden topológico: primero las tablas de las que dependen las demás
async function dependencyOrder() {
  const { rows } = await client.query(`
    SELECT tc.relname AS child, tp.relname AS parent
    FROM pg_constraint c
    JOIN pg_class tc ON tc.oid = c.conrelid
    JOIN pg_class tp ON tp.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = tc.relnamespace
    WHERE c.contype = 'f' AND n.nspname = 'public' AND tc.relname <> tp.relname
  `)
  const deps = new Map(tables.map((t) => [t, new Set()]))
  for (const { child, parent } of rows) {
    if (deps.has(child) && deps.has(parent)) deps.get(child).add(parent)
  }
  const ordered = []
  while (deps.size) {
    const ready = [...deps].filter(([, parents]) => [...parents].every((p) => !deps.has(p))).map(([t]) => t)
    if (!ready.length) throw new Error(`Dependencias circulares entre: ${[...deps.keys()].join(", ")}`)
    for (const t of ready) { ordered.push(t); deps.delete(t) }
  }
  return ordered
}

try {
  // Siempre: crea las tablas en una base nueva y aplica migraciones pendientes en una existente
  console.log("Aplicando migraciones con prisma migrate deploy...")
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL_UNPOOLED: connectionString },
  })

  const order = await dependencyOrder()

  await client.query("BEGIN")

  if (replace) {
    await client.query(`TRUNCATE ${order.map(quote).join(", ")} CASCADE`)
    console.log("Datos actuales borrados (--reemplazar).")
  } else {
    for (const t of order) {
      const { rows: [{ n }] } = await client.query(`SELECT count(*)::int AS n FROM ${quote(t)}`)
      if (n > 0) throw new Error(`${t} ya tiene ${n} filas. Usa --reemplazar para sobrescribir.`)
    }
  }

  for (const t of order) {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, "tables", `public.${t}.json`), "utf8"))
    // Inserciones de 100 filas por query: Neon está lejos, menos viajes = más rápido
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100)
      const cols = Object.keys(chunk[0])
      const values = []
      const tuples = chunk.map((row) => {
        const ph = cols.map((c) => { values.push(row[c]); return `$${values.length}` })
        return `(${ph.join(", ")})`
      })
      await client.query(`INSERT INTO ${quote(t)} (${cols.map(quote).join(", ")}) VALUES ${tuples.join(", ")}`, values)
    }
    console.log(`${t}: ${rows.length} filas`)
  }

  await client.query("COMMIT")

  let ok = true
  for (const t of order) {
    const expected = manifest.tables[`public.${t}`]
    const { rows: [{ n }] } = await client.query(`SELECT count(*)::int AS n FROM ${quote(t)}`)
    if (n !== expected) { ok = false; console.error(`DIFERENCIA en ${t}: esperado ${expected}, hay ${n}`) }
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
