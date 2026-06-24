import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { SalesService } from "@/domains/sales/services/SalesService"
import { prisma } from "@/infrastructure/database/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessSales) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const branchId = body.branchId || session.user.activeBranchId
    const eventId = body.eventId || session.user.activeEventId

    if (!branchId || !eventId) {
      return NextResponse.json({ error: "Contexto incompleto (se requiere sucursal y evento activo)" }, { status: 400 })
    }

    const result = await SalesService.processSale(
      branchId,
      eventId,
      body.cart,
      body.payments,
      session.user.id,
      body.attendeeId
    )
    return NextResponse.json({ data: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
