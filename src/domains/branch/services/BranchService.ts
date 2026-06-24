import { prisma } from "@/infrastructure/database/prisma"
import { BranchRole } from "@prisma/client"

export class BranchService {
  static async getPrincipalBranch() {
    return prisma.branch.findFirst({
      orderBy: { createdAt: "asc" },
      where: { isActive: true },
    })
  }

  static generateSlug(name: string, existingSlugs: string[]): string {
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    let slug = baseSlug
    let counter = 1
    while (existingSlugs.includes(slug)) {
      slug = `${baseSlug}-${counter}`
      counter++
    }
    return slug
  }

  static async getUserBranches(userId: string, isSuperuser: boolean) {
    if (isSuperuser) {
      return prisma.branch.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      })
    }

    const memberships = await prisma.branchMembership.findMany({
      where: { userId, isActive: true },
      include: { branch: true },
    })
    const memberBranches = memberships.map((m: any) => m.branch).filter((b: any) => b && b.isActive)
    const memberBranchIds = memberBranches.map((b: any) => b.id)

    const assignments = await prisma.eventAssignment.findMany({
      where: { userId },
      select: { branchId: true }
    })
    const assignedBranchIds = assignments.map((a: any) => a.branchId)
    const extraBranchIds = assignedBranchIds.filter((id: string) => !memberBranchIds.includes(id))

    if (extraBranchIds.length > 0) {
      const extraBranches = await prisma.branch.findMany({
        where: { id: { in: extraBranchIds }, isActive: true }
      })
      return [...memberBranches, ...extraBranches]
    }

    return memberBranches
  }
}
