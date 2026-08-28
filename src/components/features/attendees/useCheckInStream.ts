"use client"

import { useState, useEffect, useCallback } from "react"

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

export function useCheckInStream({ onCheckIn, branchId, eventId }: UseCheckInStreamOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [checkInCount, setCheckInCount] = useState(0)

  useEffect(() => {
    if (!branchId || !eventId) return

    let eventSource: EventSource | null = null
    let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null

    const connectSSE = () => {
      eventSource = new EventSource(`/api/realtime/check-in?branchId=${branchId}&eventId=${eventId}`)

      eventSource.onopen = () => setIsConnected(true)

      eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data) as { type: string; data: CheckInEvent[] }
          if (payload.type === "check_in") {
            setCheckInCount(prev => prev + payload.data.length)
            payload.data.forEach(event => onCheckIn?.(event))
          }
        } catch { /* ignore */ }
      }

      eventSource.onerror = () => {
        setIsConnected(false)
        if (eventSource) eventSource.close()
        reconnectTimeoutId = setTimeout(connectSSE, 5000) // reconnect
      }
    }

    connectSSE()

    return () => {
      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId)
      if (eventSource) eventSource.close()
    }
  }, [onCheckIn])

  return { isConnected, checkInCount }
}
