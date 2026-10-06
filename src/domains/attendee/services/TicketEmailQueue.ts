import { prisma } from "@/infrastructure/database/prisma"
import { QrCodeService } from "@/infrastructure/qr/QrCodeService"
import { EmailService } from "@/infrastructure/email/EmailService"

// Cola de correos de tickets. La "cola" es la propia tabla: un asistente con email y
// sin emailSentAt (ni entrega manual) está pendiente. Cada llamada envía lo que
// alcanza dentro de un tope de tiempo y deja el resto para la siguiente, así ninguna
// función corre minutos ni se repite trabajo: lo enviado queda marcado.

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

  const smtp = {
    host: event.emailHost,
    port: event.emailPort,
    secure: event.emailSecure,
    user: event.emailUser,
    pass: event.emailPassword,
    from: event.emailFrom,
  }

  return async function send(a: { qrCode: string; name: string; email: string; paidAmount: unknown; categoryName: string }) {
    const qrBuffer = qrLogo
      ? await QrCodeService.generateWithLogo(a.qrCode, qrLogo, { scale: event.qrLogoScale || 4, backgroundColor: event.qrLogoBackgroundColor || "#ffffff" }, qrOptions)
      : await QrCodeService.generateBuffer(a.qrCode, qrOptions)
    const { html, attachments } = await EmailService.compileTemplate(event, a.name, a.qrCode, a.categoryName, String(a.paidAmount))
    await EmailService.sendTicketEmail(a.email, subject, html, qrBuffer, "acceso_qr.png", smtp, attachments)
  }
}

/**
 * Envía correos pendientes del evento hasta `deadline` (epoch ms) o `max` envíos.
 * `skipIds`: asistentes que ya fallaron en esta sesión de cola (no reintentar en bucle).
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
    branchId: opts.branchId,
    eventId: opts.eventId,
    origin: "MANUAL" as const,
    email: { not: null },
    emailSentAt: null,
    qrDeliveredManuallyAt: null,
    ...(opts.skipIds?.length ? { id: { notIn: opts.skipIds } } : {}),
  }

  const pending = await prisma.attendee.findMany({
    where,
    select: { id: true, name: true, cc: true, email: true, qrCode: true, paidAmount: true, category: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: opts.max ?? 50,
  })

  let sent = 0
  const failed: { id: string; name: string; error: string }[] = []

  if (pending.length > 0) {
    const send = await prepareEventMailer(opts.eventId)
    for (const a of pending) {
      if (Date.now() > opts.deadline) break
      try {
        await send({ qrCode: a.qrCode, name: a.name, email: a.email!, paidAmount: a.paidAmount, categoryName: a.category.name })
        await prisma.attendee.update({ where: { id: a.id }, data: { emailSentAt: new Date() } })
        sent++
        opts.onProgress?.({ attendeeId: a.id, name: a.name, cc: a.cc, email: a.email!, status: "sent" })
      } catch (err: any) {
        console.error(`⚠️ Error enviando ticket a ${a.email}:`, err)
        failed.push({ id: a.id, name: a.name, error: err?.message || "Error de envío" })
        opts.onProgress?.({ attendeeId: a.id, name: a.name, cc: a.cc, email: a.email!, status: "failed", error: err?.message })
      }
    }
  }

  const skip = [...(opts.skipIds ?? []), ...failed.map((f) => f.id)]
  const remaining = await prisma.attendee.count({
    where: { ...where, ...(skip.length ? { id: { notIn: skip } } : {}) },
  })

  return { sent, failed, remaining }
}
