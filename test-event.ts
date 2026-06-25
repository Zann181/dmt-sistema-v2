const { prisma } = require('./src/infrastructure/database/prisma.ts');

async function main() {
  try {
    const updated = await prisma.event.update({
      where: { id: "cmqs3xahg0000agvf81tu8wxb" },
      data: {
        name: "17 Julio",
        description: "",
        startsAt: new Date("2026-09-18T02:00:00.000Z"),
        endsAt: new Date("2026-07-18T11:00:00.000Z"),
        status: "DRAFT",
        qrPrefix: "EVT",
        qrFillColor: "#000000",
        qrBackgroundColor: "#ffffff",
        qrLogoBackgroundColor: "#000000",
        qrLogoScale: 4,
        logoUrl: "",
        qrLogoUrl: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 500 500\" width=\"100%\" height=\"100%\"> <image href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA\" /></svg>"
      }
    });
    console.log("Success:", updated.id);
  } catch (e) {
    console.error("Error updating event:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
