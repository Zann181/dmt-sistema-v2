import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { formatZodError } from "@/shared/utils/zod"
import { QrCodeService } from "@/infrastructure/qr/QrCodeService"
import { EmailService } from "@/infrastructure/email/EmailService"

const importRowSchema = z.object({
  name: z.string().min(1).max(120),
  cc: z.string().min(1).max(32),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
})

const importSchema = z.object({
  branchId: z.string().min(1),
  eventId: z.string().min(1),
  categoryId: z.string().min(1),
  rows: z.array(importRowSchema).min(1).max(2000),
})

async function loadQrLogoBuffer(qrLogoUrl: string) {
  const trimmed = qrLogoUrl.trim()
  if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
    return Buffer.from(trimmed)
  }
  if (trimmed.startsWith("data:")) {
    const base64Data = trimmed.split(",")[1]
    return Buffer.from(base64Data, "base64")
  }
  const absoluteUrl = trimmed.startsWith("http") ? trimmed : (() => {
    let baseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000"
    if (baseUrl.includes("localhost")) baseUrl = baseUrl.replace("localhost", "127.0.0.1")
    const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
    const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    return `${cleanBase}${cleanPath}`
  })()
  const res = await fetch(absoluteUrl)
  if (res.ok) return Buffer.from(await res.arrayBuffer())
  return Buffer.from("")
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessAttendees) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: any
  let parsed: z.infer<typeof importSchema>
  try {
    body = await req.json()
    parsed = importSchema.parse(body)
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(err) }, { status: 400 })
    }
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: any) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))

      try {
        await runImport(parsed, session.user.id, emit)
      } catch (err: any) {
        emit({ type: "error", message: err.message || "Error al importar" })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" }
  })
}

async function runImport(
  parsed: z.infer<typeof importSchema>,
  sessionUserId: string | undefined,
  emit: (obj: any) => void
) {
  const category = await prisma.attendeeCategory.findUnique({ where: { id: parsed.categoryId } })
  if (!category) { emit({ type: "error", message: "Categoría no encontrada" }); return }

  const branch = await prisma.branch.findUnique({ where: { id: parsed.branchId } })
  const event = await prisma.event.findUnique({ where: { id: parsed.eventId }, include: { branch: true } })
  if (!branch || !event) { emit({ type: "error", message: "Error de contexto" }); return }

  const createdById = sessionUserId ? await prisma.user.findUnique({ where: { id: sessionUserId } }).then((u: any) => u?.id ?? null) : null

  const fillColor = event.qrFillColor || "#102542"
  const backgroundColor = event.qrBackgroundColor || "#f8f9fa"
  const logoBackgroundColor = event.qrLogoBackgroundColor || "#ffffff"
  const logoScale = event.qrLogoScale || 4
  const qrLogoUrl = event.qrLogoUrl || branch.logoUrl
  const qrOptions = { color: { dark: fillColor, light: backgroundColor } }

  const subject = (event.emailSubject || "Tu acceso está listo: {nombre_evento}")
    .replace(/{nombre_evento}/g, event.name)
    .replace(/{nombre_sucursal}/g, event.branch?.name || "")

  let created = 0
  let skipped = 0
  let emailsSent = 0
  let noEmailCount = 0
  let emailFailedCount = 0
  const total = parsed.rows.length
  let processed = 0

  for (const row of parsed.rows) {
    const cc = row.cc.trim()
    const name = row.name.trim()
    const email = row.email ? row.email.trim() : null
    const phone = row.phone ? row.phone.trim() : null

    if (!cc || !name) { processed++; continue }

    const existing = await prisma.attendee.findUnique({
      where: { eventId_cc: { eventId: parsed.eventId, cc } }
    })

    // Ya está registrado para este evento: se ignora por completo, no se toca ni se reenvía nada.
    if (existing) {
      skipped++
      processed++
      continue
    }

    const uniqueId = Math.random().toString(36).substring(2, 12)
    const qrCode = `${branch.codePrefix}-${event.slug.substring(0, 5).toUpperCase()}-${uniqueId}`
    const attendee = await prisma.attendee.create({
      data: {
        name,
        cc,
        phone,
        email,
        branchId: parsed.branchId,
        eventId: parsed.eventId,
        categoryId: parsed.categoryId,
        createdById,
        origin: "MANUAL",
        qrCode,
        includedBalance: category.includedConsumptions,
        hasCheckedIn: false,
        paidAmount: category.price,
      }
    })
    created++
    const shouldSendEmail = !!email

    processed++

    if (!shouldSendEmail) {
      noEmailCount++
      emit({
        type: "progress", processed, total, cc, name, email: attendee.email,
        status: "created",
        emailStatus: "no_email"
      })
      continue
    }

    try {
      let qrBuffer: Buffer
      if (qrLogoUrl) {
        const logoBuffer = await loadQrLogoBuffer(qrLogoUrl)
        qrBuffer = logoBuffer.length > 0
          ? await QrCodeService.generateWithLogo(attendee.qrCode, QrCodeService.preprocessLogoBuffer(logoBuffer), { scale: logoScale, backgroundColor: logoBackgroundColor }, qrOptions)
          : await QrCodeService.generateBuffer(attendee.qrCode, qrOptions)
      } else {
        qrBuffer = await QrCodeService.generateBuffer(attendee.qrCode, qrOptions)
      }

      const { html: htmlContent, attachments: extraAttachments } = await EmailService.compileTemplate(
        event, name, attendee.qrCode, category.name, attendee.paidAmount.toString()
      )

      await EmailService.sendTicketEmail(
        attendee.email!,
        subject,
        htmlContent,
        qrBuffer,
        "acceso_qr.png",
        {
          host: event.emailHost,
          port: event.emailPort,
          secure: event.emailSecure,
          user: event.emailUser,
          pass: event.emailPassword,
          from: event.emailFrom,
        },
        extraAttachments
      )

      await prisma.attendee.update({ where: { id: attendee.id }, data: { emailSentAt: new Date() } })
      emailsSent++
      emit({ type: "progress", processed, total, cc, name, email: attendee.email, status: "created", emailStatus: "sent" })
    } catch (err: any) {
      console.error(`⚠️ Error enviando correo de importación a ${email}:`, err)
      emailFailedCount++
      emit({ type: "progress", processed, total, cc, name, email: attendee.email, status: "created", emailStatus: "failed", error: err.message })
    }
  }

  emit({
    type: "summary",
    summary: { created, skipped, emailsSent, noEmailCount, emailFailedCount, total }
  })
}
