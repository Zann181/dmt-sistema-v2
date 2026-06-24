import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { CatalogService } from "@/domains/catalog/services/CatalogService"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { formatZodError } from "@/shared/utils/zod"

const createProductSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().optional(),
  price: z.number().positive().or(z.string().regex(/^\d+(\.\d{1,2})?$/)),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessCatalog) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const branchId = session.user.activeBranchId
  if (!branchId) return NextResponse.json({ data: [] })

  try {
    const products = await CatalogService.getBranchProducts(branchId)
    return NextResponse.json({ data: products })
  } catch (error) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessCatalog) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const branchId = session.user.activeBranchId
  if (!branchId) return NextResponse.json({ error: "Contexto incompleto" }, { status: 400 })

  try {
    const body = await req.json()
    const parsed = createProductSchema.parse(body)

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
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(err) }, { status: 400 })
    }
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
