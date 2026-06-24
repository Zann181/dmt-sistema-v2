import { NextResponse } from "next/server"
import { prisma } from "@/infrastructure/database/prisma"

export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ qrCode: string }> }
) {
  const { qrCode } = await params

  try {
    const attendee = await prisma.attendee.findUnique({
      where: { qrCode },
      include: {
        event: { select: { name: true } },
        category: { select: { name: true } },
      },
    })

    if (!attendee) {
      return NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        name: attendee.name,
        eventName: attendee.event.name,
        categoryName: attendee.category.name,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
