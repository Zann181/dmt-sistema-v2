import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"

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

  // Cualquier rol de la sucursal puede listar categorías (entrada, barra, admins)
  const access = await requireBranchPermission(session, branchId, null)
  if (access instanceof NextResponse) return access

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
    return apiError(err, 500)
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = createCategorySchema.parse(body)

    const access = await requireBranchPermission(session, parsed.branchId, "manageCategories")
    if (access instanceof NextResponse) return access

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
    return apiError(err)
  }
}
