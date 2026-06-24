# DMT Sistema v2 — Autenticación y Roles

## Stack

- **Auth.js v5** (formerly NextAuth) con Credentials Provider
- **Prisma Adapter** para persistencia de sesiones (optional — usaremos JWT puro)
- **JWT RS256** firmado con clave privada (más seguro que HS256)
- **HttpOnly + Secure + SameSite=Strict** cookies
- **Refresh Token Rotation** — refresh tokens de 7 días, access tokens de 15 min

---

## Configuración Auth.js

```typescript
// src/lib/auth.ts
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/infrastructure/database/prisma"
import { verifyPassword } from "@/infrastructure/crypto"
import { IdentityService } from "@/domains/identity/services"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize({ username, password }) {
        const user = await prisma.user.findUnique({
          where: { username: username as string },
          include: { branchMemberships: true, eventAssignments: true },
        })
        if (!user || !user.isActive) return null
        const valid = await verifyPassword(password as string, user.passwordHash)
        if (!valid) return null
        return {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isSuperuser: user.isSuperuser,
          isGlobalAdmin: user.isGlobalAdmin,
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Primer login — carga contexto inicial
        token.userId = user.id
        token.username = user.username
        token.isSuperuser = user.isSuperuser
        token.isGlobalAdmin = user.isGlobalAdmin
        // Sucursal activa inicial = primera sucursal del usuario
        const firstBranch = await prisma.branchMembership.findFirst({
          where: { userId: user.id, isActive: true },
          orderBy: { createdAt: "asc" },
        })
        token.activeBranchId = firstBranch?.branchId ?? null
        token.activeBranchRole = firstBranch?.role ?? null
        token.activeEventId = null
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.userId
      session.user.username = token.username
      session.user.isSuperuser = token.isSuperuser
      session.user.isGlobalAdmin = token.isGlobalAdmin
      session.user.activeBranchId = token.activeBranchId
      session.user.activeBranchRole = token.activeBranchRole
      session.user.activeEventId = token.activeEventId
      // Flags de permiso derivados (calculados fresh en cada request)
      session.user.permissions = IdentityService.buildPermissionFlags(
        token.activeBranchRole,
        token.isSuperuser || token.isGlobalAdmin,
      )
      return session
    },
  },
  cookies: {
    sessionToken: {
      name: "dmt-session",
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
```

---

## Contexto Activo (Branch + Event)

El sistema Django usaba `identity.middleware.CurrentBranchMiddleware` para inyectar la sucursal activa en cada request vía sesión. En Next.js lo manejamos en el JWT:

```typescript
// El JWT contiene:
interface JWTPayload {
  userId: string
  username: string
  isSuperuser: boolean
  isGlobalAdmin: boolean
  activeBranchId: string | null    // sucursal activa seleccionada
  activeBranchRole: BranchRole | null
  activeEventId: string | null     // evento activo seleccionado
}

// Para cambiar la sucursal activa:
// POST /api/branches/[slug]/switch → actualiza el JWT via update()
// Para cambiar el evento activo:
// POST /api/events/[id]/switch → actualiza el JWT
```

---

## Jerarquía de Roles

```
GLOBAL_ADMIN (isSuperuser || isGlobalAdmin)
  └── Ve TODAS las sucursales
  └── Tiene todos los permisos
  └── Puede crear/eliminar sucursales

BRANCH_ADMIN (role = 'BRANCH_ADMIN' en BranchMembership)
  └── Ve solo SU sucursal
  └── Puede configurar la sucursal
  └── Puede gestionar staff (asignar EVENT_ADMIN, ENTRANCE, BAR)
  └── NO puede asignar otro BRANCH_ADMIN

EVENT_ADMIN (role = 'EVENT_ADMIN' en EventAssignment)
  └── Ve solo SU sucursal + eventos asignados
  └── Puede configurar eventos
  └── Puede asignar ENTRANCE y BAR
  └── NO puede modificar config de sucursal

ENTRANCE (role = 'ENTRANCE' en EventAssignment)
  └── Solo módulo /entrada/
  └── Check-in, registro asistentes, gastos, cash-drop

BAR (role = 'BAR' en EventAssignment)
  └── Solo módulo /barra/
  └── POS ventas, gastos, cash-drop
```

---

## Matriz de Permisos

| Acción | GLOBAL_ADMIN | BRANCH_ADMIN | EVENT_ADMIN | ENTRANCE | BAR |
|--------|:---:|:---:|:---:|:---:|:---:|
| Crear/editar sucursal | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver sucursales | Todas | Solo propia | Solo propia | Solo propia | Solo propia |
| Crear/editar evento | ✅ | ✅ | ✅ | ❌ | ❌ |
| Gestionar staff | ✅ | ✅ | Parcial* | ❌ | ❌ |
| Ver/registrar asistentes | ✅ | ✅ | ✅ | ✅ | ❌ |
| Hacer check-in | ✅ | ✅ | ✅ | ✅ | ❌ |
| Gestionar categorías | ✅ | ✅ | ✅ | ❌ | ❌ |
| Exportar Excel | ✅ | ✅ | ✅ | ✅ | ❌ |
| Acceder POS (barra) | ✅ | ✅ | ✅ | ❌ | ✅ |
| Configurar productos evento | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver catálogo | ✅ | ✅ | ❌ | ❌ | ❌ |
| Crear/editar productos catálogo | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver dashboard analytics | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cambiar contexto (branch/event) | ✅ | ✅ | ✅ | ✅ | ✅ |

> *EVENT_ADMIN puede asignar ENTRANCE y BAR, pero NO BRANCH_ADMIN ni otro EVENT_ADMIN.

---

## Guard Functions

```typescript
// src/domains/identity/services/IdentityService.ts

export class IdentityService {
  static buildPermissionFlags(
    role: BranchRole | null,
    isGlobal: boolean,
  ): PermissionFlags {
    if (isGlobal) return ALL_PERMISSIONS_TRUE
    switch (role) {
      case BranchRole.BRANCH_ADMIN:
        return { manageBranchConfig: true, manageEventsConfig: true, manageCategories: true, accessAttendees: true, accessSales: true, accessCatalog: true, switchContext: true }
      case BranchRole.EVENT_ADMIN:
        return { manageBranchConfig: false, manageEventsConfig: true, manageCategories: true, accessAttendees: true, accessSales: true, accessCatalog: false, switchContext: true }
      case BranchRole.ENTRANCE:
        return { manageBranchConfig: false, manageEventsConfig: false, manageCategories: false, accessAttendees: true, accessSales: false, accessCatalog: false, switchContext: true }
      case BranchRole.BAR:
        return { manageBranchConfig: false, manageEventsConfig: false, manageCategories: false, accessAttendees: false, accessSales: true, accessCatalog: false, switchContext: true }
      default:
        return ALL_PERMISSIONS_FALSE
    }
  }

  // Uso en Route Handlers:
  // const session = await auth()
  // if (!session) return unauthorized()
  // if (!session.user.permissions.accessAttendees) return forbidden()
}
```

---

## Helper de Auth en Route Handlers

```typescript
// src/shared/guards/requireAuth.ts
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

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

// Uso en Route Handler:
export async function GET(req: Request) {
  const { session, response } = await requirePermission('accessAttendees')
  if (response) return response
  // session.user.activeBranchId garantizado aquí
  ...
}
```

---

## Seguridad de Contraseñas

```typescript
// src/infrastructure/crypto.ts
import { hash, compare } from "bcryptjs"

const BCRYPT_ROUNDS = 12  // ajustado para Vercel Edge (max ~100ms)

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash)
}
```

---

## Rate Limiting en Auth

```typescript
// src/middleware.ts — Rate limiting para /api/auth/signin
// Usa in-memory LRU para Vercel serverless (sin Redis externo):
import { LRUCache } from "lru-cache"

const loginAttempts = new LRUCache<string, number>({
  max: 500,
  ttl: 1000 * 60,  // 1 minuto TTL
})

// Máximo 10 intentos de login por IP por minuto
// Si excede → 429 Too Many Requests
```

---

## TypeScript Types para Session

```typescript
// src/types/next-auth.d.ts
import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      firstName: string
      lastName: string
      isSuperuser: boolean
      isGlobalAdmin: boolean
      activeBranchId: string | null
      activeBranchRole: BranchRole | null
      activeEventId: string | null
      permissions: PermissionFlags
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string
    username: string
    isSuperuser: boolean
    isGlobalAdmin: boolean
    activeBranchId: string | null
    activeBranchRole: BranchRole | null
    activeEventId: string | null
  }
}
```
