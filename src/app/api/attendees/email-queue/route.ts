import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"
import { processPendingTicketEmails } from "@/domains/attendee/services/TicketEmailQueue"

// Despacha una tanda de la cola de correos de tickets (asistentes con email y sin
// emailSentAt). El navegador la llama repetidamente hasta que `remaining` sea 0.
export const maxDuration = 60
const BATCH_BUDGET_MS = 40_000
const BATCH_MAX = 25

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
