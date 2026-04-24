import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const keywords = [
    "motorcycle", "moto", "bike", "bicycle", "boat", "vessel", "yacht", "atv", "utv", 
    "kawasaki", "yamaha", "harley", "honda shadow", "honda cbr", "suzuki gsxr",
    "seadoo", "sea-doo", "polaris", "can-am", "canam", "rzr", "tractor", "mower",
    "trailer", "rv", "camper", "jetski", "jet ski"
  ];

  console.log("🔍 Scanning database for suspicious keywords...");
  
  const listings = await prisma.listing.findMany({
    where: {
      OR: keywords.map(k => ({
        OR: [
          { rawTitle: { contains: k, mode: 'insensitive' } },
          { description: { contains: k, mode: 'insensitive' } }
        ]
      }))
    },
    select: {
      id: true,
      rawTitle: true,
      make: true,
      model: true
    }
  });

  console.log(`Found ${listings.length} matches.`);
  listings.forEach(l => {
    console.log(`[${l.id}] ${l.rawTitle} (${l.make} ${l.model})`);
  });
}

main().finally(() => prisma.$disconnect());
