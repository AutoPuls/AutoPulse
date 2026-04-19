import "../lib/envBootstrap";
import { prisma } from "../lib/prisma";
import { MARKETPLACE_CITIES } from "../lib/cities";
import { scrapeLocalMarketplace, enrichListingLocally } from "../lib/scrapers/localFacebook";

/**
 * AGENCY SWEEP v1.0
 * 🛡️ Designed for local execution to bypass server-side blocks.
 * 🚀 Skips Apify and uses the raw local engine for 100% free scraping.
 */

async function runAgencySweep() {
  console.log("====================================================");
  console.log("🛡️  AUTOPULSE AGENCY SWEEP: STARTING US-WIDE SYNC  🛡️");
  console.log("====================================================\n");

  // Log target for safety
  const dbUrl = process.env.DATABASE_URL || "";
  const dbName = dbUrl.includes("supabase") ? "Supabase (Production)" : "Local/Generic DB";
  console.log(`📡 Target Database: ${dbName}`);
  console.log("----------------------------------------------------\n");

  // Handle Ctrl+C gracefully on Windows
  process.on("SIGINT", () => {
    console.log("\n\n🛑 STOPPING... Closing browser and exiting safely.");
    process.exit(0);
  });

  // 1. Get priority cities (those with active alerts)
  let priorityCitySlugs: string[] = [];
  try {
    const subscriptions = await prisma.subscription.findMany({
      select: { city: true }
    });
    priorityCitySlugs = Array.from(new Set(subscriptions.map(s => s.city?.toLowerCase()).filter(Boolean) as string[]));
  } catch (e) {
    console.warn("[sweep] Warning: Could not fetch subscriptions for priority sorting.");
  }

  // 2. Sort cities: Priority first, then the rest
  const sortedCities = [...MARKETPLACE_CITIES].sort((a, b) => {
    const aPri = priorityCitySlugs.includes(a.slug) ? 1 : 0;
    const bPri = priorityCitySlugs.includes(b.slug) ? 1 : 0;
    return bPri - aPri;
  });

  console.log(`[sweep] Target: ${sortedCities.length} cities.`);
  console.log(`[sweep] Priority cities detected: ${priorityCitySlugs.join(", ") || "None"}\n`);

  let totalScraped = 0;
  let totalUpserted = 0;
  let totalEnriched = 0;

  for (const city of sortedCities) {
    try {
      console.log(`\n--- Working on: ${city.label} ---`);
      
      // Delay between cities to further avoid detection
      const jitter = 2000 + Math.random() * 3000;
      await new Promise(r => setTimeout(r, jitter));

      const result = await scrapeLocalMarketplace(city.slug);
      
      totalScraped += result.scraped;
      totalUpserted += result.upserted;

      console.log(`[${city.slug}] Done! Scraped: ${result.scraped}, Upserted: ${result.upserted}`);

      // NEW: Trigger deep enrichment for the most recent findings (limit to top 50)
      if (result.upserted > 0) {
        console.log(`[${city.slug}] 🛠️  Starting Deep Enrichment for latest listings...`);
        const recentListings = await prisma.listing.findMany({
            where: { 
                city: city.label.split(',')[0],
                source: "facebook"
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        for (const listing of recentListings) {
            // Only enrich if description is basic or mileage is missing
            if (!listing.description || listing.description.includes('captured') || listing.mileage === null) {
                const enriched = await enrichListingLocally(listing.externalId);
                if (enriched) totalEnriched++;
                // Jitter between individual items
                await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
            }
        }
      }

    } catch (err) {
      console.error(`[sweep] ❌ Failed to scrape ${city.slug}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log("\n====================================================");
  console.log("✅  AGENCY SWEEP COMPLETE");
  console.log(`📊  Total Listings Scraped: ${totalScraped}`);
  console.log(`📊  Total Synced to Cloud: ${totalUpserted}`);
  console.log(`📊  Total Deep-Enriched (Full Info): ${totalEnriched}`);
  console.log("====================================================\n");
}

runAgencySweep().catch(err => {
  console.error("FATAL SWEEP ERROR:", err);
  process.exit(1);
});
