import QRCode from "qrcode"
import sharp from "sharp"

export class QrCodeService {
  static async generateBuffer(text: string, options?: QRCode.QRCodeToBufferOptions): Promise<Buffer> {
    return QRCode.toBuffer(text, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 512,
      version: 5,
      ...options
    })
  }

  static async generateWithLogo(
    text: string, 
    logoBuffer: Buffer, 
    logoOptions?: {
      scale?: number             // 2 - 6 (default 4)
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
    const logoResized = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer()

    // Create a circle mask to crop the resized logo
    const maskSvg = Buffer.from(`
      <svg width="${logoSize}" height="${logoSize}">
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
      <svg width="${circleSize}" height="${circleSize}">
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
