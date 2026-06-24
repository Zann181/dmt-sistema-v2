import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"

import { z } from "zod"
import { formatZodError } from "@/shared/utils/zod"

const createEventSchema = z.object({
  branchId: z.string().min(1),
  name: z.string().min(1).max(150),
  description: z.string().optional().default(""),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional().default("DRAFT"),

  // SMTP Config
  emailHost: z.string().max(120).optional(),
  emailPort: z.number().int().optional(),
  emailSecure: z.boolean().optional(),
  emailUser: z.string().max(120).optional(),
  emailPassword: z.string().max(120).optional(),
  emailFrom: z.string().max(180).optional(),

  // QR Config
  qrPrefix: z.string().max(20).optional(),
  qrFillColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  qrBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  qrLogoBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  qrLogoScale: z.number().int().min(2).max(6).optional(),

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

  // Email Colors
  emailBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailCardColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailHeaderBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailMutedTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailBorderColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailSectionBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailWarningBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId") || session.user.activeBranchId

  if (!branchId) {
    return NextResponse.json({ data: [] })
  }

  try {
    const isGlobal = session.user.isSuperuser || session.user.isGlobalAdmin
    let whereClause: any = { branchId }

    if (!isGlobal) {
      // Check if user has active membership in this branch
      const membership = await prisma.branchMembership.findFirst({
        where: { userId: session.user.id, branchId, isActive: true }
      })

      if (!membership) {
        // If not a branch member, only allow accessing events where they have an assignment
        const assignments = await prisma.eventAssignment.findMany({
          where: { userId: session.user.id, branchId },
          select: { eventId: true }
        })
        const assignedEventIds = assignments.map((a: any) => a.eventId)
        whereClause = {
          branchId,
          id: { in: assignedEventIds }
        }
      }
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      orderBy: { startsAt: "desc" }
    })
    return NextResponse.json({ data: events })
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.manageEventsConfig) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const parsed = createEventSchema.parse(body)

    const baseSlug = parsed.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

    const existingEvents = await prisma.event.findMany({
      where: { branchId: parsed.branchId },
      select: { slug: true }
    })
    const slugList = existingEvents.map((e: any) => e.slug)

    let slug = baseSlug
    let counter = 1
    while (slugList.includes(slug)) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    const { startsAt, endsAt, ...rest } = parsed
    const event = await prisma.event.create({
      data: {
        ...rest,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        slug,
      }
    })

    return NextResponse.json({ data: event })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
