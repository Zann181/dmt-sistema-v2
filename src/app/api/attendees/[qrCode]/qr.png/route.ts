import { NextResponse } from "next/server"
import { prisma } from "@/infrastructure/database/prisma"
import { QrCodeService } from "@/infrastructure/qr/QrCodeService"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ qrCode: string }> }
) {
  const { qrCode } = await params

  try {
    const attendee = await prisma.attendee.findUnique({
      where: { qrCode },
      include: {
        event: true,
        branch: true,
      },
    })

    if (!attendee) {
      return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 })
    }

    const { event, branch } = attendee

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
      let logoBuffer: Buffer
      const trimmed = qrLogoUrl.trim()
      
      if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
        logoBuffer = Buffer.from(trimmed)
      } else if (trimmed.startsWith("data:")) {
        const base64Data = trimmed.split(",")[1]
        logoBuffer = Buffer.from(base64Data, "base64")
      } else {
        const absoluteUrl = trimmed.startsWith("http") ? trimmed : (() => {
          const baseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
          const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
          const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
          return `${cleanBase}${cleanPath}`
        })()
        const res = await fetch(absoluteUrl)
        if (!res.ok) throw new Error("Error fetching logo from URL")
        logoBuffer = Buffer.from(await res.arrayBuffer())
      }

      qrBuffer = await QrCodeService.generateWithLogo(
        qrCode,
        logoBuffer,
        {
          scale: logoScale,
          backgroundColor: logoBackgroundColor,
        },
        qrOptions
      )
    } else {
      qrBuffer = await QrCodeService.generateBuffer(qrCode, qrOptions)
    }

    return new Response(new Uint8Array(qrBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
