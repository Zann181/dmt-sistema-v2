import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"

export const dynamic = "force-dynamic"

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

  try {
    // 1. ENTRADA & TAQUILLA METRICS
    const attendees = await prisma.attendee.findMany({
      where: { branchId, eventId },
      select: {
        id: true,
        paidAmount: true,
        hasCheckedIn: true,
      }
    })

    const attendeeCount = attendees.length
    const checkedInCount = attendees.filter((a: any) => a.hasCheckedIn).length
    const entranceIncome = attendees.reduce((sum: number, a: any) => sum + Number(a.paidAmount), 0)

    // 2. CASH MOVEMENTS
    const cashMovements = await prisma.cashMovement.findMany({
      where: { branchId, eventId },
      include: { payments: true }
    })

    const entranceExpenses = cashMovements
      .filter((m: any) => m.module === "ENTRANCE" && m.movementType === "EXPENSE")
      .reduce((sum: number, m: any) => sum + Number(m.totalAmount), 0)

    const entranceCashDrops = cashMovements
      .filter((m: any) => m.module === "ENTRANCE" && m.movementType === "CASH_DROP")
      .reduce((sum: number, m: any) => sum + Number(m.totalAmount), 0)

    // Entrance cash drawer: cash payments (expenses & drops)
    const entranceCashExpenses = cashMovements
      .filter((m: any) => m.module === "ENTRANCE" && m.movementType === "EXPENSE")
      .reduce((sum: number, m: any) => sum + m.payments.filter((p: any) => p.method === "CASH").reduce((s: number, p: any) => s + Number(p.amount), 0), 0)

    const entranceCashDropsVal = cashMovements
      .filter((m: any) => m.module === "ENTRANCE" && m.movementType === "CASH_DROP")
      .reduce((sum: number, m: any) => sum + m.payments.filter((p: any) => p.method === "CASH").reduce((s: number, p: any) => s + Number(p.amount), 0), 0)

    const entranceCashBalance = entranceIncome - entranceCashExpenses - entranceCashDropsVal

    // 3. BARRA & POS METRICS
    const barSales = await prisma.barSale.findMany({
      where: { branchId, eventId },
      include: {
        product: { select: { name: true } },
        payments: true
      }
    })

    const barIncome = barSales.reduce((sum: number, s: any) => sum + Number(s.total), 0)
    
    // Group sales by unique saleGroup
    const uniqueSalesGroups = new Set(barSales.map((s: any) => s.saleGroup))
    const salesCount = uniqueSalesGroups.size

    const barExpenses = cashMovements
      .filter((m: any) => m.module === "BAR" && m.movementType === "EXPENSE")
      .reduce((sum: number, m: any) => sum + Number(m.totalAmount), 0)

    const barCashDrops = cashMovements
      .filter((m: any) => m.module === "BAR" && m.movementType === "CASH_DROP")
      .reduce((sum: number, m: any) => sum + Number(m.totalAmount), 0)

    // BarSalePayments split
    const barSalePayments = await prisma.barSalePayment.findMany({
      where: {
        sale: {
          branchId,
          eventId
        }
      }
    })

    const barPaymentMethods = {
      CASH: 0,
      CARD: 0,
      TRANSFER: 0,
      QR: 0
    }
    for (const p of barSalePayments) {
      if (p.method in barPaymentMethods) {
        barPaymentMethods[p.method as keyof typeof barPaymentMethods] += Number(p.amount)
      }
    }

    // Bar cash drawer: Cash Sales minus Cash Expenses minus Cash Drops
    const barCashExpenses = cashMovements
      .filter((m: any) => m.module === "BAR" && m.movementType === "EXPENSE")
      .reduce((sum: number, m: any) => sum + m.payments.filter((p: any) => p.method === "CASH").reduce((s: number, p: any) => s + Number(p.amount), 0), 0)

    const barCashDropsVal = cashMovements
      .filter((m: any) => m.module === "BAR" && m.movementType === "CASH_DROP")
      .reduce((sum: number, m: any) => sum + m.payments.filter((p: any) => p.method === "CASH").reduce((s: number, p: any) => s + Number(p.amount), 0), 0)

    const barCashBalance = barPaymentMethods.CASH - barCashExpenses - barCashDropsVal

    // Top Products Sold
    const productQuantities: Record<string, { quantity: number; total: number }> = {}
    for (const sale of barSales) {
      const name = sale.product.name
      if (!productQuantities[name]) {
        productQuantities[name] = { quantity: 0, total: 0 }
      }
      productQuantities[name].quantity += sale.quantity
      productQuantities[name].total += Number(sale.total)
    }
    const topProducts = Object.entries(productQuantities)
      .map(([name, data]) => ({ name, quantity: data.quantity, total: data.total }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)

    // 4. COMBINED TOTALS
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
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
