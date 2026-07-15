"use client"

import { useQuery } from "@tanstack/react-query"
import { useContextStore } from "@/stores/contextStore"
import { useEffect, useState } from "react"
import { Calendar, ChevronDown } from "lucide-react"

export function EventSwitcher() {
  const [mounted, setMounted] = useState(false)
  const { activeBranchId, activeEventId, activeEventName, setActiveEvent } = useContextStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: events, isLoading } = useQuery({
    queryKey: ["events", activeBranchId],
    queryFn: async () => {
      const res = await fetch(`/api/events?branchId=${activeBranchId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      return json.data as { id: string; name: string }[]
    },
    enabled: mounted && !!activeBranchId
  })

  useEffect(() => {
    if (mounted && events && events.length > 0 && !activeEventId) {
      setActiveEvent(events[0].id, events[0].name)
    }
  }, [mounted, events, activeEventId, setActiveEvent])

  if (!mounted || !activeBranchId) return null
  if (isLoading) return <div className="h-10 w-48 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 border rounded-md bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
        <Calendar size={16} className="text-emerald-400" />
        <span className="text-sm font-medium">{activeEventName || "Seleccionar Evento"}</span>
        <ChevronDown size={14} className="text-emerald-400 ml-2" />
      </button>

      <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="py-1">
          {events?.map((event) => (
            <button
              key={event.id}
              onClick={() => setActiveEvent(event.id, event.name)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 ${activeEventId === event.id ? "bg-zinc-50 dark:bg-zinc-900 font-medium" : ""}`}
            >
              {event.name}
            </button>
          ))}
          {(!events || events.length === 0) && (
            <div className="px-4 py-2 text-sm text-emerald-400">No hay eventos</div>
          )}
        </div>
      </div>
    </div>
  )
}


