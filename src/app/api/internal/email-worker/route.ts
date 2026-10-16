import { NextResponse } from "next/server"
import { after } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { processPendingTicketEmails, listPendingEventQueues, kickEmailWorker } from "@/domains/attendee/services/TicketEmailQueue"

// Worker de la cola de correos de tickets, sin navegador. Cada llamada envía una tanda
// lenta (un correo cada EMAIL_SEND_DELAY_MS) y, si quedan pendientes y avanzó, se
// vuelve a llamar a sí misma con after(): la cola avanza sola hasta vaciarse.
// Lo despiertan: la creación/importación/reenvío de asistentes y un cron diario de respaldo.
export const maxDuration = 60
const BATCH_BUDGET_MS = 45_000
const BATCH_MAX = 12

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(req.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const deadline = Date.now() + BATCH_BUDGET_MS
  let sent = 0
  let remaining = 0
  let busy: boolean = false
  let fatal: boolean = false
  const skipIds: string[] = [...(await req.json().catch(() => ({}))).skipIds ?? []].slice(0, 2000)

  for (const q of await listPendingEventQueues()) {
    if (Date.now() >= deadline) { remaining += 1; continue }
    const r = await processPendingTicketEmails({ ...q, deadline, max: BATCH_MAX, skipIds })
    sent += r.sent
    skipIds.push(...r.failed.map((f) => f.id))
    remaining += r.remaining
    if (r.busy) busy = true
    if (r.fatal) fatal = true
  }

  // Seguir solo si se avanzó: si todo falla (p. ej. límite diario de Gmail) se detiene
  // y lo retoma el cron del día siguiente o el próximo envío.
  if (remaining > 0 && sent > 0 && !fatal && !busy) after(() => kickEmailWorker(skipIds))

  return NextResponse.json({ data: { sent, remaining, busy, fatal } })
}

export const POST = run
export const GET = run // Vercel Cron llama con GET
