import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { slug, userId } = await params
  try {
    const branch = await prisma.branch.findUnique({ where: { slug } })
    if (!branch) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 })
    }
    const access = await requireBranchPermission(session, branch.id, "manageBranchConfig")
    if (access instanceof NextResponse) return access

    const membership = await prisma.branchMembership.findUnique({
      where: { userId_branchId: { userId, branchId: branch.id } },
    })

    if (!membership) {
      return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 })
    }

    const updated = await prisma.branchMembership.update({
      where: { id: membership.id },
      data: { isActive: !membership.isActive },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { slug, userId } = await params
  try {
    const branch = await prisma.branch.findUnique({ where: { slug } })
    if (!branch) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 })
    }
    const access = await requireBranchPermission(session, branch.id, "manageBranchConfig")
    if (access instanceof NextResponse) return access

    const membership = await prisma.branchMembership.findUnique({
      where: { userId_branchId: { userId, branchId: branch.id } },
    })

    if (!membership) {
      return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 })
    }

    await prisma.branchMembership.delete({
      where: { id: membership.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 })
  }
}
