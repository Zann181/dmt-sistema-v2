import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"

const staffSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  password: z.string().min(6).optional().or(z.literal("")),
  role: z.enum(["BRANCH_ADMIN", "EVENT_ADMIN", "ENTRANCE", "BAR"]),
})

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session?.user?.permissions.manageBranchConfig) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { slug } = await params
  try {
    const branch = await prisma.branch.findUnique({ where: { slug } })
    if (!branch) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 })
    }

    const memberships = await prisma.branchMembership.findMany({
      where: { branchId: branch.id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
    })

    return NextResponse.json({ data: memberships })
  } catch (error) {
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session?.user?.permissions.manageBranchConfig) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { slug } = await params
  try {
    const branch = await prisma.branch.findUnique({ where: { slug } })
    if (!branch) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 })
    }

    const body = await req.json()
    const parsed = staffSchema.parse(body)

    // Find or create user
    let user = await prisma.user.findUnique({ where: { username: parsed.username } })
    if (!user) {
      const bcrypt = require("bcryptjs")
      const passwordHash = await bcrypt.hash(parsed.password || "CambiarEstaContraseña123!", 10)
      user = await prisma.user.create({
        data: {
          username: parsed.username,
          email: parsed.email,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          passwordHash,
          isActive: true,
        },
      })
    }

    // Create or update membership
    const membership = await prisma.branchMembership.upsert({
      where: { userId_branchId: { userId: user.id, branchId: branch.id } },
      update: { role: parsed.role, isActive: true },
      create: {
        userId: user.id,
        branchId: branch.id,
        role: parsed.role,
        isActive: true,
      },
    })

    return NextResponse.json({ data: membership })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
