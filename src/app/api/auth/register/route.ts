import { NextResponse } from "next/server"
import { prisma } from "@/infrastructure/database/prisma"
import { hashPassword } from "@/infrastructure/crypto"
import { z } from "zod"
import { formatZodError } from "@/shared/utils/zod"

const registerSchema = z.object({
  username: z.string().min(3, "El usuario debe tener al menos 3 caracteres").max(50),
  email: z.string().email("El correo electrónico no es válido"),
  firstName: z.string().max(50).optional().default(""),
  lastName: z.string().max(50).optional().default(""),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = registerSchema.parse(body)

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: parsed.username },
          { email: parsed.email }
        ]
      }
    })

    if (existingUser) {
      if (existingUser.username.toLowerCase() === parsed.username.toLowerCase()) {
        return NextResponse.json({ error: "El nombre de usuario ya está registrado" }, { status: 400 })
      }
      return NextResponse.json({ error: "El correo electrónico ya está registrado" }, { status: 400 })
    }

    const passwordHash = await hashPassword(parsed.password)
    const user = await prisma.user.create({
      data: {
        username: parsed.username.toLowerCase(),
        email: parsed.email.toLowerCase(),
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        passwordHash,
        isSuperuser: false,
        isGlobalAdmin: false,
        isActive: true
      }
    })

    const { passwordHash: _, ...userWithoutPassword } = user

    return NextResponse.json({ data: userWithoutPassword })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || "Error al registrar usuario" }, { status: 400 })
  }
}
