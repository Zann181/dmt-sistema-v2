import { prisma } from "@/infrastructure/database/prisma"
import { Prisma } from "@prisma/client"
import { InventoryService } from "@/domains/inventory/services/InventoryService"
import crypto from "crypto"

export class SalesService {
  static async ensureEventProductDefaults(branchId: string, eventId: string) {
    const [products, existing] = await Promise.all([
      prisma.product.findMany({ where: { branchId, isActive: true } }),
      prisma.eventProduct.findMany({ where: { eventId } })
    ])
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
    cart: { eventProductId: string, quantity: number, unitPrice?: number }[],
    payments: { method: any, amount: number, reference?: string }[],
    soldById: string,
    attendeeId?: string
  ) {
    if (!Array.isArray(cart) || cart.length === 0) throw new Error("El carrito está vacío")
    if (cart.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      throw new Error("Cantidad inválida en el carrito")
    }

    // El precio sale de la base, nunca del navegador (si no, se podría vender a $0)
    const productIds = [...new Set(cart.map((item) => item.eventProductId))]
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, branchId, isActive: true },
      select: { id: true, price: true },
    })
    const priceById = new Map<string, number>(products.map((p: any) => [p.id, Number(p.price)] as [string, number]))
    if (priceById.size !== productIds.length) throw new Error("Producto no disponible en esta sucursal")

    const saleGroupId = crypto.randomUUID()
    const lines = cart.map((item) => {
      const unitPrice = priceById.get(item.eventProductId)!
      return { ...item, unitPrice, lineTotal: unitPrice * item.quantity }
    })
    const total = lines.reduce((sum, l) => sum + l.lineTotal, 0)

    const result = await prisma.$transaction(async (tx: any) => {
      // Una sola inserción para todas las líneas
      const sales = await tx.barSale.createManyAndReturn({
        data: lines.map((l) => ({
          branchId,
          eventId,
          attendeeId: attendeeId || null,
          productId: l.eventProductId,
          soldById,
          saleGroup: saleGroupId,
          quantity: l.quantity,
          unitPrice: new Prisma.Decimal(l.unitPrice),
          total: new Prisma.Decimal(l.lineTotal),
          usedIncludedConsumption: false,
        })),
        select: { id: true },
      })

      // Los pagos se asocian a la primera línea de la venta
      if (payments?.length) {
        await tx.barSalePayment.createMany({
          data: payments.map((p) => ({
            saleId: sales[0].id,
            method: p.method,
            amount: new Prisma.Decimal(p.amount),
            reference: p.reference,
          })),
        })
      }

      return { saleGroupId, total }
    })

    // Movimientos de inventario: secuenciales a propósito, cada uno calcula el stock
    // a partir del movimiento anterior del mismo producto
    for (const l of lines) {
      await InventoryService.registerMovement(
        branchId,
        eventId,
        l.eventProductId,
        "SALE",
        -l.quantity,
        `Venta en barra. Grupo de venta: ${saleGroupId}`,
        soldById
      )
    }

    return result
  }
}
