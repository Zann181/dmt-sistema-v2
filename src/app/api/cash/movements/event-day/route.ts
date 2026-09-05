import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { formatZodError } from "@/shared/utils/zod"

const eventDaySchema = z.object({
  branchId: z.string().min(1),
  eventId: z.string().min(1),
  categoryId: z.string().min(1),
  quantity: z.number().int().min(1).max(500),
  unitAmount: z.number().min(0),
  method: z.enum(["CASH", "TRANSFER", "QR", "CARD"]).optional().default("CASH"),
  description: z.string().max(255).optional().default(""),
})

// Registra un ingreso de asistentes "del día" (venta en puerta sin nombre ni cédula):
// crea N asistentes sintéticos ya marcados como ingresados + un CashMovement (EVENT_DAY)
// para que el dinero quede reflejado en la caja de Entrada.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessAttendees) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = eventDaySchema.parse(body)

    const category = await prisma.attendeeCategory.findUnique({ where: { id: parsed.categoryId } })
    if (!category || category.branchId !== parsed.branchId) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 400 })
    }

    const membership = await prisma.branchMembership.findFirst({
      where: { userId: session.user.id, branchId: parsed.branchId }
    })
    const createdRole = membership
      ? membership.role
      : (session.user.isSuperuser || session.user.isGlobalAdmin ? "admin" : "staff")

    const totalAmount = parsed.quantity * parsed.unitAmount
    const description = parsed.description || `Ingreso día — ${parsed.quantity} persona${parsed.quantity === 1 ? "" : "s"}`

    const movement = await prisma.$transaction(async (tx: any) => {
      const now = new Date()
      const stamp = Date.now().toString(36)

      await tx.attendee.createMany({
        data: Array.from({ length: parsed.quantity }, (_, i) => ({
          branchId: parsed.branchId,
          eventId: parsed.eventId,
          categoryId: parsed.categoryId,
          createdById: session.user.id,
          checkedInById: session.user.id,
          name: "Ingreso Día",
          cc: `DIA-${stamp}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          origin: "EVENT_DAY" as const,
          paidAmount: new Prisma.Decimal(parsed.unitAmount),
          qrCode: `DIA-${stamp}-${i}-${Math.random().toString(36).slice(2, 8)}`,
          hasCheckedIn: true,
          checkedInAt: now,
          includedBalance: category.includedConsumptions,
        }))
      })

      return tx.cashMovement.create({
        data: {
          branchId: parsed.branchId,
          eventId: parsed.eventId,
          createdById: session.user.id,
          createdRole,
          module: "ENTRANCE",
          movementType: "EVENT_DAY",
          description,
          attendeeQuantity: parsed.quantity,
          unitAmount: new Prisma.Decimal(parsed.unitAmount),
          totalAmount: new Prisma.Decimal(totalAmount),
          payments: {
            create: { method: parsed.method, amount: new Prisma.Decimal(totalAmount) }
          }
        },
        include: { payments: true }
      })
    })

    return NextResponse.json({
      data: {
        ...movement,
        unitAmount: Number(movement.unitAmount),
        totalAmount: Number(movement.totalAmount),
        payments: movement.payments.map((p: any) => ({ ...p, amount: Number(p.amount) }))
      }
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(err) }, { status: 400 })
    }
    return NextResponse.json({ error: err.message || "Server Error" }, { status: 500 })
  }
}
