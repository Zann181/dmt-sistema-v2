import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessAttendees) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { attendeeId } = await req.json()
    if (!attendeeId) {
      return NextResponse.json({ error: "Falta ID del asistente" }, { status: 400 })
    }

    const updated = await prisma.attendee.update({
      where: { id: attendeeId },
      data: { qrDeliveredManuallyAt: new Date() }
    })

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error al confirmar entrega" }, { status: 500 })
  }
}
