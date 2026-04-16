import "../lib/envBootstrap";
import http from "http";
import cron from "node-cron";
import { getNotificationsQueue, getScrapeQueue, getReparseQueue } from "../lib/queue";
import "../workers/scrapeWorker";
import "../workers/notificationWorker";
import "../workers/alertMatchWorker";
import "../workers/reparseWorker";

/**
 * Hugging Face Spaces (Docker) requires the container to listen on a port
 * (default is 7860) to stay in the 'Running' state.
 */
function startHealthCheckServer(): void {
  const port = process.env.PORT || "7860";
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("AutoPulse Worker is healthy\n");
  });

  server.listen(port, () => {
    console.log(`[workers] Health check server listening on port ${port}`);
  });
}

function logStartup(): void {
  const now = new Date();
  console.log("[workers] AutoPulse worker process started at", now.toISOString());
  console.log(
    "[workers] Scheduled: scrape 'scrapeAll' every 4 hours (0 */4 * * *)",
  );
  console.log(
    "[workers] Scheduled: notifications 'checkAlerts' every 15 minutes (*/15 * * * *)",
  );
  console.log(
    "[workers] Scheduled: reparse 'reparseAll' every 24 hours (0 0 * * *)",
  );
  const nextQuarter = new Date(now);
  nextQuarter.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  if (nextQuarter <= now) {
    nextQuarter.setMinutes(nextQuarter.getMinutes() + 15);
  }
  console.log(
    "[workers] Next notification check (approx.):",
    nextQuarter.toISOString(),
  );
}

cron.schedule("0 */4 * * *", async () => {
  try {
    await getScrapeQueue().add("scrapeAll", {}, { priority: 1 });
    console.log("[workers] Cron: 4-hour sweep queued");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[workers] Failed to queue scrapeAll:", msg);
  }
});

cron.schedule("*/15 * * * *", async () => {
  try {
    await getNotificationsQueue().add("checkAlerts", {});
    console.log("[workers] Cron: checkAlerts job queued");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[workers] Failed to queue checkAlerts:", msg);
  }
});

cron.schedule("0 0 * * *", async () => {
  try {
    await getReparseQueue().add("reparseAll", {});
    console.log("[workers] Cron: reparseAll job queued (daily)");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[workers] Failed to queue reparseAll:", msg);
  }
});

async function triggerInitialJobs(): Promise<void> {
  console.log("[workers] Triggering initial startup jobs...");
  try {
    await getScrapeQueue().add("scrapeAll", {}, { priority: 1 });
    console.log("[workers] Initial scrape job queued");
    
    await getNotificationsQueue().add("checkAlerts", {});
    console.log("[workers] Initial checkAlerts job queued");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[workers] Failed to trigger initial jobs:", msg);
  }
}

logStartup();
startHealthCheckServer();
triggerInitialJobs().catch(console.error);
