import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { QrCodeService } from "@/infrastructure/qr/QrCodeService"
import { EmailService } from "@/infrastructure/email/EmailService"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessAttendees) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { attendeeId } = await req.json()
    if (!attendeeId) {
      return NextResponse.json({ error: "Falta ID del asistente" }, { status: 400 })
    }

    const attendee = await prisma.attendee.findUnique({
      where: { id: attendeeId },
      include: {
        event: {
          include: { branch: true }
        },
        category: true,
        branch: true
      }
    })

    if (!attendee) {
      return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 })
    }
    if (!attendee.email) {
      return NextResponse.json({ error: "El asistente no tiene un correo electrónico registrado" }, { status: 400 })
    }

    const { event, branch, category, qrCode, name, email } = attendee

    const fillColor = event.qrFillColor || "#102542"
    const backgroundColor = event.qrBackgroundColor || "#f8f9fa"
    const logoBackgroundColor = event.qrLogoBackgroundColor || "#ffffff"
    const logoScale = event.qrLogoScale || 4
    const qrLogoUrl = event.qrLogoUrl || branch.logoUrl

    const qrOptions = {
      color: {
        dark: fillColor,
        light: backgroundColor,
      }
    }

    let qrBuffer: Buffer

    if (qrLogoUrl) {
      let logoBuffer: Buffer = Buffer.from("")
      const trimmed = qrLogoUrl.trim()
      try {
        if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
          logoBuffer = Buffer.from(trimmed)
        } else if (trimmed.startsWith("data:")) {
          const base64Data = trimmed.split(",")[1]
          logoBuffer = Buffer.from(base64Data, "base64")
        } else {
          const absoluteUrl = trimmed.startsWith("http") ? trimmed : (() => {
            let baseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000"
            if (baseUrl.includes("localhost")) baseUrl = baseUrl.replace("localhost", "127.0.0.1")
            const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
            const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
            return `${cleanBase}${cleanPath}`
          })()
          const res = await fetch(absoluteUrl)
          if (res.ok) {
            logoBuffer = Buffer.from(await res.arrayBuffer())
          }
        }
      } catch (e) {
        console.error("Error loading QR logo buffer:", e)
      }

      if (logoBuffer.length > 0) {
        const processedLogo = QrCodeService.preprocessLogoBuffer(logoBuffer)
        qrBuffer = await QrCodeService.generateWithLogo(
          qrCode,
          processedLogo,
          {
            scale: logoScale,
            backgroundColor: logoBackgroundColor,
          },
          qrOptions
        )
      } else {
        qrBuffer = await QrCodeService.generateBuffer(qrCode, qrOptions)
      }
    } else {
      qrBuffer = await QrCodeService.generateBuffer(qrCode, qrOptions)
    }

    const { html: htmlContent, attachments: extraAttachments } = await EmailService.compileTemplate(event, name, qrCode, category.name)
    const subject = (event.emailSubject || "Tu acceso está listo: {nombre_evento}")
      .replace(/{nombre_evento}/g, event.name)
      .replace(/{nombre_sucursal}/g, event.branch?.name || "")

    await EmailService.sendTicketEmail(
      email,
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

    return NextResponse.json({ message: "Correo reenviado con éxito" })
  } catch (error: any) {
    console.error("❌ Error al reenviar correo de ticket:", error)
    return NextResponse.json({ error: error.message || "Error al reenviar el correo" }, { status: 500 })
  }
}
