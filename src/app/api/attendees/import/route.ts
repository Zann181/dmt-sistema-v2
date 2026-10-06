import { NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"
import { processPendingTicketEmails } from "@/domains/attendee/services/TicketEmailQueue"

const importRowSchema = z.object({
  name: z.string().min(1).max(120),
  cc: z.string().min(1).max(32),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
})

const importSchema = z.object({
  branchId: z.string().min(1),
  eventId: z.string().min(1),
  categoryId: z.string().min(1),
  rows: z.array(importRowSchema).min(1).max(2000),
})

// Los correos que no alcancen en este tope quedan en cola y el navegador los
// despacha en tandas cortas: ninguna función corre minutos.
export const maxDuration = 60
const IMPORT_EMAIL_BUDGET_MS = 40_000

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: any
  let parsed: z.infer<typeof importSchema>
  try {
    body = await req.json()
    parsed = importSchema.parse(body)
  } catch (err: any) {
    return apiError(err)
  }

  const access = await requireBranchPermission(session, parsed.branchId, "accessAttendees", parsed.eventId)
  if (access instanceof NextResponse) return access

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: any) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))

      try {
        await runImport(parsed, session.user.id, emit)
      } catch (err: any) {
        emit({ type: "error", message: err.message || "Error al importar" })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" }
  })
}

async function runImport(
  parsed: z.infer<typeof importSchema>,
  sessionUserId: string | undefined,
  emit: (obj: any) => void
) {
  const category = await prisma.attendeeCategory.findUnique({ where: { id: parsed.categoryId } })
  if (!category || category.branchId !== parsed.branchId) { emit({ type: "error", message: "Categoría no encontrada" }); return }

  const branch = await prisma.branch.findUnique({ where: { id: parsed.branchId }, select: { codePrefix: true } })
  const event = await prisma.event.findUnique({ where: { id: parsed.eventId }, select: { slug: true } })
  if (!branch || !event) { emit({ type: "error", message: "Error de contexto" }); return }

  const total = parsed.rows.length

  // 1) Registrar a todos en lote: una consulta para saber quién ya existe y una
  //    inserción para los nuevos (antes eran 2 consultas por fila).
  const rows = parsed.rows
    .map((r) => ({ cc: r.cc.trim(), name: r.name.trim(), email: r.email?.trim() || null, phone: r.phone?.trim() || null }))
    .filter((r) => r.cc && r.name)
  const existing = new Set(
    (await prisma.attendee.findMany({
      where: { eventId: parsed.eventId, cc: { in: rows.map((r) => r.cc) } },
      select: { cc: true },
    })).map((a) => a.cc)
  )

  const toCreate: typeof rows = []
  for (const r of rows) {
    if (existing.has(r.cc)) continue // ya registrado: se ignora, no se reenvía nada
    existing.add(r.cc)               // cédula repetida dentro del mismo archivo
    toCreate.push(r)
  }
  const skipped = total - toCreate.length

  const prefix = `${branch.codePrefix}-${event.slug.substring(0, 5).toUpperCase()}`
  await prisma.attendee.createMany({
    data: toCreate.map((r) => ({
      name: r.name,
      cc: r.cc,
      phone: r.phone,
      email: r.email,
      branchId: parsed.branchId,
      eventId: parsed.eventId,
      categoryId: parsed.categoryId,
      createdById: sessionUserId ?? null,
      origin: "MANUAL" as const,
      // Aleatoriedad criptográfica: el código QR da acceso a la tarjeta pública del asistente
      qrCode: `${prefix}-${randomBytes(5).toString("hex")}`,
      includedBalance: category.includedConsumptions,
      hasCheckedIn: false,
      paidAmount: category.price,
    })),
  })

  let processed = 0
  let noEmailCount = 0
  for (const r of toCreate) {
    processed++
    if (!r.email) noEmailCount++
    emit({ type: "progress", processed, total, cc: r.cc, name: r.name, email: r.email, status: "created", emailStatus: r.email ? "queued" : "no_email" })
  }

  // 2) Correos: lo que alcance en este tope; el resto queda en la cola (emailSentAt
  //    vacío) y el navegador lo despacha en tandas con /api/attendees/email-queue.
  const { sent, failed, remaining } = await processPendingTicketEmails({
    branchId: parsed.branchId,
    eventId: parsed.eventId,
    deadline: Date.now() + IMPORT_EMAIL_BUDGET_MS,
    max: toCreate.length,
    onProgress: (p) => emit({ type: "progress", processed, total, cc: p.cc, name: p.name, email: p.email, status: "created", emailStatus: p.status, error: p.error }),
  })

  emit({
    type: "summary",
    summary: {
      created: toCreate.length,
      skipped,
      emailsSent: sent,
      noEmailCount,
      emailFailedCount: failed.length,
      failedIds: failed.map((f) => f.id),
      pendingEmails: remaining,
      total,
    }
  })
}
