import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ status: "Apify Webhook Endpoint Active" });
}

function parseYear(title: string, description: string) {
  const text = (title + " " + description).substring(0, 100);
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : 0;
}

function parseMileageFromText(text: string) {
  if (!text) return null;
  const match = text.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:k|thousand)?\s*miles/i);
  if (match) {
    let num = parseInt(match[1].replace(/,/g, ''));
    if (match[0].toLowerCase().includes('k')) num *= 1000;
    return num;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { resource } = body;
    const datasetId = resource?.defaultDatasetId;

    if (!datasetId) return NextResponse.json({ error: "No datasetId" }, { status: 400 });

    const apiToken = process.env.APIFY_API_TOKEN;
    const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`);
    if (!response.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 500 });

    const items = await response.json();
    const { prisma } = await import("@/lib/db");
    const { matchListingToSubscriptions } = await import("@/lib/alertMatcher");

    let count = 0;
    for (const item of items) {
      try {
        const description = item.redacted_description?.text || '';
        const title = item.marketplace_listing_title || item.custom_title || '';
        const externalId = item.id || item.url?.match(/item\/(\d+)/)?.[1] || Math.random().toString();
        
        // Construct clean FB marketplace URL
        const listingUrl = externalId.match(/^\d+$/) 
          ? `https://www.facebook.com/marketplace/item/${externalId}/`
          : item.url || '';

        const year = item.vehicle_year || parseYear(title, description);
        const make = item.vehicle_make_display_name || 'Unknown';
        const model = item.vehicle_model_display_name || 'Unknown';
        
        const priceCents = item.listing_price?.amount 
          ? Math.round(parseFloat(item.listing_price.amount) * 100) 
          : 0;

        let mileage = item.vehicle_odometer_data?.value || parseMileageFromText(description);
        if (!mileage && item.custom_sub_titles_with_rendering_flags) {
          const sub = item.custom_sub_titles_with_rendering_flags[0]?.subtitle || '';
          mileage = parseMileageFromText(sub);
        }

        let images = [];
        if (item.primary_listing_photo_url) images.push(item.primary_listing_photo_url);
        if (item.listing_photos && Array.isArray(item.listing_photos)) {
          const moreImages = item.listing_photos.map((p: any) => p.image?.uri).filter(Boolean);
          images = [...new Set([...images, ...moreImages])];
        }

        const listingData = {
          externalId: externalId,
          source: 'facebook',
          rawTitle: title,
          make: make,
          model: model,
          year: year,
          price: priceCents,
          mileage: mileage,
          city: item.location_text?.text?.split(',')[0]?.trim() || null,
          state: item.location_text?.text?.split(',')[1]?.trim() || null,
          imageUrls: images,
          listingUrl: listingUrl,
          description: description,
          postedAt: item.creation_time ? new Date(item.creation_time * 1000) : new Date(),
        };

        const listing = await prisma.listing.upsert({
          where: { externalId: listingData.externalId },
          update: listingData,
          create: listingData,
        });

        if (listing) {
          count++;
          matchListingToSubscriptions(listing).catch(() => {});
        }
      } catch (err) {
        console.error(`[webhook] Item error:`, err);
      }
    }

    return NextResponse.json({ success: true, processed: count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
