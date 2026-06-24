import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { Prisma } from "@prisma/client"

const configSchema = z.object({
  eventId: z.string().min(1),
  products: z.array(z.object({
    productId: z.string().min(1),
    isEnabled: z.boolean(),
    eventPrice: z.number().nullable().optional().or(z.string().regex(/^\d+(\.\d{1,2})?$/).nullable()).or(z.literal("")),
  }))
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.manageEventsConfig) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = configSchema.parse(body)

    const event = await prisma.event.findUnique({
      where: { id: parsed.eventId }
    })
    if (!event) {
      return NextResponse.json({ error: "El evento no existe" }, { status: 404 })
    }

    const branchId = event.branchId

    await prisma.$transaction(async (tx: any) => {
      for (const p of parsed.products) {
        // Resolve event price
        let eventPrice: Prisma.Decimal | null = null
        if (p.eventPrice !== null && p.eventPrice !== undefined && p.eventPrice !== "") {
          eventPrice = new Prisma.Decimal(p.eventPrice)
        }

        await tx.eventProduct.upsert({
          where: {
            eventId_productId: {
              eventId: parsed.eventId,
              productId: p.productId
            }
          },
          update: {
            isEnabled: p.isEnabled,
            eventPrice,
            updatedById: session.user.id
          },
          create: {
            branchId,
            eventId: parsed.eventId,
            productId: p.productId,
            isEnabled: p.isEnabled,
            eventPrice,
            updatedById: session.user.id
          }
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
