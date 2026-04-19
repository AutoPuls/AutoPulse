import "../lib/envBootstrap";
import { Worker } from "bullmq";
import { getRedisConnection, getAlertMatchQueue } from "../lib/queue";
import { enrichListingLocally } from "../lib/scrapers/localFacebook";

const connection = getRedisConnection().duplicate();

export const enrichmentWorker = new Worker(
  "enrichment",
  async (job) => {
    const { listingId } = job.data;
    if (!listingId) return;

    try {
      console.log(`[enrichmentWorker] Processing listing ${listingId}...`);
      const success = await enrichListingLocally(listingId);
      
      if (success) {
        // After successful enrichment, trigger the alert match queue
        const alertQueue = getAlertMatchQueue();
        await alertQueue.add("matchListing", { listingId }, { 
            removeOnComplete: true,
            jobId: `match-${listingId}`
        });
        console.log(`[enrichmentWorker] Listing ${listingId} enriched and queued for matching.`);
      } else {
        console.warn(`[enrichmentWorker] Listing ${listingId} enrichment failed or skipped.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[enrichmentWorker] Job ${job.id} failed: ${msg}`);
      throw e;
    }
  },
  {
    connection,
    concurrency: 1, // Enrichment is heavy (browser per job), keep concurrency low
  }
);

enrichmentWorker.on("failed", (job, err) => {
  console.error(
    `[enrichmentWorker] Job ${job?.id} failed:`,
    err?.message ?? err,
  );
});
