import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { attendeeId } = await req.json()
    if (!attendeeId) {
      return NextResponse.json({ error: "Falta ID del asistente" }, { status: 400 })
    }

    const target = await prisma.attendee.findUnique({ where: { id: attendeeId }, select: { branchId: true, eventId: true } })
    if (!target) return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 })
    const access = await requireBranchPermission(session, target.branchId, "accessAttendees", target.eventId)
    if (access instanceof NextResponse) return access

    const updated = await prisma.attendee.update({
      where: { id: attendeeId },
      data: { qrDeliveredManuallyAt: new Date() }
    })

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    return apiError(error, 500, "Error al confirmar entrega")
  }
}
