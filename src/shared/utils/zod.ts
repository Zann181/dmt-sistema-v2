import { ZodError, ZodIssue } from "zod"

export function formatZodError(error: ZodError): string {
  return error.issues.map((issue: ZodIssue) => {
    const field = String(issue.path[issue.path.length - 1] || "campo")
    let message = issue.message
    const anyIssue = issue as any

    // Translate typical Zod error messages to clear Spanish
    if (issue.code === "invalid_format") {
      if (anyIssue.format === "email") {
        message = "Dirección de correo electrónico inválida"
      } else {
        message = "El formato no es válido"
      }
    } else if (issue.code === "too_small") {
      if (anyIssue.type === "string") {
        if (anyIssue.minimum === 1) {
          message = "Este campo es requerido"
        } else {
          message = `Debe tener al menos ${anyIssue.minimum} caracteres`
        }
      } else if (anyIssue.type === "number") {
        message = `Debe ser mayor o igual a ${anyIssue.minimum}`
      }
    } else if (issue.code === "too_big") {
      if (anyIssue.type === "string") {
        message = `No debe exceder los ${anyIssue.maximum} caracteres`
      } else if (anyIssue.type === "number") {
        message = `Debe ser menor o igual a ${anyIssue.maximum}`
      }
    } else if (issue.code === "invalid_type") {
      if (anyIssue.received === "undefined" || anyIssue.received === "null") {
        message = "Este campo es requerido"
      } else {
        message = `Tipo de dato inválido (se esperaba ${anyIssue.expected}, recibido ${anyIssue.received})`
      }
    }

    return `${field}: ${message}`
  }).join(", ")
}
