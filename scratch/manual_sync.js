const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
dotenv.config();

const prisma = new PrismaClient();

function parseYear(title, description) {
  const text = (title + " " + description).substring(0, 100);
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : 0;
}

function parseMileageFromText(text) {
  if (!text) return null;
  const match = text.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:k|thousand)?\s*miles/i);
  if (match) {
    let num = parseInt(match[1].replace(/,/g, ''));
    if (match[0].toLowerCase().includes('k')) num *= 1000;
    return num;
  }
  return null;
}

async function syncDataset(datasetId, token) {
  console.log(`\nFetching dataset ${datasetId}...`);
  try {
    const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
    if (!response.ok) {
        console.error(`Failed to fetch ${datasetId}: ${response.statusText}`);
        return 0;
    }
    const items = await response.json();
    console.log(`Found ${items.length} items. Syncing...`);
    
    let count = 0;
    for (const item of items) {
      try {
          const description = item.redacted_description?.text || '';
          const title = item.marketplace_listing_title || item.custom_title || '';
          const year = item.vehicle_year || parseYear(title, description);
          const make = item.vehicle_make_display_name || 'Unknown';
          const model = item.vehicle_model_display_name || 'Unknown';
          const priceCents = item.listing_price?.amount ? Math.round(parseFloat(item.listing_price.amount) * 100) : 0;

          let mileage = item.vehicle_odometer_data?.value || parseMileageFromText(description);
          if (!mileage && item.custom_sub_titles_with_rendering_flags) {
            const sub = item.custom_sub_titles_with_rendering_flags[0]?.subtitle || '';
            mileage = parseMileageFromText(sub);
          }

          let images = [];
          if (item.primary_listing_photo_url) images.push(item.primary_listing_photo_url);
          if (item.listing_photos && Array.isArray(item.listing_photos)) {
            const moreImages = item.listing_photos.map((p) => p.image?.uri).filter(Boolean);
            images = [...new Set([...images, ...moreImages])];
          }

          if (make === 'Unknown' || images.length === 0) continue; // Skip truly junk data

          await prisma.listing.upsert({
            where: { externalId: item.id || item.url || Math.random().toString() },
            update: {
              make, model, year, price: priceCents, mileage, 
              imageUrls: images, description,
              rawTitle: title,
              city: item.location_text?.text?.split(',')[0]?.trim() || null,
              state: item.location_text?.text?.split(',')[1]?.trim() || null,
            },
            create: {
              externalId: item.id || item.url || Math.random().toString(),
              source: 'facebook',
              make, model, year, price: priceCents, mileage,
              imageUrls: images, description,
              rawTitle: title,
              listingUrl: item.url || '',
              city: item.location_text?.text?.split(',')[0]?.trim() || null,
              state: item.location_text?.text?.split(',')[1]?.trim() || null,
              postedAt: item.creation_time ? new Date(item.creation_time * 1000) : new Date(),
            }
          });
          count++;
      } catch (e) {
        // console.error(`Item error:`, e.message);
      }
    }
    console.log(`Synced ${count} valid items from ${datasetId}`);
    return count;
  } catch (e) {
    console.error(`Sync error for ${datasetId}:`, e.message);
    return 0;
  }
}

async function run() {
  const token = process.env.APIFY_API_TOKEN;
  const datasetIds = [
    'SwXxYp5UV9k1tAzsx', 'X4ZpIeXFy58TtIwHJ', '6eJVU3U2XB6iEAqu0',
    'njLeMaXZX8dDoBjTG', 'zmsGc7fXn9PpXvF3p', '9dgw5dkDWG0nV0hIJ',
    '4b1ggFRTBkRSJfHCB', 'LjF5fz1hNHsXrH01c', 'WzusZDUrGbGfMibc3',
    'SEEqlywSJseIFH1xb'
  ];
  
  let total = 0;
  for (const id of datasetIds) {
    total += await syncDataset(id, token);
  }
  
  console.log(`\n🎉 FINAL TOTAL SYNCED: ${total}`);
  await prisma.$disconnect();
}

run();
