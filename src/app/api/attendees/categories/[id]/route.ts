import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { formatZodError } from "@/shared/utils/zod"

const updateCategorySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  includedConsumptions: z.number().int().nonnegative().optional(),
  price: z.number().nonnegative().or(z.string().regex(/^\d+(\.\d{1,2})?$/)).optional(),
  description: z.string().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.permissions.manageBranchConfig) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  try {
    const body = await req.json()
    const parsed = updateCategorySchema.parse(body)

    const updateData: any = {}
    if (parsed.name !== undefined) updateData.name = parsed.name
    if (parsed.includedConsumptions !== undefined) updateData.includedConsumptions = parsed.includedConsumptions
    if (parsed.price !== undefined) updateData.price = new Prisma.Decimal(parsed.price)
    if (parsed.description !== undefined) updateData.description = parsed.description

    const updated = await prisma.attendeeCategory.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: { ...updated, price: Number(updated.price) } })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.permissions.manageBranchConfig) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  try {
    // Soft-deactivate to preserve historical attendee assignments
    const updated = await prisma.attendeeCategory.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ data: updated })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
