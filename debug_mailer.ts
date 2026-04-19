import "./lib/envBootstrap";
import { prisma } from "./lib/prisma";
import { findMatchingSubscriptions } from "./lib/alertMatcher";
import { newListingsEmail, sendMail } from "./lib/mailer";

async function debugMail() {
    console.log("🔍 Finding the test BMW...");
    const listingId = "968710709070860"; // The BMW Z4 M id
    
    const listing = await prisma.listing.findUnique({
        where: { externalId: listingId },
    });

    if (!listing) {
         console.error("No listing found!");
         return;
    }

    console.log("🔍 Checking matches...");
    const subscriptions = await findMatchingSubscriptions(listing);
    console.log(`Matched ${subscriptions.length} subscriptions`);

    for (const sub of subscriptions) {
        console.log(`Trying to send to ${sub.email}...`);
        
        try {
            const { subject, html } = newListingsEmail({
                email: sub.email,
                listings: [listing],
                filters: { make: sub.make || undefined },
                totalMatching: 1,
            });

            console.log("Subject:", subject);
            console.log("Calling Resend API...");

            const response = await sendMail({ to: sub.email, subject, html });
            console.log("✅ Resend API Response:", response);
            
        } catch (e) {
            console.error("🚨 MAIL ERROR:", e);
        }
    }
}

debugMail().catch(console.error).finally(() => process.exit(0));
