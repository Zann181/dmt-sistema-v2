import "dotenv/config";
import { defineConfig } from "prisma/config";

// Las migraciones necesitan conexión directa a Neon (sin el pooler):
// DATABASE_URL_UNPOOLED la crea la integración Neon de Vercel. En local, si solo
// existe DATABASE_URL (p. ej. Postgres de docker-compose), se usa esa.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});
