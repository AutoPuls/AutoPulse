import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ status: "Apify Webhook Endpoint Active" });
}

function parseTitle(title: string) {
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : 0;
  
  // Basic make/model extraction (can be improved)
  // Example: "2013 Nissan Rogue · SV w/SL Pkg Sport Utility 4D"
  const cleanTitle = title.replace(/\b(19|20)\d{2}\b/, '').trim();
  const parts = cleanTitle.split('·')[0].trim().split(' ');
  const make = parts[0] || 'Unknown';
  const model = parts.slice(1).join(' ') || 'Unknown';
  
  return { year, make, model };
}

function parseMileage(subtitles: any[]) {
  if (!subtitles || !Array.isArray(subtitles)) return null;
  for (const sub of subtitles) {
    const text = sub.subtitle || '';
    const match = text.match(/([\d,]+)\s*miles/i);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''));
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { resource } = body;
    const datasetId = resource?.defaultDatasetId;

    if (!datasetId) {
      return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
    }

    const apiToken = process.env.APIFY_API_TOKEN;
    const response = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`
    );

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch dataset" }, { status: 500 });
    }

    const items = await response.json();
    const { prisma } = await import("@/lib/db");
    const { matchListingToSubscriptions } = await import("@/lib/alertMatcher");

    let count = 0;
    for (const item of items) {
      try {
        // MAPPING FOR CURIOUS_CODER/FACEBOOK-MARKETPLACE
        const title = item.marketplace_listing_title || '';
        const { year, make, model } = parseTitle(title);
        
        const price = item.listing_price?.amount 
          ? Math.round(parseFloat(item.listing_price.amount) * 100) 
          : 0;

        const mileage = parseMileage(item.custom_sub_titles_with_rendering_flags);

        const listingData = {
          externalId: item.id || item.url || Math.random().toString(),
          source: 'facebook',
          rawTitle: title,
          make: make,
          model: model,
          year: year,
          price: price,
          mileage: mileage,
          city: item.location?.reverse_geocode?.city || null,
          state: item.location?.reverse_geocode?.state || null,
          imageUrls: item.primary_listing_photo_url ? [item.primary_listing_photo_url] : [],
          listingUrl: item.url || '',
          description: item.redacted_description?.text || '',
          postedAt: item.creation_time ? new Date(item.creation_time * 1000) : new Date(),
        };

        const listing = await prisma.listing.upsert({
          where: { externalId: listingData.externalId },
          update: listingData,
          create: listingData,
        });

        if (listing) {
          count++;
          matchListingToSubscriptions(listing).catch(err => 
            console.error(`[api/webhooks/apify] Alert error:`, err)
          );
        }
      } catch (err) {
        console.error(`[api/webhooks/apify] Error saving item:`, err);
      }
    }

    return NextResponse.json({ success: true, processed: count });

  } catch (error: any) {
    return NextResponse.json({ error: "Webhook failed", details: error.message }, { status: 500 });
  }
}
