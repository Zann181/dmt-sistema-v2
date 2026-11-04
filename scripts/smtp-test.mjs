// Prueba de login SMTP con los mismos parámetros que usa EmailService.
// Uso: definir SMTP_USER y SMTP_PASSWORD en .env.local y correr
//   node scripts/smtp-test.mjs [correo-destino-opcional]
import "dotenv/config"
import { config } from "dotenv"
import nodemailer from "nodemailer"

config({ path: ".env.local", override: true })

const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASSWORD
const to = process.argv[2]

if (!user || !pass) {
  console.error("Faltan SMTP_USER / SMTP_PASSWORD en .env.local")
  process.exit(1)
}

console.log(`Cuenta: ${user}`)
console.log(`Contraseña: ${pass.replace(/\s/g, "").length} caracteres sin espacios (una App Password tiene 16)`)

for (const { port, secure } of [{ port: 587, secure: false }, { port: 465, secure: true }]) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure,
    auth: { user, pass },
    logger: true, // nodemailer oculta las credenciales en el log (/* secret */)
  })
  try {
    await transporter.verify()
    console.log(`\n✅ Login OK en puerto ${port}`)
    if (to) {
      const info = await transporter.sendMail({ from: `DMT69 <${user}>`, to, subject: "Prueba SMTP DMT", text: "Si llega esto, el SMTP funciona." })
      console.log(`✅ Enviado a ${to}: ${info.response}`)
    }
    break
  } catch (err) {
    console.log(`\n❌ Puerto ${port}: ${err.code || ""} ${err.responseCode || ""} ${err.message}`)
  }
}
