import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { CatalogService } from "@/domains/catalog/services/CatalogService"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { formatZodError } from "@/shared/utils/zod"

const updateProductSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  price: z.number().positive().or(z.string().regex(/^\d+(\.\d{1,2})?$/)).optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.permissions.accessCatalog) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
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
  if (!session?.user?.permissions.accessCatalog) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  try {
    const retired = await CatalogService.retireProduct(id)
    return NextResponse.json({ data: retired })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
