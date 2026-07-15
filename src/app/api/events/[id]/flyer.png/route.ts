import { NextResponse } from "next/server"
import { prisma } from "@/infrastructure/database/prisma"
import sharp from "sharp"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { branch: true }
    })

    if (!event || !event.flyerUrl) {
      return NextResponse.json({ error: "Flyer no encontrado" }, { status: 404 })
    }

    let imageBuffer: Buffer
    const trimmed = event.flyerUrl.trim()

    if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
      let cleanSvg = trimmed.replace(/^<\?xml[^>]*\?>/i, "").trim()
      if (!cleanSvg.includes("xmlns=")) {
        cleanSvg = cleanSvg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')
      }

      // Check if it's a wrapped base64 image (created by our compressor)
      const match = cleanSvg.match(/<image\s+[^>]*href=["'](data:([^"';]+);base64,([^"']+))["']/i) || 
                    cleanSvg.match(/<image\s+[^>]*xlink:href=["'](data:([^"';]+);base64,([^"']+))["']/i)

      if (match && match[3]) {
        const base64 = match[3]
        imageBuffer = Buffer.from(base64, "base64")
      } else {
        // Pure vector SVG, render to PNG
        imageBuffer = await sharp(Buffer.from(cleanSvg))
          .resize({ width: 800 })
          .png()
          .toBuffer()
      }
    } else if (trimmed.startsWith("data:")) {
      const base64Data = trimmed.split(",")[1]
      imageBuffer = Buffer.from(base64Data, "base64")
    } else {
      const absoluteUrl = trimmed.startsWith("http") ? trimmed : (() => {
        const baseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
        const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
        return `${cleanBase}${cleanPath}`
      })()
      const res = await fetch(absoluteUrl)
      if (!res.ok) throw new Error("Error fetching flyer image from URL")
      imageBuffer = Buffer.from(await res.arrayBuffer())
    }

    // Convert whatever image format to clean PNG as requested
    const pngBuffer = await sharp(imageBuffer)
      .png({ quality: 90 })
      .toBuffer()

    return new Response(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="flyer_${event.slug}.png"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
