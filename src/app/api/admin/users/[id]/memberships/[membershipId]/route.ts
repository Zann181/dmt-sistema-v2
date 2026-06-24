import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; membershipId: string }> }
) {
  const session = await auth()
  if (!session?.user?.isSuperuser && !session?.user?.isGlobalAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id: userId, membershipId } = await params
  try {
    const membership = await prisma.branchMembership.findUnique({
      where: { id: membershipId },
    })

    if (!membership || membership.userId !== userId) {
      return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 })
    }

    await prisma.branchMembership.delete({ where: { id: membershipId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 })
  }
}
