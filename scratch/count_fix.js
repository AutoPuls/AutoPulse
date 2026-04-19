const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.listing.count({
    where: {
      OR: [
        { mileage: null },
        { description: { contains: 'captured' } }
      ]
    }
  });
  console.log('LISTINGS_TO_FIX:', count);
  await prisma.$disconnect();
}

main().catch(console.error);
