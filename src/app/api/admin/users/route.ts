import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { formatZodError } from "@/shared/utils/zod"

const createUserSchema = z.object({
  username: z.string().min(1).max(50),
  email: z.string().email(),
  firstName: z.string().max(50).optional().default(""),
  lastName: z.string().max(50).optional().default(""),
  password: z.string().min(6),
  isSuperuser: z.boolean().default(false),
  isGlobalAdmin: z.boolean().default(false),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.isSuperuser && !session?.user?.isGlobalAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const users = await prisma.user.findMany({
      include: {
        branchMemberships: {
          include: { branch: true }
        },
        eventAssignments: {
          include: { event: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })
    return NextResponse.json({ data: users })
  } catch (error) {
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.isSuperuser && !session?.user?.isGlobalAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = createUserSchema.parse(body)

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: parsed.username },
          { email: parsed.email }
        ]
      }
    })

    if (existingUser) {
      return NextResponse.json({ error: "El usuario o email ya existe" }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10)
    const user = await prisma.user.create({
      data: {
        username: parsed.username,
        email: parsed.email,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        passwordHash,
        isSuperuser: parsed.isSuperuser,
        isGlobalAdmin: parsed.isGlobalAdmin,
        isActive: true
      }
    })

    return NextResponse.json({ data: user })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
