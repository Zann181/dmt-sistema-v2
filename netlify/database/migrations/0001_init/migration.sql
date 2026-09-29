-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BranchRole" AS ENUM ('BRANCH_ADMIN', 'EVENT_ADMIN', 'ENTRANCE', 'BAR');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AttendeeOrigin" AS ENUM ('MANUAL', 'EVENT_DAY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'QR', 'CARD');

-- CreateEnum
CREATE TYPE "CashModule" AS ENUM ('ENTRANCE', 'BAR');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('EVENT_DAY', 'EXPENSE', 'CASH_DROP');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('ENTRY', 'EXIT', 'ADJUST', 'SALE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuperuser" BOOLEAN NOT NULL DEFAULT false,
    "isGlobalAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "role" "BranchRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "role" "BranchRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "codePrefix" VARCHAR(12) NOT NULL DEFAULT 'DMT',
    "primaryColor" VARCHAR(7) NOT NULL DEFAULT '#39ff14',
    "secondaryColor" VARCHAR(7) NOT NULL DEFAULT '#e9ffe9',
    "pageBackgroundColor" VARCHAR(7) NOT NULL DEFAULT '#050505',
    "surfaceColor" VARCHAR(7) NOT NULL DEFAULT '#0f1113',
    "panelColor" VARCHAR(7) NOT NULL DEFAULT '#15181c',
    "textColor" VARCHAR(7) NOT NULL DEFAULT '#ffffff',
    "titleColor" VARCHAR(7) NOT NULL DEFAULT '#ffffff',
    "contactEmail" TEXT,
    "contactPhone" VARCHAR(30),
    "logoUrl" TEXT,
    "logoBgColor" TEXT DEFAULT '#f4f4f5',
    "logoSize" INTEGER DEFAULT 64,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "qrPrefix" VARCHAR(20) NOT NULL DEFAULT 'EVT',
    "qrFillColor" VARCHAR(7) NOT NULL DEFAULT '#102542',
    "qrBackgroundColor" VARCHAR(7) NOT NULL DEFAULT '#f8f9fa',
    "qrLogoBackgroundColor" VARCHAR(7) NOT NULL DEFAULT '#ffffff',
    "qrLogoScale" INTEGER NOT NULL DEFAULT 4,
    "logoUrl" TEXT,
    "qrLogoUrl" TEXT,
    "flyerUrl" TEXT,
    "accessPolicy" TEXT NOT NULL DEFAULT '',
    "venueName" VARCHAR(220) NOT NULL DEFAULT 'Terrazas Campestres - K3 Via Totoro',
    "mapsUrl" TEXT,
    "mapsLabel" VARCHAR(120) NOT NULL DEFAULT 'Abrir en Google Maps',
    "dressCode" VARCHAR(160) NOT NULL DEFAULT 'Todos de negro',
    "emailHost" VARCHAR(120) NOT NULL DEFAULT 'smtp.gmail.com',
    "emailPort" INTEGER NOT NULL DEFAULT 587,
    "emailSecure" BOOLEAN NOT NULL DEFAULT false,
    "emailUser" VARCHAR(120) NOT NULL DEFAULT 'zamamotas@gmail.com',
    "emailPassword" VARCHAR(120) NOT NULL DEFAULT 'uxxg iyhg rgsb xbmw',
    "emailFrom" VARCHAR(180) NOT NULL DEFAULT 'EVENT <zamamotas@gmail.com>',
    "emailSubject" VARCHAR(180) NOT NULL DEFAULT 'Tu acceso está listo: {nombre_evento}',
    "emailPreheader" VARCHAR(220) NOT NULL DEFAULT 'Popayan se viste de negro - Todos de negro - Closing 2025',
    "emailHeading" VARCHAR(180) NOT NULL DEFAULT 'Hola {nombre_asistente}',
    "emailIntro" TEXT NOT NULL DEFAULT 'Tu asistencia ha sido confirmada. Abajo tienes la info oficial del evento:',
    "emailMessageTitle" VARCHAR(140) NOT NULL DEFAULT 'Mensaje del evento',
    "emailBody" TEXT NOT NULL DEFAULT 'Tu registro para {nombre_evento} fue confirmado.

Fecha: {fecha_evento}
Categoria: {nombre_categoria}
QR: {codigo_qr}

Adjuntamos tu codigo QR para el ingreso.',
    "emailWarningTitle" VARCHAR(140) NOT NULL DEFAULT 'Importante',
    "emailWarningText" TEXT NOT NULL DEFAULT 'Ingreso Early hasta las 11:00 PM. Después de esa hora aplica multa de $25.000.',
    "emailDetailsTitle" VARCHAR(140) NOT NULL DEFAULT 'Detalles',
    "emailDateText" VARCHAR(180) NOT NULL DEFAULT '{fecha_evento}',
    "emailTimeText" VARCHAR(120) NOT NULL DEFAULT '{hora_evento}',
    "emailQrTitle" VARCHAR(180) NOT NULL DEFAULT 'Tu código QR está adjunto a este correo',
    "emailQrNote" VARCHAR(220) NOT NULL DEFAULT 'Preséntalo junto a tu cédula en la entrada.',
    "emailFooter" VARCHAR(220) NOT NULL DEFAULT 'Presenta este correo en la entrada del evento.',
    "emailClosingText" VARCHAR(220) NOT NULL DEFAULT 'Nos vemos pronto.',
    "emailTeamSignature" VARCHAR(220) NOT NULL DEFAULT '{nombre_sucursal}',
    "emailLegalNote" VARCHAR(220) NOT NULL DEFAULT 'Correo automático - conserva tu QR hasta el día del evento.',
    "emailLogoSize" INTEGER NOT NULL DEFAULT 80,
    "whatsappMessage" TEXT NOT NULL DEFAULT '¡Hola, {nombre_asistente}! 🎟️

Tu registro para *{nombre_evento}* ha sido confirmado.

*Detalles del Evento:*
📅 *Fecha:* {fecha_evento}
📍 *Lugar:* {lugar_evento}
🎫 *Categoría:* {nombre_categoria}

📥 *Descarga tu Código QR de Acceso:*
{link_qr}

¡Te esperamos!',
    "emailBackgroundColor" VARCHAR(7) NOT NULL DEFAULT '#000000',
    "emailCardColor" VARCHAR(7) NOT NULL DEFAULT '#0c0c0e',
    "emailHeaderBackgroundColor" VARCHAR(7) NOT NULL DEFAULT '#000000',
    "emailTextColor" VARCHAR(7) NOT NULL DEFAULT '#ffffff',
    "emailTitleColor" VARCHAR(7) NOT NULL DEFAULT '#ffffff',
    "emailMutedTextColor" VARCHAR(7) NOT NULL DEFAULT '#a1a1aa',
    "emailAccentColor" VARCHAR(7) NOT NULL DEFAULT '#00ffcc',
    "emailBorderColor" VARCHAR(7) NOT NULL DEFAULT '#1f1f26',
    "emailSectionBackgroundColor" VARCHAR(7) NOT NULL DEFAULT '#070709',
    "emailWarningBackgroundColor" VARCHAR(7) NOT NULL DEFAULT '#1c0d0d',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendee_categories" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "includedConsumptions" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "attendee_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendees" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdById" TEXT,
    "checkedInById" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "cc" VARCHAR(32) NOT NULL,
    "phone" VARCHAR(30),
    "email" TEXT,
    "origin" "AttendeeOrigin" NOT NULL DEFAULT 'MANUAL',
    "paidAmount" DECIMAL(10,2) NOT NULL,
    "qrCode" VARCHAR(120) NOT NULL,
    "qrImageUrl" TEXT,
    "hasCheckedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "includedBalance" INTEGER NOT NULL DEFAULT 0,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_products" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "updatedById" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eventPrice" DECIMAL(10,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bar_sales" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attendeeId" TEXT,
    "productId" TEXT NOT NULL,
    "soldById" TEXT NOT NULL,
    "saleGroup" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "usedIncludedConsumption" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bar_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bar_sale_payments" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reference" VARCHAR(120),
    "transferProofUrl" TEXT,

    CONSTRAINT "bar_sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdRole" VARCHAR(20) NOT NULL,
    "module" "CashModule" NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "description" VARCHAR(255) NOT NULL DEFAULT '',
    "attendeeQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitAmount" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movement_payments" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reference" VARCHAR(120),
    "transferProofUrl" TEXT,

    CONSTRAINT "cash_movement_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "eventId" TEXT,
    "productId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "movementType" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockBefore" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "note" VARCHAR(255) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "branch_memberships_userId_branchId_key" ON "branch_memberships"("userId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "event_assignments_userId_eventId_key" ON "event_assignments"("userId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_slug_key" ON "branches"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "events_branchId_slug_key" ON "events"("branchId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "attendee_categories_branchId_name_key" ON "attendee_categories"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "attendees_qrCode_key" ON "attendees"("qrCode");

-- CreateIndex
CREATE INDEX "attendees_branchId_idx" ON "attendees"("branchId");

-- CreateIndex
CREATE INDEX "attendees_cc_idx" ON "attendees"("cc");

-- CreateIndex
CREATE INDEX "attendees_branchId_eventId_idx" ON "attendees"("branchId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "attendees_eventId_cc_key" ON "attendees"("eventId", "cc");

-- CreateIndex
CREATE UNIQUE INDEX "event_products_eventId_productId_key" ON "event_products"("eventId", "productId");

-- CreateIndex
CREATE INDEX "bar_sales_saleGroup_idx" ON "bar_sales"("saleGroup");

-- CreateIndex
CREATE INDEX "bar_sales_branchId_eventId_idx" ON "bar_sales"("branchId", "eventId");

-- CreateIndex
CREATE INDEX "cash_movements_branchId_eventId_idx" ON "cash_movements"("branchId", "eventId");

-- AddForeignKey
ALTER TABLE "branch_memberships" ADD CONSTRAINT "branch_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_memberships" ADD CONSTRAINT "branch_memberships_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_assignments" ADD CONSTRAINT "event_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_assignments" ADD CONSTRAINT "event_assignments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_assignments" ADD CONSTRAINT "event_assignments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendee_categories" ADD CONSTRAINT "attendee_categories_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "attendee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_products" ADD CONSTRAINT "event_products_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_products" ADD CONSTRAINT "event_products_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_products" ADD CONSTRAINT "event_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_products" ADD CONSTRAINT "event_products_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bar_sales" ADD CONSTRAINT "bar_sales_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bar_sales" ADD CONSTRAINT "bar_sales_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bar_sales" ADD CONSTRAINT "bar_sales_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "attendees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bar_sales" ADD CONSTRAINT "bar_sales_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bar_sales" ADD CONSTRAINT "bar_sales_soldById_fkey" FOREIGN KEY ("soldById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bar_sale_payments" ADD CONSTRAINT "bar_sale_payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "bar_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movement_payments" ADD CONSTRAINT "cash_movement_payments_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "cash_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
