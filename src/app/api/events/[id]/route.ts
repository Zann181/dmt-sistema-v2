import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { formatZodError } from "@/shared/utils/zod"

const updateEventSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),

  // QR Config
  qrPrefix: z.string().max(20).optional(),
  qrFillColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  qrBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  qrLogoBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  qrLogoScale: z.number().int().min(2).max(8).optional(),

  // Media
  logoUrl: z.string().nullable().optional(),
  qrLogoUrl: z.string().nullable().optional(),
  flyerUrl: z.string().nullable().optional(),

  // Venue
  accessPolicy: z.string().optional(),
  venueName: z.string().max(220).optional(),
  mapsUrl: z.string().nullable().optional(),
  mapsLabel: z.string().max(120).optional(),
  dressCode: z.string().max(160).optional(),

  // Email Template
  emailSubject: z.string().max(180).optional(),
  emailPreheader: z.string().max(220).optional(),
  emailHeading: z.string().max(180).optional(),
  emailIntro: z.string().optional(),
  emailMessageTitle: z.string().max(140).optional(),
  emailBody: z.string().optional(),
  emailWarningTitle: z.string().max(140).optional(),
  emailWarningText: z.string().optional(),
  emailDetailsTitle: z.string().max(140).optional(),
  emailDateText: z.string().max(180).optional(),
  emailTimeText: z.string().max(120).optional(),
  emailQrTitle: z.string().max(180).optional(),
  emailQrNote: z.string().max(220).optional(),
  emailFooter: z.string().max(220).optional(),
  emailClosingText: z.string().max(220).optional(),
  emailTeamSignature: z.string().max(220).optional(),
  emailLegalNote: z.string().max(220).optional(),
  emailLogoSize: z.number().int().min(20).max(300).optional(),

  // SMTP Server Config
  emailHost: z.string().max(120).optional(),
  emailPort: z.number().int().optional(),
  emailSecure: z.boolean().optional(),
  emailUser: z.string().max(120).optional(),
  emailPassword: z.string().max(120).optional(),
  emailFrom: z.string().max(180).optional(),

  // Email Colors
  emailBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailCardColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailHeaderBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailTitleColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailMutedTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailBorderColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailSectionBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailWarningBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),

  // WhatsApp
  whatsappMessage: z.string().optional(),
})

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  try {
    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
    }
    return NextResponse.json({ data: event })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  const isAuthorized = session?.user?.permissions.manageEventsConfig || 
    (session?.user?.activeEventId === id && session?.user?.permissions.accessAttendees);

  if (!isAuthorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = updateEventSchema.parse(body)

    const updateData: any = { ...parsed }
    if (parsed.startsAt) updateData.startsAt = new Date(parsed.startsAt)
    if (parsed.endsAt) updateData.endsAt = new Date(parsed.endsAt)

    const updated = await prisma.event.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.permissions.manageEventsConfig) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  try {
    const deleted = await prisma.event.delete({
      where: { id },
    })
    return NextResponse.json({ data: deleted })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
