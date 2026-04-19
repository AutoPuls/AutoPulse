import "../lib/envBootstrap";
import { prisma } from "../lib/prisma";
import { MARKETPLACE_CITIES } from "../lib/cities";
import { scrapeLocalMarketplace } from "../lib/scrapers/localFacebook";

/**
 * AGENCY SWEEP v1.0
 * 🛡️ Designed for local execution to bypass server-side blocks.
 * 🚀 Skips Apify and uses the raw local engine for 100% free scraping.
 */

async function runAgencySweep() {
  console.log("====================================================");
  console.log("🛡️  AUTOPULSE AGENCY SWEEP: STARTING US-WIDE SYNC  🛡️");
  console.log("====================================================\n");

  // 1. Get priority cities (those with active alerts)
  const subscriptions = await prisma.subscription.findMany({
    select: { city: true }
  });
  const priorityCitySlugs = Array.from(new Set(subscriptions.map(s => s.city?.toLowerCase()).filter(Boolean)));

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
    } catch (err) {
      console.error(`[sweep] ❌ Failed to scrape ${city.slug}:`, err instanceof Error ? err.message : err);
      // Continue to next city anyway
    }
  }

  console.log("\n====================================================");
  console.log("✅  AGENCY SWEEP COMPLETE");
  console.log(`📊  Total Listings Scraped: ${totalScraped}`);
  console.log(`📊  Total Synced to Cloud: ${totalUpserted}`);
  console.log("====================================================\n");
}

runAgencySweep().catch(err => {
  console.error("FATAL SWEEP ERROR:", err);
  process.exit(1);
});
