import { prisma } from "@/infrastructure/database/prisma"

export class EventService {
  static validateDateRange(startsAt: Date, endsAt: Date): boolean {
    return endsAt.getTime() >= startsAt.getTime()
  }

  static generateUniqueSlug(name: string, existingSlugs: string[]): string {
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    let slug = baseSlug
    let counter = 1
    while (existingSlugs.includes(slug)) {
      slug = `${baseSlug}-${counter}`
      counter++
    }
    return slug
  }

  static renderEmailTemplate(templateText: string, vars: Record<string, string>): string {
    let rendered = templateText
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`{${key}}`, "g")
      rendered = rendered.replace(regex, value)
    }
    return rendered
  }
}
