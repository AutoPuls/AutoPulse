const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
dotenv.config();

const prisma = new PrismaClient();

async function check() {
  try {
    const count = await prisma.listing.count();
    console.log(`Total listings in database: ${count}`);
    const latest = await prisma.listing.findFirst({
      orderBy: { createdAt: 'desc' },
      take: 1
    });
    if (latest) {
      console.log(`Latest listing: ${latest.make} ${latest.model} (${latest.year})`);
    } else {
      console.log('No listings found.');
    }
  } catch (e) {
    console.error('Database check failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
