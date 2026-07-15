# 🚀 DMT Sistema v2 — Guía Paso a Paso para Supabase

> Migrar la base de datos de Neon a **Supabase** (PostgreSQL gestionado + extras).

---

## Tabla de Contenidos

1. [Crear proyecto en Supabase](#paso-1-crear-proyecto-en-supabase)
2. [Obtener las URLs de conexión](#paso-2-obtener-las-urls-de-conexión)
3. [Configurar variables de entorno](#paso-3-configurar-variables-de-entorno)
4. [Verificar / ajustar Prisma](#paso-4-verificar--ajustar-prisma)
5. [Push del schema a Supabase](#paso-5-push-del-schema-a-supabase)
6. [Seed de datos iniciales](#paso-6-seed-de-datos-iniciales)
7. [Probar la conexión local](#paso-7-probar-la-conexión-local)
8. [Configurar Vercel con Supabase](#paso-8-configurar-vercel-con-supabase)
9. [Extras opcionales de Supabase](#paso-9-extras-opcionales-de-supabase)
10. [Troubleshooting](#troubleshooting)

---

## Paso 1 — Crear proyecto en Supabase

1. Ir a **[https://supabase.com](https://supabase.com)** y crear una cuenta (o iniciar sesión).
2. Clic en **"New Project"**.
3. Completar los datos:

   | Campo             | Valor recomendado             |
   | ----------------- | ----------------------------- |
   | **Organization**  | Tu organización personal      |
   | **Name**          | `dmt-sistema-v2`              |
   | **Database Password** | Una contraseña fuerte (¡guárdala!) |
   | **Region**        | La más cercana a tus usuarios (ej: `South America - São Paulo`) |
   | **Plan**          | Free (suficiente para empezar) |

4. Clic en **"Create new project"** y esperar ~2 minutos mientras se aprovisiona.

> [!IMPORTANT]
> **Guarda la contraseña de la base de datos** — la necesitarás para las connection strings y no se puede recuperar después (solo resetear).

---

## Paso 2 — Obtener las URLs de conexión

1. En el dashboard de Supabase, ve a **Project Settings** → **Database**.
2. En la sección **"Connection string"**, copia las siguientes URLs:

### 🔌 Transaction Pooler (para la app — `DATABASE_URL`)

Es la URL que usa **PgBouncer** (puerto `6543`). Ideal para Vercel Functions / serverless:

```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

### 🔗 Session Pooler o Direct (para Prisma Migrate — `DATABASE_DIRECT_URL`)

Conexión directa al PostgreSQL (puerto `5432`). Necesaria para migraciones:

```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

> [!TIP]
> En el dashboard de Supabase, hay un botón **"Copy"** junto a cada connection string. Selecciona el modo **"Transaction"** para `DATABASE_URL` y **"Session"** para `DATABASE_DIRECT_URL`.

### Ejemplo real (reemplaza con tus valores)

```env
DATABASE_URL="postgresql://postgres.abcdefghijk:MiPassword123@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
DATABASE_DIRECT_URL="postgresql://postgres.abcdefghijk:MiPassword123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

---

## Paso 3 — Configurar variables de entorno

Abre tu archivo `.env` (o `.env.local`) en la raíz del proyecto y actualiza las variables de base de datos:

```env
# ─── Base de Datos (Supabase PostgreSQL) ────────────
# Transaction Pooler (para la app en producción/Vercel)
DATABASE_URL="postgresql://postgres.TU_PROJECT_REF:TU_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres"

# Session Pooler (para prisma db push / migrate)
DATABASE_DIRECT_URL="postgresql://postgres.TU_PROJECT_REF:TU_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

> [!WARNING]
> **No modifiques** el resto de las variables (`AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`, etc.) — solo las de base de datos cambian.

### Verificación rápida

Confirma que tu `.env` tiene al menos estas variables configuradas:

```env
AUTH_SECRET="..."           # ✅ ya existente
NEXTAUTH_URL="..."          # ✅ ya existente
DATABASE_URL="..."          # 🔄 ACTUALIZAR con Supabase
DATABASE_DIRECT_URL="..."   # 🔄 ACTUALIZAR con Supabase
BLOB_READ_WRITE_TOKEN="..." # ✅ ya existente (Vercel Blob)
RESEND_API_KEY="..."        # ✅ ya existente
RESEND_FROM_EMAIL="..."     # ✅ ya existente
NEXT_PUBLIC_APP_URL="..."   # ✅ ya existente
```

---

## Paso 4 — Verificar / ajustar Prisma

El proyecto ya está configurado para soportar múltiples proveedores de PostgreSQL. Revisa que los archivos estén correctos:

### `prisma.config.ts` (ya está bien ✅)

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    directUrl: process.env["DATABASE_DIRECT_URL"],
  },
});
```

### `prisma/schema.prisma` — datasource (ya está bien ✅)

```prisma
datasource db {
  provider = "postgresql"
}
```

> [!NOTE]
> Las URLs de conexión se inyectan desde `prisma.config.ts`, no desde el schema directamente. Esto permite que funcione con Neon, Supabase, o cualquier PostgreSQL sin cambiar el schema.

### `src/infrastructure/database/prisma.ts` — Cliente de base de datos

El cliente actual detecta automáticamente si la URL es de Neon (`neon.tech`) y usa el adapter correspondiente. Para Supabase, **caerá en la rama genérica `PrismaPg`**, que es exactamente lo que necesitamos.

No se necesita ningún cambio en el código. La lógica existente ya maneja Supabase correctamente:

```
si URL contiene "neon.tech" → usa PrismaNeon (adapter WebSocket)
si URL contiene "dummy"     → usa MockPrisma (offline)
si URL contiene "localhost" → usa PrismaPg sin SSL
cualquier otra cosa         → usa PrismaPg con SSL ✅ ← Supabase cae aquí
```

---

## Paso 5 — Push del schema a Supabase

Ahora vamos a crear todas las tablas en Supabase usando el schema de Prisma.

### Opción A: `prisma db push` (recomendado para primera vez)

```bash
# Genera el cliente Prisma
npx prisma generate

# Empuja el schema a Supabase (crea todas las tablas)
npx prisma db push
```

### Opción B: `prisma migrate` (si quieres control de migraciones)

```bash
# Genera el cliente Prisma
npx prisma generate

# Crea la migración inicial
npx prisma migrate dev --name init
```

> [!TIP]
> Usa `db push` si es un proyecto nuevo o una base de datos vacía. Usa `migrate` si necesitas un historial de cambios para colaboración en equipo.

### Verificar que se crearon las tablas

```bash
# Abre Prisma Studio para ver las tablas
npx prisma studio
```

Esto abrirá una interfaz web en `http://localhost:5555` donde puedes ver y editar las tablas visualmente.

También puedes verificar desde el **dashboard de Supabase** → **Table Editor** — ahí deberías ver todas las tablas:

| Tabla                | Descripción                     |
| -------------------- | ------------------------------- |
| `users`              | Usuarios del sistema            |
| `branches`           | Sucursales                      |
| `branch_memberships` | Membresías usuario↔sucursal     |
| `events`             | Eventos                         |
| `event_assignments`  | Asignaciones usuario↔evento     |
| `attendee_categories`| Categorías de asistentes        |
| `attendees`          | Asistentes registrados          |
| `products`           | Productos del bar               |
| `event_products`     | Productos habilitados por evento|
| `bar_sales`          | Ventas del bar                  |
| `cash_movements`     | Movimientos de caja             |
| `stock_movements`    | Movimientos de inventario       |

---

## Paso 6 — Seed de datos iniciales

Una vez creadas las tablas, ejecuta el seed para crear los usuarios y datos de prueba:

```bash
npx prisma db seed
```

Esto ejecutará `prisma/seed.ts` que crea:

- 🏢 **1 Sucursal**: "Sucursal Norte"
- 🎉 **1 Evento**: "Gran Apertura"
- 🏷️ **1 Categoría**: "VIP" ($15,000 — 2 consumiciones)
- 👤 **1 Asistente**: "Juan Perez"
- 🍺 **2 Productos**: "Cerveza Club", "Ron Medellín"
- 👥 **5 Usuarios** con roles diferentes:

| Usuario          | Contraseña                   | Rol               |
| ---------------- | ----------------------------- | ------------------ |
| `admin`          | `CambiarEstaContraseña123!`  | Admin Global       |
| `branch_admin`   | `CambiarEstaContraseña123!`  | Admin Sucursal     |
| `event_admin`    | `CambiarEstaContraseña123!`  | Admin Evento       |
| `entrance_staff` | `CambiarEstaContraseña123!`  | Staff Entrada      |
| `bar_staff`      | `CambiarEstaContraseña123!`  | Staff Barra        |

> [!CAUTION]
> **Cambia las contraseñas de los usuarios de producción** inmediatamente después del seed. Las contraseñas del seed son solo para desarrollo.

### Verificar seed

Después del seed, verifica en Prisma Studio o en el dashboard de Supabase → **Table Editor** → tabla `users` que existan los 5 registros.

---

## Paso 7 — Probar la conexión local

Levanta el servidor de desarrollo y verifica que todo funcione:

```bash
npm run dev
```

1. Abre `http://localhost:3000` en el navegador.
2. Inicia sesión con el usuario `admin` / `CambiarEstaContraseña123!`.
3. Verifica que puedas:
   - ✅ Ver el dashboard
   - ✅ Navegar a sucursales
   - ✅ Ver el evento "Gran Apertura"
   - ✅ Registrar un asistente de prueba

> [!NOTE]
> Si la app muestra "Desconectado" o errores de conexión, revisa la sección de [Troubleshooting](#troubleshooting).

---

## Paso 8 — Configurar Vercel con Supabase

Si ya tienes el proyecto en Vercel, actualiza las variables de entorno:

### Vía Dashboard (recomendado)

1. Ve a **Vercel Dashboard** → Tu proyecto → **Settings** → **Environment Variables**.
2. Actualiza (o crea) las siguientes variables:

   | Variable             | Valor                                               | Entornos                   |
   | -------------------- | --------------------------------------------------- | -------------------------- |
   | `DATABASE_URL`       | `postgresql://postgres.xxx:pass@...pooler...:6543/postgres` | Production, Preview, Dev |
   | `DATABASE_DIRECT_URL`| `postgresql://postgres.xxx:pass@...pooler...:5432/postgres` | Production, Preview, Dev |

3. Clic en **Save**.

### Vía CLI

```bash
# Eliminar las variables antiguas de Neon (si existen)
vercel env rm DATABASE_URL
vercel env rm DATABASE_DIRECT_URL

# Agregar las nuevas de Supabase
vercel env add DATABASE_URL
# (pegar el connection string de Supabase Transaction Pooler)

vercel env add DATABASE_DIRECT_URL
# (pegar el connection string de Supabase Session Pooler)
```

### Re-deploy

```bash
# Deploy a producción con las nuevas variables
vercel --prod
```

---

## Paso 9 — Extras opcionales de Supabase

Supabase incluye funcionalidades adicionales que **no necesitas configurar ahora**, pero pueden ser útiles más adelante:

### 🔒 Row Level Security (RLS)

Supabase habilita RLS por defecto en nuevas tablas. Como usamos **Prisma** (que se conecta como `postgres`, el superusuario), RLS **no afecta nuestras queries**. Sin embargo, si en el futuro quieres usar el SDK de Supabase directamente desde el frontend, necesitarás configurar políticas RLS.

> [!WARNING]
> Si creas tablas manualmente desde el dashboard de Supabase (no con Prisma), RLS estará habilitado por defecto y bloqueará las consultas. Para deshabilitarlo temporalmente en una tabla:
> ```sql
> ALTER TABLE nombre_tabla DISABLE ROW LEVEL SECURITY;
> ```

### 📦 Supabase Storage (alternativa a Vercel Blob)

Supabase incluye 1 GB de storage gratuito. Podrías usarlo en lugar de Vercel Blob para logos y flyers, pero **actualmente el proyecto usa Vercel Blob** y no es necesario migrar.

### 📊 Supabase Dashboard

El dashboard de Supabase ofrece herramientas útiles gratis:

- **Table Editor**: Editar datos visualmente (como Prisma Studio pero en la nube)
- **SQL Editor**: Ejecutar queries SQL directamente
- **Logs**: Ver logs de la base de datos en tiempo real
- **Database Health**: Métricas de performance

### 🔄 Backups automáticos

El plan gratuito incluye backups diarios con retención de 7 días. Los backups se gestionan automáticamente — no necesitas configurar nada.

---

## Troubleshooting

### ❌ Error: `connection refused` o `ECONNREFUSED`

**Causa**: La URL de conexión es incorrecta o el proyecto de Supabase está pausado.

**Solución**:
1. Verifica que el proyecto no esté en pausa en el dashboard de Supabase.
2. Confirma que la contraseña en la URL no tenga caracteres especiales sin codificar.
3. Si la contraseña tiene `@`, `#`, `%` u otros caracteres especiales, codifícalos:
   ```
   @ → %40
   # → %23
   % → %25
   ```

---

### ❌ Error: `SSL connection is required`

**Causa**: El adaptador `PrismaPg` está intentando conectarse sin SSL.

**Solución**: El código actual ya maneja esto automáticamente. Si el error persiste, agrega `?sslmode=require` al final de la URL:

```env
DATABASE_URL="postgresql://...supabase.com:6543/postgres?sslmode=require"
```

---

### ❌ Error: `prepared statement "sX" already exists`

**Causa**: Estás usando el **Transaction Pooler** (puerto 6543) con Prisma Migrate, que requiere conexión directa.

**Solución**: Asegúrate de que `DATABASE_DIRECT_URL` use el **Session Pooler** (puerto `5432`), no el Transaction Pooler:

```env
# ❌ MAL — Transaction pooler para migrate
DATABASE_DIRECT_URL="...pooler.supabase.com:6543/postgres"

# ✅ BIEN — Session pooler para migrate
DATABASE_DIRECT_URL="...pooler.supabase.com:5432/postgres"
```

---

### ❌ Error: `Can't reach database server`

**Causa**: Posible problema de red, firewall, o el proyecto de Supabase se auto-pausó (inactividad >1 semana en Free tier).

**Solución**:
1. Ve al dashboard de Supabase y verifica que el proyecto esté **activo** (indicador verde).
2. Si está pausado, haz clic en **"Restore project"**.
3. Verifica tu conexión a internet y que no haya un proxy/VPN bloqueando el puerto.

---

### ❌ Error: `relation "users" does not exist`

**Causa**: No se ejecutó `prisma db push` o `prisma migrate`.

**Solución**:
```bash
npx prisma generate
npx prisma db push
```

---

### ❌ Prisma Studio no conecta

**Causa**: Prisma Studio requiere `DATABASE_DIRECT_URL`, no la URL con pooling.

**Solución**: Asegúrate de que `DATABASE_DIRECT_URL` esté configurada en `.env`.

---

## Resumen: Checklist rápido

```
☐ 1. Crear proyecto en supabase.com
☐ 2. Copiar connection strings (Transaction + Session pooler)
☐ 3. Actualizar DATABASE_URL y DATABASE_DIRECT_URL en .env
☐ 4. Ejecutar: npx prisma generate
☐ 5. Ejecutar: npx prisma db push
☐ 6. Ejecutar: npx prisma db seed
☐ 7. Probar: npm run dev → login con admin
☐ 8. Actualizar variables en Vercel Dashboard
☐ 9. Re-deploy: vercel --prod
```

---

## Límites del Free Tier — Supabase vs Neon

| Aspecto              | Supabase Free        | Neon Free            |
| -------------------- | -------------------- | -------------------- |
| **Storage**          | 500 MB               | 512 MB               |
| **Bandwidth**        | 5 GB                 | Ilimitado            |
| **Backups**          | 7 días               | 7 días (PITR)        |
| **Pausa automática** | 7 días inactividad   | 5 min inactividad    |
| **Proyectos**        | 2                    | 1                    |
| **Auth incluido**    | ✅ Sí                | ❌ No                |
| **Storage incluido** | ✅ 1 GB              | ❌ No                |
| **Realtime**         | ✅ Sí                | ❌ No                |
| **Edge Functions**   | ✅ Sí                | ❌ No                |
| **Cold start**       | ~2s (al reactivar)   | ~500ms               |

> [!TIP]
> Supabase ofrece más funcionalidades integradas (Auth, Storage, Realtime, Edge Functions) que podrías aprovechar en el futuro sin costo adicional. Neon es más rápido en cold starts pero solo ofrece la base de datos.
