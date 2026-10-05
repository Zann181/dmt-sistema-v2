import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { QrCodeService } from "@/infrastructure/qr/QrCodeService"
import { z } from "zod"
import { apiError } from "@/shared/errors/apiError"
import { hasPermissionAnywhere } from "@/shared/guards/branchAccess"

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
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // El servidor descarga la URL del logo: limitarlo a quien configura eventos evita
  // que cualquier cuenta lo use para hacer peticiones arbitrarias (SSRF)
  if (!(await hasPermissionAnywhere(session, "manageEventsConfig"))) {
    return NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 })
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
          const absoluteUrl = /^https?:\/\//i.test(trimmed) ? trimmed : (() => {
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
            console.error(`QR Preview Fetch failed for logo URL: ${absoluteUrl} Status: ${res.status} ${res.statusText}`)
            return NextResponse.json({ error: `No se pudo descargar el logo (HTTP ${res.status})` }, { status: 400 })
          }
        }
      } catch (e: any) {
        console.error("Error loading QR logo buffer for preview:", e)
        return NextResponse.json({ error: "No se pudo cargar el logo del QR" }, { status: 400 })
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
    return apiError(error, 500, "Error al generar vista previa del QR")
  }
}
