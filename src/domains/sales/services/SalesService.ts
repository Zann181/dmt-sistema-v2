import { prisma } from "@/infrastructure/database/prisma"
import { Prisma } from "@prisma/client"
import { InventoryService } from "@/domains/inventory/services/InventoryService"
import crypto from "crypto"

export class SalesService {
  static async ensureEventProductDefaults(branchId: string, eventId: string) {
    const products = await prisma.product.findMany({ where: { branchId, isActive: true } })
    const existing = await prisma.eventProduct.findMany({ where: { eventId } })
    const existingProductIds = new Set(existing.map((ep: any) => ep.productId))

    const toCreate = products.filter((p: any) => !existingProductIds.has(p.id))

    if (toCreate.length > 0) {
      await prisma.eventProduct.createMany({
        data: toCreate.map((p: any) => ({
          branchId,
          eventId,
          productId: p.id,
          isEnabled: false,
          eventPrice: null,
          updatedById: null
        }))
      })
    }
  }

  static async processSale(
    branchId: string, 
    eventId: string, 
    cart: { eventProductId: string, quantity: number, unitPrice: number }[],
    payments: { method: any, amount: number, reference?: string }[],
    soldById: string,
    attendeeId?: string
  ) {
    return prisma.$transaction(async (tx: any) => {
      const saleGroupId = crypto.randomUUID()
      let total = 0

      // Create Sale Lines
      for (const item of cart) {
        const lineTotal = item.quantity * item.unitPrice
        total += lineTotal

        const sale = await tx.barSale.create({
          data: {
            branchId,
            eventId,
            attendeeId: attendeeId || null,
            productId: item.eventProductId, // Simplified for demo, normally resolve product from eventProduct
            soldById,
            saleGroup: saleGroupId,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            total: new Prisma.Decimal(lineTotal),
            usedIncludedConsumption: false
          }
        })

        // Register Stock Movement for inventory context
        await InventoryService.registerMovement(
          branchId,
          eventId,
          item.eventProductId,
          "SALE",
          -item.quantity,
          `Venta en barra. Grupo de venta: ${saleGroupId}`,
          soldById
        )

        // Simplification: attach all payments to the first sale line, or divide them.
        // In full implementation, we allocate payments to lines proportionally.
        if (item === cart[0]) {
          for (const p of payments) {
            await tx.barSalePayment.create({
              data: {
                saleId: sale.id,
                method: p.method,
                amount: new Prisma.Decimal(p.amount),
                reference: p.reference
              }
            })
          }
        }
      }

      return { saleGroupId, total }
    })
  }
}
