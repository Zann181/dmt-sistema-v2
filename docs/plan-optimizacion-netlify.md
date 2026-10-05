# Plan de optimización de consumo — Netlify (proyecto dmt69)

Fecha: 2026-10-04 · Plan actual: **Personal** (`credit-personal`) — $9/mes, **1.000 créditos/mes**

## Estado (2026-10-04)

- **Hecho en código:** Fase 1 (`ignore` en netlify.toml), Fase 2 (SSE reemplazado por `/api/attendees/check-ins` con consultas cortas cada 15 s solo con la pestaña visible; rutas `/api/realtime/*` eliminadas), Fase 3 (lista de eventos sin flyer/logos ni contraseña SMTP, layout solo con colores), Fase 4 (ventas con inserciones en lote y precio calculado en el servidor).
- **Corrección:** `DashboardOverview` no se renderiza en ninguna página, así que el SSE de ventas nunca generó costo real. El gasto en tiempo real venía solo de `/entrada`.
- **Hallazgo adicional:** cada cambio se desplegaba **dos veces** (un deploy con commit y otro sin commit, ~1 min después), es decir **30 créditos por cambio**. Usar un solo mecanismo: push a GitHub **o** deploy manual, no ambos.
- **Pendiente operativo:** trabajar en rama y publicar a `master` por lotes.

## 1. Cómo cobra Netlify (plan por créditos)

- El plan incluye 1.000 créditos al mes. **No se acumulan**: se pierden al empezar el siguiente ciclo.
- Si se acaban:
  - con **auto recharge** activado, se compran 500 créditos por $5 automáticamente;
  - sin auto recharge, **el sitio deja de funcionar** hasta el siguiente ciclo. Ojo durante un evento.
- Lo que gasta créditos en este proyecto:

| Concepto | Unidad | Créditos | Qué lo genera en DMT |
|---|---|---|---|
| **Deploy a producción** | 1 deploy publicado | **15** | Cada push a `master` |
| **Functions compute** | 1 GB-hora | 10 | Cada request a `/api/*` y cada página renderizada en servidor (Next.js corre como función) |
| **Database compute** | 1 GB-hora | 10 | Tiempo que Netlify DB está "despierta" atendiendo queries |
| Web bandwidth | 1 GB | 20 | Datos enviados a navegadores/celulares |
| Database bandwidth | 1 GB | 20 | Datos que salen o entran de Netlify DB (incluye lo que baja a tu PC con `arrancar.bat`) |
| Web requests | 10.000 requests | 2 | Toda visita/llamada |

- **No cobran**: deploy previews, branch deploys, deploys fallidos y formularios.

## 2. Diagnóstico (datos reales + estimaciones)

### 2.1 Deploys — el mayor gasto medido
- Septiembre 2026: **36 deploys a producción publicados** (más 5 fallidos, que no cobran).
- **36 × 15 = 540 créditos**: el 54 % del plan mensual se fue solo en deploys.
- Desde el 28-sep ya van 9 deploys, es decir 135 créditos.
- Causa: cada commit a `master` se publica en producción, incluidos los que solo cambian docs o scripts.

### 2.2 Tiempo real con SSE — el mayor gasto *estimado* durante eventos
- [`/api/realtime/check-in`](../src/app/api/realtime/check-in/route.ts) y [`/api/realtime/sales`](../src/app/api/realtime/sales/route.ts) mantienen una función abierta por cada pantalla conectada y consultan la DB **cada 2 s**.
  - Usuarios: [`entrada/page.tsx:30`](../src/app/(dashboard)/entrada/page.tsx) (check-in) y [`DashboardOverview.tsx:51`](../src/components/features/dashboard/DashboardOverview.tsx) (ventas). El dashboard además hace polling cada 30 s.
- Las funciones cobran por **tiempo abierto × memoria**, no por trabajo útil.
  - Estimación con funciones de 1 GB: **~9 créditos por hora por pantalla abierta**.
  - Ejemplo: noche de evento de 6 h con 3 celulares en entrada y 1 dashboard ≈ **~200 créditos**.
- El polling cada 2 s **impide que Netlify DB se duerma**, así que también suma Database compute mientras haya cualquier pantalla abierta.
- Además tiene un bug funcional: al reconectar se pierden check-ins (ver sección 4, Fase 2).

### 2.3 Payloads pesados — bandwidth innecesario
- `GET /api/events` ([route.ts:113](../src/app/api/events/route.ts)) devuelve las filas completas, **incluido `flyerUrl` en base64**. Hoy son ~1,1 MB por llamada: los 4 eventos, uno de ellos con un flyer de 840 KB.
- Se llama desde el selector de eventos del sidebar (todas las páginas), `/entrada` y `/usuarios`. Cada llamada cobra **dos veces**: web bandwidth + database bandwidth.
- [`app/layout.tsx:34`](../src/app/layout.tsx) consulta la DB (fila completa de la sucursal) **en cada render de página** solo para obtener colores.
- La sesión (`auth()` en [lib/auth.ts](../src/lib/auth.ts)) reconstruye permisos desde la DB en cada request. Su caché LRU de 5 s vive en memoria de la función, que en serverless se pierde entre instancias, así que casi no ayuda.

### 2.4 Otros menores
- [`SalesService.ts:47,77`](../src/domains/sales/services/SalesService.ts): `await` dentro de loops. Más tiempo de función por venta.
- Imágenes generadas con `sharp` (`qr.png`, `card.png`, `flyer.png`): si no tienen cabeceras de caché de CDN, se regeneran en cada visita.

> **Limitación:** ni el MCP de Netlify ni la API pública exponen el desglose de créditos por categoría. Los números de la sección 2.2 son estimaciones. El desglose real está en **app.netlify.com → team ZAMA → Usage & billing**. Revisarlo antes y después de cada fase.

## 3. Ahorro esperado (resumen)

| Fase | Cambio | Ahorro estimado/mes | Esfuerzo | Riesgo |
|---|---|---|---|---|
| 1 | Menos deploys a producción | **~400–450 créditos** (medido: 540 → ~90) | 15 min, sin código | Bajo |
| 2 | SSE → polling corto y solo con pantalla visible | **~150–200 créditos por evento** | 2–3 h | Medio |
| 3 | Payloads y caché (eventos, layout, imágenes, sesión) | 20–80 créditos | 2–3 h | Bajo |
| 4 | Queries en lote | menor | 1 h | Bajo |

Con las fases 1 y 2 el consumo típico debería quedar muy por debajo de 1.000 créditos/mes. Así no hace falta subir de plan ni depender del auto recharge.

## 4. Plan de implementación

### Fase 0 — Medir línea base (10 min)
1. Netlify → Usage & billing: anotar los créditos usados en el ciclo actual por categoría (Deploys, Functions, Database, Bandwidth).
2. Decidir la política de **auto recharge**:
   - recomendado **ON** durante temporada de eventos, para que el sitio no se caiga a mitad de una fiesta;
   - con alerta de uso, si Netlify la ofrece en tu plan.

### Fase 1 — Controlar deploys (sin tocar lógica)
1. Agregar `ignore` en [`netlify.toml`](../netlify.toml) para no construir cuando solo cambian docs, scripts o markdown:
   ```toml
   [build]
     command = "npm run build"
     ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- src prisma netlify public package.json package-lock.json next.config.ts netlify.toml"
   ```
2. Flujo de trabajo:
   - trabajar en una rama (`dev`) y usar **deploy previews / branch deploys, que son gratis**, para probar;
   - fusionar a `master` en lotes, por ejemplo 1–2 veces por semana o antes de cada evento.
3. Alternativa más estricta: en Netlify → Deploys → **Stop auto publishing** y publicar manualmente el deploy elegido.
4. **Verificación:** contar deploys del ciclo con `netlify api listSiteDeploys`. Meta: ≤ 6/mes (90 créditos).

### Fase 2 — Tiempo real barato y sin perder check-ins
1. Nuevo endpoint corto `GET /api/attendees/check-ins?since=<ISO>&eventId=` que devuelve solo los check-ins posteriores a `since`. Responde en ~50 ms y cierra.
2. En `useCheckInStream` reemplazar `EventSource` por `useQuery` con:
   - `refetchInterval: 10_000` y `refetchIntervalInBackground: false`, para no consultar con la pantalla apagada o en otra pestaña;
   - el cursor `since` guardado en el cliente, así **no se pierden check-ins** al reconectar (corrige el bug actual);
   - `branchId`/`eventId` en la `queryKey`, que corrige el bug de dependencias del efecto.
3. Igual para ventas en `DashboardOverview`:
   - quitar el SSE de `/api/realtime/sales`;
   - polling de 30–60 s solo con la pestaña visible.
4. Eliminar `src/app/api/realtime/*` cuando ya no lo use nadie.
5. Resultado esperado: de ~9 créditos/hora por pantalla a ~0,1, y la DB puede dormirse cuando nadie está mirando.
6. **Verificación:** 2 dispositivos en `/entrada`. Hacer check-in en uno y ver que aparece en el otro en ≤ 10 s, también después de bloquear y desbloquear el celular.

### Fase 3 — Payloads y caché
1. `GET /api/events`: agregar `select` sin `flyerUrl`, `emailBody` ni otros campos pesados.
   - El flyer ya se sirve aparte en `/api/events/[id]/flyer.png`.
   - Pedir ese PNG con `?v=<updatedAt>` y responder con `Cache-Control: public, max-age=31536000, immutable` para que lo sirva el CDN de Netlify sin ejecutar la función.
2. Mismas cabeceras de caché de CDN en `qr.png`, `card.png` y `flyer.png`. Esas imágenes no cambian para un mismo código o versión.
3. `app/layout.tsx`:
   - `select` solo de los campos de color;
   - cachear por sucursal con la API de caché de Next 16 (**revisar `node_modules/next/dist/docs/` antes**, según AGENTS.md);
   - invalidar al editar la sucursal.
4. Sesión: subir el TTL del caché de permisos o guardar los permisos en el JWT y refrescarlos solo al cambiar de contexto o rol.
5. (Opcional) Mover flyers y logos de la DB (base64) a **Netlify Blobs**. La DB queda liviana y el backup es más rápido.
6. **Verificación:**
   - en DevTools → Network, `/api/events` debe pesar < 10 KB;
   - una segunda carga de `flyer.png` debe responder desde caché (`cache-status` hit).

### Fase 4 — Queries
1. `SalesService`: reemplazar `await` en loop por `createMany`, o un `$transaction` con las operaciones en paralelo.
2. `attendees/import`: paralelizar los `await` independientes (aviso de react-doctor, línea 91).

### Fase 5 — Hábitos operativos
- `arrancar.bat` ahora usa la **DB de producción**: cada sesión local consume Database compute + bandwidth. Cerrarlo con el mismo `.bat` al terminar.
- No dejar el dashboard abierto en pantallas sin uso (aplica hasta terminar la Fase 2).
- Revisar Usage & billing al final de cada evento.

## 5. Fuera de este plan pero urgente (seguridad)
- `AUTH_SECRET` **no está configurado en Netlify**: producción usa el secreto de respaldo del repo público.
- `test-db.js` con credenciales de Supabase está commiteado en el repo público.
- Cualquier usuario puede consultar datos de otra sucursal cambiando `branchId`.
