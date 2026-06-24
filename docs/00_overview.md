# DMT Sistema v2 — Visión General

## Objetivo

Reescritura completa del sistema de gestión de eventos DMT69 de Django monolítico a una arquitectura moderna Next.js 15 con despliegue 100% gratuito en Vercel + Neon PostgreSQL.

## Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Framework | Next.js 15 (App Router) | SSR + API Routes en un solo proyecto, Edge-ready, gratis en Vercel |
| Lenguaje | TypeScript | Tipado seguro end-to-end, DDD bien definido |
| ORM | Prisma 6 | Migrations, type-safe queries, compatible con Neon |
| Base de datos | PostgreSQL (Neon) | Free tier 0.5GB, compatibilidad total Prisma, sin cold-start |
| Autenticación | Auth.js v5 (NextAuth) | JWT + sessions, role-based, integra con Prisma adapter |
| Storage | Vercel Blob | Imágenes, QR, flyers — gratis hasta 1GB |
| Email | Resend | 3000 emails/mes gratis, templates HTML, adjuntos |
| QR | `qrcode` + `sharp` | Generación server-side, overlay de logo, mismo comportamiento que el sistema actual |
| Tiempo real | Server-Sent Events (SSE) + Long Polling | Actualizaciones de check-in en vivo, compatible con Vercel Edge |
| UI Components | shadcn/ui + Tailwind CSS v4 | Accesible, personalizable, no agranda el bundle |
| Estado cliente | TanStack Query v5 | Cache, refetch automático, polling configurable |
| Validación | Zod | Validación isomórfica (client + server), integra con tRPC |
| API | tRPC v11 o Next.js Route Handlers | Type-safe, sin schema duplicado |
| Deploy | Vercel (gratuito) | CDN global, Preview URLs, secrets integrados |

## Principios de Arquitectura

### Domain-Driven Design (DDD)
El sistema se organiza por **dominios de negocio**, no por tipo de archivo. Cada dominio es autónomo con sus entidades, repositorios y servicios propios.

```
Bounded Contexts:
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Identity  │   │   Branch    │   │    Event    │
│  (auth/acl) │──▶│ (sucursal)  │──▶│  (evento)   │
└─────────────┘   └─────────────┘   └─────────────┘
                         │                  │
                         ▼                  ▼
                  ┌─────────────┐   ┌─────────────┐
                  │   Catalog   │   │  Attendee   │
                  │  (producto) │◀──│ (asistente) │
                  └─────────────┘   └─────────────┘
                         │                  │
                         ▼                  ▼
                  ┌─────────────┐   ┌─────────────┐
                  │    Sales    │   │  Inventory  │
                  │   (barra)   │   │  (stock)    │
                  └─────────────┘   └─────────────┘
```

### Capas por Dominio
```
domains/[nombre]/
├── entities/        # Tipos TypeScript + reglas invariantes
├── value-objects/   # Objetos inmutables (Money, QrCode, Color)
├── repositories/    # Contratos (interfaces) de acceso a datos
├── services/        # Lógica de negocio pura (sin I/O)
└── errors/          # Errores de dominio tipados
```

### Seguridad First
- **Sin credenciales hardcodeadas** (problema crítico del sistema actual)
- JWT firmado con RS256, refresh tokens rotativos
- Rate limiting en todos los endpoints de autenticación y mutación
- CSRF protegido via `SameSite=Strict` en cookies
- Todos los endpoints de API validan sesión + rol antes de ejecutar
- Inputs sanitizados con Zod antes de llegar a la capa de dominio
- Headers de seguridad configurados en `next.config.ts` (CSP, HSTS, X-Frame-Options)
- `HttpOnly + Secure` en todas las cookies de sesión

## Estructura de Carpetas del Proyecto

```
dmt-sistema-v2/
├── docs/                          # ← Esta documentación DDD
│   ├── 00_overview.md
│   ├── 01_domain_model.md
│   ├── 02_database_schema.md
│   ├── 03_backend_api.md
│   ├── 04_frontend_architecture.md
│   ├── 05_auth_and_roles.md
│   ├── 06_realtime_strategy.md
│   └── 07_deployment.md
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   └── api/
│   ├── domains/                   # DDD Domain Layer
│   │   ├── branch/
│   │   ├── event/
│   │   ├── attendee/
│   │   ├── catalog/
│   │   ├── sales/
│   │   ├── inventory/
│   │   └── identity/
│   ├── infrastructure/            # Implementaciones externas
│   │   ├── database/
│   │   ├── storage/
│   │   ├── email/
│   │   └── qr/
│   ├── shared/                    # Shared Kernel
│   │   ├── types/
│   │   ├── guards/
│   │   ├── errors/
│   │   └── utils/
│   └── components/                # UI Layer
│       ├── ui/
│       ├── layouts/
│       └── features/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── .env.example                   # Variables requeridas (sin valores reales)
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

## Módulos del Sistema (migrados desde Django)

| Django App | Dominio v2 | Descripción |
|-----------|-----------|-------------|
| `shared_ui` | `app/(dashboard)` + `identity` | Dashboard, login, layout común |
| `branches` | `domains/branch` | Sucursales y personal |
| `events` | `domains/event` | Configuración de eventos, QR, email template |
| `attendees` | `domains/attendee` | Registro, check-in, exportes, WhatsApp |
| `catalog` | `domains/catalog` | Productos base |
| `sales` | `domains/sales` | POS, caja, productos por evento |
| `inventory` | `domains/inventory` | Auditoría de movimientos |
| `media_assets` | `infrastructure/storage` | Normalización de imágenes via Vercel Blob |
| `ticketing` | `infrastructure/email` + `infrastructure/qr` | QR, email, WhatsApp |
| `identity` | `domains/identity` | Membresías, permisos, contexto activo |

## Roles del Sistema

| Rol | Código | Acceso |
|-----|--------|--------|
| Admin Global | `GLOBAL_ADMIN` | Todo — sin restricción de sucursal |
| Admin Sucursal | `BRANCH_ADMIN` | Config sucursal, staff, todos los módulos de su branch |
| Admin Evento | `EVENT_ADMIN` | Gestión de eventos, asignación de staff |
| Entrada | `ENTRANCE` | Solo módulo de asistentes y check-in |
| Barra | `BAR` | Solo módulo de ventas (POS) |

## Migración de Datos

La migración de MySQL a PostgreSQL se realizará con un script de migración en `scripts/migrate-data.ts` que:
1. Lee datos desde el dump MySQL exportado
2. Transforma y normaliza a esquema Prisma
3. Sube imágenes de `media/` a Vercel Blob
4. Genera QR faltantes via la nueva infraestructura

Ver `docs/07_deployment.md` para el proceso detallado.
