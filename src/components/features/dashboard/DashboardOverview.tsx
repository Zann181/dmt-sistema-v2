"use client"

import React, { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { 
  Users, Banknote, Calendar, ShoppingBag, ArrowUpRight, 
  ArrowDownRight, TrendingUp, Sparkles, Beer, ClipboardList 
} from "lucide-react"
import { MetricCard } from "./MetricCard"
import { PieChartSvg } from "./PieChartSvg"

interface DashboardOverviewProps {
  activeBranchId: string
  activeEventId: string
  activeEventName: string
}

export function DashboardOverview({ activeBranchId, activeEventId, activeEventName }: DashboardOverviewProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"combined" | "entrance" | "bar">("combined")

  // Fetch Dashboard Analytics
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ["dashboard-analytics", activeBranchId, activeEventId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/analytics?branchId=${activeBranchId}&eventId=${activeEventId}`)
      if (!res.ok) throw new Error((await res.json()).error || "Error al cargar analíticas")
      const json = await res.json()
      return json.data
    },
    enabled: !!activeBranchId && !!activeEventId,
    refetchInterval: 30000 // Polling fallback every 30s
  })

  // SSE subscription for live sales
  useEffect(() => {
    if (!activeBranchId || !activeEventId) return

    const sse = new EventSource("/api/realtime/sales")
    
    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === "sale") {
          const sales = payload.data as any[]
          sales.forEach(sale => {
            toast.success(`Nueva venta registrada: ${sale.product.name} x${sale.quantity}`, {
              description: `Total: $${Number(sale.total).toLocaleString()} | Por ${sale.soldBy.username}`,
              icon: <Beer className="text-emerald-500" />
            })
          })
          // Invalidate and refetch analytics automatically
          queryClient.invalidateQueries({
            queryKey: ["dashboard-analytics", activeBranchId, activeEventId]
          })
        }
      } catch (err) {
        console.error("Error parsing sale SSE:", err)
      }
    }

    return () => {
      sse.close()
    }
  }, [activeBranchId, activeEventId, queryClient])

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
          <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
          <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 rounded-xl text-sm border border-red-200 dark:border-red-900/50">
        Error al cargar métricas: {(error as any).message}
      </div>
    )
  }

  const { entrance, bar, combined } = analytics || {}

  // Parse pie chart data for payments
  const barPaymentPieData = [
    { name: "Efectivo", value: bar?.byPaymentMethod?.cash || 0, color: "#10b981" },
    { name: "Tarjeta", value: bar?.byPaymentMethod?.card || 0, color: "#3b82f6" },
    { name: "Transferencia", value: bar?.byPaymentMethod?.transfer || 0, color: "#f59e0b" },
    { name: "Código QR", value: bar?.byPaymentMethod?.qr || 0, color: "#6366f1" }
  ].filter(p => p.value > 0)

  return (
    <div className="space-y-6">
      {/* Upper Navigation Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("combined")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "combined"
                ? "bg-white dark:bg-zinc-950 shadow-sm text-zinc-900 dark:text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Vista General
          </button>
          <button
            onClick={() => setActiveTab("entrance")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "entrance"
                ? "bg-white dark:bg-zinc-950 shadow-sm text-zinc-900 dark:text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Entrada & Taquilla
          </button>
          <button
            onClick={() => setActiveTab("bar")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "bar"
                ? "bg-white dark:bg-zinc-950 shadow-sm text-zinc-900 dark:text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Barra & POS
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Live Stream Habilitado
          </span>
        </div>
      </div>

      {/* COMBINED VIEW */}
      {activeTab === "combined" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard
              title="Ingresos Totales (Evento)"
              value={`$${Number(combined?.totalIncome).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              description="Taquilla + Barra"
              icon={<TrendingUp size={20} />}
              gradient="bg-indigo-600"
            />
            <MetricCard
              title="Resultado Neto Operativo"
              value={`$${Number(combined?.netOperating).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              description="Ventas brutas - Gastos"
              icon={<Sparkles size={20} />}
              gradient="bg-emerald-600"
            />
            <MetricCard
              title="Caja Fuerte (Efectivo Total)"
              value={`$${Number(combined?.cashBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              description="Dinero en caja fuerte física"
              icon={<Banknote size={20} />}
              gradient="bg-amber-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Summary Panels */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Calendar size={18} className="text-indigo-500" /> Resumen de Entrada & Taquilla
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-xs text-zinc-400 block font-semibold">Total Asistentes</span>
                  <span className="text-xl font-extrabold text-zinc-800 dark:text-zinc-200 font-mono mt-1 block">
                    {entrance?.attendeeCount}
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-xs text-zinc-400 block font-semibold">Check-ins Completados</span>
                  <span className="text-xl font-extrabold text-zinc-800 dark:text-zinc-200 font-mono mt-1 block">
                    {entrance?.checkedInCount} ({entrance?.attendeeCount > 0 ? ((entrance.checkedInCount / entrance.attendeeCount) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-xs text-zinc-400 block font-semibold">Gastos Entrada</span>
                  <span className="text-xl font-extrabold text-red-600 dark:text-red-400 font-mono mt-1 block">
                    ${Number(entrance?.totalExpenses).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-xs text-zinc-400 block font-semibold">Retiros Entrada</span>
                  <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-1 block">
                    ${Number(entrance?.cashDropTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Beer size={18} className="text-emerald-500" /> Resumen de Barra & Consumo
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-xs text-zinc-400 block font-semibold">Ventas Registradas</span>
                  <span className="text-xl font-extrabold text-zinc-800 dark:text-zinc-200 font-mono mt-1 block">
                    {bar?.salesCount} transacciones
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-xs text-zinc-400 block font-semibold">Ingresos Barra</span>
                  <span className="text-xl font-extrabold text-green-600 dark:text-green-400 font-mono mt-1 block">
                    ${Number(bar?.totalIncome).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-xs text-zinc-400 block font-semibold">Gastos Barra</span>
                  <span className="text-xl font-extrabold text-red-600 dark:text-red-400 font-mono mt-1 block">
                    ${Number(bar?.totalExpenses).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-xs text-zinc-400 block font-semibold">Vaciados Barra</span>
                  <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-1 block">
                    ${Number(bar?.cashDropTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ENTRANCE VIEW */}
      {activeTab === "entrance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard
              title="Ventas de Taquilla"
              value={`$${Number(entrance?.totalIncome).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              description="Total cobrado en entrada"
              icon={<ArrowUpRight size={20} className="text-emerald-500" />}
              gradient="bg-indigo-500"
            />
            <MetricCard
              title="Egresos y Gastos (Entrada)"
              value={`$${Number(entrance?.totalExpenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              description="Pagos con caja de entrada"
              icon={<ArrowDownRight size={20} className="text-red-500" />}
              gradient="bg-red-500"
            />
            <MetricCard
              title="Efectivo en Caja Entrada"
              value={`$${Number(entrance?.cashBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              description="Ingresos taquilla - egresos/drops"
              icon={<Banknote size={20} className="text-emerald-500" />}
              gradient="bg-amber-500"
            />
          </div>

          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Users size={18} className="text-indigo-500" /> Rendimiento de Check-in y Asistencia
            </h3>
            <div className="flex flex-col md:flex-row items-center gap-8 justify-around py-4">
              <div className="text-center space-y-2">
                <span className="text-sm font-semibold text-zinc-400 block">Total de Boletas Emitidas</span>
                <span className="text-5xl font-black text-zinc-800 dark:text-white font-mono block">
                  {entrance?.attendeeCount}
                </span>
                <span className="text-xs text-zinc-500">Asistentes registrados en base de datos</span>
              </div>
              
              <div className="h-28 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:block" />

              <div className="text-center space-y-2">
                <span className="text-sm font-semibold text-zinc-400 block">Porcentaje de Ingreso</span>
                <span className="text-5xl font-black text-emerald-600 dark:text-emerald-400 font-mono block">
                  {entrance?.attendeeCount > 0 ? ((entrance.checkedInCount / entrance.attendeeCount) * 100).toFixed(0) : 0}%
                </span>
                <span className="text-xs text-zinc-500">
                  {entrance?.checkedInCount} de {entrance?.attendeeCount} personas ingresadas
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BAR VIEW */}
      {activeTab === "bar" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard
              title="Ventas Totales (Barra)"
              value={`$${Number(bar?.totalIncome).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              description="Ingreso total por tickets/bebidas"
              icon={<ArrowUpRight size={20} className="text-emerald-500" />}
              gradient="bg-indigo-500"
            />
            <MetricCard
              title="Egresos y Retiros (Barra)"
              value={`$${Number(bar?.totalExpenses + bar?.cashDropTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              description="Gastos de insumos + vaciados"
              icon={<ArrowDownRight size={20} className="text-red-500" />}
              gradient="bg-red-500"
            />
            <MetricCard
              title="Efectivo en Caja Barra"
              value={`$${Number(bar?.cashBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              description="Ventas en efectivo - egresos/drops"
              icon={<Banknote size={20} className="text-emerald-500" />}
              gradient="bg-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Top Products */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 lg:col-span-3 space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <ClipboardList size={18} className="text-indigo-500" /> Productos Más Vendidos
              </h3>
              
              <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {bar?.topProducts?.map((prod: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 text-xs font-bold font-mono">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{prod.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-zinc-400 font-medium">Cant: <span className="text-zinc-700 dark:text-zinc-300 font-extrabold font-mono">{prod.quantity}</span></span>
                      <span className="font-extrabold text-zinc-900 dark:text-white font-mono">${Number(prod.total).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {(!bar?.topProducts || bar.topProducts.length === 0) && (
                  <div className="text-center py-12 text-zinc-400 text-xs font-semibold">
                    Sin datos de consumo para este evento.
                  </div>
                )}
              </div>
            </div>

            {/* Payment Distribution Chart */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <ShoppingBag size={18} className="text-emerald-500" /> Métodos de Pago (Barra)
              </h3>
              <div className="pt-2">
                <PieChartSvg data={barPaymentPieData} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
