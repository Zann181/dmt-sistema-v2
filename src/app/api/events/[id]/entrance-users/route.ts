import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { formatZodError } from "@/shared/utils/zod"

const createEntranceUserSchema = z.object({
  username: z.string().min(1).max(50),
  email: z.string().email(),
  firstName: z.string().max(50).optional().default(""),
  lastName: z.string().max(50).optional().default(""),
  password: z.string().min(6),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  // User must have accessAttendees and be creating for their active event
  const isAuthorized = session?.user?.activeEventId === id && session?.user?.permissions.accessAttendees;

  if (!isAuthorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = createEntranceUserSchema.parse(body)

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
    
    // Create User, BranchMembership, and EventAssignment in a transaction
    const branchId = session.user.activeBranchId!
    
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: parsed.username,
          email: parsed.email,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          passwordHash,
          isActive: true
        }
      })

      await tx.branchMembership.create({
        data: {
          userId: newUser.id,
          branchId,
          role: "ENTRANCE"
        }
      })

      await tx.eventAssignment.create({
        data: {
          userId: newUser.id,
          branchId,
          eventId: id,
          role: "ENTRANCE"
        }
      })

      return newUser
    })

    return NextResponse.json({ data: user })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
