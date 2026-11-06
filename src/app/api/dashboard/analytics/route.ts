import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"

export const dynamic = "force-dynamic"

const num = (v: unknown) => Number(v ?? 0)

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId") || session.user.activeBranchId
  const eventId = searchParams.get("eventId") || session.user.activeEventId

  if (!branchId || !eventId) {
    return NextResponse.json({ error: "Sucursal o evento no seleccionado" }, { status: 400 })
  }

  // Totales de dinero del evento: solo administradores del evento o sucursal
  const access = await requireBranchPermission(session, branchId, "manageEventsConfig", eventId)
  if (access instanceof NextResponse) return access

  try {
    // Todo se agrega en la base (COUNT/SUM/GROUP BY). Antes se descargaban todas las
    // filas (asistentes, ventas, pagos) en cada refresco y eso consumía la transferencia de Neon.
    const [attAgg, checkedInCount, cashTotals, cashByMethod, barAgg, salesGroups, barPays, topGroups] =
      await Promise.all([
        prisma.attendee.aggregate({
          where: { branchId, eventId, inactiveAt: null },
          _count: { _all: true },
          _sum: { paidAmount: true },
        }),
        prisma.attendee.count({ where: { branchId, eventId, inactiveAt: null, hasCheckedIn: true } }),
        prisma.cashMovement.groupBy({
          by: ["module", "movementType"],
          where: { branchId, eventId },
          _sum: { totalAmount: true },
        }),
        prisma.$queryRaw<{ module: string; movementType: string; total: unknown }[]>`
          SELECT m."module"::text AS module, m."movementType"::text AS "movementType", COALESCE(SUM(p.amount), 0) AS total
          FROM cash_movement_payments p
          JOIN cash_movements m ON m.id = p."movementId"
          WHERE m."branchId" = ${branchId} AND m."eventId" = ${eventId} AND p.method::text = 'CASH'
          GROUP BY 1, 2`,
        prisma.barSale.aggregate({ where: { branchId, eventId }, _sum: { total: true } }),
        prisma.barSale.groupBy({ by: ["saleGroup"], where: { branchId, eventId } }),
        prisma.barSalePayment.groupBy({
          by: ["method"],
          where: { sale: { branchId, eventId } },
          _sum: { amount: true },
        }),
        prisma.barSale.groupBy({
          by: ["productId"],
          where: { branchId, eventId },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 5,
        }),
      ])

    const attendeeCount = attAgg._count._all
    const entranceIncome = num(attAgg._sum.paidAmount)

    const cashTotal = (module: string, type: string) =>
      num(cashTotals.find((m) => m.module === module && m.movementType === type)?._sum.totalAmount)
    const cashCash = (module: string, type: string) =>
      num(cashByMethod.find((m) => m.module === module && m.movementType === type)?.total)

    const entranceExpenses = cashTotal("ENTRANCE", "EXPENSE")
    const entranceCashDrops = cashTotal("ENTRANCE", "CASH_DROP")
    const entranceCashBalance =
      entranceIncome - cashCash("ENTRANCE", "EXPENSE") - cashCash("ENTRANCE", "CASH_DROP")

    const barIncome = num(barAgg._sum.total)
    const salesCount = salesGroups.length
    const barExpenses = cashTotal("BAR", "EXPENSE")
    const barCashDrops = cashTotal("BAR", "CASH_DROP")

    const barPaymentMethods = { CASH: 0, CARD: 0, TRANSFER: 0, QR: 0 }
    for (const p of barPays) {
      if (p.method in barPaymentMethods) {
        barPaymentMethods[p.method as keyof typeof barPaymentMethods] += num(p._sum.amount)
      }
    }
    const barCashBalance =
      barPaymentMethods.CASH - cashCash("BAR", "EXPENSE") - cashCash("BAR", "CASH_DROP")

    const productNames = topGroups.length
      ? await prisma.product.findMany({
          where: { id: { in: topGroups.map((g) => g.productId) } },
          select: { id: true, name: true },
        })
      : []
    const nameById = new Map(productNames.map((p) => [p.id, p.name]))
    const topProducts = topGroups.map((g) => ({
      name: nameById.get(g.productId) ?? "",
      quantity: g._sum.quantity ?? 0,
      total: num(g._sum.total),
    }))

    // COMBINED TOTALS
    const totalCombinedIncome = entranceIncome + barIncome
    const combinedNetOperating = (entranceIncome - entranceExpenses) + (barIncome - barExpenses)
    const combinedCashBalance = entranceCashBalance + barCashBalance

    return NextResponse.json({
      data: {
        entrance: {
          totalIncome: entranceIncome,
          totalExpenses: entranceExpenses,
          cashDropTotal: entranceCashDrops,
          netOperating: entranceIncome - entranceExpenses,
          cashBalance: entranceCashBalance,
          attendeeCount,
          checkedInCount,
          byPaymentMethod: {
            cash: entranceIncome,
            transfer: 0,
            qr: 0,
            card: 0
          }
        },
        bar: {
          totalIncome: barIncome,
          totalExpenses: barExpenses,
          cashDropTotal: barCashDrops,
          netOperating: barIncome - barExpenses,
          cashBalance: barCashBalance,
          salesCount,
          byPaymentMethod: {
            cash: barPaymentMethods.CASH,
            card: barPaymentMethods.CARD,
            transfer: barPaymentMethods.TRANSFER,
            qr: barPaymentMethods.QR
          },
          topProducts
        },
        combined: {
          totalIncome: totalCombinedIncome,
          netOperating: combinedNetOperating,
          cashBalance: combinedCashBalance
        }
      }
    })
  } catch (error: any) {
    return apiError(error)
  }
}
