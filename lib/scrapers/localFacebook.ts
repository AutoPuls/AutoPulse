import { chromium, Browser, Page } from "playwright";
import { prisma } from "../prisma";
import { parseListingText } from "../parser/listingParser";
import { MarketplaceScrapeFilters } from "./facebook";
import { MARKETPLACE_CITIES } from "../cities";
import { getAlertMatchQueue } from "../queue";
  
/**
 * AutoPulse Scraper Engine v8.0
 * Optimized for mbasic.facebook.com to bypass redirect loops and login walls.
 */

interface ListingRaw {
  externalId: string;
  url: string;
  imageUrl: string | null;
  title: string;
  priceRaw: string;
  locationRaw: string;
}

// Reuse the highly tested price parser from the previous iteration
export function parseTilePriceToCents(text: string): number {
  if (!text) return 0;
  const cleanText = text.replace(/\u00A0/g, " ").replace(/[\s\u00A0,]/g, "");
  const match = cleanText.match(/([\$£€])\s*([\d.]+)([kK])?/);
  if (!match) {
    const fallback = cleanText.match(/([\d.]+)/);
    if (!fallback) return 0;
    return Math.round(parseFloat(fallback[1]) * 100);
  }
  let val = parseFloat(match[2]);
  if (match[3]) val *= 1000;
  return Math.round(val * 100);
}

async function getStoredSession() {
  try {
    const session = await prisma.scraperSession.findUnique({
      where: { id: "facebook-default" }
    });
    return (session?.cookies as any[]) || null;
  } catch (e) { return null; }
}

async function saveStoredSession(cookies: any[]) {
  try {
    await prisma.scraperSession.upsert({
      where: { id: "facebook-default" },
      update: { cookies, updatedAt: new Date() },
      create: { id: "facebook-default", cookies, updatedAt: new Date() }
    });
  } catch (e) {}
}

export async function scrapeLocalMarketplace(
  location: string,
  filters: MarketplaceScrapeFilters = {}
) {
  console.log(`[AutoPulse-v8] 🚀 Launching Engine for "${location}"...`);
  
  const browser = await chromium.launch({ 
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    headless: true 
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 }
  });

  const cookies = await getStoredSession();
  if (cookies) {
      await context.addCookies(cookies.map(c => ({
          ...c,
          domain: String(c.domain || '.facebook.com').replace(/^\.?/, '.'),
          sameSite: 'Lax' as any
      })));
      console.log(`[AutoPulse-v8] 🔑 Injected ${cookies.length} session cookies.`);
  }

  const page = await context.newPage();
  
  // v8.1: Corrected mbasic search URL parameters
  const forcedId = FORCED_LOCATION_IDS[location] || '108130915873615'; // Default NYC
  const searchUrl = `https://mbasic.facebook.com/marketplace/search/?query=car&location_id=${forcedId}`;
  
  try {
    console.log(`[AutoPulse-v8] 🔍 Protocol: MBASIC | Target: ${searchUrl}`);
    const response = await page.goto(searchUrl, { waitUntil: 'commit', timeout: 60000 });
    
    // Check for Auth Wall on MBASIC
    if (page.url().includes('/login/')) {
        console.warn(`[AutoPulse-v8] ⚠️ Auth Wall hit. Purging cookies and retrying as Guest...`);
        await context.clearCookies();
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    // Diagnostics: What kind of links do we see?
    const linkCount = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a')).map(a => a.href).slice(0, 10);
        console.log(`[local-eval] Diagnostic: Found ${document.querySelectorAll('a').length} links. Sample: ${links.join(', ')}`);
        return links.length;
    });

    // Wait for basic content
    await page.waitForSelector('a', { timeout: 15000 }).catch(() => {});

    // MBASIC "Accept" Bypass
    const acceptBtn = page.locator('input[value="Accept"], button:has-text("Accept"), button:has-text("Agree"), a:has-text("Accept")').first();
    if (await acceptBtn.isVisible()) {
        await acceptBtn.click();
        await page.waitForTimeout(3000);
    }

    const listings: ListingRaw[] = await page.evaluate(() => {
        const found: any[] = [];
        // MBASIC grid items can be generic links with item IDs
        document.querySelectorAll('a').forEach(el => {
            const href = el.getAttribute('href') || "";
            // Broaden ID match for mbasic URLs
            const idMatch = href.match(/(?:\/item\/|listing_id=|id=)(\d{14,21})/);
            if (!idMatch) return;
            
            const id = idMatch[1];
            if (found.some(x => x.externalId === id)) return;

            // MBASIC specific traversal: Find the nearest text block
            const text = el.innerText || el.parentElement?.innerText || "";
            if (!text.includes('$')) return; // Likely not a listing

            found.push({
                externalId: id,
                url: `https://www.facebook.com/marketplace/item/${id}/`,
                imageUrl: (el.querySelector('img') as HTMLImageElement)?.src || null,
                title: text.split('\n')[0] || "Unknown Car",
                priceRaw: text.match(/\$[\d,kK]+/)?.[0] || "0",
                locationRaw: text.split('\n').pop() || ""
            });
        });
        return found;
    });

    console.log(`[AutoPulse-v8] 🎯 Found ${listings.length} raw listings.`);

    let upserted = 0;
    const foundCity = MARKETPLACE_CITIES.find(c => c.slug === location);
    
    for (const item of listings.slice(0, 50)) {
        const priceCents = parseTilePriceToCents(item.priceRaw);
        if (priceCents <= 0) continue;

        const parsed = parseListingText(item.title, item.title); // Basic parse first
        
        await prisma.listing.upsert({
            where: { externalId: item.externalId },
            update: {
                price: priceCents,
                updatedAt: new Date(),
            },
            create: {
                externalId: item.externalId,
                source: "facebook",
                make: parsed.make || "Unknown",
                model: parsed.model || "Unknown",
                year: parsed.year || 0,
                price: priceCents,
                city: foundCity?.label.split(',')[0] || location,
                state: foundCity?.label.split(',')[1]?.trim() || null,
                listingUrl: item.url,
                imageUrl: item.imageUrl,
                rawTitle: item.title,
                description: `AutoPulse v8 captured: ${item.title}`,
                parsedAt: new Date(),
            }
        });

        // Queue enrichment if needed
        try {
            const q = getAlertMatchQueue();
            await q.add("matchListing", { listingId: item.externalId }, { removeOnComplete: true });
        } catch (e) {}
        
        upserted++;
    }

    // Save session if we got updated cookies
    const newCookies = await context.cookies();
    if (newCookies.some(c => c.name === 'c_user')) {
        await saveStoredSession(newCookies);
    }

    console.log(`[AutoPulse-v8] ✅ City "${location}" complete. Scraped=${listings.length}, Upserted=${upserted}`);
    await browser.close();
    return { scraped: listings.length, upserted };

  } catch (err) {
    console.error(`[AutoPulse-v8] ❌ Critical Failure for "${location}":`, err);
    await browser.close();
    throw err;
  }
}

export async function enrichListingLocally(url: string) {
    console.log(`[AutoPulse-v8] 📈 Enrichment placeholder for ${url}`);
    return {
        imageUrl: null,
        description: null,
        postedAt: null,
        priceCents: 0
    };
}
