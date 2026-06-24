import { prisma } from "@/infrastructure/database/prisma"
import { StockMovementType } from "@prisma/client"

export class InventoryService {
  static async registerMovement(
    branchId: string,
    eventId: string | null,
    productId: string,
    movementType: StockMovementType,
    quantity: number,
    note: string,
    userId: string
  ) {
    // Get last movement to compute stockBefore and stockAfter
    const lastMovement = await prisma.stockMovement.findFirst({
      where: { branchId, productId },
      orderBy: { createdAt: "desc" }
    })

    const stockBefore = lastMovement ? lastMovement.stockAfter : 0
    const stockAfter = stockBefore + quantity

    return prisma.stockMovement.create({
      data: {
        branchId,
        eventId,
        productId,
        createdById: userId,
        movementType,
        quantity,
        stockBefore,
        stockAfter,
        note
      }
    })
  }
}
