"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useCheckInStream } from "@/components/features/attendees/useCheckInStream"
import { RealtimeIndicator } from "@/components/ui/RealtimeIndicator"
import { useContextStore } from "@/stores/contextStore"
import { Users, QrCode, Search, Banknote, ShieldAlert, X, Download } from "lucide-react"
import { toast } from "sonner"
import { formatThousands, parseThousands } from "@/shared/utils/price"

export default function EntradaPage() {
  const { activeBranchId, activeEventId, activeEventName } = useContextStore()
  const { isConnected, checkInCount } = useCheckInStream()
  const queryClient = useQueryClient()

  // Search states
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Tab state
  const [activeTab, setActiveTab] = useState<"scan" | "search">("scan")

  // Swipeable floating notification state
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
    subMessage?: string;
  } | null>(null)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)

  // Cash movement states
  const [showCashModal, setShowCashModal] = useState(false)
  const [cashForm, setCashForm] = useState({
    movementType: "EXPENSE" as "EXPENSE" | "CASH_DROP",
    description: "",
    totalAmount: "",
    method: "CASH" as "CASH" | "TRANSFER" | "QR" | "CARD"
  })
  const [cashError, setCashError] = useState("")

  const registerCashMovementMutation = useMutation({
    mutationFn: async (data: typeof cashForm) => {
      const res = await fetch("/api/cash/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: activeBranchId,
          eventId: activeEventId,
          module: "ENTRANCE",
          movementType: data.movementType,
          description: data.description,
          totalAmount: parseThousands(data.totalAmount),
          method: data.method
        })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al registrar movimiento de caja")
      return res.json()
    },
    onSuccess: () => {
      setShowCashModal(false)
      setCashForm({ movementType: "EXPENSE", description: "", totalAmount: "", method: "CASH" })
      setCashError("")
      toast.success("Movimiento de caja registrado con éxito")
    },
    onError: (err: any) => {
      setCashError(err.message)
    }
  })

  // Attendee list query
  const { data: attendees, isLoading } = useQuery({
    queryKey: ["attendees", activeBranchId, activeEventId, searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/attendees?branchId=${activeBranchId}&eventId=${activeEventId}&q=${encodeURIComponent(searchQuery)}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      return json.data as any[]
    },
    enabled: !!activeBranchId && !!activeEventId
  })

  // Check-In mutation
  const checkInMutation = useMutation({
    mutationFn: async (payload: { qrCodeOrCc: string }) => {
      const res = await fetch("/api/attendees/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrCodeOrCc: payload.qrCodeOrCc,
          eventId: activeEventId
        })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al registrar check-in")
      return res.json()
    },
    onSuccess: (resJson) => {
      // Invalidate attendees list queries to refresh UI status
      queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
      setNotification({
        type: "success",
        message: `Check-in Exitoso: ${resJson.data.name}`,
        subMessage: `Categoría: ${resJson.data.category.name}`
      })
    },
    onError: (err: any) => {
      setNotification({
        type: "error",
        message: "Error de Check-in",
        subMessage: err.message
      })
    }
  })

  // Camera scanner states
  const [isScanning, setIsScanning] = useState(false)
  const html5QrCodeRef = useRef<any>(null)

  const startScanning = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode")
      const scanner = new Html5Qrcode("reader")
      html5QrCodeRef.current = scanner
      setIsScanning(true)

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7
            return { width: size, height: size }
          }
        },
        async (decodedText) => {
          try {
            await scanner.pause()
            await checkInMutation.mutateAsync({ qrCodeOrCc: decodedText })
            setTimeout(() => {
              if (html5QrCodeRef.current) {
                try {
                  html5QrCodeRef.current.resume()
                } catch (_) {}
              }
            }, 2000)
          } catch (err: any) {
            setTimeout(() => {
              if (html5QrCodeRef.current) {
                try {
                  html5QrCodeRef.current.resume()
                } catch (_) {}
              }
            }, 2000)
          }
        },
        () => {} // silent frame mismatch
      )
    } catch (err: any) {
      toast.error("Error al acceder a la cámara: " + (err.message || err))
      setIsScanning(false)
    }
  }

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
      } catch (err) {
        console.error("Error stopping scanner", err)
      }
      html5QrCodeRef.current = null
    }
    setIsScanning(false)
  }

  useEffect(() => {
    if (activeTab === "scan" && activeBranchId && activeEventId) {
      const timer = setTimeout(() => {
        startScanning()
      }, 100)
      return () => {
        clearTimeout(timer)
        stopScanning()
      }
    } else {
      stopScanning()
    }
  }, [activeTab, activeBranchId, activeEventId])

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 7000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(searchInput)
  }

  if (!activeBranchId || !activeEventId) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-center max-w-md mx-auto space-y-4">
        <ShieldAlert size={48} className="text-amber-500 animate-bounce" />
        <h2 className="text-xl font-bold">Contexto Incompleto</h2>
        <p className="text-zinc-500 text-sm">
          Por favor selecciona una sucursal y un evento activo en la barra superior antes de gestionar las entradas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 relative">
      {/* Floating Swipeable Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-[9999] w-full max-w-sm bg-white dark:bg-zinc-900 border rounded-xl p-4 shadow-xl select-none cursor-grab active:cursor-grabbing transition-all ${
            notification.type === "success" 
              ? "border-green-200 dark:border-green-900/40" 
              : "border-red-200 dark:border-red-900/40"
          }`}
          style={{
            transform: dragX > 0 ? `translateX(${dragX}px)` : "none",
            opacity: dragX > 0 ? Math.max(0, 1 - dragX / 250) : 1,
            transition: isDragging ? "none" : "transform 0.2s ease, opacity 0.2s ease"
          }}
          onTouchStart={(e) => {
            setIsDragging(true)
            startX.current = e.touches[0].clientX
          }}
          onTouchMove={(e) => {
            if (!isDragging) return
            const diff = e.touches[0].clientX - startX.current
            if (diff > 0) setDragX(diff)
          }}
          onTouchEnd={() => {
            setIsDragging(false)
            if (dragX > 100) {
              setNotification(null)
            }
            setDragX(0)
          }}
          onMouseDown={(e) => {
            setIsDragging(true)
            startX.current = e.clientX
          }}
          onMouseMove={(e) => {
            if (!isDragging) return
            const diff = e.clientX - startX.current
            if (diff > 0) setDragX(diff)
          }}
          onMouseUp={() => {
            setIsDragging(false)
            if (dragX > 100) {
              setNotification(null)
            }
            setDragX(0)
          }}
          onMouseLeave={() => {
            if (isDragging) {
              setIsDragging(false)
              if (dragX > 100) {
                setNotification(null)
              }
              setDragX(0)
            }
          }}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              notification.type === "success" 
                ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" 
                : "bg-red-50 dark:bg-red-900/20 text-red-650 dark:text-red-400"
            }`}>
              {notification.type === "success" ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{notification.message}</p>
              {notification.subMessage && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 whitespace-pre-wrap">{notification.subMessage}</p>
              )}
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 pointer-events-none opacity-50" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Entrada & Check-in</h2>
          <p className="text-zinc-500">Escanea códigos QR automáticamente o realiza búsquedas manuales.</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/attendees/export/excel?branchId=${activeBranchId}&eventId=${activeEventId}`}
            download
            className="text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Download size={14} /> Exportar CSV
          </a>
          <button
            onClick={() => setShowCashModal(true)}
            className="text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Banknote size={14} /> Movimiento Caja
          </button>
          <RealtimeIndicator isConnected={isConnected} />
          <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-4 py-2.5 rounded-md font-bold text-xs">
            {checkInCount} check-ins hoy
          </div>
        </div>
      </div>

      {/* Tabs Headers */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/20 p-1 rounded-xl max-w-md">
        <button
          onClick={() => setActiveTab("scan")}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "scan"
              ? "bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <QrCode size={14} /> Escanear QR
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "search"
              ? "bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Users size={14} /> Búsqueda Manual
        </button>
      </div>

      {activeTab === "scan" ? (
        <div className="max-w-xl mx-auto space-y-4 animate-in fade-in duration-200 w-full">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm text-center">
            <h3 className="font-semibold text-lg flex items-center justify-center gap-2 mb-4">
              <QrCode size={20} className="text-indigo-600 animate-pulse" />
              Escáner de Accesos QR
            </h3>
            
            <div className="relative aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
              <div 
                id="reader" 
                className="absolute inset-0 w-full h-full z-10 block" 
              />
              
              <div className="text-center space-y-4 z-0">
                <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm animate-pulse">
                  <QrCode size={32} />
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    {isScanning ? "Cámara Activa" : "Iniciando Cámara..."}
                  </p>
                  <p className="text-xs text-zinc-500 max-w-[220px] mx-auto mt-1">
                    El escaneo se procesa automáticamente sin confirmaciones.
                  </p>
                </div>
              </div>
            </div>
            
            {isScanning ? (
              <p className="text-xs text-zinc-400 mt-4 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                Apunta al código QR para registrar la entrada
              </p>
            ) : (
              <button 
                onClick={startScanning}
                className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer z-20 relative"
              >
                Reintentar Cámara
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-[600px] animate-in fade-in duration-200">
          <form onSubmit={handleSearch} className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nombre o cédula..." 
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  if (e.target.value === "") setSearchQuery("")
                }}
                className="w-full pl-10 pr-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium transition-colors">
              Buscar
            </button>
          </form>

          <div className="flex-1 overflow-y-auto p-0">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-950/50 sticky top-0 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-3 font-medium text-zinc-500">Asistente</th>
                  <th className="px-6 py-3 font-medium text-zinc-500">Cédula</th>
                  <th className="px-6 py-3 font-medium text-zinc-500">Categoría</th>
                  <th className="px-6 py-3 font-medium text-zinc-500 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">Cargando asistentes...</td>
                  </tr>
                ) : attendees?.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">No hay asistentes registrados para este evento.</td>
                  </tr>
                ) : (
                  attendees?.map((a) => (
                    <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="px-6 py-3 font-medium">{a.name}</td>
                      <td className="px-6 py-3 text-zinc-500">{a.cc}</td>
                      <td className="px-6 py-3 text-zinc-500">
                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">{a.category.name}</span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {a.hasCheckedIn ? (
                          <span className="text-green-600 dark:text-green-400 font-medium text-xs bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">Ingresó</span>
                        ) : (
                          <button 
                            onClick={() => checkInMutation.mutate({ qrCodeOrCc: a.cc })}
                            disabled={checkInMutation.isPending}
                            className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-650 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-50"
                          >
                            {checkInMutation.isPending ? "Procesando..." : "Check-in manual"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CASH MOVEMENT MODAL */}
      {showCashModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Banknote className="text-indigo-600" /> Movimiento de Caja (Entrada)
              </h3>
              <button onClick={() => setShowCashModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>

            {cashError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <ShieldAlert size={16} /> {cashError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                registerCashMovementMutation.mutate(cashForm)
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Tipo de Movimiento</label>
                <select
                  value={cashForm.movementType}
                  onChange={(e) => setCashForm({ ...cashForm, movementType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="EXPENSE">Gasto Operativo (Salida de dinero)</option>
                  <option value="CASH_DROP">Vaciado de Caja / Retiro de efectivo</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder={cashForm.movementType === "EXPENSE" ? "Ej: Compra de hielos" : "Ej: Retiro parcial caja fuerte"}
                  value={cashForm.description}
                  onChange={(e) => setCashForm({ ...cashForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Monto ($)</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={cashForm.totalAmount}
                    onChange={(e) => setCashForm({ ...cashForm, totalAmount: formatThousands(e.target.value) })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Método de Pago</label>
                  <select
                    value={cashForm.method}
                    onChange={(e) => setCashForm({ ...cashForm, method: e.target.value as any })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="CASH">Efectivo</option>
                    <option value="TRANSFER">Transferencia</option>
                    <option value="QR">Código QR</option>
                    <option value="CARD">Tarjeta</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end border-t pt-4 border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCashModal(false)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md font-semibold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={registerCashMovementMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {registerCashMovementMutation.isPending ? "Registrando..." : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
