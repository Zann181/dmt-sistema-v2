import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { AttendeeService } from "@/domains/attendee/services/AttendeeService"
import { z } from "zod"

const previewSchema = z.object({
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
    const { qrCodeOrCc, eventId } = previewSchema.parse(body)

    const attendee = await AttendeeService.findByQrOrCc(qrCodeOrCc, eventId)
    if (!attendee) {
      return NextResponse.json({ error: "Asistente no encontrado en este evento" }, { status: 444 })
    }

    return NextResponse.json({ data: attendee })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
