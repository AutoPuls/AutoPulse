import { prisma } from "../lib/prisma";

async function main() {
    try {
        console.log("Testing DB connection...");
        const count = await prisma.listing.count();
        console.log("Listing count:", count);
        
        console.log("Testing ScraperSession connection...");
        const session = await prisma.scraperSession.findFirst();
        console.log("Session found:", !!session);
    } catch (err) {
        console.error("Prisma error:", err);
    }
}

main();
