# DMT Sistema v2 — Arquitectura Frontend (Next.js App Router)

## Stack UI

| Herramienta | Versión | Uso |
|------------|---------|-----|
| Next.js | 15 | App Router, RSC, Streaming |
| React | 19 | Componentes UI |
| TypeScript | 5.x | Tipado estático |
| Tailwind CSS | 4 | Utilidades de estilo |
| shadcn/ui | latest | Componentes accesibles base |
| TanStack Query | 5 | Estado del servidor, cache, polling |
| Zustand | 4 | Estado local ligero (carrito POS, contexto) |
| React Hook Form | 7 | Formularios + validación Zod |
| next-safe-action | 7 | Server Actions type-safe |
| Framer Motion | 11 | Animaciones micro-interacciones |
| Lucide React | latest | Iconos |

---

## Estructura de Páginas (App Router)

```
src/app/
├── layout.tsx                    # Root layout — fuentes, providers globales
├── (auth)/
│   └── login/
│       └── page.tsx              # Página de login
├── (dashboard)/
│   ├── layout.tsx                # Layout con sidebar + header
│   ├── page.tsx                  # Dashboard → redirect a /sucursales o /entrada
│   ├── sucursales/
│   │   ├── page.tsx              # Lista de sucursales
│   │   ├── nueva/
│   │   │   └── page.tsx          # Crear sucursal
│   │   └── [slug]/
│   │       ├── page.tsx          # Detalle sucursal
│   │       ├── editar/
│   │       │   └── page.tsx      # Editar sucursal
│   │       └── staff/
│   │           └── page.tsx      # Gestión de staff
│   ├── eventos/
│   │   ├── page.tsx              # Lista de eventos
│   │   ├── nuevo/
│   │   │   └── page.tsx          # Crear evento
│   │   └── [id]/
│   │       ├── page.tsx          # Detalle evento
│   │       └── editar/
│   │           └── page.tsx      # Editar evento (incluye config QR + email template)
│   ├── entrada/
│   │   └── page.tsx              # Panel entrada (asistentes + check-in + caja)
│   ├── catalogo/
│   │   └── page.tsx              # Catálogo de productos
│   └── barra/
│       ├── page.tsx              # POS (punto de venta)
│       └── ventas/
│           └── page.tsx          # Historial de ventas
└── api/                          # Route Handlers (ver 03_backend_api.md)
```

---

## Layout del Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ HEADER                                                   │
│ [Logo DMT]  [Sucursal: DMT Popayán ▼] [Evento: Noche▼]  │
│                                [Usuario] [Cerrar sesión] │
├──────────┬──────────────────────────────────────────────┤
│ SIDEBAR  │ MAIN CONTENT                                  │
│          │                                               │
│ 🏠 Home  │                                               │
│ 🏢 Suc.  │  (contenido de la página activa)              │
│ 📅 Even. │                                               │
│ 🎟 Entr. │                                               │
│ 📦 Cat.  │                                               │
│ 🍺 Barra │                                               │
│          │                                               │
│ (rol-    │                                               │
│  filtrado│                                               │
│  por     │                                               │
│  permisos│                                               │
└──────────┴──────────────────────────────────────────────┘
```

El sidebar muestra solo las opciones a las que el usuario tiene acceso según su `PermissionFlags`.

---

## Componentes por Feature

### Feature: Entrada (Check-in)

```
src/components/features/attendees/
├── AttendeeTable.tsx             # Tabla paginada con filtros
├── AttendeeRow.tsx               # Fila individual
├── AttendeeCreateModal.tsx       # Modal de registro manual
├── CheckInPanel.tsx              # Panel principal de check-in (scanner QR / búsqueda)
├── CheckInPreviewCard.tsx        # Preview de asistente antes de confirmar
├── CheckInConfirmModal.tsx       # Confirmación de check-in
├── CheckInLiveCounter.tsx        # Contador en vivo + feed de últimos check-ins
├── CategoryModal.tsx             # CRUD categorías
├── ExpenseModal.tsx              # Modal de gastos
├── CashDropModal.tsx             # Modal de vaciado de caja
├── EventDayModal.tsx             # Modal registro día del evento (bulk)
├── AttendeeExportButton.tsx      # Botón exportar Excel
├── WhatsAppShareButton.tsx       # Botón compartir por WhatsApp
├── EntranceAnalyticsCard.tsx     # Tarjeta de métricas de entrada
└── useCheckInStream.ts           # Hook SSE (ver 06_realtime_strategy.md)
```

### Feature: Barra (POS)

```
src/components/features/sales/
├── PosGrid.tsx                   # Grid de productos habilitados
├── PosProductCard.tsx            # Tarjeta de producto (click = agrega al carrito)
├── PosCart.tsx                   # Carrito lateral
├── PosCartItem.tsx               # Item en carrito (qty + remove)
├── PosPaymentModal.tsx           # Modal de pago (split payments, hasta 4 métodos)
├── PosAttendeeSearch.tsx         # Búsqueda de asistente (para usar balance incluido)
├── SaleHistoryTable.tsx          # Historial de ventas
├── SaleDeleteButton.tsx          # Eliminar venta (con confirmación)
├── EventProductConfigModal.tsx   # Configurar precios por evento
├── BarExpenseModal.tsx           # Modal de gastos de barra
├── BarCashDropModal.tsx          # Modal de vaciado de caja
├── BarAnalyticsCard.tsx          # Tarjeta de métricas de barra
└── useBarSalesStore.ts           # Zustand store para el carrito POS
```

### Feature: Dashboard

```
src/components/features/dashboard/
├── DashboardOverview.tsx         # Vista general combinada
├── EntranceAnalyticsPanel.tsx    # Panel métricas entrada
├── BarAnalyticsPanel.tsx         # Panel métricas barra
├── PieChartSvg.tsx               # Gráfico SVG pie de distribución pagos
├── MetricCard.tsx                # Tarjeta de métrica individual
├── RealtimeIndicator.tsx         # Indicador de conexión en vivo
└── useDashboardAnalytics.ts      # Hook TanStack Query con refetch 30s
```

### Feature: Eventos

```
src/components/features/events/
├── EventList.tsx                 # Lista de eventos con status badge
├── EventCard.tsx                 # Tarjeta de evento
├── EventForm.tsx                 # Formulario crear/editar evento
├── EventQrConfig.tsx             # Sub-sección config QR
├── EventQrPreview.tsx            # Preview QR en tiempo real
├── EventEmailTemplateEditor.tsx  # Editor del template de email
├── EventEmailPreview.tsx         # Preview del email renderizado
└── EventStatusBadge.tsx          # Badge DRAFT / ACTIVE / ARCHIVED
```

### Feature: Sucursales

```
src/components/features/branches/
├── BranchList.tsx
├── BranchCard.tsx
├── BranchForm.tsx                # Incluye color pickers
├── BranchColorPicker.tsx         # input type=color estilizado
├── BranchLogoUpload.tsx          # Drag & drop con preview
├── StaffList.tsx                 # Tabla de personal
├── StaffForm.tsx                 # Agregar/editar personal
└── BranchSwitcher.tsx            # Dropdown en header para cambiar sucursal
```

---

## Estado Global (Zustand)

```typescript
// src/stores/contextStore.ts
// Persiste contexto activo para UX fluida

interface ContextStore {
  activeBranchId: string | null
  activeBranchName: string | null
  activeEventId: string | null
  activeEventName: string | null
  setActiveBranch: (id: string, name: string) => void
  setActiveEvent: (id: string, name: string) => void
}

// src/stores/cartStore.ts
// Carrito del POS — en memoria, resetea al cerrar sesión

interface CartStore {
  items: CartItem[]
  addItem: (eventProduct: EventProduct) => void
  removeItem: (eventProductId: string) => void
  updateQuantity: (eventProductId: string, qty: number) => void
  clear: () => void
  total: Decimal  // computed
  selectedAttendeeId: string | null
  useIncludedBalance: boolean
}
```

---

## Formularios (React Hook Form + Zod)

Patrón estándar para todos los formularios:

```typescript
// Ejemplo: AttendeeCreateForm
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"

const attendeeSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(120),
  cc: z.string().min(1, "Cédula requerida").max(32),
  phone: z.string().max(30).optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  categoryId: z.string({ required_error: "Categoría requerida" }),
  paidAmount: z.coerce.number().min(0),
  sendEmail: z.boolean().default(false),
})

type AttendeeFormData = z.infer<typeof attendeeSchema>

export function AttendeeCreateForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient()
  const form = useForm<AttendeeFormData>({ resolver: zodResolver(attendeeSchema) })

  const mutation = useMutation({
    mutationFn: async (data: AttendeeFormData) => {
      const res = await fetch("/api/attendees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendees"] })
      onSuccess()
    },
  })

  return (
    <form onSubmit={form.handleSubmit(d => mutation.mutate(d))}>
      {/* campos */}
    </form>
  )
}
```

---

## Diseño Visual

### Tokens de Diseño
```typescript
// Colores del sistema (dark mode primario)
--background:      #0f1117   // Panel principal
--surface:         #1a1d27   // Cards, modales
--surface-raised:  #22263a   // Hover states
--border:          #2e3347   // Bordes
--text-primary:    #f0f2ff   // Texto principal
--text-muted:      #8892b0   // Texto secundario
--accent-primary:  #6366f1   // Indigo — acciones principales
--accent-success:  #22c55e   // Verde — check-in exitoso
--accent-danger:   #ef4444   // Rojo — errores, eliminar
--accent-warning:  #f59e0b   // Amarillo — advertencias
```

### Fuente
```typescript
// Google Fonts — Inter (UI) + JetBrains Mono (códigos QR, cantidades)
import { Inter, JetBrains_Mono } from "next/font/google"
```

### Animaciones Micro-interacciones
- **Check-in exitoso:** Flash verde + slide-in del nombre del asistente
- **Nueva venta:** Item aparece en historial con fade-in
- **Error en QR:** Shake horizontal del campo
- **Carga de datos:** Skeleton loaders (no spinners)
- **Modal:** Scale-in + blur backdrop
- **Sidebar:** Collapse/expand con slide animado

---

## Responsive Design

| Breakpoint | Layout |
|------------|--------|
| `< 768px` (mobile) | Sidebar colapsado → bottom nav, tablas → cards |
| `768–1024px` (tablet) | Sidebar iconos only, tablas comprimidas |
| `> 1024px` (desktop) | Layout completo con sidebar expandido |

### POS en Mobile
El POS de barra está optimizado para tablets (uso típico en eventos):
- Grid 2 columnas en mobile, 3 en tablet, 4 en desktop
- Carrito como drawer inferior en mobile
- Botones de pago XXL para touch rápido

---

## Providers (Layout Root)

```typescript
// src/app/layout.tsx
import { SessionProvider } from "next-auth/react"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <SessionProvider>
          <QueryClientProvider client={queryClient}>
            {children}
            <Toaster richColors position="top-right" />
          </QueryClientProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
```
