"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useCheckInStream } from "@/components/features/attendees/useCheckInStream"
import { useContextStore } from "@/stores/contextStore"
import { Users, QrCode, Search, Banknote, ShieldAlert, X, Download, UserPlus, Edit, Trash2, Mail, Plus } from "lucide-react"

// Icono personalizado de WhatsApp de alta calidad para el estilo premium
const WhatsAppIcon = ({ size = 14 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className="inline-block">
    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.333 4.982L2 22l5.233-1.371a9.936 9.936 0 004.779 1.229h.004c5.505 0 9.989-4.478 9.99-9.984 0-2.67-1.037-5.178-2.92-7.062C17.182 2.928 14.677 2 12.012 2zm5.727 14.18c-.25.703-1.442 1.34-1.99 1.411-.478.062-.972.107-2.65-.588-2.146-.888-3.528-3.064-3.635-3.207-.107-.143-.872-1.16-.872-2.215 0-1.056.554-1.572.75-1.782.197-.21.428-.263.571-.263.143 0 .285.002.41.008.13.006.303-.048.473.362.175.422.598 1.458.649 1.564.052.106.086.23.013.376-.072.146-.108.238-.218.365-.11.127-.23.284-.329.38-.11.107-.225.223-.097.443.128.22.57 1.01.122 1.512.71 1.258 1.31 1.65 1.503 1.747.193.097.306.08.42-.05.114-.13.498-.58.63-.777.13-.197.26-.164.44-.098.18.066 1.144.538 1.341.637.197.098.328.147.377.23.05.084.05.485-.2.1.188z" />
  </svg>
)
import { toast } from "sonner"
import { formatThousands, parseThousands } from "@/shared/utils/price"

const toTitleCase = (str: string): string => {
  if (!str) return ""
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

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
  const [activeTab, setActiveTab] = useState<"scan" | "search" | "add" | "dashboard">("dashboard")

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
    if (mode === "scan" || mode === "search" || mode === "add" || mode === "dashboard") {
      setActiveTab(mode as any)
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

  // Get current session for permission checks
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session")
      if (!res.ok) return null
      return await res.json()
    }
  })

  // Already Checked In Warning state
  const [alreadyCheckedInInfo, setAlreadyCheckedInInfo] = useState<any | null>(null)

  // New Category creation states
  const [showNewCatModal, setShowNewCatModal] = useState(false)
  const [callingForm, setCallingForm] = useState<"add" | "edit" | null>(null)
  const [newCatError, setNewCatError] = useState("")
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [newCatForm, setNewCatForm] = useState({
    name: "",
    price: "",
    includedConsumptions: 0,
    description: ""
  })

  // Add Category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: typeof newCatForm) => {
      const res = await fetch("/api/attendees/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: activeBranchId,
          name: data.name,
          price: Number(parseThousands(data.price)) || 0,
          includedConsumptions: Number(data.includedConsumptions) || 0,
          description: data.description || ""
        })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al crear la categoría")
      return (await res.json()).data
    },
    onSuccess: (newCat: any) => {
      toast.success("Categoría creada con éxito")
      queryClient.invalidateQueries({ queryKey: ["attendee-categories", activeBranchId] })
      queryClient.invalidateQueries({ queryKey: ["attendees-stats", activeBranchId, activeEventId] })
      
      if (callingForm === "add") {
        setAddForm(prev => ({
          ...prev,
          categoryId: newCat.id,
          paidAmount: formatThousands(newCat.price.toString())
        }))
        setAddFormErrors(prev => ({ ...prev, categoryId: false }))
      } else if (callingForm === "edit") {
        setEditForm(prev => ({
          ...prev,
          categoryId: newCat.id,
          paidAmount: formatThousands(newCat.price.toString())
        }))
        setEditFormErrors(prev => ({ ...prev, categoryId: false }))
      }

      setShowNewCatModal(false)
      setNewCatForm({ name: "", price: "", includedConsumptions: 0, description: "" })
      setNewCatError("")
    },
    onError: (err: any) => {
      setNewCatError(err.message)
    }
  })

  // Update Category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof newCatForm }) => {
      const res = await fetch(`/api/attendees/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          price: Number(parseThousands(data.price)) || 0,
          includedConsumptions: Number(data.includedConsumptions) || 0,
          description: data.description || ""
        })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al modificar la categoría")
      return (await res.json()).data
    },
    onSuccess: (updatedCat: any) => {
      toast.success("Categoría modificada con éxito")
      queryClient.invalidateQueries({ queryKey: ["attendee-categories", activeBranchId] })
      queryClient.invalidateQueries({ queryKey: ["attendees-stats", activeBranchId, activeEventId] })
      
      if (callingForm === "add") {
        setAddForm(prev => ({
          ...prev,
          paidAmount: formatThousands(updatedCat.price.toString())
        }))
      } else if (callingForm === "edit") {
        setEditForm(prev => ({
          ...prev,
          paidAmount: formatThousands(updatedCat.price.toString())
        }))
      }

      setShowNewCatModal(false)
      setEditingCatId(null)
      setNewCatForm({ name: "", price: "", includedConsumptions: 0, description: "" })
      setNewCatError("")
    },
    onError: (err: any) => {
      setNewCatError(err.message)
    }
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
    const flyerLink = activeEvent?.id 
      ? `${window.location.origin}/api/events/${activeEvent.id}/flyer.png`
      : ""
    const eventDate = activeEvent?.startsAt 
      ? new Date(activeEvent.startsAt).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : ""
    
    const message = `¡Hola, ${a.name}! 🎟️\n\n` +
      `Tu registro para *${activeEvent?.name || activeEventName || ""}* en *${activeBranchName || ""}* ha sido confirmado.\n\n` +
      `*Detalles del Evento:*\n` +
      `📅 *Fecha:* ${eventDate}\n` +
      `📍 *Lugar:* ${activeEvent?.venueName || "Venue principal"}\n` +
      `🎫 *Categoría:* ${a.category?.name || ""}\n\n` +
      `📥 *Descarga tu Código QR de Acceso:* \n` +
      `${qrLink}\n\n` +
      (flyerLink ? `🖼️ *Descarga el Flyer del Evento (.png):* \n${flyerLink}\n\n` : "") +
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

  // Stats Query for the entries dashboard
  const { data: stats, isLoading: isStatsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["attendees-stats", activeBranchId, activeEventId],
    queryFn: async () => {
      const res = await fetch(`/api/attendees?branchId=${activeBranchId}&eventId=${activeEventId}&stats=true`)
      if (!res.ok) throw new Error("Error fetching stats")
      return (await res.json()).data
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
          name: toTitleCase(data.name.trim()),
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
      queryClient.invalidateQueries({ queryKey: ["attendees-stats", activeBranchId, activeEventId] })
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
          name: toTitleCase(data.name.trim()),
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
      queryClient.invalidateQueries({ queryKey: ["attendees-stats", activeBranchId, activeEventId] })
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
      queryClient.invalidateQueries({ queryKey: ["attendees-stats", activeBranchId, activeEventId] })
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
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 409 && json.error === "ALREADY_CHECKED_IN") {
          const customErr = new Error("ALREADY_CHECKED_IN")
          ;(customErr as any).attendee = json.attendee
          throw customErr
        }
        throw new Error(json.error || "Error al registrar check-in")
      }
      return json
    },
    onSuccess: (resJson) => {
      // Invalidate attendees list queries to refresh UI status
      queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
      queryClient.invalidateQueries({ queryKey: ["attendees-stats", activeBranchId, activeEventId] })
      setNotification({
        type: "success",
        message: `Check-in Exitoso: ${resJson.data.name}`,
        subMessage: `Categoría: ${resJson.data.category.name}`
      })
    },
    onError: (err: any) => {
      if (err.message === "ALREADY_CHECKED_IN") {
        setAlreadyCheckedInInfo(err.attendee)
      } else {
        setNotification({
          type: "error",
          message: "Error de Check-in",
          subMessage: err.message
        })
      }
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
            if (err.message !== "ALREADY_CHECKED_IN") {
              setTimeout(() => {
                if (html5QrCodeRef.current) {
                  try {
                    html5QrCodeRef.current.resume()
                  } catch (_) {}
                }
              }, 2000)
            }
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

          <div className="flex items-center justify-end w-full px-2 text-zinc-400 text-xs">
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

        {/* ALREADY CHECKED IN WARNING MODAL (LOCKED) */}
        {alreadyCheckedInInfo && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200">
            <div className="bg-zinc-950 border-2 border-red-500 rounded-xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(239,68,68,0.3)] space-y-4 font-mono text-center text-white relative">
              <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-500 flex items-center justify-center mx-auto text-red-500 animate-bounce">
                <ShieldAlert size={36} />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-black tracking-widest text-red-500 uppercase">
                  ¡Advertencia!
                </h3>
                <p className="text-sm font-bold text-zinc-100">
                  El asistente ya ingresó al evento
                </p>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 text-left space-y-2 text-xs">
                <div className="flex justify-between border-b border-zinc-800/60 pb-1.5">
                  <span className="text-zinc-500">Asistente:</span>
                  <span className="font-bold text-zinc-200">{alreadyCheckedInInfo.name}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800/60 pb-1.5">
                  <span className="text-zinc-500">Documento:</span>
                  <span className="font-bold text-zinc-200">{alreadyCheckedInInfo.cc}</span>
                </div>
                {alreadyCheckedInInfo.categoryName && (
                  <div className="flex justify-between border-b border-zinc-800/60 pb-1.5">
                    <span className="text-zinc-500">Categoría:</span>
                    <span className="font-bold text-zinc-200">{alreadyCheckedInInfo.categoryName}</span>
                  </div>
                )}
                <div className="flex justify-between pt-0.5">
                  <span className="text-zinc-500">Hora de Ingreso:</span>
                  <span className="font-bold text-red-400">
                    {alreadyCheckedInInfo.checkedInAt 
                      ? new Date(alreadyCheckedInInfo.checkedInAt).toLocaleString('es-ES', { 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          second: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }) 
                      : "Fecha no disponible"}
                  </span>
                </div>
                {alreadyCheckedInInfo.checkedInByName && (
                  <div className="flex justify-between border-t border-zinc-800/60 pt-1.5 mt-1.5">
                    <span className="text-zinc-500">Escaneado por:</span>
                    <span className="font-bold text-zinc-300 truncate max-w-[150px] text-right" title={alreadyCheckedInInfo.checkedInByName}>
                      {alreadyCheckedInInfo.checkedInByName}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAlreadyCheckedInInfo(null)
                    if (html5QrCodeRef.current && isScanning) {
                      html5QrCodeRef.current.resume().catch(() => {})
                    }
                  }}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.2)] active:scale-95"
                >
                  Aceptar y Continuar
                </button>
              </div>
            </div>
          </div>
        )}
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

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Entrada & Check-in</h2>
          <p className="text-zinc-500 text-sm hidden sm:block">Control de acceso y escáner QR.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <a
            href="/entrada?mode=scan&fullscreen=true"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-none justify-center text-xs bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white px-3 py-2.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
          >
            <QrCode size={14} /> Abrir Escáner QR
          </a>
          <a
            href={`/api/attendees/export/excel?branchId=${activeBranchId}&eventId=${activeEventId}`}
            download
            className="flex-1 md:flex-none justify-center text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 font-semibold transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
          >
            <Download size={14} /> Exportar CSV
          </a>
          <button
            onClick={() => setShowCashModal(true)}
            className="flex-1 md:flex-none justify-center text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 font-semibold transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
          >
            <Banknote size={14} /> Movimiento Caja
          </button>
          <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-4 py-2.5 rounded-md font-bold text-xs">
            {checkInCount} check-ins hoy
          </div>
        </div>
      </div>

      {/* Tabs Headers */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/20 p-1 rounded-xl max-w-md mb-2">
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
        <button
          onClick={() => {
            setActiveTab("dashboard")
            router.replace("/entrada?mode=dashboard")
          }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "dashboard"
              ? "bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Dashboard
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
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 border-b border-zinc-200 dark:border-zinc-800">
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
                  onBlur={(e) => {
                    setAddForm(prev => ({ ...prev, name: toTitleCase(e.target.value) }))
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-zinc-500 block">Categoría *</label>
                  {session?.user?.permissions?.manageCategories && (
                    <div className="flex items-center gap-2">
                      {addForm.categoryId && (
                        <button
                          type="button"
                          onClick={() => {
                            const selectedCat = categories?.find(c => c.id === addForm.categoryId)
                            if (selectedCat) {
                              setEditingCatId(selectedCat.id)
                              setNewCatForm({
                                name: selectedCat.name,
                                price: selectedCat.price.toString(),
                                includedConsumptions: selectedCat.includedConsumptions || 0,
                                description: selectedCat.description || ""
                              })
                              setNewCatError("")
                              setCallingForm("add")
                              setShowNewCatModal(true)
                            }
                          }}
                          className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Modificar Categoría"
                        >
                          <Edit size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setNewCatForm({ name: "", price: "", includedConsumptions: 0, description: "" })
                          setNewCatError("")
                          setCallingForm("add")
                          setShowNewCatModal(true)
                        }}
                        className="text-primary hover:text-[#39FF14] p-1 rounded hover:bg-primary/10 transition-colors cursor-pointer"
                        title="Nueva Categoría"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>
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

      {activeTab === "dashboard" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {isStatsLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-zinc-550 text-xs font-mono">Cargando estadísticas de entradas...</p>
            </div>
          ) : !stats ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
              No se pudieron cargar las estadísticas.
            </div>
          ) : (
            <>
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono">
                {/* Total Recaudado */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform text-emerald-400">
                    <Banknote size={48} />
                  </div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Ingreso Total</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">
                    ${formatThousands(stats.totalIncome.toString())}
                  </p>
                  <p className="text-[9px] text-zinc-500 mt-2 font-sans">
                    Recaudado acumulado en taquilla
                  </p>
                </div>

                {/* Recaudado Hoy */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform text-indigo-400">
                    <Banknote size={48} />
                  </div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Ingreso de Hoy</p>
                  <p className="text-2xl font-black text-indigo-400 mt-1">
                    ${formatThousands(stats.todayIncome.toString())}
                  </p>
                  <p className="text-[9px] text-zinc-500 mt-2 font-sans flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    Dinero registrado en el día
                  </p>
                </div>

                {/* Total Registrados */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform text-indigo-400">
                    <Users size={48} />
                  </div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Total Registrados</p>
                  <p className="text-2xl font-black text-white mt-1">
                    {stats.totalCount}
                  </p>
                  <p className="text-[9px] text-zinc-500 mt-2 font-sans">
                    Total de asistentes registrados
                  </p>
                </div>

                {/* Check-ins vs Faltantes */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform text-primary">
                    <QrCode size={48} />
                  </div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Ingresados / Faltan</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-primary">{stats.checkedInCount}</span>
                    <span className="text-zinc-500 text-xs">/</span>
                    <span className="text-zinc-400 text-sm font-bold">{stats.pendingCount} pendientes</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div 
                      className="bg-primary h-1.5 rounded-full shadow-[0_0_10px_rgba(57,255,20,0.5)] transition-all duration-500"
                      style={{ width: `${stats.totalCount > 0 ? (stats.checkedInCount / stats.totalCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Category stats section */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg overflow-hidden flex flex-col font-mono">
                <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
                    Desglose por Categoría de Entrada
                  </h3>
                  <span className="text-[10px] text-zinc-500">Actualizado en tiempo real</span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs text-left">
                    <thead>
                      <tr className="bg-zinc-950/50 text-zinc-400 border-b border-zinc-800">
                        <th className="p-4 font-bold uppercase tracking-wider">Categoría</th>
                        <th className="p-4 font-bold uppercase tracking-wider text-right">Precio Unitario</th>
                        <th className="p-4 font-bold uppercase tracking-wider text-center">Registrados</th>
                        <th className="p-4 font-bold uppercase tracking-wider text-center">Ingresados</th>
                        <th className="p-4 font-bold uppercase tracking-wider text-center">Faltantes</th>
                        <th className="p-4 font-bold uppercase tracking-wider">Porcentaje Asistencia</th>
                        <th className="p-4 font-bold uppercase tracking-wider text-right">Recaudado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {stats.categoryStats?.map((cat: any) => {
                        const pct = cat.total > 0 ? Math.round((cat.checkedIn / cat.total) * 100) : 0
                        return (
                          <tr key={cat.id} className="hover:bg-zinc-800/30 transition-colors border-b border-zinc-800/40">
                            <td className="p-4 font-bold text-white text-sm">{cat.name}</td>
                            <td className="p-4 text-right text-zinc-300 font-bold">
                              {cat.price > 0 ? `$${formatThousands(cat.price.toString())}` : "Gratis"}
                            </td>
                            <td className="p-4 text-center text-white font-bold">{cat.total}</td>
                            <td className="p-4 text-center text-primary font-bold">{cat.checkedIn}</td>
                            <td className="p-4 text-center text-zinc-400 font-bold">{cat.pending}</td>
                            <td className="p-4 min-w-[160px]">
                              <div className="flex items-center gap-3">
                                <span className="w-8 text-right font-bold text-zinc-300">{pct}%</span>
                                <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden max-w-[100px]">
                                  <div 
                                    className="bg-primary h-2 rounded-full shadow-[0_0_5px_rgba(57,255,20,0.3)] transition-all duration-300"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right font-black text-emerald-400 text-sm">
                              ${formatThousands(cat.income.toString())}
                            </td>
                          </tr>
                        )
                      })}
                      {stats.categoryStats?.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-zinc-500 italic">
                            No hay categorías creadas para esta sucursal.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* CASH MOVEMENT MODAL */}
      {showCashModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
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
                  onBlur={(e) => {
                    setEditForm(prev => ({ ...prev, name: toTitleCase(e.target.value) }))
                  }}
                  className={`w-full px-3 py-2 border rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
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
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-zinc-500 block">Categoría *</label>
                    {session?.user?.permissions?.manageCategories && (
                      <div className="flex items-center gap-2">
                        {editForm.categoryId && (
                          <button
                            type="button"
                            onClick={() => {
                              const selectedCat = categories?.find(c => c.id === editForm.categoryId)
                              if (selectedCat) {
                                setEditingCatId(selectedCat.id)
                                setNewCatForm({
                                  name: selectedCat.name,
                                  price: selectedCat.price.toString(),
                                  includedConsumptions: selectedCat.includedConsumptions || 0,
                                  description: selectedCat.description || ""
                                })
                                setNewCatError("")
                                setCallingForm("edit")
                                setShowNewCatModal(true)
                              }
                            }}
                            className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Modificar Categoría"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setNewCatForm({ name: "", price: "", includedConsumptions: 0, description: "" })
                            setNewCatError("")
                            setCallingForm("edit")
                            setShowNewCatModal(true)
                          }}
                          className="text-primary hover:text-[#39FF14] p-1 rounded hover:bg-primary/10 transition-colors cursor-pointer"
                          title="Nueva Categoría"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
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

      {/* NEW CATEGORY MODAL */}
      {showNewCatModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Plus className="text-primary" /> {editingCatId ? "Modificar Categoría" : "Nueva Categoría"}
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setShowNewCatModal(false)
                  setEditingCatId(null)
                }} 
                className="text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {newCatError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <ShieldAlert size={16} /> {newCatError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!newCatForm.name.trim()) {
                  setNewCatError("El nombre de la categoría es obligatorio.")
                  return
                }
                if (!newCatForm.price.trim()) {
                  setNewCatError("El precio de la categoría es obligatorio.")
                  return
                }
                if (editingCatId) {
                  updateCategoryMutation.mutate({ id: editingCatId, data: newCatForm })
                } else {
                  createCategoryMutation.mutate(newCatForm)
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Nombre de la Categoría *</label>
                <input
                  type="text"
                  placeholder="Ej: VIP, General, Invitado"
                  value={newCatForm.name}
                  onChange={(e) => setNewCatForm({ ...newCatForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Precio ($) *</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={newCatForm.price}
                    onChange={(e) => setNewCatForm({ ...newCatForm, price: formatThousands(e.target.value) })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Consumos Incluidos</label>
                  <input
                    type="number"
                    min="0"
                    value={newCatForm.includedConsumptions}
                    onChange={(e) => setNewCatForm({ ...newCatForm, includedConsumptions: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Descripción (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Ej: Incluye acceso a zona VIP y 2 bebidas"
                  value={newCatForm.description}
                  onChange={(e) => setNewCatForm({ ...newCatForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                />
              </div>

              <div className="flex gap-3 justify-end border-t pt-4 border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCatModal(false)
                    setEditingCatId(null)
                  }}
                  className="px-4 py-2 border border-zinc-800 rounded-md text-xs font-bold uppercase tracking-wider text-zinc-400 hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-black border border-primary/20 rounded-md text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(57,255,20,0.2)]"
                >
                  {editingCatId 
                    ? (updateCategoryMutation.isPending ? "Guardando..." : "Guardar Cambios") 
                    : (createCategoryMutation.isPending ? "Creando..." : "Crear Categoría")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALREADY CHECKED IN WARNING MODAL (LOCKED) */}
      {alreadyCheckedInInfo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200">
          <div className="bg-zinc-950 border-2 border-red-500 rounded-xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(239,68,68,0.3)] space-y-4 font-mono text-center text-white relative">
            <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-500 flex items-center justify-center mx-auto text-red-500 animate-bounce">
              <ShieldAlert size={36} />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black tracking-widest text-red-500 uppercase">
                ¡Advertencia!
              </h3>
              <p className="text-sm font-bold text-zinc-100">
                El asistente ya ingresó al evento
              </p>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-zinc-800/60 pb-1.5">
                <span className="text-zinc-500">Asistente:</span>
                <span className="font-bold text-zinc-200">{alreadyCheckedInInfo.name}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-1.5">
                <span className="text-zinc-500">Documento:</span>
                <span className="font-bold text-zinc-200">{alreadyCheckedInInfo.cc}</span>
              </div>
              {alreadyCheckedInInfo.categoryName && (
                <div className="flex justify-between border-b border-zinc-800/60 pb-1.5">
                  <span className="text-zinc-500">Categoría:</span>
                  <span className="font-bold text-zinc-200">{alreadyCheckedInInfo.categoryName}</span>
                </div>
              )}
              <div className="flex justify-between pt-0.5">
                <span className="text-zinc-500">Hora de Ingreso:</span>
                <span className="font-bold text-red-400">
                  {alreadyCheckedInInfo.checkedInAt 
                    ? new Date(alreadyCheckedInInfo.checkedInAt).toLocaleString('es-ES', { 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      }) 
                    : "Fecha no disponible"}
                </span>
              </div>
              {alreadyCheckedInInfo.checkedInByName && (
                <div className="flex justify-between border-t border-zinc-800/60 pt-1.5 mt-1.5">
                  <span className="text-zinc-500">Escaneado por:</span>
                  <span className="font-bold text-zinc-300 truncate max-w-[150px] text-right" title={alreadyCheckedInInfo.checkedInByName}>
                    {alreadyCheckedInInfo.checkedInByName}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setAlreadyCheckedInInfo(null)
                  if (html5QrCodeRef.current && isScanning) {
                    html5QrCodeRef.current.resume().catch(() => {})
                  }
                }}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.2)] active:scale-95"
              >
                Aceptar y Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
