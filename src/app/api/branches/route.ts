import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { BranchService } from "@/domains/branch/services/BranchService"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"

import { formatZodError } from "@/shared/utils/zod"

const createBranchSchema = z.object({
  name: z.string().min(1).max(150),
  codePrefix: z.string().min(1).max(12).toUpperCase(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{3,6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{3,6}$/),
  pageBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{3,6}$/).optional(),
  surfaceColor: z.string().regex(/^#[0-9a-fA-F]{3,6}$/).optional(),
  panelColor: z.string().regex(/^#[0-9a-fA-F]{3,6}$/).optional(),
  textColor: z.string().regex(/^#[0-9a-fA-F]{3,6}$/).optional(),
  titleColor: z.string().regex(/^#[0-9a-fA-F]{3,6}$/).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(30).optional().or(z.literal("")),
  logoUrl: z.string().nullable().optional(),
  logoBgColor: z.string().nullable().optional(),
  logoSize: z.number().nullable().optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const branches = await BranchService.getUserBranches(session.user.id, session.user.isSuperuser || session.user.isGlobalAdmin)
    return NextResponse.json({ data: branches })
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.isSuperuser && !session?.user?.isGlobalAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const parsed = createBranchSchema.parse(body)

    const existingBranches = await prisma.branch.findMany({ select: { slug: true } })
    const slugList = existingBranches.map((b: any) => b.slug)
    const slug = BranchService.generateSlug(parsed.name, slugList)

    const branch = await prisma.branch.create({
      data: {
        name: parsed.name,
        slug,
        codePrefix: parsed.codePrefix,
        primaryColor: parsed.primaryColor,
        secondaryColor: parsed.secondaryColor,
        pageBackgroundColor: parsed.pageBackgroundColor || "#f8f9fa",
        surfaceColor: parsed.surfaceColor || "#ffffff",
        panelColor: parsed.panelColor || "#f0f0f0",
        textColor: parsed.textColor || "#ffffff",
        titleColor: parsed.titleColor || "#ffffff",
        contactEmail: parsed.contactEmail || null,
        contactPhone: parsed.contactPhone || null,
        logoUrl: parsed.logoUrl || null,
        logoBgColor: parsed.logoBgColor || "#f4f4f5",
        logoSize: parsed.logoSize || 64,
        isActive: true,
      }
    })

    return NextResponse.json({ data: branch })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
