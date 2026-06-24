import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { formatZodError } from "@/shared/utils/zod"
import { QrCodeService } from "@/infrastructure/qr/QrCodeService"
import { EmailService } from "@/infrastructure/email/EmailService"

const attendeeSchema = z.object({
  name: z.string().min(1).max(120),
  cc: z.string().min(1).max(32),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  categoryId: z.string(),
  paidAmount: z.number().min(0),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessAttendees) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const url = new URL(req.url)
    const branchId = url.searchParams.get("branchId") || session.user.activeBranchId
    const eventId = url.searchParams.get("eventId") || session.user.activeEventId

    if (!branchId || !eventId) return NextResponse.json({ data: [] })

    const q = url.searchParams.get("q") || ""
    
    const attendees = await prisma.attendee.findMany({
      where: {
        branchId,
        eventId,
        ...(q ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { cc: { contains: q, mode: "insensitive" } }
          ]
        } : {})
      },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 50
    })
    return NextResponse.json({ data: attendees })
  } catch (err) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessAttendees) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = attendeeSchema.parse(body)

    const branchId = body.branchId || session.user.activeBranchId
    const eventId = body.eventId || session.user.activeEventId

    if (!branchId || !eventId) return NextResponse.json({ error: "Contexto incompleto" }, { status: 400 })

    const category = await prisma.attendeeCategory.findUnique({ where: { id: parsed.categoryId } })
    if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 400 })

    const branch = await prisma.branch.findUnique({ where: { id: branchId } })
    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!branch || !event) return NextResponse.json({ error: "Error de contexto" }, { status: 400 })

    const uniqueId = Math.random().toString(36).substring(2, 12)
    const qrCode = `${branch.codePrefix}-${event.slug.substring(0, 5).toUpperCase()}-${uniqueId}`

    const attendee = await prisma.attendee.create({
      data: {
        ...parsed,
        branchId,
        eventId,
        createdById: session.user.id,
        origin: "MANUAL",
        qrCode,
        includedBalance: category.includedConsumptions,
        hasCheckedIn: false,
        paidAmount: parsed.paidAmount,
      }
    })

    if (parsed.email) {
      (async () => {
        try {
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
            let logoBuffer: Buffer = Buffer.from("")
            const trimmed = qrLogoUrl.trim()
            try {
              if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
                logoBuffer = Buffer.from(trimmed)
              } else if (trimmed.startsWith("data:")) {
                const base64Data = trimmed.split(",")[1]
                logoBuffer = Buffer.from(base64Data, "base64")
              } else if (trimmed.startsWith("http")) {
                const res = await fetch(trimmed)
                if (res.ok) {
                  logoBuffer = Buffer.from(await res.arrayBuffer())
                }
              }
            } catch (e) {
              console.error("Error loading QR logo buffer:", e)
            }

            if (logoBuffer.length > 0) {
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
          } else {
            qrBuffer = await QrCodeService.generateBuffer(qrCode, qrOptions)
          }

          const htmlContent = EmailService.compileTemplate(event, parsed.name)
          const subject = (event.emailSubject || "Tu acceso está listo: {nombre_evento}").replace("{nombre_evento}", event.name)
          await EmailService.sendTicketEmail(
            parsed.email!,
            subject,
            htmlContent,
            qrBuffer,
            "acceso_qr.png",
            {
              host: event.emailHost,
              port: event.emailPort,
              secure: event.emailSecure,
              user: event.emailUser,
              pass: event.emailPassword,
              from: event.emailFrom,
            }
          )
        } catch (mailError) {
          console.error("⚠️ Error en el envío del correo del ticket:", mailError)
        }
      })()
    }

    return NextResponse.json({ data: attendee })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(err) }, { status: 400 })
    }
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
