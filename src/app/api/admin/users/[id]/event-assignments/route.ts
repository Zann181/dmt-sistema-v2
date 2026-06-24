import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"

const assignmentSchema = z.object({
  branchId: z.string().min(1),
  eventId: z.string().min(1),
  role: z.enum(["BRANCH_ADMIN", "EVENT_ADMIN", "ENTRANCE", "BAR"]),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.isSuperuser && !session?.user?.isGlobalAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id: userId } = await params
  try {
    const body = await req.json()
    const parsed = assignmentSchema.parse(body)

    const assignment = await prisma.eventAssignment.upsert({
      where: { userId_eventId: { userId, eventId: parsed.eventId } },
      update: { role: parsed.role, isActive: true },
      create: {
        userId,
        branchId: parsed.branchId,
        eventId: parsed.eventId,
        role: parsed.role,
        isActive: true,
      },
    })

    return NextResponse.json({ data: assignment })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
