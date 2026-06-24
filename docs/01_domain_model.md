# DMT Sistema v2 — Modelo de Dominio (DDD)

## Bounded Contexts

El sistema se divide en 7 contextos acotados (Bounded Contexts), cada uno con su propio lenguaje ubicuo (Ubiquitous Language) y responsabilidades claras.

---

## 1. Identity Context

**Responsabilidad:** Autenticación, autorización y gestión de membresías de usuarios.

### Agregados

#### `User` (Aggregate Root)
```typescript
interface User {
  id: string                    // UUID
  username: string              // único, inmutable post-creación
  email: string
  firstName: string
  lastName: string
  passwordHash: string          // bcrypt, nunca expuesto
  isActive: boolean
  isSuperuser: boolean          // acceso global sin restricciones
  createdAt: Date
  updatedAt: Date

  // Relations (cargadas según contexto)
  branchMemberships: BranchMembership[]
  eventAssignments: EventAssignment[]
}
```

#### `BranchMembership` (Entity)
```typescript
interface BranchMembership {
  id: string
  userId: string
  branchId: string
  role: BranchRole             // BRANCH_ADMIN | EVENT_ADMIN | ENTRANCE | BAR
  isActive: boolean
  createdAt: Date
}
```

#### `EventAssignment` (Entity)
```typescript
interface EventAssignment {
  id: string
  userId: string
  branchId: string
  eventId: string
  role: BranchRole
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

### Value Objects

#### `BranchRole`
```typescript
enum BranchRole {
  BRANCH_ADMIN  = 'branch_admin',   // Antes: sucursal
  EVENT_ADMIN   = 'event_admin',    // Antes: evento
  ENTRANCE      = 'entrance',       // Antes: entrada
  BAR           = 'bar',            // Antes: barra
}

// Global Admin es is_superuser=true o grupo "Administrador Global"
```

#### `PermissionFlags`
```typescript
interface PermissionFlags {
  manageBranchConfig: boolean    // Solo BRANCH_ADMIN / Global
  manageEventsConfig: boolean    // BRANCH_ADMIN, EVENT_ADMIN
  manageCategories: boolean      // BRANCH_ADMIN, EVENT_ADMIN
  accessAttendees: boolean       // ENTRANCE y superiores
  accessSales: boolean           // BAR y superiores
  accessCatalog: boolean         // BRANCH_ADMIN
  switchContext: boolean         // Cambiar sucursal/evento activo
}
```

### Servicios de Dominio
- `IdentityService.buildPermissionFlags(role, isGlobal)` → `PermissionFlags`
- `IdentityService.getEffectiveRole(user, branch, event?)` → `BranchRole | 'global' | null`
- `IdentityService.ensureBranchMembership(userId, branchId, role)` → upsert
- `IdentityService.getRoleHierarchyLevel(role)` → number (para comparaciones)

---

## 2. Branch Context

**Responsabilidad:** Gestión de sucursales (venues) y su configuración visual.

### Agregados

#### `Branch` (Aggregate Root)
```typescript
interface Branch {
  id: string
  name: string
  slug: string                    // único global, auto-generado de name
  codePrefix: string              // max 12 chars, ej: "DMT" — para QR codes
  branding: BranchBranding        // Value Object
  contact: BranchContact          // Value Object
  logoUrl: string | null          // URL en Vercel Blob
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

### Value Objects

#### `BranchBranding`
```typescript
interface BranchBranding {
  primaryColor: HexColor           // #102542
  secondaryColor: HexColor
  pageBackgroundColor: HexColor
  surfaceColor: HexColor
  panelColor: HexColor
}
```

#### `BranchContact`
```typescript
interface BranchContact {
  email: string | null
  phone: string | null
}
```

#### `HexColor`
```typescript
// Value Object — inmutable, validado formato #RRGGBB
type HexColor = string & { readonly brand: 'HexColor' }
function HexColor(value: string): HexColor  // lanza DomainError si inválido
```

### Servicios de Dominio
- `BranchService.getPrincipalBranch()` → primera Branch por `createdAt`
- `BranchService.generateSlug(name, existingSlugs)` → slug único
- `BranchService.getUserBranches(user)` → Branch[] (filtrado por membresía o global)

---

## 3. Event Context

**Responsabilidad:** Configuración de eventos, branding de email y configuración de QR.

### Agregados

#### `Event` (Aggregate Root)
```typescript
interface Event {
  id: string
  branchId: string
  name: string
  slug: string
  description: string
  startsAt: Date
  endsAt: Date
  status: EventStatus
  qrConfig: QrConfig              // Value Object
  emailTemplate: EmailTemplate    // Value Object — 25+ campos
  venueConfig: VenueConfig        // Value Object
  logoUrl: string | null
  qrLogoUrl: string | null
  flyerUrl: string | null
  createdAt: Date
  updatedAt: Date
}
```

### Value Objects

#### `EventStatus`
```typescript
enum EventStatus {
  DRAFT    = 'draft',
  ACTIVE   = 'active',
  ARCHIVED = 'archived',
}
```

#### `QrConfig`
```typescript
interface QrConfig {
  prefix: string                  // max 20, ej: "NOCHE"
  fillColor: HexColor
  backgroundColor: HexColor
  logoBackgroundColor: HexColor
  logoScale: number               // 2–6, default 4
}
```

#### `EmailTemplate`
```typescript
interface EmailTemplate {
  subject: string
  preheader: string
  heading: string
  intro: string
  messageTitle: string
  body: string                    // con variables {nombre_asistente} etc.
  warningTitle: string
  warningText: string
  detailsTitle: string
  dateText: string
  timeText: string
  qrTitle: string
  qrNote: string
  footer: string
  closingText: string
  teamSignature: string
  legalNote: string
  // Colors
  backgroundColor: HexColor
  cardColor: HexColor
  headerBackgroundColor: HexColor
  textColor: HexColor
  mutedTextColor: HexColor
  accentColor: HexColor
  borderColor: HexColor
  sectionBackgroundColor: HexColor
  warningBackgroundColor: HexColor
  // Template variables disponibles:
  // {nombre_asistente} {nombre_evento} {nombre_sucursal}
  // {fecha_evento} {hora_evento} {nombre_categoria}
  // {cedula_asistente} {precio_categoria} {codigo_qr}
}
```

#### `VenueConfig`
```typescript
interface VenueConfig {
  name: string
  mapsUrl: string | null
  mapsLabel: string
  dressCode: string
  accessPolicy: string
}
```

### Servicios de Dominio
- `EventService.validateDateRange(startsAt, endsAt)` — endsAt >= startsAt
- `EventService.generateUniqueSlug(name, branchId, existingSlugs)`
- `EventService.renderEmailTemplate(template, vars)` — SafeFormatDict: vars desconocidas se mantienen literal

---

## 4. Attendee Context

**Responsabilidad:** Registro de asistentes, categorías de acceso, check-in y compartir via WhatsApp.

### Agregados

#### `AttendeeCategory` (Aggregate Root)
```typescript
interface AttendeeCategory {
  id: string
  branchId: string
  name: string
  includedConsumptions: number    // balance de consumos incluidos
  price: Decimal
  description: string
  isActive: boolean
}
```

#### `Attendee` (Aggregate Root)
```typescript
interface Attendee {
  id: string
  branchId: string
  eventId: string
  categoryId: string
  createdById: string | null
  checkedInById: string | null

  name: string
  cc: string                      // cédula, unique per event
  phone: string | null
  email: string | null
  origin: AttendeeOrigin

  paidAmount: Decimal
  qrCode: string                  // formato: {branchPrefix}-{eventPrefix}-{uuid10}
  qrImageUrl: string | null       // URL Vercel Blob

  hasCheckedIn: boolean
  checkedInAt: Date | null
  includedBalance: number         // copiado de category.includedConsumptions al crear

  createdAt: Date
}
```

### Value Objects

#### `AttendeeOrigin`
```typescript
enum AttendeeOrigin {
  MANUAL     = 'manual',      // registrado manualmente por staff
  EVENT_DAY  = 'event_day',   // registro en puerta (día del evento)
}
```

#### `QrCode`
```typescript
// Value Object — inmutable
interface QrCode {
  value: string                   // "DMT-NOCHE-a1b2c3d4e5"
  branchPrefix: string
  eventPrefix: string
  uniquePart: string              // 10 chars random
}
function generateQrCode(branchPrefix: string, eventPrefix: string): QrCode
```

### Servicios de Dominio
- `AttendeeService.checkIn(qrCodeOrCc, eventId, userId)` — idempotente
- `AttendeeService.findByQrOrCc(value, branchId)` → Attendee | null
- `AttendeeService.deleteCategory(categoryId)` → 'deleted' | 'deactivated' | 'blocked'
- `AttendeeService.generateQrImage(attendee, event, branch)` → Buffer PNG
- `AttendeeService.exportToExcel(eventId)` → Buffer xlsx
- `AttendeeService.buildWhatsAppShareCard(qrCode)` → Buffer PNG (público, sin auth)

---

## 5. Catalog Context

**Responsabilidad:** Catálogo de productos base de la sucursal.

### Agregados

#### `Product` (Aggregate Root)
```typescript
interface Product {
  id: string
  branchId: string
  createdById: string | null
  name: string
  description: string
  imageUrl: string | null
  price: Decimal
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

### Servicios de Dominio
- `CatalogService.retireProduct(productId)` — si tiene ventas: soft-retire (isActive=false + desactivar EventProducts); si no: hard-delete
- `CatalogService.getBranchProducts(branchId)` → Product[]

---

## 6. Sales Context

**Responsabilidad:** POS (punto de venta), ventas multi-línea, pagos split, caja (gastos, vaciados), registro día del evento.

### Agregados

#### `EventProduct` (Entity — configuración de producto por evento)
```typescript
interface EventProduct {
  id: string
  branchId: string
  eventId: string
  productId: string
  updatedById: string | null
  isEnabled: boolean
  eventPrice: Decimal | null      // null = usa precio base del catálogo
  updatedAt: Date
}
```

#### `BarSale` (Aggregate Root)
```typescript
interface BarSale {
  id: string
  branchId: string
  eventId: string
  attendeeId: string | null       // null si venta sin asistente
  productId: string
  soldById: string
  saleGroup: string               // UUID — agrupa líneas del mismo ticket
  quantity: number
  unitPrice: Decimal
  total: Decimal
  usedIncludedConsumption: boolean
  createdAt: Date

  payments: BarSalePayment[]
}
```

#### `BarSalePayment` (Entity)
```typescript
interface BarSalePayment {
  id: string
  saleId: string
  method: PaymentMethod
  amount: Decimal
  reference: string | null
  transferProofUrl: string | null
}
```

#### `CashMovement` (Aggregate Root — gastos y vaciados de caja)
```typescript
interface CashMovement {
  id: string
  branchId: string
  eventId: string
  createdById: string | null
  createdRole: BranchRole | 'admin'
  module: CashModule              // ENTRANCE | BAR
  movementType: MovementType      // EVENT_DAY | EXPENSE | CASH_DROP
  description: string
  attendeeQuantity: number
  unitAmount: Decimal
  totalAmount: Decimal
  createdAt: Date

  payments: CashMovementPayment[]
}
```

#### `CashMovementPayment` (Entity)
```typescript
interface CashMovementPayment {
  id: string
  movementId: string
  method: PaymentMethod
  amount: Decimal
  reference: string | null
  transferProofUrl: string | null
}
```

### Value Objects

#### `PaymentMethod`
```typescript
enum PaymentMethod {
  CASH         = 'efectivo',
  TRANSFER     = 'transferencia',
  QR           = 'qr',
  CARD         = 'tarjeta',
}
```

#### `CashModule`
```typescript
enum CashModule {
  ENTRANCE = 'entrada',
  BAR      = 'barra',
}
```

#### `MovementType`
```typescript
enum MovementType {
  EVENT_DAY = 'evento_dia',
  EXPENSE   = 'gasto',
  CASH_DROP = 'vaciar_caja',
}
```

#### `Money`
```typescript
// Value Object — evita errores de punto flotante
interface Money {
  amount: Decimal
  currency: 'COP'                 // siempre pesos colombianos
}
function Money(amount: number | string): Money
function Money.add(a: Money, b: Money): Money
function Money.equals(a: Money, b: Money): boolean
```

### Servicios de Dominio
- `SalesService.ensureEventProductDefaults(branchId, eventId)` — crea stubs desactivados para todos los productos activos × evento
- `SalesService.processSale(cart, payments, attendee?, soldBy)` — transacción atómica multi-línea
- `SalesService.processCart(items)` → `{ total, lines }` validado
- `SalesService.allocatePayments(payments, total)` — distribuye pagos proporcionalmente entre líneas
- `SalesService.deleteSale(saleGroupId)` — elimina todas las líneas del grupo
- `SalesService.resolveSplitPayments(rawPayments, total)` — valida suma == total, manejo de cambio en efectivo
- `SalesService.registerEventDayEntry(categoryId, qty, unitAmount, payments, createdBy)` — crea CashMovement + Attendees sintéticos bulk. Atómico
- `SalesService.createCashMovement(data, payments)` — valida suma pagos == total
- `SalesService.updateCashMovement(movementId, data, payments?)` — reemplaza pagos si se proveen
- `SalesService.syncEventProducts(eventId, rows)` — upsert configuración productos × evento

---

## 7. Inventory Context

**Responsabilidad:** Auditoría histórica de movimientos de stock.

### Agregados

#### `StockMovement` (Aggregate Root)
```typescript
interface StockMovement {
  id: string
  branchId: string
  eventId: string | null
  productId: string
  createdById: string
  movementType: StockMovementType
  quantity: number               // positivo o negativo
  stockBefore: number
  stockAfter: number
  note: string
  createdAt: Date
}
```

### Value Objects

#### `StockMovementType`
```typescript
enum StockMovementType {
  ENTRY    = 'entrada',
  EXIT     = 'salida',
  ADJUST   = 'ajuste',
  SALE     = 'venta',
}
```

---

## Relaciones entre Contextos (Context Map)

```
Identity ──owns──▶ BranchMembership, EventAssignment
Branch   ──owns──▶ Event, Product, Attendee, CashMovement, BarSale
Event    ──owns──▶ Attendee, EventProduct, BarSale, CashMovement, StockMovement
Attendee ──ref──▶  AttendeeCategory (via categoryId)
Sales    ──ref──▶  Product (via EventProduct), Attendee (optional in BarSale)
Inventory──ref──▶  Product, Event, Branch
```

### Anti-corruption Layers (ACL)
- `Sales` no conoce detalles de `Attendee`: solo usa `{ id, hasCheckedIn, includedBalance }`
- `Event` no importa nada de `Sales`: es productor de configuración, no de transacciones
- `Identity` no toca datos de negocio: solo produce `PermissionFlags` y `BranchRole`
