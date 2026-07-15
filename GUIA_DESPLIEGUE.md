# 🚀 Guía de Despliegue a Producción (DMT Sistema v2)

Esta guía detalla paso a paso cómo subir el proyecto **DMT Sistema v2** a internet utilizando **Vercel** para el frontend/backend, **Supabase** para la base de datos PostgreSQL, y **Vercel Blob** para el almacenamiento de imágenes.

---

## 🏗️ 1. Preparar la Base de Datos (Supabase)

El sistema requiere una base de datos PostgreSQL en la nube. **Supabase** es ideal por su capa gratuita robusta y soporte para Connection Pooling (requerido por Prisma en entornos serverless).

1. Ve a [Supabase.com](https://supabase.com/) y crea una cuenta o inicia sesión.
2. Haz clic en **"New Project"**, elige una organización, nombra tu proyecto (ej. `dmt-sistema`) y crea una contraseña segura para la base de datos. Guarda esta contraseña, la necesitarás.
3. Espera un par de minutos a que se aprovisione la base de datos.
4. En el panel izquierdo de Supabase, ve a **Project Settings** (el ícono de engranaje ⚙️) y luego a **Database**.
5. Desplázate hacia abajo hasta la sección **Connection string** y selecciona **URI**.
6. Necesitarás configurar dos URLs en tu proyecto por cómo funciona Prisma con Supabase:
   
   **A. URL de Pooling (Para `DATABASE_URL`)**
   - Asegúrate de tener activada la opción "Use connection pooling".
   - El puerto en la URL debe ser `6543`.
   - Reemplaza `[YOUR-PASSWORD]` por la contraseña que creaste en el paso 2.
   - *Ejemplo:* `postgresql://postgres.[tu-ref]:[tu-password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`

   **B. URL Directa (Para `DATABASE_DIRECT_URL`)**
   - Desmarca la opción "Use connection pooling".
   - El puerto en la URL cambiará a `5432`.
   - Reemplaza la contraseña igual que arriba.
   - *Ejemplo:* `postgresql://postgres.[tu-ref]:[tu-password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres`

---

## 🗄️ 2. Configurar Almacenamiento de Imágenes (Vercel Blob)

El sistema guarda logotipos de sucursales y flyers de eventos usando Vercel Blob.

1. Crea una cuenta en [Vercel](https://vercel.com/).
2. Antes de subir el código, ve a la pestaña **Storage** en Vercel.
3. Haz clic en **Create Database** y selecciona **Vercel Blob**.
4. Nombra tu almacenamiento (ej. `dmt-blob`).
5. Sigue los pasos y Vercel te dará automáticamente un token llamado **`BLOB_READ_WRITE_TOKEN`**. Guárdalo para más adelante.

---

## 📧 3. Configurar Envío de Correos (Resend)

Para que el sistema pueda enviar correos de confirmación y códigos QR a los asistentes:

1. Crea una cuenta en [Resend.com](https://resend.com/).
2. Ve a la sección **API Keys** y genera una nueva llave. Cópiala (`RESEND_API_KEY`).
3. En la sección **Domains**, añade el dominio de tu discoteca o empresa para poder enviar correos legítimos sin que caigan en Spam (ej. `dmt.com`). Si aún no tienes dominio, puedes probar con el correo de pruebas que te da Resend (`onboarding@resend.dev`), pero solo servirá para enviarte correos a ti mismo.

---

## 🌐 4. Subir el Proyecto a GitHub y Vercel

### Paso A: Subir a GitHub
Asegúrate de que tu código actual está subido a un repositorio en tu cuenta de GitHub (puede ser Privado).

### Paso B: Importar en Vercel
1. En el panel de **Vercel**, haz clic en **Add New...** -> **Project**.
2. Conecta tu cuenta de GitHub y selecciona el repositorio de `dmt-sistema-v2`.
3. Vercel detectará automáticamente que es un proyecto **Next.js**. Déjalo así.
4. **IMPORTANTE:** Antes de darle a "Deploy", despliega la sección **Environment Variables** (Variables de Entorno) y añade todas las variables de producción:

| Nombre de la Variable | Valor |
| :--- | :--- |
| `DATABASE_URL` | Tu URL de Pooling de Supabase (Puerto 6543). |
| `DATABASE_DIRECT_URL` | Tu URL de conexión directa de Supabase (Puerto 5432). |
| `AUTH_SECRET` | Genera una clave aleatoria secreta (puedes usar: `openssl rand -base64 32` en tu terminal o inventar una cadena larga y segura). |
| `BLOB_READ_WRITE_TOKEN` | El token que obtuviste en el paso 2 al crear el Vercel Blob. (Si enlazaste el Storage al proyecto desde la UI de Vercel, se añade solo). |
| `RESEND_API_KEY` | Tu llave de API de Resend (Paso 3). |
| `RESEND_FROM_EMAIL` | El correo de envío por defecto (ej. `no-reply@tudominio.com`). |

5. Haz clic en **Deploy**.
6. Vercel comenzará a compilar tu aplicación. (Esto tardará un par de minutos).
*Nota: Es normal si la aplicación carga pero da error al iniciar sesión, ¡falta migrar la base de datos!*

---

## 🗃️ 5. Migrar y Poblar la Base de Datos en Producción

La base de datos en la nube está vacía. Debemos enviarle la estructura de tablas y el usuario administrador base.

Abre tu terminal local (en tu computadora, donde tienes el proyecto):

1. **Apunta tu entorno local a producción temporalmente:**
   Abre tu archivo `.env` local y cambia momentáneamente `DATABASE_URL` y `DATABASE_DIRECT_URL` por las credenciales de Supabase que obtuviste en el Paso 1.

2. **Empuja la estructura de la base de datos:**
   ```bash
   npm run db:push
   ```
   *Esto creará todas las tablas en tu base de datos en la nube.*

3. **Inyecta los datos semilla (Seed):**
   ```bash
   npm run db:seed
   ```
   *Esto creará al usuario global por defecto (ej. `admin` / `CambiarEstaContraseña123!`), la sucursal Norte, y algunas categorías.*

4. **IMPORTANTE: Restaura tu entorno local:**
   No olvides volver a poner las credenciales locales en tu archivo `.env` local para no afectar producción cuando hagas pruebas en tu PC.

---

## 🎉 6. ¡Listo para Usar!

1. Ve a la URL pública que Vercel te asignó (ej. `dmt-sistema.vercel.app`).
2. Inicia sesión con las credenciales que se crearon en el paso del Seed (`admin` / `CambiarEstaContraseña123!`).
3. Ya puedes configurar dominios personalizados directamente desde Vercel en **Settings > Domains** para usar tu propia dirección web como `admin.dmt.com`.

---

## 🛠️ Consejos de Mantenimiento

- **Actualizaciones:** Cuando quieras hacer cambios, simplemente haz `git commit` y `git push` a la rama `master` en GitHub. Vercel detectará el cambio y reconstruirá tu página automáticamente (Continuous Integration).
- **Cambios en la Base de Datos:** Si agregas campos nuevos a las tablas de Prisma en el futuro, recuerda ejecutar `npm run db:push` apuntando a tu BD de producción o utilizar el comando `npx prisma migrate deploy` para aplicar migraciones estructuradas.
