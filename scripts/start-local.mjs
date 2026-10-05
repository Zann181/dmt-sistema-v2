// Arranca el servidor local (next dev HTTPS) conectado a la base de datos de
// PRODUCCIÓN de Netlify (proyecto dmt69). Lo usa arrancar.bat.
//
// La connection string se pide en cada arranque a Netlify CLI y solo vive en la
// memoria de este proceso: no se escribe en ningún archivo. Requiere haber hecho
// `npx netlify-cli login` una vez en esta PC.
//
// Si algo falla, el motivo queda en .dmt-error.log para que arrancar.bat lo muestre.

import { execSync, spawn } from "node:child_process"
import fs from "node:fs"

const NETLIFY_SITE_ID = "f2f55a80-5ec2-41e8-b4d7-3e7d1afe4634" // dmt69
const PORT = process.env.PORT || "3000"
const ERROR_LOG = ".dmt-error.log"

function fail(message) {
  fs.writeFileSync(ERROR_LOG, message + "\n")
  console.error(message)
  process.exit(1)
}

console.log("[*] Obteniendo conexion a la base de datos de produccion (Netlify)...")

let connectionString
try {
  const out = execSync(
    "npx --yes netlify-cli database status --branch production --json --show-credentials",
    {
      env: { ...process.env, NETLIFY_SITE_ID },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 180_000,
    }
  )
  connectionString = JSON.parse(out.slice(out.indexOf("{"))).database?.connectionString
} catch (err) {
  const detail = String(err.stderr || err.message || "").replace(/postgres(ql)?:\/\/\S+/g, "<oculto>").trim()
  fail(
    "[!] No se pudo obtener la conexion a la base de datos de produccion.\n" +
    "    Si es la primera vez en esta PC o la sesion expiro, ejecuta:  npx netlify-cli login\n" +
    (detail ? `    Detalle: ${detail.split("\n").slice(-3).join(" ")}` : "")
  )
}

if (!connectionString || !connectionString.startsWith("postgres")) {
  fail("[!] Netlify no devolvio una connection string valida para la base de produccion.")
}

console.log("[*] Conectado a la base de produccion. Iniciando servidor...")

// NETLIFY_DB_URL es lo que lee getConnectionString() de @netlify/database, igual que en
// producción. DATABASE_URL también se pisa para que nunca se use la base de .env por error.
const child = spawn(`npx next dev --experimental-https --port ${PORT}`, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NETLIFY_DB_URL: connectionString, DATABASE_URL: connectionString },
})

child.on("exit", (code) => process.exit(code ?? 0))
