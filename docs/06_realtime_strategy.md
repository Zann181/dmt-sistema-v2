# DMT Sistema v2 — Estrategia Realtime (SSE + Long Polling)

## Por qué NO WebSockets puros en Vercel

Vercel Serverless Functions tienen un timeout máximo de 60 segundos (plan Free: 10s). Los WebSockets nativos requieren conexiones persistentes que no son compatibles con este modelo. Las alternativas viables en Vercel Free son:

| Técnica | Vercel Free | Latencia | Carga servidor |
|---------|:-----------:|----------|----------------|
| **Server-Sent Events (SSE)** | ✅ con streaming | ~100ms | Baja |
| **Long Polling** | ✅ | ~200-500ms | Media |
| WebSocket puro | ❌ timeout | <50ms | Alta |
| WebSocket via Pusher/Ably | ✅ (servicio externo) | <50ms | Cero (delegado) |

**Decisión:** SSE con fallback automático a Long Polling (30s interval). SSE es más eficiente que long polling y completamente compatible con Next.js App Router streaming.

---

## Casos de Uso Realtime

| Módulo | Evento | Consumidores |
|--------|--------|-------------|
| Entrada | Nuevo check-in | Panel de entrada (badge flash + contador) |
| Entrada | Nuevo registro | Panel de entrada (tabla se actualiza) |
| Barra | Nueva venta | Panel de barra (historial de ventas) |
| Dashboard | Actualización de métricas | Dashboard admin |

---

## Implementación SSE — Check-in Stream

### Route Handler (Servidor)

```typescript
// src/app/api/realtime/check-in/route.ts
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { NextResponse } from "next/server"

export const runtime = "nodejs"  // SSE requiere Node.js runtime, no Edge
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

  // SSE stream
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const encoder = new TextEncoder()

  // Enviar heartbeat cada 25s para mantener conexión viva (Vercel timeout = 60s)
  const heartbeatInterval = setInterval(async () => {
    try {
      await writer.write(encoder.encode(": heartbeat\n\n"))
    } catch {
      clearInterval(heartbeatInterval)
    }
  }, 25_000)

  // Polling a DB cada 2 segundos — busca check-ins más recientes que el último known
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

  // Cleanup cuando cliente desconecta
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
      "X-Accel-Buffering": "no",  // Deshabilita buffering en Nginx/Vercel
    },
  })
}
```

---

## Implementación Long Polling — Fallback

```typescript
// src/app/api/realtime/check-in-poll/route.ts
// Para clientes que no soportan SSE o cuando SSE falla

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.permissions.accessAttendees) return unauthorized()

  const url = new URL(req.url)
  const since = url.searchParams.get("since")  // ISO timestamp del último evento conocido
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 30_000)

  const { branchId, activeEventId: eventId } = session.user

  // Espera hasta 25 segundos por nuevos datos (long poll window)
  const startTime = Date.now()
  const POLL_TIMEOUT = 25_000
  const CHECK_INTERVAL = 1_000

  while (Date.now() - startTime < POLL_TIMEOUT) {
    const newCheckIns = await prisma.attendee.findMany({
      where: { branchId, eventId, hasCheckedIn: true, checkedInAt: { gt: sinceDate } },
      select: { id: true, name: true, checkedInAt: true, category: { select: { name: true } } },
      orderBy: { checkedInAt: "asc" },
    })

    if (newCheckIns.length > 0) {
      return NextResponse.json({
        data: newCheckIns,
        nextSince: newCheckIns[newCheckIns.length - 1].checkedInAt,
      })
    }

    // Esperar antes de re-consultar
    await new Promise(r => setTimeout(r, CHECK_INTERVAL))
  }

  // Timeout — retorna vacío, cliente debe re-conectar
  return NextResponse.json({ data: [], nextSince: new Date().toISOString() })
}
```

---

## Cliente React — Hook de Check-in Realtime

```typescript
// src/components/features/attendees/useCheckInStream.ts
"use client"

import { useState, useEffect, useCallback } from "react"
import { CheckInEvent } from "@/domains/attendee/entities"

interface UseCheckInStreamOptions {
  onCheckIn?: (event: CheckInEvent) => void
}

export function useCheckInStream({ onCheckIn }: UseCheckInStreamOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [checkInCount, setCheckInCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const connectSSE = useCallback(() => {
    const eventSource = new EventSource("/api/realtime/check-in")

    eventSource.onopen = () => {
      setIsConnected(true)
      setError(null)
    }

    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data) as { type: string; data: CheckInEvent[] }
        if (payload.type === "check_in") {
          setCheckInCount(prev => prev + payload.data.length)
          payload.data.forEach(event => onCheckIn?.(event))
        }
      } catch { /* ignore parse errors */ }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      eventSource.close()
      setError("Conexión perdida — reconectando...")
      // Auto-reconnect en 5 segundos
      setTimeout(connectSSE, 5_000)
    }

    return eventSource
  }, [onCheckIn])

  useEffect(() => {
    // Verificar soporte SSE — fallback a polling
    if (typeof EventSource === "undefined") {
      startLongPolling()
      return
    }

    const es = connectSSE()
    return () => es.close()
  }, [connectSSE])

  // Long polling fallback
  function startLongPolling() {
    let since = new Date().toISOString()
    let active = true

    async function poll() {
      while (active) {
        try {
          const res = await fetch(`/api/realtime/check-in-poll?since=${since}`)
          const json = await res.json()
          if (json.data?.length > 0) {
            setCheckInCount(prev => prev + json.data.length)
            json.data.forEach((event: CheckInEvent) => onCheckIn?.(event))
            since = json.nextSince
          }
        } catch {
          await new Promise(r => setTimeout(r, 5_000))
        }
      }
    }
    poll()
    setIsConnected(true)
    return () => { active = false }
  }

  return { isConnected, checkInCount, error }
}
```

---

## TanStack Query — Polling para Dashboard

Para datos de dashboard (no necesitan sub-segundo), usar TanStack Query con `refetchInterval`:

```typescript
// src/components/features/dashboard/useDashboardAnalytics.ts
"use client"

import { useQuery } from "@tanstack/react-query"

export function useDashboardAnalytics() {
  return useQuery({
    queryKey: ["dashboard", "analytics"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/analytics")
      if (!res.ok) throw new Error("Error cargando analytics")
      return res.json()
    },
    refetchInterval: 30_000,       // Actualiza cada 30 segundos
    staleTime: 20_000,             // Cache válido 20 segundos
    refetchOnWindowFocus: true,    // Actualiza al volver a la pestaña
  })
}
```

---

## Indicador de Estado Realtime en UI

```typescript
// src/components/ui/RealtimeIndicator.tsx
"use client"

export function RealtimeIndicator({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      <span className="text-muted-foreground">
        {isConnected ? "En vivo" : "Reconectando..."}
      </span>
    </div>
  )
}
```

---

## Consideraciones de Escala

| Métrica | Free Tier Vercel | Necesidad del sistema |
|---------|-----------------|----------------------|
| SSE connections simultáneas | ~50 (serverless) | ~5-20 (uso típico por evento) ✅ |
| Requests/mes | 100k (Hobby) | ~10k por evento ✅ |
| DB queries (SSE 2s interval) | 1800/hora/conexión | Aceptable con índice en `checked_in_at` ✅ |
| Tiempo de ejecución función | 60s (Hobby) | SSE con heartbeat 25s + re-connect ✅ |

> Para escalar a múltiples eventos simultáneos o >50 usuarios en vivo, considerar Pusher Beams (Free: 200k mensajes/día) como reemplazo del SSE custom.
