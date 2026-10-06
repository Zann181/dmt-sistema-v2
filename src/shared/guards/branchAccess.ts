import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import type { BranchRole } from "@prisma/client"
import { prisma } from "@/infrastructure/database/prisma"
import { IdentityService } from "@/domains/identity/services/IdentityService"
import type { PermissionFlags } from "@/types/next-auth"
import { getCachedSessionUser } from "@/lib/auth"

// evento -> sucursal no cambia nunca: se guarda en memoria de la instancia
const eventBranchCache = new Map<string, string | null>()

async function getEventBranchId(eventId: string): Promise<string | null> {
  if (eventBranchCache.has(eventId)) return eventBranchCache.get(eventId)!
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { branchId: true } })
  const branchId = event?.branchId ?? null
  if (branchId) {
    if (eventBranchCache.size > 500) eventBranchCache.clear()
    eventBranchCache.set(eventId, branchId)
  }
  return branchId
}

export type Permission = keyof PermissionFlags

export interface BranchAccess {
  branchId: string
  eventId: string | null
  role: BranchRole | null
  isGlobal: boolean
  permissions: PermissionFlags
}

// session.user.permissions solo refleja el rol en la PRIMERA sucursal del usuario,
// pero las rutas reciben branchId/eventId/ids desde el cliente. Estos helpers
// calculan los permisos en la sucursal que realmente se está tocando.

/**
 * Permisos del usuario en `branchId`. Si se pasa `eventId`, además exige que el
 * evento pertenezca a esa sucursal. Devuelve null si el usuario no tiene acceso.
 */
export async function getBranchAccess(
  session: Session | null,
  branchId: string | null | undefined,
  eventId?: string | null,
): Promise<BranchAccess | null> {
  const userId = session?.user?.id
  if (!userId || !branchId) return null

  if (eventId && (await getEventBranchId(eventId)) !== branchId) return null

  if (session.user.isSuperuser || session.user.isGlobalAdmin) {
    return { branchId, eventId: eventId ?? null, role: null, isGlobal: true, permissions: IdentityService.buildPermissionFlags(null, true) }
  }

  // Membresías y asignaciones activas ya cargadas (y cacheadas) por la sesión
  const user = await getCachedSessionUser(userId)
  if (!user?.isActive) return null
  const membership = user.branchMemberships.find((m: any) => m.branchId === branchId)
  // Staff asignado solo a eventos: su rol sale de la asignación (del evento pedido, si hay)
  const assignment = membership
    ? null
    : user.eventAssignments.find((a: any) => a.branchId === branchId && (!eventId || a.eventId === eventId))

  const role = membership?.role ?? assignment?.role
  if (!role) return null
  return { branchId, eventId: eventId ?? null, role, isGlobal: false, permissions: IdentityService.buildPermissionFlags(role, false) }
}

function denied(session: Session | null) {
  return session?.user?.id
    ? NextResponse.json({ error: "Sin permiso para esta sucursal o evento" }, { status: 403 })
    : NextResponse.json({ error: "No autorizado" }, { status: 401 })
}

/**
 * Exige `permission` en la sucursal (y evento, si se pasa). Devuelve el acceso o
 * una respuesta 401/403 lista para retornar:
 *   const access = await requireBranchPermission(session, branchId, "accessAttendees", eventId)
 *   if (access instanceof NextResponse) return access
 */
export async function requireBranchPermission(
  session: Session | null,
  branchId: string | null | undefined,
  permission: Permission | null,
  eventId?: string | null,
): Promise<BranchAccess | NextResponse> {
  const access = await getBranchAccess(session, branchId, eventId)
  if (!access || (permission && !access.permissions[permission])) return denied(session)
  return access
}

/** Igual que requireBranchPermission, resolviendo la sucursal a partir del evento. */
export async function requireEventPermission(
  session: Session | null,
  eventId: string | null | undefined,
  permission: Permission | null,
): Promise<BranchAccess | NextResponse> {
  if (!session?.user?.id || !eventId) return denied(session)
  const branchId = await getEventBranchId(eventId)
  if (!branchId) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  return requireBranchPermission(session, branchId, permission, eventId)
}

/** ¿Tiene `permission` en al menos una de sus sucursales/eventos? (para acciones sin sucursal) */
export async function hasPermissionAnywhere(session: Session | null, permission: Permission): Promise<boolean> {
  const userId = session?.user?.id
  if (!userId) return false
  if (session.user.isSuperuser || session.user.isGlobalAdmin) return true
  const user = await getCachedSessionUser(userId)
  if (!user?.isActive) return false
  return [...user.branchMemberships, ...user.eventAssignments].some((m: any) => IdentityService.buildPermissionFlags(m.role, false)[permission])
}
