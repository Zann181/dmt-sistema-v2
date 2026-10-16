import { prisma } from "@/infrastructure/database/prisma"
import { QrCodeService } from "@/infrastructure/qr/QrCodeService"
import { EmailService } from "@/infrastructure/email/EmailService"

// Cola de correos de tickets. La "cola" es la propia tabla: un asistente con email y
// sin emailSentAt (ni entrega manual) está pendiente. Cada llamada envía lo que
// alcanza dentro de un tope de tiempo y deja el resto para la siguiente, así ninguna
// función corre minutos ni se repite trabajo: lo enviado queda marcado.
// El ritmo es lento a propósito: se genera y envía UN correo a la vez y se espera
// EMAIL_SEND_DELAY_MS entre uno y otro, así el consumo de CPU/memoria es bajo y parejo.

export const EMAIL_SEND_DELAY_MS = Number(process.env.EMAIL_SEND_DELAY_MS) || 3000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface QueueProgress {
  attendeeId: string
  name: string
  cc: string
  email: string
  status: "sent" | "failed"
  error?: string
}

async function loadLogoBuffer(logoUrl: string): Promise<Buffer> {
  const trimmed = logoUrl.trim()
  if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) return Buffer.from(trimmed)
  if (trimmed.startsWith("data:")) return Buffer.from(trimmed.split(",")[1] ?? "", "base64")
  const base = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000")
    .replace("localhost", "127.0.0.1")
    .replace(/\/$/, "")
  const url = trimmed.startsWith("http") ? trimmed : `${base}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`
  const res = await fetch(url)
  return res.ok ? Buffer.from(await res.arrayBuffer()) : Buffer.from("")
}

/** Carga todo lo que es igual para cada asistente del evento, una sola vez. */
async function prepareEventMailer(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { branch: true } })
  if (!event) throw new Error("Evento no encontrado")

  const qrOptions = { color: { dark: event.qrFillColor || "#102542", light: event.qrBackgroundColor || "#f8f9fa" } }
  const qrLogoUrl = event.qrLogoUrl || event.branch.logoUrl
  const rawLogo = qrLogoUrl ? await loadLogoBuffer(qrLogoUrl) : Buffer.from("")
  const qrLogo = rawLogo.length > 0 ? QrCodeService.preprocessLogoBuffer(rawLogo) : null

  const subject = (event.emailSubject || "Tu acceso está listo: {nombre_evento}")
    .replace(/{nombre_evento}/g, event.name)
    .replace(/{nombre_sucursal}/g, event.branch?.name || "")

  return async function send(a: { qrCode: string; name: string; email: string; paidAmount: unknown; categoryName: string }) {
    const qrBuffer = qrLogo
      ? await QrCodeService.generateWithLogo(a.qrCode, qrLogo, { scale: event.qrLogoScale || 4, backgroundColor: event.qrLogoBackgroundColor || "#ffffff" }, qrOptions)
      : await QrCodeService.generateBuffer(a.qrCode, qrOptions)
    const { html, attachments } = await EmailService.compileTemplate(event, a.name, a.qrCode, a.categoryName, String(a.paidAmount))
    await EmailService.sendTicketEmail(a.email, subject, html, qrBuffer, "acceso_qr.png", undefined, attachments)
  }
}

// Errores del servidor SMTP que indican que seguir intentando es inútil (límite diario de
// Gmail, credenciales rechazadas): se corta la tanda para no gastar CPU en QR que no saldrán.
const FATAL_SMTP = /5.4.5|sending limit|535|Invalid login|Username and Password not accepted/i

function pendingWhere(branchId: string, eventId: string) {
  return { branchId, eventId, origin: "MANUAL" as const, email: { not: null }, emailSentAt: null, qrDeliveredManuallyAt: null }
}

/**
 * Envía correos pendientes del evento hasta `deadline` (epoch ms) o `max` envíos.
 * `skipIds`: asistentes que ya fallaron en esta sesión de cola (no reintentar en bucle).
 * Solo corre un envío a la vez por evento (candado de Postgres): si otro proceso — el
 * navegador o el worker del servidor — ya está enviando, devuelve `busy: true`.
 */
export async function processPendingTicketEmails(opts: {
  branchId: string
  eventId: string
  deadline: number
  max?: number
  skipIds?: string[]
  onProgress?: (p: QueueProgress) => void
}) {
  const where = {
    ...pendingWhere(opts.branchId, opts.eventId),
    ...(opts.skipIds?.length ? { id: { notIn: opts.skipIds } } : {}),
  }

  type Result = { sent: number; failed: { id: string; name: string; error: string }[]; remaining: number; busy: boolean; fatal: boolean }
  return prisma.$transaction<Result>(async (tx) => {
    const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext(${"ticket-email-queue:" + opts.eventId})) AS locked`
    if (!locked) {
      return { sent: 0, failed: [] as { id: string; name: string; error: string }[], remaining: await tx.attendee.count({ where }), busy: true, fatal: false }
    }

    // Los que fallaron en esta cadena llegan en skipIds, así no bloquean a los demás.
    const pending = await tx.attendee.findMany({
      where,
      select: { id: true, name: true, cc: true, email: true, qrCode: true, paidAmount: true, category: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: opts.max ?? 50,
    })

    let sent = 0
    let fatal = false
    const failed: { id: string; name: string; error: string }[] = []

    if (pending.length > 0) {
      const send = await prepareEventMailer(opts.eventId)
      let first = true
      for (const a of pending) {
        if (Date.now() + EMAIL_SEND_DELAY_MS > opts.deadline && !first) break
        if (!first) await sleep(EMAIL_SEND_DELAY_MS)
        first = false
        try {
          await send({ qrCode: a.qrCode, name: a.name, email: a.email!, paidAmount: a.paidAmount, categoryName: a.category.name })
          await tx.attendee.update({ where: { id: a.id }, data: { emailSentAt: new Date() } })
          sent++
          opts.onProgress?.({ attendeeId: a.id, name: a.name, cc: a.cc, email: a.email!, status: "sent" })
        } catch (err: any) {
          console.error(`⚠️ Error enviando ticket a ${a.email}:`, err)
          const message = err?.message || "Error de envío"
          failed.push({ id: a.id, name: a.name, error: message })
          opts.onProgress?.({ attendeeId: a.id, name: a.name, cc: a.cc, email: a.email!, status: "failed", error: message })
          if (FATAL_SMTP.test(message)) { fatal = true; break }
        }
      }
    }

    const skip = [...(opts.skipIds ?? []), ...failed.map((f) => f.id)]
    const remaining = await tx.attendee.count({
      where: { ...where, ...(skip.length ? { id: { notIn: skip } } : {}) },
    })

    return { sent, failed, remaining, busy: false, fatal }
  }, { timeout: 120_000, maxWait: 5_000 })
}

/** Cuántos correos de tickets siguen en cola para el evento. */
export function countPendingTicketEmails(branchId: string, eventId: string) {
  return prisma.attendee.count({ where: pendingWhere(branchId, eventId) })
}

/** Eventos con correos pendientes (para el worker del servidor). */
export async function listPendingEventQueues() {
  const groups = await prisma.attendee.groupBy({
    by: ["branchId", "eventId"],
    where: { origin: "MANUAL", email: { not: null }, emailSentAt: null, qrDeliveredManuallyAt: null },
  })
  return groups.map((g) => ({ branchId: g.branchId, eventId: g.eventId }))
}

/**
 * Despierta al worker del servidor (fire-and-forget). Llamar dentro de `after()` para
 * que la respuesta al usuario no espere. El worker se encadena solo hasta vaciar la cola.
 */
export async function kickEmailWorker(skipIds: string[] = []) {
  const secret = process.env.CRON_SECRET
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
  if (!secret || !base) return
  try {
    await fetch(`${base}/api/internal/email-worker`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ skipIds }),
    })
  } catch (err) {
    console.error("⚠️ No se pudo despertar el worker de correos:", err)
  }
}
