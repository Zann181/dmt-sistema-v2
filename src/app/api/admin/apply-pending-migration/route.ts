import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"

// Endpoint de un solo uso: agrega la columna qrDeliveredManuallyAt a attendees.
// Gateado por sesión de admin porque corre en el runtime de Netlify, donde sí
// existe el DATABASE_URL real (que no es legible desde fuera). Borrar este
// archivo después de usarlo una vez.
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.isSuperuser && !session?.user?.isGlobalAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "qrDeliveredManuallyAt" TIMESTAMP(3)`
    )
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
