import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { formatZodError } from "@/shared/utils/zod"

const cashMovementSchema = z.object({
  branchId: z.string().min(1),
  eventId: z.string().min(1),
  module: z.enum(["ENTRANCE", "BAR"]),
  movementType: z.enum(["EXPENSE", "CASH_DROP"]),
  description: z.string().min(1).max(255),
  totalAmount: z.number().positive().or(z.string().regex(/^\d+(\.\d{1,2})?$/)),
  method: z.enum(["CASH", "TRANSFER", "QR", "CARD"]).optional().default("CASH"),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = cashMovementSchema.parse(body)

    // Resolve user role in this branch context
    const membership = await prisma.branchMembership.findFirst({
      where: { userId: session.user.id, branchId: parsed.branchId }
    })
    const createdRole = membership 
      ? membership.role 
      : (session.user.isSuperuser || session.user.isGlobalAdmin ? "admin" : "staff")

    // Create Cash Movement and nested CashMovementPayment record
    const movement = await prisma.cashMovement.create({
      data: {
        branchId: parsed.branchId,
        eventId: parsed.eventId,
        createdById: session.user.id,
        createdRole,
        module: parsed.module,
        movementType: parsed.movementType,
        description: parsed.description,
        unitAmount: new Prisma.Decimal(parsed.totalAmount),
        totalAmount: new Prisma.Decimal(parsed.totalAmount),
        payments: {
          create: {
            method: parsed.method,
            amount: new Prisma.Decimal(parsed.totalAmount),
          }
        }
      },
      include: {
        payments: true
      }
    })

    return NextResponse.json({
      data: {
        ...movement,
        unitAmount: Number(movement.unitAmount),
        totalAmount: Number(movement.totalAmount),
        payments: movement.payments.map((p: any) => ({
          ...p,
          amount: Number(p.amount)
        }))
      }
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(err) }, { status: 400 })
    }
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
