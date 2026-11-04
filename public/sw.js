// Service worker de DMT: deja la app usable sin internet.
// - /_next/static y recursos estáticos: cache primero.
// - Páginas y GET /api: red primero, y si no hay red se sirve la última copia guardada.
// Los POST (check-in) nunca se cachean: la cola offline vive en IndexedDB.
const CACHE = "dmt-v1"

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/attendees/export")) return
  if (url.pathname.startsWith("/api/attendees/check-ins")) return

  const isStatic = url.pathname.startsWith("/_next/static/") || /\.(png|jpg|svg|ico|woff2?)$/.test(url.pathname)

  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
            return res
          })
      )
    )
    return
  }

  const isPage = req.mode === "navigate"
  // Las páginas se guardan por ruta (sin ?mode=...) para que cualquier pestaña sirva offline.
  const key = isPage ? new Request(url.origin + url.pathname) : req

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (isPage || url.pathname.startsWith("/api/"))) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(key, copy))
        }
        return res
      })
      .catch(() => caches.match(key).then((hit) => hit || (isPage ? caches.match(url.origin + "/entrada") : undefined) || Response.error()))
  )
})
