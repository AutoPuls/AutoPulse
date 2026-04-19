import "../lib/envBootstrap";
import { prisma } from "../lib/prisma";

async function resetDatabase() {
  console.log("====================================================");
  console.log("🗑️  AUTOPULSE DATABASE RESET: WIPING LISTINGS  🗑️");
  console.log("====================================================\n");

  try {
    const listCount = await prisma.listing.count();
    const logCount = await prisma.notificationLog.count();

    console.log(`[reset] Found ${listCount} listings and ${logCount} notification logs.`);
    console.log("[reset] WIPING DATA (Keeping Subscriptions)...");

    // Clear logs first because they reference listings
    await prisma.notificationLog.deleteMany({});
    console.log("✅ Notification logs deleted.");

    // Clear listings
    await prisma.listing.deleteMany({});
    console.log("✅ Listing database wiped clean.");

    console.log("\n====================================================");
    console.log("✨  DATABASE IS NOW EMPTY. READY FOR FRESH SCRAPE.  ✨");
    console.log("====================================================\n");

  } catch (err) {
    console.error("❌ Fatal Reset Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
