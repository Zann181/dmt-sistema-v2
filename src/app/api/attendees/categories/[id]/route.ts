import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"

const updateCategorySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  includedConsumptions: z.number().int().nonnegative().optional(),
  price: z.number().nonnegative().or(z.string().regex(/^\d+(\.\d{1,2})?$/)).optional(),
  description: z.string().optional(),
})

async function authorizeCategory(id: string) {
  const session = await auth()
  const category = await prisma.attendeeCategory.findUnique({ where: { id }, select: { branchId: true } })
  if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 })
  return requireBranchPermission(session, category.branchId, "manageCategories")
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const access = await authorizeCategory(id)
  if (access instanceof NextResponse) return access

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
    return apiError(error)
  }
}

// La pantalla de sucursales edita con PUT; mismo comportamiento que PATCH
export const PUT = PATCH

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const access = await authorizeCategory(id)
  if (access instanceof NextResponse) return access

  try {
    // Soft-deactivate to preserve historical attendee assignments
    const updated = await prisma.attendeeCategory.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ data: updated })
  } catch (error: any) {
    return apiError(error)
  }
}
