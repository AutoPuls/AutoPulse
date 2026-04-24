import { PrismaClient } from "@prisma/client";
import { isJunkTitle } from "../lib/parser/listingParser";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("🛠️ Starting database prune (removing non-cars)...");
  
  const listings = await prisma.listing.findMany({
    select: {
      id: true,
      rawTitle: true,
      description: true,
      make: true,
      model: true,
    }
  });

  console.log(`Analyzing ${listings.length} listings...`);
  
  const idsToDelete: string[] = [];

  for (const listing of listings) {
    const title = listing.rawTitle || "";
    const desc = listing.description || "";
    
    // Check if it matches junk patterns
    if (isJunkTitle(title, desc)) {
      idsToDelete.push(listing.id);
    } else if (listing.make === "Unknown" && (title.toLowerCase().includes("atv") || title.toLowerCase().includes("boat"))) {
        // Extra fallback for obvious ones
        idsToDelete.push(listing.id);
    }
  }

  console.log(`Found ${idsToDelete.length} junk listings to remove.`);
  
  if (idsToDelete.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
      const batch = idsToDelete.slice(i, i + BATCH_SIZE);
      await prisma.listing.deleteMany({
        where: { id: { in: batch } }
      });
      console.log(`Deleted ${Math.min(i + BATCH_SIZE, idsToDelete.length)}/${idsToDelete.length}...`);
    }
  }

  console.log(`✅ Success! Database is now car-only.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
