import "dotenv/config"
import { prisma } from "../src/infrastructure/database/prisma"
import bcrypt from "bcryptjs"

async function main() {
  const passwordHash = await bcrypt.hash("CambiarEstaContraseña123!", 12)

  // 1. Crear Sucursal
  const branch = await prisma.branch.upsert({
    where: { slug: "sucursal-norte" },
    update: {
      primaryColor: "#39ff14",
      secondaryColor: "#e9ffe9",
      pageBackgroundColor: "#050505",
      surfaceColor: "#0f1113",
      panelColor: "#15181c",
    },
    create: {
      id: "br_1",
      name: "Sucursal Norte",
      slug: "sucursal-norte",
      codePrefix: "NOR",
      primaryColor: "#39ff14",
      secondaryColor: "#e9ffe9",
      pageBackgroundColor: "#050505",
      surfaceColor: "#0f1113",
      panelColor: "#15181c",
      isActive: true,
    },
  })

  // 2. Crear Evento
  const event = await prisma.event.upsert({
    where: { branchId_slug: { branchId: "br_1", slug: "gran-apertura" } },
    update: {},
    create: {
      id: "ev_1",
      branchId: "br_1",
      name: "Gran Apertura",
      slug: "gran-apertura",
      description: "Inauguración de la sucursal Norte",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 86400000 * 2),
      status: "ACTIVE",
    },
  })

  // 3. Crear Categoría de Asistente
  const category = await prisma.attendeeCategory.upsert({
    where: { branchId_name: { branchId: "br_1", name: "VIP" } },
    update: {},
    create: {
      id: "cat_1",
      branchId: "br_1",
      name: "VIP",
      includedConsumptions: 2,
      price: 15000,
      description: "Acceso preferencial",
      isActive: true,
    },
  })

  // 4. Crear Asistente de Prueba
  await prisma.attendee.upsert({
    where: { eventId_cc: { eventId: "ev_1", cc: "12345678" } },
    update: {},
    create: {
      id: "att_1",
      branchId: "br_1",
      eventId: "ev_1",
      categoryId: "cat_1",
      name: "Juan Perez",
      cc: "12345678",
      paidAmount: 15000,
      qrCode: "NOR-GRAN-123456",
      hasCheckedIn: false,
      includedBalance: 2,
    },
  })

  // 5. Crear Productos
  await prisma.product.upsert({
    where: { id: "prod_1" },
    update: {},
    create: {
      id: "prod_1",
      branchId: "br_1",
      name: "Cerveza Club",
      price: 3500,
      isActive: true,
    },
  })
  await prisma.product.upsert({
    where: { id: "prod_2" },
    update: {},
    create: {
      id: "prod_2",
      branchId: "br_1",
      name: "Ron Medellín 1/2",
      price: 45000,
      isActive: true,
    },
  })

  // 6. Crear Usuarios y Asignar Roles
  // Admin Global
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      email: "admin@dmt.com",
      firstName: "Admin",
      lastName: "Global",
      passwordHash,
      isSuperuser: true,
      isGlobalAdmin: true,
      isActive: true,
    },
  })

  // Admin Sucursal
  const branchAdmin = await prisma.user.upsert({
    where: { username: "branch_admin" },
    update: {},
    create: {
      username: "branch_admin",
      email: "branch@dmt.com",
      firstName: "Admin",
      lastName: "Sucursal",
      passwordHash,
      isActive: true,
    },
  })
  await prisma.branchMembership.upsert({
    where: { userId_branchId: { userId: branchAdmin.id, branchId: "br_1" } },
    update: {},
    create: {
      userId: branchAdmin.id,
      branchId: "br_1",
      role: "BRANCH_ADMIN",
      isActive: true,
    },
  })

  // Admin Evento
  const eventAdmin = await prisma.user.upsert({
    where: { username: "event_admin" },
    update: {},
    create: {
      username: "event_admin",
      email: "event@dmt.com",
      firstName: "Admin",
      lastName: "Evento",
      passwordHash,
      isActive: true,
    },
  })
  await prisma.branchMembership.upsert({
    where: { userId_branchId: { userId: eventAdmin.id, branchId: "br_1" } },
    update: {},
    create: {
      userId: eventAdmin.id,
      branchId: "br_1",
      role: "EVENT_ADMIN",
      isActive: true,
    },
  })
  await prisma.eventAssignment.upsert({
    where: { userId_eventId: { userId: eventAdmin.id, eventId: "ev_1" } },
    update: {},
    create: {
      userId: eventAdmin.id,
      branchId: "br_1",
      eventId: "ev_1",
      role: "EVENT_ADMIN",
      isActive: true,
    },
  })

  // Staff Entrada
  const entranceStaff = await prisma.user.upsert({
    where: { username: "entrance_staff" },
    update: {},
    create: {
      username: "entrance_staff",
      email: "entrance@dmt.com",
      firstName: "Staff",
      lastName: "Entrada",
      passwordHash,
      isActive: true,
    },
  })
  await prisma.branchMembership.upsert({
    where: { userId_branchId: { userId: entranceStaff.id, branchId: "br_1" } },
    update: {},
    create: {
      userId: entranceStaff.id,
      branchId: "br_1",
      role: "ENTRANCE",
      isActive: true,
    },
  })
  await prisma.eventAssignment.upsert({
    where: { userId_eventId: { userId: entranceStaff.id, eventId: "ev_1" } },
    update: {},
    create: {
      userId: entranceStaff.id,
      branchId: "br_1",
      eventId: "ev_1",
      role: "ENTRANCE",
      isActive: true,
    },
  })

  // Staff Barra
  const barStaff = await prisma.user.upsert({
    where: { username: "bar_staff" },
    update: {},
    create: {
      username: "bar_staff",
      email: "bar@dmt.com",
      firstName: "Staff",
      lastName: "Barra",
      passwordHash,
      isActive: true,
    },
  })
  await prisma.branchMembership.upsert({
    where: { userId_branchId: { userId: barStaff.id, branchId: "br_1" } },
    update: {},
    create: {
      userId: barStaff.id,
      branchId: "br_1",
      role: "BAR",
      isActive: true,
    },
  })
  await prisma.eventAssignment.upsert({
    where: { userId_eventId: { userId: barStaff.id, eventId: "ev_1" } },
    update: {},
    create: {
      userId: barStaff.id,
      branchId: "br_1",
      eventId: "ev_1",
      role: "BAR",
      isActive: true,
    },
  })

  console.log("✅ Predetermined users seeded successfully!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
