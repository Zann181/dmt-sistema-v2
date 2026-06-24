import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessAttendees) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId") || session.user.activeBranchId
  const eventId = searchParams.get("eventId") || session.user.activeEventId

  if (!branchId || !eventId) {
    return NextResponse.json({ error: "Sucursal o evento no seleccionado" }, { status: 400 })
  }

  try {
    const attendees = await prisma.attendee.findMany({
      where: { branchId, eventId },
      include: {
        category: { select: { name: true } }
      },
      orderBy: { name: "asc" }
    })

    const headers = ["ID", "Nombre", "Cedula", "Telefono", "Email", "Categoria", "Ingreso", "Fecha Ingreso", "Pagado"]
    const rows = attendees.map((a: any) => [
      a.id,
      `"${a.name.replace(/"/g, '""')}"`,
      `"${a.cc}"`,
      a.phone ? `"${a.phone}"` : "",
      a.email ? `"${a.email}"` : "",
      `"${a.category.name}"`,
      a.hasCheckedIn ? "Ingreso" : "No ingreso",
      a.checkedInAt ? new Date(a.checkedInAt).toLocaleString() : "",
      a.paidAmount.toString()
    ])

    const csvContent = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n")

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="asistentes_evento_${eventId}.csv"`,
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
