"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
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

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "visibilitychange"] as const

/** Avisa solo en las transiciones activo/inactivo. Devuelve la función que libera timer y listeners. */
function subscribeUserIdle(timeoutMs: number, onChange: (isIdle: boolean) => void) {
  let isIdle = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const setIdle = (next: boolean) => {
    if (next === isIdle) return
    isIdle = next
    onChange(next)
  }
  const reset = () => {
    setIdle(false)
    clearTimeout(timer)
    timer = setTimeout(() => setIdle(true), timeoutMs)
  }
  ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))
  reset()
  return () => {
    clearTimeout(timer)
    ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset))
  }
}

function useUserIdle(timeoutMs: number, onWake: () => void) {
  const [isIdle, setIsIdle] = useState(false)
  const handleChange = useEffectEvent((next: boolean) => {
    setIsIdle(next)
    if (!next) onWake()
  })
  useEffect(() => subscribeUserIdle(timeoutMs, handleChange), [timeoutMs])
  return isIdle
}

interface CheckInPoll {
  data: CheckInEvent[]
  cursor: string
  /** Check-ins acumulados desde que se abrió esta sucursal/evento */
  total: number
}

/**
 * Check-ins hechos desde otros dispositivos mientras la pantalla está abierta.
 * Usa consultas cortas a /api/attendees/check-ins en vez de SSE: más barato en
 * serverless y no pierde check-ins al reconectar (el cursor lo devuelve el servidor).
 */
export function useCheckInStream({ onCheckIn, branchId, eventId }: UseCheckInStreamOptions = {}) {
  const queryClient = useQueryClient()
  const queryKey = ["check-in-stream", branchId, eventId]
  // Al volver de la inactividad (solo en esa transición), ponerse al día de inmediato.
  // refetchQueries omite la consulta si está deshabilitada (sin sucursal/evento).
  const isIdle = useUserIdle(IDLE_AFTER_MS, () => {
    queryClient.refetchQueries({ queryKey, exact: true })
  })
  const onCheckInRef = useRef(onCheckIn)
  useEffect(() => {
    onCheckInRef.current = onCheckIn
  }, [onCheckIn])

  const { data, isError, isSuccess } = useQuery({
    queryKey,
    // Cursor y contador viven en la caché de esta clave: al cambiar de sucursal/evento
    // se empieza de cero (gcTime: 0 descarta la entrada anterior).
    queryFn: async (): Promise<CheckInPoll> => {
      const previous = queryClient.getQueryData<CheckInPoll>(queryKey)
      const params = new URLSearchParams({ branchId: branchId!, eventId: eventId! })
      if (previous) params.set("since", previous.cursor)
      const res = await fetch(`/api/attendees/check-ins?${params}`)
      if (!res.ok) throw new Error("No se pudieron consultar los check-ins")
      const poll = (await res.json()) as { data: CheckInEvent[]; cursor: string }
      return { ...poll, total: (previous?.total ?? 0) + poll.data.length }
    },
    enabled: !!branchId && !!eventId,
    refetchInterval: isIdle ? false : POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
  })

  useEffect(() => {
    if (!data || data.data.length === 0) return

    data.data.forEach((event) => onCheckInRef.current?.(event))
    // Refrescar lista y estadísticas con los ingresos hechos en otros dispositivos
    queryClient.invalidateQueries({ queryKey: ["attendees", branchId, eventId] })
    queryClient.invalidateQueries({ queryKey: ["attendees-stats", branchId, eventId] })
  }, [data, queryClient, branchId, eventId])

  return { isConnected: isSuccess && !isError && !isIdle, checkInCount: data?.total ?? 0 }
}
