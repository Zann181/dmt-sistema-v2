"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Edit2, Trash2, Search, ShoppingBag, ShieldAlert, X } from "lucide-react"
import { formatThousands, parseThousands } from "@/shared/utils/price"
import type { Dispatch, SetStateAction } from "react"
import type { UseMutationResult } from "@tanstack/react-query"

interface Product {
  id: string
  name: string
  description: string
  price: number
  isActive: boolean
  createdAt: string
}

export function CatalogoClient({ initialProducts }: { initialProducts: Product[] }) {
  const queryClient = useQueryClient()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [search, setSearch] = useState("")
  
  // Modals status
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  
  const [errorMsg, setErrorMsg] = useState("")

  // Form states
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "" as string | number,
  })

  const createProductMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          price: parseThousands(data.price),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al crear producto")
      return res.json()
    },
    onSuccess: (resJson) => {
      queryClient.invalidateQueries({ queryKey: ["catalog"] })
      setProducts((prev) => [...prev, { ...resJson.data, price: Number(resJson.data.price) }])
      setShowCreateModal(false)
      setForm({ name: "", description: "", price: "" })
      setErrorMsg("")
    },
    onError: (err: any) => setErrorMsg(err.message),
  })

  const updateProductMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (!selectedProduct) return
      const res = await fetch(`/api/catalog/${selectedProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          price: parseThousands(data.price),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al actualizar producto")
      return res.json()
    },
    onSuccess: (resJson) => {
      queryClient.invalidateQueries({ queryKey: ["catalog"] })
      setProducts((prev) =>
        prev.map((p) => (p.id === selectedProduct?.id ? { ...resJson.data, price: Number(resJson.data.price) } : p))
      )
      setShowEditModal(false)
      setSelectedProduct(null)
      setForm({ name: "", description: "", price: "" })
      setErrorMsg("")
    },
    onError: (err: any) => setErrorMsg(err.message),
  })

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/catalog/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al eliminar producto")
      return res.json()
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["catalog"] })
      setProducts((prev) => prev.filter((p) => p.id !== id))
    },
    onError: (err: any) => alert(err.message),
  })

  const handleOpenEdit = (product: Product) => {
    setSelectedProduct(product)
    setForm({
      name: product.name,
      description: product.description,
      price: formatThousands(product.price),
    })
    setErrorMsg("")
    setShowEditModal(true)
  }

  const handleDelete = (product: Product) => {
    if (confirm(`¿Estás seguro de que deseas retirar "${product.name}" del catálogo? Esto deshabilitará el producto de todos los eventos activos.`)) {
      deleteProductMutation.mutate(product.id)
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Catálogo Base</h2>
          <p className="text-emerald-500">Administra los productos globales de esta sucursal.</p>
        </div>
        <button
          onClick={() => {
            setErrorMsg("")
            setForm({ name: "", description: "", price: "" })
            setShowCreateModal(true)
          }}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 w-full sm:w-auto justify-center.5 rounded-lg font-semibold transition-colors shadow-sm"
        >
          <Plus size={18} />
          Nuevo Producto
        </button>
      </div>

      <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 w-full max-w-md shadow-sm">
        <Search className="text-emerald-500" size={18} />
        <input aria-label="Buscar productos"
          type="text"
          placeholder="Buscar productos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-0 outline-none w-full text-sm placeholder:text-emerald-500"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 text-emerald-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4">Descripción</th>
                <th className="px-6 py-4">Precio Base</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/10 transition-colors">
                  <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-white">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-md">
                        <ShoppingBag size={18} />
                      </div>
                      {product.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-emerald-500 max-w-xs truncate">{product.description || "—"}</td>
                  <td className="px-6 py-4 font-bold text-zinc-800 dark:text-zinc-200">
                    ${product.price.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(product)}
                        className="p-1.5 text-emerald-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(product)}
                        className="p-1.5 text-emerald-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                        title="Retirar del catálogo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-emerald-500">
                    No se encontraron productos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      <CreateProductModal showCreateModal={showCreateModal} setShowCreateModal={setShowCreateModal} errorMsg={errorMsg} createProductMutation={createProductMutation} form={form} setForm={setForm} />

      {/* EDIT MODAL */}
      <EditProductModal showEditModal={showEditModal} selectedProduct={selectedProduct} setShowEditModal={setShowEditModal} setSelectedProduct={setSelectedProduct} errorMsg={errorMsg} updateProductMutation={updateProductMutation} form={form} setForm={setForm} />
    </div>
  )
}

function CreateProductModal({ showCreateModal, setShowCreateModal, errorMsg, createProductMutation, form, setForm }: { showCreateModal: boolean; setShowCreateModal: Dispatch<SetStateAction<boolean>>; errorMsg: string; createProductMutation: UseMutationResult<any, any, any, any>; form: { name: string; description: string; price: string | number; }; setForm: Dispatch<SetStateAction<{ name: string; description: string; price: string | number; }>> }) {
  return (
    <>{showCreateModal && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Plus className="text-indigo-600" size={20} /> Nuevo Producto Base
              </h3>
              <button aria-label="Cerrar"
                onClick={() => setShowCreateModal(false)}
                className="text-emerald-500 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X size={18} />
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
                createProductMutation.mutate(form)
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="catalogo-nombre" className="text-xs font-semibold text-emerald-500 block mb-1">Nombre</label>
                <input id="catalogo-nombre"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="catalogo-descripcion" className="text-xs font-semibold text-emerald-500 block mb-1">Descripción</label>
                <textarea id="catalogo-descripcion"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>

              <div>
                <label htmlFor="catalogo-precio-base" className="text-xs font-semibold text-emerald-500 block mb-1">Precio Base</label>
                <input id="catalogo-precio-base"
                  type="text"
                  placeholder="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: formatThousands(e.target.value) })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end w-full border-t pt-4 border-zinc-200 dark:border-zinc-800">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border w-full sm:w-auto justify-center border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md font-semibold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createProductMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {createProductMutation.isPending ? "Creando..." : "Crear Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}</>
  )
}

function EditProductModal({ showEditModal, selectedProduct, setShowEditModal, setSelectedProduct, errorMsg, updateProductMutation, form, setForm }: { showEditModal: boolean; selectedProduct: Product | null; setShowEditModal: Dispatch<SetStateAction<boolean>>; setSelectedProduct: Dispatch<SetStateAction<Product | null>>; errorMsg: string; updateProductMutation: UseMutationResult<any, any, any, any>; form: { name: string; description: string; price: string | number; }; setForm: Dispatch<SetStateAction<{ name: string; description: string; price: string | number; }>> }) {
  return (
    <>{showEditModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Edit2 className="text-indigo-600" size={18} /> Editar Producto
              </h3>
              <button aria-label="Cerrar"
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedProduct(null)
                }}
                className="text-emerald-500 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X size={18} />
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
                updateProductMutation.mutate(form)
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="catalogo-nombre-2" className="text-xs font-semibold text-emerald-500 block mb-1">Nombre</label>
                <input id="catalogo-nombre-2"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="catalogo-descripcion-2" className="text-xs font-semibold text-emerald-500 block mb-1">Descripción</label>
                <textarea id="catalogo-descripcion-2"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>

              <div>
                <label htmlFor="catalogo-precio-base-2" className="text-xs font-semibold text-emerald-500 block mb-1">Precio Base</label>
                <input id="catalogo-precio-base-2"
                  type="text"
                  placeholder="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: formatThousands(e.target.value) })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end w-full border-t pt-4 border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedProduct(null)
                  }}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md font-semibold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updateProductMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {updateProductMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}</>
  )
}
