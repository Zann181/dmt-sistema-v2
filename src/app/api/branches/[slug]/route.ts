import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"

import { formatZodError } from "@/shared/utils/zod"

const updateBranchSchema = z.object({
  name: z.string().min(1),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  pageBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  surfaceColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  panelColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  logoUrl: z.string().nullable().optional(),
  logoBgColor: z.string().nullable().optional(),
  logoSize: z.number().nullable().optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session?.user?.permissions.manageBranchConfig) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { slug: branchId } = await params
  try {
    const body = await req.json()
    const parsed = updateBranchSchema.parse(body)

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: {
        name: parsed.name,
        primaryColor: parsed.primaryColor,
        secondaryColor: parsed.secondaryColor,
        pageBackgroundColor: parsed.pageBackgroundColor || "#f8f9fa",
        surfaceColor: parsed.surfaceColor || "#ffffff",
        panelColor: parsed.panelColor || "#f0f0f0",
        logoUrl: parsed.logoUrl,
        logoBgColor: parsed.logoBgColor || "#f4f4f5",
        logoSize: parsed.logoSize || 64,
      },
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
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session?.user?.permissions.manageBranchConfig) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { slug: branchId } = await params
  try {
    const deleted = await prisma.branch.delete({
      where: { id: branchId },
    })
    return NextResponse.json({ data: deleted })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
