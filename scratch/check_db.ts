import { prisma } from './lib/db';

async function check() {
  try {
    const count = await prisma.listing.count();
    console.log(`Total listings in database: ${count}`);
    const latest = await prisma.listing.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    console.log(`Latest listing: ${JSON.stringify(latest, null, 2)}`);
  } catch (e) {
    console.error('Database check failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
