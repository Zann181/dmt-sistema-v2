import { prisma } from "@/infrastructure/database/prisma"
import { Prisma } from "@prisma/client"

export class CatalogService {
  static async getBranchProducts(branchId: string) {
    return prisma.product.findMany({
      where: { branchId, isActive: true },
      orderBy: { name: "asc" }
    })
  }

  static async retireProduct(productId: string) {
    return prisma.$transaction(async (tx: any) => {
      const product = await tx.product.update({
        where: { id: productId },
        data: { isActive: false }
      })

      await tx.eventProduct.updateMany({
        where: { productId },
        data: { isEnabled: false }
      })

      return product
    })
  }
}
