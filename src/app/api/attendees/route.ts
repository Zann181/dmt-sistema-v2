import { NextResponse, after } from "next/server"
import { randomBytes } from "node:crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/infrastructure/database/prisma"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { apiError } from "@/shared/errors/apiError"
import { requireBranchPermission } from "@/shared/guards/branchAccess"
import { kickEmailWorker } from "@/domains/attendee/services/TicketEmailQueue"

const attendeeSchema = z.object({
  name: z.string().min(1).max(120),
  cc: z.string().min(1).max(32),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  categoryId: z.string(),
  paidAmount: z.number().min(0),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const url = new URL(req.url)
    const branchId = url.searchParams.get("branchId") || session.user.activeBranchId
    const eventId = url.searchParams.get("eventId") || session.user.activeEventId

    if (!branchId || !eventId) return NextResponse.json({ data: [] })

    const access = await requireBranchPermission(session, branchId, "accessAttendees", eventId)
    if (access instanceof NextResponse) return access

    const q = url.searchParams.get("q") || ""
    const categoryId = url.searchParams.get("categoryId") || ""
    const status = url.searchParams.get("status") || "all"
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1), 100)
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0)

    const statsOnly = url.searchParams.get("stats") === "true"
    if (statsOnly) {
      if (!branchId || !eventId) return NextResponse.json({ error: "Contexto incompleto" }, { status: 400 })

      // Agregado en la base: no se descargan todos los asistentes en cada consulta
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const activeWhere = { branchId, eventId, inactiveAt: null }
      const [cats, groups, todayAgg] = await Promise.all([
        prisma.attendeeCategory.findMany({ where: { branchId } }),
        prisma.attendee.groupBy({
          by: ["categoryId", "hasCheckedIn"],
          where: activeWhere,
          _count: { _all: true },
          _sum: { paidAmount: true },
        }),
        prisma.attendee.aggregate({
          where: { ...activeWhere, createdAt: { gte: today } },
          _sum: { paidAmount: true },
        }),
      ])

      const totalCount = groups.reduce((s, g) => s + g._count._all, 0)
      const checkedInCount = groups.filter((g) => g.hasCheckedIn).reduce((s, g) => s + g._count._all, 0)
      const pendingCount = totalCount - checkedInCount
      const totalIncome = groups.reduce((s, g) => s + Number(g._sum.paidAmount ?? 0), 0)
      const todayIncome = Number(todayAgg._sum.paidAmount ?? 0)

      const categoryStats = cats.map((c: any) => {
        const mine = groups.filter((g) => g.categoryId === c.id)
        const total = mine.reduce((s, g) => s + g._count._all, 0)
        const checkedIn = mine.filter((g) => g.hasCheckedIn).reduce((s, g) => s + g._count._all, 0)
        return {
          id: c.id,
          name: c.name,
          price: Number(c.price),
          total,
          checkedIn,
          pending: total - checkedIn,
          income: mine.reduce((s, g) => s + Number(g._sum.paidAmount ?? 0), 0),
        }
      })

      return NextResponse.json({
        data: {
          totalCount,
          checkedInCount,
          pendingCount,
          totalIncome,
          todayIncome,
          categoryStats
        }
      })
    }
    
    // Los inactivos ("eliminados") solo los ve el super admin, con el filtro Inactivos.
    const canSeeInactive = !!session.user.isSuperuser
    const showInactive = canSeeInactive && status === "inactive"

    const where = {
      branchId,
      eventId,
      inactiveAt: showInactive ? { not: null } : null,
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { cc: { contains: q, mode: "insensitive" as const } }
        ]
      } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(status === "checked" ? { hasCheckedIn: true } : {}),
      ...(status === "pending" ? { hasCheckedIn: false } : {})
    }

    // Los pendientes de entrega ("Sin enviar" en amarillo) van primero en toda la
    // búsqueda (no solo dentro de la página actual) hasta que se les confirme el envío.
    // Los ingresos del día (Ingreso Día, sin QR que entregar) nunca cuentan como
    // pendientes y van al final de la lista.
    // La MockPrisma de desarrollo offline no implementa $queryRaw, así que en ese
    // modo se cae a ordenar en JS dentro de la página como antes.
    const sortRank = (a: any) => {
      if (a.origin === "EVENT_DAY") return 2
      return !a.emailSentAt && !a.qrDeliveredManuallyAt ? 0 : 1
    }
    const sortPendingFirst = (list: any[]) => [...list].sort((a: any, b: any) => sortRank(a) - sortRank(b))

    let attendees: any[]
    let total: number

    if (typeof (prisma as any).$queryRaw === "function") {
      const conditions: Prisma.Sql[] = [
        Prisma.sql`"branchId" = ${branchId}`,
        Prisma.sql`"eventId" = ${eventId}`,
        showInactive ? Prisma.sql`"inactiveAt" IS NOT NULL` : Prisma.sql`"inactiveAt" IS NULL`
      ]
      if (q) conditions.push(Prisma.sql`(name ILIKE ${`%${q}%`} OR cc ILIKE ${`%${q}%`})`)
      if (categoryId) conditions.push(Prisma.sql`"categoryId" = ${categoryId}`)
      if (status === "checked") conditions.push(Prisma.sql`"hasCheckedIn" = true`)
      if (status === "pending") conditions.push(Prisma.sql`"hasCheckedIn" = false`)

      const orderedIdsQuery = prisma.$queryRaw`
        SELECT id FROM attendees
        WHERE ${Prisma.join(conditions, " AND ")}
        ORDER BY (CASE
                    WHEN origin = 'EVENT_DAY' THEN 2
                    WHEN "emailSentAt" IS NULL AND "qrDeliveredManuallyAt" IS NULL THEN 0
                    ELSE 1
                  END) ASC,
                 "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      ` as Promise<{ id: string }[]>
      const [orderedIds, count] = await Promise.all([
        orderedIdsQuery,
        prisma.attendee.count({ where })
      ])

      const ids: string[] = orderedIds.map((r) => r.id)
      const unordered = await prisma.attendee.findMany({
        where: { id: { in: ids } },
        include: { category: true }
      })
      const rank = new Map(ids.map((id, i) => [id, i]))
      attendees = unordered.sort((a: any, b: any) => rank.get(a.id)! - rank.get(b.id)!)
      total = count
    } else {
      const [rows, count] = await Promise.all([
        prisma.attendee.findMany({ where, include: { category: true }, orderBy: { createdAt: "desc" } }),
        prisma.attendee.count({ where })
      ])
      attendees = sortPendingFirst(rows).slice(offset, offset + limit)
      total = count
    }

    return NextResponse.json({ data: attendees, total, limit, offset })
  } catch (err) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = attendeeSchema.parse(body)

    const branchId = body.branchId || session.user.activeBranchId
    const eventId = body.eventId || session.user.activeEventId

    if (!branchId || !eventId) return NextResponse.json({ error: "Contexto incompleto" }, { status: 400 })

    const access = await requireBranchPermission(session, branchId, "accessAttendees", eventId)
    if (access instanceof NextResponse) return access

    const categoryOk = await prisma.attendeeCategory.findFirst({ where: { id: parsed.categoryId, branchId }, select: { id: true } })
    if (!categoryOk) return NextResponse.json({ error: "Categoría no válida para esta sucursal" }, { status: 400 })

    const existingAttendee = await prisma.attendee.findUnique({
      where: {
        eventId_cc: {
          eventId,
          cc: parsed.cc,
        },
      },
    })
    if (existingAttendee) {
      return NextResponse.json(
        { error: existingAttendee.inactiveAt ? `La cédula ${parsed.cc} está inactiva en este evento; pide al super admin que la reactive` : `La cédula ${parsed.cc} ya está registrada para este evento` },
        { status: 400 }
      )
    }

    const category = await prisma.attendeeCategory.findUnique({ where: { id: parsed.categoryId } })
    if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 400 })

    const branch = await prisma.branch.findUnique({ where: { id: branchId } })
    const event = await prisma.event.findUnique({ where: { id: eventId }, include: { branch: true } })
    if (!branch || !event) return NextResponse.json({ error: "Error de contexto" }, { status: 400 })

    // Aleatoriedad criptográfica: el código QR da acceso a la tarjeta pública del asistente
    const uniqueId = randomBytes(5).toString("hex")
    const qrCode = `${branch.codePrefix}-${event.slug.substring(0, 5).toUpperCase()}-${uniqueId}`

    const userExists = session.user.id
      ? await prisma.user.findUnique({ where: { id: session.user.id } })
      : null
    const createdById = userExists ? session.user.id : null

    const attendee = await prisma.attendee.create({
      data: {
        ...parsed,
        branchId,
        eventId,
        createdById,
        origin: "MANUAL",
        qrCode,
        includedBalance: category.includedConsumptions,
        hasCheckedIn: false,
        paidAmount: parsed.paidAmount,
      }
    })

    // El ticket por correo no se envía aquí: el asistente con email y emailSentAt vacío
    // ya está en la cola, y el navegador la despacha de a uno con /api/attendees/email-queue.
    if (parsed.email) after(() => kickEmailWorker())
    return NextResponse.json({ data: attendee, queued: !!parsed.email })
  } catch (err: any) {
    return apiError(err)
  }
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Falta ID del asistente" }, { status: 400 })

    const body = await req.json()
    const parsed = attendeeSchema.partial().parse(body)

    const attendee = await prisma.attendee.findUnique({ where: { id } })
    if (!attendee) return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 })
    const access = await requireBranchPermission(session, attendee.branchId, "accessAttendees", attendee.eventId)
    if (access instanceof NextResponse) return access

    if (parsed.categoryId) {
      const categoryOk = await prisma.attendeeCategory.findFirst({ where: { id: parsed.categoryId, branchId: attendee.branchId }, select: { id: true } })
      if (!categoryOk) return NextResponse.json({ error: "Categoría no válida para esta sucursal" }, { status: 400 })
    }

    if (parsed.cc) {
      const existingAttendee = await prisma.attendee.findFirst({
        where: {
          eventId: attendee.eventId,
          cc: parsed.cc,
          id: { not: id }
        }
      })
      if (existingAttendee) {
        return NextResponse.json({ error: `La cédula ${parsed.cc} ya está registrada para este evento` }, { status: 400 })
      }
    }

    const updated = await prisma.attendee.update({
      where: { id },
      data: parsed
    })

    return NextResponse.json({ data: updated })
  } catch (err: any) {
    return apiError(err, 500)
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Falta ID del asistente" }, { status: 400 })

    const attendee = await prisma.attendee.findUnique({ where: { id }, select: { branchId: true, eventId: true } })
    if (!attendee) return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 })
    const access = await requireBranchPermission(session, attendee.branchId, "accessAttendees", attendee.eventId)
    if (access instanceof NextResponse) return access

    // Soft delete: no se borra, queda inactivo (solo visible para el super admin)
    await prisma.attendee.update({
      where: { id },
      data: { inactiveAt: new Date() }
    })

    return NextResponse.json({ message: "Asistente desactivado con éxito" })
  } catch (err: any) {
    return apiError(err, 500)
  }
}

// Reactivar un asistente inactivo: solo super admin
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.isSuperuser) return NextResponse.json({ error: "Solo el super admin puede reactivar asistentes" }, { status: 403 })

  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Falta ID del asistente" }, { status: 400 })

    const attendee = await prisma.attendee.findUnique({ where: { id }, select: { id: true } })
    if (!attendee) return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 })

    const updated = await prisma.attendee.update({ where: { id }, data: { inactiveAt: null } })
    return NextResponse.json({ data: updated })
  } catch (err: any) {
    return apiError(err, 500)
  }
}
