import { requireAuth } from "@/shared/guards/requireAuth"
import { redirect } from "next/navigation"
import { prisma } from "@/infrastructure/database/prisma"
import { EventosClient } from "./EventosClient"

export default async function EventosPage() {
  const { session } = await requireAuth()
  if (!session?.user.permissions.manageEventsConfig) {
    redirect("/dashboard")
  }

  const isGlobalAdmin = session.user.isSuperuser || session.user.isGlobalAdmin

  let eventsRaw: any[]
  let branchesRaw: any[]

  if (isGlobalAdmin) {
    eventsRaw = await prisma.event.findMany({
      include: { branch: true },
      orderBy: { startsAt: "desc" }
    })
    branchesRaw = await prisma.branch.findMany({
      select: { id: true, name: true, logoUrl: true, logoBgColor: true, logoSize: true }
    })
  } else {
    // 1. Get branches where user has membership
    const memberships = await prisma.branchMembership.findMany({
      where: { userId: session.user.id },
      select: { branchId: true }
    })
    const memberBranchIds = memberships.map((m: any) => m.branchId)

    // 2. Get events where user has assignment
    const assignments = await prisma.eventAssignment.findMany({
      where: { userId: session.user.id },
      select: { eventId: true }
    })
    const assignedEventIds = assignments.map((a: any) => a.eventId)

    // 3. Query events matching either condition
    eventsRaw = await prisma.event.findMany({
      where: {
        OR: [
          { branchId: { in: memberBranchIds } },
          { id: { in: assignedEventIds } }
        ]
      },
      include: { branch: true },
      orderBy: { startsAt: "desc" }
    })

    // 4. Query branches of those events and memberships
    const visibleBranchIds = Array.from(new Set([
      ...memberBranchIds,
      ...eventsRaw.map(e => e.branchId)
    ]))

    branchesRaw = await prisma.branch.findMany({
      where: { id: { in: visibleBranchIds } },
      select: { id: true, name: true, logoUrl: true, logoBgColor: true, logoSize: true }
    })
  }

  const branches = branchesRaw.map((b: any) => ({
    id: b.id,
    name: b.name,
    logoUrl: b.logoUrl,
    logoBgColor: b.logoBgColor || "#f4f4f5",
    logoSize: b.logoSize || 64,
  }))

  // Serializamos fechas a ISO string para Next.js Client Component
  const events = eventsRaw.map((event: any) => ({
    id: event.id,
    branchId: event.branchId,
    name: event.name,
    slug: event.slug,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    status: event.status,
    branch: {
      id: event.branch.id,
      name: event.branch.name,
      logoUrl: event.branch.logoUrl,
      logoBgColor: event.branch.logoBgColor,
      logoSize: event.branch.logoSize
    },
    qrPrefix: event.qrPrefix,
    qrFillColor: event.qrFillColor,
    qrBackgroundColor: event.qrBackgroundColor,
    qrLogoBackgroundColor: event.qrLogoBackgroundColor,
    qrLogoScale: event.qrLogoScale,
    qrLogoUrl: event.qrLogoUrl,
    logoUrl: event.logoUrl,
    flyerUrl: event.flyerUrl,
    emailLogoSize: event.emailLogoSize,
    accessPolicy: event.accessPolicy,
    venueName: event.venueName,
    mapsUrl: event.mapsUrl,
    mapsLabel: event.mapsLabel,
    dressCode: event.dressCode,
    emailSubject: event.emailSubject,
    emailPreheader: event.emailPreheader,
    emailHeading: event.emailHeading,
    emailIntro: event.emailIntro,
    emailMessageTitle: event.emailMessageTitle,
    emailBody: event.emailBody,
    emailWarningTitle: event.emailWarningTitle,
    emailWarningText: event.emailWarningText,
    emailDetailsTitle: event.emailDetailsTitle,
    emailDateText: event.emailDateText,
    emailTimeText: event.emailTimeText,
    emailQrTitle: event.emailQrTitle,
    emailQrNote: event.emailQrNote,
    emailFooter: event.emailFooter,
    emailClosingText: event.emailClosingText,
    emailTeamSignature: event.emailTeamSignature,
    emailLegalNote: event.emailLegalNote,
    emailBackgroundColor: event.emailBackgroundColor,
    emailCardColor: event.emailCardColor,
    emailHeaderBackgroundColor: event.emailHeaderBackgroundColor,
    emailTextColor: event.emailTextColor,
    emailTitleColor: event.emailTitleColor,
    emailMutedTextColor: event.emailMutedTextColor,
    emailAccentColor: event.emailAccentColor,
    emailBorderColor: event.emailBorderColor,
    emailSectionBackgroundColor: event.emailSectionBackgroundColor,
    emailWarningBackgroundColor: event.emailWarningBackgroundColor
  }))

  return <EventosClient initialEvents={events} branches={branches} />
}

