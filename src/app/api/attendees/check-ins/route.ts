import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"

export const dynamic = "force-dynamic"

// Reemplaza el stream SSE de /api/realtime/check-in: en Netlify una conexión SSE
// mantiene una función abierta (se cobra por tiempo) y consultaba la base cada 2 s.
// Ahora el cliente pregunta cada pocos segundos "¿qué check-ins hubo desde <cursor>?"
// y la función responde y termina. El cursor lo da el servidor, así no se pierden
// check-ins entre consultas ni por diferencias de reloj del celular.
export async function GET(req: Request) {
  const session = await auth()
  const url = new URL(req.url)
  const branchId = url.searchParams.get("branchId") || session?.user?.activeBranchId
  const eventId = url.searchParams.get("eventId")
  const since = url.searchParams.get("since")

  if (!branchId || !eventId) {
    return NextResponse.json({ error: "Sin contexto activo" }, { status: 400 })
  }

  const access = await requireBranchPermission(session, branchId, "accessAttendees", eventId)
  if (access instanceof NextResponse) return access

  try {
    const now = new Date()
    const sinceDate = since ? new Date(since) : null

    // Primera llamada: solo devuelve el cursor (check-ins a partir de ahora)
    if (!sinceDate || Number.isNaN(sinceDate.getTime())) {
      return NextResponse.json({ data: [], cursor: now.toISOString() })
    }

    const checkIns = await prisma.attendee.findMany({
      where: { branchId, eventId, hasCheckedIn: true, checkedInAt: { gt: sinceDate } },
      select: {
        id: true, name: true, cc: true,
        category: { select: { name: true } },
        checkedInAt: true,
      },
      orderBy: { checkedInAt: "asc" },
      take: 200,
    })

    const last = checkIns[checkIns.length - 1]?.checkedInAt
    return NextResponse.json({ data: checkIns, cursor: (last ?? sinceDate).toISOString() })
  } catch (error) {
    return apiError(error, 500)
  }
}
