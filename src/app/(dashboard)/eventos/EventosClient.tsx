"use client"

import { useState, useEffect } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Calendar, Plus, Edit2, ShieldAlert, Users, QrCode, MapPin, Mail, Settings, Upload, MessageCircle } from "lucide-react"
import Link from "next/link"
import { useContextStore } from "@/stores/contextStore"
import { processImageToSvg } from "@/shared/utils/image"
import type { Dispatch, SetStateAction } from "react"
import type { UseMutationResult } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"

interface Branch {
  id: string
  name: string
  logoUrl?: string | null
  logoBgColor?: string | null
  logoSize?: number | null
}

interface Event {
  id: string
  branchId: string
  name: string
  slug: string
  description: string
  startsAt: string
  endsAt: string
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
  branch: Branch

  // QR Config
  qrPrefix: string
  qrFillColor: string
  qrBackgroundColor: string
  qrLogoBackgroundColor: string
  qrLogoScale: number
  qrLogoUrl: string | null
  logoUrl: string | null
  flyerUrl: string | null
  emailLogoSize: number

  // Venue
  accessPolicy: string
  venueName: string
  mapsUrl: string | null
  mapsLabel: string
  dressCode: string

  // Email Template
  emailSubject: string
  emailPreheader: string
  emailHeading: string
  emailIntro: string
  emailMessageTitle: string
  emailBody: string
  emailWarningTitle: string
  emailWarningText: string
  emailDetailsTitle: string
  emailDateText: string
  emailTimeText: string
  emailQrTitle: string
  emailQrNote: string
  emailFooter: string
  emailClosingText: string
  emailTeamSignature: string
  emailLegalNote: string

  // Email Colors
  emailBackgroundColor: string
  emailCardColor: string
  emailHeaderBackgroundColor: string
  emailTextColor: string
  emailTitleColor: string
  emailMutedTextColor: string
  emailAccentColor: string
  emailBorderColor: string
  emailSectionBackgroundColor: string
  emailWarningBackgroundColor: string

  // SMTP Config
  emailHost?: string | null
  emailPort?: number | null
  emailSecure?: boolean
  emailUser?: string | null
  emailPassword?: string | null
  emailFrom?: string | null

  // WhatsApp
  whatsappMessage?: string
}

const toDatetimeLocal = (dateStr: string | Date) => {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const getInitialCreateForm = (branchId: string) => ({
  branchId,
  name: "",
  description: "",
  startsAt: toDatetimeLocal(new Date()),
  endsAt: toDatetimeLocal(new Date(Date.now() + 86400000)),
  status: "DRAFT" as const,

  // QR Config
  qrPrefix: "EVT",
  qrFillColor: "#102542",
  qrBackgroundColor: "#f8f9fa",
  qrLogoBackgroundColor: "#ffffff",
  qrLogoScale: 4,
  qrLogoUrl: "",
  logoUrl: "",
  flyerUrl: "",
  emailLogoSize: 80,

  // Venue
  accessPolicy: "",
  venueName: "Terrazas Campestres - K3 Via Totoro",
  mapsUrl: "",
  mapsLabel: "Abrir en Google Maps",
  dressCode: "Todos de negro",

  // SMTP Config
  emailHost: "smtp.gmail.com",
  emailPort: 587,
  emailSecure: false,
  emailUser: "zamamotas@gmail.com",
  emailPassword: "",
  emailFrom: "EVENT <zamamotas@gmail.com>",

  // Email Template
  emailSubject: "Tu acceso está listo: {nombre_evento}",
  emailPreheader: "Popayan se viste de negro - Todos de negro - Closing 2025",
  emailHeading: "Hola {nombre_asistente}",
  emailIntro: "Tu asistencia ha sido confirmada. Abajo tienes la info oficial del evento:",
  emailMessageTitle: "Mensaje del evento",
  emailBody: "Tu registro para {nombre_evento} fue confirmado.\n\nFecha: {fecha_evento}\nCategoria: {nombre_categoria} - Valor: {valor_entrada}\nQR: {codigo_qr}\n\nAdjuntamos tu codigo QR para el ingreso.",
  emailWarningTitle: "Importante",
  emailWarningText: "Ingreso Early hasta las 11:00 PM. Después de esa hora aplica multa de $25.000.",
  emailDetailsTitle: "Detalles",
  emailDateText: "{fecha_evento}",
  emailTimeText: "{hora_evento}",
  emailQrTitle: "Tu código QR está adjunto a este correo",
  emailQrNote: "Preséntalo junto a tu cédula en la entrada.",
  emailFooter: "Presenta este correo en la entrada del evento.",
  emailClosingText: "Nos vemos pronto.",
  emailTeamSignature: "{nombre_sucursal}",
  emailLegalNote: "Correo automático - conserva tu QR hasta el día del evento.",

  // Email Colors
  emailBackgroundColor: "#000000",
  emailCardColor: "#0c0c0e",
  emailHeaderBackgroundColor: "#000000",
  emailTextColor: "#ffffff",
  emailTitleColor: "#ffffff",
  emailMutedTextColor: "#a1a1aa",
  emailAccentColor: "#00ffcc",
  emailBorderColor: "#1f1f26",
  emailSectionBackgroundColor: "#070709",
  emailWarningBackgroundColor: "#1c0d0d",
})

const getValidImageUrl = (url: string | null | undefined) => {
  if (!url) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("<svg")) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`;
  }
  return url;
}

// Lectura pura: solo renderiza el QR y no guarda nada. Usa POST porque el logo puede ser
// un data URL demasiado largo para ir en la URL de un GET.
async function fetchQrPreview(payload: string, signal: AbortSignal): Promise<string> {
  let res: Response
  try {
    res = await fetch("/api/events/qr-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal,
    })
  } catch (err: any) {
    if (signal.aborted) throw err
    console.error("Error fetching QR preview:", err)
    throw new Error("Error de red al generar QR: " + err.message)
  }
  if (!res.ok) {
    const text = await res.text()
    console.error("QR preview error response:", text)
    throw new Error("Error generando vista previa QR: " + text)
  }
  const data = await res.json()
  if (data.debug) console.log("QR Debug:", data.debug)
  // Keep configForm.qrLogoUrl as the uploaded URL instead of overwriting with the massive SVG.
  return data.data
}

export function EventosClient({ initialEvents, branches }: { initialEvents: Event[]; branches: Branch[] }) {
  const queryClient = useQueryClient()
  const { activeBranchId } = useContextStore()
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false)
  const [activeConfigTab, setActiveConfigTab] = useState<"general" | "qr" | "venue" | "email" | "wpp" | "products">("general")
  const [errorMsg, setErrorMsg] = useState("")


  const filteredEvents = activeBranchId
    ? events.filter(e => e.branchId === activeBranchId)
    : events

  const [eventProductsConfig, setEventProductsConfig] = useState<{ productId: string; name: string; basePrice: number; isEnabled: boolean; eventPrice: string | number }[]>([])

  const [createForm, setCreateForm] = useState(() => getInitialCreateForm(branches[0]?.id || ""))


  const [configForm, setConfigForm] = useState<any>({})

  // Vista previa del QR: la clave es el payload con debounce, así se regenera solo cuando
  // el usuario deja de editar y React Query cancela/descarta las respuestas viejas.
  const qrPreviewPayload = JSON.stringify({
    qrPrefix: configForm.qrPrefix,
    qrFillColor: configForm.qrFillColor,
    qrBackgroundColor: configForm.qrBackgroundColor,
    qrLogoBackgroundColor: configForm.qrLogoBackgroundColor || "#ffffff",
    qrLogoScale: configForm.qrLogoScale || 4,
    qrLogoUrl: configForm.qrLogoUrl || selectedEvent?.branch?.logoUrl || "",
  })
  const [debouncedQrPayload, setDebouncedQrPayload] = useState(qrPreviewPayload)
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedQrPayload(qrPreviewPayload), 500)
    return () => clearTimeout(timeoutId)
  }, [qrPreviewPayload])

  const { data: qrPreviewImage, isFetching: isGeneratingQr, error: qrPreviewError } = useQuery<string>({
    queryKey: ["qr-preview", debouncedQrPayload],
    queryFn: ({ signal }) => fetchQrPreview(debouncedQrPayload, signal),
    enabled: activeConfigTab === "qr" || activeConfigTab === "email" || activeConfigTab === "wpp",
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // El resultado solo depende del payload; no guardar imágenes grandes tras salir
    staleTime: Infinity,
    gcTime: 0,
  })

  useEffect(() => {
    if (qrPreviewError) alert(qrPreviewError.message)
  }, [qrPreviewError])
  const { effectiveLogoUrl, effectiveLogoBgColor, effectiveLogoScale, effectiveLogoHref, effectiveEmailLogoHref } = useEffectiveLogos({ selectedEvent, configForm })
  const { replacePreviewTemplates, getWhatsAppPreviewMessage, handleAnalyzeFlyerColors } = useFlyerTools({ selectedEvent, configForm, setConfigForm })

  const loadEventProducts = async (evtId: string, brId: string) => {
    setErrorMsg("")
    try {
      const res = await fetch(`/api/sales/event-products?branchId=${brId}&eventId=${evtId}&activeOnly=false`)
      if (!res.ok) throw new Error("Error al cargar productos")
      const json = await res.json()
      setEventProductsConfig(json.data.map((item: any) => ({
        productId: item.productId,
        name: item.name,
        basePrice: Number(item.basePrice),
        isEnabled: item.isEnabled,
        eventPrice: item.eventPrice !== null ? Number(item.eventPrice) : ""
      })))
    } catch (err: any) {
      setErrorMsg(err.message)
    }
  }
  const { createEventMutation, updateEventMutation, deleteEventMutation } = useEventMutations({ createForm, queryClient, branches, setEvents, setShowCreateModal, setCreateForm, setErrorMsg, selectedEvent, setShowConfigModal, setSelectedEvent, eventProductsConfig })

  const handleOpenConfig = (event: Event) => {
    setSelectedEvent(event)
    setConfigForm({
      name: event.name,
      description: event.description,
      startsAt: toDatetimeLocal(event.startsAt),
      endsAt: toDatetimeLocal(event.endsAt),
      status: event.status,

      // QR
      qrPrefix: event.qrPrefix || "EVT",
      qrFillColor: event.qrFillColor || "#102542",
      qrBackgroundColor: event.qrBackgroundColor || "#f8f9fa",
      qrLogoBackgroundColor: event.qrLogoBackgroundColor || "#ffffff",
      qrLogoScale: event.qrLogoScale || 4,
      qrLogoUrl: event.qrLogoUrl || "",
      logoUrl: event.logoUrl || "",
      flyerUrl: event.flyerUrl || "",
      emailLogoSize: event.emailLogoSize || 80,

      // Venue
      accessPolicy: event.accessPolicy || "",
      venueName: event.venueName || "",
      mapsUrl: event.mapsUrl || "",
      mapsLabel: event.mapsLabel || "Abrir en Google Maps",
      dressCode: event.dressCode || "",

      // SMTP Config
      emailHost: event.emailHost ?? "smtp.gmail.com",
      emailPort: event.emailPort ?? 587,
      emailSecure: event.emailSecure ?? false,
      emailUser: event.emailUser ?? "zamamotas@gmail.com",
      emailPassword: "", // vacío = mantener la contraseña guardada
      emailFrom: event.emailFrom ?? "EVENT <zamamotas@gmail.com>",

      // Email Template
      emailSubject: event.emailSubject || "",
      emailPreheader: event.emailPreheader || "",
      emailHeading: event.emailHeading || "",
      emailIntro: event.emailIntro || "",
      emailMessageTitle: event.emailMessageTitle || "Mensaje del evento",
      emailBody: event.emailBody || "",
      emailWarningTitle: event.emailWarningTitle || "Importante",
      emailWarningText: event.emailWarningText || "",
      emailDetailsTitle: event.emailDetailsTitle || "Detalles",
      emailDateText: event.emailDateText || "",
      emailTimeText: event.emailTimeText || "",
      emailQrTitle: event.emailQrTitle || "",
      emailQrNote: event.emailQrNote || "",
      emailFooter: event.emailFooter || "",
      emailClosingText: event.emailClosingText || "",
      emailTeamSignature: event.emailTeamSignature || "",
      emailLegalNote: event.emailLegalNote || "",

      // Email Colors
      emailBackgroundColor: event.emailBackgroundColor || "#000000",
      emailCardColor: event.emailCardColor || "#0c0c0e",
      emailHeaderBackgroundColor: event.emailHeaderBackgroundColor || "#000000",
      emailTextColor: event.emailTextColor || "#ffffff",
      emailTitleColor: event.emailTitleColor || "#ffffff",
      emailMutedTextColor: event.emailMutedTextColor || "#a1a1aa",
      emailAccentColor: event.emailAccentColor || "#00ffcc",
      emailBorderColor: event.emailBorderColor || "#1f1f26",
      emailSectionBackgroundColor: event.emailSectionBackgroundColor || "#070709",
      emailWarningBackgroundColor: event.emailWarningBackgroundColor || "#1c0d0d",

      // WhatsApp
      whatsappMessage: event.whatsappMessage || "¡Hola, {nombre_asistente}! 🎟️\n\nTu registro para *{nombre_evento}* ha sido confirmado.\n\n*Detalles del Evento:*\n📅 *Fecha:* {fecha_evento}\n📍 *Lugar:* {lugar_evento}\n🎫 *Categoría:* {nombre_categoria}\n\n📥 *Descarga tu Código QR de Acceso:* \n{link_qr}\n\n¡Te esperamos!",
    })
    setActiveConfigTab("general")
    setErrorMsg("")
    loadEventProducts(event.id, event.branchId)
    setShowConfigModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="w-full sm:w-auto">
          <h2 className="text-2xl font-bold tracking-tight">Eventos</h2>
          <p className="text-emerald-500">Gestiona los eventos, accesos y configuraciones.</p>
        </div>
        <button
          onClick={() => {
            setErrorMsg("")
            setCreateForm(prev => ({
              ...prev,
              branchId: activeBranchId || branches[0]?.id || ""
            }))
            setShowAdvancedCreate(false)
            setShowCreateModal(true)
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 w-full sm:w-auto justify-center rounded-md font-medium transition-colors"
        >
          <Plus size={18} />
          Nuevo Evento
        </button>
      </div>

      <EventGrid filteredEvents={filteredEvents} handleOpenConfig={handleOpenConfig} />

      {/* CREATE EVENT MODAL */}
      <CreateEventModal showCreateModal={showCreateModal} setShowCreateModal={setShowCreateModal} errorMsg={errorMsg} createEventMutation={createEventMutation} createForm={createForm} setCreateForm={setCreateForm} branches={branches} setShowAdvancedCreate={setShowAdvancedCreate} showAdvancedCreate={showAdvancedCreate} />

      {/* ADVANCED CONFIG MODAL */}
      <ConfigEventModal showConfigModal={showConfigModal} selectedEvent={selectedEvent} activeConfigTab={activeConfigTab} setShowConfigModal={setShowConfigModal} setSelectedEvent={setSelectedEvent} setActiveConfigTab={setActiveConfigTab} errorMsg={errorMsg} updateEventMutation={updateEventMutation} configForm={configForm} setConfigForm={setConfigForm} effectiveLogoScale={effectiveLogoScale} effectiveLogoUrl={effectiveLogoUrl} effectiveLogoBgColor={effectiveLogoBgColor} handleAnalyzeFlyerColors={handleAnalyzeFlyerColors} isGeneratingQr={isGeneratingQr} qrPreviewImage={qrPreviewImage} replacePreviewTemplates={replacePreviewTemplates} effectiveEmailLogoHref={effectiveEmailLogoHref} effectiveLogoHref={effectiveLogoHref} getWhatsAppPreviewMessage={getWhatsAppPreviewMessage} deleteEventMutation={deleteEventMutation} />
    </div>
  )
}

function EventGrid({ filteredEvents, handleOpenConfig }: { filteredEvents: Event[]; handleOpenConfig: (event: Event) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEvents.map((event) => (
          <div
            key={event.id}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex flex-col transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between mb-4">
              {event.flyerUrl ? (
                <div className="w-12 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
                  <a href={event.flyerUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <img
                      src={getValidImageUrl(event.flyerUrl)}
                      alt={`Abrir flyer de ${event.name}`}
                      className="w-full h-full object-cover hover:scale-110 transition-transform"
                    />
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg shrink-0">
                  <Calendar className="text-zinc-600 dark:text-emerald-500 w-6 h-6" />
                </div>
              )}
              <div className="flex flex-col items-end gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    event.status === "ACTIVE"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : event.status === "DRAFT"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-emerald-500"
                  }`}
                >
                  {event.status}
                </span>
              </div>
            </div>

            <h3 className="font-semibold text-lg leading-tight">{event.name}</h3>
            <p className="text-sm text-emerald-500 mt-1">Sucursal: {event.branch?.name}</p>
            <p className="text-xs text-emerald-500 mt-2">
              📅 {new Date(event.startsAt).toLocaleString('es-CO', { timeZone: process.env.NEXT_PUBLIC_TIMEZONE || 'America/Bogota' })}
            </p>

            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3 mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => handleOpenConfig(event)}
                className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1"
              >
                <Settings size={14} /> Configurar
              </button>
              <Link
                href={`/entrada?eventId=${event.id}`}
                className="text-sm text-zinc-600 dark:text-emerald-500 font-medium hover:underline flex items-center gap-1"
              >
                <Users size={14} /> Asistentes
              </Link>
            </div>
          </div>
        ))}

        {filteredEvents.length === 0 && (
          <div className="col-span-full py-12 text-center text-emerald-500 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            No hay eventos creados.
          </div>
        )}
      </div>
  )
}

function CreateEventModal({ showCreateModal, setShowCreateModal, errorMsg, createEventMutation, createForm, setCreateForm, branches, setShowAdvancedCreate, showAdvancedCreate }: { showCreateModal: boolean; setShowCreateModal: Dispatch<SetStateAction<boolean>>; errorMsg: string; createEventMutation: UseMutationResult<any, any, any, any>; createForm: any; setCreateForm: Dispatch<SetStateAction<any>>; branches: Branch[]; setShowAdvancedCreate: Dispatch<SetStateAction<boolean>>; showAdvancedCreate: boolean }) {
  return (
    <>{showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Calendar className="text-indigo-600" /> Nuevo Evento
              </h3>
              <button aria-label="Cerrar"
                onClick={() => setShowCreateModal(false)}
                className="text-emerald-500 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <ShieldAlert size={16} /> {errorMsg}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                createEventMutation.mutate(createForm)
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="eventos-sucursal" className="text-xs font-semibold text-emerald-500 block mb-1">Sucursal</label>
                <select id="eventos-sucursal"
                  value={createForm.branchId}
                  onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="eventos-nombre-del-evento" className="text-xs font-semibold text-emerald-500 block mb-1">Nombre del Evento</label>
                <input id="eventos-nombre-del-evento"
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="eventos-descripcion" className="text-xs font-semibold text-emerald-500 block mb-1">Descripción</label>
                <textarea id="eventos-descripcion"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="eventos-inicia" className="text-xs font-semibold text-emerald-500 block mb-1">Inicia</label>
                  <input id="eventos-inicia"
                    type="datetime-local"
                    value={createForm.startsAt}
                    onChange={(e) => setCreateForm({ ...createForm, startsAt: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="eventos-termina" className="text-xs font-semibold text-emerald-500 block mb-1">Termina</label>
                  <input id="eventos-termina"
                    type="datetime-local"
                    value={createForm.endsAt}
                    onChange={(e) => setCreateForm({ ...createForm, endsAt: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedCreate(!showAdvancedCreate)}
                className="w-full flex items-center justify-between py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border-t border-zinc-150 dark:border-zinc-800/60 mt-2 hover:underline"
              >
                <span>{showAdvancedCreate ? "▼ Ocultar Configuración Avanzada" : "▶ Mostrar Configuración Avanzada (Lugar, Correo, SMTP)"}</span>
              </button>

              {showAdvancedCreate && (
                <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 max-h-[35vh] overflow-y-auto pr-1">
                  {/* Imágenes */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Imágenes del Evento</p>
                    <div>
                      <label htmlFor="eventos-flyer-del-evento-imagen" className="text-xs text-emerald-500 block mb-1">Flyer del Evento (Imagen)</label>
                      <div className="flex flex-wrap gap-2 items-center">
                        <input id="eventos-flyer-del-evento-imagen"
                          type="text"
                          value={createForm.flyerUrl || ""}
                          onChange={(e) => setCreateForm({ ...createForm, flyerUrl: e.target.value })}
                          placeholder="URL del Flyer"
                          className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <label className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 shrink-0">
                          <Upload size={14} />
                          <input aria-label="Subir imagen del flyer"
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              try {
                                const resultStr = await processImageToSvg(file, 1000, 0.85)
                                setCreateForm({ ...createForm, flyerUrl: resultStr })
                              } catch (err: any) {
                                // Ignore
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Lugar y Fecha */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Lugar y Código de Vestimenta</p>
                    <div>
                      <label htmlFor="eventos-nombre-del-lugar-venue" className="text-xs text-emerald-500 block mb-1">Nombre del Lugar (Venue)</label>
                      <input id="eventos-nombre-del-lugar-venue"
                        type="text"
                        value={createForm.venueName}
                        onChange={(e) => setCreateForm({ ...createForm, venueName: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="eventos-dress-code" className="text-xs text-emerald-500 block mb-1">Dress Code</label>
                        <input id="eventos-dress-code"
                          type="text"
                          value={createForm.dressCode}
                          onChange={(e) => setCreateForm({ ...createForm, dressCode: e.target.value })}
                          className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="eventos-etiqueta-de-mapa" className="text-xs text-emerald-500 block mb-1">Etiqueta de Mapa</label>
                        <input id="eventos-etiqueta-de-mapa"
                          type="text"
                          value={createForm.mapsLabel}
                          onChange={(e) => setCreateForm({ ...createForm, mapsLabel: e.target.value })}
                          className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="eventos-google-maps-url" className="text-xs text-emerald-500 block mb-1">Google Maps URL</label>
                      <input id="eventos-google-maps-url"
                        type="text"
                        value={createForm.mapsUrl}
                        onChange={(e) => setCreateForm({ ...createForm, mapsUrl: e.target.value })}
                        placeholder="https://maps.google.com/..."
                        className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-3 border-zinc-100 dark:border-zinc-800">
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Servidor de Correo (SMTP)</p>
                    <p className="text-xs text-zinc-500 mt-1">El correo de envío es único para todo el sistema y se configura con las variables SMTP_USER, SMTP_PASSWORD y SMTP_FROM del servidor.</p>
                  </div>

                  {/* Contenido Plantilla */}
                  <div className="border-t pt-3 border-zinc-100 dark:border-zinc-800 space-y-3">
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Plantilla del Email</p>
                    <div>
                      <label htmlFor="eventos-asunto-del-correo" className="text-xs text-emerald-500 block mb-1">Asunto del Correo</label>
                      <input id="eventos-asunto-del-correo"
                        type="text"
                        value={createForm.emailSubject}
                        onChange={(e) => setCreateForm({ ...createForm, emailSubject: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="eventos-preheader" className="text-xs text-emerald-500 block mb-1">Preheader</label>
                        <input id="eventos-preheader"
                          type="text"
                          value={createForm.emailPreheader}
                          onChange={(e) => setCreateForm({ ...createForm, emailPreheader: e.target.value })}
                          className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="eventos-titulo-mensaje-heading" className="text-xs text-emerald-500 block mb-1">Título Mensaje (Heading)</label>
                        <input id="eventos-titulo-mensaje-heading"
                          type="text"
                          value={createForm.emailHeading}
                          onChange={(e) => setCreateForm({ ...createForm, emailHeading: e.target.value })}
                          className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="eventos-mensaje-introductorio" className="text-xs text-emerald-500 block mb-1">Mensaje Introductorio</label>
                      <textarea id="eventos-mensaje-introductorio"
                        value={createForm.emailIntro}
                        onChange={(e) => setCreateForm({ ...createForm, emailIntro: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label htmlFor="eventos-cuerpo-del-correo" className="text-xs text-emerald-500 block mb-1">Cuerpo del Correo</label>
                      <textarea id="eventos-cuerpo-del-correo"
                        value={createForm.emailBody}
                        onChange={(e) => setCreateForm({ ...createForm, emailBody: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        rows={4}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="eventos-titulo-de-advertencia" className="text-xs text-emerald-500 block mb-1">Título de Advertencia</label>
                        <input id="eventos-titulo-de-advertencia"
                          type="text"
                          value={createForm.emailWarningTitle}
                          onChange={(e) => setCreateForm({ ...createForm, emailWarningTitle: e.target.value })}
                          className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="eventos-firma-de-equipo" className="text-xs text-emerald-500 block mb-1">Firma de Equipo</label>
                        <input id="eventos-firma-de-equipo"
                          type="text"
                          value={createForm.emailTeamSignature}
                          onChange={(e) => setCreateForm({ ...createForm, emailTeamSignature: e.target.value })}
                          className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="eventos-texto-de-advertencia" className="text-xs text-emerald-500 block mb-1">Texto de Advertencia</label>
                      <textarea id="eventos-texto-de-advertencia"
                        value={createForm.emailWarningText}
                        onChange={(e) => setCreateForm({ ...createForm, emailWarningText: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end w-full pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border w-full sm:w-auto justify-center rounded-md text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createEventMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Crear Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}</>
  )
}

type ConfigTabId = "general" | "qr" | "venue" | "email" | "wpp" | "products"

const CONFIG_TABS: { id: ConfigTabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "qr", label: "Diseño QR" },
  { id: "venue", label: "Venue/Lugar" },
  { id: "email", label: "Plantilla Email" },
  { id: "wpp", label: "Plantilla Wpp" },
]

function ConfigEventModal({ showConfigModal, selectedEvent, activeConfigTab, setShowConfigModal, setSelectedEvent, setActiveConfigTab, errorMsg, updateEventMutation, configForm, setConfigForm, effectiveLogoScale, effectiveLogoUrl, effectiveLogoBgColor, handleAnalyzeFlyerColors, isGeneratingQr, qrPreviewImage, replacePreviewTemplates, effectiveEmailLogoHref, effectiveLogoHref, getWhatsAppPreviewMessage, deleteEventMutation }: { showConfigModal: boolean; selectedEvent: Event | null; activeConfigTab: ConfigTabId; setShowConfigModal: Dispatch<SetStateAction<boolean>>; setSelectedEvent: Dispatch<SetStateAction<Event | null>>; setActiveConfigTab: Dispatch<SetStateAction<ConfigTabId>>; errorMsg: string; updateEventMutation: UseMutationResult<any, any, any, any>; configForm: any; setConfigForm: Dispatch<any>; effectiveLogoScale: any; effectiveLogoUrl: string; effectiveLogoBgColor: any; handleAnalyzeFlyerColors: () => void; isGeneratingQr: boolean; qrPreviewImage: string | undefined; replacePreviewTemplates: (text: string) => string; effectiveEmailLogoHref: string; effectiveLogoHref: string; getWhatsAppPreviewMessage: () => string; deleteEventMutation: UseMutationResult<any, any, any, any> }) {
  if (!showConfigModal || !selectedEvent) return null

  const hasPreview = activeConfigTab === "qr" || activeConfigTab === "email" || activeConfigTab === "wpp"
  const closeModal = () => {
    setShowConfigModal(false)
    setSelectedEvent(null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full shadow-xl max-h-[95vh] overflow-y-auto space-y-4 transition-[max-width] duration-300 ${
        hasPreview ? "max-w-5xl" : "max-w-xl"
      }`}>
        <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Settings className="text-indigo-600" /> Configuración: {selectedEvent.name}
          </h3>
          <button aria-label="Cerrar"
            onClick={closeModal}
            className="text-emerald-500 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-semibold"
          >
            ✕
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-2">
          {CONFIG_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveConfigTab(tab.id)}
              className={`flex-1 pb-2 text-sm font-semibold border-b-2 text-center transition-colors ${
                activeConfigTab === tab.id
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-emerald-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
            <ShieldAlert size={16} /> {errorMsg}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            updateEventMutation.mutate(configForm)
          }}
          className="space-y-4"
        >
          <div className={`grid gap-6 ${hasPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
            <div className="space-y-4">
              {/* TAB CONTENT: GENERAL */}
              <GeneralConfigTab activeConfigTab={activeConfigTab} configForm={configForm} setConfigForm={setConfigForm} />

              {/* TAB CONTENT: QR DESIGN */}
              <QrConfigTab activeConfigTab={activeConfigTab} configForm={configForm} setConfigForm={setConfigForm} effectiveLogoScale={effectiveLogoScale} effectiveLogoUrl={effectiveLogoUrl} effectiveLogoBgColor={effectiveLogoBgColor} />

              {/* TAB CONTENT: VENUE */}
              <VenueConfigTab activeConfigTab={activeConfigTab} configForm={configForm} setConfigForm={setConfigForm} />

              {/* TAB CONTENT: EMAIL TEMPLATE */}
              <EmailConfigTab activeConfigTab={activeConfigTab} configForm={configForm} setConfigForm={setConfigForm} handleAnalyzeFlyerColors={handleAnalyzeFlyerColors} />

              {activeConfigTab === "wpp" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                      <MessageCircle size={16} className="text-emerald-500" />
                      Mensaje de WhatsApp
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="eventos-cuerpo-del-mensaje" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Cuerpo del Mensaje</label>
                        <textarea id="eventos-cuerpo-del-mensaje"
                          value={configForm.whatsappMessage || ""}
                          onChange={(e) => setConfigForm({ ...configForm, whatsappMessage: e.target.value })}
                          className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md p-3 text-sm focus:ring-2 focus:ring-emerald-500 min-h-[220px]"
                          placeholder="¡Hola, {nombre_asistente}! 🎟️..."
                        />
                        <p className="text-[10px] text-emerald-500 mt-1">
                          Variables: {"{nombre_asistente}, {nombre_evento}, {fecha_evento}, {lugar_evento}, {nombre_categoria}, {link_qr}, {flyer_evento}, {link_mapa}, {valor_entrada}"}
                        </p>
                      </div>
                      <div className="text-xs text-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                        El flyer del evento configurado en la pestaña "Diseño QR" se adjuntará automáticamente como una imagen en el mensaje de WhatsApp.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Previews (Only for QR, Email and WhatsApp) */}
            {hasPreview && (
              <div className="flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/80 sticky top-0 min-h-[350px]">
                {activeConfigTab === "qr" && <QrPreview configForm={configForm} isGeneratingQr={isGeneratingQr} qrPreviewImage={qrPreviewImage} />}
                {activeConfigTab === "email" && <EmailTemplatePreview configForm={configForm} replacePreviewTemplates={replacePreviewTemplates} effectiveEmailLogoHref={effectiveEmailLogoHref} selectedEvent={selectedEvent} effectiveLogoScale={effectiveLogoScale} effectiveLogoUrl={effectiveLogoUrl} effectiveLogoBgColor={effectiveLogoBgColor} effectiveLogoHref={effectiveLogoHref} />}
                {activeConfigTab === "wpp" && <WhatsAppPreview configForm={configForm} getWhatsAppPreviewMessage={getWhatsAppPreviewMessage} />}
              </div>
            )}
          </div>

          <ConfigEventActions eventId={selectedEvent.id} closeModal={closeModal} updateEventMutation={updateEventMutation} deleteEventMutation={deleteEventMutation} />
        </form>
      </div>
    </div>
  )
}

function ConfigEventActions({ eventId, closeModal, updateEventMutation, deleteEventMutation }: { eventId: string; closeModal: () => void; updateEventMutation: UseMutationResult<any, any, any, any>; deleteEventMutation: UseMutationResult<any, any, any, any> }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end w-full pt-4 border-t border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => {
          if (confirm("¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer.")) {
            deleteEventMutation.mutate(eventId)
          }
        }}
        disabled={deleteEventMutation.isPending}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors mr-auto disabled:opacity-50"
      >
        {deleteEventMutation.isPending ? "Eliminando..." : "Eliminar Evento"}
      </button>
      <button
        type="button"
        onClick={closeModal}
        className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={updateEventMutation.isPending}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
      >
        {updateEventMutation.isPending ? "Guardando..." : "Guardar Configuración"}
      </button>
    </div>
  )
}

function QrPreview({ configForm, isGeneratingQr, qrPreviewImage }: { configForm: any; isGeneratingQr: boolean; qrPreviewImage: string | undefined }) {
  return (
    <div className="space-y-4 text-center w-full">
      <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider">Vista Previa QR</h4>
      <div className="p-6 rounded-xl flex items-center justify-center shadow-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-fit mx-auto relative min-h-[200px] min-w-[200px]">
        {isGeneratingQr && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-zinc-950/50 rounded-xl z-10">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {qrPreviewImage ? (
          <img src={qrPreviewImage} alt="QR Preview" className="w-48 h-48 rounded-lg shadow-inner object-contain" />
        ) : (
          <div className="w-48 h-48 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-lg text-emerald-500">
            <QrCode size={48} />
          </div>
        )}
      </div>
      <p className="text-xs text-emerald-500 font-semibold max-w-xs mx-auto">
        Escaneando este código se decodificará como: <br/>
        <span className="font-mono text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400 px-1 rounded">
          {configForm.qrPrefix || "EVT"}-GRAN-ABC12345
        </span>
      </p>
    </div>
  )
}

function WhatsAppPreview({ configForm, getWhatsAppPreviewMessage }: { configForm: any; getWhatsAppPreviewMessage: () => string }) {
  return (
    <div className="space-y-4 text-center w-full animate-in fade-in slide-in-from-right-8 duration-500">
      <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider">Vista Previa Mensaje WhatsApp</h4>

      <div className="w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-md bg-[#0b141a] p-4 max-w-sm mx-auto">
        {/* WhatsApp Header */}
        <div className="flex items-center gap-2 border-b border-[#202c33] pb-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#128c7e]/20 border border-[#128c7e] flex items-center justify-center font-bold text-[#128c7e] text-xs">
            DMT
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-zinc-200">DMT Access</p>
            <p className="text-[9px] text-[#25d366]">En línea</p>
          </div>
        </div>

        {/* WhatsApp Chat Area */}
        <div className="flex flex-col">
          <div className="bg-[#202c33] rounded-lg p-2 text-xs text-white max-w-[90%] relative border-l-2 border-[#128c7e] self-start text-left shadow-sm">
            {configForm.flyerUrl && (
              <div className="mb-2 relative rounded-md overflow-hidden bg-black/20" style={{ height: "160px" }}>
                <img src={getValidImageUrl(configForm.flyerUrl)} alt="Flyer del evento" className="w-full h-auto rounded-lg mb-4" />
              </div>
            )}
            <p className="whitespace-pre-wrap leading-relaxed font-sans text-[12px] px-1">
              {getWhatsAppPreviewMessage()}
            </p>
            <div className="text-[10px] text-emerald-500 text-right mt-1 font-sans px-1">
              10:00 AM <span className="text-[#53bdeb] font-bold">✓✓</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function useEffectiveLogos({ selectedEvent, configForm }: { selectedEvent: Event | null; configForm: any }) {
  const effectiveLogoUrl = selectedEvent?.branch?.logoUrl || ""
  const effectiveLogoBgColor = configForm.qrLogoBackgroundColor || "#ffffff"
  const effectiveLogoScale = configForm.qrLogoScale || 4

  // Si el logo es un SVG inline (texto), convertirlo a data URL para que <image href> lo pueda renderizar
  const effectiveLogoHref = (() => {
    if (!effectiveLogoUrl) return ""
    const trimmed = effectiveLogoUrl.trim()
    if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
      try {
        let cleanSvg = trimmed.replace(/^<\?xml[^>]*\?>/i, "").trim()
        if (!cleanSvg.includes("xmlns=")) {
          cleanSvg = cleanSvg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')
        }
        const base64 = typeof window === "undefined"
          ? Buffer.from(cleanSvg).toString("base64")
          : btoa(encodeURIComponent(cleanSvg).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16))))
        return `data:image/svg+xml;base64,${base64}`
      } catch (e) {
        console.error("Error encoding SVG to base64:", e)
        return effectiveLogoUrl
      }
    }
    return effectiveLogoUrl
  })()

  const effectiveEmailLogoUrl = selectedEvent?.branch?.logoUrl || ""
  const effectiveEmailLogoHref = (() => {
    if (!effectiveEmailLogoUrl) return ""
    const trimmed = effectiveEmailLogoUrl.trim()
    if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
      try {
        let cleanSvg = trimmed.replace(/^<\?xml[^>]*\?>/i, "").trim()
        if (!cleanSvg.includes("xmlns=")) {
          cleanSvg = cleanSvg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')
        }
        const base64 = typeof window === "undefined"
          ? Buffer.from(cleanSvg).toString("base64")
          : btoa(encodeURIComponent(cleanSvg).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16))))
        return `data:image/svg+xml;base64,${base64}`
      } catch (e) {
        console.error("Error encoding SVG to base64:", e)
        return effectiveEmailLogoUrl
      }
    }
    return effectiveEmailLogoUrl
  })()

  return { effectiveLogoUrl, effectiveLogoBgColor, effectiveLogoScale, effectiveLogoHref, effectiveEmailLogoHref }
}

function useFlyerTools({ selectedEvent, configForm, setConfigForm }: { selectedEvent: Event | null; configForm: any; setConfigForm: Dispatch<any> }) {
  const hexToHsl = (hex: string) => {
    let r = parseInt(hex.slice(1, 3), 16) / 255
    let g = parseInt(hex.slice(3, 5), 16) / 255
    let b = parseInt(hex.slice(5, 7), 16) / 255

    let max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h = 0, s = 0, l = (max + min) / 2

    if (max !== min) {
      let d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
  }

  const hslToHex = (h: number, s: number, l: number) => {
    s /= 100
    l /= 100
    let c = (1 - Math.abs(2 * l - 1)) * s
    let x = c * (1 - Math.abs((h / 60) % 2 - 1))
    let m = l - c / 2
    let r = 0, g = 0, b = 0

    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

    const toHex = (val: number) => {
      let hex = Math.round((val + m) * 255).toString(16)
      return hex.padStart(2, "0")
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }

  const replacePreviewTemplates = (text: string) => {
    if (!text || !selectedEvent) return ""
    
    const tzOptions = { timeZone: process.env.NEXT_PUBLIC_TIMEZONE || 'America/Bogota' }
    
    const eventDate = selectedEvent.startsAt 
      ? new Date(selectedEvent.startsAt).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', ...tzOptions })
      : ""
    const qrLink = `${window.location.origin}/api/attendees/POPA-TF-f19c0vrqef/qr.png`
    const flyerLink = selectedEvent.id 
      ? `${window.location.origin}/api/events/${selectedEvent.id}/flyer.png`
      : ""

    return text
      .replace(/{nombre_asistente}/g, "Juan Pérez")
      .replace(/{nombre_evento}/g, selectedEvent.name)
      .replace(/{nombre_sucursal}/g, selectedEvent.branch?.name || "")
      .replace(/{fecha_evento}/g, eventDate)
      .replace(/{hora_evento}/g, `${new Date(selectedEvent.startsAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', ...tzOptions })} - ${new Date(selectedEvent.endsAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', ...tzOptions })}`)
      .replace(/{lugar_evento}/g, configForm.venueName || "Venue principal")
      .replace(/{nombre_categoria}/g, "Cortesia ($1)")
      .replace(/{link_qr}/g, qrLink)
      .replace(/{flyer_evento}/g, flyerLink)
      .replace(/{link_mapa}/g, configForm.mapsUrl || "")
      .replace(/{valor_entrada}/g, "$50.000")
  }

  const getWhatsAppPreviewMessage = () => {
    if (!selectedEvent) return ""
    
    // Default message structure fallback in case it's empty
    const msg = configForm.whatsappMessage || `¡Hola, {nombre_asistente}! 🎟️\n\nTu registro para *{nombre_evento}* ha sido confirmado.\n\n*Detalles del Evento:*\n📅 *Fecha:* {fecha_evento}\n📍 *Lugar:* {lugar_evento}\n🎫 *Categoría:* {nombre_categoria}\n\n📥 *Descarga tu Código QR de Acceso:* \n{link_qr}\n\n¡Te esperamos!`

    return replacePreviewTemplates(msg)
  }

  const handleAnalyzeFlyerColors = () => {
    if (!configForm.flyerUrl) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = getValidImageUrl(configForm.flyerUrl)

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        canvas.width = 50
        canvas.height = 50
        ctx.drawImage(img, 0, 0, 50, 50)

        const imgData = ctx.getImageData(0, 0, 50, 50).data
        const colorCounts: Record<string, number> = {}

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i]
          const g = imgData[i + 1]
          const b = imgData[i + 2]
          const a = imgData[i + 3]

          if (a < 200) continue // Skip transparent

          // Quantize
          const qr = Math.round(r / 20) * 20
          const qg = Math.round(g / 20) * 20
          const qb = Math.round(b / 20) * 20

          const toHexVal = (c: number) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")
          const hex = `#${toHexVal(qr)}${toHexVal(qg)}${toHexVal(qb)}`

          colorCounts[hex] = (colorCounts[hex] || 0) + 1
        }

        const sorted = Object.entries(colorCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([color]) => color)

        if (sorted.length === 0) return

        const dominant = sorted[0]
        
        let accent = sorted[0]
        let maxSat = -1
        sorted.forEach(color => {
          const { s } = hexToHsl(color)
          if (s > maxSat) {
            maxSat = s
            accent = color
          }
        })

        if (maxSat < 20 && sorted.length > 1) {
          accent = sorted[1]
        }

        const domHsl = hexToHsl(dominant)
        const accHsl = hexToHsl(accent)

        const emailBackgroundColor = hslToHex(domHsl.h, Math.min(domHsl.s, 10), 4)
        const emailCardColor = hslToHex(domHsl.h, Math.min(domHsl.s, 8), 7)
        const emailHeaderBackgroundColor = hslToHex(domHsl.h, Math.min(domHsl.s, 12), 4)
        const emailTextColor = "#ffffff"
        const emailTitleColor = "#ffffff"
        const emailMutedTextColor = hslToHex(domHsl.h, 10, 75)
        
        const adjustedAccL = accHsl.l > 75 ? 60 : (accHsl.l < 30 ? 55 : accHsl.l)
        const emailAccentColor = hslToHex(accHsl.h, Math.max(accHsl.s, 80), adjustedAccL)
        
        const emailBorderColor = hslToHex(domHsl.h, 15, 14)
        const emailSectionBackgroundColor = hslToHex(domHsl.h, 10, 6)
        const emailWarningBackgroundColor = hslToHex(accHsl.h, 30, 9)

        setConfigForm((prev: any) => ({
          ...prev,
          emailBackgroundColor,
          emailCardColor,
          emailHeaderBackgroundColor,
          emailTextColor,
          emailTitleColor,
          emailMutedTextColor,
          emailAccentColor,
          emailBorderColor,
          emailSectionBackgroundColor,
          emailWarningBackgroundColor
        }))

        import("sonner").then(({ toast }) => {
          toast.success("¡Paleta de colores generada y aplicada con éxito!")
        })
      } catch (err) {
        console.error("Color analysis failed:", err)
      }
    }

    img.onerror = () => {
      import("sonner").then(({ toast }) => {
        toast.error("No se pudo analizar la imagen. Si es un enlace remoto, puede deberse a restricciones de seguridad (CORS).")
      })
    }
  }

  return { replacePreviewTemplates, getWhatsAppPreviewMessage, handleAnalyzeFlyerColors }
}

function useEventMutations({ createForm, queryClient, branches, setEvents, setShowCreateModal, setCreateForm, setErrorMsg, selectedEvent, setShowConfigModal, setSelectedEvent, eventProductsConfig }: { createForm: any; queryClient: QueryClient; branches: Branch[]; setEvents: Dispatch<SetStateAction<Event[]>>; setShowCreateModal: Dispatch<SetStateAction<boolean>>; setCreateForm: Dispatch<SetStateAction<any>>; setErrorMsg: Dispatch<SetStateAction<string>>; selectedEvent: Event | null; setShowConfigModal: Dispatch<SetStateAction<boolean>>; setSelectedEvent: Dispatch<SetStateAction<Event | null>>; eventProductsConfig: { productId: string; name: string; basePrice: number; isEnabled: boolean; eventPrice: string | number; }[] }) {
  const createEventMutation = useMutation({
    mutationFn: async (data: typeof createForm) => {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          startsAt: new Date(data.startsAt).toISOString(),
          endsAt: new Date(data.endsAt).toISOString(),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al crear evento")
      return res.json()
    },
    onSuccess: (resJson) => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      const newEvent = {
        ...resJson.data,
        branch: branches.find(b => b.id === resJson.data.branchId) || { id: resJson.data.branchId, name: "Sucursal" }
      }
      setEvents(prev => [newEvent, ...prev])
      setShowCreateModal(false)
      setCreateForm(getInitialCreateForm(branches[0]?.id || ""))
      setErrorMsg("")
    },
    onError: (err: any) => setErrorMsg(err.message),
  })

  const updateEventMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedEvent) return
      // Contraseña SMTP vacía = no tocar la guardada
      const { emailPassword, ...rest } = data
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest,
          ...(emailPassword ? { emailPassword } : {}),
          startsAt: new Date(data.startsAt).toISOString(),
          endsAt: new Date(data.endsAt).toISOString(),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al actualizar configuración")
      return res.json()
    },
    onSuccess: (resJson) => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      setEvents(prev => prev.map(e => e.id === selectedEvent?.id ? { ...e, ...resJson.data } : e))
      setShowConfigModal(false)
      setSelectedEvent(null)
      setErrorMsg("")
    },
    onError: (err: any) => setErrorMsg(err.message),
  })

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al eliminar evento")
      return res.json()
    },
    onSuccess: (resJson) => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      setEvents(prev => prev.filter(e => e.id !== resJson.data.id))
      setShowConfigModal(false)
      setSelectedEvent(null)
      import("sonner").then(({ toast }) => {
        toast.success("¡Evento eliminado con éxito!")
      })
    },
    onError: (err: any) => setErrorMsg(err.message),
  })

  const saveEventProductsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEvent) return
      const res = await fetch("/api/sales/event-products/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          products: eventProductsConfig.map(p => ({
            productId: p.productId,
            isEnabled: p.isEnabled,
            eventPrice: p.eventPrice === "" ? null : Number(p.eventPrice)
          }))
        })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al guardar productos")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-products", selectedEvent?.branchId, selectedEvent?.id] })
      setShowConfigModal(false)
      setSelectedEvent(null)
      setErrorMsg("")
    },
    onError: (err: any) => setErrorMsg(err.message)
  })

  return { createEventMutation, updateEventMutation, deleteEventMutation }
}

function GeneralConfigTab({ activeConfigTab, configForm, setConfigForm }: { activeConfigTab: "general" | "qr" | "venue" | "email" | "wpp" | "products"; configForm: any; setConfigForm: Dispatch<any> }) {
  return (
    <>{activeConfigTab === "general" && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="eventos-nombre" className="text-xs font-semibold text-emerald-500 block mb-1">Nombre</label>
                    <input id="eventos-nombre"
                      type="text"
                      value={configForm.name}
                      onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="eventos-descripcion-2" className="text-xs font-semibold text-emerald-500 block mb-1">Descripción</label>
                    <textarea id="eventos-descripcion-2"
                      value={configForm.description}
                      onChange={(e) => setConfigForm({ ...configForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="eventos-inicia-2" className="text-xs font-semibold text-emerald-500 block mb-1">Inicia</label>
                      <input id="eventos-inicia-2"
                        type="datetime-local"
                        value={configForm.startsAt}
                        onChange={(e) => setConfigForm({ ...configForm, startsAt: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="eventos-termina-2" className="text-xs font-semibold text-emerald-500 block mb-1">Termina</label>
                      <input id="eventos-termina-2"
                        type="datetime-local"
                        value={configForm.endsAt}
                        onChange={(e) => setConfigForm({ ...configForm, endsAt: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="eventos-estado" className="text-xs font-semibold text-emerald-500 block mb-1">Estado</label>
                    <select id="eventos-estado"
                      value={configForm.status}
                      onChange={(e) => setConfigForm({ ...configForm, status: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="DRAFT">Draft (Borrador)</option>
                      <option value="ACTIVE">Active (Activo)</option>
                      <option value="ARCHIVED">Archived (Archivado)</option>
                    </select>
                  </div>
                </div>
              )}</>
  )
}

function QrConfigTab({ activeConfigTab, configForm, setConfigForm, effectiveLogoScale, effectiveLogoUrl, effectiveLogoBgColor }: { activeConfigTab: "general" | "qr" | "venue" | "email" | "wpp" | "products"; configForm: any; setConfigForm: Dispatch<any>; effectiveLogoScale: any; effectiveLogoUrl: string; effectiveLogoBgColor: any }) {
  return (
    <>{activeConfigTab === "qr" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="eventos-prefijo-de-codigo-qr" className="text-xs font-semibold text-emerald-500 block mb-1">Prefijo de Código QR</label>
                      <input id="eventos-prefijo-de-codigo-qr"
                        type="text"
                        value={configForm.qrPrefix}
                        onChange={(e) => setConfigForm({ ...configForm, qrPrefix: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        maxLength={20}
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="eventos-escala-del-logo-en-qr" className="text-xs font-semibold text-emerald-500 block mb-1">Escala del Logo en QR</label>
                      <select id="eventos-escala-del-logo-en-qr"
                        value={effectiveLogoScale}
                        disabled={!effectiveLogoUrl}
                        onChange={(e) => setConfigForm({ ...configForm, qrLogoScale: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
                      >
                        <option value={2}>Pequeño (2)</option>
                        <option value={3}>Mediano (3)</option>
                        <option value={4}>Estándar (4)</option>
                        <option value={5}>Grande (5)</option>
                        <option value={6}>Extra Grande (6)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 border-t pt-3 border-zinc-100 dark:border-zinc-800">
                    <div>
                      <label htmlFor="eventos-color-relleno-qr" className="text-xs font-semibold text-emerald-500 block mb-1">Color Relleno QR</label>
                      <div className="flex gap-1.5">
                        <input id="eventos-color-relleno-qr"
                          type="color"
                          value={configForm.qrFillColor}
                          onChange={(e) => setConfigForm({ ...configForm, qrFillColor: e.target.value })}
                          className="w-8 h-8 border rounded cursor-pointer shrink-0"
                        />
                        <input aria-label="Color Relleno QR (hexadecimal)"
                          type="text"
                          value={configForm.qrFillColor}
                          onChange={(e) => setConfigForm({ ...configForm, qrFillColor: e.target.value })}
                          className="w-full text-xs p-1 border rounded bg-zinc-50 dark:bg-zinc-950"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="eventos-color-fondo-qr" className="text-xs font-semibold text-emerald-500 block mb-1">Color Fondo QR</label>
                      <div className="flex gap-1.5">
                        <input id="eventos-color-fondo-qr"
                          type="color"
                          value={configForm.qrBackgroundColor}
                          onChange={(e) => setConfigForm({ ...configForm, qrBackgroundColor: e.target.value })}
                          className="w-8 h-8 border rounded cursor-pointer shrink-0"
                        />
                        <input aria-label="Color Fondo QR (hexadecimal)"
                          type="text"
                          value={configForm.qrBackgroundColor}
                          onChange={(e) => setConfigForm({ ...configForm, qrBackgroundColor: e.target.value })}
                          className="w-full text-xs p-1 border rounded bg-zinc-50 dark:bg-zinc-950"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="eventos-fondo-logo-en-qr" className="text-xs font-semibold text-emerald-500 block mb-1">Fondo Logo en QR</label>
                      <div className="flex gap-1.5">
                        <input id="eventos-fondo-logo-en-qr"
                          type="color"
                          value={effectiveLogoBgColor}
                          disabled={!effectiveLogoUrl}
                          onChange={(e) => setConfigForm({ ...configForm, qrLogoBackgroundColor: e.target.value })}
                          className="w-8 h-8 border rounded cursor-pointer shrink-0 disabled:opacity-50"
                        />
                        <input aria-label="Fondo Logo en QR (hexadecimal)"
                          type="text"
                          value={effectiveLogoBgColor}
                          disabled={!effectiveLogoUrl}
                          onChange={(e) => setConfigForm({ ...configForm, qrLogoBackgroundColor: e.target.value })}
                          className="w-full text-xs p-1 border rounded bg-zinc-50 dark:bg-zinc-950 disabled:opacity-50 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              )}</>
  )
}

function VenueConfigTab({ activeConfigTab, configForm, setConfigForm }: { activeConfigTab: "general" | "qr" | "venue" | "email" | "wpp" | "products"; configForm: any; setConfigForm: Dispatch<any> }) {
  return (
    <>{activeConfigTab === "venue" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label htmlFor="eventos-nombre-del-lugar-local" className="text-xs font-semibold text-emerald-500 block mb-1">Nombre del Lugar / Local</label>
                      <input id="eventos-nombre-del-lugar-local"
                        type="text"
                        value={configForm.venueName}
                        onChange={(e) => setConfigForm({ ...configForm, venueName: e.target.value })}
                        placeholder="ej. Club del Norte"
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="eventos-codigo-de-vestimenta-dress-code" className="text-xs font-semibold text-emerald-500 block mb-1">Código de Vestimenta (Dress code)</label>
                      <input id="eventos-codigo-de-vestimenta-dress-code"
                        type="text"
                        value={configForm.dressCode}
                        onChange={(e) => setConfigForm({ ...configForm, dressCode: e.target.value })}
                        placeholder="ej. Formal, Casual"
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="eventos-politicas-de-acceso" className="text-xs font-semibold text-emerald-500 block mb-1">Políticas de Acceso</label>
                      <input id="eventos-politicas-de-acceso"
                        type="text"
                        value={configForm.accessPolicy}
                        onChange={(e) => setConfigForm({ ...configForm, accessPolicy: e.target.value })}
                        placeholder="ej. Mayores de 18 años"
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t pt-3 border-zinc-100 dark:border-zinc-800">
                    <div>
                      <label htmlFor="eventos-url-google-maps" className="text-xs font-semibold text-emerald-500 block mb-1">URL Google Maps</label>
                      <input id="eventos-url-google-maps"
                        type="text"
                        value={configForm.mapsUrl}
                        onChange={(e) => setConfigForm({ ...configForm, mapsUrl: e.target.value })}
                        placeholder="https://maps.google.com/..."
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="eventos-etiqueta-de-mapa-2" className="text-xs font-semibold text-emerald-500 block mb-1">Etiqueta de Mapa</label>
                      <input id="eventos-etiqueta-de-mapa-2"
                        type="text"
                        value={configForm.mapsLabel}
                        onChange={(e) => setConfigForm({ ...configForm, mapsLabel: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}</>
  )
}

function EmailConfigTab({ activeConfigTab, configForm, setConfigForm, handleAnalyzeFlyerColors }: { activeConfigTab: "general" | "qr" | "venue" | "email" | "wpp" | "products"; configForm: any; setConfigForm: Dispatch<any>; handleAnalyzeFlyerColors: () => void }) {
  return (
    <>{activeConfigTab === "email" && (
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  <div>
                    <label htmlFor="eventos-asunto-del-correo-2" className="text-xs font-semibold text-emerald-500 block mb-1">Asunto del Correo</label>
                    <input id="eventos-asunto-del-correo-2"
                      type="text"
                      value={configForm.emailSubject}
                      onChange={(e) => setConfigForm({ ...configForm, emailSubject: e.target.value })}
                      placeholder="Tu acceso está listo: {nombre_evento}"
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="eventos-pre-encabezado-preheader" className="text-xs font-semibold text-emerald-500 block mb-1">Pre-encabezado (Preheader)</label>
                      <input id="eventos-pre-encabezado-preheader"
                        type="text"
                        value={configForm.emailPreheader}
                        onChange={(e) => setConfigForm({ ...configForm, emailPreheader: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="eventos-titulo-del-mensaje-heading" className="text-xs font-semibold text-emerald-500 block mb-1">Título del Mensaje (Heading)</label>
                      <input id="eventos-titulo-del-mensaje-heading"
                        type="text"
                        value={configForm.emailHeading}
                        onChange={(e) => setConfigForm({ ...configForm, emailHeading: e.target.value })}
                        placeholder="Hola {nombre_asistente}"
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="eventos-mensaje-introductorio-2" className="text-xs font-semibold text-emerald-500 block mb-1">Mensaje Introductorio</label>
                    <textarea id="eventos-mensaje-introductorio-2"
                      value={configForm.emailIntro}
                      onChange={(e) => setConfigForm({ ...configForm, emailIntro: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={2}
                    />
                  </div>

                  <div className="border-t pt-3 border-zinc-100 dark:border-zinc-800 space-y-3">
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Imágenes del Evento</p>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label htmlFor="eventos-flyer-del-evento" className="text-xs font-semibold text-emerald-500 block mb-1">Flyer del Evento</label>
                        <div className="flex flex-wrap gap-2 items-center">
                          <input id="eventos-flyer-del-evento"
                            type="text"
                            value={configForm.flyerUrl}
                            onChange={(e) => setConfigForm({ ...configForm, flyerUrl: e.target.value })}
                            placeholder="URL del Flyer"
                            className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <label className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 shrink-0">
                            <Upload size={14} />
                            <input aria-label="Subir imagen del flyer"
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                try {
                                  const resultStr = await processImageToSvg(file, 1000, 0.85)
                                  setConfigForm({ ...configForm, flyerUrl: resultStr })
                                } catch (err: any) {
                                  // Ignore
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-end">
                      <div>
                        <label htmlFor="eventos-tamano-del-logo-en-email" className="text-xs font-semibold text-emerald-500 block mb-1">Tamaño del Logo en Email</label>
                        <div className="flex items-center gap-2">
                          <input id="eventos-tamano-del-logo-en-email"
                            type="range"
                            min={20}
                            max={200}
                            value={configForm.emailLogoSize || 80}
                            onChange={(e) => setConfigForm({ ...configForm, emailLogoSize: parseInt(e.target.value) })}
                            className="w-full accent-indigo-600 h-1.5 bg-zinc-200 rounded-lg cursor-pointer"
                          />
                          <span className="text-xs font-mono font-bold shrink-0">{configForm.emailLogoSize || 80}px</span>
                        </div>
                      </div>

                      {configForm.flyerUrl && (
                        <div>
                          <button
                            type="button"
                            onClick={() => handleAnalyzeFlyerColors()}
                            className="w-full px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 rounded-md text-xs font-semibold transition-colors border border-indigo-200/40 dark:border-indigo-800/40 flex items-center justify-center gap-1.5"
                          >
                            🎨 Analizar Colores de Flyer
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <EmailColorFields configForm={configForm} setConfigForm={setConfigForm} />

                  <div>
                    <label htmlFor="eventos-cuerpo-del-correo-2" className="text-xs font-semibold text-emerald-500 block mb-1">Cuerpo del Correo</label>
                    <textarea id="eventos-cuerpo-del-correo-2"
                      value={configForm.emailBody}
                      onChange={(e) => setConfigForm({ ...configForm, emailBody: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t pt-3 border-zinc-100 dark:border-zinc-800">
                    <div>
                      <label htmlFor="eventos-titulo-de-advertencia-2" className="text-xs font-semibold text-emerald-500 block mb-1">Título de Advertencia</label>
                      <input id="eventos-titulo-de-advertencia-2"
                        type="text"
                        value={configForm.emailWarningTitle}
                        onChange={(e) => setConfigForm({ ...configForm, emailWarningTitle: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="eventos-firma-de-equipo-2" className="text-xs font-semibold text-emerald-500 block mb-1">Firma de Equipo</label>
                      <input id="eventos-firma-de-equipo-2"
                        type="text"
                        value={configForm.emailTeamSignature}
                        onChange={(e) => setConfigForm({ ...configForm, emailTeamSignature: e.target.value })}
                        placeholder="Equipo {nombre_evento}"
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="eventos-texto-de-advertencia-2" className="text-xs font-semibold text-emerald-500 block mb-1">Texto de Advertencia</label>
                    <textarea id="eventos-texto-de-advertencia-2"
                      value={configForm.emailWarningText}
                      onChange={(e) => setConfigForm({ ...configForm, emailWarningText: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={2}
                    />
                  </div>

                  <div className="border-t pt-3 border-zinc-100 dark:border-zinc-800">
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Servidor de Correo (SMTP)</p>
                    <p className="text-xs text-zinc-500 mt-1">El correo de envío es único para todo el sistema y se configura con las variables SMTP_USER, SMTP_PASSWORD y SMTP_FROM del servidor.</p>
                  </div>
                </div>
              )}</>
  )
}

// Colores de la vista previa con sus valores por defecto, en un solo lugar.
function resolveEmailPreviewTheme(configForm: any) {
  const text = configForm.emailTextColor || "#172121"
  const accent = configForm.emailAccentColor || "#c44536"
  return {
    text,
    accent,
    glow: configForm.emailAccentColor || "#00ffcc",
    title: configForm.emailTitleColor || text,
    signature: configForm.emailTitleColor || accent,
    background: configForm.emailBackgroundColor || "#000000",
    card: configForm.emailCardColor || "#ffffff",
    border: configForm.emailBorderColor || "#1f1f22",
    header: configForm.emailHeaderBackgroundColor || "#111315",
    muted: configForm.emailMutedTextColor || "#a1a1aa",
    section: configForm.emailSectionBackgroundColor || "#18191b",
    warning: configForm.emailWarningBackgroundColor || "#2a1c17",
    qrFill: configForm.qrFillColor || "#102542",
    qrBackground: configForm.qrBackgroundColor || "#ffffff",
  }
}

type EmailPreviewTheme = ReturnType<typeof resolveEmailPreviewTheme>

function EmailTemplatePreview({ configForm, replacePreviewTemplates, effectiveEmailLogoHref, selectedEvent, effectiveLogoScale, effectiveLogoUrl, effectiveLogoBgColor, effectiveLogoHref }: { configForm: any; replacePreviewTemplates: (text: string) => string; effectiveEmailLogoHref: string; selectedEvent: Event; effectiveLogoScale: any; effectiveLogoUrl: string; effectiveLogoBgColor: any; effectiveLogoHref: string }) {
  const theme = resolveEmailPreviewTheme(configForm)

  return (
    <div className="w-full flex flex-col space-y-3">
      <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider text-center">Vista Previa Plantilla Email</h4>

      <div
        className="w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 text-xs shadow-md max-h-[480px] overflow-y-auto flex flex-col"
        style={{
          backgroundColor: theme.background,
          backgroundImage: `radial-gradient(circle at 15% 20%, ${theme.glow}1a 0%, transparent 55%), radial-gradient(circle at 85% 80%, ${theme.glow}15 0%, transparent 55%)`
        }}
      >
        <div className="bg-white dark:bg-zinc-950 p-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="text-zinc-600 dark:text-emerald-500">
            <span className="text-emerald-500 font-semibold">De: </span>
            <span className="font-bold text-zinc-750 dark:text-zinc-300">notificaciones@dmt.com</span>
            <br/>
            <span className="text-emerald-500 font-semibold">Asunto: </span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">
              {replacePreviewTemplates(configForm.emailSubject || "Tu acceso está listo: {nombre_evento}")}
            </span>
          </div>
          <span className="text-[10px] text-emerald-500 font-mono shrink-0">10:00 AM</span>
        </div>

        <div className="p-4 flex justify-center">
          <div
            className="w-full max-w-sm rounded-lg overflow-hidden shadow-sm"
            style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}` }}
          >
            <div className="p-4 flex flex-col items-center justify-center min-h-[60px]" style={{ backgroundColor: theme.header }}>
              {effectiveEmailLogoHref ? (
                <img
                  src={getValidImageUrl(effectiveEmailLogoHref)}
                  alt="Logo"
                  style={{ height: `${configForm.emailLogoSize || 80}px`, maxWidth: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span className="text-white font-black text-sm uppercase tracking-widest text-center">
                  {selectedEvent.name}
                </span>
              )}
            </div>

            <div className="p-4 space-y-4" style={{ color: theme.text }}>
              <h1 className="text-base font-bold tracking-tight" style={{ color: theme.title }}>
                {replacePreviewTemplates(configForm.emailHeading || "Hola {nombre_asistente}")}
              </h1>

              {configForm.emailIntro && (
                <p className="whitespace-pre-line" style={{ color: theme.muted }}>
                  {replacePreviewTemplates(configForm.emailIntro)}
                </p>
              )}

              {configForm.flyerUrl && (
                <div className="w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 my-2">
                  <img
                    src={getValidImageUrl(configForm.flyerUrl)}
                    alt="Flyer del Evento"
                    className="w-full h-auto object-contain"
                  />
                </div>
              )}

              <EmailEventDetails configForm={configForm} theme={theme} replacePreviewTemplates={replacePreviewTemplates} />
              {configForm.emailBody && <EmailMessageBlock configForm={configForm} theme={theme} replacePreviewTemplates={replacePreviewTemplates} />}
              {configForm.emailWarningText && <EmailWarningBlock configForm={configForm} theme={theme} replacePreviewTemplates={replacePreviewTemplates} />}
              <EmailQrBlock configForm={configForm} theme={theme} replacePreviewTemplates={replacePreviewTemplates} effectiveLogoScale={effectiveLogoScale} effectiveLogoUrl={effectiveLogoUrl} effectiveLogoBgColor={effectiveLogoBgColor} effectiveLogoHref={effectiveLogoHref} />
              {configForm.emailFooter && <EmailFooterBlock configForm={configForm} theme={theme} replacePreviewTemplates={replacePreviewTemplates} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type EmailBlockProps = { configForm: any; theme: EmailPreviewTheme; replacePreviewTemplates: (text: string) => string }

function EmailEventDetails({ configForm, theme, replacePreviewTemplates }: EmailBlockProps) {
  return (
    <div
      className="p-3 rounded-lg border space-y-1.5"
      style={{ backgroundColor: theme.section, borderColor: theme.border, color: theme.text }}
    >
      <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: theme.accent }}>
        {configForm.emailDetailsTitle || "Detalles del Evento"}
      </p>
      <p className="font-semibold">
        {replacePreviewTemplates(configForm.emailDateText || "{fecha_evento}")}
      </p>
      <p className="text-xs" style={{ color: theme.muted }}>
        {replacePreviewTemplates(configForm.emailTimeText || "{hora_evento}")}
      </p>
      <p className="text-xs font-semibold italic" style={{ color: theme.accent }}>
        📍 {configForm.venueName || "Venue principal sucursal"}
      </p>
      {configForm.mapsUrl && (
        <div className="pt-1">
          <span
            className="inline-block px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: theme.accent, color: theme.background }}
          >
            📍 {configForm.mapsLabel || "Abrir en Google Maps"}
          </span>
        </div>
      )}
    </div>
  )
}

function EmailMessageBlock({ configForm, theme, replacePreviewTemplates }: EmailBlockProps) {
  return (
    <div className="whitespace-pre-line pt-2 border-t border-dashed" style={{ borderColor: theme.border }}>
      {configForm.emailMessageTitle && (
        <p className="font-bold text-xs mb-1" style={{ color: theme.accent }}>
          {configForm.emailMessageTitle}
        </p>
      )}
      <p>{replacePreviewTemplates(configForm.emailBody)}</p>
    </div>
  )
}

function EmailWarningBlock({ configForm, theme, replacePreviewTemplates }: EmailBlockProps) {
  return (
    <div
      className="p-3 rounded-md space-y-1"
      style={{ backgroundColor: theme.warning, borderLeft: `3px solid ${theme.accent}` }}
    >
      <p className="font-bold text-[10px] uppercase tracking-wider" style={{ color: theme.accent }}>
        ⚠️ {configForm.emailWarningTitle || "Importante"}
      </p>
      <p className="text-[11px] leading-relaxed">
        {replacePreviewTemplates(configForm.emailWarningText)}
      </p>
    </div>
  )
}

function EmailFooterBlock({ configForm, theme, replacePreviewTemplates }: EmailBlockProps) {
  return (
    <div
      className="p-3 text-center text-[10px] border-t"
      style={{ backgroundColor: theme.background, borderColor: theme.border, color: theme.muted }}
    >
      <p>{replacePreviewTemplates(configForm.emailFooter)}</p>
      {configForm.emailLegalNote && <p className="mt-1 font-semibold text-[9px]">{replacePreviewTemplates(configForm.emailLegalNote)}</p>}
    </div>
  )
}

function EmailQrBlock({ configForm, theme, replacePreviewTemplates, effectiveLogoScale, effectiveLogoUrl, effectiveLogoBgColor, effectiveLogoHref }: EmailBlockProps & { effectiveLogoScale: any; effectiveLogoUrl: string; effectiveLogoBgColor: any; effectiveLogoHref: string }) {
  return (
    <div className="text-center pt-3 border-t space-y-2 flex flex-col items-center" style={{ borderColor: theme.border }}>
      <p className="font-bold text-xs">{configForm.emailQrTitle || "Tu código QR de acceso"}</p>

      <div
        className="p-3 rounded-lg flex items-center justify-center border"
        style={{ backgroundColor: theme.qrBackground, borderColor: theme.border }}
      >
        <EmailQrSample theme={theme} effectiveLogoScale={effectiveLogoScale} effectiveLogoUrl={effectiveLogoUrl} effectiveLogoBgColor={effectiveLogoBgColor} effectiveLogoHref={effectiveLogoHref} />
      </div>
      <p className="text-[10px]" style={{ color: theme.muted }}>
        {configForm.emailQrNote || "Preséntalo junto a tu cédula en la entrada."}
      </p>

      <div className="text-center pt-2 space-y-1">
        <p className="font-semibold text-xs">{replacePreviewTemplates(configForm.emailClosingText || "Nos vemos pronto!")}</p>
        <p className="font-bold text-xs uppercase tracking-wider" style={{ color: theme.signature }}>
          {replacePreviewTemplates(configForm.emailTeamSignature || "{nombre_sucursal}")}
        </p>
      </div>
    </div>
  )
}

// Dibujo de ejemplo del QR: tres esquinas (x, y) y módulos sueltos (x, y, ancho, alto).
const QR_SAMPLE_CORNERS = [[5, 5], [75, 5], [5, 75]]
const QR_SAMPLE_MODULES = [
  [70, 70, 8, 8],
  [30, 5, 10, 5],
  [45, 10, 15, 5],
  [30, 25, 5, 15],
  [45, 30, 20, 5],
  [15, 45, 15, 5],
  [35, 45, 5, 10],
  [45, 45, 30, 5],
  [80, 45, 10, 15],
  [5, 60, 15, 5],
  [25, 55, 5, 15],
  [35, 60, 25, 5],
  [30, 75, 5, 15],
  [40, 75, 15, 5],
]

function EmailQrSample({ theme, effectiveLogoScale, effectiveLogoUrl, effectiveLogoBgColor, effectiveLogoHref }: { theme: EmailPreviewTheme; effectiveLogoScale: any; effectiveLogoUrl: string; effectiveLogoBgColor: any; effectiveLogoHref: string }) {
  const logoRadius = effectiveLogoScale ? effectiveLogoScale * 2 : 8

  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24">
      <defs>
        <clipPath id="qr-logo-circle-clip-email">
          <circle cx="50" cy="50" r={logoRadius} />
        </clipPath>
      </defs>
      {QR_SAMPLE_CORNERS.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="20" height="20" fill={theme.qrFill} />
          <rect x={x + 3} y={y + 3} width="14" height="14" fill={theme.qrBackground} />
          <rect x={x + 5} y={y + 5} width="10" height="10" fill={theme.qrFill} />
        </g>
      ))}
      {QR_SAMPLE_MODULES.map(([x, y, width, height]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={width} height={height} fill={theme.qrFill} />
      ))}
      {effectiveLogoUrl && (
        <>
          <circle
            cx="50"
            cy="50"
            r={effectiveLogoScale ? effectiveLogoScale * 2.5 : 10}
            fill={effectiveLogoBgColor || "#ffffff"}
          />
          <image
            href={effectiveLogoHref}
            x={50 - logoRadius}
            y={50 - logoRadius}
            width={logoRadius * 2}
            height={logoRadius * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#qr-logo-circle-clip-email)"
          />
        </>
      )}
    </svg>
  )
}

function EmailColorFields({ configForm, setConfigForm }: { configForm: any; setConfigForm: Dispatch<any> }) {
  return (
    <div className="border-t pt-3 border-zinc-100 dark:border-zinc-800 space-y-3">
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Diseño y Colores de Plantilla</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="eventos-fondo-general" className="text-xs text-emerald-500">Fondo General</label>
                        <div className="flex gap-1.5">
                          <input id="eventos-fondo-general"
                            type="color"
                            value={configForm.emailBackgroundColor}
                            onChange={(e) => setConfigForm({ ...configForm, emailBackgroundColor: e.target.value })}
                            className="w-8 h-8 border rounded cursor-pointer shrink-0"
                          />
                          <input aria-label="Fondo General (hexadecimal)"
                            type="text"
                            value={configForm.emailBackgroundColor}
                            onChange={(e) => setConfigForm({ ...configForm, emailBackgroundColor: e.target.value })}
                            className="w-full text-xs p-1 border rounded bg-zinc-50 dark:bg-zinc-950"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="eventos-fondo-tarjeta-card" className="text-xs text-emerald-500">Fondo Tarjeta (Card)</label>
                        <div className="flex gap-1.5">
                          <input id="eventos-fondo-tarjeta-card"
                            type="color"
                            value={configForm.emailCardColor}
                            onChange={(e) => setConfigForm({ ...configForm, emailCardColor: e.target.value })}
                            className="w-8 h-8 border rounded cursor-pointer shrink-0"
                          />
                          <input aria-label="Fondo Tarjeta (Card) (hexadecimal)"
                            type="text"
                            value={configForm.emailCardColor}
                            onChange={(e) => setConfigForm({ ...configForm, emailCardColor: e.target.value })}
                            className="w-full text-xs p-1 border rounded bg-zinc-50 dark:bg-zinc-950"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="eventos-cabecera-de-tarjeta" className="text-xs text-emerald-500">Cabecera de Tarjeta</label>
                        <div className="flex gap-1.5">
                          <input id="eventos-cabecera-de-tarjeta"
                            type="color"
                            value={configForm.emailHeaderBackgroundColor}
                            onChange={(e) => setConfigForm({ ...configForm, emailHeaderBackgroundColor: e.target.value })}
                            className="w-8 h-8 border rounded cursor-pointer shrink-0"
                          />
                          <input aria-label="Cabecera de Tarjeta (hexadecimal)"
                            type="text"
                            value={configForm.emailHeaderBackgroundColor}
                            onChange={(e) => setConfigForm({ ...configForm, emailHeaderBackgroundColor: e.target.value })}
                            className="w-full text-xs p-1 border rounded bg-zinc-50 dark:bg-zinc-950"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="eventos-color-de-acento" className="text-xs text-emerald-500">Color de Acento</label>
                        <div className="flex gap-1.5">
                          <input id="eventos-color-de-acento"
                            type="color"
                            value={configForm.emailAccentColor}
                            onChange={(e) => setConfigForm({ ...configForm, emailAccentColor: e.target.value })}
                            className="w-8 h-8 border rounded cursor-pointer shrink-0"
                          />
                          <input aria-label="Color de Acento (hexadecimal)"
                            type="text"
                            value={configForm.emailAccentColor}
                            onChange={(e) => setConfigForm({ ...configForm, emailAccentColor: e.target.value })}
                            className="w-full text-xs p-1 border rounded bg-zinc-50 dark:bg-zinc-950"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="eventos-color-texto-principal" className="text-xs text-emerald-500">Color Texto Principal</label>
                        <div className="flex gap-1.5">
                          <input id="eventos-color-texto-principal"
                            type="color"
                            value={configForm.emailTextColor || "#f3f4f6"}
                            onChange={(e) => setConfigForm({ ...configForm, emailTextColor: e.target.value })}
                            className="w-8 h-8 border rounded cursor-pointer shrink-0"
                          />
                          <input aria-label="Color Texto Principal (hexadecimal)"
                            type="text"
                            value={configForm.emailTextColor || "#f3f4f6"}
                            onChange={(e) => setConfigForm({ ...configForm, emailTextColor: e.target.value })}
                            className="w-full text-xs p-1 border rounded bg-zinc-50 dark:bg-zinc-950"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="eventos-color-de-titulos" className="text-xs text-emerald-500">Color de Títulos</label>
                        <div className="flex gap-1.5">
                          <input id="eventos-color-de-titulos"
                            type="color"
                            value={configForm.emailTitleColor || "#ffffff"}
                            onChange={(e) => setConfigForm({ ...configForm, emailTitleColor: e.target.value })}
                            className="w-8 h-8 border rounded cursor-pointer shrink-0"
                          />
                          <input aria-label="Color de Títulos (hexadecimal)"
                            type="text"
                            value={configForm.emailTitleColor || "#ffffff"}
                            onChange={(e) => setConfigForm({ ...configForm, emailTitleColor: e.target.value })}
                            className="w-full text-xs p-1 border rounded bg-zinc-50 dark:bg-zinc-950"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="eventos-color-texto-secundario" className="text-xs text-emerald-500">Color Texto Secundario</label>
                        <div className="flex gap-1.5">
                          <input id="eventos-color-texto-secundario"
                            type="color"
                            value={configForm.emailMutedTextColor || "#8e9296"}
                            onChange={(e) => setConfigForm({ ...configForm, emailMutedTextColor: e.target.value })}
                            className="w-8 h-8 border rounded cursor-pointer shrink-0"
                          />
                          <input aria-label="Color Texto Secundario (hexadecimal)"
                            type="text"
                            value={configForm.emailMutedTextColor || "#8e9296"}
                            onChange={(e) => setConfigForm({ ...configForm, emailMutedTextColor: e.target.value })}
                            className="w-full text-xs p-1 border rounded bg-zinc-50 dark:bg-zinc-950"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="eventos-color-de-bordes" className="text-xs text-emerald-500">Color de Bordes</label>
                        <div className="flex gap-1.5">
                          <input id="eventos-color-de-bordes"
                            type="color"
                            value={configForm.emailBorderColor || "#1f1f26"}
                            onChange={(e) => setConfigForm({ ...configForm, emailBorderColor: e.target.value })}
                            className="w-8 h-8 border rounded cursor-pointer shrink-0"
                          />
                          <input aria-label="Color de Bordes (hexadecimal)"
                            type="text"
                            value={configForm.emailBorderColor || "#1f1f26"}
                            onChange={(e) => setConfigForm({ ...configForm, emailBorderColor: e.target.value })}
                            className="w-full text-xs p-1 border rounded bg-zinc-50 dark:bg-zinc-950"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="eventos-fondo-detalle-de-evento" className="text-xs text-emerald-500">Fondo Detalle de Evento</label>
                        <div className="flex gap-1.5">
                          <input id="eventos-fondo-detalle-de-evento"
                            type="color"
                            value={configForm.emailSectionBackgroundColor || "#060608"}
                            onChange={(e) => setConfigForm({ ...configForm, emailSectionBackgroundColor: e.target.value })}
                            className="w-8 h-8 border rounded cursor-pointer shrink-0"
                          />
                          <input aria-label="Fondo Detalle de Evento (hexadecimal)"
                            type="text"
                            value={configForm.emailSectionBackgroundColor || "#060608"}
                            onChange={(e) => setConfigForm({ ...configForm, emailSectionBackgroundColor: e.target.value })}
                            className="w-full text-xs p-1 border rounded bg-zinc-50 dark:bg-zinc-950"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="eventos-fondo-de-advertencia" className="text-xs text-emerald-500">Fondo de Advertencia</label>
                        <div className="flex gap-1.5">
                          <input id="eventos-fondo-de-advertencia"
                            type="color"
                            value={configForm.emailWarningBackgroundColor || "#1c0d0d"}
                            onChange={(e) => setConfigForm({ ...configForm, emailWarningBackgroundColor: e.target.value })}
                            className="w-8 h-8 border rounded cursor-pointer shrink-0"
                          />
                          <input aria-label="Fondo de Advertencia (hexadecimal)"
                            type="text"
                            value={configForm.emailWarningBackgroundColor || "#1c0d0d"}
                            onChange={(e) => setConfigForm({ ...configForm, emailWarningBackgroundColor: e.target.value })}
                            className="w-full text-xs p-1 border rounded bg-zinc-50 dark:bg-zinc-950"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
  )
}
