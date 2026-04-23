import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ status: "Apify Webhook Endpoint Active" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { resource } = body;
    const runId = resource?.runId;
    const datasetId = resource?.defaultDatasetId;

    if (!datasetId) {
      return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
    }

    console.log(`[api/webhooks/apify] Received dataset ${datasetId} for run ${runId}`);

    const apiToken = process.env.APIFY_API_TOKEN;
    if (!apiToken) {
      console.error("[api/webhooks/apify] Missing APIFY_API_TOKEN");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Use standard fetch instead of the heavy apify-client
    const response = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[api/webhooks/apify] Failed to fetch dataset: ${errorText}`);
      return NextResponse.json({ error: "Failed to fetch dataset" }, { status: 500 });
    }

    const items = await response.json();
    console.log(`[api/webhooks/apify] Fetched ${items.length} items from dataset`);

    const { prisma } = await import("@/lib/db");
    const { matchListingToSubscriptions } = await import("@/lib/alertMatcher");

    let count = 0;
    for (const item of items) {
      try {
        // Standardize data from the community scraper
        const listingData = {
          externalId: item.id || item.url || Math.random().toString(),
          source: 'facebook',
          make: item.make || 'Unknown',
          model: item.model || 'Unknown',
          year: parseInt(item.year) || 0,
          price: parseInt(item.price) || 0,
          mileage: parseInt(item.mileage) || null,
          city: item.city || null,
          state: item.state || null,
          imageUrls: item.images || [],
          listingUrl: item.url || '',
          description: item.description || '',
          sellerName: item.sellerName || null,
          postedAt: item.time ? new Date(item.time) : new Date(),
        };

        const listing = await prisma.listing.upsert({
          where: { externalId: listingData.externalId },
          update: listingData,
          create: listingData,
        });

        if (listing) {
          count++;
          // Trigger alert matching in background
          matchListingToSubscriptions(listing).catch(err => 
            console.error(`[api/webhooks/apify] Alert matching error:`, err)
          );
        }
      } catch (err) {
        console.error(`[api/webhooks/apify] Error saving item:`, err);
      }
    }

    console.log(`[api/webhooks/apify] Successfully processed ${count} listings`);
    return NextResponse.json({ success: true, processed: count });

  } catch (error: any) {
    console.error(`[api/webhooks/apify] Webhook processing error:`, {
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json({ 
      error: "Webhook processing failed", 
      details: error.message 
    }, { status: 500 });
  }
}
