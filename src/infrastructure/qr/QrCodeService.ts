import QRCode from "qrcode"
import sharp from "sharp"

export class QrCodeService {
  static async generateBuffer(text: string, options?: QRCode.QRCodeToBufferOptions): Promise<Buffer> {
    return QRCode.toBuffer(text, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 512,
      version: 10,
      ...options
    })
  }

  static preprocessLogoBuffer(logoBuffer: Buffer): Buffer {
    try {
      const content = logoBuffer.toString("utf8").trim()
      if (content.startsWith("<svg") || content.startsWith("<?xml")) {
        // 1. Detect if it's a wrapped image (PNG/JPG wrapped in SVG by the frontend)
        const match = content.match(/<image\s+[^>]*href=["'](data:[^"']+)["']/i) || 
                      content.match(/<image\s+[^>]*xlink:href=["'](data:[^"']+)["']/i)
        if (match && match[1]) {
          const dataUri = match[1]
          const base64Matches = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/)
          if (base64Matches && base64Matches[2]) {
            return Buffer.from(base64Matches[2], "base64")
          }
        }

        // 2. It's a native SVG. Ensure it has xmlns and absolute dimensions.
        let cleanSvg = content
        if (!cleanSvg.includes("xmlns=")) {
          cleanSvg = cleanSvg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')
        }
        cleanSvg = cleanSvg.replace(/width=["']100%["']/gi, 'width="500"')
        cleanSvg = cleanSvg.replace(/height=["']100%["']/gi, 'height="500"')
        return Buffer.from(cleanSvg)
      }
    } catch (e) {
      console.error("Error preprocessing logo buffer:", e)
    }
    return logoBuffer
  }

  static async generateWithLogo(
    text: string, 
    logoBuffer: Buffer, 
    logoOptions?: {
      scale?: number             // 2 - 8 (default 4)
      backgroundColor?: string   // HEX (default "#ffffff")
    },
    qrOptions?: QRCode.QRCodeToBufferOptions
  ): Promise<Buffer> {
    const qrBuffer = await this.generateBuffer(text, qrOptions)
    
    const scale = logoOptions?.scale ?? 4
    const bgColor = logoOptions?.backgroundColor ?? "#ffffff"
    
    // Calculate sizes based on scale (scale * 20 for logo, (scale + 1.5) * 20 for circle)
    const logoSize = scale * 20
    const circleSize = Math.round((scale + 1.5) * 20)
    
    const logoRadius = logoSize / 2
    const circleRadius = circleSize / 2

    // Resize logo to fit inside the container with transparent background
    const processedLogo = this.preprocessLogoBuffer(logoBuffer)
    const logoResized = await sharp(processedLogo)
      .resize(logoSize, logoSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer()

    // Create a circle mask to crop the resized logo
    const maskSvg = Buffer.from(`
      <svg width="${logoSize}" height="${logoSize}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${logoRadius}" cy="${logoRadius}" r="${logoRadius}" fill="white" />
      </svg>
    `)

    // Mask/clip the logo to a circle
    const circularLogo = await sharp(logoResized)
      .composite([{ input: maskSvg, blend: "dest-in" }])
      .png()
      .toBuffer()

    // Create a circular colored background
    const circleSvg = Buffer.from(`
      <svg width="${circleSize}" height="${circleSize}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${circleRadius}" cy="${circleRadius}" r="${circleRadius}" fill="${bgColor}" />
      </svg>
    `)
    const coloredCircle = await sharp(circleSvg).png().toBuffer()

    // Composite circular logo in center of colored circle
    const combinedLogo = await sharp(coloredCircle)
      .composite([{ input: circularLogo, gravity: "center" }])
      .png()
      .toBuffer()

    // Composite circular logo card over QR Code
    return sharp(qrBuffer)
      .composite([{ input: combinedLogo, gravity: "center" }])
      .toBuffer()
  }

  static async buildWhatsAppShareCard(
    qrCode: string, 
    eventName: string,
    logoBuffer?: Buffer,
    logoOptions?: {
      scale?: number
      backgroundColor?: string
    },
    qrOptions?: QRCode.QRCodeToBufferOptions
  ): Promise<Buffer> {
    // Generate a card dynamically with the QR code and event text
    const qrBuffer = logoBuffer
      ? await this.generateWithLogo(qrCode, logoBuffer, logoOptions, { width: 300, ...qrOptions })
      : await this.generateBuffer(qrCode, { width: 300, ...qrOptions })
    
    const svgOverlay = `
      <svg width="600" height="400" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="400" fill="#102542" rx="15" />
        <text x="30" y="60" fill="#ffffff" font-family="sans-serif" font-size="28" font-weight="bold">Invitación Oficial</text>
        <text x="30" y="100" fill="#a5b4fc" font-family="sans-serif" font-size="18">${eventName}</text>
        <text x="30" y="320" fill="#ffffff" font-family="sans-serif" font-size="14" opacity="0.8">Código de Acceso:</text>
        <text x="30" y="350" fill="#facc15" font-family="sans-serif" font-size="22" font-weight="bold">${qrCode}</text>
      </svg>
    `

    const cardBase = await sharp(Buffer.from(svgOverlay)).toBuffer()

    return sharp(cardBase)
      .composite([{ input: qrBuffer, left: 320, top: 50 }])
      .toBuffer()
  }
}
