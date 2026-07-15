"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { UserCheck, ShieldAlert, UserPlus, UserCog, ToggleLeft, ToggleRight, Trash2, Edit2, Plus, Store, Calendar } from "lucide-react"

export default function UsuariosPage() {
  const queryClient = useQueryClient()
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session")
      if (!res.ok) return null
      return await res.json()
    }
  })
  
  const isSuper = session?.user?.isSuperuser || session?.user?.isGlobalAdmin;

  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    isSuperuser: false,
    isGlobalAdmin: false,
  })

  const [editForm, setEditForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    isSuperuser: false,
    isGlobalAdmin: false,
    isActive: true,
  })

  const [membershipForm, setMembershipForm] = useState({
    branchId: "",
    role: "BAR" as const,
  })

  const [activeEditTab, setActiveEditTab] = useState<"profile" | "branches" | "events">("profile")

  const [eventForm, setEventForm] = useState({
    branchId: "",
    eventId: "",
    role: "BAR" as const,
  })

  // Query events for the selected branch in eventForm
  const { data: formEvents, isLoading: formEventsLoading } = useQuery({
    queryKey: ["events", "admin", eventForm.branchId],
    queryFn: async () => {
      if (!eventForm.branchId) return []
      const res = await fetch(`/api/events?branchId=${eventForm.branchId}`)
      if (!res.ok) throw new Error("Error cargando eventos")
      const json = await res.json()
      return json.data as any[]
    },
    enabled: !!eventForm.branchId,
  })

  const addEventAssignmentMutation = useMutation({
    mutationFn: async (data: typeof eventForm) => {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/event-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al asignar evento")
      return res.json()
    },
    onSuccess: (resJson) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setSelectedUser((prev: any) => {
        const assignedEvent = formEvents?.find(e => e.id === resJson.data.eventId)
        return {
          ...prev,
          eventAssignments: [
            ...(prev.eventAssignments || []),
            {
              id: resJson.data.id,
              branchId: resJson.data.branchId,
              eventId: resJson.data.eventId,
              role: resJson.data.role,
              event: assignedEvent || { id: resJson.data.eventId, name: "Evento Asignado" }
            }
          ]
        }
      })
      setEventForm(prev => ({ ...prev, eventId: "" }))
    },
    onError: (err: any) => alert(err.message)
  })

  const removeEventAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/event-assignments/${assignmentId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Error al remover evento")
      return res.json()
    },
    onSuccess: (_, assignmentId) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setSelectedUser((prev: any) => ({
        ...prev,
        eventAssignments: prev.eventAssignments.filter((a: any) => a.id !== assignmentId)
      }))
    },
    onError: (err: any) => alert(err.message)
  })

  // Queries
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users")
      if (!res.ok) throw new Error("Error cargando usuarios")
      return (await res.json()).data as any[]
    }
  })

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches")
      if (!res.ok) throw new Error("Error cargando sucursales")
      return (await res.json()).data as any[]
    }
  })

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: async (data: typeof createForm) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al crear")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setShowCreateModal(false)
      setCreateForm({ username: "", email: "", firstName: "", lastName: "", password: "", isSuperuser: false, isGlobalAdmin: false })
      setErrorMsg("")
    },
    onError: (err: any) => setErrorMsg(err.message)
  })

  const editUserMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al actualizar")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setShowEditModal(false)
      setSelectedUser(null)
      setErrorMsg("")
    },
    onError: (err: any) => setErrorMsg(err.message)
  })

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error || "Error al eliminar")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    },
    onError: (err: any) => alert(err.message)
  })

  const addMembershipMutation = useMutation({
    mutationFn: async (data: typeof membershipForm) => {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al asignar membresía")
      return res.json()
    },
    onSuccess: (resJson) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      // Update selectedUser structure locally so the UI updates
      setSelectedUser((prev: any) => ({
        ...prev,
        branchMemberships: [...(prev.branchMemberships || []), {
          id: resJson.data.id,
          branchId: resJson.data.branchId,
          role: resJson.data.role,
          branch: branches?.find(b => b.id === resJson.data.branchId)
        }]
      }))
    },
    onError: (err: any) => alert(err.message)
  })

  const removeMembershipMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/memberships/${membershipId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Error al remover sucursal")
      return res.json()
    },
    onSuccess: (_, membershipId) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setSelectedUser((prev: any) => ({
        ...prev,
        branchMemberships: prev.branchMemberships.filter((m: any) => m.id !== membershipId)
      }))
    }
  })

  const handleOpenEdit = (user: any) => {
    setSelectedUser(user)
    setEditForm({
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      password: "",
      isSuperuser: user.isSuperuser,
      isGlobalAdmin: user.isGlobalAdmin,
      isActive: user.isActive,
    })
    setActiveEditTab("profile")
    setEventForm({ branchId: "", eventId: "", role: "BAR" })
    setShowEditModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Administración de Usuarios</h2>
          <p className="text-emerald-500">Administra accesos globales, asignaciones a sucursales y roles.</p>
        </div>
        <button 
          onClick={() => { setErrorMsg(""); setShowCreateModal(true) }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          <UserPlus size={18} />
          Nuevo Usuario
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium text-emerald-500">Nombre / Usuario</th>
                <th className="px-6 py-3 font-medium text-emerald-500">Roles Globales</th>
                <th className="px-6 py-3 font-medium text-emerald-500">Sucursales</th>
                <th className="px-6 py-3 font-medium text-emerald-500">Eventos</th>
                <th className="px-6 py-3 font-medium text-emerald-500">Estado</th>
                <th className="px-6 py-3 font-medium text-emerald-500 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {usersLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-emerald-500">Cargando usuarios...</td>
                </tr>
              ) : users?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-emerald-500">No hay usuarios en el sistema.</td>
                </tr>
              ) : (
                users?.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-zinc-900 dark:text-white">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-emerald-500">@{u.username} &bull; {u.email}</p>
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      {u.isSuperuser && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900">
                          Superusuario
                        </span>
                      )}
                      {u.isGlobalAdmin && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900 ml-1">
                          Admin Global
                        </span>
                      )}
                      {!u.isSuperuser && !u.isGlobalAdmin && (
                        <span className="text-emerald-500 text-xs">Personal Estándar</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {u.branchMemberships?.map((m: any, idx: number) => (
                          <span key={`${m.id}-${idx}`} className="px-2 py-0.5 rounded text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-emerald-500 border border-zinc-200 dark:border-zinc-700">
                            {m.branch.name} ({m.role})
                          </span>
                        ))}
                        {(!u.branchMemberships || u.branchMemberships.length === 0) && (
                          <span className="text-emerald-500 text-xs">Sin sucursales</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {u.eventAssignments?.map((a: any, idx: number) => (
                          <span key={`${a.id}-${idx}`} className="px-2 py-0.5 rounded text-xs bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                            {a.event?.name || "Evento"} ({a.role})
                          </span>
                        ))}
                        {(!u.eventAssignments || u.eventAssignments.length === 0) && (
                          <span className="text-emerald-500 text-xs">Sin eventos</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-emerald-500"}`}>
                        {u.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-emerald-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => { if(confirm("¿Eliminar usuario?")) deleteUserMutation.mutate(u.id) }}
                        className="p-1.5 border border-zinc-200 dark:border-zinc-800 text-emerald-500 hover:text-red-600 hover:border-red-200 dark:hover:text-red-400 dark:hover:border-red-900 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <UserPlus className="text-indigo-600" /> Crear Nuevo Usuario
            </h3>

            {errorMsg && (
              <div className="p-3 mb-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <ShieldAlert size={16} /> {errorMsg}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); createUserMutation.mutate(createForm) }} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-emerald-500 block mb-1">Nombre de Usuario</label>
                <input 
                  type="text" 
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  placeholder="ej. juan_perez" 
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-emerald-500 block mb-1">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="ej. juan@dmt.com" 
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-emerald-500 block mb-1">Nombre</label>
                  <input 
                    type="text" 
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    placeholder="Juan" 
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-emerald-500 block mb-1">Apellido</label>
                  <input 
                    type="text" 
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    placeholder="Perez" 
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-emerald-500 block mb-1">Contraseña</label>
                <input 
                  type="password" 
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres" 
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {isSuper && (
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Permisos y Roles Globales</p>
                  
                  <label className="flex items-center justify-between p-2 border rounded-md cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    <div>
                      <p className="text-sm font-semibold">Superusuario</p>
                      <p className="text-xs text-emerald-500">Acceso total absoluto al sistema</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, isSuperuser: !createForm.isSuperuser })}
                      className="text-emerald-500 hover:text-indigo-600 transition-colors"
                    >
                      {createForm.isSuperuser ? <ToggleRight size={28} className="text-red-600" /> : <ToggleLeft size={28} />}
                    </button>
                  </label>

                  <label className="flex items-center justify-between p-2 border rounded-md cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    <div>
                      <p className="text-sm font-semibold">Administrador Global</p>
                      <p className="text-xs text-emerald-500">Permisos de gestión sin límite de sucursal</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, isGlobalAdmin: !createForm.isGlobalAdmin })}
                      className="text-emerald-500 hover:text-indigo-600 transition-colors"
                    >
                      {createForm.isGlobalAdmin ? <ToggleRight size={28} className="text-blue-600" /> : <ToggleLeft size={28} />}
                    </button>
                  </label>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <UserCog className="text-indigo-600" /> @{selectedUser.username}
              </h3>
              <button onClick={() => { setShowEditModal(false); setSelectedUser(null) }} className="text-emerald-500 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-semibold">✕</button>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-2">
              <button
                type="button"
                onClick={() => setActiveEditTab("profile")}
                className={`flex-1 pb-2 text-sm font-semibold border-b-2 text-center transition-colors ${activeEditTab === "profile" ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400" : "border-transparent text-emerald-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
              >
                Perfil
              </button>
              <button
                type="button"
                onClick={() => setActiveEditTab("branches")}
                className={`flex-1 pb-2 text-sm font-semibold border-b-2 text-center transition-colors ${activeEditTab === "branches" ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400" : "border-transparent text-emerald-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
              >
                Sucursales
              </button>
              <button
                type="button"
                onClick={() => setActiveEditTab("events")}
                className={`flex-1 pb-2 text-sm font-semibold border-b-2 text-center transition-colors ${activeEditTab === "events" ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400" : "border-transparent text-emerald-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
              >
                Eventos
              </button>
            </div>

            {/* TAB CONTENT: PROFILE */}
            {activeEditTab === "profile" && (
              <form onSubmit={(e) => { e.preventDefault(); editUserMutation.mutate(editForm) }} className="space-y-4 pt-2">
                {errorMsg && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                    <ShieldAlert size={16} /> {errorMsg}
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-emerald-500 block mb-1">Correo Electrónico</label>
                  <input 
                    type="email" 
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-emerald-500 block mb-1">Nombre</label>
                    <input 
                      type="text" 
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-emerald-500 block mb-1">Apellido</label>
                    <input 
                      type="text" 
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-emerald-500 block mb-1">Cambiar Contraseña</label>
                  <input 
                    type="password" 
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Dejar vacío para no cambiar" 
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2 space-y-2 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Estado y Roles Globales</p>

                  <label className="flex items-center justify-between p-2 border rounded-md cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    <div>
                      <p className="text-sm font-semibold">Usuario Activo</p>
                      <p className="text-xs text-emerald-500">Permite o niega el login</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                      className="text-emerald-500 hover:text-indigo-600 transition-colors"
                    >
                      {editForm.isActive ? <ToggleRight size={28} className="text-green-600" /> : <ToggleLeft size={28} />}
                    </button>
                  </label>
                  
                  {isSuper && (
                    <>
                      <label className="flex items-center justify-between p-2 border rounded-md cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                        <div>
                          <p className="text-sm font-semibold">Superusuario</p>
                          <p className="text-xs text-emerald-500">Acceso total absoluto al sistema</p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setEditForm({ ...editForm, isSuperuser: !editForm.isSuperuser })}
                          className="text-emerald-500 hover:text-indigo-600 transition-colors"
                        >
                          {editForm.isSuperuser ? <ToggleRight size={28} className="text-red-600" /> : <ToggleLeft size={28} />}
                        </button>
                      </label>

                      <label className="flex items-center justify-between p-2 border rounded-md cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                        <div>
                          <p className="text-sm font-semibold">Administrador Global</p>
                          <p className="text-xs text-emerald-500">Permisos globales de gestión</p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setEditForm({ ...editForm, isGlobalAdmin: !editForm.isGlobalAdmin })}
                          className="text-emerald-500 hover:text-indigo-600 transition-colors"
                        >
                          {editForm.isGlobalAdmin ? <ToggleRight size={28} className="text-blue-600" /> : <ToggleLeft size={28} />}
                        </button>
                      </label>
                    </>
                  )}
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button 
                    type="button" 
                    onClick={() => { setShowEditModal(false); setSelectedUser(null) }}
                    className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={editUserMutation.isPending}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            )}

            {/* TAB CONTENT: BRANCHES */}
            {activeEditTab === "branches" && (
              <div className="space-y-4 pt-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Store size={18} className="text-emerald-500" /> Asignar a Sucursales
                </h4>

                <div className="bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-emerald-500 block mb-1">Sucursal</label>
                    <select 
                      value={membershipForm.branchId}
                      onChange={(e) => setMembershipForm({ ...membershipForm, branchId: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Selecciona sucursal</option>
                      {branches?.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-emerald-500 block mb-1">Rol en Sucursal</label>
                    <select 
                      value={membershipForm.role}
                      onChange={(e) => setMembershipForm({ ...membershipForm, role: e.target.value as any })}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="BRANCH_ADMIN">Admin Sucursal</option>
                      <option value="EVENT_ADMIN">Admin Evento</option>
                      <option value="ENTRANCE">Entrada (Check-in)</option>
                      <option value="BAR">Barra (POS)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!membershipForm.branchId) return alert("Selecciona sucursal");
                      addMembershipMutation.mutate(membershipForm);
                    }}
                    className="w-full py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={16} /> Asignar Sucursal
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Sucursales Activas</p>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {selectedUser.branchMemberships?.map((m: any, idx: number) => (
                      <div key={`${m.id}-${idx}`} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                        <div>
                          <p className="font-semibold text-sm">{m.branch.name}</p>
                          <p className="text-xs text-emerald-500">{m.role}</p>
                        </div>
                        <button 
                          onClick={() => removeMembershipMutation.mutate(m.id)}
                          className="p-1 text-emerald-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {(!selectedUser.branchMemberships || selectedUser.branchMemberships.length === 0) && (
                      <p className="text-sm text-emerald-500 text-center py-4">No tiene asignaciones activas</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: EVENTS */}
            {activeEditTab === "events" && (
              <div className="space-y-4 pt-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Calendar size={18} className="text-emerald-500" /> Asignar a Eventos
                </h4>

                <div className="bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-emerald-500 block mb-1">Sucursal</label>
                    <select 
                      value={eventForm.branchId}
                      onChange={(e) => setEventForm({ ...eventForm, branchId: e.target.value, eventId: "" })}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Selecciona sucursal</option>
                      {branches?.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-emerald-500 block mb-1">Evento</label>
                    <select 
                      value={eventForm.eventId}
                      onChange={(e) => setEventForm({ ...eventForm, eventId: e.target.value })}
                      disabled={!eventForm.branchId || formEventsLoading}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      <option value="">
                        {formEventsLoading ? "Cargando eventos..." : !eventForm.branchId ? "Selecciona primero una sucursal" : "Selecciona evento"}
                      </option>
                      {formEvents?.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-emerald-500 block mb-1">Rol en Evento</label>
                    <select 
                      value={eventForm.role}
                      onChange={(e) => setEventForm({ ...eventForm, role: e.target.value as any })}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="BRANCH_ADMIN">Admin Sucursal</option>
                      <option value="EVENT_ADMIN">Admin Evento</option>
                      <option value="ENTRANCE">Entrada (Check-in)</option>
                      <option value="BAR">Barra (POS)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!eventForm.branchId) return alert("Selecciona sucursal");
                      if (!eventForm.eventId) return alert("Selecciona evento");
                      addEventAssignmentMutation.mutate(eventForm);
                    }}
                    className="w-full py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={16} /> Asignar Evento
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Eventos Activos</p>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {selectedUser.eventAssignments?.map((a: any, idx: number) => (
                      <div key={`${a.id}-${idx}`} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                        <div>
                          <p className="font-semibold text-sm">{a.event?.name || "Evento"}</p>
                          <p className="text-xs text-emerald-500">{a.role}</p>
                        </div>
                        <button 
                          onClick={() => removeEventAssignmentMutation.mutate(a.id)}
                          className="p-1 text-emerald-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {(!selectedUser.eventAssignments || selectedUser.eventAssignments.length === 0) && (
                      <p className="text-sm text-emerald-500 text-center py-4">No tiene asignaciones activas de evento</p>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}



