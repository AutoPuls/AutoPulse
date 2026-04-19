import "../envBootstrap";
import { chromium, Browser, Page } from "playwright";
import { prisma } from "../prisma";
import { parseListingText } from "../parser/listingParser";
import { MarketplaceScrapeFilters } from "./facebook";
import { MARKETPLACE_CITIES } from "../cities";
import { getAlertMatchQueue, getEnrichmentQueue } from "../queue";
  
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
  // Support both $1,500 and 1 500 $ formats
  const cleanText = text.replace(/\u00A0/g, " ").replace(/[\s\u00A0,.](?=\d)/g, "").replace(/\s/g, "");
  const match = cleanText.match(/([\$£€])?([\d,.]+)([\$£€])?([kK])?/);
  
  if (!match) return 0;
  
  let valStr = match[2].replace(/,/g, "");
  let val = parseFloat(valStr);
  if (isNaN(val)) return 0;
  
  if (match[4] && (match[4].toLowerCase() === 'k')) val *= 1000;
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

const FORCED_LOCATION_IDS: Record<string, string> = {
  'chicago': '106149489415840',
  'new-york-city': '108130915873615',
  'los-angeles': '107657905929318',
  'houston': '111663085526836',
  'phoenix': '110682055627705',
  'philadelphia': '104033232967165',
  'san-antonio': '111750692176462',
  'san-diego': '115450848466606',
  'dallas': '110196722340360',
};

export async function scrapeLocalMarketplace(
  location: string,
  filters: MarketplaceScrapeFilters = {}
) {
  console.log(`[AutoPulse-v8] 🚀 Launching Engine for "${location}"...`);
  
  const proxyUrl = process.env.FB_PROXY;
  const launchOptions: any = { 
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    headless: true 
  };
  if (proxyUrl) {
      launchOptions.proxy = { server: proxyUrl };
      console.log(`[AutoPulse-v8] 🌐 Using proxy: ${proxyUrl.split('@').pop()}`);
  }

  const browser = await chromium.launch(launchOptions);
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
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
  
  // v8.2: Connect the console bridge
  page.on('console', msg => {
    if (msg.text().includes('[local-eval]')) {
        console.log(msg.text());
    }
  });
  
  // Priority to www.facebook.com (Guest mode is active there)
  const searchUrl = `https://www.facebook.com/marketplace/${location}/vehicles/?sortBy=creation_time_descend`;
  
  try {
    // Basic stealth script to prevent immediate detection
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    console.log(`[AutoPulse-v8] 🔍 Protocol: STANDARD | Target: ${searchUrl}`);
    
    // v8.5: Stealth Landing (Go to Google first to establish a clean Referer)
    try {
        await page.goto('https://www.google.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1000 + Math.random() * 2000);
    } catch (e) {}

    const response = await page.goto(searchUrl, { 
        waitUntil: 'networkidle', 
        timeout: 60000,
        referer: 'https://www.google.com/'
    });
    
    // v8.4: Dismiss potential Login/Cookie modals
    await page.waitForTimeout(3000); 
    try {
        // Press Escape to dismiss generic modals
        await page.keyboard.press('Escape');
        
        // Wait and dismiss the "X" on the login prompt if it exists
        const dismissBtn = page.locator('div[aria-label="Fermer"], div[aria-label="Close"], [role="button"]:has-text("Not Now"), .x1i10hfl[role="button"]');
        if (await dismissBtn.count() > 0) {
            await dismissBtn.first().click();
            console.log(`[AutoPulse-v8] 🛡️ Dismissed login modal.`);
        }
    } catch (e) {}

    // v8.4: Floodlight Diagnostics
    await page.evaluate(() => {
        try {
            const title = document.title;
            const bodySnippet = document.body ? document.body.innerText.substring(0, 300).replace(/\n/g, ' ') : "NO BODY";
            console.log(`[local-eval] Diagnostic: Title="${title}" | URL="${window.location.href}"`);
        } catch (e) {}
    });

    // Final check for dead login wall
    if (page.url().includes('login') && !page.url().includes('marketplace')) {
        console.warn(`[AutoPulse-v8] ❌ Hard login wall hit even with referrer. Trying Search-URL strategy...`);
        const id = FORCED_LOCATION_IDS[location] || '106149489415840';
        const fallbackUrl = `https://www.facebook.com/marketplace/search/?query=vehicles&location_id=${id}&exact=false`;
        await page.goto(fallbackUrl, { waitUntil: 'networkidle', referer: 'https://www.google.com/' });
        
        // Final fallback to base marketplace
        if (page.url().includes('login')) {
            console.warn(`[AutoPulse-v8] ❌ Still at login. One last attempt at base Marketplace...`);
            await page.goto(`https://www.facebook.com/marketplace/`, { waitUntil: 'domcontentloaded' });
        }
    }

    // Scroll to load dynamic content
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);

    const listings: ListingRaw[] = await page.evaluate(() => {
        const found: any[] = [];
        // Standard marketplace uses aria-label on the link to describe the item
        const listingLinks = Array.from(document.querySelectorAll('a[role="link"]'))
                                  .filter(a => a.getAttribute('aria-label')?.includes('listing') || a.getAttribute('href')?.includes('/item/'));

        listingLinks.forEach(el => {
            const href = el.getAttribute('href') || "";
            const ariaLabel = el.getAttribute('aria-label') || "";
            
            // v8.4: Extract ID from URL
            const idMatch = href.match(/\/item\/(\d{10,21})/);
            if (!idMatch) return;
            
            const id = idMatch[1];
            if (found.some(x => x.externalId === id)) return;

            // v8.4: High-fidelity parsing from aria-label
            // Format can be: "Year Make Model, [Price], [Location], listing [ID]"
            // Or "Year Make Model · [Price] · [Location]" (Modern FB)
            const cleaners = ariaLabel.split(/[·,]+/).map(p => p.trim());
            
            // If aria-label is weak, fallback to elements
            const title = cleaners[0] || el.querySelector('span')?.innerText || "Unknown Vehicle";
            // Robust price match: look for currency symbols or "Free" or digits with separators
            const priceMatch = ariaLabel.match(/([\$£€]?\s*[\d\s,.]+\s*[\$£€]?|Gratuit|Free)/i);
            const priceRaw = priceMatch ? priceMatch[0] : "0";
            const locationRaw = cleaners[2] || "";

            found.push({
                externalId: id,
                url: `https://www.facebook.com/marketplace/item/${id}/`,
                imageUrl: (el.querySelector('img') as HTMLImageElement)?.src || null,
                title: title,
                priceRaw: priceRaw,
                locationRaw: locationRaw
            });
        });
        return found;
    });

    console.log(`[AutoPulse-v8] 🎯 Found ${listings.length} raw listings.`);

    let upserted = 0;
    const foundCity = MARKETPLACE_CITIES.find(c => c.slug === location);
    
    for (const item of listings.slice(0, 100)) {
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

        // Queue enrichment instead of matching directly to get full info (most recent cars)
        try {
            const enrichQueue = getEnrichmentQueue();
            await enrichQueue.add("enrichListing", { listingId: item.externalId }, { removeOnComplete: true });
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

export async function enrichListingLocally(listingId: string) {
    console.log(`[AutoPulse-v8] 📈 Deep Enrichment for ${listingId}...`);
    
    const listing = await prisma.listing.findUnique({
        where: { externalId: listingId }
    });
    if (!listing) return null;

    const proxyUrl = process.env.FB_PROXY;
    const launchOptions: any = { 
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
        headless: true 
    };
    if (proxyUrl) launchOptions.proxy = { server: proxyUrl };

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    try {
        await page.goto(listing.listingUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        // 1. Dismiss initial modals & wait for primary content
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1500); // Shorter wait

        // 2. Expand Description ("Voir plus" / "See more")
        try {
            const seeMore = page.locator('div[role="button"]:has-text("Voir plus"), div[role="button"]:has-text("See more")');
            if (await seeMore.count() > 0) {
                await seeMore.first().click();
                await page.waitForTimeout(300); // Fast expansion
            }
        } catch (e) {}

        const details = await page.evaluate(() => {
            // Helper to get text from various layouts
            const spans = Array.from(document.querySelectorAll('span'));
            
            // 1. Description extraction
            // Look for the block that either follows "Description" or is the largest text block in the side panel
            const descriptionHeader = spans.find(s => 
                s.innerText.includes('Description fournie') || 
                s.innerText.includes('Description by') ||
                s.innerText.includes('Seller\'s description')
            );
            
            let descriptionText = "";
            if (descriptionHeader) {
                // Usually the next div/span is the content
                const parent = descriptionHeader.parentElement;
                if (parent && parent.nextElementSibling) {
                    descriptionText = (parent.nextElementSibling as HTMLElement).innerText || "";
                }
            }
            
            if (!descriptionText || descriptionText.length < 5) {
                // Fallback: search for the largest block in the side sidebar
                const sidePanel = document.querySelector('div[role="main"] + div, div.x1gslojk');
                if (sidePanel) {
                    const longSpans = Array.from(sidePanel.querySelectorAll('span')).filter(s => s.innerText.length > 50);
                    descriptionText = longSpans[0]?.innerText || "";
                }
            }
            
            // 2. Timing extraction (e.g., "Publié il y a 4 heures" / "Listed 2 hours ago")
            const timeSpan = spans.find(s => 
                s.innerText.includes('Publié') || 
                s.innerText.includes('Listed') || 
                s.innerText.includes('il y a') ||
                s.innerText.includes('ago')
            );
            
            // 3. Image extraction (high res)
            const imageEls = Array.from(document.querySelectorAll('img')).filter(img => img.src?.includes('scontent') && img.width > 300).map(img => img.src);
            
            // 4. Structured Details (Mileage, etc.)
            const listItems = Array.from(document.querySelectorAll('[role="listitem"]')).map(el => (el as HTMLElement).innerText);
            
            return {
                description: descriptionText || null,
                images: Array.from(new Set(imageEls)).slice(0, 10),
                timeRaw: timeSpan?.innerText || null,
                listItems: listItems
            };
        });

        // Helper: Convert relative time to Date
        const parseRelativeTime = (raw: string | null): Date | null => {
            if (!raw) return null;
            const now = new Date();
            const low = raw.toLowerCase();
            const match = low.match(/(\d+)\s*(hour|min|day|week|heures?|jours?|semaines?)/i);
            if (!match) return null;
            
            const num = parseInt(match[1], 10);
            const unit = match[2];
            
            if (unit.includes('hour') || unit.includes('heure')) now.setHours(now.getHours() - num);
            else if (unit.includes('min')) now.setMinutes(now.getMinutes() - num);
            else if (unit.includes('day') || unit.includes('jour')) now.setDate(now.getDate() - num);
            else if (unit.includes('week') || unit.includes('semaine')) now.setDate(now.getDate() - (num * 7));
            
            return now;
        };

        const finalDesc = details.description || listing.description || "";
        const combinedText = `${listing.rawTitle} ${finalDesc} ${details.listItems.join(" ")}`;
        const parsed = parseListingText(listing.rawTitle || "", combinedText);
        const postedAt = parseRelativeTime(details.timeRaw);
        
        // Manual spec extraction from list items for extra safety
        const mileageItem = details.listItems.find(t => t.toLowerCase().includes('miles') || t.toLowerCase().includes('km') || t.toLowerCase().includes('kilométrage'));
        const transmissionItem = details.listItems.find(t => t.toLowerCase().includes('transmission') || t.toLowerCase().includes('boîte'));
        
        const finalMileage = parsed.mileage || (mileageItem ? parseInt(mileageItem.replace(/\D/g, ''), 10) : listing.mileage);
        const finalTransmission = parsed.transmission || (transmissionItem?.toLowerCase().includes('auto') ? 'automatic' : transmissionItem?.toLowerCase().includes('man') ? 'manual' : listing.transmission);

        await prisma.listing.update({
            where: { externalId: listingId },
            data: {
                description: finalDesc,
                rawDescription: finalDesc,
                mileage: finalMileage,
                transmission: finalTransmission,
                fuelType: parsed.fuelType || listing.fuelType,
                driveType: parsed.driveType || listing.driveType,
                titleStatus: parsed.titleStatus || listing.titleStatus,
                condition: parsed.condition || listing.condition,
                imageUrl: details.images[0] || listing.imageUrl,
                postedAt: postedAt || listing.postedAt,
                updatedAt: new Date(),
            }
        });

        console.log(`[AutoPulse-v8] ✨ Deep Sync OK: ${listingId} | Time: ${details.timeRaw || 'Unknown'} | Desc: ${finalDesc.substring(0, 30)}...`);
        return true;

    } catch (err) {
        console.error(`[AutoPulse-v8] ❌ Enrichment failed for ${listingId}:`, err);
        return false;
    } finally {
        await browser.close();
    }
}
