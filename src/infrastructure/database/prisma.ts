import { PrismaClient } from "@prisma/client"
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import ws from "ws"
import bcrypt from "bcryptjs"
import { Pool as PgPool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"

neonConfig.webSocketConstructor = ws

const globalForPrisma = globalThis as unknown as { prisma: any }
const connectionString = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy"

// In-Memory Mock Database for offline development
class MockPrisma {
  private tables: Record<string, any[]> = {
    user: [
      {
        id: "usr_admin",
        username: "admin",
        email: "admin@dmt.com",
        firstName: "Admin",
        lastName: "Global",
        passwordHash: bcrypt.hashSync("CambiarEstaContraseña123!", 10),
        isSuperuser: true,
        isGlobalAdmin: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "usr_branch_admin",
        username: "branch_admin",
        email: "branch@dmt.com",
        firstName: "Admin",
        lastName: "Sucursal",
        passwordHash: bcrypt.hashSync("CambiarEstaContraseña123!", 10),
        isSuperuser: false,
        isGlobalAdmin: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "usr_event_admin",
        username: "event_admin",
        email: "event@dmt.com",
        firstName: "Admin",
        lastName: "Evento",
        passwordHash: bcrypt.hashSync("CambiarEstaContraseña123!", 10),
        isSuperuser: false,
        isGlobalAdmin: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "usr_entrance_staff",
        username: "entrance_staff",
        email: "entrance@dmt.com",
        firstName: "Staff",
        lastName: "Entrada",
        passwordHash: bcrypt.hashSync("CambiarEstaContraseña123!", 10),
        isSuperuser: false,
        isGlobalAdmin: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "usr_bar_staff",
        username: "bar_staff",
        email: "bar@dmt.com",
        firstName: "Staff",
        lastName: "Barra",
        passwordHash: bcrypt.hashSync("CambiarEstaContraseña123!", 10),
        isSuperuser: false,
        isGlobalAdmin: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ],
    branch: [
      {
        id: "br_1",
        name: "Sucursal Norte",
        slug: "sucursal-norte",
        codePrefix: "NOR",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ],
    branchmembership: [
      {
        id: "bm_1",
        userId: "usr_admin",
        branchId: "br_1",
        role: "BRANCH_ADMIN",
        isActive: true,
        createdAt: new Date()
      },
      {
        id: "bm_2",
        userId: "usr_branch_admin",
        branchId: "br_1",
        role: "BRANCH_ADMIN",
        isActive: true,
        createdAt: new Date()
      },
      {
        id: "bm_3",
        userId: "usr_event_admin",
        branchId: "br_1",
        role: "EVENT_ADMIN",
        isActive: true,
        createdAt: new Date()
      },
      {
        id: "bm_4",
        userId: "usr_entrance_staff",
        branchId: "br_1",
        role: "ENTRANCE",
        isActive: true,
        createdAt: new Date()
      },
      {
        id: "bm_5",
        userId: "usr_bar_staff",
        branchId: "br_1",
        role: "BAR",
        isActive: true,
        createdAt: new Date()
      }
    ],
    eventassignment: [
      {
        id: "ea_1",
        userId: "usr_event_admin",
        branchId: "br_1",
        eventId: "ev_1",
        role: "EVENT_ADMIN",
        isActive: true,
        createdAt: new Date()
      },
      {
        id: "ea_2",
        userId: "usr_entrance_staff",
        branchId: "br_1",
        eventId: "ev_1",
        role: "ENTRANCE",
        isActive: true,
        createdAt: new Date()
      },
      {
        id: "ea_3",
        userId: "usr_bar_staff",
        branchId: "br_1",
        eventId: "ev_1",
        role: "BAR",
        isActive: true,
        createdAt: new Date()
      }
    ],
    event: [
      {
        id: "ev_1",
        branchId: "br_1",
        name: "Gran Apertura",
        slug: "gran-apertura",
        description: "Inauguración de la sucursal Norte",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000 * 2),
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ],
    attendeeCategory: [
      {
        id: "cat_1",
        branchId: "br_1",
        name: "VIP",
        includedConsumptions: 2,
        price: 15000,
        description: "Acceso preferencial",
        isActive: true
      }
    ],
    attendee: [
      {
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
        createdAt: new Date()
      }
    ],
    product: [
      {
        id: "prod_1",
        branchId: "br_1",
        name: "Cerveza Club",
        price: 3500,
        isActive: true,
        createdAt: new Date()
      },
      {
        id: "prod_2",
        branchId: "br_1",
        name: "Ron Medellín 1/2",
        price: 45000,
        isActive: true,
        createdAt: new Date()
      }
    ]
  }

  async $connect() {}
  async $disconnect() {}

  constructor() {
    return new Proxy(this, {
      get: (target, prop: string, receiver) => {
        if (prop === "$transaction") {
          return async (fn: any) => fn(receiver)
        }
        if (prop in target) {
          return (target as any)[prop]
        }
        return target.getModelHandler(prop)
      }
    })
  }

  private getModelHandler(modelName: string) {
    const tableKey = modelName === "attendeeCategory" ? "attendeeCategory" : modelName.toLowerCase()
    if (!this.tables[tableKey]) {
      this.tables[tableKey] = []
    }
    const table = this.tables[tableKey]
    return {
      findMany: async (args: any) => {
        let result = [...table]
        if (args?.where) {
          result = result.filter(item => this.matchWhere(item, args.where))
        }
        if (args?.include) {
          result = result.map(item => this.applyIncludes(item, args.include))
        }
        return result
      },
      findUnique: async (args: any) => {
        const item = table.find(i => this.matchWhere(i, args.where))
        return item ? this.applyIncludes(item, args.include) : null
      },
      findFirst: async (args: any) => {
        const item = table.find(i => this.matchWhere(i, args.where))
        return item ? this.applyIncludes(item, args.include) : null
      },
      create: async (args: any) => {
        const newItem = {
          id: `mock_${Math.random().toString(36).substring(2, 11)}`,
          createdAt: new Date(),
          ...args.data
        }
        table.push(newItem)
        return newItem
      },
      createMany: async (args: any) => {
        const items = args.data.map((d: any) => ({
          id: `mock_${Math.random().toString(36).substring(2, 11)}`,
          createdAt: new Date(),
          ...d
        }))
        table.push(...items)
        return { count: items.length }
      },
      update: async (args: any) => {
        const index = table.findIndex(i => this.matchWhere(i, args.where))
        if (index === -1) throw new Error("Not found")
        table[index] = { ...table[index], ...args.data }
        return table[index]
      },
      upsert: async (args: any) => {
        const item = table.find(i => this.matchWhere(i, args.where))
        if (item) {
          Object.assign(item, args.update)
          return item
        } else {
          const newItem = {
            id: `mock_${Math.random().toString(36).substring(2, 11)}`,
            createdAt: new Date(),
            ...args.create
          }
          table.push(newItem)
          return newItem
        }
      },
      delete: async (args: any) => {
        const index = table.findIndex(i => this.matchWhere(i, args.where))
        if (index === -1) throw new Error("Not found")
        const deleted = table[index]
        table.splice(index, 1)
        return deleted
      },
      deleteMany: async (args: any) => {
        let count = 0
        for (let i = table.length - 1; i >= 0; i--) {
          if (this.matchWhere(table[i], args?.where)) {
            table.splice(i, 1)
            count++
          }
        }
        return { count }
      }
    }
  }

  private matchWhere(item: any, where: any): boolean {
    if (!where) return true
    for (const [key, value] of Object.entries(where)) {
      if (key.includes("_") && value && typeof value === "object") {
        const parts = key.split("_")
        const matchesAll = parts.every(part => item[part] === (value as any)[part])
        if (!matchesAll) return false
      } else if (value && typeof value === "object" && "in" in value) {
        if (!(value as any).in.includes(item[key])) return false
      } else if (value && typeof value === "object" && "contains" in value) {
        const itemVal = (item[key] || "").toLowerCase()
        const searchVal = ((value as any).contains || "").toLowerCase()
        if (!itemVal.includes(searchVal)) return false
      } else if (value && typeof value === "object" && "gt" in value) {
        if (!(item[key] > (value as any).gt)) return false
      } else if (key === "OR") {
        const conditions = value as any[]
        const matched = conditions.some(cond => this.matchWhere(item, cond))
        if (!matched) return false
      } else {
        if (item[key] !== value) return false
      }
    }
    return true
  }

  private applyIncludes(item: any, include: any): any {
    if (!item) return item
    const copy = { ...item }
    if (include?.category && copy.categoryId) {
      copy.category = this.tables.attendeeCategory.find(c => c.id === copy.categoryId)
    }
    if (include?.event && copy.eventId) {
      copy.event = this.tables.event.find(e => e.id === copy.eventId)
    }
    if (include?.createdBy && copy.createdById) {
      copy.createdBy = this.tables.user.find(u => u.id === copy.createdById)
    }
    if (include?.checkedInBy && copy.checkedInById) {
      copy.checkedInBy = this.tables.user.find(u => u.id === copy.checkedInById)
    }
    if (include?.branch && copy.branchId) {
      copy.branch = this.tables.branch.find(b => b.id === copy.branchId)
    }
    if (include?.branchMemberships) {
      const memberships = this.tables.branchmembership.filter(m => m.userId === copy.id)
      copy.branchMemberships = memberships.map(m => {
        const mCopy = { ...m }
        if (include.branchMemberships === true || include.branchMemberships.include?.branch) {
          mCopy.branch = this.tables.branch.find(b => b.id === m.branchId)
        }
        return mCopy
      })
    }
    if (include?.eventAssignments) {
      const assignments = this.tables.eventassignment.filter(a => a.userId === copy.id)
      copy.eventAssignments = assignments.map(a => {
        const aCopy = { ...a }
        if (include.eventAssignments === true || include.eventAssignments.include?.event) {
          aCopy.event = this.tables.event.find(e => e.id === a.eventId)
        }
        if (include.eventAssignments === true || include.eventAssignments.include?.branch) {
          aCopy.branch = this.tables.branch.find(b => b.id === a.branchId)
        }
        return aCopy
      })
    }
    if (include?.product && copy.productId) {
      const prodTable = this.tables.product || []
      copy.product = prodTable.find(p => p.id === copy.productId) || { name: "Mock Product" }
    }
    if (include?.payments) {
      const barPaymentsTable = this.tables.barsalepayment || []
      const cashPaymentsTable = this.tables.cashmovementpayment || []
      const barPayments = barPaymentsTable.filter((p: any) => p.saleId === copy.id)
      const cashPayments = cashPaymentsTable.filter((p: any) => p.movementId === copy.id)
      copy.payments = barPayments.length > 0 ? barPayments : cashPayments
    }
    return copy
  }
}

const isNeon = connectionString.includes("neon.tech")
const isDummy = connectionString.includes("dummy")

export const prisma =
  globalForPrisma.prisma || 
  (isDummy
    ? new MockPrisma()
    : isNeon
      ? new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
      : new PrismaClient({ adapter: new PrismaPg(new PgPool({ connectionString })) })
  )

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
