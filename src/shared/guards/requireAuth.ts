import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { PermissionFlags } from "@/types/next-auth"

export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    return { session: null, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
  }
  return { session, response: null }
}

export async function requirePermission(flag: keyof PermissionFlags) {
  const { session, response } = await requireAuth()
  if (response) return { session: null, response }
  if (!session!.user.permissions[flag]) {
    return { session: null, response: NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 }) }
  }
  return { session, response: null }
}
