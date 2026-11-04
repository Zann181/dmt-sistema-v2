import { prisma } from "@/infrastructure/database/prisma"
import { StockMovementType } from "@prisma/client"

export class InventoryService {
  /**
   * Registra en lote un movimiento por producto: una consulta para el último stock de
   * todos y una sola inserción. Las líneas del mismo producto se suman en un movimiento,
   * porque filas insertadas juntas comparten createdAt y no se podría saber cuál es la última.
   */
  static async registerMovements(
    branchId: string,
    eventId: string | null,
    movements: { productId: string; quantity: number }[],
    movementType: StockMovementType,
    note: string,
    userId: string
  ) {
    const quantityByProduct = new Map<string, number>()
    for (const { productId, quantity } of movements) {
      quantityByProduct.set(productId, (quantityByProduct.get(productId) ?? 0) + quantity)
    }

    // Get last movement per product to compute stockBefore and stockAfter
    const lastMovements = await prisma.stockMovement.findMany({
      where: { branchId, productId: { in: [...quantityByProduct.keys()] } },
      orderBy: { createdAt: "desc" },
      distinct: ["productId"],
      select: { productId: true, stockAfter: true }
    })
    const stockByProduct = new Map(lastMovements.map((m) => [m.productId, m.stockAfter]))

    return prisma.stockMovement.createMany({
      data: [...quantityByProduct].map(([productId, quantity]) => {
        const stockBefore = stockByProduct.get(productId) ?? 0
        return {
          branchId,
          eventId,
          productId,
          createdById: userId,
          movementType,
          quantity,
          stockBefore,
          stockAfter: stockBefore + quantity,
          note
        }
      })
    })
  }
}
