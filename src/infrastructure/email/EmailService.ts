import { Resend } from "resend"
import nodemailer from "nodemailer"
import sharp from "sharp"

export class EmailService {
  private static getClient() {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn("⚠️ RESEND_API_KEY no configurada. Los correos se imprimirán en consola.")
      return null
    }
    return new Resend(apiKey)
  }

  static async sendTicketEmail(
    to: string,
    subject: string,
    htmlContent: string,
    qrAttachmentBuffer?: Buffer,
    qrFileName?: string,
    smtpConfig?: {
      host?: string | null
      port?: number | null
      secure?: boolean
      user?: string | null
      pass?: string | null
      from?: string | null
    },
    extraAttachments?: Array<{
      content: Buffer
      filename: string
      cid: string
      contentId: string
      contentType: string
    }>
  ): Promise<any> {
    // Si se especifican credenciales SMTP, enviar vía nodemailer
    if (smtpConfig && smtpConfig.host && smtpConfig.user && smtpConfig.pass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port || 587,
          secure: smtpConfig.secure ?? false,
          auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
          },
        })

        const mailOptions = {
          from: smtpConfig.from || smtpConfig.user,
          to,
          subject,
          html: htmlContent,
          attachments: [
            ...(qrAttachmentBuffer
              ? [
                  {
                    filename: qrFileName || "acceso_qr.png",
                    content: qrAttachmentBuffer,
                    cid: "acceso_qr.png", // Para incrustar como imagen inline en el HTML
                  },
                ]
              : []),
            ...(extraAttachments
              ? extraAttachments.map((att) => ({
                  filename: att.filename,
                  content: att.content,
                  cid: att.cid,
                }))
              : []),
          ],
        }

        const info = await transporter.sendMail(mailOptions)
        console.log("✅ Correo enviado via SMTP:", info.messageId)
        return info
      } catch (error) {
        console.error("❌ Error al enviar correo via SMTP:", error)
        throw error
      }
    }
    const resend = this.getClient()
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

    if (!resend) {
      console.log(`[EMAIL MOCK] Enviando correo a ${to}`)
      console.log(`Asunto: ${subject}`)
      console.log(`HTML: ${htmlContent.substring(0, 100)}...`)
      if (qrAttachmentBuffer) {
        console.log(`Adjunto: ${qrFileName || "qr.png"} (${qrAttachmentBuffer.length} bytes)`)
      }
      if (extraAttachments && extraAttachments.length > 0) {
        console.log(`Adjuntos extra: ${extraAttachments.map(a => a.filename).join(", ")}`)
      }
      return { id: "mock_email_id" }
    }

    const attachments = [
      ...(qrAttachmentBuffer
        ? [
            {
              content: qrAttachmentBuffer.toString("base64"),
              filename: qrFileName || "acceso_qr.png",
              contentId: "acceso_qr.png",
              contentType: "image/png",
              encoding: "base64"
            },
          ]
        : []),
      ...(extraAttachments
        ? extraAttachments.map((att) => ({
            content: att.content.toString("base64"),
            filename: att.filename,
            contentId: att.contentId,
          }))
        : []),
    ]

    try {
      const response = await resend.emails.send({
        from: fromEmail,
        to,
        subject,
        html: htmlContent,
        attachments,
      })
      console.log("✅ Correo enviado via Resend:", response.data?.id)
      return response.data
    } catch (error) {
      console.error("❌ Error al enviar correo via Resend:", error)
      throw error
    }
  }

  private static getAbsoluteUrl(url: string | null | undefined): string {
    if (!url) return ""
    const trimmed = url.trim()
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
      return trimmed
    }
    const baseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
    const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    return `${cleanBase}${cleanPath}`
  }

  private static parseDataUri(dataUri: string): { buffer: Buffer; contentType: string; extension: string } | null {
    const matches = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/)
    if (!matches || matches.length !== 3) {
      return null
    }
    const contentType = matches[1]
    const base64Data = matches[2]
    const buffer = Buffer.from(base64Data, "base64")
    const extension = contentType.split("/")[1] || "png"
    return { buffer, contentType, extension }
  }

  static async compileTemplate(
    event: any,
    attendeeName: string,
    qrCode?: string,
    categoryName?: string
  ): Promise<{
    html: string
    attachments: Array<{
      content: Buffer
      filename: string
      cid: string
      contentId: string
      contentType: string
    }>
  }> {
    const emailBg = event.emailBackgroundColor || "#0a0a0c"
    const cardBg = event.emailCardColor || "#111114"
    const headerBg = event.emailHeaderBackgroundColor || "#000000"
    const textColor = event.emailTextColor || "#f3f4f6"
    const titleColor = event.emailTitleColor || textColor
    const mutedColor = event.emailMutedTextColor || "#8e9296"
    const accentColor = event.emailAccentColor || "#00ffcc"
    const borderColor = event.emailBorderColor || "#1f1f26"
    const sectionBg = event.emailSectionBackgroundColor || "#060608"
    const warningBg = event.emailWarningBackgroundColor || "#1c0d0d"

    const attachments: Array<{
      content: Buffer
      filename: string
      cid: string
      contentId: string
      contentType: string
    }> = []

    let logoHtml = ""
    const logoUrl = event.logoUrl || event.branch?.logoUrl || ""
    if (logoUrl) {
      const trimmed = logoUrl.trim()
      const size = event.emailLogoSize || 80
      if (trimmed.startsWith("data:")) {
        const parsed = this.parseDataUri(trimmed)
        if (parsed) {
          const cid = "logo_image"
          attachments.push({
            content: parsed.buffer,
            filename: `logo.${parsed.extension}`,
            cid,
            contentId: cid,
            contentType: parsed.contentType,
          })
          logoHtml = `<img src="cid:${cid}" alt="Logo" style="height: ${size}px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto;" />`
        } else {
          logoHtml = `<span style="color: #ffffff; font-weight: 900; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">${event.name}</span>`
        }
      } else if (trimmed.startsWith("http")) {
        logoHtml = `<img src="${trimmed}" alt="Logo" style="height: ${size}px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto;" />`
      } else if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
        try {
          let cleanSvg = trimmed.replace(/^<\?xml[^>]*\?>/i, "").trim()
          if (!cleanSvg.includes("xmlns=")) {
            cleanSvg = cleanSvg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')
          }
          const match = cleanSvg.match(/<image\s+[^>]*href=["'](data:([^"';]+);base64,([^"']+))["']/i) || 
                        cleanSvg.match(/<image\s+[^>]*xlink:href=["'](data:([^"';]+);base64,([^"']+))["']/i)
          if (match && match[3]) {
            const contentType = match[2]
            const base64 = match[3]
            const buffer = Buffer.from(base64, "base64")
            const ext = contentType.split("/")[1] || "webp"
            const cid = "logo_image"
            attachments.push({
              content: buffer,
              filename: `logo.${ext}`,
              cid,
              contentId: cid,
              contentType,
            })
            logoHtml = `<img src="cid:${cid}" alt="Logo" style="height: ${size}px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto;" />`
          } else {
            const pngBuffer = await sharp(Buffer.from(cleanSvg))
              .resize({ height: size * 2 })
              .png()
              .toBuffer()
            const cid = "logo_image"
            attachments.push({
              content: pngBuffer,
              filename: "logo.png",
              cid,
              contentId: cid,
              contentType: "image/png",
            })
            logoHtml = `<img src="cid:${cid}" alt="Logo" style="height: ${size}px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto;" />`
          }
        } catch (e) {
          logoHtml = `<span style="color: #ffffff; font-weight: 900; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">${event.name}</span>`
        }
      } else {
        const absoluteLogoUrl = this.getAbsoluteUrl(trimmed)
        logoHtml = `<img src="${absoluteLogoUrl}" alt="Logo" style="height: ${size}px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto;" />`
      }
    } else {
      logoHtml = `<span style="color: #ffffff; font-weight: 900; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">${event.name}</span>`
    }

    // Branch watermark logo helper
    const branchLogoUrl = event.branch?.logoUrl || ""
    let branchLogoWatermarkUrl = ""
    if (branchLogoUrl) {
      const trimmed = branchLogoUrl.trim()
      if (trimmed.startsWith("data:")) {
        const parsed = this.parseDataUri(trimmed)
        if (parsed) {
          const cid = "watermark_image"
          attachments.push({
            content: parsed.buffer,
            filename: `watermark.${parsed.extension}`,
            cid,
            contentId: cid,
            contentType: parsed.contentType,
          })
          branchLogoWatermarkUrl = `cid:${cid}`
        }
      } else if (trimmed.startsWith("http")) {
        branchLogoWatermarkUrl = trimmed
      } else if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
        try {
          let cleanSvg = trimmed.replace(/^<\?xml[^>]*\?>/i, "").trim()
          if (!cleanSvg.includes("xmlns=")) {
            cleanSvg = cleanSvg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')
          }
          const match = cleanSvg.match(/<image\s+[^>]*href=["'](data:([^"';]+);base64,([^"']+))["']/i) || 
                        cleanSvg.match(/<image\s+[^>]*xlink:href=["'](data:([^"';]+);base64,([^"']+))["']/i)
          if (match && match[3]) {
            const contentType = match[2]
            const base64 = match[3]
            const buffer = Buffer.from(base64, "base64")
            const ext = contentType.split("/")[1] || "webp"
            const cid = "watermark_image"
            attachments.push({
              content: buffer,
              filename: `watermark.${ext}`,
              cid,
              contentId: cid,
              contentType,
            })
            branchLogoWatermarkUrl = `cid:${cid}`
          } else {
            const pngBuffer = await sharp(Buffer.from(cleanSvg))
              .resize({ width: 400 })
              .png()
              .toBuffer()
            const cid = "watermark_image"
            attachments.push({
              content: pngBuffer,
              filename: "watermark.png",
              cid,
              contentId: cid,
              contentType: "image/png",
            })
            branchLogoWatermarkUrl = `cid:${cid}`
          }
        } catch (e) {
          branchLogoWatermarkUrl = ""
        }
      } else {
        branchLogoWatermarkUrl = this.getAbsoluteUrl(trimmed)
      }
    }

    let flyerHtml = ""
    if (event.flyerUrl) {
      const trimmedFlyer = event.flyerUrl.trim()
      if (trimmedFlyer.startsWith("data:")) {
        const parsed = this.parseDataUri(trimmedFlyer)
        if (parsed) {
          const cid = "flyer_image"
          attachments.push({
            content: parsed.buffer,
            filename: `flyer.${parsed.extension}`,
            cid,
            contentId: cid,
            contentType: parsed.contentType,
          })
          flyerHtml = `
            <div style="margin-top: 24px; margin-bottom: 24px; text-align: center;">
              <img src="cid:${cid}" alt="Flyer del Evento" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid ${borderColor}; display: block; margin: 0 auto; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);" />
            </div>
          `
        }
      } else if (trimmedFlyer.startsWith("<svg") || trimmedFlyer.startsWith("<?xml")) {
        try {
          let cleanSvg = trimmedFlyer.replace(/^<\?xml[^>]*\?>/i, "").trim()
          if (!cleanSvg.includes("xmlns=")) {
            cleanSvg = cleanSvg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')
          }
          const match = cleanSvg.match(/<image\s+[^>]*href=["'](data:([^"';]+);base64,([^"']+))["']/i) || 
                        cleanSvg.match(/<image\s+[^>]*xlink:href=["'](data:([^"';]+);base64,([^"']+))["']/i)
          if (match && match[3]) {
            const contentType = match[2]
            const base64 = match[3]
            const buffer = Buffer.from(base64, "base64")
            const ext = contentType.split("/")[1] || "webp"
            const cid = "flyer_image"
            attachments.push({
              content: buffer,
              filename: `flyer.${ext}`,
              cid,
              contentId: cid,
              contentType,
            })
            flyerHtml = `
              <div style="margin-top: 24px; margin-bottom: 24px; text-align: center;">
                <img src="cid:${cid}" alt="Flyer del Evento" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid ${borderColor}; display: block; margin: 0 auto; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);" />
              </div>
            `
          } else {
            const pngBuffer = await sharp(Buffer.from(cleanSvg))
              .resize({ width: 600 })
              .png()
              .toBuffer()
            const cid = "flyer_image"
            attachments.push({
              content: pngBuffer,
              filename: "flyer.png",
              cid,
              contentId: cid,
              contentType: "image/png",
            })
            flyerHtml = `
              <div style="margin-top: 24px; margin-bottom: 24px; text-align: center;">
                <img src="cid:${cid}" alt="Flyer del Evento" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid ${borderColor}; display: block; margin: 0 auto; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);" />
              </div>
            `
          }
        } catch (e) {
          flyerHtml = ""
        }
      } else {
        const absoluteFlyerUrl = this.getAbsoluteUrl(trimmedFlyer)
        flyerHtml = `
          <div style="margin-top: 24px; margin-bottom: 24px; text-align: center;">
            <img src="${absoluteFlyerUrl}" alt="Flyer del Evento" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid ${borderColor}; display: block; margin: 0 auto; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);" />
          </div>
        `
      }
    }

    const replaceTemplates = (text: string) => {
      if (!text) return ""
      
      const tzOptions = { timeZone: process.env.NEXT_PUBLIC_TIMEZONE || 'America/Bogota' }
      
      let result = text
        .replace(/{nombre_evento}/g, event.name)
        .replace(/{nombre_sucursal}/g, event.branch?.name || "")
        .replace(/{fecha_evento}/g, new Date(event.startsAt).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', ...tzOptions }))
        .replace(/{hora_evento}/g, `${new Date(event.startsAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', ...tzOptions })} - ${new Date(event.endsAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', ...tzOptions })}`)
        .replace(/{nombre_asistente}/g, attendeeName)

      if (qrCode) {
        result = result.replace(/{codigo_qr}/g, qrCode)
      }
      if (categoryName) {
        result = result.replace(/{nombre_categoria}/g, categoryName)
      }
      return result
    }

    const heading = replaceTemplates(event.emailHeading || "Hola {nombre_asistente}")
    const introText = event.emailIntro ? `<p style="white-space: pre-line; margin-top: 0; color: ${mutedColor}; font-size: 13px; line-height: 1.6; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${replaceTemplates(event.emailIntro)}</p>` : ""

    const dateText = replaceTemplates(event.emailDateText || "{fecha_evento}")
    const timeText = replaceTemplates(event.emailTimeText || "{hora_evento}")

    let bodyHtml = ""
    if (event.emailBody) {
      bodyHtml = `
        <div style="padding-top: 20px; border-top: 1px dashed ${borderColor}; margin-top: 20px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
          ${event.emailMessageTitle ? `<p style="font-weight: bold; font-size: 11px; text-transform: uppercase; margin-bottom: 8px; color: ${accentColor}; letter-spacing: 1.5px;">// ${event.emailMessageTitle}</p>` : ""}
          <p style="white-space: pre-line; margin-top: 0; color: ${textColor}; font-size: 13px; line-height: 1.6;">${replaceTemplates(event.emailBody)}</p>
        </div>
      `
    }

    let warningHtml = ""
    if (event.emailWarningText) {
      warningHtml = `
        <div style="padding: 14px; border-radius: 8px; background-color: ${warningBg}; border-left: 2px solid ${accentColor}; margin-top: 20px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
          <p style="font-weight: bold; color: ${accentColor}; font-size: 10px; text-transform: uppercase; margin: 0 0 6px 0; letter-spacing: 1.5px;">
            ⚠️ ${event.emailWarningTitle || "Importante"}
          </p>
          <p style="margin: 0; color: ${textColor}; font-size: 11px; line-height: 1.5;">
            ${replaceTemplates(event.emailWarningText)}
          </p>
        </div>
      `
    }

    const qrTitle = event.emailQrTitle || "Tu código QR de acceso"
    const qrNote = event.emailQrNote || "Presenta este código en la entrada del evento."

    const closingText = event.emailClosingText || "Nos vemos pronto!"
    const teamSignature = replaceTemplates(event.emailTeamSignature || "{nombre_sucursal}")

    const footerText = event.emailFooter ? `<p style="margin: 0 0 5px 0; color: ${mutedColor};">${replaceTemplates(event.emailFooter)}</p>` : ""
    const legalText = event.emailLegalNote ? `<p style="margin: 0; font-weight: 600; font-size: 8px; color: ${mutedColor};">${replaceTemplates(event.emailLegalNote)}</p>` : ""

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${event.name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${emailBg}; color: ${textColor};">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${emailBg}; background-image: radial-gradient(circle at 15% 20%, ${accentColor}1a 0%, transparent 55%), radial-gradient(circle at 85% 80%, ${accentColor}15 0%, transparent 55%); padding: 40px 10px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="450px" style="max-width: 450px; background-color: ${cardBg}; border: 1px solid ${borderColor}; border-radius: 12px; overflow: hidden; border-collapse: collapse; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color: ${headerBg}; padding: 30px 20px 20px 20px; border-bottom: 1px solid ${borderColor};">
              ${logoHtml}
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px 24px; color: ${textColor}; position: relative;">
              <!-- Watermark Logo -->
              ${branchLogoWatermarkUrl ? `
              <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; opacity: 0.035; background-image: url('${branchLogoWatermarkUrl}'); background-repeat: no-repeat; background-position: center; background-size: 260px; pointer-events: none;"></div>
              ` : ""}

              <div style="position: relative; z-index: 1;">
                <h1 style="font-size: 18px; font-weight: bold; margin-top: 0; margin-bottom: 14px; letter-spacing: -0.025em; color: ${titleColor}; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${heading}</h1>
                
                ${introText}

                <!-- Event Details -->
                <table width="100%" border="0" cellspacing="0" cellpadding="16" style="background-color: ${sectionBg}; border: 1px solid ${borderColor}; border-radius: 8px; color: ${textColor}; margin-top: 20px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                  <tr>
                    <td>
                      <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: ${accentColor}; margin: 0 0 8px 0; letter-spacing: 2px;">
                        // ${event.emailDetailsTitle || "Detalles del Evento"}
                      </p>
                      <p style="font-size: 14px; font-weight: bold; margin: 0 0 6px 0; color: ${textColor};">
                        ${dateText}
                      </p>
                      <p style="font-size: 13px; color: ${mutedColor}; margin: 0 0 10px 0;">
                        ${timeText}
                      </p>
                      <p style="font-size: 11px; color: ${accentColor}; margin: 0; font-weight: bold; letter-spacing: 0.5px;">
                        LOC_SYS: ${event.venueName || "Venue principal"}
                      </p>
                    </td>
                  </tr>
                </table>

                ${flyerHtml}
                ${bodyHtml}
                ${warningHtml}

                <!-- QR Code -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 24px; border-top: 1px solid ${borderColor}; padding-top: 24px; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                  <tr>
                    <td align="center">
                      <p style="font-weight: bold; font-size: 12px; margin-top: 0; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1.5px; color: ${textColor};">${qrTitle}</p>
                      <div style="display: inline-block; padding: 14px; background-color: #ffffff; border: 1px solid ${borderColor}; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                        <img src="cid:acceso_qr.png" alt="Código QR" width="260" height="260" style="display: block;" />
                      </div>
                      <p style="font-size: 10px; color: ${mutedColor}; margin-top: 12px; margin-bottom: 0; max-width: 280px; line-height: 1.4;">${qrNote}</p>
                    </td>
                  </tr>
                </table>

              <!-- Closing -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                <tr>
                  <td>
                    <p style="font-weight: 500; font-size: 13px; margin: 0 0 6px 0; color: ${textColor};">${closingText}</p>
                    <p style="font-weight: bold; font-size: 11px; text-transform: uppercase; color: ${accentColor}; margin: 0; letter-spacing: 2px;">
                      // ${teamSignature}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          ${event.emailFooter ? `
          <tr>
            <td align="center" style="background-color: ${emailBg}; padding: 20px 10px; border-top: 1px solid ${borderColor}; text-align: center; color: ${mutedColor}; font-size: 9px; line-height: 1.5; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
              ${footerText}
              ${legalText}
            </td>
          </tr>
          ` : ""}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    return { html, attachments }
  }
}
