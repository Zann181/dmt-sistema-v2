# Despliegue en Vercel + Neon

Producción: **https://dmt69.vercel.app**. El proyecto Vercel `dmt69` (equipo DMT) despliega automáticamente cada push a `master`. La base de datos es Neon, conectada mediante la integración del Marketplace de Vercel.

## Arquitectura

```
Navegador ──► Vercel (iad1)  Next.js 16: páginas + /api/* como funciones Node (Fluid compute)
                 │  pg Pool + @prisma/adapter-pg  (DATABASE_URL, pooled)
                 ▼
              Neon Postgres (aws-us-east-1)       migraciones con DATABASE_URL_UNPOOLED
```

- Conexión: `src/infrastructure/database/prisma.ts`. Usa un Pool TCP contra la URL *pooled* y `attachDatabasePool` (lo que recomiendan Prisma 7 y Neon para Vercel).
- Migraciones: `prisma/migrations/`, aplicadas con `npx prisma migrate deploy`, que usa `DATABASE_URL_UNPOOLED` según `prisma.config.ts`. **No** corren en el build, para que un preview nunca migre producción.
- Imágenes (`qr.png`, `flyer.png`, `card.png`): se cachean en el CDN con `Vercel-CDN-Cache-Control`.

## Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Origen | Notas |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PG*`, `POSTGRES_*` | Integración Neon (automático) | No editar a mano |
| `AUTH_SECRET` | **Manual, tipo Sensitive** | `openssl rand -base64 32`. Sin esto el login no funciona en producción |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MEDIA_BASE_URL` | Manual | `https://dmt69.vercel.app`. Se usan en links de email/WhatsApp |
| `NEXT_PUBLIC_TIMEZONE` | Manual (opcional) | `America/Bogota` |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Manual (opcional) | Valores por defecto. Cada evento tiene su propio remitente en la DB |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Manual (opcional) | Login con Google |

## Límites de los planes gratuitos (y cómo los cuida el código)

| Límite | Valor | Mitigación |
|---|---|---|
| **Vercel Hobby: solo uso no comercial** | — | Para un negocio corresponde Pro ($20/mes) |
| Duración máxima de una función | 300 s | `maxDuration = 300` en la importación. A ~1–3 s por correo, importar por partes si hay más de ~100 asistentes |
| Vercel: CPU activa / invocaciones | 4 h / 1 M al mes | Polling de check-ins cada 30 s, solo con la pestaña visible y pausado tras 10 min sin uso |
| **Neon Free: cómputo** | 100 CU-hora/mes; se duerme tras 5 min sin uso | Mismo polling con pausa por inactividad. En Neon → Compute, poner el autoscaling máximo en **0.25 CU** |
| Neon: historial de restauración | 6 h | Backups propios con `scripts/backup-db.mjs` |
| Gmail SMTP | ~500 correos/día por cuenta | Repartir entre los remitentes de cada evento |

## Configuración recomendada en Neon / integración

- **Desmarcar el entorno Preview** en la integración para que los deploys de prueba no usen la base de producción.
- **Dejar apagado "preview branching":** cada rama consume del mismo cupo de 100 CU-hora.
- Autoscaling: mínimo y máximo en 0.25 CU.

## Operación

```powershell
# Backup (pide la connection string; la directa de Neon sirve)
node scripts/backup-db.mjs

# Restaurar en una base vacía (crea las tablas con prisma migrate deploy)
node scripts/restore-db.mjs backups/<carpeta>/db

# Restaurar sobrescribiendo los datos actuales (p. ej. sincronización final)
node scripts/restore-db.mjs backups/<carpeta>/db --reemplazar

# Aplicar migraciones nuevas a producción
$env:DATABASE_URL_UNPOOLED = "<connection string directa>"; npx prisma migrate deploy
```

Desarrollo local contra la base de producción: `arrancar.bat`. La primera vez pide `npx vercel env pull .env.local --environment=production`.
