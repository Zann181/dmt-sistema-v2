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
const POLL_INTERVAL_MS = 15_000

/**
 * Check-ins hechos desde otros dispositivos mientras la pantalla está abierta.
 * Usa consultas cortas a /api/attendees/check-ins en vez de SSE: más barato en
 * serverless y no pierde check-ins al reconectar (el cursor lo devuelve el servidor).
 */
export function useCheckInStream({ onCheckIn, branchId, eventId }: UseCheckInStreamOptions = {}) {
  const queryClient = useQueryClient()
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

  const { data, isError, isSuccess } = useQuery({
    queryKey: ["check-in-stream", branchId, eventId],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId: branchId!, eventId: eventId! })
      if (cursorRef.current) params.set("since", cursorRef.current)
      const res = await fetch(`/api/attendees/check-ins?${params}`)
      if (!res.ok) throw new Error("No se pudieron consultar los check-ins")
      return (await res.json()) as { data: CheckInEvent[]; cursor: string }
    },
    enabled: !!branchId && !!eventId,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
  })

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

  return { isConnected: isSuccess && !isError, checkInCount }
}
