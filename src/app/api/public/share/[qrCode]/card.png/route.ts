import { NextResponse } from "next/server"
import { prisma } from "@/infrastructure/database/prisma"
import { QrCodeService } from "@/infrastructure/qr/QrCodeService"

export const dynamic = "force-dynamic"

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
      return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }

    const { event, branch } = attendee
    const qrLogoUrl = event.qrLogoUrl || branch.logoUrl

    let logoBuffer: Buffer | undefined
    let logoOptions: { scale?: number; backgroundColor?: string } | undefined

    if (qrLogoUrl) {
      const trimmed = qrLogoUrl.trim()
      if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
        logoBuffer = Buffer.from(trimmed)
      } else if (trimmed.startsWith("data:")) {
        const base64Data = trimmed.split(",")[1]
        logoBuffer = Buffer.from(base64Data, "base64")
      } else {
        try {
          const res = await fetch(trimmed)
          if (res.ok) logoBuffer = Buffer.from(await res.arrayBuffer())
        } catch { /* skip logo if fetch fails */ }
      }

      logoOptions = {
        scale: event.qrLogoScale || 4,
        backgroundColor: event.qrLogoBackgroundColor || "#ffffff",
      }
    }

    const qrColorOptions = {
      color: {
        dark: event.qrFillColor || "#102542",
        light: event.qrBackgroundColor || "#f8f9fa",
      }
    }

    const cardBuffer = await QrCodeService.buildWhatsAppShareCard(
      qrCode,
      event.name,
      logoBuffer,
      logoOptions,
      qrColorOptions
    )

    return new Response(new Uint8Array(cardBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
