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
  const isSuper = session?.user?.isSuperuser || session?.user?.isGlobalAdmin;
  const canManage = session?.user?.permissions?.accessAttendees;

  if (!isSuper && !canManage) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    let whereClause = {};

    if (!isSuper) {
      // Find events assigned to the current user
      const assignments = await prisma.eventAssignment.findMany({
        where: { userId: session?.user?.id },
        select: { eventId: true }
      });
      const eventIds = assignments.map((a: any) => a.eventId);

      whereClause = {
        eventAssignments: {
          some: {
            eventId: { in: eventIds }
          }
        }
      };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
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
  const isSuper = session?.user?.isSuperuser || session?.user?.isGlobalAdmin;
  const canManage = session?.user?.permissions?.accessAttendees;

  if (!isSuper && !canManage) {
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
    
    // If not superuser, force restrictions: no superuser/admin rights
    const isSuperuser = isSuper ? parsed.isSuperuser : false;
    const isGlobalAdmin = isSuper ? parsed.isGlobalAdmin : false;

    const user = await prisma.user.create({
      data: {
        username: parsed.username,
        email: parsed.email,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        passwordHash,
        isSuperuser,
        isGlobalAdmin,
        isActive: true
      }
    })

    if (!isSuper) {
      // Auto-assign the newly created user to the events the creator manages
      const assignments = await prisma.eventAssignment.findMany({
        where: { userId: session?.user?.id },
        select: { eventId: true, branchId: true }
      });
      
      if (assignments.length > 0) {
        await prisma.eventAssignment.createMany({
          data: assignments.map((a: any) => ({
            userId: user.id,
            eventId: a.eventId,
            branchId: a.branchId,
            role: "ENTRANCE"
          }))
        });
      }
    }

    return NextResponse.json({ data: user })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
