import { prisma } from "@/infrastructure/database/prisma"

export class AttendeeService {
  static async findByQrOrCc(value: string, eventId: string) {
    return prisma.attendee.findFirst({
      where: {
        eventId,
        OR: [{ cc: value }, { qrCode: value }]
      },
      include: {
        category: true
      }
    })
  }

  static async checkIn(qrCodeOrCc: string, eventId: string, checkedInById: string) {
    const attendee = await this.findByQrOrCc(qrCodeOrCc, eventId)
    if (!attendee) {
      throw new Error("Asistente no encontrado en este evento")
    }

    if (attendee.hasCheckedIn) {
      // Idempotente, retorna sin error si ya está checked in, o podríamos retornar un warning
      return attendee
    }

    const userExists = checkedInById ? await prisma.user.findUnique({ where: { id: checkedInById } }) : null
    const validCheckedInById = userExists ? checkedInById : null

    return prisma.attendee.update({
      where: { id: attendee.id },
      data: {
        hasCheckedIn: true,
        checkedInAt: new Date(),
        checkedInById: validCheckedInById
      },
      include: {
        category: true
      }
    })
  }
}
