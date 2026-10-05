import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { CatalogService } from "@/domains/catalog/services/CatalogService"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"

const createProductSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().optional(),
  price: z.number().positive().or(z.string().regex(/^\d+(\.\d{1,2})?$/)),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const branchId = new URL(req.url).searchParams.get("branchId") || session.user.activeBranchId
  if (!branchId) return NextResponse.json({ data: [] })

  const access = await requireBranchPermission(session, branchId, "accessCatalog")
  if (access instanceof NextResponse) return access

  try {
    const products = await CatalogService.getBranchProducts(branchId)
    return NextResponse.json({ data: products })
  } catch (error) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = createProductSchema.parse(body)

    const branchId = body.branchId || session.user.activeBranchId
    if (!branchId) return NextResponse.json({ error: "Contexto incompleto" }, { status: 400 })
    const access = await requireBranchPermission(session, branchId, "accessCatalog")
    if (access instanceof NextResponse) return access

    const product = await prisma.product.create({
      data: {
        branchId,
        name: parsed.name,
        description: parsed.description || "",
        price: new Prisma.Decimal(parsed.price),
        createdById: session.user.id,
        isActive: true
      }
    })
    return NextResponse.json({ data: product })
  } catch (err: any) {
    return apiError(err)
  }
}
