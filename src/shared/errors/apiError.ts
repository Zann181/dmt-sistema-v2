import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { formatZodError } from "@/shared/utils/zod"

// Solo los `new Error("...")` lanzados por nuestro código ("Asistente no encontrado",
// etc.) se muestran al usuario. Cualquier subclase (Prisma, driver de Postgres,
// TypeError...) trae detalles internos — tablas, queries, hosts — y se oculta.
function isUserFacing(error: unknown): error is Error {
  return error instanceof Error && error.constructor === Error && error.name === "Error" && !!error.message
}

export function apiError(error: unknown, status = 400, fallback = "Error interno del servidor") {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: formatZodError(error) }, { status: 400 })
  }
  if (error instanceof SyntaxError) {
    // req.json() con un cuerpo que no es JSON válido
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 })
  }
  if (!isUserFacing(error)) {
    console.error("[API ERROR]", error)
    return NextResponse.json({ error: fallback }, { status: 500 })
  }
  return NextResponse.json({ error: error.message }, { status })
}
