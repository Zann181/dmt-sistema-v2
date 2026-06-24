export function formatThousands(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return ""
  // Remove everything except digits
  const clean = String(value).replace(/\D/g, "")
  if (clean === "") return ""
  return Number(clean).toLocaleString("de-DE") // de-DE uses dots for thousands
}

export function parseThousands(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0
  if (typeof value === "number") return value
  // Remove all dots
  const clean = value.replace(/\./g, "")
  return Number(clean) || 0
}
