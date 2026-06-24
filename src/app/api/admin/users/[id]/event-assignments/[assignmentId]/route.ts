import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const session = await auth()
  if (!session?.user?.isSuperuser && !session?.user?.isGlobalAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id: userId, assignmentId } = await params
  try {
    const assignment = await prisma.eventAssignment.findUnique({
      where: { id: assignmentId },
    })

    if (!assignment || assignment.userId !== userId) {
      return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 })
    }

    await prisma.eventAssignment.delete({ where: { id: assignmentId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 })
  }
}
