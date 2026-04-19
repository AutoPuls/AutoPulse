import "./lib/envBootstrap";
import { getAlertMatchQueue } from "./lib/queue";

async function main() {
    const listingId = "cmo6a5vvq0130s0i0ydlc3ors"; // 2001 BMW 5 series
    console.log(`Triggering match for ${listingId}...`);
    const queue = getAlertMatchQueue();
    await queue.add("matchListing", { listingId }, { removeOnComplete: true });
    console.log("Job added to queue. Please check worker logs.");
    process.exit(0);
}

main();
