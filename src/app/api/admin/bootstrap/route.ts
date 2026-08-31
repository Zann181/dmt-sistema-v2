import { NextResponse } from "next/server"
import { prisma } from "@/infrastructure/database/prisma"

// Endpoint de un solo uso para promover el primer usuario a admin global
// tras una migración de base de datos. Gateado por env var, nunca por login,
// porque en ese punto todavía no existe ningún admin.
export async function POST(req: Request) {
  const secret = req.headers.get("x-bootstrap-secret")
  if (!process.env.BOOTSTRAP_ADMIN_SECRET || secret !== process.env.BOOTSTRAP_ADMIN_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { username } = await req.json()
  if (!username) {
    return NextResponse.json({ error: "username requerido" }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { username },
    data: { isGlobalAdmin: true, isSuperuser: true },
  })

  const { passwordHash: _, ...safeUser } = user
  return NextResponse.json({ data: safeUser })
}
