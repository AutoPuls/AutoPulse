import { NextResponse } from 'next/server';
import 'proxy-agent';
export const dynamic = 'force-dynamic';
import { ApifyClient } from 'apify-client';
import { parseListingText } from '@/lib/parser/listingParser';

export async function POST(req: Request) {
  const { prisma } = await import("@/lib/db"); 
  const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
  });
  try {
    const body = await req.json();
    console.log('Incoming Webhook Payload:', JSON.stringify(body, null, 2));

    // Handle Apify Test Events
    if (body.eventType === 'TEST') {
      console.log('Apify Webhook Test Received Successfully!');
      return NextResponse.json({ success: true, message: 'Test connection successful' });
    }

    // The dataset ID where Apify stored the new scraped data
    const datasetId = body.resource?.defaultDatasetId || body.resource?.id;

    if (!datasetId) {
      console.error('Webhook Error: No dataset ID found in payload');
      return NextResponse.json({ error: 'No dataset ID found' }, { status: 400 });
    }

    // 1. Fetch the dataset items from Apify
    console.log(`Querying Apify Dataset: ${datasetId}`);
    const { items } = await apifyClient.dataset(datasetId).listItems();
    console.log(`Fetched ${items.length} items from Apify`);

    let createdCount = 0;
    let updatedCount = 0;
    const newListings = [];

    // 2. Process each item (Upsert)
    // Using mapping logic combined with our internal AutoPulse generic parser for optimal Facebook Marketplace Extraction
    for (const item of items as any[]) {
      const externalId = item.id || item.url || Math.random().toString(36).substring(7); // fallback
      const title = item.title || item.name || '';
      const description = item.description || '';
      
      const parsed = parseListingText(title, description);
      
      const payload = {
        externalId: externalId,
        make: parsed.make,
        model: parsed.model,
        year: parsed.year,
        trim: parsed.trim,
        bodyStyle: parsed.bodyStyle,
        driveType: parsed.driveType,
        engine: parsed.engine,
        transmission: parsed.transmission,
        fuelType: parsed.fuelType,
        color: parsed.color,
        doors: parsed.doors,
        titleStatus: parsed.titleStatus,
        condition: parsed.condition,
        accidents: parsed.accidents,
        owners: parsed.owners,
        price: parseInt(item.price) || 0,
        mileage: parsed.mileage || parseInt(item.odometer) || null,
        vin: item.vin || null,
        description: description || null,
        city: item.city || item.location?.city || item.location?.name || null,
        state: item.state || null,
        listingUrl: item.url || item.listingUrl || `https://facebook.com/${externalId}`,
        imageUrls: item.images || (item.imageUrl ? [item.imageUrl] : []),
      };

      // Upsert to DB
      const result = await prisma.listing.upsert({
        where: { externalId: payload.externalId },
        update: {
          price: payload.price,
          mileage: payload.mileage,
          description: payload.description,
          // Update images if it's an array
          imageUrls: payload.imageUrls,
        },
        create: payload,
      });

      // Simple way to detect if it was created (createdAt roughly equals updatedAt)
      const isNew = new Date(result.updatedAt).getTime() - new Date(result.createdAt).getTime() < 1000;
      
      if (isNew) {
        createdCount++;
        newListings.push(result);
      } else {
        updatedCount++;
      }
    }

    console.log(`Apify Sync Complete: Created ${createdCount}, Updated ${updatedCount}`);

    // Trigger Notification Check in background (Zero-Redis async trigger)
    if (newListings.length > 0) {
      // We don't await this so the webhook responds to Apify immediately
      triggerZeroRedisNotifications(newListings).catch(e => console.error('Notification Error:', e));
    }

    // Trigger HuggingFace Backup Check
    // If the number of NEW cars hits a threshold, we can push. For simplicity,
    // let's just trigger this asynchronously and let it figure out if it has enough new rows or just push the current batch
    if (newListings.length >= 10 || process.env.FORCE_HF_SYNC === 'true') {
      pushToHuggingFace(newListings).catch(e => console.error('HF Sync Error:', e));
    }

    return NextResponse.json({ success: true, created: createdCount, updated: updatedCount });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// -------------------------------------------------------------------------------------------------
// BACKGROUND TASKS
// -------------------------------------------------------------------------------------------------

async function triggerZeroRedisNotifications(newListings: any[]) {
  const { prisma } = await import("@/lib/db");
  console.log(`Checking notifications for ${newListings.length} new listings...`);
  
  // Example: Grab all active subscriptions from DB
  const subscriptions = await prisma.subscription.findMany();

  for (const sub of subscriptions) {
    for (const car of newListings) {
      // Basic matching logic
      const makeMatch = sub.make ? car.make?.toLowerCase() === sub.make.toLowerCase() : true;
      const modelMatch = sub.model ? car.model?.toLowerCase() === sub.model.toLowerCase() : true;
      const priceMatchMax = sub.priceMax ? car.price <= sub.priceMax : true;
      const priceMatchMin = sub.priceMin ? car.price >= sub.priceMin : true;

      if (makeMatch && modelMatch && priceMatchMax && priceMatchMin) {
        // MATCH FOUND - Send Email Synchronously ! No Redis or BullMQ !
        console.log(`Match found! Sending email to ${sub.email} for ${car.make} ${car.model}`);
        await sendEmailDirect(sub.email, car);
      }
    }
  }
}

async function sendEmailDirect(email: string, car: any) {
  // In a real app, this imports nodemailer and sends an exact email templates
  // You already have a mailer likely in lib/ or similar
  console.log(`[Zero-Redis] Mock sending email to ${email} with car ${car.id}`);
  // Example:
  // await sendMail({ to: email, subject: 'New alert', html: `<p>${car.make} ${car.model} found string!</p>` })
}

async function pushToHuggingFace(cars: any[]) {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    console.warn('HF_TOKEN not set. Skipping HuggingFace backup.');
    return;
  }

  const datasetName = 'AdamBejaoui/AutoPulse-Data';
  console.log(`Pushing ${cars.length} records to HuggingFace Dataset: ${datasetName}`);

  try {
    // Note: The HF Dataset upload API often requires converting to Parquet or JSONL 
    // and sending via PUT or using the @huggingface/hub client.
    // For pure zero-dependency fetch, we will upload a jsonl snippet.
    const jsonl = cars.map(c => JSON.stringify(c)).join('\n');
    
    // We append a random nonce so the filename doesn't collide
    const filename = `data/cars_${Date.now()}_${Math.floor(Math.random() * 1000)}.jsonl`;
    const url = `https://huggingface.co/api/datasets/${datasetName}/upload/main/${filename}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json'
      },
      body: jsonl
    });

    if (res.ok) {
      console.log('Successfully backed up to HuggingFace!');
    } else {
      const errText = await res.text();
      console.error('Failed to back up to HuggingFace:', res.status, errText);
    }
  } catch (error) {
    console.error('HF Fetch Error:', error);
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Apify Webhook Endpoint Active' });
}
