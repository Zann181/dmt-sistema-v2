# DMT Sistema v2 — Esquema de Base de Datos

## Motor: PostgreSQL (Neon) via Prisma 6

### Variables de entorno requeridas
```env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
```

---

## Prisma Schema Completo

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_DIRECT_URL") // Neon necesita esto para migraciones
}

// ═══════════════════════════════════════════
// IDENTITY CONTEXT
// ═══════════════════════════════════════════

model User {
  id           String   @id @default(cuid())
  username     String   @unique
  email        String   @unique
  firstName    String   @default("")
  lastName     String   @default("")
  passwordHash String
  isActive     Boolean  @default(true)
  isSuperuser  Boolean  @default(false)
  isGlobalAdmin Boolean @default(false)   // equivale al grupo "Administrador Global"
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  branchMemberships BranchMembership[]
  eventAssignments  EventAssignment[]
  createdAttendees  Attendee[]         @relation("CreatedAttendees")
  checkedInAttendees Attendee[]        @relation("CheckedInAttendees")
  createdProducts   Product[]
  eventProductUpdates EventProduct[]
  barSales          BarSale[]
  cashMovements     CashMovement[]
  stockMovements    StockMovement[]

  @@map("users")
}

model BranchMembership {
  id        String      @id @default(cuid())
  userId    String
  branchId  String
  role      BranchRole
  isActive  Boolean     @default(true)
  createdAt DateTime    @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  branch Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([userId, branchId])
  @@map("branch_memberships")
}

model EventAssignment {
  id        String     @id @default(cuid())
  userId    String
  branchId  String
  eventId   String
  role      BranchRole
  isActive  Boolean    @default(true)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  branch Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)
  event  Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([userId, eventId])
  @@map("event_assignments")
}

// ═══════════════════════════════════════════
// BRANCH CONTEXT
// ═══════════════════════════════════════════

model Branch {
  id                  String   @id @default(cuid())
  name                String
  slug                String   @unique
  codePrefix          String   @default("DMT") @db.VarChar(12)
  primaryColor        String   @default("#102542") @db.VarChar(7)
  secondaryColor      String   @default("#ffffff") @db.VarChar(7)
  pageBackgroundColor String   @default("#f8f9fa") @db.VarChar(7)
  surfaceColor        String   @default("#ffffff") @db.VarChar(7)
  panelColor          String   @default("#f0f0f0") @db.VarChar(7)
  contactEmail        String?
  contactPhone        String?  @db.VarChar(30)
  logoUrl             String?  // Vercel Blob URL
  isActive            Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  events           Event[]
  memberships      BranchMembership[]
  eventAssignments EventAssignment[]
  categories       AttendeeCategory[]
  products         Product[]
  eventProducts    EventProduct[]
  barSales         BarSale[]
  cashMovements    CashMovement[]
  stockMovements   StockMovement[]
  attendees        Attendee[]

  @@map("branches")
}

// ═══════════════════════════════════════════
// EVENT CONTEXT
// ═══════════════════════════════════════════

model Event {
  id          String      @id @default(cuid())
  branchId    String
  name        String      @db.VarChar(150)
  slug        String      @db.VarChar(160)
  description String      @default("")
  startsAt    DateTime
  endsAt      DateTime
  status      EventStatus @default(DRAFT)

  // QR Config
  qrPrefix              String @default("EVT") @db.VarChar(20)
  qrFillColor           String @default("#102542") @db.VarChar(7)
  qrBackgroundColor     String @default("#f8f9fa") @db.VarChar(7)
  qrLogoBackgroundColor String @default("#ffffff") @db.VarChar(7)
  qrLogoScale           Int    @default(4)

  // Media
  logoUrl   String?
  qrLogoUrl String?
  flyerUrl  String?

  // Venue
  accessPolicy String @default("")
  venueName    String @default("") @db.VarChar(220)
  mapsUrl      String?
  mapsLabel    String @default("Abrir en Google Maps") @db.VarChar(120)
  dressCode    String @default("") @db.VarChar(160)

  // Email Template
  emailSubject             String @default("Tu acceso esta listo: {nombre_evento}") @db.VarChar(180)
  emailPreheader           String @default("") @db.VarChar(220)
  emailHeading             String @default("Hola {nombre_asistente}") @db.VarChar(180)
  emailIntro               String @default("")
  emailMessageTitle        String @default("Mensaje del evento") @db.VarChar(140)
  emailBody                String @default("")
  emailWarningTitle        String @default("Importante") @db.VarChar(140)
  emailWarningText         String @default("")
  emailDetailsTitle        String @default("Detalles") @db.VarChar(140)
  emailDateText            String @default("{fecha_evento}") @db.VarChar(180)
  emailTimeText            String @default("{hora_evento}") @db.VarChar(120)
  emailQrTitle             String @default("Tu codigo QR") @db.VarChar(180)
  emailQrNote              String @default("Presentalo en la entrada.") @db.VarChar(220)
  emailFooter              String @default("") @db.VarChar(220)
  emailClosingText         String @default("Nos vemos pronto.") @db.VarChar(220)
  emailTeamSignature       String @default("Equipo {nombre_evento}") @db.VarChar(220)
  emailLegalNote           String @default("") @db.VarChar(220)
  // Email Colors
  emailBackgroundColor        String @default("#f6f2eb") @db.VarChar(7)
  emailCardColor              String @default("#ffffff") @db.VarChar(7)
  emailHeaderBackgroundColor  String @default("#111315") @db.VarChar(7)
  emailTextColor              String @default("#172121") @db.VarChar(7)
  emailMutedTextColor         String @default("#bdbdbd") @db.VarChar(7)
  emailAccentColor            String @default("#c44536") @db.VarChar(7)
  emailBorderColor            String @default("#1f1f22") @db.VarChar(7)
  emailSectionBackgroundColor String @default("#18191b") @db.VarChar(7)
  emailWarningBackgroundColor String @default("#2a1c17") @db.VarChar(7)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  branch          Branch            @relation(fields: [branchId], references: [id], onDelete: Cascade)
  attendees       Attendee[]
  eventProducts   EventProduct[]
  barSales        BarSale[]
  cashMovements   CashMovement[]
  stockMovements  StockMovement[]
  staffAssignments EventAssignment[]

  @@unique([branchId, slug])
  @@map("events")
}

// ═══════════════════════════════════════════
// ATTENDEE CONTEXT
// ═══════════════════════════════════════════

model AttendeeCategory {
  id                   String  @id @default(cuid())
  branchId             String
  name                 String  @db.VarChar(80)
  includedConsumptions Int     @default(0)
  price                Decimal @db.Decimal(10, 2)
  description          String  @default("")
  isActive             Boolean @default(true)

  branch    Branch     @relation(fields: [branchId], references: [id], onDelete: Cascade)
  attendees Attendee[]

  @@unique([branchId, name])
  @@map("attendee_categories")
}

model Attendee {
  id            String          @id @default(cuid())
  branchId      String
  eventId       String
  categoryId    String
  createdById   String?
  checkedInById String?

  name     String          @db.VarChar(120)
  cc       String          @db.VarChar(32)
  phone    String?         @db.VarChar(30)
  email    String?
  origin   AttendeeOrigin  @default(MANUAL)

  paidAmount       Decimal  @db.Decimal(10, 2)
  qrCode           String   @unique @db.VarChar(120)
  qrImageUrl       String?
  hasCheckedIn     Boolean  @default(false)
  checkedInAt      DateTime?
  includedBalance  Int      @default(0)

  createdAt DateTime @default(now())

  branch      Branch           @relation(fields: [branchId], references: [id], onDelete: Cascade)
  event       Event            @relation(fields: [eventId], references: [id], onDelete: Cascade)
  category    AttendeeCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  createdBy   User?            @relation("CreatedAttendees", fields: [createdById], references: [id], onDelete: SetNull)
  checkedInBy User?            @relation("CheckedInAttendees", fields: [checkedInById], references: [id], onDelete: SetNull)
  barSales    BarSale[]

  @@unique([eventId, cc])
  @@index([branchId])
  @@index([cc])
  @@map("attendees")
}

// ═══════════════════════════════════════════
// CATALOG CONTEXT
// ═══════════════════════════════════════════

model Product {
  id          String   @id @default(cuid())
  branchId    String
  createdById String?
  name        String   @db.VarChar(120)
  description String   @default("")
  imageUrl    String?
  price       Decimal  @db.Decimal(10, 2)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  branch        Branch         @relation(fields: [branchId], references: [id], onDelete: Cascade)
  createdBy     User?          @relation(fields: [createdById], references: [id], onDelete: SetNull)
  eventProducts EventProduct[]
  barSales      BarSale[]
  stockMovements StockMovement[]

  @@map("products")
}

// ═══════════════════════════════════════════
// SALES CONTEXT
// ═══════════════════════════════════════════

model EventProduct {
  id          String   @id @default(cuid())
  branchId    String
  eventId     String
  productId   String
  updatedById String?
  isEnabled   Boolean  @default(false)
  eventPrice  Decimal? @db.Decimal(10, 2)
  updatedAt   DateTime @updatedAt

  branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  updatedBy User?    @relation(fields: [updatedById], references: [id], onDelete: SetNull)

  @@unique([eventId, productId])
  @@map("event_products")
}

model BarSale {
  id                      String  @id @default(cuid())
  branchId                String
  eventId                 String
  attendeeId              String?
  productId               String
  soldById                String
  saleGroup               String  @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  quantity                Int
  unitPrice               Decimal @db.Decimal(10, 2)
  total                   Decimal @db.Decimal(10, 2)
  usedIncludedConsumption Boolean @default(false)
  createdAt               DateTime @default(now())

  branch   Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  event    Event     @relation(fields: [eventId], references: [id], onDelete: Cascade)
  attendee Attendee? @relation(fields: [attendeeId], references: [id], onDelete: SetNull)
  product  Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  soldBy   User      @relation(fields: [soldById], references: [id], onDelete: Cascade)
  payments BarSalePayment[]

  @@index([saleGroup])
  @@index([branchId, eventId])
  @@map("bar_sales")
}

model BarSalePayment {
  id               String        @id @default(cuid())
  saleId           String
  method           PaymentMethod
  amount           Decimal       @db.Decimal(10, 2)
  reference        String?       @db.VarChar(120)
  transferProofUrl String?

  sale BarSale @relation(fields: [saleId], references: [id], onDelete: Cascade)

  @@map("bar_sale_payments")
}

model CashMovement {
  id                String        @id @default(cuid())
  branchId          String
  eventId           String
  createdById       String?
  createdRole       String        @db.VarChar(20)  // BranchRole | 'admin'
  module            CashModule
  movementType      MovementType
  description       String        @default("") @db.VarChar(255)
  attendeeQuantity  Int           @default(0)
  unitAmount        Decimal       @db.Decimal(10, 2)
  totalAmount       Decimal       @db.Decimal(10, 2)
  createdAt         DateTime      @default(now())

  branch    Branch  @relation(fields: [branchId], references: [id], onDelete: Cascade)
  event     Event   @relation(fields: [eventId], references: [id], onDelete: Cascade)
  createdBy User?   @relation(fields: [createdById], references: [id], onDelete: SetNull)
  payments  CashMovementPayment[]

  @@index([branchId, eventId])
  @@map("cash_movements")
}

model CashMovementPayment {
  id               String        @id @default(cuid())
  movementId       String
  method           PaymentMethod
  amount           Decimal       @db.Decimal(10, 2)
  reference        String?       @db.VarChar(120)
  transferProofUrl String?

  movement CashMovement @relation(fields: [movementId], references: [id], onDelete: Cascade)

  @@map("cash_movement_payments")
}

// ═══════════════════════════════════════════
// INVENTORY CONTEXT
// ═══════════════════════════════════════════

model StockMovement {
  id           String            @id @default(cuid())
  branchId     String
  eventId      String?
  productId    String
  createdById  String
  movementType StockMovementType
  quantity     Int
  stockBefore  Int
  stockAfter   Int
  note         String            @default("") @db.VarChar(255)
  createdAt    DateTime          @default(now())

  branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  event     Event?   @relation(fields: [eventId], references: [id], onDelete: SetNull)
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdBy User     @relation(fields: [createdById], references: [id], onDelete: Cascade)

  @@map("stock_movements")
}

// ═══════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════

enum BranchRole {
  BRANCH_ADMIN // sucursal
  EVENT_ADMIN  // evento
  ENTRANCE     // entrada
  BAR          // barra
}

enum EventStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum AttendeeOrigin {
  MANUAL
  EVENT_DAY
}

enum PaymentMethod {
  CASH         // efectivo
  TRANSFER     // transferencia
  QR           // pago QR
  CARD         // tarjeta
}

enum CashModule {
  ENTRANCE // entrada
  BAR      // barra
}

enum MovementType {
  EVENT_DAY  // evento_dia
  EXPENSE    // gasto
  CASH_DROP  // vaciar_caja
}

enum StockMovementType {
  ENTRY   // entrada
  EXIT    // salida
  ADJUST  // ajuste
  SALE    // venta
}
```

---

## Índices adicionales recomendados

```sql
-- Para búsquedas de check-in por QR o cédula (hot path)
CREATE INDEX idx_attendees_qr_code ON attendees(qr_code);
CREATE INDEX idx_attendees_cc ON attendees(cc);
CREATE INDEX idx_attendees_event_cc ON attendees(event_id, cc);

-- Para el dashboard de analytics
CREATE INDEX idx_bar_sales_event_created ON bar_sales(event_id, created_at DESC);
CREATE INDEX idx_cash_movements_event_module ON cash_movements(event_id, module, movement_type);

-- Para listados de ventas
CREATE INDEX idx_bar_sales_sale_group ON bar_sales(sale_group);
```

---

## Notas de Migración (MySQL → PostgreSQL)

| MySQL | PostgreSQL / Prisma |
|-------|-------------------|
| `AUTO_INCREMENT` | `@default(cuid())` o `@default(autoincrement())` |
| `TINYINT(1)` | `Boolean` |
| `DECIMAL(10,2)` | `Decimal @db.Decimal(10,2)` |
| `VARCHAR(n)` | `String @db.VarChar(n)` |
| `DATETIME` | `DateTime` |
| `uuid()` | `@default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| GenericFK (ContentType) | Removido — MediaAsset reemplazado por URLs directas (Vercel Blob) |
| `IMAGE` fields | String (URL to Blob) |

> **Nota:** El modelo `MediaAsset` del sistema Django (con GenericFK vía ContentType) **no tiene equivalente directo en Prisma**. Se elimina — todas las imágenes se almacenan como URLs en campos `String?` (campos `*Url`) apuntando a Vercel Blob. El checksum SHA-256 se valida durante el upload antes de guardar la URL.
