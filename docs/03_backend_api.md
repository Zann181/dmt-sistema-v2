# DMT Sistema v2 — Backend API (Next.js Route Handlers)

## Principios

- Todos los endpoints viven en `src/app/api/`
- Validación de entrada con **Zod** antes de llegar a servicios de dominio
- Autenticación via `auth()` de Auth.js v5 — si no hay sesión → `401`
- Autorización via `PermissionFlags` del dominio Identity — si sin permiso → `403`
- Errores de dominio retornan `400` con `{ error: string, field?: string }`
- Rate limiting en endpoints de auth (10 req/min) y mutaciones críticas (30 req/min)
- Todos los endpoints usan HTTPS (forzado por Vercel en producción)

## Estructura de Respuestas

### Éxito
```json
{ "data": { ... } }
// o lista:
{ "data": [...], "total": 42, "page": 1 }
```

### Error
```json
{ "error": "Mensaje de error", "field": "nombre_campo_opcional" }
```

---

## Módulo: Auth (`/api/auth`)

Manejado por Auth.js v5 — no necesita handlers manuales salvo los siguientes:

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/signin` | Login (username + password) | Público |
| POST | `/api/auth/signout` | Logout | Autenticado |
| GET  | `/api/auth/session` | Sesión actual (user + role flags) | Autenticado |
| POST | `/api/auth/refresh` | Refresh token | Autenticado |

### `POST /api/auth/signin`
```typescript
// Body (Zod)
z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

// Response 200
{
  "data": {
    "user": { "id", "username", "firstName", "lastName", "isSuperuser" },
    "accessToken": "...",  // JWT, expira 15min
    "expiresAt": "2026-..."
  }
}
```

---

## Módulo: Branches (`/api/branches`)

| Método | Ruta | Descripción | Permiso requerido |
|--------|------|-------------|-------------------|
| GET    | `/api/branches` | Listar sucursales del usuario | Autenticado |
| POST   | `/api/branches` | Crear sucursal | `GLOBAL_ADMIN` |
| GET    | `/api/branches/[slug]` | Detalle de sucursal | `manageBranchConfig` |
| PATCH  | `/api/branches/[slug]` | Actualizar sucursal | `manageBranchConfig` |
| POST   | `/api/branches/[slug]/switch` | Cambiar sucursal activa (context) | `switchContext` |
| GET    | `/api/branches/[slug]/staff` | Listar staff | `manageBranchConfig` |
| POST   | `/api/branches/[slug]/staff` | Crear/actualizar usuario staff | `manageBranchConfig` o `manageEventsConfig` |
| PATCH  | `/api/branches/[slug]/staff/[userId]/toggle` | Activar/desactivar asignación | `manageBranchConfig` |
| DELETE | `/api/branches/[slug]/staff/[userId]` | Eliminar staff de sucursal | `manageBranchConfig` |
| PATCH  | `/api/branches/[slug]/staff/[userId]/events/[eventId]/toggle` | Toggle asignación a evento | `manageBranchConfig` |

### `POST /api/branches` — Body
```typescript
z.object({
  name: z.string().min(1).max(150),
  codePrefix: z.string().min(1).max(12),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  pageBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  surfaceColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  panelColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(30).optional(),
  logo: z.instanceof(File).optional(), // PNG, max 5MB
  isActive: z.boolean().default(true),
})
```

---

## Módulo: Events (`/api/events`)

| Método | Ruta | Descripción | Permiso |
|--------|------|-------------|---------|
| GET    | `/api/events` | Listar eventos de la sucursal activa | Autenticado |
| POST   | `/api/events` | Crear evento | `manageEventsConfig` |
| GET    | `/api/events/[id]` | Detalle evento | Autenticado |
| PATCH  | `/api/events/[id]` | Actualizar evento | `manageEventsConfig` |
| POST   | `/api/events/[id]/switch` | Cambiar evento activo | `switchContext` |
| POST   | `/api/events/qr-preview` | Preview PNG del QR con config actual | `manageEventsConfig` |

### `POST /api/events/qr-preview` — Body
```typescript
z.object({
  fillColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoScale: z.number().int().min(2).max(6),
  qrLogoUrl: z.string().url().optional(),
})

// Response: image/png (streaming)
```

---

## Módulo: Attendees (`/api/attendees`)

| Método | Ruta | Descripción | Permiso |
|--------|------|-------------|---------|
| GET    | `/api/attendees` | Listar asistentes (con filtros, paginado) | `accessAttendees` |
| POST   | `/api/attendees` | Registrar asistente (manual) | `accessAttendees` |
| DELETE | `/api/attendees/[id]` | Eliminar asistente | `accessAttendees` |
| POST   | `/api/attendees/check-in/preview` | Pre-visualizar check-in (busca por QR o CC) | `accessAttendees` |
| POST   | `/api/attendees/check-in` | Ejecutar check-in | `accessAttendees` |
| POST   | `/api/attendees/mark-checked-in` | Marcar como ingresado (sin QR scan) | `accessAttendees` |
| GET    | `/api/attendees/export/excel` | Exportar a Excel | `accessAttendees` |
| GET    | `/api/attendees/[qrCode]/qr.png` | Imagen QR del asistente | `accessAttendees` |
| GET    | `/api/attendees/[qrCode]/flyer` | Flyer del evento | `accessAttendees` |
| GET    | `/api/attendees/categories` | Listar categorías | `accessAttendees` |
| POST   | `/api/attendees/categories` | Crear categoría | `manageCategories` |
| PATCH  | `/api/attendees/categories/[id]` | Actualizar categoría | `manageCategories` |
| DELETE | `/api/attendees/categories/[id]` | Eliminar/desactivar categoría | `manageCategories` |
| POST   | `/api/attendees/event-day` | Registro día del evento (bulk) | `accessAttendees` |
| POST   | `/api/attendees/expenses` | Crear gasto (entrada) | `accessAttendees` |
| PATCH  | `/api/attendees/expenses/[id]` | Actualizar gasto | `accessAttendees` |
| DELETE | `/api/attendees/expenses/[id]` | Eliminar gasto | `accessAttendees` |
| POST   | `/api/attendees/cash-drop` | Vaciar caja (entrada) | `accessAttendees` |
| PATCH  | `/api/attendees/cash-drop/[id]` | Actualizar vaciado | `accessAttendees` |
| DELETE | `/api/attendees/cash-drop/[id]` | Eliminar vaciado | `accessAttendees` |

### Endpoints Públicos (sin auth)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/public/share/[qrCode]` | Datos de la tarjeta WhatsApp del asistente |
| GET | `/api/public/share/[qrCode]/card.png` | Imagen de tarjeta WhatsApp (generada on-demand) |

> **Seguridad:** Estos endpoints son públicos intencionalmente (para compartir por WhatsApp). Solo exponen nombre, evento y QR — nunca email, CC o teléfono. Rate limitado a 20 req/min por IP.

### `GET /api/attendees` — Query params
```typescript
z.object({
  page: z.coerce.number().default(1),
  pageSize: z.coerce.number().max(200).default(50),
  search: z.string().optional(),          // busca en name, cc, email
  categoryId: z.string().optional(),
  hasCheckedIn: z.coerce.boolean().optional(),
  origin: z.enum(['MANUAL', 'EVENT_DAY']).optional(),
})
```

### `POST /api/attendees` — Body
```typescript
z.object({
  name: z.string().min(1).max(120),
  cc: z.string().min(1).max(32),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  categoryId: z.string(),
  paidAmount: z.number().min(0),
  sendEmail: z.boolean().default(false),  // si true, envía email con QR
})
```

### `POST /api/attendees/check-in` — Body
```typescript
z.object({
  qrCodeOrCc: z.string().min(1),        // QR code o número de cédula
  eventId: z.string(),
})
```

---

## Módulo: Catalog (`/api/catalog`)

| Método | Ruta | Descripción | Permiso |
|--------|------|-------------|---------|
| GET    | `/api/catalog/products` | Listar productos | `accessCatalog` |
| POST   | `/api/catalog/products` | Crear producto | `accessCatalog` |
| PATCH  | `/api/catalog/products/[id]` | Actualizar producto | `accessCatalog` |
| DELETE | `/api/catalog/products/[id]` | Retirar producto | `accessCatalog` |

---

## Módulo: Sales — POS (`/api/sales`)

| Método | Ruta | Descripción | Permiso |
|--------|------|-------------|---------|
| GET    | `/api/sales/event-products` | Productos habilitados para el evento activo | `accessSales` |
| POST   | `/api/sales/event-products/config` | Sincronizar configuración de productos × evento | `manageEventsConfig` |
| POST   | `/api/sales` | Crear venta (multi-línea, multi-pago) | `accessSales` |
| GET    | `/api/sales` | Listar ventas | `accessSales` |
| DELETE | `/api/sales/[saleGroupId]` | Eliminar venta (todo el grupo) | `accessSales` |
| POST   | `/api/sales/products` | Crear producto (desde barra) | `manageEventsConfig` |
| PATCH  | `/api/sales/products/[id]` | Actualizar producto (desde barra) | `manageEventsConfig` |
| DELETE | `/api/sales/products/[id]` | Retirar producto (desde barra) | `manageEventsConfig` |
| POST   | `/api/sales/expenses` | Crear gasto (barra) | `accessSales` |
| PATCH  | `/api/sales/expenses/[id]` | Actualizar gasto | `accessSales` |
| DELETE | `/api/sales/expenses/[id]` | Eliminar gasto | `accessSales` |
| POST   | `/api/sales/cash-drop` | Vaciar caja (barra) | `accessSales` |
| PATCH  | `/api/sales/cash-drop/[id]` | Actualizar vaciado | `accessSales` |
| DELETE | `/api/sales/cash-drop/[id]` | Eliminar vaciado | `accessSales` |

### `POST /api/sales` — Body (carrito multi-línea)
```typescript
z.object({
  cart: z.array(z.object({
    eventProductId: z.string(),
    quantity: z.number().int().min(1),
  })).min(1),
  attendeeId: z.string().optional(),
  useIncludedBalance: z.boolean().default(false),
  payments: z.array(z.object({
    method: z.enum(['CASH', 'TRANSFER', 'QR', 'CARD']),
    amount: z.number().positive(),
    reference: z.string().optional(),
    // transferProof enviado como multipart si aplica
  })).min(1).max(4),
})
```

---

## Módulo: Realtime (`/api/realtime`)

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/api/realtime/check-in` | SSE stream — eventos de check-in del evento activo | `accessAttendees` |
| GET | `/api/realtime/sales` | SSE stream — ventas nuevas en vivo | `accessSales` |

Ver `docs/06_realtime_strategy.md` para implementación completa.

---

## Módulo: Dashboard (`/api/dashboard`)

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/api/dashboard/analytics` | Métricas combinadas (entrada + barra) | Autenticado |
| GET | `/api/dashboard/entrance-analytics` | Solo métricas de entrada | `accessAttendees` |
| GET | `/api/dashboard/bar-analytics` | Solo métricas de barra | `accessSales` |

### `GET /api/dashboard/analytics` — Response
```typescript
{
  "data": {
    "entrance": {
      "totalIncome": Decimal,
      "totalExpenses": Decimal,
      "cashDropTotal": Decimal,
      "netOperating": Decimal,
      "cashBalance": Decimal,
      "attendeeCount": number,
      "checkedInCount": number,
      "byPaymentMethod": { cash: Decimal, transfer: Decimal, qr: Decimal, card: Decimal },
    },
    "bar": {
      "totalIncome": Decimal,
      "totalExpenses": Decimal,
      "cashDropTotal": Decimal,
      "netOperating": Decimal,
      "cashBalance": Decimal,
      "salesCount": number,
      "byPaymentMethod": { ... },
      "topProducts": [{ name: string, quantity: number, total: Decimal }],
    },
    "combined": {
      "totalIncome": Decimal,
      "netOperating": Decimal,
      "cashBalance": Decimal,
    },
    "pieChart": {
      "entrance": SVGPieData,  // generado server-side para performance
      "bar": SVGPieData,
    }
  }
}
```

---

## Middleware de Seguridad

```typescript
// src/middleware.ts
export const config = {
  matcher: ['/api/:path*', '/(dashboard)/:path*'],
}

// Por orden de ejecución:
// 1. Rate limiter (Upstash Redis o in-memory para Vercel)
// 2. Auth.js session check
// 3. Branch context injection (branchId activo del JWT)
// 4. Permission flags derivados del rol efectivo
// 5. Route handler
```

## Headers de Seguridad (next.config.ts)

```typescript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",  // Next.js requiere esto
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: *.vercel-storage.com",
      "connect-src 'self' *.vercel-storage.com",
    ].join('; '),
  },
]
```
