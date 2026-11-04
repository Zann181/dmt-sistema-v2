"use client"

import { Suspense, useState, useEffect, useEffectEvent, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useCheckInStream } from "@/components/features/attendees/useCheckInStream"
import { useContextStore } from "@/stores/contextStore"
import { Users, QrCode, Search, Ticket, Banknote, ShieldAlert, X, Download, UserPlus, Edit, Trash2, Mail, Plus, FileSpreadsheet, AlertTriangle, Upload as UploadIcon, CheckCircle2, Tag, SlidersHorizontal, Rows3, BarChart3, UserX, RotateCcw, MoreHorizontal, CloudDownload, WifiOff, Loader2 } from "lucide-react"
import type { Dispatch, SetStateAction, ReactNode, RefObject } from "react"
import type { UseMutationResult } from "@tanstack/react-query"

// Icono personalizado de WhatsApp de alta calidad para el estilo premium
const WhatsAppIcon = ({ size = 14 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className="inline-block">
    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.333 4.982L2 22l5.233-1.371a9.936 9.936 0 004.779 1.229h.004c5.505 0 9.989-4.478 9.99-9.984 0-2.67-1.037-5.178-2.92-7.062C17.182 2.928 14.677 2 12.012 2zm5.727 14.18c-.25.703-1.442 1.34-1.99 1.411-.478.062-.972.107-2.65-.588-2.146-.888-3.528-3.064-3.635-3.207-.107-.143-.872-1.16-.872-2.215 0-1.056.554-1.572.75-1.782.197-.21.428-.263.571-.263.143 0 .285.002.41.008.13.006.303-.048.473.362.175.422.598 1.458.649 1.564.052.106.086.23.013.376-.072.146-.108.238-.218.365-.11.127-.23.284-.329.38-.11.107-.225.223-.097.443.128.22.57 1.01.122 1.512.71 1.258 1.31 1.65 1.503 1.747.193.097.306.08.42-.05.114-.13.498-.58.63-.777.13-.197.26-.164.44-.098.18.066 1.144.538 1.341.637.197.098.328.147.377.23.05.084.05.485-.2.1.188z" />
  </svg>
)
import { toast } from "sonner"
import { getSnapshot, listPending, saveSnapshot, syncPending, offlineCheckIn, isNetworkError } from "@/lib/offlineCheckin"
import { formatThousands, parseThousands } from "@/shared/utils/price"
import type { QueryClient } from "@tanstack/react-query"

const toTitleCase = (str: string): string => {
  if (!str) return ""
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

type ImportRow = { rowNumber: number; name: string; cc: string; email: string; phone: string }

export default function EntradaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-emerald-500">
          <Loader2 size={24} className="animate-spin" />
        </div>
      }
    >
      <EntradaContent />
    </Suspense>
  )
}

function EntradaContent() {
  const { activeBranchId, activeBranchName, activeEventId, activeEventName } = useContextStore()
  const { isConnected, checkInCount } = useCheckInStream({ branchId: activeBranchId, eventId: activeEventId })
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Search states
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategoryId, setFilterCategoryId] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "checked" | "pending" | "inactive">("all")
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

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
  const endNotificationDrag = () => {
    setIsDragging(false)
    if (dragX > 100) setNotification(null)
    setDragX(0)
  }
  const { showDayEntryModal, setShowDayEntryModal, dayEntryForm, setDayEntryForm, dayEntryError, setDayEntryError, addForm, setAddForm, addError, setAddError, addFormErrors, setAddFormErrors, editingAttendee, setEditingAttendee, editForm, setEditForm, editError, setEditError, editFormErrors, setEditFormErrors } = useAttendeeForms({  })

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

  // Preselecciona la categoría "Día" en Ingreso Día apenas cargan las categorías
  useEffect(() => {
    const diaCategory = categories?.find((c: any) => c.name.trim().toLowerCase() === "día" || c.name.trim().toLowerCase() === "dia")
    if (diaCategory) {
      setDayEntryForm(prev => prev.categoryId ? prev : { ...prev, categoryId: diaCategory.id, unitAmount: formatThousands(diaCategory.price.toString()) })
    }
  }, [categories, setDayEntryForm])

  const handleDayEntryCategoryChange = (catId: string) => {
    const selectedCat = categories?.find((c: any) => c.id === catId)
    setDayEntryForm(prev => ({
      ...prev,
      categoryId: catId,
      unitAmount: selectedCat ? formatThousands(selectedCat.price.toString()) : prev.unitAmount
    }))
  }

  // Get current session for permission checks
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session")
      if (!res.ok) return null
      return await res.json()
    }
  })

  // Solo el super admin ve y reactiva a los asistentes inactivos ("eliminados")
  const isSuper = !!session?.user?.isSuperuser
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Already Checked In Warning state
  const [alreadyCheckedInInfo, setAlreadyCheckedInInfo] = useState<any | null>(null)
  // Successful Check-in Info state (invasive confirmation modal)
  const [successCheckInInfo, setSuccessCheckInInfo] = useState<any | null>(null)

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
  const { createCategoryMutation } = useCategoryMutations({ newCatForm, activeBranchId, queryClient, activeEventId, callingForm, setAddForm, setAddFormErrors, setEditForm, setEditFormErrors, setShowNewCatModal, setNewCatForm, setNewCatError })
  const { updateCategoryMutation } = useUpdateCategory({ newCatForm, queryClient, activeBranchId, activeEventId, callingForm, setAddForm, setEditForm, setShowNewCatModal, setEditingCatId, setNewCatForm, setNewCatError })

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
  const { handleWhatsAppShare } = useWhatsAppShare({ activeEvent, activeEventName, activeBranchName })
  const { isLoading, attendees, attendeesTotal, totalPages, stats, isStatsLoading } = useAttendeeData({ activeBranchId, activeEventId, searchQuery, filterCategoryId, filterStatus, page, pageSize, activeTab })
  const { drainEmailQueue, resendEmailMutation, confirmManualDeliveryMutation } = useEmailQueue({ activeBranchId, activeEventId, queryClient })
  const { addAttendeeMutation } = useAddAttendee({ addForm, activeBranchId, activeEventId, setAddForm, setAddError, setAddFormErrors, drainEmailQueue, queryClient })
  const { showImportModal, setShowImportModal, importRows, importCategoryId, setImportCategoryId, importFileName, importParsing, importResult, sortedImportRows, handleImportFile, importMutation, closeImportModal } = useAttendeeImport({ activeBranchId, activeEventId, drainEmailQueue, queryClient })

  const handleCategoryChange = (catId: string) => {
    const selectedCat = categories?.find((c: any) => c.id === catId)
    setAddForm(prev => ({
      ...prev,
      categoryId: catId,
      paidAmount: selectedCat ? formatThousands(selectedCat.price.toString()) : ""
    }))
  }
  const { startEditing, handleEditCategoryChange, editAttendeeMutation, reactivateAttendeeMutation, handleDeleteAttendee } = useAttendeeEditing({ setEditingAttendee, setEditForm, setEditError, setEditFormErrors, categories, editForm, editingAttendee, queryClient, activeBranchId, activeEventId })
  const { offlineSavedAt, offlineCount, pendingCount, isOnline, savingOffline, refreshOfflineState, flushPending, saveForOffline } = useOfflineMode({ activeEventId, queryClient, activeBranchId })
  const { isScanning, setIsScanning, html5QrCodeRef, isScanTabActiveRef, isStartingRef, CHECKIN_COOLDOWN_MS, lastCheckInRef, openDayEntryFromScanner, closeDayEntryModal } = useScannerSession({ setShowDayEntryModal, setDayEntryError })
  const { checkInMutation } = useCheckIn({ activeEventId, refreshOfflineState, lastCheckInRef, queryClient, activeBranchId, setSuccessCheckInInfo, setAlreadyCheckedInInfo, setNotification })
  const { registerDayEntryMutation } = useDayEntryMutation({ dayEntryForm, activeBranchId, activeEventId, closeDayEntryModal, setDayEntryForm, queryClient, setDayEntryError })
  const { startScanning, stopScanning } = useScannerControls({ isScanTabActiveRef, isStartingRef, html5QrCodeRef, setIsScanning, lastCheckInRef, CHECKIN_COOLDOWN_MS, checkInMutation, activeTab, activeBranchId, activeEventId })

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 7000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // El modal de check-in exitoso ya NO se cierra solo: se queda hasta que el
  // usuario toque "Continuar Escaneando" (antes duraba 2.5s y no daba tiempo a leer).

  // Búsqueda en vivo: espera una pausa corta al escribir antes de disparar la query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Tarjeta del formulario de Ingreso Día. En el dashboard normal se envuelve en un
  // modal emergente; en el escáner de pantalla completa se incrusta directo en la
  // pantalla (reemplazando la cámara) para cambiar de una a otra sin salir del QR.
  const dayEntryCard = showDayEntryModal && (
      <DayEntryCard closeDayEntryModal={closeDayEntryModal} dayEntryError={dayEntryError} dayEntryForm={dayEntryForm} setDayEntryError={setDayEntryError} registerDayEntryMutation={registerDayEntryMutation} handleDayEntryCategoryChange={handleDayEntryCategoryChange} categories={categories} setDayEntryForm={setDayEntryForm} />
  )

  // Versión modal (dashboard normal): la tarjeta con fondo oscurecido detrás.
  const dayEntryModal = showDayEntryModal && (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200">
      {dayEntryCard}
    </div>
  )

  const goTab = (t: "scan" | "search" | "add" | "dashboard") => {
    setActiveTab(t)
    router.replace(`/entrada?mode=${t}`)
  }

  const isFullscreen = searchParams.get("fullscreen") === "true"

  if (!activeBranchId || !activeEventId) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-center max-w-md mx-auto space-y-4">
        <ShieldAlert size={48} className="text-amber-500 animate-bounce" />
        <h2 className="text-xl font-bold">Contexto Incompleto</h2>
        <p className="text-emerald-500 text-sm">
          Por favor selecciona una sucursal y un evento activo en el menú antes de gestionar las entradas.
        </p>
      </div>
    )
  }

  if (activeTab === "scan" && isFullscreen) {
    return (
      <FullscreenScanner notification={notification} setNotification={setNotification} showDayEntryModal={showDayEntryModal} closeDayEntryModal={closeDayEntryModal} openDayEntryFromScanner={openDayEntryFromScanner} activeEventName={activeEventName} isScanning={isScanning} dayEntryCard={dayEntryCard} checkInCount={checkInCount} startScanning={startScanning} stopScanning={stopScanning} alreadyCheckedInInfo={alreadyCheckedInInfo} setAlreadyCheckedInInfo={setAlreadyCheckedInInfo} html5QrCodeRef={html5QrCodeRef} successCheckInInfo={successCheckInInfo} setSuccessCheckInInfo={setSuccessCheckInInfo} />
    )
  }

  return (
    <div className="space-y-3 md:space-y-6 relative pb-14 md:pb-0">
      {/* Floating Swipeable Notification */}
      <NotificationToast notification={notification} dragX={dragX} isDragging={isDragging} setIsDragging={setIsDragging} startX={startX} setDragX={setDragX} endNotificationDrag={endNotificationDrag} setNotification={setNotification} />

      {/* Header: título + acciones. En móvil solo título, contador y exportar;
          el resto de acciones viven en la barra inferior. */}
      <EntradaHeader checkInCount={checkInCount} saveForOffline={saveForOffline} savingOffline={savingOffline} offlineSavedAt={offlineSavedAt} offlineCount={offlineCount} pendingCount={pendingCount} activeBranchId={activeBranchId} activeEventId={activeEventId} goTab={goTab} setShowDayEntryModal={setShowDayEntryModal} />

      {/* Tabs (PC): control segmentado */}
      <div className="hidden md:flex border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/20 p-1 rounded-xl max-w-lg" role="tablist">
        {([
          { id: "search", label: "Búsqueda Manual", icon: <Users size={16} /> },
          { id: "add", label: "Agregar Asistente", icon: <UserPlus size={16} /> },
          { id: "dashboard", label: "Dashboard", icon: <BarChart3 size={16} /> },
        ] as const).map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => goTab(t.id)}
            className={`flex-1 h-9 px-3 text-[13px] font-bold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === t.id
                ? "bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm"
                : "text-emerald-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Barra inferior (móvil): 2 pestañas · QR al centro · 2 pestañas */}
      <BottomTabBar activeTab={activeTab} goTab={goTab} setShowDayEntryModal={setShowDayEntryModal} />

      {/* Escáner incrustado: se queda en esta página con la barra inferior visible */}
      <ScanTab activeTab={activeTab} isScanning={isScanning} isOnline={isOnline} startScanning={startScanning} activeEventName={activeEventName} />

      {/* Estado sin internet: aviso cuando no hay red o hay check-ins por enviar */}
      <OfflineStatusBar isOnline={isOnline} pendingCount={pendingCount} offlineSavedAt={offlineSavedAt} flushPending={flushPending} />

      <SearchTab activeTab={activeTab} searchInput={searchInput} setSearchInput={setSearchInput} filterCategoryId={filterCategoryId} setFilterCategoryId={setFilterCategoryId} setPage={setPage} categories={categories} filterStatus={filterStatus} setFilterStatus={setFilterStatus} isSuper={isSuper} isLoading={isLoading} attendees={attendees} expandedId={expandedId} reactivateAttendeeMutation={reactivateAttendeeMutation} checkInMutation={checkInMutation} setExpandedId={setExpandedId} handleWhatsAppShare={handleWhatsAppShare} resendEmailMutation={resendEmailMutation} confirmManualDeliveryMutation={confirmManualDeliveryMutation} startEditing={startEditing} handleDeleteAttendee={handleDeleteAttendee} attendeesTotal={attendeesTotal} page={page} pageSize={pageSize} setPageSize={setPageSize} totalPages={totalPages} />

      <AddAttendeeTab activeTab={activeTab} setShowImportModal={setShowImportModal} addError={addError} addForm={addForm} setAddFormErrors={setAddFormErrors} setAddError={setAddError} attendees={attendees} addAttendeeMutation={addAttendeeMutation} setAddForm={setAddForm} addFormErrors={addFormErrors} session={session} categories={categories} setEditingCatId={setEditingCatId} setNewCatForm={setNewCatForm} setNewCatError={setNewCatError} setCallingForm={setCallingForm} setShowNewCatModal={setShowNewCatModal} handleCategoryChange={handleCategoryChange} setActiveTab={setActiveTab} router={router} />

      <StatsTab activeTab={activeTab} isStatsLoading={isStatsLoading} stats={stats} />

      {/* CASH MOVEMENT MODAL */}
      <ImportModal showImportModal={showImportModal} closeImportModal={closeImportModal} handleImportFile={handleImportFile} importCategoryId={importCategoryId} setImportCategoryId={setImportCategoryId} categories={categories} importParsing={importParsing} importRows={importRows} importFileName={importFileName} sortedImportRows={sortedImportRows} importResult={importResult} importMutation={importMutation} />

      {dayEntryModal}

      {/* EDIT ATTENDEE MODAL */}
      <EditAttendeeModal editingAttendee={editingAttendee} setEditingAttendee={setEditingAttendee} editError={editError} editForm={editForm} setEditFormErrors={setEditFormErrors} setEditError={setEditError} editAttendeeMutation={editAttendeeMutation} setEditForm={setEditForm} editFormErrors={editFormErrors} session={session} categories={categories} setEditingCatId={setEditingCatId} setNewCatForm={setNewCatForm} setNewCatError={setNewCatError} setCallingForm={setCallingForm} setShowNewCatModal={setShowNewCatModal} handleEditCategoryChange={handleEditCategoryChange} />

      {/* NEW CATEGORY MODAL */}
      <CategoryModal showNewCatModal={showNewCatModal} editingCatId={editingCatId} setShowNewCatModal={setShowNewCatModal} setEditingCatId={setEditingCatId} newCatError={newCatError} newCatForm={newCatForm} setNewCatError={setNewCatError} updateCategoryMutation={updateCategoryMutation} createCategoryMutation={createCategoryMutation} setNewCatForm={setNewCatForm} />

      {/* ALREADY CHECKED IN WARNING MODAL (LOCKED) */}
      <AlreadyCheckedInModal alreadyCheckedInInfo={alreadyCheckedInInfo} setAlreadyCheckedInInfo={setAlreadyCheckedInInfo} html5QrCodeRef={html5QrCodeRef} isScanning={isScanning} />

      {/* SUCCESSFUL CHECK-IN CONFIRMATION MODAL */}
      <CheckInSuccessModal successCheckInInfo={successCheckInInfo} setSuccessCheckInInfo={setSuccessCheckInInfo} html5QrCodeRef={html5QrCodeRef} isScanning={isScanning} />
    </div>
  )
}

function OfflineStatusBar({ isOnline, pendingCount, offlineSavedAt, flushPending }: { isOnline: boolean; pendingCount: number; offlineSavedAt: unknown; flushPending: () => void }) {
  if (isOnline && pendingCount === 0) return null

  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400 px-3 py-2 text-xs font-semibold">
      <WifiOff size={14} className="shrink-0" />
      <span className="flex-1 min-w-0">
        {!isOnline ? "Sin internet" : "Conectado"}
        {pendingCount > 0 && ` · ${pendingCount} check-in${pendingCount === 1 ? "" : "s"} por enviar`}
        {!isOnline && !offlineSavedAt && " · lista no guardada"}
      </span>
      {isOnline && pendingCount > 0 && (
        <button onClick={flushPending} className="underline cursor-pointer shrink-0">Enviar ahora</button>
      )}
    </div>
  )
}

function DayEntryCard({ closeDayEntryModal, dayEntryError, dayEntryForm, setDayEntryError, registerDayEntryMutation, handleDayEntryCategoryChange, categories, setDayEntryForm }: { closeDayEntryModal: () => void; dayEntryError: string; dayEntryForm: { categoryId: string; quantity: string; unitAmount: string; method: "CASH" | "TRANSFER" | "QR" | "CARD"; }; setDayEntryError: Dispatch<SetStateAction<string>>; registerDayEntryMutation: UseMutationResult<any, any, any, any>; handleDayEntryCategoryChange: (catId: string) => void; categories: NoInfer<any[]> | undefined; setDayEntryForm: Dispatch<SetStateAction<any>> }) {
  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Ticket className="text-indigo-650 dark:text-indigo-400" /> Ingreso Día
          </h3>
          <button aria-label="Cerrar" onClick={closeDayEntryModal} className="text-emerald-500 hover:text-zinc-655 dark:hover:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-emerald-500 -mt-2">
          Registra en bloque personas que entraron pagando en puerta, sin pedir nombre ni cédula.
        </p>

        {dayEntryError && (
          <div className="p-3 bg-red-50 dark:bg-red-955/20 text-red-655 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
            <ShieldAlert size={16} /> {dayEntryError}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!dayEntryForm.categoryId) {
              setDayEntryError("Selecciona una categoría")
              return
            }
            registerDayEntryMutation.mutate(dayEntryForm)
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="entrada-categoria" className="text-xs font-semibold text-emerald-500 block mb-1">Categoría</label>
            <select id="entrada-categoria"
              value={dayEntryForm.categoryId}
              onChange={(e) => handleDayEntryCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              required
            >
              <option value="">Selecciona una categoría</option>
              {categories?.map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="entrada-personas" className="text-xs font-semibold text-emerald-500 block mb-1">Personas</label>
              <input id="entrada-personas"
                type="number"
                min={1}
                max={500}
                placeholder="1"
                value={dayEntryForm.quantity}
                onChange={(e) => setDayEntryForm({ ...dayEntryForm, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                required
              />
            </div>

            <div>
              <label htmlFor="entrada-valor-c-u" className="text-xs font-semibold text-emerald-500 block mb-1">Valor c/u ($)</label>
              <input id="entrada-valor-c-u"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={dayEntryForm.unitAmount}
                onChange={(e) => setDayEntryForm({ ...dayEntryForm, unitAmount: formatThousands(e.target.value) })}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                required
              />
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-emerald-500 block mb-1">Método de Pago</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDayEntryForm({ ...dayEntryForm, method: "CASH" })}
                className={`py-2 rounded-md border font-semibold text-sm transition-colors ${
                  dayEntryForm.method === "CASH"
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Efectivo
              </button>
              <button
                type="button"
                onClick={() => setDayEntryForm({ ...dayEntryForm, method: "QR" })}
                className={`py-2 rounded-md border font-semibold text-sm transition-colors ${
                  dayEntryForm.method === "QR"
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Código QR
              </button>
            </div>
          </div>

          <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 rounded-md px-3 py-2">
            Total: ${formatThousands(((Number(dayEntryForm.quantity) || 0) * (Number(parseThousands(dayEntryForm.unitAmount)) || 0)).toString())}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end w-full border-t pt-4 border-zinc-200 dark:border-zinc-800">
            <button type="button" onClick={closeDayEntryModal} className="px-4 py-2 border w-full sm:w-auto justify-center border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md font-semibold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={registerDayEntryMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
            >
              {registerDayEntryMutation.isPending ? "Registrando..." : "Registrar"}
            </button>
          </div>
        </form>
      </div>
  )
}

function FullscreenScanner({ notification, setNotification, showDayEntryModal, closeDayEntryModal, openDayEntryFromScanner, activeEventName, isScanning, dayEntryCard, checkInCount, startScanning, stopScanning, alreadyCheckedInInfo, setAlreadyCheckedInInfo, html5QrCodeRef, successCheckInInfo, setSuccessCheckInInfo }: { notification: { type: "success" | "error"; message: string; subMessage?: string; } | null; setNotification: Dispatch<SetStateAction<any>>; showDayEntryModal: boolean; closeDayEntryModal: () => void; openDayEntryFromScanner: () => void; activeEventName: string | null; isScanning: boolean; dayEntryCard: false | ReactNode; checkInCount: number; startScanning: () => Promise<void>; stopScanning: () => Promise<void>; alreadyCheckedInInfo: any; setAlreadyCheckedInInfo: Dispatch<any>; html5QrCodeRef: RefObject<any>; successCheckInInfo: any; setSuccessCheckInInfo: Dispatch<any> }) {
  return (
    <div
        className="fixed inset-0 bg-black z-[9999] flex flex-col items-center overflow-y-auto px-4 animate-in fade-in duration-200 select-none"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))"
        }}
      >
        {/* Floating Swipeable Notification */}
        {notification && (
          <div
            className="fixed left-1/2 -translate-x-1/2 z-[10000] w-full max-w-sm bg-zinc-900 border rounded-xl p-4 shadow-2xl border-zinc-800"
            style={{ top: "max(1rem, env(safe-area-inset-top))" }}
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
                  <p className="text-xs text-emerald-500 mt-0.5 whitespace-pre-wrap">{notification.subMessage}</p>
                )}
              </div>
              <button aria-label="Cerrar notificación" 
                onClick={() => setNotification(null)}
                className="text-emerald-500 hover:text-zinc-350 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center space-y-6 py-4">
          {/* Toggle deslizable arriba de todo: cambia a Ingreso Día incrustado en la
              misma pantalla (sin popup) y sin salir del escáner (la cámara solo se pausa) */}
          <div className="relative w-full flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <div
              className="absolute top-1 bottom-1 w-1/2 rounded-lg bg-indigo-600 transition-transform duration-300 ease-out"
              style={{ transform: showDayEntryModal ? "translateX(100%)" : "translateX(0%)" }}
            />
            <button
              type="button"
              onClick={closeDayEntryModal}
              className={`relative z-10 flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${!showDayEntryModal ? "text-white" : "text-emerald-500"}`}
            >
              <QrCode size={14} /> Escanear
            </button>
            <button
              type="button"
              onClick={openDayEntryFromScanner}
              className={`relative z-10 flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${showDayEntryModal ? "text-white" : "text-emerald-500"}`}
            >
              <Ticket size={14} /> Ingreso Día
            </button>
          </div>

          {!showDayEntryModal && (
            <div className="text-center space-y-1 w-full">
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
                <QrCode size={20} className="text-indigo-400 animate-pulse" />
                Escáner de Entradas
              </h2>
              <p className="text-xs text-emerald-500">{activeEventName}</p>
            </div>
          )}

          {/* El escáner nunca se desmonta (el html5-qrcode necesita el nodo #reader vivo);
              solo se oculta con CSS mientras se ve Ingreso Día. */}
          <div className={`relative w-full aspect-square rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center shadow-2xl ${showDayEntryModal ? "hidden" : ""}`}>
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

          {showDayEntryModal && dayEntryCard}

          {!showDayEntryModal && (
          <div className="flex items-center justify-end w-full px-2 text-emerald-500 text-xs">
            <div className="bg-indigo-950/40 text-indigo-400 px-3 py-1.5 rounded-lg font-bold">
              {checkInCount} check-ins
            </div>
          </div>
          )}

          {!showDayEntryModal && (isScanning ? (
            <p className="text-xs text-emerald-500 flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              Apunta al código QR para registrar la entrada
            </p>
          ) : (
            <button 
              onClick={startScanning}
              className="bg-indigo-600 hover:bg-indigo-750 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-[background-color,scale] shadow-sm active:scale-95 cursor-pointer z-20 relative"
            >
              Reintentar Cámara
            </button>
          ))}

          <button
            onClick={() => {
              stopScanning()
              window.close()
            }}
            className="text-xs text-emerald-500 hover:text-white border border-zinc-800 hover:bg-zinc-900 px-4 py-2 rounded-lg transition-colors mt-4"
          >
            Cerrar Escáner
          </button>
        </div>

        {/* ALREADY CHECKED IN WARNING MODAL (LOCKED) */}
        <AlreadyCheckedInModal alreadyCheckedInInfo={alreadyCheckedInInfo} setAlreadyCheckedInInfo={setAlreadyCheckedInInfo} html5QrCodeRef={html5QrCodeRef} isScanning={isScanning} />

        {/* SUCCESSFUL CHECK-IN CONFIRMATION MODAL */}
        <CheckInSuccessModal successCheckInInfo={successCheckInInfo} setSuccessCheckInInfo={setSuccessCheckInInfo} html5QrCodeRef={html5QrCodeRef} isScanning={isScanning} />
      </div>
  )
}

function NotificationToast({ notification, dragX, isDragging, setIsDragging, startX, setDragX, endNotificationDrag, setNotification }: { notification: { type: "success" | "error"; message: string; subMessage?: string; } | null; dragX: number; isDragging: boolean; setIsDragging: Dispatch<SetStateAction<boolean>>; startX: RefObject<number>; setDragX: Dispatch<SetStateAction<number>>; endNotificationDrag: () => void; setNotification: Dispatch<SetStateAction<any>> }) {
  return (
    <>{notification && (
        <div
          role="status"
          className={`fixed top-4 right-4 z-[9999] w-full max-w-sm bg-white dark:bg-zinc-900 border rounded-xl p-4 shadow-xl select-none touch-pan-y cursor-grab active:cursor-grabbing ${
            notification.type === "success" 
              ? "border-green-200 dark:border-green-900/40" 
              : "border-red-200 dark:border-red-900/40"
          }`}
          style={{
            transform: dragX > 0 ? `translateX(${dragX}px)` : "none",
            opacity: dragX > 0 ? Math.max(0, 1 - dragX / 250) : 1,
            transition: isDragging ? "none" : "transform 0.2s ease, opacity 0.2s ease"
          }}
          onPointerDown={(e) => {
            // El swipe es para la tarjeta; la X se opera con su propio click/teclado
            if ((e.target as HTMLElement).closest("button")) return
            e.currentTarget.setPointerCapture(e.pointerId)
            setIsDragging(true)
            startX.current = e.clientX
          }}
          onPointerMove={(e) => {
            if (!isDragging) return
            const diff = e.clientX - startX.current
            if (diff > 0) setDragX(diff)
          }}
          onPointerUp={endNotificationDrag}
          onPointerCancel={endNotificationDrag}
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
              <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{notification.message}</p>
              {notification.subMessage && (
                <p className="text-xs text-emerald-500 dark:text-emerald-500 mt-0.5 whitespace-pre-wrap">{notification.subMessage}</p>
              )}
            </div>
            <button aria-label="Cerrar notificación" 
              onClick={() => setNotification(null)}
              className="text-emerald-500 hover:text-zinc-650 dark:hover:text-zinc-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 pointer-events-none opacity-50" />
        </div>
      )}</>
  )
}

function EntradaHeader({ checkInCount, saveForOffline, savingOffline, offlineSavedAt, offlineCount, pendingCount, activeBranchId, activeEventId, goTab, setShowDayEntryModal }: { checkInCount: number; saveForOffline: () => Promise<void>; savingOffline: boolean; offlineSavedAt: string | null; offlineCount: number; pendingCount: number; activeBranchId: string; activeEventId: string; goTab: (t: "scan" | "search" | "add" | "dashboard") => void; setShowDayEntryModal: Dispatch<SetStateAction<boolean>> }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-3 md:flex-1 md:min-w-0">
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-bold tracking-tight leading-tight md:truncate">Entrada & Check-in</h2>
            <p className="text-emerald-500 text-xs hidden sm:block">Control de acceso y escáner QR.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 md:hidden">
            <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 h-9 flex items-center rounded-full font-bold text-xs whitespace-nowrap">
              {checkInCount} hoy
            </div>
            <button
              type="button"
              onClick={saveForOffline}
              disabled={savingOffline}
              aria-label="Guardar para usar sin internet"
              title={offlineSavedAt ? `Guardado: ${offlineCount} asistentes` : "Guardar para usar sin internet"}
              className={`relative h-9 w-9 flex items-center justify-center rounded-full border active:scale-95 transition cursor-pointer ${
                offlineSavedAt
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {savingOffline ? <Loader2 size={16} className="animate-spin" /> : <CloudDownload size={16} />}
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">{pendingCount}</span>
              )}
            </button>
            <a
              href={`/api/attendees/export/excel?branchId=${activeBranchId}&eventId=${activeEventId}`}
              download
              aria-label="Exportar CSV"
              className="h-9 w-9 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 active:scale-95 transition"
            >
              <Download size={16} />
            </a>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => goTab("scan")}
            title="Abrir Escáner QR"
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-black px-3 rounded-lg font-bold transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
          >
            <QrCode size={14} /> Escáner
          </button>
          <button
            type="button"
            onClick={saveForOffline}
            disabled={savingOffline}
            title={offlineSavedAt ? `Guardado offline: ${offlineCount} asistentes (${new Date(offlineSavedAt).toLocaleString("es-CO", { timeZone: process.env.NEXT_PUBLIC_TIMEZONE || 'America/Bogota' })})` : "Guardar para usar sin internet"}
            className="h-8 text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 font-semibold transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            {savingOffline ? <Loader2 size={14} className="animate-spin" /> : <CloudDownload size={14} />}
            {offlineSavedAt ? "Offline ✓" : "Offline"}
            {pendingCount > 0 && <span className="bg-amber-500 text-black text-xs font-bold rounded-full px-1.5">{pendingCount}</span>}
          </button>
          <a
            href={`/api/attendees/export/excel?branchId=${activeBranchId}&eventId=${activeEventId}`}
            download
            title="Exportar CSV"
            className="h-8 text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 font-semibold transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
          >
            <Download size={14} /> CSV
          </a>
          <button
            onClick={() => setShowDayEntryModal(true)}
            title="Ingreso Día"
            className="h-8 text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 font-semibold transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
          >
            <Ticket size={14} /> Día
          </button>
        </div>
      </div>
  )
}

function BottomTabBar({ activeTab, goTab, setShowDayEntryModal }: { activeTab: "search" | "scan" | "add" | "dashboard"; goTab: (t: "scan" | "search" | "add" | "dashboard") => void; setShowDayEntryModal: Dispatch<SetStateAction<boolean>> }) {
  return (
    <nav
        aria-label="Entrada"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-zinc-200 dark:border-zinc-800 bg-background/90 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5 items-end max-w-md mx-auto px-1">
          {([
            { id: "search", label: "Búsqueda", full: "Búsqueda Manual", icon: <Users size={20} /> },
            { id: "add", label: "Agregar", full: "Agregar Asistente", icon: <UserPlus size={20} /> },
          ] as const).map((t) => (
            <button
              key={t.id}
              aria-label={t.full}
              aria-current={activeTab === t.id ? "page" : undefined}
              onClick={() => goTab(t.id)}
              className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                activeTab === t.id ? "text-primary" : "text-zinc-500"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => goTab("scan")}
            aria-label="Abrir Escáner QR"
            aria-current={activeTab === "scan" ? "page" : undefined}
            className="relative -mt-5 mb-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-primary cursor-pointer"
          >
            <span className={`h-12 w-12 rounded-full bg-primary text-black flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.45)] ring-4 ring-background active:scale-95 transition-transform ${activeTab === "scan" ? "ring-primary/40" : ""}`}>
              <QrCode size={24} />
            </span>
            Escáner
          </button>

          <button
            aria-label="Dashboard"
            aria-current={activeTab === "dashboard" ? "page" : undefined}
            onClick={() => goTab("dashboard")}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
              activeTab === "dashboard" ? "text-primary" : "text-zinc-500"
            }`}
          >
            <BarChart3 size={20} />
            Dashboard
          </button>
          <button
            aria-label="Ingreso Día"
            onClick={() => setShowDayEntryModal(true)}
            className="min-h-[52px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-zinc-500 transition-colors cursor-pointer"
          >
            <Ticket size={20} />
            Ingreso Día
          </button>
        </div>
      </nav>
  )
}

function ScanTab({ activeTab, isScanning, isOnline, startScanning, activeEventName }: { activeTab: "search" | "scan" | "add" | "dashboard"; isScanning: boolean; isOnline: boolean; startScanning: () => Promise<void>; activeEventName: string | null }) {
  return (
    <>{activeTab === "scan" && (
        <div className="w-full max-w-md mx-auto space-y-3 animate-in fade-in duration-200">
          <div
            className="relative aspect-square mx-auto rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center"
            style={{ width: "min(100%, calc(100dvh - 22rem))", minWidth: "220px" }}
          >
            <div className="absolute inset-0 z-10"><div id="reader" className="w-full h-full" /></div>
            <div className="text-center z-0">
              <div className="w-12 h-12 rounded-full bg-indigo-950 text-indigo-400 flex items-center justify-center mx-auto animate-pulse">
                <QrCode size={24} />
              </div>
              <p className="text-xs font-bold text-zinc-300 mt-2">
                {isScanning ? "Cámara Activa" : "Iniciando Cámara..."}
              </p>
            </div>
          </div>
          {isScanning ? (
            <p className="text-xs text-emerald-500 flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              Apunta al código QR
              {!isOnline && <span className="text-amber-400 font-semibold">· Sin internet</span>}
            </p>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={startScanning}
                className="bg-indigo-600 hover:bg-indigo-750 text-black font-semibold text-xs px-4 py-2.5 rounded-lg transition-[background-color,scale] active:scale-95 cursor-pointer"
              >
                Reintentar Cámara
              </button>
            </div>
          )}
          <p className="text-[11px] text-zinc-500 text-center truncate">{activeEventName}</p>
        </div>
      )}</>
  )
}

function SearchTab({ activeTab, searchInput, setSearchInput, filterCategoryId, setFilterCategoryId, setPage, categories, filterStatus, setFilterStatus, isSuper, isLoading, attendees, expandedId, reactivateAttendeeMutation, checkInMutation, setExpandedId, handleWhatsAppShare, resendEmailMutation, confirmManualDeliveryMutation, startEditing, handleDeleteAttendee, attendeesTotal, page, pageSize, setPageSize, totalPages }: { activeTab: "search" | "scan" | "add" | "dashboard"; searchInput: string; setSearchInput: Dispatch<SetStateAction<string>>; filterCategoryId: string; setFilterCategoryId: Dispatch<SetStateAction<string>>; setPage: Dispatch<SetStateAction<number>>; categories: NoInfer<any[]> | undefined; filterStatus: "all" | "checked" | "pending" | "inactive"; setFilterStatus: Dispatch<SetStateAction<"all" | "checked" | "pending" | "inactive">>; isSuper: boolean; isLoading: boolean; attendees: any[] | undefined; expandedId: string | null; reactivateAttendeeMutation: UseMutationResult<any, any, any, any>; checkInMutation: UseMutationResult<any, any, any, any>; setExpandedId: Dispatch<SetStateAction<string | null>>; handleWhatsAppShare: (a: any) => void; resendEmailMutation: UseMutationResult<any, any, any, any>; confirmManualDeliveryMutation: UseMutationResult<any, any, any, any>; startEditing: (a: any) => void; handleDeleteAttendee: (a: any) => void; attendeesTotal: number; page: number; pageSize: number; setPageSize: Dispatch<SetStateAction<number>>; totalPages: number }) {
  return (
    <>{activeTab === "search" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100dvh-13.5rem)] min-h-[360px] md:h-[600px] animate-in fade-in duration-200">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-3">
            <div className="relative w-full md:flex-[2] md:min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
              <input aria-label="Buscar por nombre o cédula"
                type="text"
                placeholder="Buscar por nombre o cédula..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm md:text-base border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 md:flex md:flex-1 md:gap-3 md:min-w-[22rem]">
              <div className="relative min-w-0 md:flex-1">
                <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" size={14} />
                <select
                  value={filterCategoryId}
                  onChange={(e) => {
                    setFilterCategoryId(e.target.value)
                    setPage(1)
                  }}
                  title="Filtrar por categoría"
                  className="w-full pl-8 pr-7 py-2 truncate border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs md:text-sm"
                >
                  <option value="">Categoría</option>
                  {categories?.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="relative min-w-0 md:flex-1">
                <SlidersHorizontal className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" size={14} />
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value as "all" | "checked" | "pending" | "inactive")
                    setPage(1)
                  }}
                  title="Filtrar por estado"
                  className="w-full pl-8 pr-7 py-2 truncate border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs md:text-sm"
                >
                  <option value="all">Estado</option>
                  <option value="checked">Ya ingresaron</option>
                  <option value="pending">No han ingresado</option>
                  {isSuper && <option value="inactive">Inactivos</option>}
                </select>
              </div>
            </div>
          </div>

          {/* Móvil: tarjetas compactas (acciones secundarias dentro de "⋯") */}
          <AttendeeCards isLoading={isLoading} attendees={attendees} expandedId={expandedId} reactivateAttendeeMutation={reactivateAttendeeMutation} checkInMutation={checkInMutation} setExpandedId={setExpandedId} handleWhatsAppShare={handleWhatsAppShare} resendEmailMutation={resendEmailMutation} confirmManualDeliveryMutation={confirmManualDeliveryMutation} startEditing={startEditing} handleDeleteAttendee={handleDeleteAttendee} />

          <AttendeeTable isLoading={isLoading} attendees={attendees} reactivateAttendeeMutation={reactivateAttendeeMutation} checkInMutation={checkInMutation} setExpandedId={setExpandedId} expandedId={expandedId} handleWhatsAppShare={handleWhatsAppShare} resendEmailMutation={resendEmailMutation} confirmManualDeliveryMutation={confirmManualDeliveryMutation} startEditing={startEditing} handleDeleteAttendee={handleDeleteAttendee} />

          {!isLoading && attendeesTotal > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800 text-sm">
              <span className="text-emerald-500 text-xs">
                {Math.min((page - 1) * pageSize + 1, attendeesTotal)}–{Math.min(page * pageSize, attendeesTotal)} de {attendeesTotal}
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                  title="Resultados por página"
                  className="hidden md:block py-1.5 pl-2 pr-1 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                >
                  {[10, 20, 30, 50, 100].map((n) => (
                    <option key={n} value={n}>{n} / pág.</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-xs text-emerald-500 whitespace-nowrap">Página {page} de {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}</>
  )
}

function AddAttendeeTab({ activeTab, setShowImportModal, addError, addForm, setAddFormErrors, setAddError, attendees, addAttendeeMutation, setAddForm, addFormErrors, session, categories, setEditingCatId, setNewCatForm, setNewCatError, setCallingForm, setShowNewCatModal, handleCategoryChange, setActiveTab, router }: { activeTab: "search" | "scan" | "add" | "dashboard"; setShowImportModal: Dispatch<SetStateAction<boolean>>; addError: string; addForm: { name: string; cc: string; phone: string; email: string; categoryId: string; paidAmount: string; }; setAddFormErrors: Dispatch<SetStateAction<{ name: boolean; cc: boolean; categoryId: boolean; paidAmount: boolean; }>>; setAddError: Dispatch<SetStateAction<string>>; attendees: any[] | undefined; addAttendeeMutation: UseMutationResult<any, any, any, any>; setAddForm: Dispatch<SetStateAction<any>>; addFormErrors: { name: boolean; cc: boolean; categoryId: boolean; paidAmount: boolean; }; session: any; categories: NoInfer<any[]> | undefined; setEditingCatId: Dispatch<SetStateAction<string | null>>; setNewCatForm: Dispatch<SetStateAction<any>>; setNewCatError: Dispatch<SetStateAction<string>>; setCallingForm: Dispatch<SetStateAction<"add" | "edit" | null>>; setShowNewCatModal: Dispatch<SetStateAction<boolean>>; handleCategoryChange: (catId: string) => void; setActiveTab: Dispatch<SetStateAction<"search" | "scan" | "add" | "dashboard">>; router: ReturnType<typeof useRouter> }) {
  return (
    <>{activeTab === "add" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden p-6 max-w-xl mx-auto animate-in fade-in duration-200 space-y-4">
          <div className="border-b pb-3 border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="text-indigo-650 dark:text-indigo-400" /> Registrar Nuevo Asistente
              </h3>
              <p className="text-xs text-emerald-500 mt-1">Registra de forma manual un asistente al evento actual.</p>
            </div>
            <button
              onClick={() => setShowImportModal(true)}
              className="shrink-0 text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileSpreadsheet size={14} /> Importar Excel
            </button>
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
                <label htmlFor="entrada-nombre-completo" className="text-xs font-semibold text-emerald-500 block mb-1">Nombre Completo *</label>
                <input id="entrada-nombre-completo"
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={addForm.name}
                  onChange={(e) => {
                    setAddForm({ ...addForm, name: e.target.value })
                    setAddFormErrors(prev => ({ ...prev, name: false }))
                  }}
                  onBlur={(e) => {
                    setAddForm((prev: any) => ({ ...prev, name: toTitleCase(e.target.value) }))
                  }}
                  className={`w-full px-3 py-2 border rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    addFormErrors.name 
                      ? "border-red-500 dark:border-red-500/50 focus:ring-red-500" 
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                />
              </div>

              <div>
                <label htmlFor="entrada-cedula-documento" className="text-xs font-semibold text-emerald-500 block mb-1">Cédula / Documento *</label>
                <input id="entrada-cedula-documento"
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
                <label htmlFor="entrada-celular-opcional" className="text-xs font-semibold text-emerald-500 block mb-1">Celular (Opcional)</label>
                <input id="entrada-celular-opcional"
                  type="tel"
                  placeholder="Ej: 098123456"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="entrada-correo-opcional" className="text-xs font-semibold text-emerald-500 block mb-1">Correo (Opcional)</label>
                <input id="entrada-correo-opcional"
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
                  <label htmlFor="entrada-categoria-nuevo" className="text-xs font-semibold text-emerald-500 block">Categoría *</label>
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
                          className="text-emerald-500 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
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
                <select id="entrada-categoria-nuevo"
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
                <label htmlFor="entrada-monto-pagado" className="text-xs font-semibold text-emerald-500 block mb-1">Monto Pagado ($) *</label>
                <input id="entrada-monto-pagado"
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

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end w-full border-t pt-4 border-zinc-200 dark:border-zinc-800">
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
      )}</>
  )
}

function StatsTab({ activeTab, isStatsLoading, stats }: { activeTab: "search" | "scan" | "add" | "dashboard"; isStatsLoading: boolean; stats: any }) {
  return (
    <>{activeTab === "dashboard" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {isStatsLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-zinc-550 text-xs font-mono">Cargando estadísticas de entradas...</p>
            </div>
          ) : !stats ? (
            <div className="text-center py-12 text-emerald-500 text-sm">
              No se pudieron cargar las estadísticas.
            </div>
          ) : (
            <>
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 gap-2.5 md:gap-4 font-mono">
                {/* Total Recaudado */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 md:p-5 shadow-lg relative overflow-hidden group">
                  <div className="hidden md:block absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform text-emerald-500">
                    <Banknote size={48} />
                  </div>
                  <p className="text-[9px] md:text-[10px] text-emerald-500 uppercase font-bold tracking-wider truncate">Ingreso Total</p>
                  <p className="text-lg md:text-3xl font-black text-emerald-500 mt-1">
                    ${formatThousands(stats.totalIncome.toString())}
                  </p>
                  <p className="hidden md:block text-[9px] text-emerald-500 mt-2 font-sans">
                    Recaudado acumulado en taquilla
                  </p>
                </div>

                {/* Check-ins vs Faltantes */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 md:p-5 shadow-lg relative overflow-hidden group">
                  <div className="hidden md:block absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform text-primary">
                    <QrCode size={48} />
                  </div>
                  <p className="text-[9px] md:text-[10px] text-emerald-500 uppercase font-bold tracking-wider truncate">Ingresados / Faltan</p>
                  <div className="flex items-baseline gap-1.5 md:gap-2 mt-1 flex-wrap">
                    <span className="text-lg md:text-3xl font-black text-primary">{stats.checkedInCount}</span>
                    <span className="text-emerald-500 text-xs">/</span>
                    <span className="text-emerald-500 text-[10px] md:text-sm font-bold">{stats.pendingCount} pendientes</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2 md:mt-3 overflow-hidden">
                    <div
                      className="bg-primary h-1.5 rounded-full shadow-[0_0_10px_rgba(57,255,20,0.5)] transition-[width] duration-500"
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
                  <span className="text-[10px] text-emerald-500">Actualizado en tiempo real</span>
                </div>
                
                {/* Self-adjusting grid, no table - works at any viewport */}
                {stats.categoryStats?.length > 0 ? (
                  <div className="p-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
                    {stats.categoryStats.map((cat: any) => {
                      const pct = cat.total > 0 ? Math.round((cat.checkedIn / cat.total) * 100) : 0
                      return (
                        <div key={cat.id} className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-4 space-y-3 hover:border-zinc-700 active:scale-[0.98] active:border-zinc-600 transition-[border-color,scale] cursor-default">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white text-sm truncate">{cat.name}</span>
                            <span className="font-bold text-zinc-300 text-xs whitespace-nowrap">
                              {cat.price > 0 ? `$${formatThousands(cat.price.toString())}` : "Gratis"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-primary h-1.5 rounded-full shadow-[0_0_5px_rgba(57,255,20,0.3)] transition-[width] duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-zinc-300 w-8 text-right">{pct}%</span>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div>
                              <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Reg.</p>
                              <p className="text-sm font-black text-white">{cat.total}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Ingr.</p>
                              <p className="text-sm font-black text-primary">{cat.checkedIn}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Falt.</p>
                              <p className="text-sm font-black text-emerald-500">{cat.pending}</p>
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-zinc-800 flex items-center justify-between">
                            <span className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Recaudado</span>
                            <span className="text-sm font-black text-emerald-500">
                              ${formatThousands(cat.income.toString())}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-emerald-500 italic text-xs">
                    No hay categorías creadas para esta sucursal.
                  </div>
                )}

                {stats.categoryStats?.length > 0 && (
                  <div className="p-4 bg-zinc-950 border-t-2 border-emerald-500/40 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                    <span className="font-black text-white text-xs uppercase tracking-wider">Total</span>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                      <div className="text-center">
                        <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Reg.</p>
                        <p className="text-sm font-black text-white">
                          {stats.categoryStats.reduce((sum: number, cat: any) => sum + cat.total, 0)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Ingr.</p>
                        <p className="text-sm font-black text-primary">
                          {stats.categoryStats.reduce((sum: number, cat: any) => sum + cat.checkedIn, 0)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Falt.</p>
                        <p className="text-sm font-black text-emerald-500">
                          {stats.categoryStats.reduce((sum: number, cat: any) => sum + cat.pending, 0)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Recaudado</p>
                        <p className="text-sm font-black text-emerald-500">
                          ${formatThousands(stats.categoryStats.reduce((sum: number, cat: any) => sum + cat.income, 0).toString())}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}</>
  )
}

function ImportModal({ showImportModal, closeImportModal, handleImportFile, importCategoryId, setImportCategoryId, categories, importParsing, importRows, importFileName, sortedImportRows, importResult, importMutation }: { showImportModal: boolean; closeImportModal: () => void; handleImportFile: (file: File) => Promise<void>; importCategoryId: string; setImportCategoryId: Dispatch<SetStateAction<string>>; categories: NoInfer<any[]> | undefined; importParsing: boolean; importRows: ImportRow[]; importFileName: string; sortedImportRows: ImportRow[]; importResult: any; importMutation: UseMutationResult<any, any, void, any> }) {
  return (
    <>{showImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-3xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FileSpreadsheet className="text-indigo-650 dark:text-indigo-400" /> Importar Asistentes desde Excel
              </h3>
              <button aria-label="Cerrar" onClick={closeImportModal} className="text-emerald-500 hover:text-zinc-655 dark:hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-emerald-500">
              El archivo debe tener 4 columnas sin encabezado: <strong>Nombre, Cédula, Correo, Celular</strong>. Si volvés a subir el mismo archivo actualizado, solo se envía correo a quien todavía no lo haya recibido.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="entrada-archivo-xlsx" className="text-xs font-semibold text-emerald-500 block mb-1">Archivo (.xlsx) *</label>
                <input id="entrada-archivo-xlsx"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImportFile(file)
                  }}
                  className="w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-indigo-50 dark:file:bg-indigo-900/30 file:text-indigo-650 dark:file:text-indigo-400 file:text-xs file:font-semibold cursor-pointer border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950"
                />
              </div>
              <div>
                <label htmlFor="entrada-categoria-para-todos" className="text-xs font-semibold text-emerald-500 block mb-1">Categoría para todos *</label>
                <select id="entrada-categoria-para-todos"
                  value={importCategoryId}
                  onChange={(e) => setImportCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="">Selecciona categoría...</option>
                  {categories?.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name} (${formatThousands(cat.price.toString())})</option>
                  ))}
                </select>
              </div>
            </div>

            {importParsing && (
              <div className="text-center text-sm text-emerald-500 py-4">Leyendo archivo...</div>
            )}

            {importRows.length > 0 && !importParsing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-500">
                    <strong className="text-zinc-700 dark:text-zinc-300">{importFileName}</strong> — {importRows.length} registros
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                    <AlertTriangle size={14} /> {importRows.filter(r => !r.email).length} sin correo (destacados, van primero)
                  </span>
                </div>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="px-3 py-2 font-medium text-emerald-500">Nombre</th>
                        <th className="px-3 py-2 font-medium text-emerald-500">Cédula</th>
                        <th className="px-3 py-2 font-medium text-emerald-500">Correo</th>
                        <th className="px-3 py-2 font-medium text-emerald-500">Celular</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {sortedImportRows.map((r) => (
                        <tr key={r.rowNumber} className={!r.email ? "bg-amber-100 dark:bg-amber-900/30" : ""}>
                          <td className="px-3 py-1.5">{r.name}</td>
                          <td className="px-3 py-1.5 text-emerald-500">{r.cc}</td>
                          <td className="px-3 py-1.5">
                            {r.email || <span className="text-amber-700 dark:text-amber-400 font-semibold">Sin correo</span>}
                          </td>
                          <td className="px-3 py-1.5 text-emerald-500">{r.phone || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importResult && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs space-y-1">
                <p>✅ {importResult.created} nuevos registrados, {importResult.skipped} ya existían (ignorados)</p>
                <p>📧 {importResult.pendingEmails} correos en cola (se envían de a uno, en segundo plano)</p>
                <p>⚠️ {importResult.noEmailCount} sin correo (necesitan seguimiento)</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={closeImportModal}
                className="text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-md font-semibold transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => importMutation.mutate()}
                disabled={importRows.length === 0 || !importCategoryId || importMutation.isPending}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md font-semibold transition-colors flex items-center gap-1.5"
              >
                <UploadIcon size={14} /> {importMutation.isPending ? "Importando..." : "Confirmar e Importar"}
              </button>
            </div>
          </div>
        </div>
      )}</>
  )
}

function EditAttendeeModal({ editingAttendee, setEditingAttendee, editError, editForm, setEditFormErrors, setEditError, editAttendeeMutation, setEditForm, editFormErrors, session, categories, setEditingCatId, setNewCatForm, setNewCatError, setCallingForm, setShowNewCatModal, handleEditCategoryChange }: { editingAttendee: any; setEditingAttendee: Dispatch<any>; editError: string; editForm: { name: string; cc: string; phone: string; email: string; categoryId: string; paidAmount: string; }; setEditFormErrors: Dispatch<SetStateAction<{ name: boolean; cc: boolean; categoryId: boolean; paidAmount: boolean; }>>; setEditError: Dispatch<SetStateAction<string>>; editAttendeeMutation: UseMutationResult<any, any, any, any>; setEditForm: Dispatch<SetStateAction<any>>; editFormErrors: { name: boolean; cc: boolean; categoryId: boolean; paidAmount: boolean; }; session: any; categories: NoInfer<any[]> | undefined; setEditingCatId: Dispatch<SetStateAction<string | null>>; setNewCatForm: Dispatch<SetStateAction<any>>; setNewCatError: Dispatch<SetStateAction<string>>; setCallingForm: Dispatch<SetStateAction<"add" | "edit" | null>>; setShowNewCatModal: Dispatch<SetStateAction<boolean>>; handleEditCategoryChange: (catId: string) => void }) {
  return (
    <>{editingAttendee && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Edit className="text-indigo-650 dark:text-indigo-400" /> Editar Asistente
              </h3>
              <button aria-label="Cerrar" onClick={() => setEditingAttendee(null)} className="text-emerald-500 hover:text-zinc-650 dark:hover:text-zinc-200">
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
                <label htmlFor="entrada-nombre-completo-2" className="text-xs font-semibold text-emerald-500 block mb-1">Nombre Completo *</label>
                <input id="entrada-nombre-completo-2"
                  type="text"
                  value={editForm.name}
                  onChange={(e) => {
                    setEditForm({ ...editForm, name: e.target.value })
                    setEditFormErrors(prev => ({ ...prev, name: false }))
                  }}
                  onBlur={(e) => {
                    setEditForm((prev: any) => ({ ...prev, name: toTitleCase(e.target.value) }))
                  }}
                  className={`w-full px-3 py-2 border rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    editFormErrors.name ? "border-red-500 dark:border-red-500/50" : "border-zinc-200 dark:border-zinc-800"
                  }`}
                  required
                />
              </div>

              <div>
                <label htmlFor="entrada-cedula-documento-2" className="text-xs font-semibold text-emerald-500 block mb-1">Cédula / Documento *</label>
                <input id="entrada-cedula-documento-2"
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
                  <label htmlFor="entrada-celular" className="text-xs font-semibold text-emerald-500 block mb-1">Celular</label>
                  <input id="entrada-celular"
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="entrada-correo" className="text-xs font-semibold text-emerald-500 block mb-1">Correo</label>
                  <input id="entrada-correo"
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
                    <label htmlFor="entrada-categoria-editar" className="text-xs font-semibold text-emerald-500 block">Categoría *</label>
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
                            className="text-emerald-500 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
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
                  <select id="entrada-categoria-editar"
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
                  <label htmlFor="entrada-monto-pagado-2" className="text-xs font-semibold text-emerald-500 block mb-1">Monto Pagado ($) *</label>
                  <input id="entrada-monto-pagado-2"
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

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end w-full border-t pt-4 border-zinc-200 dark:border-zinc-800">
                <button type="button" onClick={() => setEditingAttendee(null)} className="px-4 py-2 border w-full sm:w-auto justify-center border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md font-semibold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
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
      )}</>
  )
}

function CategoryModal({ showNewCatModal, editingCatId, setShowNewCatModal, setEditingCatId, newCatError, newCatForm, setNewCatError, updateCategoryMutation, createCategoryMutation, setNewCatForm }: { showNewCatModal: boolean; editingCatId: string | null; setShowNewCatModal: Dispatch<SetStateAction<boolean>>; setEditingCatId: Dispatch<SetStateAction<string | null>>; newCatError: string; newCatForm: { name: string; price: string; includedConsumptions: number; description: string; }; setNewCatError: Dispatch<SetStateAction<string>>; updateCategoryMutation: UseMutationResult<any, any, any, any>; createCategoryMutation: UseMutationResult<any, any, any, any>; setNewCatForm: Dispatch<SetStateAction<any>> }) {
  return (
    <>{showNewCatModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Plus className="text-primary" /> {editingCatId ? "Modificar Categoría" : "Nueva Categoría"}
              </h3>
              <button aria-label="Cerrar" 
                type="button"
                onClick={() => {
                  setShowNewCatModal(false)
                  setEditingCatId(null)
                }} 
                className="text-emerald-500 hover:text-zinc-650 dark:hover:text-zinc-200 cursor-pointer"
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
                <label htmlFor="entrada-nombre-de-la-categoria" className="text-xs font-semibold text-emerald-500 block mb-1">Nombre de la Categoría *</label>
                <input id="entrada-nombre-de-la-categoria"
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
                  <label htmlFor="entrada-precio" className="text-xs font-semibold text-emerald-500 block mb-1">Precio ($) *</label>
                  <input id="entrada-precio"
                    type="text"
                    placeholder="0"
                    value={newCatForm.price}
                    onChange={(e) => setNewCatForm({ ...newCatForm, price: formatThousands(e.target.value) })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white font-bold"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="entrada-consumos-incluidos" className="text-xs font-semibold text-emerald-500 block mb-1">Consumos Incluidos</label>
                  <input id="entrada-consumos-incluidos"
                    type="number"
                    min="0"
                    value={newCatForm.includedConsumptions}
                    onChange={(e) => setNewCatForm({ ...newCatForm, includedConsumptions: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="entrada-descripcion-opcional" className="text-xs font-semibold text-emerald-500 block mb-1">Descripción (Opcional)</label>
                <textarea id="entrada-descripcion-opcional"
                  rows={2}
                  placeholder="Ej: Incluye acceso a zona VIP y 2 bebidas"
                  value={newCatForm.description}
                  onChange={(e) => setNewCatForm({ ...newCatForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end w-full border-t pt-4 border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCatModal(false)
                    setEditingCatId(null)
                  }}
                  className="px-4 py-2 border border-zinc-800 rounded-md text-xs font-bold uppercase tracking-wider text-emerald-500 hover:bg-zinc-900 transition-colors cursor-pointer"
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
      )}</>
  )
}

function AlreadyCheckedInModal({ alreadyCheckedInInfo, setAlreadyCheckedInInfo, html5QrCodeRef, isScanning }: { alreadyCheckedInInfo: any; setAlreadyCheckedInInfo: Dispatch<any>; html5QrCodeRef: RefObject<any>; isScanning: boolean }) {
  return (
    <>{alreadyCheckedInInfo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200">
          <div className="bg-zinc-950 border-2 border-red-500 rounded-xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(239,68,68,0.3)] space-y-4 font-mono text-center text-white relative">
            <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-500 flex items-center justify-center mx-auto text-red-500 animate-bounce">
              <ShieldAlert size={36} />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black tracking-widest text-red-500 uppercase">
                ¡Advertencia!
              </h3>
              <p className="text-sm font-bold text-white">
                El asistente ya ingresó al evento
              </p>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-zinc-800/60 pb-1.5">
                <span className="text-emerald-500">Asistente:</span>
                <span className="font-bold text-zinc-200">{alreadyCheckedInInfo.name}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-1.5">
                <span className="text-emerald-500">Documento:</span>
                <span className="font-bold text-zinc-200">{alreadyCheckedInInfo.cc}</span>
              </div>
              {alreadyCheckedInInfo.categoryName && (
                <div className="flex justify-between border-b border-zinc-800/60 pb-1.5">
                  <span className="text-emerald-500">Categoría:</span>
                  <span className="font-bold text-zinc-200">{alreadyCheckedInInfo.categoryName}</span>
                </div>
              )}
              <div className="flex justify-between pt-0.5">
                <span className="text-emerald-500">Hora de Ingreso:</span>
                <span className="font-bold text-red-400">
                  {alreadyCheckedInInfo.checkedInAt 
                    ? new Date(alreadyCheckedInInfo.checkedInAt).toLocaleString('es-ES', { timeZone: process.env.NEXT_PUBLIC_TIMEZONE || 'America/Bogota', 
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
                  <span className="text-emerald-500">Escaneado por:</span>
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
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold uppercase tracking-wider transition-[background-color,scale] cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.2)] active:scale-95"
              >
                Aceptar y Continuar
              </button>
            </div>
          </div>
        </div>
      )}</>
  )
}

function CheckInSuccessModal({ successCheckInInfo, setSuccessCheckInInfo, html5QrCodeRef, isScanning }: { successCheckInInfo: any; setSuccessCheckInInfo: Dispatch<any>; html5QrCodeRef: RefObject<any>; isScanning: boolean }) {
  return (
    <>{successCheckInInfo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200">
          <div className="bg-zinc-950 border-2 border-primary rounded-xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(57,255,20,0.3)] space-y-4 font-mono text-center text-white relative">
            <div className="w-16 h-16 rounded-full bg-green-950/50 border border-primary flex items-center justify-center mx-auto text-primary animate-bounce">
              <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black tracking-widest text-primary uppercase">
                ¡Ingreso Confirmado!
              </h3>
              <p className="text-sm font-bold text-white">{successCheckInInfo.name}</p>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-zinc-800/60 pb-1.5">
                <span className="text-emerald-500">Documento:</span>
                <span className="font-bold text-zinc-200">{successCheckInInfo.cc}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-emerald-500">Categoría:</span>
                <span className="font-bold text-zinc-200">{successCheckInInfo.category?.name}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuccessCheckInInfo(null)
                  if (html5QrCodeRef.current && isScanning) {
                    html5QrCodeRef.current.resume().catch(() => {})
                  }
                }}
                className="w-full py-2.5 bg-primary hover:brightness-110 text-black rounded-md text-xs font-bold uppercase tracking-wider transition-[filter,scale] cursor-pointer shadow-[0_0_15px_rgba(57,255,20,0.2)] active:scale-95"
              >
                Continuar Escaneando
              </button>
            </div>
          </div>
        </div>
      )}</>
  )
}

function useCategoryMutations({ newCatForm, activeBranchId, queryClient, activeEventId, callingForm, setAddForm, setAddFormErrors, setEditForm, setEditFormErrors, setShowNewCatModal, setNewCatForm, setNewCatError }: { newCatForm: { name: string; price: string; includedConsumptions: number; description: string; }; activeBranchId: string | null; queryClient: QueryClient; activeEventId: string | null; callingForm: "add" | "edit" | null; setAddForm: Dispatch<SetStateAction<any>>; setAddFormErrors: Dispatch<SetStateAction<{ name: boolean; cc: boolean; categoryId: boolean; paidAmount: boolean; }>>; setEditForm: Dispatch<SetStateAction<any>>; setEditFormErrors: Dispatch<SetStateAction<{ name: boolean; cc: boolean; categoryId: boolean; paidAmount: boolean; }>>; setShowNewCatModal: Dispatch<SetStateAction<boolean>>; setNewCatForm: Dispatch<SetStateAction<any>>; setNewCatError: Dispatch<SetStateAction<string>> }) {
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
        setAddForm((prev: any) => ({
          ...prev,
          categoryId: newCat.id,
          paidAmount: formatThousands(newCat.price.toString())
        }))
        setAddFormErrors(prev => ({ ...prev, categoryId: false }))
      } else if (callingForm === "edit") {
        setEditForm((prev: any) => ({
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

  return { createCategoryMutation }
}

function useWhatsAppShare({ activeEvent, activeEventName, activeBranchName }: { activeEvent: any; activeEventName: string | null; activeBranchName: string | null }) {
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
      (activeEvent?.mapsUrl ? `🗺️ *${activeEvent?.mapsLabel || "Abrir en Google Maps"}:* ${activeEvent.mapsUrl}\n` : "") +
      `🎫 *Categoría:* ${a.category?.name || ""}\n` +
      `💵 *Valor de la entrada:* $${formatThousands((a.paidAmount ?? 0).toString())}\n\n` +
      `📥 *Descarga tu Código QR de Acceso:* \n` +
      `${qrLink}\n\n` +
      (flyerLink ? `🖼️ *Descarga el Flyer del Evento (.png):* \n${flyerLink}\n\n` : "") +
      `¡Te esperamos!`

    const phone = cleanPhone(a.phone || "")
    const url = `https://api.whatsapp.com/send?${phone ? `phone=${phone}&` : ""}text=${encodeURIComponent(message)}`
    window.open(url, "_blank")
  }

  return { handleWhatsAppShare }
}

function useEmailQueue({ activeBranchId, activeEventId, queryClient }: { activeBranchId: string | null; activeEventId: string | null; queryClient: QueryClient }) {
  const draining = useRef(false)
  const drainEmailQueue = useCallback(async () => {
    if (draining.current || !activeBranchId || !activeEventId) return
    draining.current = true
    const skipIds: string[] = []
    let sent = 0
    try {
      while (true) {
        const res = await fetch("/api/attendees/email-queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchId: activeBranchId, eventId: activeEventId, skipIds }),
        })
        if (!res.ok) { toast.warning("La cola de correos se detuvo; se retomará al reabrir la página.", { id: "email-queue" }); break }
        const { data } = await res.json()
        sent += data.sent
        skipIds.push(...data.failed.map((f: any) => f.id))
        data.failed.forEach((f: any) => toast.warning(`No se pudo enviar correo a ${f.name}`, { description: f.error }))
        queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
        if (data.remaining === 0 || (data.sent === 0 && data.failed.length === 0)) break
        toast.info(`Correos en cola: ${data.remaining}`, { id: "email-queue", duration: Infinity })
      }
      if (sent > 0) toast.success(`${sent} correos enviados`, { id: "email-queue", duration: 4000 })
      else toast.dismiss("email-queue")
    } catch {
      toast.warning("La cola de correos se detuvo; se retomará al reabrir la página.", { id: "email-queue" })
    } finally {
      draining.current = false
    }
  }, [activeBranchId, activeEventId, queryClient])

  // Al abrir la página, si quedaron correos en cola (cierre del navegador, error), se retoman.
  const { data: pendingEmails = 0 } = useQuery({
    queryKey: ["email-queue-pending", activeBranchId, activeEventId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/attendees/email-queue?branchId=${activeBranchId}&eventId=${activeEventId}`, { signal })
      if (!res.ok) return 0
      return ((await res.json())?.data?.pending ?? 0) as number
    },
    enabled: !!activeBranchId && !!activeEventId,
    // Solo se consulta al abrir la página o cambiar de sucursal/evento
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  useEffect(() => {
    if (pendingEmails > 0) drainEmailQueue()
  }, [pendingEmails, drainEmailQueue])

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
      toast.success("Correo de ticket en cola para reenvío")
      queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
      drainEmailQueue()
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  // Manually confirm QR delivered by another channel (WhatsApp, en persona, etc.)
  const confirmManualDeliveryMutation = useMutation({
    mutationFn: async (attendeeId: string) => {
      const res = await fetch("/api/attendees/confirm-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeId })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al confirmar entrega")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Entrega del QR confirmada")
      queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  return { drainEmailQueue, resendEmailMutation, confirmManualDeliveryMutation }
}

function useAddAttendee({ addForm, activeBranchId, activeEventId, setAddForm, setAddError, setAddFormErrors, drainEmailQueue, queryClient }: { addForm: { name: string; cc: string; phone: string; email: string; categoryId: string; paidAmount: string; }; activeBranchId: string | null; activeEventId: string | null; setAddForm: Dispatch<SetStateAction<any>>; setAddError: Dispatch<SetStateAction<string>>; setAddFormErrors: Dispatch<SetStateAction<{ name: boolean; cc: boolean; categoryId: boolean; paidAmount: boolean; }>>; drainEmailQueue: () => Promise<void>; queryClient: QueryClient }) {
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
      
      if (resData?.queued) {
        toast.success("Asistente registrado; el ticket quedó en cola de envío")
        drainEmailQueue()
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

  return { addAttendeeMutation }
}

function useAttendeeImport({ activeBranchId, activeEventId, drainEmailQueue, queryClient }: { activeBranchId: string | null; activeEventId: string | null; drainEmailQueue: () => Promise<void>; queryClient: QueryClient }) {
  const [showImportModal, setShowImportModal] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importCategoryId, setImportCategoryId] = useState("")
  const [importFileName, setImportFileName] = useState("")
  const [importParsing, setImportParsing] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  const sortedImportRows = [...importRows].sort((a, b) => {
    const aHasEmail = a.email ? 1 : 0
    const bHasEmail = b.email ? 1 : 0
    return aHasEmail - bHasEmail
  })

  const handleImportFile = async (file: File) => {
    setImportParsing(true)
    setImportResult(null)
    try {
      const ExcelJS = (await import("exceljs")).default
      const workbook = new ExcelJS.Workbook()
      const buffer = await file.arrayBuffer()
      await workbook.xlsx.load(buffer)
      const sheet = workbook.worksheets[0]
      const rows: ImportRow[] = []
      sheet.eachRow((row) => {
        const name = row.getCell(1).text?.trim() || ""
        const cc = row.getCell(2).text?.trim() || ""
        const email = row.getCell(3).text?.trim() || ""
        const phone = row.getCell(4).text?.trim() || ""
        if (name && cc) {
          rows.push({ rowNumber: row.number, name: toTitleCase(name), cc, email, phone })
        }
      })
      setImportRows(rows)
      setImportFileName(file.name)
      if (rows.length === 0) {
        toast.error("No se encontraron filas válidas (nombre + cédula) en el archivo.")
      }
    } catch (err: any) {
      toast.error("Error al leer el archivo: " + (err.message || err))
    } finally {
      setImportParsing(false)
    }
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/attendees/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: activeBranchId,
          eventId: activeEventId,
          categoryId: importCategoryId,
          rows: importRows.map(r => ({
            name: r.name,
            cc: r.cc,
            phone: r.phone || null,
            email: r.email || null
          }))
        })
      })
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || "Error al importar")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let summary: any = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.trim()) continue
          const evt = JSON.parse(line)

          if (evt.type === "progress") {
            if (evt.emailStatus === "sent") {
              toast.success(`✉️ Correo enviado a ${evt.name}`, { description: `${evt.processed}/${evt.total} — ${evt.cc}` })
            } else if (evt.emailStatus === "failed") {
              toast.warning(`No se pudo enviar correo a ${evt.name}`, { description: evt.error || "Error de envío" })
            } else if (evt.emailStatus === "no_email") {
              toast.info(`${evt.name} registrado sin correo`, { description: `${evt.processed}/${evt.total} — ${evt.cc}` })
            }
          } else if (evt.type === "error") {
            toast.error(evt.message)
          } else if (evt.type === "summary") {
            summary = evt.summary
          }
        }
      }

      // Los correos quedaron en cola: se envían de a uno, despacio, en segundo plano
      if (summary?.pendingEmails > 0) {
        toast.info(`${summary.pendingEmails} correos en cola de envío`, { id: "email-queue", duration: Infinity })
        void drainEmailQueue()
      }

      return summary
    },
    onSuccess: (summary) => {
      if (!summary) return
      setImportResult(summary)
      queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
      queryClient.invalidateQueries({ queryKey: ["attendees-stats", activeBranchId, activeEventId] })
      toast.success(`Importación completa: ${summary.created} nuevos, ${summary.skipped} ya existían (ignorados), ${summary.pendingEmails} correos en cola`)
    },
    onError: (err: any) => {
      toast.error("Error al importar: " + err.message)
    }
  })

  const closeImportModal = () => {
    setShowImportModal(false)
    setImportRows([])
    setImportCategoryId("")
    setImportFileName("")
    setImportResult(null)
  }

  return { showImportModal, setShowImportModal, importRows, importCategoryId, setImportCategoryId, importFileName, importParsing, importResult, sortedImportRows, handleImportFile, importMutation, closeImportModal }
}

function useAttendeeEditing({ setEditingAttendee, setEditForm, setEditError, setEditFormErrors, categories, editForm, editingAttendee, queryClient, activeBranchId, activeEventId }: { setEditingAttendee: Dispatch<any>; setEditForm: Dispatch<SetStateAction<any>>; setEditError: Dispatch<SetStateAction<string>>; setEditFormErrors: Dispatch<SetStateAction<{ name: boolean; cc: boolean; categoryId: boolean; paidAmount: boolean; }>>; categories: NoInfer<any[]> | undefined; editForm: { name: string; cc: string; phone: string; email: string; categoryId: string; paidAmount: string; }; editingAttendee: any; queryClient: QueryClient; activeBranchId: string | null; activeEventId: string | null }) {
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
    setEditForm((prev: any) => ({
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
      if (!res.ok) throw new Error((await res.json()).error || "Error al desactivar asistente")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Asistente desactivado")
      queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
      queryClient.invalidateQueries({ queryKey: ["attendees-stats", activeBranchId, activeEventId] })
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  // Reactivar un asistente inactivo (solo super admin; el API lo valida)
  const reactivateAttendeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/attendees?id=${id}`, { method: "PATCH" })
      if (!res.ok) throw new Error((await res.json()).error || "Error al reactivar asistente")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Asistente reactivado")
      queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
      queryClient.invalidateQueries({ queryKey: ["attendees-stats", activeBranchId, activeEventId] })
    },
    onError: (err: any) => toast.error(err.message)
  })

  const handleDeleteAttendee = (a: any) => {
    if (window.confirm(`¿Desactivar a ${a.name}? Dejará de aparecer y no podrá ingresar. Solo el super admin podrá verlo y reactivarlo.`)) {
      deleteAttendeeMutation.mutate(a.id)
    }
  }

  return { startEditing, handleEditCategoryChange, editAttendeeMutation, reactivateAttendeeMutation, handleDeleteAttendee }
}

function useOfflineMode({ activeEventId, queryClient, activeBranchId }: { activeEventId: string | null; queryClient: QueryClient; activeBranchId: string | null }) {
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null)
  const [offlineCount, setOfflineCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(true)
  const [savingOffline, setSavingOffline] = useState(false)

  const refreshOfflineState = useCallback(async () => {
    if (!activeEventId) return
    const snap = await getSnapshot(activeEventId)
    setOfflineSavedAt(snap?.savedAt ?? null)
    setOfflineCount(snap?.list.length ?? 0)
    setPendingCount((await listPending(activeEventId)).length)
  }, [activeEventId])

  const flushPending = useCallback(async () => {
    const { sent, left } = await syncPending()
    if (sent > 0) {
      toast.success(`${sent} check-in${sent === 1 ? "" : "s"} sin conexión enviado${sent === 1 ? "" : "s"}`)
      queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
      queryClient.invalidateQueries({ queryKey: ["attendees-stats", activeBranchId, activeEventId] })
    }
    if (left > 0 && sent === 0) return
    refreshOfflineState()
  }, [queryClient, activeBranchId, activeEventId, refreshOfflineState])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    refreshOfflineState()
    // Solo en producción: en desarrollo el cache serviría código viejo
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
    const goOnline = () => { setIsOnline(true); flushPending() }
    const goOffline = () => setIsOnline(false)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    if (navigator.onLine) flushPending()
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [refreshOfflineState, flushPending])

  // Guarda la lista del evento + deja lista la app (escáner y páginas) para usarla sin red
  const saveForOffline = async () => {
    if (!activeBranchId || !activeEventId || savingOffline) return
    if (!navigator.onLine) { toast.error("Necesitas internet para guardar la lista"); return }
    setSavingOffline(true)
    try {
      await flushPending()
      const res = await fetch(`/api/attendees/offline-snapshot?branchId=${activeBranchId}&eventId=${activeEventId}`)
      if (!res.ok) throw new Error("No se pudo descargar la lista")
      const json = await res.json()
      await saveSnapshot(activeEventId, json.data, json.savedAt)
      // Precarga el lector de QR y registra el service worker para que la app abra sin red
      await import("html5-qrcode")
      if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/sw.js").catch(() => {})
      }
      await Promise.all(
        ["/entrada", "/api/auth/session"].map((u) => fetch(u).catch(() => {}))
      )
      await refreshOfflineState()
      toast.success(`Listo sin internet: ${json.data.length} asistentes guardados`)
    } catch (e: any) {
      toast.error(e.message || "Error al guardar para uso sin internet")
    } finally {
      setSavingOffline(false)
    }
  }

  return { offlineSavedAt, offlineCount, pendingCount, isOnline, savingOffline, refreshOfflineState, flushPending, saveForOffline }
}

function useScannerSession({ setShowDayEntryModal, setDayEntryError }: { setShowDayEntryModal: Dispatch<SetStateAction<boolean>>; setDayEntryError: Dispatch<SetStateAction<string>> }) {
  const [isScanning, setIsScanning] = useState(false)
  const html5QrCodeRef = useRef<any>(null)
  const isScanTabActiveRef = useRef(false)
  const isStartingRef = useRef(false)
  // Ignore re-reads of the same QR within this window right after a successful check-in
  // (avoids the camera "bouncing" a false ALREADY_CHECKED_IN warning right after success)
  const CHECKIN_COOLDOWN_MS = 6000
  const lastCheckInRef = useRef<{ code: string; time: number } | null>(null)


  // Deja el escáner corriendo de fondo (solo pausa la cámara) para poder abrir
  // "Ingreso Día" encima sin perder la sesión del QR y volver de un toque.
  const openDayEntryFromScanner = () => {
    if (html5QrCodeRef.current && isScanning) {
      html5QrCodeRef.current.pause()
    }
    setShowDayEntryModal(true)
  }

  const closeDayEntryModal = () => {
    setShowDayEntryModal(false)
    setDayEntryError("")
    if (html5QrCodeRef.current && isScanning && isScanTabActiveRef.current) {
      html5QrCodeRef.current.resume().catch(() => {})
    }
  }

  return { isScanning, setIsScanning, html5QrCodeRef, isScanTabActiveRef, isStartingRef, CHECKIN_COOLDOWN_MS, lastCheckInRef, openDayEntryFromScanner, closeDayEntryModal }
}

function useCheckIn({ activeEventId, refreshOfflineState, lastCheckInRef, queryClient, activeBranchId, setSuccessCheckInInfo, setAlreadyCheckedInInfo, setNotification }: { activeEventId: string | null; refreshOfflineState: () => Promise<void>; lastCheckInRef: RefObject<{ code: string; time: number; } | null>; queryClient: QueryClient; activeBranchId: string | null; setSuccessCheckInInfo: Dispatch<any>; setAlreadyCheckedInInfo: Dispatch<any>; setNotification: Dispatch<SetStateAction<any>> }) {
  const playCheckInBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioCtx()
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = "sine"
      oscillator.frequency.value = 880
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.2)
      oscillator.onended = () => ctx.close()
    } catch (_) { /* ignore */ }
  }

  const checkInMutation = useMutation({
    mutationFn: async (payload: { qrCodeOrCc: string }) => {
      let res: Response
      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) throw new TypeError("offline")
        res = await fetch("/api/attendees/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qrCodeOrCc: payload.qrCodeOrCc,
            eventId: activeEventId
          })
        })
      } catch (e) {
        // Sin red: valida contra la lista guardada y deja el check-in en cola
        if (!isNetworkError(e)) throw e
        const out = await offlineCheckIn(payload.qrCodeOrCc, activeEventId as string)
        refreshOfflineState()
        return out
      }
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
    onSuccess: (resJson, variables) => {
      playCheckInBeep()
      // Remember this code to swallow duplicate scans of the same QR right after check-in
      lastCheckInRef.current = { code: variables.qrCodeOrCc, time: Date.now() }
      // Invalidate attendees list queries to refresh UI status
      queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
      queryClient.invalidateQueries({ queryKey: ["attendees-stats", activeBranchId, activeEventId] })
      setSuccessCheckInInfo(resJson.data)
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

  return { checkInMutation }
}

function useScannerControls({ isScanTabActiveRef, isStartingRef, html5QrCodeRef, setIsScanning, lastCheckInRef, CHECKIN_COOLDOWN_MS, checkInMutation, activeTab, activeBranchId, activeEventId }: { isScanTabActiveRef: RefObject<boolean>; isStartingRef: RefObject<boolean>; html5QrCodeRef: RefObject<any>; setIsScanning: Dispatch<SetStateAction<boolean>>; lastCheckInRef: RefObject<{ code: string; time: number; } | null>; CHECKIN_COOLDOWN_MS: number; checkInMutation: UseMutationResult<any, any, any, any>; activeTab: "search" | "add" | "scan" | "dashboard"; activeBranchId: string | null; activeEventId: string | null }) {
  const startScanning = async () => {
    if (!isScanTabActiveRef.current || isStartingRef.current) return
    isStartingRef.current = true
    try {
      const { Html5Qrcode } = await import("html5-qrcode")
      if (!isScanTabActiveRef.current) return
      const scanner = new Html5Qrcode("reader", {
        // Solo QR (más rápido que probar todos los formatos). En iPhone Safari no existe
        // BarcodeDetector y se usa el decodificador JS, por eso se acota el área de lectura.
        formatsToSupport: [0 /* QR_CODE */],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false
      } as any)
      html5QrCodeRef.current = scanner
      setIsScanning(true)

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 15,
          disableFlip: true, // los QR no vienen en espejo: ahorra la mitad del trabajo
          qrbox: (width, height) => {
            const size = Math.floor(Math.min(width, height) * 0.75)
            return { width: size, height: size }
          },
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            advanced: [{ focusMode: "continuous" }]
          } as any
        },
        async (decodedText) => {
          // Same code we just checked in successfully, still in frame: ignore silently
          if (
            lastCheckInRef.current &&
            lastCheckInRef.current.code === decodedText &&
            Date.now() - lastCheckInRef.current.time < CHECKIN_COOLDOWN_MS
          ) {
            return
          }
          try {
            await scanner.pause()
            await checkInMutation.mutateAsync({ qrCodeOrCc: decodedText })
            // Resumes when the success modal closes (auto or manual)
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
            // ALREADY_CHECKED_IN resumes when its warning modal closes
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
    const scanner = html5QrCodeRef.current
    if (scanner) {
      // Se suelta antes de esperar: un arranque que ocurra durante stop() no debe perder
      // su escáner nuevo ni quedar marcado como detenido al terminar este.
      html5QrCodeRef.current = null
      try {
        if (scanner.isScanning) {
          await scanner.stop()
        }
      } catch (err) {
        console.warn("Error stopping scanner (safe catch):", err)
      }
    }
    if (!html5QrCodeRef.current) setIsScanning(false)
  }

  const onScanTabEnter = useEffectEvent(() => startScanning())
  const onScanTabLeave = useEffectEvent(() => stopScanning())


  useEffect(() => {
    if (activeTab === "scan" && activeBranchId && activeEventId) {
      isScanTabActiveRef.current = true
      const timer = setTimeout(() => {
        if (isScanTabActiveRef.current) {
          onScanTabEnter()
        }
      }, 100)
      return () => {
        isScanTabActiveRef.current = false
        clearTimeout(timer)
        onScanTabLeave()
      }
    } else {
      isScanTabActiveRef.current = false
      onScanTabLeave()
    }
  }, [activeTab, activeBranchId, activeEventId, isScanTabActiveRef])

  return { startScanning, stopScanning }
}

function useAttendeeForms({  }: {  }) {
  const [showDayEntryModal, setShowDayEntryModal] = useState(false)
  const [dayEntryForm, setDayEntryForm] = useState({
    categoryId: "",
    quantity: "1",
    unitAmount: "",
    method: "CASH" as "CASH" | "TRANSFER" | "QR" | "CARD"
  })
  const [dayEntryError, setDayEntryError] = useState("")

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

  return { showDayEntryModal, setShowDayEntryModal, dayEntryForm, setDayEntryForm, dayEntryError, setDayEntryError, addForm, setAddForm, addError, setAddError, addFormErrors, setAddFormErrors, editingAttendee, setEditingAttendee, editForm, setEditForm, editError, setEditError, editFormErrors, setEditFormErrors }
}

function useUpdateCategory({ newCatForm, queryClient, activeBranchId, activeEventId, callingForm, setAddForm, setEditForm, setShowNewCatModal, setEditingCatId, setNewCatForm, setNewCatError }: { newCatForm: { name: string; price: string; includedConsumptions: number; description: string; }; queryClient: QueryClient; activeBranchId: string | null; activeEventId: string | null; callingForm: "add" | "edit" | null; setAddForm: Dispatch<SetStateAction<any>>; setEditForm: Dispatch<SetStateAction<any>>; setShowNewCatModal: Dispatch<SetStateAction<boolean>>; setEditingCatId: Dispatch<SetStateAction<string | null>>; setNewCatForm: Dispatch<SetStateAction<any>>; setNewCatError: Dispatch<SetStateAction<string>> }) {
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
        setAddForm((prev: any) => ({
          ...prev,
          paidAmount: formatThousands(updatedCat.price.toString())
        }))
      } else if (callingForm === "edit") {
        setEditForm((prev: any) => ({
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

  return { updateCategoryMutation }
}

function useAttendeeData({ activeBranchId, activeEventId, searchQuery, filterCategoryId, filterStatus, page, pageSize, activeTab }: { activeBranchId: string | null; activeEventId: string | null; searchQuery: string; filterCategoryId: string; filterStatus: "all" | "checked" | "pending" | "inactive"; page: number; pageSize: number; activeTab: "search" | "add" | "scan" | "dashboard" }) {
  const { data: attendeesResult, isLoading } = useQuery({
    queryKey: ["attendees", activeBranchId, activeEventId, searchQuery, filterCategoryId, filterStatus, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({
        branchId: activeBranchId!,
        eventId: activeEventId!,
        q: searchQuery,
        status: filterStatus,
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString()
      })
      if (filterCategoryId) params.set("categoryId", filterCategoryId)
      const res = await fetch(`/api/attendees?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      return { attendees: json.data as any[], total: json.total as number }
    },
    // Solo se necesita en "search" (la tabla) y "add" (chequeo de cédula duplicada) —
    // no pedirla en dashboard/scan evita un fetch de más en cada edición/check-in.
    enabled: !!activeBranchId && !!activeEventId && (activeTab === "search" || activeTab === "add")
  })

  const attendees = attendeesResult?.attendees
  const attendeesTotal = attendeesResult?.total ?? 0
  const totalPages = Math.max(Math.ceil(attendeesTotal / pageSize), 1)

  // Stats Query for the entries dashboard
  const { data: stats, isLoading: isStatsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["attendees-stats", activeBranchId, activeEventId],
    queryFn: async () => {
      const res = await fetch(`/api/attendees?branchId=${activeBranchId}&eventId=${activeEventId}&stats=true`)
      if (!res.ok) throw new Error("Error fetching stats")
      return (await res.json()).data
    },
    // Solo se ve en la pestaña dashboard — no recalcularla de fondo cada vez que
    // se edita/registra un asistente en otra pestaña.
    enabled: !!activeBranchId && !!activeEventId && activeTab === "dashboard"
  })

  return { isLoading, attendees, attendeesTotal, totalPages, stats, isStatsLoading }
}

function useDayEntryMutation({ dayEntryForm, activeBranchId, activeEventId, closeDayEntryModal, setDayEntryForm, queryClient, setDayEntryError }: { dayEntryForm: { categoryId: string; quantity: string; unitAmount: string; method: "CASH" | "TRANSFER" | "QR" | "CARD"; }; activeBranchId: string | null; activeEventId: string | null; closeDayEntryModal: () => void; setDayEntryForm: Dispatch<SetStateAction<any>>; queryClient: QueryClient; setDayEntryError: Dispatch<SetStateAction<string>> }) {
  const registerDayEntryMutation = useMutation({
    mutationFn: async (data: typeof dayEntryForm) => {
      const res = await fetch("/api/cash/movements/event-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: activeBranchId,
          eventId: activeEventId,
          categoryId: data.categoryId,
          quantity: Number(data.quantity) || 0,
          unitAmount: Number(parseThousands(data.unitAmount)) || 0,
          method: data.method
        })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al registrar el ingreso del día")
      return res.json()
    },
    onSuccess: () => {
      closeDayEntryModal()
      setDayEntryForm({ categoryId: "", quantity: "1", unitAmount: "", method: "CASH" })
      toast.success("Ingreso del día registrado con éxito")
      queryClient.invalidateQueries({ queryKey: ["attendees", activeBranchId, activeEventId] })
      queryClient.invalidateQueries({ queryKey: ["attendees-stats", activeBranchId, activeEventId] })
    },
    onError: (err: any) => {
      setDayEntryError(err.message)
    }
  })

  return { registerDayEntryMutation }
}

function AttendeeCards({ isLoading, attendees, expandedId, reactivateAttendeeMutation, checkInMutation, setExpandedId, handleWhatsAppShare, resendEmailMutation, confirmManualDeliveryMutation, startEditing, handleDeleteAttendee }: { isLoading: boolean; attendees: any[] | undefined; expandedId: string | null; reactivateAttendeeMutation: UseMutationResult<any, any, any, any>; checkInMutation: UseMutationResult<any, any, any, any>; setExpandedId: Dispatch<SetStateAction<string | null>>; handleWhatsAppShare: (a: any) => void; resendEmailMutation: UseMutationResult<any, any, any, any>; confirmManualDeliveryMutation: UseMutationResult<any, any, any, any>; startEditing: (a: any) => void; handleDeleteAttendee: (a: any) => void }) {
  return (
    <div className="md:hidden flex-1 min-w-0 overflow-y-auto overflow-x-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
            {isLoading ? (
              <p className="px-4 py-8 text-center text-emerald-500 text-sm">Cargando asistentes...</p>
            ) : (attendees ?? []).length === 0 ? (
              <p className="px-4 py-8 text-center text-emerald-500 text-sm">No hay asistentes registrados para este evento.</p>
            ) : (
              (attendees ?? []).map((a) => {
                const inactive = !!a.inactiveAt
                const pendingDelivery = !inactive && a.origin !== "EVENT_DAY" && !a.emailSentAt && !a.qrDeliveredManuallyAt
                const expanded = expandedId === a.id
                const iconBtn = "h-9 w-9 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-emerald-500 active:scale-95 transition disabled:opacity-50 cursor-pointer"
                return (
                  <div key={a.id} className={`px-3 py-2.5 ${inactive ? "opacity-60" : pendingDelivery ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug break-words">{a.name}</p>
                        <p className="text-xs text-emerald-500 mt-0.5 truncate">
                          {a.cc} · {a.category.name}
                          {pendingDelivery && <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-semibold">· Sin enviar</span>}
                          {inactive && <span className="ml-1.5 text-red-500 font-semibold">· Inactivo</span>}
                        </p>
                      </div>
                      {inactive ? (
                        <button
                          onClick={() => reactivateAttendeeMutation.mutate(a.id)}
                          disabled={reactivateAttendeeMutation.isPending}
                          className="shrink-0 h-9 px-3 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
                        >
                          <RotateCcw size={14} /> Reactivar
                        </button>
                      ) : (
                        <>
                          {a.hasCheckedIn ? (
                            <span className="shrink-0 h-9 px-3 flex items-center rounded-full text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 whitespace-nowrap">Ingresó</span>
                          ) : (
                            <button
                              onClick={() => checkInMutation.mutate({ qrCodeOrCc: a.cc })}
                              disabled={checkInMutation.isPending}
                              className="shrink-0 h-9 px-4 rounded-full bg-primary text-black text-xs font-bold whitespace-nowrap active:scale-95 transition disabled:opacity-50 cursor-pointer"
                            >
                              Check-in
                            </button>
                          )}
                          <button
                            aria-label="Más acciones"
                            aria-expanded={expanded}
                            onClick={() => setExpandedId(expanded ? null : a.id)}
                            className={`${iconBtn} shrink-0`}
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </>
                      )}
                    </div>
                    {expanded && !inactive && (
                      <div className="mt-2 flex items-center justify-end gap-1.5 animate-in fade-in duration-150">
                        {a.phone && <button aria-label="Enviar por WhatsApp" onClick={() => handleWhatsAppShare(a)} className={iconBtn}><WhatsAppIcon size={16} /></button>}
                        {a.email && <button aria-label="Reenviar correo" onClick={() => resendEmailMutation.mutate(a.id)} disabled={resendEmailMutation.isPending} className={iconBtn}><Mail size={16} /></button>}
                        {pendingDelivery && <button aria-label="Confirmar QR enviado por otro medio" onClick={() => confirmManualDeliveryMutation.mutate(a.id)} disabled={confirmManualDeliveryMutation.isPending} className={`${iconBtn} !text-amber-600 dark:!text-amber-400`}><CheckCircle2 size={16} /></button>}
                        <button aria-label="Editar" onClick={() => startEditing(a)} className={iconBtn}><Edit size={16} /></button>
                        <button aria-label="Desactivar" onClick={() => handleDeleteAttendee(a)} className={`${iconBtn} hover:!text-red-500`}><UserX size={16} /></button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
  )
}

function AttendeeTable({ isLoading, attendees, reactivateAttendeeMutation, checkInMutation, setExpandedId, expandedId, handleWhatsAppShare, resendEmailMutation, confirmManualDeliveryMutation, startEditing, handleDeleteAttendee }: { isLoading: boolean; attendees: any[] | undefined; reactivateAttendeeMutation: UseMutationResult<any, any, any, any>; checkInMutation: UseMutationResult<any, any, any, any>; setExpandedId: Dispatch<SetStateAction<string | null>>; expandedId: string | null; handleWhatsAppShare: (a: any) => void; resendEmailMutation: UseMutationResult<any, any, any, any>; confirmManualDeliveryMutation: UseMutationResult<any, any, any, any>; startEditing: (a: any) => void; handleDeleteAttendee: (a: any) => void }) {
  return (
    <div className="hidden md:block flex-1 overflow-y-auto p-0">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-2 font-medium text-emerald-500">Asistente</th>
                  <th className="px-4 py-2 font-medium text-emerald-500">Cédula</th>
                  <th className="px-4 py-2 font-medium text-emerald-500">Categoría</th>
                  <th className="px-4 py-2 font-medium text-emerald-500 text-right">Estado / Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-emerald-500">Cargando asistentes...</td>
                  </tr>
                ) : attendees?.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-emerald-500">No hay asistentes registrados para este evento.</td>
                  </tr>
                ) : (
                  (attendees ?? [])
                    .map((a) => {
                      // Los ingresos del día (Ingreso Día) no tienen QR/ticket que entregar,
                      // así que nunca cuentan como "pendiente de envío".
                      const inactive = !!a.inactiveAt
                      const pendingDelivery = !inactive && a.origin !== "EVENT_DAY" && !a.emailSentAt && !a.qrDeliveredManuallyAt
                      return (
                        <tr
                          key={a.id}
                          className={`transition-colors ${
                            inactive ? "opacity-60" : pendingDelivery
                              ? "bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/30"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                          }`}
                        >
                          <td className="px-4 py-2 font-medium">
                            <div className="flex items-center gap-2">
                              {a.name}
                              {pendingDelivery && (
                                <span className="text-amber-700 dark:text-amber-400 font-semibold text-[10px] bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                                  Sin enviar
                                </span>
                              )}
                              {inactive && (
                                <span className="text-red-600 dark:text-red-400 font-semibold text-[10px] bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                                  Inactivo
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-emerald-500">{a.cc}</td>
                          <td className="px-4 py-2 text-emerald-500">
                            <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">{a.category.name}</span>
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap w-px">
                            {inactive ? (
                              <button
                                onClick={() => reactivateAttendeeMutation.mutate(a.id)}
                                disabled={reactivateAttendeeMutation.isPending}
                                className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw size={12} /> Reactivar
                              </button>
                            ) : (
                            <div className="flex flex-col items-end gap-1.5">
                              <div className="flex items-center justify-end gap-2">
                              {a.hasCheckedIn ? (
                                <span className="whitespace-nowrap text-green-600 dark:text-green-400 font-medium text-xs bg-green-50 dark:bg-green-900/20 px-3 h-8 inline-flex items-center rounded-md">Ingresó</span>
                              ) : (
                                <button
                                  onClick={() => checkInMutation.mutate({ qrCodeOrCc: a.cc })}
                                  disabled={checkInMutation.isPending}
                                  className="text-xs whitespace-nowrap bg-indigo-50 dark:bg-indigo-900/30 text-indigo-650 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 h-8 rounded-md font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  {checkInMutation.isPending ? "Procesando..." : "Check-in"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                                aria-expanded={expandedId === a.id}
                                aria-label="Más acciones"
                                title="Más acciones"
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-zinc-800/80 text-emerald-500 hover:bg-zinc-800/80 cursor-pointer"
                              >
                                {expandedId === a.id ? <X size={14} /> : <MoreHorizontal size={14} />}
                              </button>
                              </div>
                              {expandedId === a.id && (
                                <div className="flex items-center gap-0.5 animate-in fade-in slide-in-from-right-2 duration-150 rounded-md border border-zinc-800/80 bg-zinc-950/40 p-0.5">
                                {a.phone && (
                                  <button
                                    onClick={() => handleWhatsAppShare(a)}
                                    className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-zinc-800/80 cursor-pointer text-emerald-500 hover:text-green-500 dark:hover:text-green-400 transition-colors"
                                    title="Enviar por WhatsApp"
                                  >
                                    <WhatsAppIcon size={14} />
                                  </button>
                                )}
                                {a.email && (
                                  <button
                                    onClick={() => resendEmailMutation.mutate(a.id)}
                                    disabled={resendEmailMutation.isPending}
                                    className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-zinc-800/80 cursor-pointer text-emerald-500 hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
                                    title={resendEmailMutation.isPending ? "Reenviando..." : "Reenviar Correo"}
                                  >
                                    <Mail size={14} />
                                  </button>
                                )}
                                {pendingDelivery && (
                                  <button
                                    onClick={() => confirmManualDeliveryMutation.mutate(a.id)}
                                    disabled={confirmManualDeliveryMutation.isPending}
                                    className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-zinc-800/80 cursor-pointer text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors disabled:opacity-50"
                                    title="Confirmar que ya se le envió el QR por otro medio"
                                  >
                                    <CheckCircle2 size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={() => startEditing(a)}
                                  className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-zinc-800/80 cursor-pointer text-emerald-500 hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors"
                                  title="Editar"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteAttendee(a)}
                                  className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-zinc-800/80 cursor-pointer text-emerald-500 hover:text-red-650 dark:hover:text-red-400 transition-colors"
                                  title="Desactivar"
                                >
                                  <UserX size={14} />
                                </button>
                              </div>
                              )}
                            </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                )}
              </tbody>
            </table>
          </div>
  )
}
