import { scrapeLocalMarketplace } from "../lib/scrapers/localFacebook";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🚀 Starting Facebook Session Refresh...");
  
  // Choose a small/stable location for the test
  const testLocation = "anchorage"; 
  
  try {
    console.log(`[test] Attempting scrape in ${testLocation} to trigger login/save flow...`);
    const result = await scrapeLocalMarketplace(testLocation);
    
    console.log("\n✅ Refresh Attempt Finished.");
    console.log(`Extracted: ${result.scraped} listings.`);
    console.log(`Upserted: ${result.upserted} listings.`);
    
    // Check DB
    const session = await prisma.scraperSession.findUnique({
      where: { id: "facebook-default" }
    });
    
    if (session) {
      console.log(`\n💎 SUCCESS: Session is saved in Database (Updated: ${session.updatedAt.toLocaleString()})`);
    } else {
      console.error("\n❌ ERROR: Session was NOT saved to Database.");
    }
  } catch (err) {
    console.error("\n❌ Fatal error during refresh:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
