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

    const attendee = await prisma.attendee.findUnique({
      where: { id: attendeeId },
      include: {
        event: {
          include: { branch: true }
        },
        category: true,
        branch: true
      }
    })

    if (!attendee) {
      return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 })
    }
    const access = await requireBranchPermission(session, attendee.branchId, "accessAttendees", attendee.eventId)
    if (access instanceof NextResponse) return access

    if (!attendee.email) {
      return NextResponse.json({ error: "El asistente no tiene un correo electrónico registrado" }, { status: 400 })
    }

    // Reenviar = volver a encolar: se limpia emailSentAt y la cola lo envía despacio.
    await prisma.attendee.update({
      where: { id: attendee.id },
      data: { emailSentAt: null, qrDeliveredManuallyAt: null },
    })

    return NextResponse.json({ message: "Correo en cola para reenvío", queued: true })
  } catch (error: any) {
    console.error("❌ Error al reenviar correo de ticket:", error)
    return apiError(error, 500, "Error al reenviar el correo")
  }
}
