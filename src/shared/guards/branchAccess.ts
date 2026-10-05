import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import type { BranchRole } from "@prisma/client"
import { prisma } from "@/infrastructure/database/prisma"
import { IdentityService } from "@/domains/identity/services/IdentityService"
import type { PermissionFlags } from "@/types/next-auth"

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

  if (eventId) {
    const event = await prisma.event.findFirst({ where: { id: eventId, branchId }, select: { id: true } })
    if (!event) return null
  }

  if (session.user.isSuperuser || session.user.isGlobalAdmin) {
    return { branchId, eventId: eventId ?? null, role: null, isGlobal: true, permissions: IdentityService.buildPermissionFlags(null, true) }
  }

  const membership = await prisma.branchMembership.findFirst({
    where: { userId, branchId, isActive: true },
    select: { role: true },
  })
  // Staff asignado solo a eventos: su rol sale de la asignación (del evento pedido, si hay)
  const assignment = membership
    ? null
    : await prisma.eventAssignment.findFirst({
        where: { userId, branchId, isActive: true, ...(eventId ? { eventId } : {}) },
        select: { role: true },
      })

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
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { branchId: true } })
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  return requireBranchPermission(session, event.branchId, permission, eventId)
}

/** ¿Tiene `permission` en al menos una de sus sucursales/eventos? (para acciones sin sucursal) */
export async function hasPermissionAnywhere(session: Session | null, permission: Permission): Promise<boolean> {
  const userId = session?.user?.id
  if (!userId) return false
  if (session.user.isSuperuser || session.user.isGlobalAdmin) return true
  const [memberships, assignments] = await Promise.all([
    prisma.branchMembership.findMany({ where: { userId, isActive: true }, select: { role: true } }),
    prisma.eventAssignment.findMany({ where: { userId, isActive: true }, select: { role: true } }),
  ])
  return [...memberships, ...assignments].some((m) => IdentityService.buildPermissionFlags(m.role, false)[permission])
}
