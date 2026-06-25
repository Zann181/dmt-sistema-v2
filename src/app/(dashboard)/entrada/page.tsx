"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useCheckInStream } from "@/components/features/attendees/useCheckInStream"
import { RealtimeIndicator } from "@/components/ui/RealtimeIndicator"
import { useContextStore } from "@/stores/contextStore"
import { Users, QrCode, Search, Banknote, ShieldAlert, X, Download, UserPlus, Edit, Trash2, Mail } from "lucide-react"

// Icono personalizado de WhatsApp de alta calidad para el estilo premium
const WhatsAppIcon = ({ size = 14 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className="inline-block">
    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.333 4.982L2 22l5.233-1.371a9.936 9.936 0 004.779 1.229h.004c5.505 0 9.989-4.478 9.99-9.984 0-2.67-1.037-5.178-2.92-7.062C17.182 2.928 14.677 2 12.012 2zm5.727 14.18c-.25.703-1.442 1.34-1.99 1.411-.478.062-.972.107-2.65-.588-2.146-.888-3.528-3.064-3.635-3.207-.107-.143-.872-1.16-.872-2.215 0-1.056.554-1.572.75-1.782.197-.21.428-.263.571-.263.143 0 .285.002.41.008.13.006.303-.048.473.362.175.422.598 1.458.649 1.564.052.106.086.23.013.376-.072.146-.108.238-.218.365-.11.127-.23.284-.329.38-.11.107-.225.223-.097.443.128.22.57 1.01.122 1.512.71 1.258 1.31 1.65 1.503 1.747.193.097.306.08.42-.05.114-.13.498-.58.63-.777.13-.197.26-.164.44-.098.18.066 1.144.538 1.341.637.197.098.328.147.377.23.05.084.05.485-.2.1.188z" />
  </svg>
)
import { toast } from "sonner"
import { formatThousands, parseThousands } from "@/shared/utils/price"

export default function EntradaPage() {
  const { activeBranchId, activeBranchName, activeEventId, activeEventName } = useContextStore()
  const { isConnected, checkInCount } = useCheckInStream()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Search states
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Tab state
  const [activeTab, setActiveTab] = useState<"scan" | "search" | "add">("search")

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

  // Add attendee form state
  const [addForm, setAddForm] = useState({
    name: "",
    cc: "",
    phone: "",
    email: "",
    categoryId: "",
    paidAmount: ""
  })
  const [addError, setAddError] = useState("")
  const [addFormErrors, setAddFormErrors] = useState({
    name: false,
    cc: false,
    categoryId: false,
    paidAmount: false
  })

  // Edit attendee form state
  const [editingAttendee, setEditingAttendee] = useState<any | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    cc: "",
    phone: "",
    email: "",
    categoryId: "",
    paidAmount: ""
  })
  const [editError, setEditError] = useState("")
  const [editFormErrors, setEditFormErrors] = useState({
    name: false,
    cc: false,
    categoryId: false,
    paidAmount: false
  })

  // Sync tab with URL parameter ?mode=
  useEffect(() => {
    const mode = searchParams.get("mode")
    if (mode === "scan" || mode === "search" || mode === "add") {
      setActiveTab(mode)
    }
  }, [searchParams])

  // Get active attendee categories for select box
  const { data: categories } = useQuery({
    queryKey: ["attendee-categories", activeBranchId],
    queryFn: async () => {
      const res = await fetch(`/api/attendees/categories?branchId=${activeBranchId}`)
      if (!res.ok) throw new Error("Error al obtener categorías")
      return (await res.json()).data as any[]
    },
    enabled: !!activeBranchId
  })

  // Get active event details (startsAt, venueName, etc.)
  const { data: events } = useQuery({
    queryKey: ["events", activeBranchId],
    queryFn: async () => {
      const res = await fetch(`/api/events?branchId=${activeBranchId}`)
      if (!res.ok) throw new Error("Error al obtener eventos")
      return (await res.json()).data as any[]
    },
    enabled: !!activeBranchId
  })

  const activeEvent = events?.find((e: any) => e.id === activeEventId)

  // Helper to clean phone numbers for WhatsApp API
  const cleanPhone = (phone: string | null | undefined) => {
    if (!phone) return ""
    let cleaned = phone.replace(/\D/g, "")
    if (cleaned.length === 10 && cleaned.startsWith("3")) {
      cleaned = "57" + cleaned
    }
    return cleaned
  }

  // Share ticket by WhatsApp
  const handleWhatsAppShare = (a: any) => {
    const qrLink = `${window.location.origin}/api/attendees/${a.qrCode}/qr.png`
    const eventDate = activeEvent?.startsAt 
      ? new Date(activeEvent.startsAt).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : ""
    
    const message = `¡Hola, ${a.name}! 🎟️\n\n` +
      `Tu registro para *${activeEvent?.name || activeEventName || ""}* en *${activeBranchName || ""}* ha sido confirmado.\n\n` +
      `*Detalles del Evento:*\n` +
      `📅 *Fecha:* ${eventDate}\n` +
      `📍 *Lugar:* ${activeEvent?.venueName || "Venue principal"}\n` +
      `🎫 *Categoría:* ${a.category?.name || ""}\n` +
      `🔑 *Código QR:* ${a.qrCode}\n\n` +
      `Presenta tu código QR para el ingreso. Puedes descargarlo aquí:\n` +
      `${qrLink}\n\n` +
      `¡Te esperamos!`

    const phone = cleanPhone(a.phone || "")
    const url = `https://api.whatsapp.com/send?${phone ? `phone=${phone}&` : ""}text=${encodeURIComponent(message)}`
    window.open(url, "_blank")
  }

  // Resend email mutation
  const resendEmailMutation = useMutation({
    mutationFn: async (attendeeId: string) => {
      const res = await fetch("/api/attendees/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeId })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al reenviar correo")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Correo de ticket reenviado con éxito")
    },
    onError: (err: any) => {
      toast.error(err.message)
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

  // Add attendee mutation
  const addAttendeeMutation = useMutation({
    mutationFn: async (data: typeof addForm) => {
      const res = await fetch("/api/attendees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          cc: data.cc,
          phone: data.phone || null,
          email: data.email || null,
          categoryId: data.categoryId,
          paidAmount: parseThousands(data.paidAmount) || 0,
          branchId: activeBranchId,
          eventId: activeEventId
        })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al registrar asistente")
      return res.json()
    },
    onSuccess: (resData: any) => {
      setAddForm({ name: "", cc: "", phone: "", email: "", categoryId: "", paidAmount: "" })
      setAddError("")
      setAddFormErrors({ name: false, cc: false, categoryId: false, paidAmount: false })
      
      if (resData?.mailError) {
        toast.warning(`Asistente registrado, pero falló el envío de correo: ${resData.mailError}`, {
          duration: 6000
        })
      } else if (resData?.data?.email) {
        toast.success("Asistente registrado y ticket enviado con éxito")
      } else {
        toast.success("Asistente registrado con éxito (sin correo)")
      }
      queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
    },
    onError: (err: any) => {
      setAddError(err.message)
    }
  })

  const handleCategoryChange = (catId: string) => {
    const selectedCat = categories?.find((c: any) => c.id === catId)
    setAddForm(prev => ({
      ...prev,
      categoryId: catId,
      paidAmount: selectedCat ? formatThousands(selectedCat.price.toString()) : ""
    }))
  }

  const startEditing = (a: any) => {
    setEditingAttendee(a)
    setEditForm({
      name: a.name,
      cc: a.cc,
      phone: a.phone || "",
      email: a.email || "",
      categoryId: a.categoryId,
      paidAmount: formatThousands(a.paidAmount.toString())
    })
    setEditError("")
    setEditFormErrors({ name: false, cc: false, categoryId: false, paidAmount: false })
  }

  const handleEditCategoryChange = (catId: string) => {
    const selectedCat = categories?.find((c: any) => c.id === catId)
    setEditForm(prev => ({
      ...prev,
      categoryId: catId,
      paidAmount: selectedCat ? formatThousands(selectedCat.price.toString()) : ""
    }))
  }

  // Edit attendee mutation
  const editAttendeeMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const res = await fetch(`/api/attendees?id=${editingAttendee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          cc: data.cc,
          phone: data.phone || null,
          email: data.email || null,
          categoryId: data.categoryId,
          paidAmount: parseThousands(data.paidAmount) || 0
        })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al actualizar asistente")
      return res.json()
    },
    onSuccess: () => {
      setEditingAttendee(null)
      toast.success("Asistente actualizado con éxito")
      queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
    },
    onError: (err: any) => {
      setEditError(err.message)
    }
  })

  // Delete attendee mutation
  const deleteAttendeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/attendees?id=${id}`, {
        method: "DELETE"
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al eliminar asistente")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Asistente eliminado con éxito")
      queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  const handleDeleteAttendee = (a: any) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar a ${a.name}?`)) {
      deleteAttendeeMutation.mutate(a.id)
    }
  }

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

  // Camera scanner states
  const [isScanning, setIsScanning] = useState(false)
  const html5QrCodeRef = useRef<any>(null)
  const isScanTabActiveRef = useRef(false)
  const isStartingRef = useRef(false)

  const startScanning = async () => {
    if (!isScanTabActiveRef.current || isStartingRef.current) return
    isStartingRef.current = true
    try {
      const { Html5Qrcode } = await import("html5-qrcode")
      if (!isScanTabActiveRef.current) return
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
      if (!isScanTabActiveRef.current) {
        stopScanning()
      }
    } catch (err: any) {
      toast.error("Error al acceder a la cámara: " + (err.message || err))
      setIsScanning(false)
    } finally {
      isStartingRef.current = false
    }
  }

  const stopScanning = async () => {
    if (isStartingRef.current) return
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop()
        }
      } catch (err) {
        console.warn("Error stopping scanner (safe catch):", err)
      }
      html5QrCodeRef.current = null
    }
    setIsScanning(false)
  }

  useEffect(() => {
    if (activeTab === "scan" && activeBranchId && activeEventId) {
      isScanTabActiveRef.current = true
      const timer = setTimeout(() => {
        if (isScanTabActiveRef.current) {
          startScanning()
        }
      }, 100)
      return () => {
        isScanTabActiveRef.current = false
        clearTimeout(timer)
        stopScanning()
      }
    } else {
      isScanTabActiveRef.current = false
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

  const isFullscreen = searchParams.get("fullscreen") === "true"

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

  if (activeTab === "scan" && isFullscreen) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200 select-none">
        {/* Floating Swipeable Notification */}
        {notification && (
          <div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] w-full max-w-sm bg-zinc-900 border rounded-xl p-4 shadow-2xl border-zinc-800"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                notification.type === "success" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
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
              <div className="flex-1 min-w-0 text-white">
                <p className="font-bold text-sm truncate">{notification.message}</p>
                {notification.subMessage && (
                  <p className="text-xs text-zinc-400 mt-0.5 whitespace-pre-wrap">{notification.subMessage}</p>
                )}
              </div>
              <button 
                onClick={() => setNotification(null)}
                className="text-zinc-500 hover:text-zinc-350 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="w-full max-w-md flex flex-col items-center space-y-6">
          <div className="text-center space-y-1 w-full">
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              <QrCode size={20} className="text-indigo-400 animate-pulse" />
              Escáner de Entradas
            </h2>
            <p className="text-xs text-zinc-400">{activeEventName}</p>
          </div>

          <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center shadow-2xl">
            <div 
              id="reader" 
              className="absolute inset-0 w-full h-full z-10 block" 
            />
            
            <div className="text-center space-y-4 z-0">
              <div className="w-16 h-16 rounded-full bg-indigo-950 text-indigo-400 flex items-center justify-center mx-auto shadow-sm animate-pulse">
                <QrCode size={32} />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-300">
                  {isScanning ? "Cámara Activa" : "Iniciando Cámara..."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between w-full px-2 text-zinc-400 text-xs">
            <RealtimeIndicator isConnected={isConnected} />
            <div className="bg-indigo-950/40 text-indigo-400 px-3 py-1.5 rounded-lg font-bold">
              {checkInCount} check-ins
            </div>
          </div>

          {isScanning ? (
            <p className="text-xs text-zinc-500 flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              Apunta al código QR para registrar la entrada
            </p>
          ) : (
            <button 
              onClick={startScanning}
              className="bg-indigo-600 hover:bg-indigo-750 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer z-20 relative"
            >
              Reintentar Cámara
            </button>
          )}

          <button
            onClick={() => {
              stopScanning()
              window.close()
            }}
            className="text-xs text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-900 px-4 py-2 rounded-lg transition-colors mt-4"
          >
            Cerrar Escáner
          </button>
        </div>
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
            href="/entrada?mode=scan&fullscreen=true"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white px-3 py-2.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <QrCode size={14} /> Abrir Escáner QR
          </a>
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
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/20 p-1 rounded-xl max-w-sm">
        <button
          onClick={() => {
            setActiveTab("search")
            router.replace("/entrada?mode=search")
          }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "search"
              ? "bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Users size={14} /> Búsqueda Manual
        </button>
        <button
          onClick={() => {
            setActiveTab("add")
            router.replace("/entrada?mode=add")
          }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "add"
              ? "bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <UserPlus size={14} /> Agregar Asistente
        </button>
      </div>

      {activeTab === "search" && (
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
              <thead className="bg-zinc-50 dark:bg-zinc-955/50 sticky top-0 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-3 font-medium text-zinc-500">Asistente</th>
                  <th className="px-6 py-3 font-medium text-zinc-500">Cédula</th>
                  <th className="px-6 py-3 font-medium text-zinc-500">Categoría</th>
                  <th className="px-6 py-3 font-medium text-zinc-500 text-right">Estado / Acciones</th>
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
                        <div className="flex items-center justify-end gap-3">
                          {a.hasCheckedIn ? (
                            <span className="text-green-600 dark:text-green-400 font-medium text-xs bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">Ingresó</span>
                          ) : (
                            <button 
                              onClick={() => checkInMutation.mutate({ qrCodeOrCc: a.cc })}
                              disabled={checkInMutation.isPending}
                              className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-650 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-50"
                            >
                              {checkInMutation.isPending ? "Procesando..." : "Check-in"}
                            </button>
                          )}
                          <div className="flex items-center gap-1.5">
                            {a.phone && (
                              <button
                                onClick={() => handleWhatsAppShare(a)}
                                className="p-1 text-zinc-400 hover:text-green-500 dark:hover:text-green-400 transition-colors"
                                title="Enviar por WhatsApp"
                              >
                                <WhatsAppIcon size={14} />
                              </button>
                            )}
                            {a.email && (
                              <button
                                onClick={() => resendEmailMutation.mutate(a.id)}
                                disabled={resendEmailMutation.isPending}
                                className="p-1 text-zinc-400 hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
                                title={resendEmailMutation.isPending ? "Reenviando..." : "Reenviar Correo"}
                              >
                                <Mail size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => startEditing(a)}
                              className="p-1 text-zinc-400 hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors"
                              title="Editar"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteAttendee(a)}
                              className="p-1 text-zinc-400 hover:text-red-650 dark:hover:text-red-400 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "add" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden p-6 max-w-xl mx-auto animate-in fade-in duration-200 space-y-4">
          <div className="border-b pb-3 border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <UserPlus className="text-indigo-650 dark:text-indigo-400" /> Registrar Nuevo Asistente
            </h3>
            <p className="text-xs text-zinc-500 mt-1">Registra de forma manual un asistente al evento actual.</p>
          </div>

          {addError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
              <ShieldAlert size={16} /> {addError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const errors = {
                name: !addForm.name.trim(),
                cc: !addForm.cc.trim(),
                categoryId: !addForm.categoryId,
                paidAmount: !addForm.paidAmount.trim()
              }
              setAddFormErrors(errors)

              if (errors.name || errors.cc || errors.categoryId || errors.paidAmount) {
                setAddError("Por favor completa todas las casillas requeridas.")
                return
              }

              // Check duplicate locally
              const isDuplicate = attendees?.some((a) => a.cc.trim().toLowerCase() === addForm.cc.trim().toLowerCase())
              if (isDuplicate) {
                setAddError(`La cédula ${addForm.cc} ya está registrada para este evento.`)
                setAddFormErrors(prev => ({ ...prev, cc: true }))
                return
              }

              addAttendeeMutation.mutate(addForm)
            }}
            className="space-y-4"
            noValidate
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={addForm.name}
                  onChange={(e) => {
                    setAddForm({ ...addForm, name: e.target.value })
                    setAddFormErrors(prev => ({ ...prev, name: false }))
                  }}
                  className={`w-full px-3 py-2 border rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    addFormErrors.name 
                      ? "border-red-500 dark:border-red-500/50 focus:ring-red-500" 
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Cédula / Documento *</label>
                <input
                  type="text"
                  placeholder="Ej: 1234567"
                  value={addForm.cc}
                  onChange={(e) => {
                    setAddForm({ ...addForm, cc: e.target.value })
                    setAddFormErrors(prev => ({ ...prev, cc: false }))
                  }}
                  className={`w-full px-3 py-2 border rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    addFormErrors.cc 
                      ? "border-red-500 dark:border-red-500/50 focus:ring-red-500" 
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Celular (Opcional)</label>
                <input
                  type="tel"
                  placeholder="Ej: 098123456"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Correo (Opcional)</label>
                <input
                  type="email"
                  placeholder="Ej: juan@gmail.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Categoría *</label>
                <select
                  value={addForm.categoryId}
                  onChange={(e) => {
                    handleCategoryChange(e.target.value)
                    setAddFormErrors(prev => ({ ...prev, categoryId: false }))
                  }}
                  className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    addFormErrors.categoryId 
                      ? "border-red-500 dark:border-red-500/50 focus:ring-red-500" 
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <option value="">Selecciona una categoría...</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.price ? `$${formatThousands(cat.price.toString())}` : "Sin costo"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Monto Pagado ($) *</label>
                <input
                  type="text"
                  placeholder="0"
                  value={addForm.paidAmount}
                  onChange={(e) => {
                    setAddForm({ ...addForm, paidAmount: formatThousands(e.target.value) })
                    setAddFormErrors(prev => ({ ...prev, paidAmount: false }))
                  }}
                  className={`w-full px-3 py-2 border rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold ${
                    addFormErrors.paidAmount 
                      ? "border-red-500 dark:border-red-500/50 focus:ring-red-500" 
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t pt-4 border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setAddForm({ name: "", cc: "", phone: "", email: "", categoryId: "", paidAmount: "" })
                  setAddError("")
                  setAddFormErrors({ name: false, cc: false, categoryId: false, paidAmount: false })
                  setActiveTab("search")
                  router.replace("/entrada?mode=search")
                }}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md font-semibold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={addAttendeeMutation.isPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {addAttendeeMutation.isPending ? "Registrando..." : "Registrar y Enviar Ticket"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CASH MOVEMENT MODAL */}
      {showCashModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Banknote className="text-indigo-650 dark:text-indigo-400" /> Movimiento de Caja (Entrada)
              </h3>
              <button onClick={() => setShowCashModal(false)} className="text-zinc-400 hover:text-zinc-655 dark:hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>

            {cashError && (
              <div className="p-3 bg-red-50 dark:bg-red-955/20 text-red-655 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
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

      {/* EDIT ATTENDEE MODAL */}
      {editingAttendee && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Edit className="text-indigo-650 dark:text-indigo-400" /> Editar Asistente
              </h3>
              <button onClick={() => setEditingAttendee(null)} className="text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <ShieldAlert size={16} /> {editError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const errors = {
                  name: !editForm.name.trim(),
                  cc: !editForm.cc.trim(),
                  categoryId: !editForm.categoryId,
                  paidAmount: !editForm.paidAmount.trim()
                }
                setEditFormErrors(errors)
                if (errors.name || errors.cc || errors.categoryId || errors.paidAmount) {
                  setEditError("Por favor completa todas las casillas requeridas.")
                  return
                }
                editAttendeeMutation.mutate(editForm)
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => {
                    setEditForm({ ...editForm, name: e.target.value })
                    setEditFormErrors(prev => ({ ...prev, name: false }))
                  }}
                  className={`w-full px-3 py-2 border rounded-md bg-zinc-50 dark:bg-zinc-955 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    editFormErrors.name ? "border-red-500 dark:border-red-500/50" : "border-zinc-200 dark:border-zinc-800"
                  }`}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Cédula / Documento *</label>
                <input
                  type="text"
                  value={editForm.cc}
                  onChange={(e) => {
                    setEditForm({ ...editForm, cc: e.target.value })
                    setEditFormErrors(prev => ({ ...prev, cc: false }))
                  }}
                  className={`w-full px-3 py-2 border rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    editFormErrors.cc ? "border-red-500 dark:border-red-500/50" : "border-zinc-200 dark:border-zinc-800"
                  }`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Celular</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-955 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Correo</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Categoría *</label>
                  <select
                    value={editForm.categoryId}
                    onChange={(e) => {
                      handleEditCategoryChange(e.target.value)
                      setEditFormErrors(prev => ({ ...prev, categoryId: false }))
                    }}
                    className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      editFormErrors.categoryId ? "border-red-500 dark:border-red-500/50" : "border-zinc-200 dark:border-zinc-800"
                    }`}
                    required
                  >
                    {categories?.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.price ? `$${formatThousands(cat.price.toString())}` : "Sin costo"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Monto Pagado ($) *</label>
                  <input
                    type="text"
                    value={editForm.paidAmount}
                    onChange={(e) => {
                      setEditForm({ ...editForm, paidAmount: formatThousands(e.target.value) })
                      setEditFormErrors(prev => ({ ...prev, paidAmount: false }))
                    }}
                    className={`w-full px-3 py-2 border rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold ${
                      editFormErrors.paidAmount ? "border-red-500 dark:border-red-500/50" : "border-zinc-200 dark:border-zinc-800"
                    }`}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end border-t pt-4 border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingAttendee(null)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md font-semibold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editAttendeeMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {editAttendeeMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
