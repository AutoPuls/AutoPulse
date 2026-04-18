import "../lib/envBootstrap";
import { Worker } from "bullmq";
import { prisma } from "../lib/prisma";
import { getRedisConnection } from "../lib/queue";
import { parseListingText } from "../lib/parser/listingParser";
import { enrichListingLocally } from "../lib/scrapers/localFacebook";

const connection = getRedisConnection().duplicate();

export const reparseWorker = new Worker(
  "reparse",
  async (job) => {
    if (job.name !== "reparseAll") return;

    let processed = 0;
    let errors = 0;
    let imagesFixed = 0;

    try {
      // --- Phase 1: Reparse text metadata for unparsed listings ---
      const listings = await prisma.listing.findMany({
        where: { parsedAt: null },
        take: 500,
      });

      for (const listing of listings) {
        try {
          const parsed = parseListingText(listing.rawTitle || listing.make + " " + listing.model, listing.description || "");
          
          await prisma.listing.update({
            where: { id: listing.id },
            data: {
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
              parsedAt: new Date(),
            }
          });
          processed++;
        } catch (e) {
          errors++;
          console.error(`[reparseWorker] Failed on listing ${listing.id}:`, e);
        }
      }

      // --- Phase 2: Backfill missing images for Facebook listings ---
      const imagelessListings = await prisma.listing.findMany({
        where: {
          source: "facebook",
          OR: [
            { imageUrl: null },
            { imageUrl: "" },
          ],
          listingUrl: { not: null },
        },
        select: { id: true, listingUrl: true, externalId: true },
        take: 50,
      });

      console.log(`[reparseWorker] Found ${imagelessListings.length} image-less listings to backfill...`);

      for (const listing of imagelessListings) {
        if (!listing.listingUrl) continue;
        try {
          const details = await enrichListingLocally(listing.listingUrl);
          if (details?.imageUrl) {
            await prisma.listing.update({
              where: { id: listing.id },
              data: {
                imageUrl: details.imageUrl,
                description: details.description || undefined,
                updatedAt: new Date(),
              }
            });
            imagesFixed++;
            console.log(`[reparseWorker] ✅ Fixed image for ${listing.externalId}`);
          }
          await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
          console.error(`[reparseWorker] Image backfill failed for ${listing.externalId}:`, e);
        }
      }

      console.log(`[reparseWorker] Complete: ${processed} reparsed, ${imagesFixed} images fixed, ${errors} errors.`);
      return { processed, imagesFixed, errors };
    } catch (e) {
      console.error("[reparseWorker] Job failed:", e);
      throw e;
    }
  },
  {
    connection,
    concurrency: 1,
  }
);
