import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { ApifyClient } from 'apify-client';
import { PrismaClient } from '@prisma/client';

// ─── SAFETY CONFIG ────────────────────────────────────────────────────────────
const MAX_RESULTS_PER_URL = 1000;         // Increased to fetch older listings (up to 30 days)
const MAX_URLS_PER_RUN = 24;
const RESULTS_LIMIT = 15000;          // Expanded overall throughput
const USE_RESIDENTIAL = true;         // Use high-quality proxies for more cities
const DRY_RUN = process.argv.includes('--dry-run'); // Pass --dry-run to preview only
// ──────────────────────────────────────────────────────────────────────────────

const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function checkBalance(): Promise<void> {
  try {
    const user = await apifyClient.user().get();
    const usage = (user as any)?.plan?.currentMonthUsage;
    const limit = (user as any)?.plan?.monthlyUsageLimit;
    if (usage != null && limit != null) {
      const pct = ((usage / limit) * 100).toFixed(1);
      const remaining = (limit - usage).toFixed(2);
      console.log(`\n💰 Apify Usage: $${usage.toFixed(2)} / $${limit.toFixed(2)} (${pct}% used)`);
      console.log(`   Remaining budget: $${remaining}`);
      if (usage / limit > 0.8) {
        console.warn(`\n⚠️  WARNING: You've used over 80% of your monthly budget!`);
      }
    }
  } catch {
    console.log('⚠️  Could not fetch Apify balance — proceeding with caution.');
  }
}

async function runMegaHarvest() {
  const prisma = new PrismaClient();

  console.log('═══════════════════════════════════════');
  console.log('       AUTOPULSE SMART HARVEST');
  console.log('═══════════════════════════════════════');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE — No Apify run will be started.\n');
  }

  // 1. Show current balance
  await checkBalance();

  // 2. Fetch active subscriptions for priority targeting
  const subs = await prisma.subscription.findMany({
    select: { make: true, model: true, city: true },
    where: { OR: [{ make: { not: null } }, { model: { not: null } }] }
  }).finally(() => prisma.$disconnect());

  const combos = Array.from(new Set(subs.map(s => `${s.make || ''} ${s.model || ''}`.trim()))).filter(Boolean);
  console.log(`\n🎯 Active subscriptions: ${subs.length} (${combos.length} unique combos)`);

  // 3. Build targeted URLs
  const generalCities = [
    'miami', 'atlanta', 'dallas', 'houston', 'losangeles', 'chicago', 
    'newyork', 'philadelphia', 'phoenix', 'sanantonio', 'sandiego', 
    'orlando', 'lasvegas', 'charlotte', 'seattle', 'denver',
    'washington', 'boston', 'detroit', 'nashville'
  ];
  const startUrls: { url: string }[] = [];

  // General browse for non-subscription cars
  for (const city of generalCities) {
    startUrls.push({
      url: `https://www.facebook.com/marketplace/${city}/vehicles?sort=CREATION_TIME_DESCEND`
    });
  }

  // Priority car+city searches from subscriptions (Top 10 hubs for targeted)
  const priorityCities = ['miami', 'atlanta', 'dallas', 'houston', 'losangeles', 'chicago', 'newyork', 'orlando', 'phoenix', 'lasvegas'];
  for (const combo of combos) {
    for (const city of priorityCities) {
      startUrls.push({
        url: `https://www.facebook.com/marketplace/${city}/search?query=${encodeURIComponent(combo)}&category_id=vehicles&sort=CREATION_TIME_DESCEND`
      });
    }
  }

  const finalUrls = startUrls.slice(0, MAX_URLS_PER_RUN);

  // 4. Plan
  console.log(`\n📋 PLAN (Tight Budget Mode):`);
  console.log(`   URLs to scrape  : ${finalUrls.length}`);
  console.log(`   Max Results     : ${RESULTS_LIMIT} total`);
  console.log(`   Scraper Actor   : curious_coder/facebook-marketplace`);
  console.log(`   Webhook URL     : ${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/apify`);

  if (DRY_RUN) {
    finalUrls.forEach((u, i) => console.log(`   ${i + 1}. ${u.url}`));
    return;
  }

  // 5. Build Apify input (MATCHING USER'S EXACT SETTINGS)
  const input = {
    urls: finalUrls.map(u => u.url), 
    maxPagesPerUrl: 4,             // Fixed to user's setting
    maxItems: RESULTS_LIMIT,       // Use the dynamic goal
    proxyConfiguration: { 
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'],
      apifyProxyCountry: 'US'
    },
    onlyPublic: false,
    useFilters: true,
    scrapeDetails: true            // Ensure full info is grabbed
  };

  // 8. Start run
  try {
    console.log('\n📡 Starting Apify run...');
    const run = await apifyClient.actor('curious_coder/facebook-marketplace').start(input, {
      webhooks: [{
        eventTypes: ['ACTOR.RUN.SUCCEEDED'],
        requestUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/apify`,
      }]
    });

    console.log(`\n✅ HARVEST STARTED!`);
    console.log(`🔗 Run ID : ${run.id}`);
    console.log(`📊 View   : https://console.apify.com/actors/runs/${run.id}`);
    console.log(`\n💡 TIP: Run with --dry-run next time to preview before spending.`);
  } catch (error: any) {
    console.error('❌ Failed to start harvest:', error.message);
  }
}

runMegaHarvest().catch(console.error);
