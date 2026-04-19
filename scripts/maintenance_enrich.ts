import "../lib/envBootstrap";
import { prisma } from "../lib/prisma";
import { enrichListingLocally } from "../lib/scrapers/localFacebook";

/**
 * MAINTENANCE: BULK ENRICHMENT v1.0
 * 🧹 Repairs old listings with missing info (Mileage, Full Description, etc.)
 */

async function runMaintenanceFix() {
  console.log("====================================================");
  console.log("🧹  AUTOPULSE MAINTENANCE: REPAIRING OLD LISTINGS  🧹");
  console.log("====================================================\n");

  const BATCH_SIZE = 50;

  // Find listings that are missing mileage or have dummy descriptions
  const listingsToFix = await prisma.listing.findMany({
    where: {
      OR: [
        { mileage: null },
        { description: { contains: "AutoPulse v8 captured" } }
      ],
      // Filter out obvious junk
      NOT: {
        rawTitle: { contains: "Marketplace Listing" }
      }
    },
    orderBy: { createdAt: "desc" },
    take: BATCH_SIZE
  });

  if (listingsToFix.length === 0) {
    console.log("✅ No listings found that need repairing! Great job.");
    return;
  }

  console.log(`[maintenance] Found ${listingsToFix.length} listings to repair in this batch.`);
  console.log(`[maintenance] Est. time: ~${Math.round((listingsToFix.length * 18) / 60)} minutes.\n`);

  let repaired = 0;
  let failed = 0;

  for (const listing of listingsToFix) {
    try {
      console.log(`\n--- Repairing Car: ${listing.rawTitle || listing.externalId} ---`);
      
      const success = await enrichListingLocally(listing.externalId);
      
      if (success) {
        repaired++;
        console.log(`[${listing.externalId}] ✅ Repaired!`);
      } else {
        failed++;
        console.log(`[${listing.externalId}] ⚠️ Enrichment returned no data.`);
      }

      // Human-like delay to protect IP
      const delay = 5000 + Math.random() * 10000;
      await new Promise(r => setTimeout(r, delay));

    } catch (err) {
      console.error(`[maintenance] ❌ Error repairing ${listing.externalId}:`, err);
      failed++;
    }
  }

  console.log("\n====================================================");
  console.log("✅  BATCH REPAIR COMPLETE");
  console.log(`📊  Successfully Repaired: ${repaired}`);
  console.log(`📊  Failed/Skipped: ${failed}`);
  console.log("====================================================\n");
}

runMaintenanceFix().catch(err => {
  console.error("FATAL MAINTENANCE ERROR:", err);
  process.exit(1);
});
