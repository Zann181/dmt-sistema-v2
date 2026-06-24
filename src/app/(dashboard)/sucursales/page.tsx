import { requireAuth } from "@/shared/guards/requireAuth"
import { redirect } from "next/navigation"
import { prisma } from "@/infrastructure/database/prisma"
import { SucursalesClient } from "./SucursalesClient"

export default async function SucursalesPage() {
  const { session } = await requireAuth()
  if (!session?.user.permissions.manageBranchConfig) {
    redirect("/dashboard")
  }

  // Si es superuser ve todas, si no solo las suyas
  const branchesRaw = session.user.isSuperuser || session.user.isGlobalAdmin
    ? await prisma.branch.findMany({ orderBy: { createdAt: "desc" } })
    : (await prisma.branchMembership.findMany({
        where: { userId: session.user.id },
        include: { branch: true }
      })).map((m: any) => m.branch)

  const branches = branchesRaw.map((b: any) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    codePrefix: b.codePrefix,
    primaryColor: b.primaryColor || "#102542",
    secondaryColor: b.secondaryColor || "#ffffff",
    pageBackgroundColor: b.pageBackgroundColor || "#f8f9fa",
    surfaceColor: b.surfaceColor || "#ffffff",
    panelColor: b.panelColor || "#f0f0f0",
    logoUrl: b.logoUrl,
    logoBgColor: b.logoBgColor || "#f4f4f5",
    logoSize: b.logoSize || 64,
    isActive: b.isActive,
  }))

  return <SucursalesClient initialBranches={branches} />
}
