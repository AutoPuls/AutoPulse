import "../lib/envBootstrap";
import { Worker } from "bullmq";
import { prisma } from "../lib/prisma";
import { getRedisConnection } from "../lib/queue";
import { newListingsEmail, sendMail } from "../lib/mailer";
import { findMatchingSubscriptions } from "../lib/alertMatcher";

const connection = getRedisConnection().duplicate();

export const alertMatchWorker = new Worker(
  "alertMatch",
  async (job) => {
    const { listingId } = job.data;
    if (!listingId) return;

    try {
      const listing = await prisma.listing.findUnique({
        where: { externalId: listingId },
      });

      if (!listing) {
        console.warn(`[alertMatchWorker] Listing ${listingId} not found.`);
        return;
      }

      // --- ALL LISTINGS FILTER ---
      // We notify for ALL vehicles matched, removing the previous 24h limits.
      // --------------------------

      const subscriptions = await findMatchingSubscriptions(listing);
      
      if (subscriptions.length === 0) {
        return;
      }

      console.log(`[alertMatchWorker] Listing ${listingId} matches ${subscriptions.length} subscriptions.`);

      for (const sub of subscriptions) {
        try {
          // --- DEDUPLICATION CHECK ---
          const existingLog = await prisma.notificationLog.findUnique({
            where: {
              subscriptionId_listingId: {
                subscriptionId: sub.id,
                listingId: listing.id,
              },
            },
          });

          if (existingLog) {
            console.log(`[alertMatchWorker] Skipping duplicate for ${sub.email} (Listing: ${listingId})`);
            continue;
          }
          // ---------------------------

          // Construct a one-off alert email
          const { subject, html } = newListingsEmail({
            email: sub.email,
            listings: [listing], // Single listing alert
            filters: {
                make: sub.make || undefined,
                model: sub.model || undefined,
                city: sub.city || undefined,
                priceMin: sub.priceMin || undefined,
                priceMax: sub.priceMax || undefined,
            },
            totalMatching: 1,
          });

          await sendMail({ to: sub.email, subject, html });

          // --- RECORD THE TRANSMISSION ---
          await prisma.notificationLog.create({
            data: {
              subscriptionId: sub.id,
              listingId: listing.id,
            },
          });
          // -------------------------------
          
          // Note: We don't update sub.lastCheckedAt here to avoid interfering with the batch worker
          // if the user still uses it. However, in a pure reactive world, we might.
          
        } catch (mailErr) {
          console.error(`[alertMatchWorker] Failed to send mail to ${sub.email}:`, mailErr);
        }
      }

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[alertMatchWorker] Job ${job.id} failed: ${msg}`);
      throw e;
    }
  },
  {
    connection,
    concurrency: 5, // Process multiple matches in parallel
  }
);

alertMatchWorker.on("failed", (job, err) => {
  console.error(
    `[alertMatchWorker] Job ${job?.id} failed:`,
    err?.message ?? err,
  );
});
