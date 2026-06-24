"use client"

import { useContextStore } from "@/stores/contextStore"
import { useSession } from "next-auth/react"
import { ShieldAlert } from "lucide-react"
import { DashboardOverview } from "@/components/features/dashboard/DashboardOverview"

export default function DashboardPage() {
  const { data: session } = useSession()
  const { activeBranchId, activeEventId, activeBranchName, activeEventName } = useContextStore()

  if (!activeBranchId || !activeEventId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Panel Administrativo</h2>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-14rem)] text-center max-w-md mx-auto space-y-4">
          <ShieldAlert size={48} className="text-amber-500 animate-bounce" />
          <h2 className="text-xl font-bold">Selecciona Sucursal & Evento</h2>
          <p className="text-zinc-500 text-sm">
            Por favor selecciona una sucursal y un evento activo en la barra superior para visualizar el panel de analíticas financieras y de asistencia.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          ¡Hola, {session?.user?.firstName || session?.user?.username || "Administrador"}!
        </h2>
        <p className="text-zinc-500 text-sm">
          Monitorea el rendimiento de {activeBranchName} en el evento <strong>{activeEventName}</strong>.
        </p>
      </div>

      <DashboardOverview
        activeBranchId={activeBranchId}
        activeEventId={activeEventId}
        activeEventName={activeEventName || ""}
      />
    </div>
  )
}
