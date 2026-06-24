# DMT Sistema v2 — Guía de Despliegue en Vercel + Neon

## Arquitectura de Infraestructura

```
┌──────────────────────────────────────────────────────┐
│                       VERCEL                          │
│                                                       │
│  ┌────────────────────────────────────────────────┐   │
│  │         Next.js 15 App                         │   │
│  │  ┌─────────────┐  ┌──────────────────────────┐ │   │
│  │  │  RSC Pages  │  │    API Route Handlers    │ │   │
│  │  │  (SSR/SSG)  │  │  (Node.js + Edge runtime)│ │   │
│  │  └─────────────┘  └──────────────────────────┘ │   │
│  └────────────────────────────────────────────────┘   │
│              │                    │                   │
│              ▼                    ▼                   │
│  ┌─────────────────┐  ┌────────────────────────────┐  │
│  │  Vercel Blob    │  │    Vercel Edge Network     │  │
│  │  (imágenes, QR) │  │    (CDN + caché global)    │  │
│  └─────────────────┘  └────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
              │
              ▼ SSL/TLS
┌──────────────────────────────────────────────────────┐
│                       NEON                            │
│           PostgreSQL Serverless (Free Tier)           │
│           0.5 GB storage, auto-scale, branching       │
└──────────────────────────────────────────────────────┘
```

---

## Paso 1: Crear Base de Datos en Neon

1. Ir a **https://neon.tech** → Crear cuenta gratuita
2. Crear nuevo proyecto: `dmt-sistema-v2`
3. Copiar las dos URLs:
   - `DATABASE_URL` → Connection string con pooling (para Vercel Functions)
   - `DATABASE_DIRECT_URL` → Direct connection (para Prisma Migrate)

```env
# Estas vienen del dashboard de Neon:
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dmt?sslmode=require&pgbouncer=true"
DATABASE_DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dmt?sslmode=require"
```

> **Neon Free Tier:** 0.5 GB storage, 1 proyecto, auto-suspend tras 5 min de inactividad (primer query tarda ~500ms al despertar). Suficiente para producción de eventos medianos.

---

## Paso 2: Configurar Vercel Blob

1. En el proyecto Vercel → Storage → Blob → Create Store
2. Copiar el token: `BLOB_READ_WRITE_TOKEN`

```env
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

> **Vercel Blob Free Tier:** 1 GB storage, 100 GB bandwidth/mes. Suficiente para logos, flyers y QRs de un sistema de eventos.

---

## Paso 3: Configurar Email con Resend

1. Crear cuenta en **https://resend.com** (3000 emails/mes gratis)
2. Verificar tu dominio o usar el dominio de Resend para pruebas
3. Obtener API Key

```env
RESEND_API_KEY="re_xxxxxxxxxxxx"
RESEND_FROM_EMAIL="eventos@tudominio.com"
# O para pruebas: "onboarding@resend.dev"
```

---

## Paso 4: Variables de Entorno Completas

> ⚠️ NUNCA commitear estas variables al repositorio. Siempre via Vercel Secrets o `.env.local`.

```env
# ─── Auth ─────────────────────────────────────────
AUTH_SECRET="genera-con: openssl rand -base64 32"
NEXTAUTH_URL="https://tu-app.vercel.app"

# ─── Base de datos (Neon) ─────────────────────────
DATABASE_URL="postgresql://..."
DATABASE_DIRECT_URL="postgresql://..."

# ─── Storage (Vercel Blob) ────────────────────────
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."

# ─── Email (Resend) ───────────────────────────────
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="eventos@tudominio.com"

# ─── App ──────────────────────────────────────────
NEXT_PUBLIC_APP_URL="https://tu-app.vercel.app"
NODE_ENV="production"

# ─── WhatsApp Media (si usas ngrok local) ─────────
# En producción: NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_MEDIA_BASE_URL="https://tu-app.vercel.app"
```

### Configurar en Vercel Dashboard
1. Proyecto → Settings → Environment Variables
2. Agregar CADA variable de la lista anterior
3. Marcar todas como "Production" + "Preview" + "Development"

---

## Paso 5: Crear Proyecto Next.js

```bash
# En la carpeta dmt-sistema-v2/
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

# Mover a src/ manualmente si se prefiere
# Instalar dependencias principales:
npm install \
  @prisma/client prisma \
  next-auth@beta \
  @auth/prisma-adapter \
  @tanstack/react-query \
  @tanstack/react-query-devtools \
  zustand \
  react-hook-form \
  @hookform/resolvers \
  zod \
  bcryptjs \
  @vercel/blob \
  resend \
  qrcode \
  sharp \
  xlsx \
  framer-motion \
  lucide-react \
  sonner \
  decimal.js

npm install -D \
  @types/bcryptjs \
  @types/qrcode
```

---

## Paso 6: Inicializar Prisma y DB

```bash
# Inicializar Prisma
npx prisma init

# Copiar el schema de docs/02_database_schema.md a prisma/schema.prisma

# Crear primera migración
npx prisma migrate dev --name init

# Generar cliente Prisma
npx prisma generate

# Seed inicial (crear usuario admin global)
npx prisma db seed
```

### Seed de usuario inicial

```typescript
// prisma/seed.ts
import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      email: "admin@dmt.com",
      firstName: "Admin",
      lastName: "Global",
      passwordHash: await hash("CambiarEstaContraseña123!", 12),
      isSuperuser: true,
      isGlobalAdmin: true,
      isActive: true,
    },
  })
  console.log("✅ Admin user created:", adminUser.username)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

---

## Paso 7: Desplegar en Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Primer deploy (desde la carpeta del proyecto)
vercel

# Configurar variables de entorno
vercel env add DATABASE_URL
vercel env add AUTH_SECRET
# ... (repetir para cada variable)

# Deploy a producción
vercel --prod
```

### Configurar dominio custom (opcional)
1. Vercel Dashboard → Domains → Add Domain
2. Agregar `tudominio.com` o `eventos.tudominio.com`
3. Apuntar DNS según instrucciones de Vercel

---

## Paso 8: Migración de Datos desde Sistema Anterior

### 1. Exportar datos de MySQL

```bash
# En el servidor de PythonAnywhere o local
mysqldump MotasEvent\$evento_db \
  --single-transaction \
  --routines \
  --triggers \
  > dmt_backup.sql
```

### 2. Script de migración TypeScript

```bash
# Crear script de migración
# scripts/migrate-from-mysql.ts
# Este script:
# 1. Lee el dump SQL
# 2. Crea entidades en el orden correcto (Branch → User → Event → ...)
# 3. Sube imágenes de media/ a Vercel Blob
# 4. Genera QR codes faltantes
# 5. Mantiene los IDs originales donde sea posible

npx tsx scripts/migrate-from-mysql.ts \
  --source dmt_backup.sql \
  --media-dir ./media \
  --dry-run  # primero en dry-run para validar
```

### Orden de migración de tablas

```
1. branches          (sin dependencias)
2. auth_user         (usuarios de Django)
3. identity_userbranchmembership
4. events_event
5. identity_usereventassignment
6. attendees_category
7. attendees_attendee
8. catalog_product
9. sales_eventproduct
10. sales_barsale + sales_barsalepayment
11. sales_cashmovement + sales_cashmovementpayment
12. inventory_stockmovement
```

> Las imágenes de `media/` se suben a Vercel Blob y las URLs se guardan en los campos `*Url` del nuevo esquema Prisma. El modelo `MediaAsset` (GenericFK de Django) se elimina completamente.

---

## Monitoreo y Mantenimiento

### Logs en Vercel
- Vercel Dashboard → Functions → Logs (tiempo real)
- Filtrar por ruta para debug

### Analytics de Base de Datos (Neon)
- Neon Dashboard → Monitoring → Queries más lentas
- Agregar índices según los query plans

### Backup automático
Neon incluye **Point-in-Time Recovery** en el Free tier — backups automáticos de los últimos 7 días.

### Alertas de Error
- Configurar **Vercel Monitoring** (gratis) para alertas de errores 500
- Opcionalmente integrar Sentry (Free: 5000 errores/mes)

---

## Límites del Free Tier (Resumen)

| Servicio | Límite Free | Uso esperado | Estado |
|---------|-------------|--------------|--------|
| Vercel Hobby | 100GB bandwidth, 100k req/mes | ~10k req/evento | ✅ |
| Neon | 0.5 GB DB, 1 proyecto | ~50MB por evento | ✅ |
| Vercel Blob | 1 GB storage, 100 GB bandwidth | ~200MB logo/QR | ✅ |
| Resend | 3,000 emails/mes | ~500/evento | ✅ |
| Vercel Functions | 60s timeout, Node.js | SSE con heartbeat | ✅ |

> Para eventos muy grandes (>5000 asistentes, >10 usuarios simultáneos), considerar Vercel Pro ($20/mes) que sube los límites significativamente.
