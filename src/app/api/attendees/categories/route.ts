import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { formatZodError } from "@/shared/utils/zod"

const createCategorySchema = z.object({
  branchId: z.string().min(1),
  name: z.string().min(1).max(80),
  includedConsumptions: z.number().int().nonnegative().default(0),
  price: z.number().nonnegative().or(z.string().regex(/^\d+(\.\d{1,2})?$/)),
  description: z.string().optional().default(""),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId") || session.user.activeBranchId

  if (!branchId) {
    return NextResponse.json({ error: "Contexto incompleto (se requiere branchId)" }, { status: 400 })
  }

  try {
    const categories = await prisma.attendeeCategory.findMany({
      where: { branchId, isActive: true },
      orderBy: { name: "asc" }
    })
    
    // Map Decimal to number for serialization
    const data = categories.map((c: any) => ({
      ...c,
      price: Number(c.price)
    }))
    
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.manageCategories) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = createCategorySchema.parse(body)

    const category = await prisma.attendeeCategory.create({
      data: {
        branchId: parsed.branchId,
        name: parsed.name,
        includedConsumptions: parsed.includedConsumptions,
        price: new Prisma.Decimal(parsed.price),
        description: parsed.description,
        isActive: true,
      }
    })

    return NextResponse.json({ data: { ...category, price: Number(category.price) } })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(err) }, { status: 400 })
    }
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
