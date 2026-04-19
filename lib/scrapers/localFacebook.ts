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
  _debugAria: string;
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
  let valCents = Math.round(val * 100);
  if (valCents > 2147400000) return 2147400000; // Cap at max Int to prevent PostgreSQL crashes
  return valCents;
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
  
  const proxyRaw = process.env.FB_PROXY;
  let proxyUrl: string | undefined;
  if (proxyRaw) {
      const proxies = proxyRaw.split(',').map(p => p.trim()).filter(Boolean);
      proxyUrl = proxies[Math.floor(Math.random() * proxies.length)];
  }

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

    // v8.5: High-Volume Deep Scroll
    // We scroll multiple times to load the extra listings needed to populate the site fast
    console.log(`[AutoPulse-v8] 📜 Mega Deep Scroll (20 iterations) for maximum volume...`);
    for (let i = 0; i < 20; i++) {
        await page.evaluate(() => window.scrollBy(0, 1500));
        await page.waitForTimeout(800); // Shorter wait for faster scroll
    }

    const listings: ListingRaw[] = await page.evaluate(() => {
        const found: any[] = [];
        const listingLinks = Array.from(document.querySelectorAll('a[role="link"]'))
                                  .filter(a => a.getAttribute('aria-label')?.includes('listing') || a.getAttribute('href')?.includes('/item/'));

        listingLinks.forEach(el => {
            const href = el.getAttribute('href') || "";
            const ariaLabel = el.getAttribute('aria-label') || "";
            const idMatch = href.match(/\/item\/(\d{10,21})/);
            if (!idMatch) return;
            const id = idMatch[1];
            if (found.some(x => x.externalId === id)) return;

            // Match prices like "$15,000", "15 000 $", "20 000 $US", "CA$5000", "Gratuit", "Free"
            // We use \d+(?:[.,]\d+)* instead of [\d,.]+ to ensure commas are only matches if bounded by digits (prevents grabbing numeric model prefixes right before commas)
            const priceRegex = /(?:(?:[A-Za-z]{1,3})?[\$£€]\s*\d+(?:[.,]\d+)*(?:\s\d{3})*|(?<=\s)\d+(?:[.,]\d+)*(?:\s\d{3})*\s*[\$£€](?:[A-Za-z]{1,3})?(?=\s|,|$)|Gratuit|Free)/i;
            const priceMatch = ariaLabel.match(priceRegex);
            let priceRaw = "0";
            let title = "Unknown Vehicle";
            let locationRaw = "";

            if (priceMatch) {
                priceRaw = priceMatch[0];
                if (priceMatch.index !== undefined) {
                    title = ariaLabel.substring(0, priceMatch.index).trim();
                    locationRaw = ariaLabel.substring(priceMatch.index + priceMatch[0].length).trim().replace(/^[\s,·]+/, '').trim();
                }
            } else {
                // If the regex failed, we DO NOT GUESS pricing based on random numbers.
                // Doing so causes model years or model numbers (like "F-150" or "IS 250") to magically become $150 or $250 prices.
                title = ariaLabel.split(/[,·]/)[0] || ariaLabel; // Just take the first chunk as title
            }

            title = title.replace(/,$/, '').trim() || "Unknown Vehicle";

            // Block motorcycles, ATVs, scooters, and boats
            const blockRegex = /\b(motorcycle|scooter|moped|dirt bike|atv|utv|harley|yamaha|ninja|tao|grom|ducati|kawasaki|vespa|polaris|can-am|sea-doo|ski-doo|snowmobile|rv|camper|trailer)\b/i;
            if (blockRegex.test(title)) return;
            
            found.push({
                externalId: id,
                url: `https://www.facebook.com/marketplace/item/${id}/`,
                imageUrl: (el.querySelector('img') as HTMLImageElement)?.src || null,
                title: title,
                priceRaw: priceRaw,
                locationRaw: locationRaw,
                _debugAria: ariaLabel
            });
        });
        return found;
    });

    console.log(`[AutoPulse-v8] 🎯 Found ${listings.length} raw listings. Dumping first 3 for price debug:`);
    listings.slice(0, 3).forEach(x => {
        console.log(`   -> ARIA: ${x._debugAria}`);
        console.log(`   -> Extracted Title: ${x.title}`);
        console.log(`   -> Extracted Price: ${x.priceRaw}`);
    });

    let upserted = 0;
    const foundCity = MARKETPLACE_CITIES.find(c => c.slug === location);
    
    for (const item of listings) {
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
                city: foundCity?.label.split(',')[0] || location.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                state: foundCity?.label.split(',')[1]?.trim() || "Local",
                listingUrl: item.url,
                imageUrl: item.imageUrl,
                rawTitle: item.title,
                description: `AutoPulse v8 captured: ${item.title}`,
                parsedAt: new Date(),
            }
        });

        const quickParsed = parseListingText(item.title, "");
        const isUnknown = quickParsed.make === "Unknown" || quickParsed.model === "Unknown" || !quickParsed.year;

        // 🛡️ SMART ENRICHMENT GATE:
        // Instead of queueing 100k listings (which caused Redis OOM), 
        // we only queue the important "Unknown" ones that need deep cleaning.
        if (isUnknown) {
            try {
                const enrichQueue = getEnrichmentQueue();
                await enrichQueue.add("enrichListing", { listingId: item.externalId }, { 
                    priority: 5, // Lower priority for deep cleaning
                    removeOnComplete: true 
                });
            } catch (e) {}
        } else {
            // Already identified! Trigger matching immediately.
            try {
                const matchQueue = getAlertMatchQueue();
                await matchQueue.add("matchListing", { listingId: item.externalId }, { 
                    removeOnComplete: true,
                    jobId: `match-fast-${item.externalId}`
                });
            } catch (e) {}
        }
        
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
    const cookieString = process.env.FB_COOKIES; // New: Bypass Data Wall
    
    const launchOptions: any = { 
        args: [
            '--disable-blink-features=AutomationControlled', 
            '--no-sandbox',
            '--disable-notifications'
        ],
        headless: true 
    };
    if (proxyUrl) launchOptions.proxy = { server: proxyUrl };

    const browser = await chromium.launch(launchOptions);
    
    // Inject session if available
    let cookies: any[] = [];
    if (cookieString) {
        try {
            // Support both JSON array and key=value strings
            if (cookieString.startsWith('[')) {
                cookies = JSON.parse(cookieString);
            } else {
                cookies = cookieString.split(';').map(pair => {
                    const [name, value] = pair.trim().split('=');
                    return { name, value, domain: '.facebook.com', path: '/' };
                });
            }
        } catch (e) {
            console.error("[AutoPulse] ⚠️ Invalid FB_COOKIES format. Continuing as guest.");
        }
    }

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 }
    });

    if (cookies.length > 0) {
        await context.addCookies(cookies);
        console.log(`[AutoPulse-v8] 🛡️  Session Injected (${cookies.length} cookies). Bypassing data wall...`);
    }

    const page = await context.newPage();

    try {
        await page.goto(listing.listingUrl, { waitUntil: 'networkidle', timeout: 60000 });
        
        // 1. Proactively dismiss login modals and popups
        try {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
            
            // Look for 'Close' (X) buttons on modals
            const closeButtons = [
                'div[aria-label="Fermer"]',
                'div[aria-label="Close"]',
                'div[role="button"]:has-text("Close")',
                'div.x92483t[role="button"]' // Common FB modal close class
            ];
            for (const selector of closeButtons) {
                const btn = page.locator(selector);
                if (await btn.count() > 0) {
                    await btn.first().click();
                    console.log(`[AutoPulse-v8] 🛡️  Dismissed login modal via ${selector}`);
                    await page.waitForTimeout(500);
                }
            }
        } catch (e) {}

        // 2. Expand Description ("Voir plus" / "See more")
        try {
            const seeMore = page.locator('div[role="button"]:has-text("Voir plus"), div[role="button"]:has-text("See more"), div:has-text("... Voir plus")');
            if (await seeMore.count() > 0) {
                await seeMore.first().click();
                await page.waitForTimeout(1500); // Wait for text to actually appear (Facebook React hydration)
                console.log(`[AutoPulse-v8] 📂 Expanded "See more" description.`);
            }
        } catch (e) {}

        const details = await page.evaluate(() => {
            const spans = Array.from(document.querySelectorAll('span'));
            
            // 1. Description extraction (Maximum Robustness)
            let descriptionText = "";
            const titleLower = document.title.toLowerCase();
            
            // Look for blocks with large amounts of text that aren't navigation or login prompts
            const allTextBlocks = Array.from(document.querySelectorAll('div, span'))
                .map(el => (el as HTMLElement).innerText?.trim() || "")
                .filter(t => t.length > 50 && t.length < 5000);

            const filteredBlocks = allTextBlocks.filter(t => {
                const low = t.toLowerCase();
                if (low.includes('log in') || low.includes('sign up') || low.includes('privacy') || low.includes('terms')) return false;
                if (low.includes('see more photos') || low.includes('listed in') || low.includes('seller information')) return false;
                return true;
            });

            // Find the longest block that isn't the whole page container
            descriptionText = filteredBlocks.sort((a,b) => b.length - a.length)[0] || "";
            
            // 2. Timing extraction
            const timeRaw = spans.find(s => /published|listed|il y a|ago/i.test(s.innerText))?.innerText || null;
            
            // 3. Image extraction
            const imageEls = Array.from(document.querySelectorAll('img'))
                .filter(img => img.src?.includes('scontent') && img.width > 200)
                .map(img => img.src);
            
            // 4. Structured Details (Specs Matrix)
            // Facebook often uses spans next to each other for Key: Value
            const specList = Array.from(document.querySelectorAll('[role="listitem"], .x193iq5w, .x1n2onr6'))
                .map(el => (el as HTMLElement).innerText?.trim())
                .filter(t => t && t.length > 2 && t.length < 100);
            
            // Specific search for "About this vehicle" block
            const aboutH2 = spans.find(s => /about this vehicle|à propos de ce véhicule/i.test(s.innerText));
            let aboutText = "";
            if (aboutH2) {
                let curr = aboutH2.parentElement;
                for(let i=0; i<5 && curr; i++) {
                    if (curr.innerText.length > aboutH2.innerText.length + 20) {
                        aboutText = curr.innerText;
                        break;
                    }
                    curr = curr.parentElement;
                }
            }

            return {
                description: descriptionText || null,
                images: Array.from(new Set(imageEls)).slice(0, 15),
                timeRaw,
                listItems: Array.from(new Set(specList)),
                aboutVehicleText: aboutText
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
        const combinedText = `${listing.rawTitle} ${details.aboutVehicleText} ${finalDesc} ${details.listItems.join(" ")}`;
        const parsed = parseListingText(listing.rawTitle || "", combinedText);
        const postedAt = parseRelativeTime(details.timeRaw);
        
        // Manual spec extraction from list items for extra safety
        const mileageItem = details.listItems.find(t => t.toLowerCase().includes('miles') || t.toLowerCase().includes('km') || t.toLowerCase().includes('kilométrage'));
        const transmissionItem = details.listItems.find(t => t.toLowerCase().includes('transmission') || t.toLowerCase().includes('boîte'));
        
        // Advanced: Search for numbers followed by 'k' or 'miles' in the full description if missing
        let extraMileage = null;
        if (!parsed.mileage && !mileageItem) {
            const m = finalDesc.match(/(\d{1,3}k?)\s*miles/i) || finalDesc.match(/(\d{1,3}k)\b/i);
            if (m) {
                const val = m[1].toLowerCase();
                extraMileage = val.includes('k') ? parseInt(val.replace('k', ''), 10) * 1000 : parseInt(val, 10);
            }
        }

        const finalMileage = parsed.mileage || (mileageItem ? parseInt(mileageItem.replace(/\D/g, ''), 10) : extraMileage) || listing.mileage;
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

/**
 * Hyper Sync ⚡: Processes multiple listings concurrently while blocking standard web assets (CSS/Images)
 * to achieve up to 10x extraction speed.
 */
export async function enrichListingsBulkLocally(listingIds: string[], concurrency: number = 5) {
    if (listingIds.length === 0) return 0;
    console.log(`[AutoPulse-v8] ⚡ HYPER SYNC: Enriching ${listingIds.length} listings with concurrency ${concurrency}...`);
    
    let totalSuccess = 0;
    const proxyRaw = process.env.FB_PROXY;
    let proxyUrl: string | undefined;
    if (proxyRaw) {
        const proxies = proxyRaw.split(',').map(p => p.trim()).filter(Boolean);
        proxyUrl = proxies[Math.floor(Math.random() * proxies.length)];
    }
    const cookieString = process.env.FB_COOKIES;
    
    // Hyper-optimized Chromium parameters to prevent lag
    const launchOptions: any = { 
        args: [
            '--disable-blink-features=AutomationControlled', 
            '--no-sandbox',
            '--disable-notifications',
            '--disable-extensions',
            '--disable-gpu',
            '--blink-settings=imagesEnabled=false'
        ],
        headless: true 
    };
    if (proxyUrl) {
        launchOptions.proxy = { server: proxyUrl };
        console.log(`[AutoPulse-v8] 🌐 Bulk Enrichment using Proxy: ${proxyUrl.split('@').pop()}`);
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 }
    });

    if (cookieString) {
        try {
            let cookies = cookieString.startsWith('[') ? JSON.parse(cookieString) : cookieString.split(';').map(p => {
                const [name, value] = p.trim().split('=');
                return { name, value, domain: '.facebook.com', path: '/' };
            });
            await context.addCookies(cookies);
            console.log(`[AutoPulse-v8] 🛡️ Session Injected. Bypassing data wall...`);
        } catch (e) {}
    }

    // Process chunk by chunk based on concurrency
    for (let i = 0; i < listingIds.length; i += concurrency) {
        const chunk = listingIds.slice(i, i + concurrency);
        
        await Promise.all(chunk.map(async (listingId) => {
            const page = await context.newPage();
            
            // ⚡ HYPER OPTIMIZATION: Abort all images, media, CSS, and fonts
            await page.route('**/*.{png,jpg,jpeg,webp,gif,css,svg,woff,woff2,mp4}', route => route.abort());

            try {
                const listing = await prisma.listing.findUnique({ where: { externalId: listingId } });
                if (!listing) return;

                await page.goto(listing.listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                
                // Dismiss modals
                try {
                    const closeBtn = page.locator('div[aria-label="Fermer"], div[aria-label="Close"], .x92483t[role="button"]');
                    if (await closeBtn.count() > 0) await closeBtn.first().click({ timeout: 1000 });
                } catch (e) {}

                // Expand "See more"
                try {
                    const seeMore = page.locator('div[role="button"]:has-text("Voir plus"), div[role="button"]:has-text("See more"), div:has-text("... Voir plus")');
                    if (await seeMore.count() > 0) await seeMore.first().click({ timeout: 1000 });
                } catch (e) {}
                
                await page.waitForTimeout(500);

                const details = await page.evaluate(() => {
                    const spans = Array.from(document.querySelectorAll('span'));
                    
                    let descriptionText = "";
                    const titleLower = document.title.toLowerCase();
                    const allTextBlocks = Array.from(document.querySelectorAll('div, span'))
                        .map(el => (el as HTMLElement).innerText?.trim() || "")
                        .filter(t => t.length > 50 && t.length < 5000);

                    const filteredBlocks = allTextBlocks.filter(t => {
                        const low = t.toLowerCase();
                        if (low.includes('log in') || low.includes('sign up')) return false;
                        if (low.includes('see more photos') || low.includes('listed in')) return false;
                        return true;
                    });
                    descriptionText = filteredBlocks.sort((a,b) => b.length - a.length)[0] || "";
                    
                    const timeRaw = spans.find(s => /published|listed|il y a|ago/i.test(s.innerText))?.innerText || null;
                    const specList = Array.from(document.querySelectorAll('[role="listitem"], .x193iq5w, .x1n2onr6'))
                        .map(el => (el as HTMLElement).innerText?.trim())
                        .filter(t => t && t.length > 2 && t.length < 100);
                    
                    const aboutH2 = spans.find(s => /about this vehicle|à propos de ce véhicule/i.test(s.innerText));
                    let aboutText = "";
                    if (aboutH2) {
                        let curr = aboutH2.parentElement;
                        for(let i=0; i<3 && curr; i++) {
                            if (curr.innerText.length > aboutH2.innerText.length + 10) { aboutText = curr.innerText; break; }
                            curr = curr.parentElement;
                        }
                    }

                    return {
                        description: descriptionText || null,
                        timeRaw,
                        listItems: Array.from(new Set(specList)),
                        aboutVehicleText: aboutText
                    };
                });

                const parseRelativeTime = (raw: string | null): Date | null => {
                    if (!raw) return null;
                    const now = new Date();
                    const match = raw.toLowerCase().match(/(\d+)\s*(hour|min|day|week|heures?|jours?|semaines?)/i);
                    if (!match) return null;
                    const num = parseInt(match[1], 10), unit = match[2];
                    if (unit.includes('hour') || unit.includes('heure')) now.setHours(now.getHours() - num);
                    else if (unit.includes('min')) now.setMinutes(now.getMinutes() - num);
                    else if (unit.includes('day') || unit.includes('jour')) now.setDate(now.getDate() - num);
                    else if (unit.includes('week') || unit.includes('semaine')) now.setDate(now.getDate() - (num * 7));
                    return now;
                };

                const finalDesc = details.description || listing.description || "";
                const combinedText = `${listing.rawTitle} ${details.aboutVehicleText} ${finalDesc} ${details.listItems.join(" ")}`;
                const parsed = parseListingText(listing.rawTitle || "", combinedText);
                const postedAt = parseRelativeTime(details.timeRaw);
                
                const mileageItem = details.listItems.find(t => t.toLowerCase().includes('miles') || t.toLowerCase().includes('km') || t.toLowerCase().includes('kilométrage'));
                let extraMileage = null;
                if (!parsed.mileage && !mileageItem) {
                    const m = finalDesc.match(/(\d{1,3}k?)\s*miles/i) || finalDesc.match(/(\d{1,3}k)\b/i);
                    if (m) {
                        const val = m[1].toLowerCase();
                        extraMileage = val.includes('k') ? parseInt(val.replace('k', ''), 10) * 1000 : parseInt(val, 10);
                    }
                }
                const finalMileage = parsed.mileage || (mileageItem ? parseInt(mileageItem.replace(/\D/g, ''), 10) : extraMileage) || listing.mileage;

                await prisma.listing.update({
                    where: { externalId: listingId },
                    data: {
                        description: finalDesc,
                        rawDescription: finalDesc,
                        mileage: finalMileage,
                        transmission: parsed.transmission || listing.transmission,
                        fuelType: parsed.fuelType || listing.fuelType,
                        driveType: parsed.driveType || listing.driveType,
                        titleStatus: parsed.titleStatus || listing.titleStatus,
                        condition: parsed.condition || listing.condition,
                        postedAt: postedAt || listing.postedAt,
                        features: parsed.features,
                        updatedAt: new Date(),
                    }
                });

                try {
                    const matchQueue = getAlertMatchQueue();
                    await matchQueue.add("matchListing", { listingId: listingId }, { removeOnComplete: true });
                } catch (e) {}

                console.log(`[AutoPulse-v8] ✨ HYPER SYNC OK: ${listingId} | ${details.timeRaw || 'Unk'}`);
                totalSuccess++;

            } catch (err) {
                console.warn(`[AutoPulse-v8] ⚠️ Bulk Extract failed for ${listingId}: Timeout or Closed.`);
            } finally {
                await page.close();
            }
        }));

        // Jitter between chunks (avoid FB ban)
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500));
    }

    await browser.close();
    return totalSuccess;
}
