import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { CatalogService } from "@/domains/catalog/services/CatalogService"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"

const updateProductSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  price: z.number().positive().or(z.string().regex(/^\d+(\.\d{1,2})?$/)).optional(),
})

async function authorizeProduct(id: string) {
  const session = await auth()
  const product = await prisma.product.findUnique({ where: { id }, select: { branchId: true } })
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
  return requireBranchPermission(session, product.branchId, "accessCatalog")
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const access = await authorizeProduct(id)
  if (access instanceof NextResponse) return access
  try {
    const body = await req.json()
    const parsed = updateProductSchema.parse(body)

    const updateData: any = {}
    if (parsed.name !== undefined) updateData.name = parsed.name
    if (parsed.description !== undefined) updateData.description = parsed.description
    if (parsed.price !== undefined) updateData.price = new Prisma.Decimal(parsed.price)

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    return apiError(error)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const access = await authorizeProduct(id)
  if (access instanceof NextResponse) return access
  try {
    const retired = await CatalogService.retireProduct(id)
    return NextResponse.json({ data: retired })
  } catch (error: any) {
    return apiError(error)
  }
}
