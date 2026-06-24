import { NextResponse } from "next/server"
import { QrCodeService } from "@/infrastructure/qr/QrCodeService"
import { z } from "zod"

const qrPreviewSchema = z.object({
  fillColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoScale: z.number().int().min(2).max(6),
  qrLogoUrl: z.string().optional().nullable().or(z.literal("")),
  text: z.string().optional().default("EVT-GRAN-ABC12345"),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = qrPreviewSchema.parse(body)

    let qrBuffer: Buffer

    const qrOptions = {
      color: {
        dark: parsed.fillColor,
        light: parsed.backgroundColor,
      }
    }

    if (parsed.qrLogoUrl) {
      let logoBuffer: Buffer
      const trimmed = parsed.qrLogoUrl.trim()
      
      if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
        logoBuffer = Buffer.from(trimmed)
      } else if (trimmed.startsWith("data:")) {
        // Handle data URI
        const base64Data = trimmed.split(",")[1]
        logoBuffer = Buffer.from(base64Data, "base64")
      } else {
        const res = await fetch(trimmed)
        if (!res.ok) throw new Error("Error al obtener logotipo desde URL")
        logoBuffer = Buffer.from(await res.arrayBuffer())
      }

      qrBuffer = await QrCodeService.generateWithLogo(
        parsed.text,
        logoBuffer,
        {
          scale: parsed.logoScale,
          backgroundColor: parsed.logoBackgroundColor,
        },
        qrOptions
      )
    } else {
      qrBuffer = await QrCodeService.generateBuffer(parsed.text, qrOptions)
    }

    return new Response(new Uint8Array(qrBuffer), {
      headers: {
        "Content-Type": "image/png",
      },
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
