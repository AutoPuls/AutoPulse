import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { ApifyClient } from 'apify-client';
import { PrismaClient } from '@prisma/client';

// ─── SAFETY CONFIG ────────────────────────────────────────────────────────────
const MAX_URLS_PER_RUN = 15;          // Hard cap on number of start URLs
const MAX_RESULTS_PER_URL = 20;       // Results fetched per URL
const RESULTS_LIMIT = 200;            // Total results cap for entire run
const USE_RESIDENTIAL = false;        // true = expensive, false = datacenter (cheaper)
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

  // 3. Build targeted URLs — priority (subscription-matched) first
  const priorityCities = ['nyc', 'la', 'chicago'];   // Only 3 cities for priority
  const generalCities  = ['miami', 'dallas', 'houston', 'atlanta', 'boston'];

  const startUrls: { url: string }[] = [];

  // Priority: specific car+city searches for subscribers
  for (const combo of combos) {
    for (const city of priorityCities) {
      startUrls.push({
        url: `https://www.facebook.com/marketplace/${city}/search?query=${encodeURIComponent(combo)}&category_id=vehicles&sort=CREATION_TIME_DESCEND`
      });
    }
  }

  // General: vehicle browse pages (cheap, broad coverage)
  for (const city of generalCities) {
    startUrls.push({
      url: `https://www.facebook.com/marketplace/${city}/vehicles?sort=CREATION_TIME_DESCEND`
    });
  }

  // Hard cap
  const finalUrls = startUrls.slice(0, MAX_URLS_PER_RUN);

  // 4. Estimate cost and show plan
  const estimatedRequests = finalUrls.length * MAX_RESULTS_PER_URL;
  const proxyLabel = USE_RESIDENTIAL ? 'RESIDENTIAL (expensive)' : 'DATACENTER (cheap)';

  console.log(`\n📋 PLAN:`);
  console.log(`   URLs to scrape  : ${finalUrls.length} (cap: ${MAX_URLS_PER_RUN})`);
  console.log(`   Max results/URL : ${MAX_RESULTS_PER_URL}`);
  console.log(`   Total results   : up to ${RESULTS_LIMIT}`);
  console.log(`   Proxy type      : ${proxyLabel}`);
  console.log(`   Est. requests   : ~${estimatedRequests}`);
  console.log(`   Webhook URL     : ${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/apify`);

  if (DRY_RUN) {
    console.log('\n📍 URLs that WOULD be scraped:');
    finalUrls.forEach((u, i) => console.log(`   ${i + 1}. ${u.url}`));
    console.log('\n✅ Dry run complete. No credits used. Re-run without --dry-run to execute.');
    return;
  }

  // 5. Ask for confirmation
  console.log('');
  const answer = await ask('▶  Start this run? (yes/no): ');
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('❌ Aborted — no credits used.');
    return;
  }

  // 6. Parse cookies
  const rawCookies = process.env.FB_COOKIES || '';
  let cookies: any[] = [];
  try {
    if (rawCookies.replace(/\s/g, '')) {
      cookies = JSON.parse(rawCookies.replace(/\s/g, '').replace(/\\/g, ''));
    }
  } catch {
    console.warn('⚠️  Could not parse FB_COOKIES — running without session cookies.');
  }

  // 7. Build Apify input
  const input = {
    startUrls: finalUrls,
    maxResultsPerQuery: MAX_RESULTS_PER_URL,
    resultsLimit: RESULTS_LIMIT,
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: USE_RESIDENTIAL ? ['RESIDENTIAL'] : ['SHADER'],
    },
    cookies,
    viewPortWidth: 1280,
    viewPortHeight: 720,
  };

  // 8. Start run
  try {
    console.log('\n📡 Starting Apify run...');
    const run = await apifyClient.actor('apify/facebook-marketplace-scraper').start(input, {
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
