/**
 * reparse_listings.ts
 * Goes through existing "Unknown" listings and re-runs the parser
 * to leverage the new MODEL_MAP knowledge.
 */

import "../lib/envBootstrap";
import { prisma } from "../lib/prisma";
import { parseListingText } from "../lib/parser/listingParser";

async function main() {
  console.log("🔄 Starting Listing Reparser...");

  // We now reparse ALL listings to extract newly supported features/colors/status
  const candidates = await prisma.listing.findMany({
    select: {
      id: true,
      rawTitle: true,
      description: true,
      make: true,
      model: true,
      color: true,
      titleStatus: true,
      features: true
    }
  });

  console.log(`🔍 Found ${candidates.length} candidates for reparsing.`);

  let updatedCount = 0;
  for (const c of candidates) {
    const parsed = parseListingText(c.rawTitle || "", c.description || "");
    
    // Check if any significant attribute improved
    const featuresChanged = JSON.stringify(parsed.features.sort()) !== JSON.stringify((c.features || []).sort());
    const anythingChanged = 
      parsed.make !== c.make || 
      parsed.model !== c.model ||
      parsed.color !== c.color ||
      parsed.titleStatus !== c.titleStatus ||
      featuresChanged;

    if (anythingChanged) {
      await prisma.listing.update({
        where: { id: c.id },
        data: {
          make: parsed.make,
          model: parsed.model,
          year: parsed.year,
          trim: parsed.trim,
          transmission: parsed.transmission,
          mileage: parsed.mileage || undefined,
          color: parsed.color,
          titleStatus: parsed.titleStatus,
          features: parsed.features,
          condition: parsed.condition
        }
      });
      updatedCount++;
    }
  }

  console.log(`✅ Successfully updated ${updatedCount} listings with better info.`);
  console.log("🏁 Reparse Complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
