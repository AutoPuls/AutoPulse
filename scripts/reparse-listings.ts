import { PrismaClient } from "@prisma/client";
import { parseListingText } from "../lib/parser/listingParser";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting database-wide re-parsing...");
  
  const listings = await prisma.listing.findMany({
    select: {
      id: true,
      rawTitle: true,
      description: true,
      make: true,
      model: true,
      year: true,
    }
  });

  console.log(`Found ${listings.length} listings to process.`);
  
  let updatedCount = 0;
  let batch = [];
  const BATCH_SIZE = 50;

  for (const listing of listings) {
    const title = listing.rawTitle || "";
    const desc = listing.description || "";
    
    const parsed = parseListingText(title, desc);
    
    // Check if anything meaningful changed or just update everything
    const updateData = {
      make: parsed.make,
      model: parsed.model,
      year: parsed.year,
      mileage: parsed.mileage,
      trim: parsed.trim,
      bodyStyle: parsed.bodyStyle,
      driveType: parsed.driveType,
      engine: parsed.engine,
      transmission: parsed.transmission,
      fuelType: parsed.fuelType,
      color: parsed.color,
      doors: parsed.doors,
      titleStatus: parsed.titleStatus,
      condition: parsed.condition,
      accidents: parsed.accidents,
      owners: parsed.owners,
      features: parsed.features,
      parseScore: parsed.parseScore,
      vin: parsed.vin,
      parsedAt: new Date(),
    };

    batch.push(
      prisma.listing.update({
        where: { id: listing.id },
        data: updateData
      })
    );

    if (batch.length >= BATCH_SIZE) {
      await Promise.all(batch);
      updatedCount += batch.length;
      console.log(`Progress: ${updatedCount}/${listings.length}...`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await Promise.all(batch);
    updatedCount += batch.length;
  }

  console.log(`✅ Finished! Updated ${updatedCount} listings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
