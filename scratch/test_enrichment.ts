import "../lib/envBootstrap";
import { enrichListingLocally } from "../lib/scrapers/localFacebook";
import { prisma } from "../lib/prisma";

async function main() {
    // We need a listing ID from the DB to test on.
    // I'll grab the most recent one.
    const listing = await prisma.listing.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    if (!listing) {
        console.error("No listings found in DB to test enrichment.");
        return;
    }

    console.log(`Testing enrichment for: ${listing.rawTitle} (${listing.externalId})`);
    console.log(`URL: ${listing.listingUrl}`);
    
    const success = await enrichListingLocally(listing.externalId);
    console.log("Enrichment success:", success);

    if (success) {
        const updated = await prisma.listing.findUnique({
            where: { externalId: listing.externalId }
        });
        console.log("--- Updated Details ---");
        console.log("Description:", updated?.description?.substring(0, 100) + "...");
        console.log("Mileage:", updated?.mileage);
        console.log("Transmission:", updated?.transmission);
        console.log("Fuel:", updated?.fuelType);
        console.log("Image URL (High Res):", updated?.imageUrl);
    }
}

main();
