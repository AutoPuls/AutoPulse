import "./lib/envBootstrap";
import { prisma } from "./lib/prisma";
import { getAlertMatchQueue } from "./lib/queue";

async function testUserEmail() {
    console.log("🔍 Checking active subscriptions...");
    const subs = await prisma.subscription.findMany();
    console.log(`Found ${subs.length} subscriptions.`);
    console.log(subs);

    console.log("🔍 Finding a recent BMW in the database...");
    const bmw = await prisma.listing.findFirst({
        where: { make: { contains: 'BMW', mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' }
    });

    if (!bmw) {
         console.log("❌ No BMW found in the database. Can't test.");
         return;
    }

    console.log(`🎯 Found BMW: ${bmw.rawTitle} (${bmw.externalId})`);

    console.log("🛠️ Bypassing Email 'Stale Spam Filter' by artificially setting its Posted time to NOW...");
    await prisma.listing.update({
        where: { id: bmw.id },
        data: { postedAt: new Date() }
    });
    
    console.log("📡 Sending test dispatch to match queue...");
    const queue = getAlertMatchQueue();
    await queue.add("matchListing", { listingId: bmw.externalId }, { removeOnComplete: true });

    console.log("✅ Trigger fired! The background worker on Hugging Face should now pick this up and send the email.");
}

testUserEmail().catch(console.error).finally(() => process.exit(0));
