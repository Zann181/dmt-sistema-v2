import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"
import { processPendingTicketEmails, countPendingTicketEmails } from "@/domains/attendee/services/TicketEmailQueue"

// Despacha una tanda de la cola de correos de tickets (asistentes con email y sin
// emailSentAt). El navegador la llama repetidamente hasta que `remaining` sea 0.
export const maxDuration = 60
const BATCH_BUDGET_MS = 40_000
const BATCH_MAX = 10

const schema = z.object({
  branchId: z.string().min(1),
  eventId: z.string().min(1),
  skipIds: z.array(z.string()).max(2000).optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  try {
    const { branchId, eventId, skipIds } = schema.parse(await req.json())
    const access = await requireBranchPermission(session, branchId, "accessAttendees", eventId)
    if (access instanceof NextResponse) return access

    const result = await processPendingTicketEmails({
      branchId,
      eventId,
      deadline: Date.now() + BATCH_BUDGET_MS,
      max: BATCH_MAX,
      skipIds,
    })
    return NextResponse.json({ data: result })
  } catch (error) {
    return apiError(error)
  }
}

// Cuántos correos hay en cola: el navegador lo consulta al abrir la página para retomar el envío.
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  try {
    const url = new URL(req.url)
    const branchId = url.searchParams.get("branchId")
    const eventId = url.searchParams.get("eventId")
    if (!branchId || !eventId) return NextResponse.json({ error: "Faltan branchId/eventId" }, { status: 400 })
    const access = await requireBranchPermission(session, branchId, "accessAttendees", eventId)
    if (access instanceof NextResponse) return access
    return NextResponse.json({ data: { pending: await countPendingTicketEmails(branchId, eventId) } })
  } catch (error) {
    return apiError(error)
  }
}
