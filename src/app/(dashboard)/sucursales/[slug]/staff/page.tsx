"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { Users, UserPlus, ShieldAlert, ArrowLeft, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import Link from "next/link"

export default function StaffPage() {
  const params = useParams()
  const slug = params.slug as string
  const queryClient = useQueryClient()
  const router = useRouter()

  const [form, setForm] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    role: "BAR",
  })
  const [errorMsg, setErrorMsg] = useState("")

  // Fetch Staff List
  const { data: staffList, isLoading } = useQuery({
    queryKey: ["staff", slug],
    queryFn: async () => {
      const res = await fetch(`/api/branches/${slug}/staff`)
      if (!res.ok) throw new Error("Error loading staff")
      const json = await res.json()
      return json.data as any[]
    }
  })

  // Assign/Create Staff Mutation
  const addStaffMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`/api/branches/${slug}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || "Error assigning staff")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", slug] })
      setForm({ username: "", email: "", firstName: "", lastName: "", password: "", role: "BAR" })
      setErrorMsg("")
    },
    onError: (err: any) => {
      setErrorMsg(err.message)
    }
  })

  // Toggle Staff Active status Mutation
  const toggleMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/branches/${slug}/staff/${userId}`, {
        method: "PATCH",
      })
      if (!res.ok) throw new Error("Error updating status")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", slug] })
    }
  })

  // Remove Staff Mutation
  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/branches/${slug}/staff/${userId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Error removing staff")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", slug] })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addStaffMutation.mutate(form)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sucursales" className="p-2 border rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Personal & Staff</h2>
          <p className="text-zinc-500">Asigna roles a los usuarios de la sucursal.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
              <UserPlus size={20} className="text-zinc-500" /> Asignar Personal
            </h3>
            
            {errorMsg && (
              <div className="p-3 mb-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <ShieldAlert size={16} /> {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Nombre de Usuario</label>
                <input 
                  type="text" 
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="ej. pedro_staff" 
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Email</label>
                <input 
                  type="email" 
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ej. pedro@dmt.com" 
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Nombre</label>
                  <input 
                    type="text" 
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="Pedro" 
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Apellido</label>
                  <input 
                    type="text" 
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="Gomez" 
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Contraseña (Si es nuevo)</label>
                <input 
                  type="password" 
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres" 
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Rol en Sucursal</label>
                <select 
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="BRANCH_ADMIN">Admin Sucursal</option>
                  <option value="EVENT_ADMIN">Admin Evento</option>
                  <option value="ENTRANCE">Entrada (Check-in)</option>
                  <option value="BAR">Barra (POS)</option>
                </select>
              </div>

              <button 
                type="submit" 
                disabled={addStaffMutation.isPending}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
              >
                {addStaffMutation.isPending ? "Asignando..." : "Asignar Rol"}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Users size={20} className="text-zinc-500" /> Personal de la Sucursal
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-3 font-medium text-zinc-500">Usuario</th>
                    <th className="px-6 py-3 font-medium text-zinc-500">Rol</th>
                    <th className="px-6 py-3 font-medium text-zinc-500">Estado</th>
                    <th className="px-6 py-3 font-medium text-zinc-500 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">Cargando personal...</td>
                    </tr>
                  ) : staffList?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">No hay personal asignado a esta sucursal.</td>
                    </tr>
                  ) : (
                    staffList?.map((membership) => (
                      <tr key={membership.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold">{membership.user.firstName} {membership.user.lastName}</p>
                          <p className="text-xs text-zinc-500">@{membership.user.username} &bull; {membership.user.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            {membership.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => toggleMutation.mutate(membership.userId)}
                            className="flex items-center text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            {membership.isActive ? (
                              <ToggleRight size={28} className="text-green-600 dark:text-green-400" />
                            ) : (
                              <ToggleLeft size={28} />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => removeMutation.mutate(membership.userId)}
                            className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
