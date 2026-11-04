import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"

export const dynamic = "force-dynamic"

// Lista liviana de asistentes activos del evento para que el escáner pueda
// validar QR sin internet. Solo lo mínimo para identificar y mostrar al asistente.
export async function GET(req: Request) {
  const session = await auth()
  const url = new URL(req.url)
  const branchId = url.searchParams.get("branchId") || session?.user?.activeBranchId
  const eventId = url.searchParams.get("eventId")

  if (!branchId || !eventId) {
    return NextResponse.json({ error: "Sin contexto activo" }, { status: 400 })
  }

  const access = await requireBranchPermission(session, branchId, "accessAttendees", eventId)
  if (access instanceof NextResponse) return access

  try {
    const rows = await prisma.attendee.findMany({
      where: { branchId, eventId, inactiveAt: null },
      select: {
        id: true,
        name: true,
        cc: true,
        qrCode: true,
        hasCheckedIn: true,
        checkedInAt: true,
        category: { select: { name: true } },
        checkedInBy: { select: { firstName: true, lastName: true, username: true } },
      },
    })

    const data = rows.map((a) => ({
      id: a.id,
      name: a.name,
      cc: a.cc,
      qr: a.qrCode,
      cat: a.category?.name ?? null,
      in: a.hasCheckedIn,
      at: a.checkedInAt,
      by: a.checkedInBy
        ? `${a.checkedInBy.firstName ?? ""} ${a.checkedInBy.lastName ?? ""}`.trim() || a.checkedInBy.username
        : null,
    }))

    return NextResponse.json({ data, savedAt: new Date().toISOString() })
  } catch (error) {
    return apiError(error, 500)
  }
}
