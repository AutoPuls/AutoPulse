import "../lib/envBootstrap";
import { MARKETPLACE_CITIES } from "../lib/cities";
import { scrapeLocalMarketplace } from "../lib/scrapers/localFacebook";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🚀 STARTING MEGA HARVEST (10,000+ Listings Goal)");
  
  // Top 40 Major US Cities for maximum volume
  const targets = MARKETPLACE_CITIES.slice(0, 40).map(c => c.slug);
  
  console.log(`[mega-harvest] Targeting ${targets.length} major cities...`);
  
  const CONCURRENCY = 4; // Optimized for 16GB RAM
  const DEPTH = 40;     // 2x-3x deeper than normal
  
  let totalUpserted = 0;

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    console.log(`\n[mega-harvest] 📦 Processing Batch ${Math.floor(i/CONCURRENCY)+1}/${Math.ceil(targets.length/CONCURRENCY)}: ${batch.join(", ")}`);
    
    const results = await Promise.allSettled(
      batch.map(city => scrapeLocalMarketplace(city, { scrollDepth: DEPTH }))
    );
    
    results.forEach((res, idx) => {
      const city = batch[idx];
      if (res.status === "fulfilled") {
        totalUpserted += res.value.upserted;
        console.log(`[mega-harvest] ✅ ${city}: Scraped ${res.value.scraped}, Upserted ${res.value.upserted}`);
      } else {
        console.error(`[mega-harvest] ❌ ${city} Failed:`, res.reason);
      }
    });

    console.log(`[mega-harvest] Current Total Upserted: ${totalUpserted}`);
    
    // Cool-down between batches to avoid IP flagging
    if (i + CONCURRENCY < targets.length) {
        console.log("[mega-harvest] ⏳ Cooling down for 10s...");
        await new Promise(r => setTimeout(r, 10000));
    }
  }

  console.log(`\n[mega-harvest] 🎉 COMPLETED! Total Listings Harvested: ${totalUpserted}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
