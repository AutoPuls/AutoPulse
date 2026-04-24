
import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';
import { MARKETPLACE_CITIES } from '../lib/cities';

dotenv.config();

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

async function runMegaHarvest() {
  console.log('🚀 INITIALIZING MEGA HARVEST V2...');

  // 1. Pick a random batch of 25 cities to stay under the radar
  const batchSize = 25;
  const shuffled = [...MARKETPLACE_CITIES].sort(() => 0.5 - Math.random());
  const selectedCities = shuffled.slice(0, batchSize);

  console.log(`📍 Selected ${batchSize} target cities for this cycle.`);

  // 2. Build the search URLs
  // We target "vehicles" specifically with "sort by creation time" to get newest leads
  const searchUrls = selectedCities.map(city => 
    `https://www.facebook.com/marketplace/${city.slug}/vehicles?sort=CREATION_TIME_DESCEND`
  );

  // 3. Handle Cookies if available
  // Cleaning up potential spacing issues in the .env variable
  const rawCookies = process.env.FB_COOKIES || process.env.FB_SESSION_COOKIES || '';
  // The .env might have spaces between every char and escaped quotes
  const cleanedCookies = rawCookies.replace(/\s/g, '').replace(/\\"/g, '"'); 
  let cookies = [];
  try {
    if (cleanedCookies) cookies = JSON.parse(cleanedCookies);
  } catch (e) {
    console.warn('⚠️ Could not parse FB_COOKIES, proceeding without them.');
  }

  // 4. Define the optimized input for apify/facebook-marketplace-scraper
  const input = {
    "startUrls": searchUrls.map(url => ({ "url": url })),
    "maxPagesPerUrl": 5,           
    "resultsPerPage": 24,
    "maxRequestsPerRun": 500,
    "concurrency": 5,             
    "proxyConfiguration": {
      "useApifyProxy": true,
      "groups": ["RESIDENTIAL"]    
    },
    "viewAction": "SEARCH",
    "getListingDetails": true,     
    "sessionCookies": cookies,     // Include cookies for logged-in scraping
  };

  console.log('📡 Triggering Apify actor (apify/facebook-marketplace-scraper)...');

  try {
    const run = await client.actor('apify/facebook-marketplace-scraper').start(input, {
        // Automatically trigger our webhook when the run is finished
        webhooks: [
            {
                eventTypes: ['ACTOR.RUN.SUCCEEDED'],
                requestUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/apify`,
            }
        ]
    });

    console.log(`✅ MEGA HARVEST COMINCED!`);
    console.log(`🔗 Run ID: ${run.id}`);
    console.log(`📊 View progress: https://console.apify.com/actors/runs/${run.id}`);
    console.log(`🔔 Webhook will trigger: ${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/apify upon completion.`);

  } catch (error: any) {
    console.error('❌ Failed to start Mega Harvest:', error.message);
  }
}

runMegaHarvest().catch(console.error);
