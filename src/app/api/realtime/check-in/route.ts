import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessAttendees) {
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

  const heartbeatInterval = setInterval(async () => {
    try {
      await writer.write(encoder.encode(": heartbeat\n\n"))
    } catch {
      clearInterval(heartbeatInterval)
    }
  }, 25_000)

  let lastCheckedAt = new Date()
  const pollInterval = setInterval(async () => {
    try {
      const newCheckIns = await prisma.attendee.findMany({
        where: {
          branchId,
          eventId,
          hasCheckedIn: true,
          checkedInAt: { gt: lastCheckedAt },
        },
        select: {
          id: true, name: true, cc: true,
          category: { select: { name: true } },
          checkedInAt: true,
        },
        orderBy: { checkedInAt: "asc" },
      })

      if (newCheckIns.length > 0) {
        lastCheckedAt = newCheckIns[newCheckIns.length - 1].checkedInAt!
        const payload = JSON.stringify({ type: "check_in", data: newCheckIns })
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
