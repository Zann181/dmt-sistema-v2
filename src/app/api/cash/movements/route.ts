import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"

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

    // Caja de entrada => permiso de asistentes; caja de barra => permiso de ventas
    const access = await requireBranchPermission(session, parsed.branchId, parsed.module === "BAR" ? "accessSales" : "accessAttendees", parsed.eventId)
    if (access instanceof NextResponse) return access

    // Rol con el que actúa en esta sucursal/evento (incluye staff asignado solo al evento)
    const createdRole = access.role ?? (access.isGlobal ? "admin" : "staff")

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
    return apiError(err)
  }
}
