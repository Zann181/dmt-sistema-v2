# Guía de Despliegue: DMT Sistema v2 en Vercel + Neon

Esta guía explica paso a paso cómo preparar la base de datos, verificar su seguridad y realizar el despliegue del sistema de eventos en **Vercel** usando **Neon PostgreSQL Serverless**.

---

## 🔒 Auditoría y Seguridad de la Conexión

Hemos verificado que el mecanismo de conexión a la base de datos es robusto y seguro para entornos de producción en la nube:

1. **Encriptación SSL Forzada**:
   - Cuando utilizas **Neon Serverless** (`neon.tech`), la conexión se realiza a través de WebSockets encriptados de forma nativa (`wss://`) mediante la biblioteca `@neondatabase/serverless` y el adaptador de Prisma `PrismaNeon`.
   - Si utilizas cualquier otro proveedor de PostgreSQL (ej. Supabase, AWS RDS), Prisma Client requiere y negocia conexiones SSL por defecto. Se recomienda añadir el parámetro `?sslmode=require` al final de tu cadena de conexión.
2. **Conexión Separada para Migraciones (DDL)**:
   - Configurar `DATABASE_DIRECT_URL` permite que los cambios estructurales se realicen directamente sobre la base de datos sin pasar por el pool de conexiones (PgBouncer), evitando bloqueos y errores de "Prepared statements".

Puedes comprobar la seguridad de tu base de datos local o remota en cualquier momento ejecutando:
```bash
$env:NODE_PATH="node_modules"; npx tsx .gemini/antigravity/brain/fe20fa15-3f3c-4a09-b540-272a7850a3b9/scratch/test-db.ts
```

---

## 🛠️ Paso a Paso para el Despliegue

### Paso 1: Crear la Base de Datos en Neon

1. Ve a **[https://neon.tech](https://neon.tech)** y crea una cuenta gratuita.
2. Crea un nuevo proyecto llamado `dmt-sistema-v2`.
3. Copia tus dos cadenas de conexión desde el dashboard de Neon:
   - **DATABASE_URL (Pooled)**: Es la URL de conexión que tiene habilitado el Connection Pooling (suele incluir `?sslmode=require&pgbouncer=true` o similar). Se usa para la ejecución del servidor web en Vercel.
   - **DATABASE_DIRECT_URL (Direct Connection)**: Es la URL directa a la base de datos (puerto `5432` estándar). Se usa para crear/modificar tablas y correr seeds.

---

### Paso 2: Configurar tu Entorno Local y Crear las Tablas

1. En la raíz de tu proyecto, abre tu archivo `.env` y añade las URLs que copiaste:
   ```env
   # Cadena de conexión con Pooling (para la App)
   DATABASE_URL="postgresql://usuario:contraseña@tu-host-pooler.neon.tech/neondb?sslmode=require&pgbouncer=true"

   # Cadena de conexión Directa (para Migraciones)
   DATABASE_DIRECT_URL="postgresql://usuario:contraseña@tu-host-directo.neon.tech/neondb?sslmode=require"
   ```
2. Ejecuta la sincronización del esquema para crear todas las tablas en tu base de datos de Neon:
   ```bash
   npm run db:push
   ```
3. Ejecuta el seed para sembrar los roles, categorías iniciales y el usuario administrador por defecto (`admin` / `CambiarEstaContraseña123!`):
   ```bash
   npm run db:seed
   ```
   *(Nota: Una vez hecho esto, tu servidor local `npm run dev` ya estará guardando y cargando todo de tu base de datos de Neon, por lo que tus cambios no se perderán al reiniciar el servidor).*

---

### Paso 3: Configurar el Almacenamiento e Email

El sistema requiere servicios en la nube para guardar imágenes (flyers y logos) y enviar correos electrónicos:

1. **Vercel Blob** (Imágenes y códigos QR):
   - En tu panel de Vercel ➔ ve a la pestaña **Storage** ➔ selecciona **Blob** ➔ haz clic en **Create Store**.
   - Copia el token de acceso generado: `BLOB_READ_WRITE_TOKEN`.
2. **Resend** (Envío de Emails):
   - Regístrate en **[https://resend.com](https://resend.com)** (cuenta gratuita de 3,000 emails/mes).
   - Crea una API Key.
   - Si tienes un dominio propio, verifícalo en Resend. Si estás haciendo pruebas, puedes usar el correo remitente por defecto `onboarding@resend.dev`.

---

### Paso 4: Agregar Variables de Entorno en Vercel

En el panel de tu proyecto en **Vercel** (Settings ➔ Environment Variables), añade **todas** las siguientes variables de entorno:

| Variable | Valor / Ejemplo | Propósito |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://...pgbouncer=true` | Conexión agrupada a Neon |
| `DATABASE_DIRECT_URL` | `postgresql://...` (puerto 5432) | Conexión directa a Neon |
| `BLOB_READ_WRITE_TOKEN` | `vercel_blob_rw_...` | Subida de imágenes a Vercel Blob |
| `RESEND_API_KEY` | `re_...` | API Key para despacho de emails |
| `RESEND_FROM_EMAIL` | `no-reply@tudominio.com` o `onboarding@resend.dev` | Remitente del ticket de acceso |
| `AUTH_SECRET` | Genera uno con `openssl rand -base64 32` | Encriptación de sesiones Auth.js |
| `NEXT_PUBLIC_APP_URL` | `https://tu-proyecto.vercel.app` | URL base para los enlaces en correos y QR |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | `https://tu-proyecto.vercel.app` | URL base para renderizar flyer/logos |
| `NODE_ENV` | `production` | Modo de ejecución optimizado |

---

### Paso 5: Desplegar la Aplicación

Puedes desplegar conectando tu repositorio de GitHub a Vercel para despliegues automáticos (recomendado) o usando **Vercel CLI**:

#### Opción A: Conectando GitHub (Recomendada)
1. Sube tu código a un repositorio de GitHub.
2. En Vercel Dashboard ➔ haz clic en **Add New** ➔ **Project**.
3. Importa tu repositorio.
4. Asegúrate de añadir las variables de entorno listadas en el Paso 4.
5. Haz clic en **Deploy**. Cada vez que hagas `git push`, Vercel actualizará tu app automáticamente.

#### Opción B: Usando Vercel CLI
1. Instala Vercel CLI si no lo tienes:
   ```bash
   npm i -g vercel
   ```
2. Inicia sesión:
   ```bash
   vercel login
   ```
3. Ejecuta el comando de despliegue inicial en la carpeta raíz del proyecto:
   ```bash
   vercel
   ```
   *(Sigue las preguntas en pantalla para vincular el proyecto).*
4. Despliega a producción final:
   ```bash
   vercel --prod
   ```
