import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; userId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.permissions.manageBranchConfig) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { slug, userId, eventId } = await params
  try {
    const branch = await prisma.branch.findUnique({ where: { slug } })
    if (!branch) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 })
    }

    const membership = await prisma.branchMembership.findUnique({
      where: { userId_branchId: { userId, branchId: branch.id } },
    })

    if (!membership) {
      return NextResponse.json({ error: "Personal no asignado a la sucursal" }, { status: 400 })
    }

    const assignment = await prisma.eventAssignment.findUnique({
      where: { userId_eventId: { userId, eventId } },
    })

    if (assignment) {
      // Toggle assignment status
      const updated = await prisma.eventAssignment.update({
        where: { id: assignment.id },
        data: { isActive: !assignment.isActive },
      })
      return NextResponse.json({ data: updated })
    } else {
      // Create new active assignment
      const newAssignment = await prisma.eventAssignment.create({
        data: {
          userId,
          branchId: branch.id,
          eventId,
          role: membership.role,
          isActive: true,
        },
      })
      return NextResponse.json({ data: newAssignment })
    }
  } catch (error) {
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 })
  }
}
