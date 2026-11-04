// Soporte sin internet para el escáner de entrada.
// - Snapshot de asistentes del evento en IndexedDB (se guarda con el botón "Offline").
// - Cola de check-ins hechos sin red; se envían solos al volver la conexión.

export type OfflineAttendee = {
  id: string
  name: string
  cc: string
  qr: string | null
  cat: string | null
  in: boolean
  at: string | null
  by: string | null
}

type PendingCheckIn = { key?: number; eventId: string; code: string; at: string }

const DB_NAME = "dmt-offline"
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots", { keyPath: "eventId" })
      if (!db.objectStoreNames.contains("pending")) db.createObjectStore("pending", { keyPath: "key", autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode)
    const r = run(t.objectStore(store))
    t.oncomplete = () => { db.close(); resolve(r.result) }
    t.onerror = () => { db.close(); reject(t.error) }
  })
}

type Snapshot = { eventId: string; savedAt: string; list: OfflineAttendee[] }

export async function saveSnapshot(eventId: string, list: OfflineAttendee[], savedAt: string) {
  await tx("snapshots", "readwrite", (s) => s.put({ eventId, savedAt, list } as Snapshot))
}

export async function getSnapshot(eventId: string): Promise<Snapshot | null> {
  try {
    return ((await tx("snapshots", "readonly", (s) => s.get(eventId))) as Snapshot) || null
  } catch {
    return null
  }
}

export async function listPending(eventId?: string): Promise<PendingCheckIn[]> {
  try {
    const all = (await tx("pending", "readonly", (s) => s.getAll())) as PendingCheckIn[]
    return eventId ? all.filter((p) => p.eventId === eventId) : all
  } catch {
    return []
  }
}

async function addPending(p: PendingCheckIn) {
  await tx("pending", "readwrite", (s) => s.add(p))
}

async function removePending(key: number) {
  await tx("pending", "readwrite", (s) => s.delete(key))
}

/**
 * Check-in sin red: valida contra el snapshot, marca localmente y encola.
 * Lanza Error("ALREADY_CHECKED_IN") con `.attendee` si ya había ingresado.
 */
export async function offlineCheckIn(code: string, eventId: string) {
  const snap = await getSnapshot(eventId)
  if (!snap) {
    throw new Error("Sin internet y sin lista guardada. Toca 'Offline' con conexión para guardarla.")
  }
  const a = snap.list.find((x) => x.cc === code || x.qr === code)
  if (!a) throw new Error("Asistente no encontrado en la lista guardada")

  if (a.in) {
    const err = new Error("ALREADY_CHECKED_IN") as Error & { attendee?: unknown }
    err.attendee = {
      id: a.id,
      name: a.name,
      cc: a.cc,
      checkedInAt: a.at,
      categoryName: a.cat,
      checkedInByName: a.by || "Desconocido",
    }
    throw err
  }

  const now = new Date().toISOString()
  a.in = true
  a.at = now
  a.by = "Este dispositivo (offline)"
  await saveSnapshot(eventId, snap.list, snap.savedAt)
  await addPending({ eventId, code, at: now })
  return { data: { id: a.id, name: a.name, cc: a.cc, category: a.cat ? { name: a.cat } : null }, offline: true }
}

/** Envía los check-ins pendientes. 409 (ya ingresó) y 404 cuentan como resueltos. */
export async function syncPending(): Promise<{ sent: number; left: number }> {
  const items = await listPending()
  let sent = 0
  for (const p of items) {
    try {
      const res = await fetch("/api/attendees/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeOrCc: p.code, eventId: p.eventId }),
      })
      if (res.ok || res.status === 409 || res.status === 404) {
        await removePending(p.key as number)
        sent++
      } else if (res.status === 401) {
        break // sesión vencida: reintentar luego
      }
    } catch {
      break // sigue sin red
    }
  }
  return { sent, left: items.length - sent }
}

/** Errores de red de fetch (TypeError) o sin conexión. */
export function isNetworkError(e: unknown) {
  return e instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false)
}
