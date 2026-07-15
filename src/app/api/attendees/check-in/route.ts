import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { AttendeeService } from "@/domains/attendee/services/AttendeeService"
import { z } from "zod"

const checkInSchema = z.object({
  qrCodeOrCc: z.string().min(1),
  eventId: z.string().min(1),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessAttendees) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { qrCodeOrCc, eventId } = checkInSchema.parse(body)

    const attendee = await AttendeeService.findByQrOrCc(qrCodeOrCc, eventId)
    if (!attendee) {
      return NextResponse.json({ error: "Asistente no encontrado en este evento" }, { status: 404 })
    }

    if (attendee.hasCheckedIn) {
      const checkedInBy = (attendee as any).checkedInBy
      const checkedInByName = checkedInBy 
        ? `${checkedInBy.firstName} ${checkedInBy.lastName}`.trim() || checkedInBy.username
        : "Desconocido"

      return NextResponse.json({
        error: "ALREADY_CHECKED_IN",
        message: "El asistente ya ha ingresado al evento",
        attendee: {
          id: attendee.id,
          name: attendee.name,
          cc: attendee.cc,
          checkedInAt: attendee.checkedInAt,
          categoryName: attendee.category?.name,
          checkedInByName
        }
      }, { status: 409 })
    }

    const updatedAttendee = await AttendeeService.checkIn(
      qrCodeOrCc,
      eventId,
      session.user.id
    )

    return NextResponse.json({ data: updatedAttendee })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
