import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { SalesService } from "@/domains/sales/services/SalesService"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const activeOnly = searchParams.get("activeOnly") === "true"
  
  // Resolve eventId and branchId
  const branchId = searchParams.get("branchId") || session.user.activeBranchId
  const eventId = searchParams.get("eventId") || session.user.activeEventId

  if (!branchId || !eventId) {
    return NextResponse.json({ error: "Contexto incompleto (branchId o eventId faltantes)" }, { status: 400 })
  }

  try {
    // Ensure default EventProduct entries exist for all branch products
    await SalesService.ensureEventProductDefaults(branchId, eventId)

    if (activeOnly) {
      const branchProducts = await prisma.product.findMany({
        where: { branchId, isActive: true },
        orderBy: { name: "asc" }
      })
      
      const data = branchProducts.map((p: any) => ({
        id: p.id, // Product ID, used in shopping cart transactions
        eventProductId: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
      }))
      return NextResponse.json({ data })
    } else {
      // Return all products joined with their EventProduct status for configuration panel
      const allProducts = await prisma.product.findMany({
        where: { branchId, isActive: true },
        orderBy: { name: "asc" }
      })
      
      const eventProducts = await prisma.eventProduct.findMany({
        where: { eventId }
      })
      
      const epMap = new Map<string, any>(eventProducts.map((ep: any) => [ep.productId, ep]))
      
      const data = allProducts.map((p: any) => {
        const ep = epMap.get(p.id)
        return {
          productId: p.id,
          name: p.name,
          basePrice: p.price,
          isEnabled: ep ? ep.isEnabled : false,
          eventPrice: ep ? ep.eventPrice : null,
        }
      })
      return NextResponse.json({ data })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
