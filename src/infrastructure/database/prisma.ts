import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { attachDatabasePool } from "@vercel/functions"
import { Pool } from "pg"

// Conexión recomendada por Prisma 7 + Neon para Vercel (Fluid compute): un Pool TCP
// de node-postgres contra la URL *pooled* de Neon (DATABASE_URL), registrado con
// attachDatabasePool para que Vercel cierre las conexiones ociosas antes de
// suspender la instancia. Las migraciones usan DATABASE_URL_UNPOOLED (prisma.config.ts).

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  // Sin base de datos la app debe fallar a la vista, nunca servir datos de prueba.
  console.error("❌ DATABASE_URL no está definida: las consultas a la base de datos van a fallar.")
}

const isLocal = !!connectionString && /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString)

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  const pool = new Pool({
    connectionString,
    // Neon: TLS según el sslmode de la URL. Postgres local (docker-compose): sin TLS
    ...(isLocal ? { ssl: false } : {}),
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 15_000, // margen para el arranque en frío de Neon
  })
  attachDatabasePool(pool)
  return new PrismaClient({ adapter: new PrismaPg(pool) })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
