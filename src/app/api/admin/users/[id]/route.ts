import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { formatZodError } from "@/shared/utils/zod"

const updateUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().max(50).optional().default(""),
  lastName: z.string().max(50).optional().default(""),
  password: z.string().min(6).optional().or(z.literal("")),
  isSuperuser: z.boolean(),
  isGlobalAdmin: z.boolean(),
  isActive: z.boolean(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.isSuperuser && !session?.user?.isGlobalAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  try {
    const body = await req.json()
    const parsed = updateUserSchema.parse(body)

    const updateData: any = {
      email: parsed.email,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      isSuperuser: parsed.isSuperuser,
      isGlobalAdmin: parsed.isGlobalAdmin,
      isActive: parsed.isActive,
    }

    if (parsed.password) {
      updateData.passwordHash = await bcrypt.hash(parsed.password, 10)
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData
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
  if (!session?.user?.isSuperuser && !session?.user?.isGlobalAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  try {
    if (session.user.id === id) {
      return NextResponse.json({ error: "No puedes eliminar tu propio usuario" }, { status: 400 })
    }

    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 })
  }
}
