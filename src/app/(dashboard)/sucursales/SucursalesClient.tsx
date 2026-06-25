"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Building2, Plus, Edit2, ShieldAlert, Store, Upload, Trash2 } from "lucide-react"
import Link from "next/link"
import { formatThousands, parseThousands } from "@/shared/utils/price"

interface Branch {
  id: string
  name: string
  slug: string
  codePrefix: string
  primaryColor: string
  secondaryColor: string
  pageBackgroundColor: string
  surfaceColor: string
  panelColor: string
  textColor: string
  titleColor: string
  logoUrl: string | null
  logoBgColor: string | null
  logoSize: number | null
  isActive: boolean
}

export function SucursalesClient({ initialBranches }: { initialBranches: Branch[] }) {
  const queryClient = useQueryClient()
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const [editTab, setEditTab] = useState<"branding" | "categories">("branding")
  const [categories, setCategories] = useState<any[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [showCatForm, setShowCatForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any | null>(null)
  
  const [catForm, setCatForm] = useState({
    name: "",
    price: "" as string | number,
    includedConsumptions: 0,
    description: ""
  })

  const [form, setForm] = useState({
    name: "",
    primaryColor: "#39ff14",
    secondaryColor: "#39ff14",
    pageBackgroundColor: "#000000",
    surfaceColor: "#050505",
    panelColor: "#000000",
    textColor: "#ffffff",
    titleColor: "#ffffff",
    logoUrl: "" as string,
    logoBgColor: "#f4f4f5" as string,
    logoSize: 64 as number,
  })

  const loadCategories = async (branchId: string) => {
    setLoadingCategories(true)
    setErrorMsg("")
    try {
      const res = await fetch(`/api/attendees/categories?branchId=${branchId}`)
      if (!res.ok) throw new Error("Error al cargar categorías")
      const json = await res.json()
      setCategories(json.data)
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setLoadingCategories(false)
    }
  }

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBranch) return
    setErrorMsg("")
    try {
      const url = editingCategory 
        ? `/api/attendees/categories/${editingCategory.id}` 
        : `/api/attendees/categories`
      const method = editingCategory ? "PATCH" : "POST"
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedBranch.id,
          name: catForm.name,
          price: parseThousands(catForm.price),
          includedConsumptions: Number(catForm.includedConsumptions),
          description: catForm.description
        })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al guardar categoría")
      
      const json = await res.json()
      if (editingCategory) {
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? json.data : c))
      } else {
        setCategories(prev => [...prev, json.data])
      }
      setShowCatForm(false)
      setEditingCategory(null)
      setCatForm({ name: "", price: "", includedConsumptions: 0, description: "" })
    } catch (err: any) {
      setErrorMsg(err.message)
    }
  }

  const handleDeleteCategory = async (cat: any) => {
    if (!confirm(`¿Estás seguro de que deseas desactivar la categoría "${cat.name}"? Los asistentes que ya la tengan asignada no se verán afectados.`)) return
    setErrorMsg("")
    try {
      const res = await fetch(`/api/attendees/categories/${cat.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error || "Error al desactivar categoría")
      setCategories(prev => prev.filter(c => c.id !== cat.id))
    } catch (err: any) {
      setErrorMsg(err.message)
    }
  }


  const updateBranchMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (!selectedBranch) return
      const res = await fetch(`/api/branches/${selectedBranch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          logoUrl: data.logoUrl || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al actualizar sucursal")
      return res.json()
    },
    onSuccess: (resJson) => {
      queryClient.invalidateQueries({ queryKey: ["branches"] })
      setBranches((prev) =>
        prev.map((b) => (b.id === selectedBranch?.id ? resJson.data : b))
      )
      setShowEditModal(false)
      setSelectedBranch(null)
      setErrorMsg("")
    },
    onError: (err: any) => setErrorMsg(err.message),
  })

  const deleteBranchMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/branches/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error || "Error al eliminar sucursal")
      return res.json()
    },
    onSuccess: (resJson) => {
      queryClient.invalidateQueries({ queryKey: ["branches"] })
      setBranches(prev => prev.filter(b => b.id !== resJson.data.id))
      setShowEditModal(false)
      setSelectedBranch(null)
      setErrorMsg("")
      import("sonner").then(({ toast }) => {
        toast.success("¡Sucursal eliminada con éxito!")
      })
    },
    onError: (err: any) => setErrorMsg(err.message)
  })

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: "",
    codePrefix: "",
    primaryColor: "#39ff14",
    secondaryColor: "#e9ffe9",
    pageBackgroundColor: "#000000",
    surfaceColor: "#0f1113",
    panelColor: "#15181c",
    logoUrl: "",
    logoBgColor: "#15181c",
    logoSize: 64,
    contactEmail: "",
    contactPhone: "",
  })

  const createBranchMutation = useMutation({
    mutationFn: async (data: typeof createForm) => {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          logoUrl: data.logoUrl || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al crear sucursal")
      return res.json()
    },
    onSuccess: (resJson) => {
      queryClient.invalidateQueries({ queryKey: ["branches"] })
      setBranches((prev) => [resJson.data, ...prev])
      setShowCreateModal(false)
      setCreateForm({
        name: "",
        codePrefix: "",
        primaryColor: "#6366f1",
        secondaryColor: "#818cf8",
        pageBackgroundColor: "#030712",
        surfaceColor: "#111827",
        panelColor: "#1f2937",
        logoUrl: "",
        logoBgColor: "#1f2937",
        logoSize: 64,
        contactEmail: "",
        contactPhone: "",
      })
      setErrorMsg("")
    },
    onError: (err: any) => setErrorMsg(err.message),
  })

  const handleOpenEdit = (branch: Branch) => {
    setSelectedBranch(branch)
    setForm({
      name: branch.name,
      primaryColor: branch.primaryColor || "#102542",
      secondaryColor: branch.secondaryColor || "#ffffff",
      pageBackgroundColor: branch.pageBackgroundColor || "#f8f9fa",
      surfaceColor: branch.surfaceColor || "#0f1113",
      panelColor: branch.panelColor || "#15181c",
      textColor: branch.textColor || "#ffffff",
      titleColor: branch.titleColor || "#ffffff",
      logoUrl: branch.logoUrl || "",
      logoBgColor: branch.logoBgColor || "#f4f4f5",
      logoSize: branch.logoSize || 64,
    })
    setEditTab("branding")
    setCategories([])
    setShowCatForm(false)
    setEditingCategory(null)
    setErrorMsg("")
    loadCategories(branch.id)
    setShowEditModal(true)
  }

  const handleSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const isSvg = file.type === "image/svg+xml" || file.name.endsWith(".svg")
    
    const reader = new FileReader()
    reader.onload = (event) => {
      let resultStr = event.target?.result as string
      if (!isSvg) {
        resultStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
  <image href="${resultStr}" x="0" y="0" width="500" height="500" preserveAspectRatio="xMidYMid meet"/>
</svg>`
      }
      setForm((prev) => ({ ...prev, logoUrl: resultStr }))
    }
    
    if (isSvg) {
      reader.readAsText(file)
    } else {
      reader.readAsDataURL(file)
    }
  }

  const renderSvgLogo = (logoStr: string | null) => {
    if (!logoStr) {
      return <Building2 className="text-zinc-600 dark:text-zinc-400 w-6 h-6" />
    }
    const cleanStr = logoStr.trim()
    if (cleanStr.startsWith("<svg")) {
      return (
        <div
          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full p-1"
          dangerouslySetInnerHTML={{ __html: logoStr }}
        />
      )
    }
    if (cleanStr.startsWith("data:") || cleanStr.startsWith("http")) {
      return (
        <img
          src={logoStr}
          alt="Logo"
          className="max-w-full max-h-full object-contain p-1"
        />
      )
    }
    return <Building2 className="text-zinc-600 dark:text-zinc-400 w-6 h-6" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sucursales</h2>
          <p className="text-zinc-500">Gestiona las sucursales y sus configuraciones.</p>
        </div>
        <button
          onClick={() => {
            setErrorMsg("")
            setShowCreateModal(true)
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          <Plus size={18} />
          Nueva Sucursal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((branch) => (
          <div
            key={branch.id}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex flex-col transition-all hover:shadow-md"
          >
            <div className="flex items-start justify-between mb-4">
              <div 
                className="rounded-lg flex items-center justify-center transition-all overflow-hidden shrink-0"
                style={{ 
                  backgroundColor: branch.logoBgColor || "#f4f4f5", 
                  width: `${branch.logoSize || 64}px`, 
                  height: `${branch.logoSize || 64}px` 
                }}
              >
                {renderSvgLogo(branch.logoUrl)}
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  branch.isActive
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {branch.isActive ? "Activa" : "Inactiva"}
              </span>
            </div>

            <h3 className="font-semibold text-lg">{branch.name}</h3>
            <p className="text-sm text-zinc-500 font-mono mt-1">Prefix: {branch.codePrefix}</p>

            {/* Colors Preview */}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-zinc-400">Colores:</span>
              <div
                className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-700"
                style={{ backgroundColor: branch.primaryColor }}
                title={`Primario: ${branch.primaryColor}`}
              />
              <div
                className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-700"
                style={{ backgroundColor: branch.secondaryColor }}
                title={`Secundario: ${branch.secondaryColor}`}
              />
              <div
                className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-700"
                style={{ backgroundColor: branch.pageBackgroundColor }}
                title={`Fondo: ${branch.pageBackgroundColor}`}
              />
            </div>

            <div className="mt-6 flex gap-3 mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => handleOpenEdit(branch)}
                className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1"
              >
                <Edit2 size={14} /> Configurar
              </button>
              <Link
                href={`/sucursales/${branch.slug}/staff`}
                className="text-sm text-zinc-600 dark:text-zinc-400 font-medium hover:underline"
              >
                Staff
              </Link>
              <button
                onClick={() => {
                   if(confirm("¿Estás seguro de que deseas volver al estilo predeterminado?")) {
                      setSelectedBranch(branch);
                      updateBranchMutation.mutate({
                          name: branch.name,
                          primaryColor: "#39ff14",
                          secondaryColor: "#e9ffe9",
                          pageBackgroundColor: "#000000",
                          surfaceColor: "#0f1113",
                          panelColor: "#15181c",
                          textColor: "#ffffff",
                          titleColor: "#39ff14",
                          logoUrl: branch.logoUrl || "",
                          logoBgColor: "#15181c",
                          logoSize: branch.logoSize || 64,
                      });
                   }
                }}
                disabled={updateBranchMutation.isPending && selectedBranch?.id === branch.id}
                className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline ml-auto"
              >
                {updateBranchMutation.isPending && selectedBranch?.id === branch.id ? "Cargando..." : "Restaurar Estilo"}
              </button>
            </div>
          </div>
        ))}

        {branches.length === 0 && (
          <div className="col-span-full py-12 text-center text-zinc-500 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            No tienes sucursales asignadas.
          </div>
        )}
      </div>

      {/* EDIT CONFIG MODAL */}
      {showEditModal && selectedBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Store className="text-indigo-600" /> Configurar Sucursal
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedBranch(null)
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Tab Switching */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-2">
              <button
                type="button"
                onClick={() => setEditTab("branding")}
                className={`flex-1 pb-2 text-sm font-semibold border-b-2 text-center transition-colors ${
                  editTab === "branding"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                Branding
              </button>
              <button
                type="button"
                onClick={() => setEditTab("categories")}
                className={`flex-1 pb-2 text-sm font-semibold border-b-2 text-center transition-colors ${
                  editTab === "categories"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                Categorías de Ticket
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <ShieldAlert size={16} /> {errorMsg}
              </div>
            )}

            {editTab === "branding" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  updateBranchMutation.mutate(form)
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    Nombre de la Sucursal
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Colors Settings */}
                <div className="border-t pt-3 border-zinc-200 dark:border-zinc-800 space-y-3">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Colores de Marca
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 block mb-1">
                        Color Primario
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={form.primaryColor}
                          onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                          className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={form.primaryColor}
                          onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                          className="w-full text-sm px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950"
                          maxLength={7}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-500 block mb-1">
                        Color Secundario
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={form.secondaryColor}
                          onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                          className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={form.secondaryColor}
                          onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                          className="w-full text-sm px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 block mb-1">
                        Fondo Degradado 1 (Inicio)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={form.pageBackgroundColor}
                          onChange={(e) => setForm({ ...form, pageBackgroundColor: e.target.value })}
                          className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={form.pageBackgroundColor}
                          onChange={(e) => setForm({ ...form, pageBackgroundColor: e.target.value })}
                          className="w-full text-xs px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-500 block mb-1">
                        Color Superficie
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={form.surfaceColor}
                          onChange={(e) => setForm({ ...form, surfaceColor: e.target.value })}
                          className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={form.surfaceColor}
                          onChange={(e) => setForm({ ...form, surfaceColor: e.target.value })}
                          className="w-full text-xs px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-500 block mb-1">
                        Fondo Degradado 2 (Fin)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={form.panelColor}
                          onChange={(e) => setForm({ ...form, panelColor: e.target.value })}
                          className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={form.panelColor}
                          onChange={(e) => setForm({ ...form, panelColor: e.target.value })}
                          className="w-full text-xs px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-1 mt-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 block mb-1">
                        Color de Texto
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={form.textColor}
                          onChange={(e) => setForm({ ...form, textColor: e.target.value })}
                          className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={form.textColor}
                          onChange={(e) => setForm({ ...form, textColor: e.target.value })}
                          className="w-full text-xs px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-500 block mb-1">
                        Color de Títulos
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={form.titleColor}
                          onChange={(e) => setForm({ ...form, titleColor: e.target.value })}
                          className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={form.titleColor}
                          onChange={(e) => setForm({ ...form, titleColor: e.target.value })}
                          className="w-full text-xs px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Logo SVG Settings */}
                <div className="border-t pt-3 border-zinc-200 dark:border-zinc-800 space-y-3">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Logo de la Sucursal
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-1">
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 block mb-1">
                        Color de Fondo del Logo
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={form.logoBgColor || "#f4f4f5"}
                          onChange={(e) => setForm({ ...form, logoBgColor: e.target.value })}
                          className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={form.logoBgColor || "#f4f4f5"}
                          onChange={(e) => setForm({ ...form, logoBgColor: e.target.value })}
                          className="w-full text-xs px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-500 block mb-1">
                        Tamaño del Logo: {form.logoSize || 64}px
                      </label>
                      <input
                        type="range"
                        min="32"
                        max="160"
                        step="4"
                        value={form.logoSize || 64}
                        onChange={(e) => setForm({ ...form, logoSize: parseInt(e.target.value) || 64 })}
                        className="w-full accent-indigo-600 mt-2 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-500 block mb-1">
                      Cargar imagen de logo
                    </label>
                    <label className="flex items-center gap-2 justify-center px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors text-sm font-medium">
                      <Upload size={16} />
                      <span>Seleccionar Imagen</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSvgUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-500 block mb-1">
                      Código SVG Inline
                    </label>
                    <textarea
                      rows={3}
                      value={form.logoUrl}
                      onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                      placeholder="Pega el código <svg> aquí..."
                      className="w-full text-xs font-mono px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {form.logoUrl && (
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 block mb-1">
                        Previsualización Logo:
                      </label>
                      <div className="p-4 border border-dashed rounded-lg bg-zinc-50 dark:bg-zinc-900/50 flex justify-center items-center min-h-[180px]">
                        <div 
                          className="rounded-lg flex items-center justify-center overflow-hidden transition-all shadow-inner"
                          style={{ 
                            backgroundColor: form.logoBgColor || "#f4f4f5", 
                            width: `${form.logoSize || 64}px`, 
                            height: `${form.logoSize || 64}px` 
                          }}
                        >
                          {renderSvgLogo(form.logoUrl)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("¿Estás seguro de que deseas eliminar esta sucursal? Se borrarán todos los eventos asociados.")) {
                        deleteBranchMutation.mutate(selectedBranch.id)
                      }
                    }}
                    disabled={deleteBranchMutation.isPending}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {deleteBranchMutation.isPending ? "Eliminando..." : "Eliminar"}
                  </button>

                  <div className="flex-1"></div>

                  <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                    <Store size={18} className="shrink-0" />
                    <span>¿Establecer Verne Neon Dark por defecto?</span>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultNeon = {
                          ...form,
                          primaryColor: "#39ff14",
                          secondaryColor: "#e9ffe9",
                          pageBackgroundColor: "#000000",
                          surfaceColor: "#0f1113",
                          panelColor: "#15181c",
                          textColor: "#ffffff",
                          titleColor: "#39ff14"
                        }
                        setForm(defaultNeon)
                        updateBranchMutation.mutate(defaultNeon)
                      }}
                      className="px-4 py-2 bg-zinc-950 text-[#39ff14] border border-[#39ff14]/30 hover:bg-zinc-900 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                      disabled={updateBranchMutation.isPending}
                    >
                      {updateBranchMutation.isPending ? "Aplicando..." : "Restaurar Tema Dark"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedBranch(null)
                    }}
                    className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={updateBranchMutation.isPending}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            ) : (
              /* CATEGORIES CRUD TAB */
              <div className="space-y-4 animate-in fade-in duration-200">
                {!showCatForm ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        Categorías Activas
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(null)
                          setCatForm({ name: "", price: "", includedConsumptions: 0, description: "" })
                          setShowCatForm(true)
                        }}
                        className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded font-semibold transition-colors"
                      >
                        <Plus size={14} /> Nueva Categoría
                      </button>
                    </div>

                    {loadingCategories ? (
                      <div className="text-center py-6 text-zinc-500 text-sm">Cargando categorías...</div>
                    ) : (
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50/30 dark:bg-zinc-900/10">
                        <div className="max-h-[40vh] overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800">
                          {categories.map((cat) => (
                            <div key={cat.id} className="p-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                              <div>
                                <span className="font-semibold text-sm block text-zinc-800 dark:text-zinc-200">{cat.name}</span>
                                <span className="text-xs text-zinc-400">
                                  Precio: ${Number(cat.price).toLocaleString()} | Bebidas: {cat.includedConsumptions}
                                </span>
                                {cat.description && (
                                  <p className="text-[11px] text-zinc-500 max-w-xs truncate mt-0.5">{cat.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCategory(cat)
                                    setCatForm({
                                      name: cat.name,
                                      price: formatThousands(cat.price),
                                      includedConsumptions: cat.includedConsumptions,
                                      description: cat.description || ""
                                    })
                                    setShowCatForm(true)
                                  }}
                                  className="p-1 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                                  title="Editar"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(cat)}
                                  className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                                  title="Desactivar"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {categories.length === 0 && (
                            <div className="text-center py-8 text-zinc-400 text-sm">
                              No hay categorías registradas. Crea una para comenzar.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* INLINE FORM FOR CATEGORY CREATE/EDIT */
                  <form onSubmit={handleSaveCategory} className="border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl space-y-4 bg-zinc-50/50 dark:bg-zinc-900/20">
                    <h4 className="text-sm font-bold flex items-center gap-1.5 border-b pb-2 border-zinc-200 dark:border-zinc-800">
                      {editingCategory ? <Edit2 size={16} /> : <Plus size={16} />}
                      {editingCategory ? "Editar Categoría" : "Nueva Categoría de Acceso"}
                    </h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-zinc-500 block mb-1">Nombre de la Categoría</label>
                        <input
                          type="text"
                          placeholder="Ej: VIP, General, Cortesía"
                          value={catForm.name}
                          onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                          className="w-full px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-zinc-500 block mb-1">Precio de Entrada</label>
                        <input
                          type="text"
                          placeholder="0"
                          value={catForm.price}
                          onChange={(e) => setCatForm({ ...catForm, price: formatThousands(e.target.value) })}
                          className="w-full px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-zinc-500 block mb-1">Bebidas Incluidas (Consumos)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={catForm.includedConsumptions}
                          onChange={(e) => setCatForm({ ...catForm, includedConsumptions: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-500 block mb-1">Descripción corta (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej: Incluye acceso a zona VIP y backstage"
                        value={catForm.description}
                        onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex gap-2 justify-end border-t pt-3 border-zinc-200 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setShowCatForm(false)}
                        className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md font-semibold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-xs transition-colors shadow-sm"
                      >
                        Guardar Categoría
                      </button>
                    </div>
                  </form>
                )}

                {!showCatForm && (
                  <div className="flex gap-3 justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false)
                        setSelectedBranch(null)
                      }}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-sm font-semibold transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
              </div>
      )}

      {/* CREATE BRANCH MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Store className="text-indigo-600" /> Nueva Sucursal
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-semibold"
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
                createBranchMutation.mutate(createForm)
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    Nombre de la Sucursal
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="ej. Sucursal Sur"
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    Prefijo Código (Max 12)
                  </label>
                  <input
                    type="text"
                    value={createForm.codePrefix}
                    onChange={(e) => setCreateForm({ ...createForm, codePrefix: e.target.value.toUpperCase() })}
                    placeholder="ej. SUR"
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    Email de Contacto
                  </label>
                  <input
                    type="email"
                    value={createForm.contactEmail}
                    onChange={(e) => setCreateForm({ ...createForm, contactEmail: e.target.value })}
                    placeholder="contacto@dmt.com"
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={createForm.contactPhone}
                    onChange={(e) => setCreateForm({ ...createForm, contactPhone: e.target.value })}
                    placeholder="+57 300..."
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Colors Settings */}
              <div className="border-t pt-3 border-zinc-200 dark:border-zinc-800 space-y-3">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Colores de Marca
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 block mb-1">
                      Color Primario
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={createForm.primaryColor}
                        onChange={(e) => setCreateForm({ ...createForm, primaryColor: e.target.value })}
                        className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={createForm.primaryColor}
                        onChange={(e) => setCreateForm({ ...createForm, primaryColor: e.target.value })}
                        className="w-full text-sm px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-500 block mb-1">
                      Color Secundario
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={createForm.secondaryColor}
                        onChange={(e) => setCreateForm({ ...createForm, secondaryColor: e.target.value })}
                        className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={createForm.secondaryColor}
                        onChange={(e) => setCreateForm({ ...createForm, secondaryColor: e.target.value })}
                        className="w-full text-sm px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 block mb-1">
                      Fondo Degradado 1 (Inicio)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={createForm.pageBackgroundColor}
                        onChange={(e) => setCreateForm({ ...createForm, pageBackgroundColor: e.target.value })}
                        className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={createForm.pageBackgroundColor}
                        onChange={(e) => setCreateForm({ ...createForm, pageBackgroundColor: e.target.value })}
                        className="w-full text-xs px-1.5 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 font-mono text-[11px]"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-500 block mb-1">
                      Superficie
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={createForm.surfaceColor}
                        onChange={(e) => setCreateForm({ ...createForm, surfaceColor: e.target.value })}
                        className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={createForm.surfaceColor}
                        onChange={(e) => setCreateForm({ ...createForm, surfaceColor: e.target.value })}
                        className="w-full text-xs px-1.5 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 font-mono text-[11px]"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-500 block mb-1">
                      Fondo Degradado 2 (Fin)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={createForm.panelColor}
                        onChange={(e) => setCreateForm({ ...createForm, panelColor: e.target.value })}
                        className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={createForm.panelColor}
                        onChange={(e) => setCreateForm({ ...createForm, panelColor: e.target.value })}
                        className="w-full text-xs px-1.5 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 font-mono text-[11px]"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Logo SVG Settings */}
              <div className="border-t pt-3 border-zinc-200 dark:border-zinc-800 space-y-3">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Logo de la Sucursal
                </p>

                <div className="grid grid-cols-2 gap-3 mb-1">
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 block mb-1">
                      Color de Fondo del Logo
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={createForm.logoBgColor || "#f4f4f5"}
                        onChange={(e) => setCreateForm({ ...createForm, logoBgColor: e.target.value })}
                        className="w-8 h-8 p-0 border border-zinc-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={createForm.logoBgColor || "#f4f4f5"}
                        onChange={(e) => setCreateForm({ ...createForm, logoBgColor: e.target.value })}
                        className="w-full text-xs px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 font-mono"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-500 block mb-1">
                      Tamaño del Logo: {createForm.logoSize || 64}px
                    </label>
                    <input
                      type="range"
                      min="32"
                      max="160"
                      step="4"
                      value={createForm.logoSize || 64}
                      onChange={(e) => setCreateForm({ ...createForm, logoSize: parseInt(e.target.value) || 64 })}
                      className="w-full accent-indigo-600 mt-2 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    Cargar imagen de logo
                  </label>
                  <label className="flex items-center gap-2 justify-center px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors text-sm font-medium">
                    <Upload size={16} />
                    <span>Seleccionar Imagen</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const isSvg = file.type === "image/svg+xml" || file.name.endsWith(".svg")
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          let resultStr = event.target?.result as string
                          if (!isSvg) {
                            resultStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
  <image href="${resultStr}" x="0" y="0" width="500" height="500" preserveAspectRatio="xMidYMid meet"/>
</svg>`
                          }
                          setCreateForm((prev) => ({ ...prev, logoUrl: resultStr }))
                        }
                        if (isSvg) {
                          reader.readAsText(file)
                        } else {
                          reader.readAsDataURL(file)
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    Código SVG Inline
                  </label>
                  <textarea
                    rows={3}
                    value={createForm.logoUrl}
                    onChange={(e) => setCreateForm({ ...createForm, logoUrl: e.target.value })}
                    placeholder="Pega el código <svg> aquí..."
                    className="w-full text-xs font-mono px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {createForm.logoUrl && (
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 block mb-1">
                      Previsualización Logo:
                    </label>
                    <div className="p-4 border border-dashed rounded-lg bg-zinc-50 dark:bg-zinc-900/50 flex justify-center items-center min-h-[180px]">
                      <div 
                        className="rounded-lg flex items-center justify-center overflow-hidden transition-all shadow-inner"
                        style={{ 
                          backgroundColor: createForm.logoBgColor || "#f4f4f5", 
                          width: `${createForm.logoSize || 64}px`, 
                          height: `${createForm.logoSize || 64}px` 
                        }}
                      >
                        {renderSvgLogo(createForm.logoUrl)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createBranchMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Crear Sucursal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
