import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { QrCodeService } from "@/infrastructure/qr/QrCodeService"
import { z } from "zod"

const qrPreviewSchema = z.object({
  qrPrefix: z.string().optional().default("EVT"),
  qrFillColor: z.string().optional().default("#102542"),
  qrBackgroundColor: z.string().optional().default("#f8f9fa"),
  qrLogoBackgroundColor: z.string().optional().default("#ffffff"),
  qrLogoScale: z.number().optional().default(4),
  qrLogoUrl: z.string().optional().nullable(),
})

export async function POST(req: Request) {
  const session = await auth()
  // Any authenticated user might need to preview this if they can manage events
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = qrPreviewSchema.parse(body)

    const qrOptions = {
      color: {
        dark: parsed.qrFillColor,
        light: parsed.qrBackgroundColor,
      }
    }

    const previewCode = `${parsed.qrPrefix}-GRAN-ABC12345`
    let qrBuffer: Buffer

    if (parsed.qrLogoUrl) {
      let logoBuffer: Buffer = Buffer.from("")
      const trimmed = parsed.qrLogoUrl.trim()
      
      try {
        if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
          logoBuffer = Buffer.from(trimmed)
        } else if (trimmed.startsWith("data:")) {
          const base64Data = trimmed.split(",")[1]
          if (base64Data) {
            logoBuffer = Buffer.from(base64Data, "base64")
          }
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
          } else {
            const errText = `QR Preview Fetch failed for logo URL: ${absoluteUrl} Status: ${res.status} ${res.statusText}`
            console.error(errText)
            return NextResponse.json({ error: errText }, { status: 500 })
          }
        }
      } catch (e: any) {
        console.error("Error loading QR logo buffer for preview:", e)
        return NextResponse.json({ error: "Exception fetching logo: " + e.message }, { status: 500 })
      }

      if (logoBuffer.length > 0) {
        const processedLogo = QrCodeService.preprocessLogoBuffer(logoBuffer)
        qrBuffer = await QrCodeService.generateWithLogo(
          previewCode,
          processedLogo,
          {
            scale: parsed.qrLogoScale,
            backgroundColor: parsed.qrLogoBackgroundColor,
          },
          qrOptions
        )
      } else {
        qrBuffer = await QrCodeService.generateBuffer(previewCode, qrOptions)
      }
    } else {
      qrBuffer = await QrCodeService.generateBuffer(previewCode, qrOptions)
    }

    const base64Image = `data:image/png;base64,${qrBuffer.toString("base64")}`
    
    return NextResponse.json({ data: base64Image })
  } catch (error: any) {
    console.error("Error generating QR preview:", error)
    return NextResponse.json({ error: error.message || "Error al generar vista previa del QR" }, { status: 500 })
  }
}
