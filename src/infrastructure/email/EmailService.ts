import { Resend } from "resend"
import nodemailer from "nodemailer"

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
    }
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
          attachments: qrAttachmentBuffer
            ? [
                {
                  filename: qrFileName || "acceso_qr.png",
                  content: qrAttachmentBuffer,
                  cid: "acceso_qr.png", // Para incrustar como imagen inline en el HTML
                },
              ]
            : [],
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
      return { id: "mock_email_id" }
    }

    const attachments = qrAttachmentBuffer
      ? [
          {
            content: qrAttachmentBuffer.toString("base64"),
            filename: qrFileName || "acceso_qr.png",
          },
        ]
      : []

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

  static compileTemplate(event: any, attendeeName: string): string {
    const emailBg = event.emailBackgroundColor || "#f6f2eb"
    const cardBg = event.emailCardColor || "#ffffff"
    const headerBg = event.emailHeaderBackgroundColor || "#111315"
    const textColor = event.emailTextColor || "#172121"
    const mutedColor = event.emailMutedTextColor || "#bdbdbd"
    const accentColor = event.emailAccentColor || "#c44536"
    const borderColor = event.emailBorderColor || "#1f1f22"
    const sectionBg = event.emailSectionBackgroundColor || "#18191b"
    const warningBg = event.emailWarningBackgroundColor || "#2a1c17"

    let logoHtml = ""
    const logoUrl = event.logoUrl || event.branch?.logoUrl || ""
    if (logoUrl) {
      const trimmed = logoUrl.trim()
      const size = event.emailLogoSize || 80
      if (trimmed.startsWith("data:") || trimmed.startsWith("http")) {
        logoHtml = `<img src="${trimmed}" alt="Logo" style="height: ${size}px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto;" />`
      } else if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
        try {
          let cleanSvg = trimmed.replace(/^<\?xml[^>]*\?>/i, "").trim()
          if (!cleanSvg.includes("xmlns=")) {
            cleanSvg = cleanSvg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')
          }
          const base64 = Buffer.from(cleanSvg).toString("base64")
          const dataUri = `data:image/svg+xml;base64,${base64}`
          logoHtml = `<img src="${dataUri}" alt="Logo" style="height: ${size}px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto;" />`
        } catch (e) {
          logoHtml = `<span style="color: #ffffff; font-weight: 900; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">${event.name}</span>`
        }
      }
    } else {
      logoHtml = `<span style="color: #ffffff; font-weight: 900; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">${event.name}</span>`
    }

    let flyerHtml = ""
    if (event.flyerUrl) {
      flyerHtml = `
        <div style="margin-top: 15px; margin-bottom: 15px; text-align: center;">
          <img src="${event.flyerUrl}" alt="Flyer del Evento" style="width: 100%; max-width: 100%; height: auto; border-radius: 8px;" />
        </div>
      `
    }

    const heading = (event.emailHeading || "Hola {nombre_asistente}").replace("{nombre_asistente}", attendeeName)
    const introText = event.emailIntro ? `<p style="white-space: pre-line; margin-top: 0; color: #4b5563; font-size: 13px; line-height: 1.5;">${event.emailIntro}</p>` : ""

    const dateText = (event.emailDateText || "{fecha_evento}").replace("{fecha_evento}", new Date(event.startsAt).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
    const timeText = (event.emailTimeText || "{hora_evento}").replace("{hora_evento}", `${new Date(event.startsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - ${new Date(event.endsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`)

    let bodyHtml = ""
    if (event.emailBody) {
      bodyHtml = `
        <div style="padding-top: 15px; border-top: 1px dashed ${borderColor}; margin-top: 15px;">
          ${event.emailMessageTitle ? `<p style="font-weight: bold; font-size: 12px; margin-bottom: 5px; color: #1f2937;">${event.emailMessageTitle}</p>` : ""}
          <p style="white-space: pre-line; margin-top: 0; color: #4b5563; font-size: 13px; line-height: 1.5;">${event.emailBody}</p>
        </div>
      `
    }

    let warningHtml = ""
    if (event.emailWarningText) {
      warningHtml = `
        <div style="padding: 12px; border-radius: 6px; background-color: ${warningBg}; border-left: 3px solid ${accentColor}; margin-top: 15px;">
          <p style="font-weight: bold; color: #f87171; font-size: 10px; text-transform: uppercase; margin: 0 0 4px 0; letter-spacing: 1px;">
            ⚠️ ${event.emailWarningTitle || "Importante"}
          </p>
          <p style="margin: 0; color: #d1d5db; font-size: 11px; line-height: 1.4;">
            ${event.emailWarningText}
          </p>
        </div>
      `
    }

    const qrTitle = event.emailQrTitle || "Tu código QR de acceso"
    const qrNote = event.emailQrNote || "Presenta este código en la entrada del evento."

    const closingText = event.emailClosingText || "Nos vemos pronto!"
    const teamSignature = (event.emailTeamSignature || "Equipo {nombre_evento}").replace("{nombre_evento}", event.name)

    const footerText = event.emailFooter ? `<p style="margin: 0 0 5px 0;">${event.emailFooter}</p>` : ""
    const legalText = event.emailLegalNote ? `<p style="margin: 0; font-weight: 600; font-size: 9px;">${event.emailLegalNote}</p>` : ""

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${event.name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${emailBg};">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${emailBg}; padding: 20px 10px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="450px" style="max-width: 450px; background-color: ${cardBg}; border: 1px solid ${borderColor}; border-radius: 8px; overflow: hidden; border-collapse: collapse; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color: ${headerBg}; padding: 20px;">
              ${logoHtml}
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px; color: ${textColor};">
              <h1 style="font-size: 18px; font-weight: bold; margin-top: 0; margin-bottom: 12px; letter-spacing: -0.025em;">${heading}</h1>
              
              ${introText}
              ${flyerHtml}

              <!-- Event Details -->
              <table width="100%" border="0" cellspacing="0" cellpadding="12" style="background-color: ${sectionBg}; border: 1px solid ${borderColor}; border-radius: 8px; color: #ffffff; margin-top: 15px;">
                <tr>
                  <td>
                    <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #9ca3af; margin: 0 0 6px 0; letter-spacing: 1px;">
                      ${event.emailDetailsTitle || "Detalles del Evento"}
                    </p>
                    <p style="font-size: 14px; font-weight: 600; margin: 0 0 4px 0;">
                      ${dateText}
                    </p>
                    <p style="font-size: 13px; color: #d1d5db; margin: 0 0 6px 0;">
                      ${timeText}
                    </p>
                    <p style="font-size: 12px; font-style: italic; color: #9ca3af; margin: 0; font-weight: 600;">
                      📍 ${event.venueName || "Venue principal"}
                    </p>
                  </td>
                </tr>
              </table>

              ${bodyHtml}
              ${warningHtml}

              <!-- QR Code -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 20px; border-top: 1px solid ${borderColor}; padding-top: 20px; text-align: center;">
                <tr>
                  <td align="center">
                    <p style="font-weight: bold; font-size: 13px; margin-top: 0; margin-bottom: 12px;">${qrTitle}</p>
                    <div style="display: inline-block; padding: 12px; background-color: #ffffff; border: 1px solid ${borderColor}; border-radius: 8px;">
                      <img src="cid:acceso_qr.png" alt="Código QR" width="160" height="160" style="display: block;" />
                    </div>
                    <p style="font-size: 10px; color: #6b7280; margin-top: 8px; margin-bottom: 0; max-width: 260px;">${qrNote}</p>
                  </td>
                </tr>
              </table>

              <!-- Closing -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 20px; text-align: center;">
                <tr>
                  <td>
                    <p style="font-weight: 600; font-size: 13px; margin: 0 0 4px 0;">${closingText}</p>
                    <p style="font-weight: bold; font-size: 12px; text-transform: uppercase; color: ${accentColor}; margin: 0; letter-spacing: 1px;">
                      ${teamSignature}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          ${event.emailFooter ? `
          <tr>
            <td align="center" style="background-color: ${emailBg}; padding: 15px; border-top: 1px solid ${borderColor}; text-align: center; color: #9ca3af; font-size: 10px; line-height: 1.4;">
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
  }
}
