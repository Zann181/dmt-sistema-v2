import { requireAuth } from "@/shared/guards/requireAuth"
import { redirect } from "next/navigation"
import { prisma } from "@/infrastructure/database/prisma"
import { CatalogoClient } from "./CatalogoClient"

export default async function CatalogoPage() {
  const { session } = await requireAuth()
  if (!session?.user?.permissions.accessCatalog) {
    redirect("/dashboard")
  }

  const branchId = session.user.activeBranchId

  const productsRaw = branchId
    ? await prisma.product.findMany({
        where: { branchId, isActive: true },
        orderBy: { name: "asc" }
      })
    : []

  const products = productsRaw.map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  }))

  return <CatalogoClient initialProducts={products} />
}
