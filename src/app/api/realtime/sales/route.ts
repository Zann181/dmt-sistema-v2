import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessSales) {
    return NextResponse.json({ error: "Sin autorización" }, { status: 401 })
  }

  const branchId = session.user.activeBranchId
  const eventId = session.user.activeEventId

  if (!branchId || !eventId) {
    return NextResponse.json({ error: "Sin contexto activo" }, { status: 400 })
  }

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const encoder = new TextEncoder()

  // Heartbeat to keep connection alive in serverless/proxy environments
  const heartbeatInterval = setInterval(async () => {
    try {
      await writer.write(encoder.encode(": heartbeat\n\n"))
    } catch {
      clearInterval(heartbeatInterval)
    }
  }, 25_000)

  let lastCheckedAt = new Date()
  
  // Poll for new sales records
  const pollInterval = setInterval(async () => {
    try {
      const newSales = await prisma.barSale.findMany({
        where: {
          branchId,
          eventId,
          createdAt: { gt: lastCheckedAt },
        },
        include: {
          product: { select: { name: true } },
          payments: { select: { method: true, amount: true } },
          soldBy: { select: { username: true } },
        },
        orderBy: { createdAt: "asc" },
      })

      if (newSales.length > 0) {
        lastCheckedAt = newSales[newSales.length - 1].createdAt
        const payload = JSON.stringify({ type: "sale", data: newSales })
        await writer.write(encoder.encode(`data: ${payload}\n\n`))
      }
    } catch {
      clearInterval(pollInterval)
      clearInterval(heartbeatInterval)
      writer.close()
    }
  }, 2_000)

  req.signal.addEventListener("abort", () => {
    clearInterval(pollInterval)
    clearInterval(heartbeatInterval)
    writer.close().catch(() => {})
  })

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
