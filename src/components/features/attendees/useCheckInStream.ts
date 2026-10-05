"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

export interface CheckInEvent {
  id: string
  name: string
  cc: string
  category: { name: string }
  checkedInAt: string
}

interface UseCheckInStreamOptions {
  onCheckIn?: (event: CheckInEvent) => void
  branchId?: string | null
  eventId?: string | null
}

// Cada cuánto se pregunta por check-ins nuevos (solo con la pestaña visible)
const POLL_INTERVAL_MS = 30_000
// Sin tocar la pantalla este tiempo se deja de consultar. Así un celular olvidado
// abierto no mantiene despierta la base (Neon Free: 100 CU-hora/mes) ni gasta
// invocaciones de Vercel; al volver a tocarla se reanuda al instante.
const IDLE_AFTER_MS = 10 * 60_000

function useUserIdle(timeoutMs: number) {
  const [isIdle, setIsIdle] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      setIsIdle(false)
      clearTimeout(timer)
      timer = setTimeout(() => setIsIdle(true), timeoutMs)
    }
    const events = ["pointerdown", "keydown", "touchstart", "visibilitychange"] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [timeoutMs])
  return isIdle
}

/**
 * Check-ins hechos desde otros dispositivos mientras la pantalla está abierta.
 * Usa consultas cortas a /api/attendees/check-ins en vez de SSE: más barato en
 * serverless y no pierde check-ins al reconectar (el cursor lo devuelve el servidor).
 */
export function useCheckInStream({ onCheckIn, branchId, eventId }: UseCheckInStreamOptions = {}) {
  const queryClient = useQueryClient()
  const isIdle = useUserIdle(IDLE_AFTER_MS)
  const [checkInCount, setCheckInCount] = useState(0)
  const cursorRef = useRef<string | null>(null)
  const onCheckInRef = useRef(onCheckIn)
  useEffect(() => {
    onCheckInRef.current = onCheckIn
  }, [onCheckIn])

  // Al cambiar de sucursal/evento se empieza de cero
  useEffect(() => {
    cursorRef.current = null
    setCheckInCount(0)
  }, [branchId, eventId])

  const { data, isError, isSuccess, refetch } = useQuery({
    queryKey: ["check-in-stream", branchId, eventId],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId: branchId!, eventId: eventId! })
      if (cursorRef.current) params.set("since", cursorRef.current)
      const res = await fetch(`/api/attendees/check-ins?${params}`)
      if (!res.ok) throw new Error("No se pudieron consultar los check-ins")
      return (await res.json()) as { data: CheckInEvent[]; cursor: string }
    },
    enabled: !!branchId && !!eventId,
    refetchInterval: isIdle ? false : POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
  })

  // Al volver de la inactividad (solo en esa transición), ponerse al día de inmediato
  const wasIdleRef = useRef(false)
  useEffect(() => {
    if (wasIdleRef.current && !isIdle && branchId && eventId) refetch()
    wasIdleRef.current = isIdle
  }, [isIdle, branchId, eventId, refetch])

  useEffect(() => {
    if (!data) return
    cursorRef.current = data.cursor
    if (data.data.length === 0) return

    setCheckInCount((prev) => prev + data.data.length)
    data.data.forEach((event) => onCheckInRef.current?.(event))
    // Refrescar lista y estadísticas con los ingresos hechos en otros dispositivos
    queryClient.invalidateQueries({ queryKey: ["attendees", branchId, eventId] })
    queryClient.invalidateQueries({ queryKey: ["attendees-stats", branchId, eventId] })
  }, [data, queryClient, branchId, eventId])

  return { isConnected: isSuccess && !isError && !isIdle, checkInCount }
}
