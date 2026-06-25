const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const branches = await prisma.branch.findMany({
    select: {
      id: true,
      name: true,
      logoUrl: true
    }
  })
  console.log("Branches:")
  console.log(JSON.stringify(branches, null, 2))

  const events = await prisma.event.findMany({
    select: {
      id: true,
      name: true,
      qrLogoUrl: true,
      branchId: true
    }
  })
  console.log("Events:")
  console.log(JSON.stringify(events, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
