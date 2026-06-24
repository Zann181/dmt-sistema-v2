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
