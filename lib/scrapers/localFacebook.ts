import { chromium, Browser, Page } from "playwright";
import { prisma } from "../prisma";
import { parseListingText, isJunkTitle } from "../parser/listingParser";
import { MarketplaceScrapeFilters } from "./facebook";
import { MARKETPLACE_CITIES } from "../cities";
import { getAlertMatchQueue } from "../queue";

function parseRawMoneyToken(rawToken: string, hasK: boolean): number {
  // Replace space and non-breaking space
  const raw = rawToken.replace(/[\s\u00A0,]/g, "");
  let dollars = Number(raw);
  
  if (!Number.isFinite(dollars) || dollars <= 0) return 0;
  if (hasK) dollars *= 1000;
  return dollars;
}

export function parseTilePriceToCents(text: string): number {
  if (!text) return 0;
  const cleanText = text.replace(/\u00A0/g, " ");
  const candidates: { val: number, multiplier: number, index: number }[] = [];

  // Pattern 1: $1,234 (Prefix) - Now strictly stops at first space to avoid merging with Year
  const symbolRegex = /([\$£€])\s*([\d,]+(?:\.\d{2})?)(?:\s*([kK]))?/g;
  for (const m of cleanText.matchAll(symbolRegex)) {
    const symbol = m[1];
    const val = parseRawMoneyToken(m[2] || "", Boolean(m[3]));
    let multiplier = 1.0;
    if (symbol === "£") multiplier = 1.27;
    if (symbol === "€") multiplier = 1.08;
    if (val >= 1 && val < 500000) candidates.push({ val, multiplier, index: m.index ?? 0 });
  }

  // Pattern 2: 1 234 $US (Suffix)
  const suffixRegex = /([\d\s,]+)\s*(?:\$|USD|\$US|£|£GB|€|EUR)(?:\s*([kK]))?/gi;
  for (const m of cleanText.matchAll(suffixRegex)) {
    const fullMatch = m[0].toUpperCase();
    const val = parseRawMoneyToken(m[1] || "", Boolean(m[2]));
    let multiplier = 1.0;
    if (fullMatch.includes("£") || fullMatch.includes("GBP")) multiplier = 1.27;
    if (fullMatch.includes("€") || fullMatch.includes("EUR")) multiplier = 1.08;
    if (val >= 1 && val < 500000) candidates.push({ val, multiplier, index: m.index ?? 0 });
  }

  if (/free/i.test(cleanText) && candidates.length === 0) return 0;
  if (candidates.length === 0) return 0;
  
  // Choose the best candidate:
  // 1. Filter out those that are likely years (1900-2099) IF we have other options.
  const nonYearCandidates = candidates.filter(c => c.val < 1900 || c.val > 2100);
  const best = nonYearCandidates.length > 0 ? nonYearCandidates[0] : candidates[0];
  
  return Math.round(best.val * best.multiplier * 100);
}


function parseRelativePostedAt(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = raw.match(/\b(?:about\s+)?(?:an?|(\d+))\s+(minute|min|hour|hr|day|week|mo|month)s?(\s+ago)?\b/i);
  if (m) {
    const isSingle = !m[1] || m[1].toLowerCase() === 'a' || m[1].toLowerCase() === 'an';
    const n = isSingle ? 1 : Number(m[1]);
    const unit = (m[2] || "").toLowerCase();
    let deltaMs = 0;
    if (unit.startsWith("min")) deltaMs = n * 60 * 1000;
    else if (unit.startsWith("h")) deltaMs = n * 60 * 60 * 1000;
    else if (unit.startsWith("day")) deltaMs = n * 24 * 60 * 60 * 1000;
    else if (unit.startsWith("week")) deltaMs = n * 7 * 24 * 60 * 60 * 1000;
    else if (unit.startsWith("mo")) deltaMs = n * 30 * 24 * 60 * 60 * 1000;
    if (deltaMs > 0) return new Date(Date.now() - deltaMs);
  }
  if (/yesterday/i.test(raw)) return new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (/just now/i.test(raw)) return new Date();
  return null;
}

function parseCityStateFromLabel(label: string | undefined): {
  city: string | null;
  state: string | null;
} {
  if (!label) return { city: null, state: null };
  const parts = label.split(",").map((x) => x.trim());
  return { city: parts[0] || null, state: parts[1] || null };
}

function chooseString(candidate: string | null | undefined, fallback?: string | null): string | undefined {
  if (candidate && candidate.trim().length > 0) return candidate;
  if (fallback && fallback.trim().length > 0) return fallback;
  return undefined;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("ETIMEDOUT") || msg.includes("connection") || msg.includes("pool")) {
        console.warn(`[DB-Retry] Attempt ${i+1}/${retries} failed. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Edge/122.0.0.0',
];

export class FacebookAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FacebookAuthError";
  }
}

export async function scrapeLocalMarketplace(
  location: string,
  filters: MarketplaceScrapeFilters = {}
) {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const browser = await chromium.launch({ 
    headless: process.env.SCRAPER_HEADLESS !== 'false',
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent: ua,
    viewport: { 
      width: 1280 + Math.floor(Math.random() * 100), 
      height: 900 + Math.floor(Math.random() * 100) 
    },
    extraHTTPHeaders: {
      'Referer': 'https://www.facebook.com/',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  // Inject Facebook session cookies
  const fbCookiesEnv = process.env.FB_COOKIES;
  if (fbCookiesEnv) {
    try {
      const raw = JSON.parse(fbCookiesEnv);
      const cookies = (Array.isArray(raw) ? raw : Object.values(raw)).map((c: any) => ({
        name: String(c.name),
        value: String(c.value),
        domain: String(c.domain || '.facebook.com').replace(/^\.?/, '.'),
        path: String(c.path || '/'),
        expires: c.expirationDate ? Math.floor(Number(c.expirationDate))
                 : c.expires       ? Math.floor(Number(c.expires))
                 : -1,
        httpOnly: Boolean(c.httpOnly),
        secure: Boolean(c.secure ?? true),
        sameSite: (c.sameSite === 'no_restriction' ? 'None' : (c.sameSite === 'lax' ? 'Lax' : (c.sameSite === 'strict' ? 'Strict' : 'Lax'))) as any,
      }));
      await context.addCookies(cookies);
      console.log(`[local-scraper] ✅ Loaded ${cookies.length} Facebook cookies`);
    } catch (e) {
      console.warn(`[local-scraper] ⚠️ Failed to parse FB_COOKIES:`, e);
    }
  } else {
    console.warn(`[local-scraper] ⚠️ FB_COOKIES not set — IP redirect highly likely.`);
  }

  const page = await context.newPage();

  const url = `https://www.facebook.com/marketplace/${location}/vehicles?sortBy=creation_time_descend&exact=false`;
  console.log(`[local-scraper] Searching ${location}...`);

    try {
        await page.goto(url, { waitUntil: 'load', timeout: 90000 });
        
        // --- DIAGNOSTICS ---
        const finalUrl = page.url();
        const pageTitle = await page.title();
        
        // Wait for the JS shell to actually hydrate content (must see "Marketplace" or similar)
        console.log(`[local-scraper] Waiting for JS hydration (checking for Marketplace keywords)...`);
        await page.waitForFunction(() => {
            const txt = document.body.innerText;
            return txt.length > 500 && (txt.includes("Marketplace") || txt.includes("Vehicles"));
        }, { timeout: 30000 }).catch(() => {
            console.warn(`[local-scraper] Body still lacks content after 30s wait.`);
        });

        const bodySnippet = await page.evaluate(() => document.body.innerText.substring(0, 500).replace(/\n/g, ' '));
        console.log(`[local-scraper] [v2.1] Current URL: ${finalUrl}`);
        console.log(`[local-scraper] Page Title: ${pageTitle}`);
        console.log(`[local-scraper] Page Snippet length: ${bodySnippet.length}`);
        console.log(`[local-scraper] Page Snippet: ${bodySnippet}`);

        // --- RELIABILITY: Multi-stage Session Bypass ---
        // If we land on a login page OR a transition page (crypted_string), we need to click "Continue"
        let loopCount = 0;
        const maxLoops = 5;
        let bypassSuccessful = false;

        while (loopCount < maxLoops) {
            const currentUrl = page.url();
            const currentTitle = await page.title();
            
            if (!currentUrl.includes("/login/") && !currentUrl.includes("crypted_string") && !currentTitle.includes("Log In")) {
                if (loopCount > 0) console.log(`[local-scraper] ✅ Multi-stage bypass complete. URL: ${currentUrl}`);
                bypassSuccessful = true;
                break;
            }

            console.log(`[local-scraper] 🛡️ Bypass Step ${loopCount + 1}: Currently at ${currentUrl}`);
            
            const continueSelectors = [
                'text="Continue"',
                'div[role="button"]:has-text("Continue")',
                'div[role="button"]:has-text("Continuer")',
                'div[role="button"]:has-text("Confirm")',
                '[aria-label*="Continue"]',
                'button:has-text("Not Now")',
                'div[role="button"]:has-text("OK")'
            ];
            
            let actionTaken = false;
            for (const sel of continueSelectors) {
                try {
                    const btn = page.locator(sel).first();
                    if (await btn.isVisible()) {
                        console.log(`[local-scraper] 🔄 Clicking confirmation button: "${sel}"...`);
                        await btn.click({ force: true });
                        await page.waitForTimeout(5000); // Wait for transition
                        actionTaken = true;
                        break; 
                    }
                } catch (e) { /* ignore */ }
            }

            if (!actionTaken) {
                console.warn(`[local-scraper] ⚠️ No bypass buttons found on step ${loopCount + 1}.`);
                // If it's a login page but no button is found, we might be truly blocked
                if (currentUrl.includes("/login/")) break;
                // If it's a transition page, wait a bit more
                await page.waitForTimeout(3000);
            }

            loopCount++;
        }

        // Final settling and re-navigation
        if (bypassSuccessful || loopCount > 0) {
            const currentUrl = page.url();
            if (!currentUrl.includes("/marketplace/")) {
                console.log(`[local-scraper] 🔄 Final re-navigation to target Marketplace: ${url}`);
                await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
            }
        }

        // --- RELIABILITY: Wait for actual listing data ---
        console.log(`[local-scraper] Waiting for listing grid hydration (Price symbols or Marketplace content)...`);
        const hasData = await page.waitForFunction(() => {
            const txt = document.body.innerText;
            return txt.includes("$") || 
                   txt.includes("£") || 
                   txt.includes("€") ||
                   txt.includes("Vehicles") ||
                   document.querySelector('a[href*="/marketplace/item/"]') !== null;
        }, { timeout: 20000 }).catch(() => false);

        if (!hasData) {
            const debugText = await page.evaluate(() => document.body.innerText.substring(0, 500).replace(/\s+/g, ' '));
            const debugUrl = page.url();
            console.warn(`[local-scraper] ⚠️ No listings detected. URL: ${debugUrl} | Snippet: ${debugText}`);
        }
    
    // 2. Scroll to load more (Infinite Scroll logic with Modal Bypass)
    const scrollSteps = Math.max(1, Number(process.env.LOCAL_SCROLL_STEPS ?? 25));
    const scrollDelayMs = Math.max(1000, Number(process.env.LOCAL_SCROLL_DELAY_MS ?? 2500));
    
    // Wait for at least one listing or a timeout
    // Wait for at least one price symbol to appear
    console.log(`[local-scraper] Waiting for listing elements ($ symbol)...`);
    await page.waitForFunction(() => document.body.innerText.includes("$"), { timeout: 15000 }).catch(() => {
        console.warn(`[local-scraper] No price symbols ($) found on page after 15s.`);
    });

    console.log(`[local-scraper] Starting robust infinite scroll for ${scrollSteps} steps...`);
    
    for (let i = 0; i < scrollSteps; i++) {
        // Bypass Facebook's scroll lock modal or login prompts
        await page.evaluate(() => {
          document.body.style.overflow = 'auto';
          document.documentElement.style.overflow = 'auto';
          
          // 1. Force remove blocking overlays/modals that dim the screen
          const overlays = document.querySelectorAll('div[data-testid="mask"], div[class*="x1n2onr6"]');
          overlays.forEach(ov => (ov as HTMLElement).style.display = 'none');

          const dialogs = document.querySelectorAll('div[role="dialog"]');
          dialogs.forEach(d => {
              // Only remove if it contains login-related words or is a large modal
              const text = d.textContent?.toLowerCase() || "";
              if (text.includes("login") || text.includes("connexion") || text.includes("account") || text.includes("cookies")) {
                  (d as HTMLElement).style.display = 'none';
              }
          });
          
          // 2. SCROLL Strategy: Mobile friendly scroll
          const items = document.querySelectorAll('a[href*="/marketplace/item/"], [role="link"]');
          if (items.length > 0) {
              items[items.length - 1].scrollIntoView({ behavior: 'smooth' });
          } else {
              window.scrollBy(0, 600 + Math.random() * 400);
          }
        });

        await new Promise(r => setTimeout(r, scrollDelayMs));

        
        if (i % 5 === 0) {
          const count = await page.evaluate(() => {
              const text = document.body.innerText;
              const matches = text.match(/\$/g) || [];
              return matches.length;
          });
          console.log(`[local-scraper] Scroll step ${i}: found ~${count} price tags so far.`);
        }
    }

    // 3. Extract IDs and data from the raw HTML (more reliable than DOM evaluation on mobile FB)
    const rawHtml = await page.content();
    console.log(`[local-scraper] Raw HTML size: ${rawHtml.length} chars`);

    // Sample a small slice of the HTML to understand what's in it
    const htmlSnippet = rawHtml.replace(/\s+/g, ' ').substring(0, 300);
    console.log(`[local-scraper] HTML snippet: ${htmlSnippet}`);

    type ListingRaw = { externalId: string; url: string; imageUrl: string | null; title: string; tileText: string; description?: string | null };
    const listings: ListingRaw[] = [];
    const seenIds = new Set<string>();

    // --- Strategy 1: Find /item/NNNNN anywhere in the raw HTML ---
    // Desktop FB uses href="/marketplace/item/123456" (no trailing slash) or in JSON blobs
    // The (?=[^\d]) lookahead ensures we don't grab partial numbers
    const itemIdPattern = /\/item\/(\d{10,21})(?=[^\d])/g;
    let idMatch: RegExpExecArray | null;
    while ((idMatch = itemIdPattern.exec(rawHtml)) !== null) {
        const externalId = idMatch[1];
        if (seenIds.has(externalId)) continue;
        seenIds.add(externalId);

        // Pull surrounding context (up to 1600 chars around the ID occurrence)
        const ctxStart = Math.max(0, idMatch.index - 800);
        const ctxEnd = Math.min(rawHtml.length, idMatch.index + 800);
        const context = rawHtml.substring(ctxStart, ctxEnd);

        // Title — prefer explicit marketplace key; only fall back to generic "name" when price is also present
        const strictTitleMatch =
            context.match(/"marketplace_listing_title"\s*:\s*"([^"]{3,120})"/) ||
            context.match(/"listing_title"\s*:\s*"([^"]{3,120})"/);

        // Price — compute early so we can gate the "name" fallback on it
        const priceMatchEarly =
            context.match(/"amount"\s*:\s*"(\d+(?:\.\d+)?)"/) ||
            context.match(/\$\s*([\d,]+)/);
        const priceValueEarly = parseFloat((priceMatchEarly?.[1] || '0').replace(/,/g, ''));

        // Only use generic "name" field when a real price is present (blocks French category nav)
        const nameFallback = priceValueEarly > 0
            ? context.match(/"name"\s*:\s*"([^"]{5,120})"/) ?? null
            : null;
        const titleMatch = strictTitleMatch || nameFallback;

        // Price (using the early-check value already computed)
        const priceMatch = priceMatchEarly;
        const priceValue = priceValueEarly;

        // Image — uri field pointing to CDN jpg/png/webp
        const imgRaw = 
            context.match(/"primary_listing_photo"\s*:\s*{\s*"image"\s*:\s*{\s*"uri"\s*:\s*"(https:[^",]{10,}?\.(?:jpg|jpeg|png|webp)[^",]*)"/) ||
            context.match(/"preferred_thumbnail"\s*:\s*{\s*"image"\s*:\s*{\s*"uri"\s*:\s*"(https:[^",]{10,}?\.(?:jpg|jpeg|png|webp)[^",]*)"/) ||
            context.match(/"uri"\s*:\s*"(https:[^",]{10,}?\.(?:jpg|jpeg|png|webp)[^",]*)"/);
        const imageUrl = imgRaw ? imgRaw[1].split('\\/').join('/') : null;
        
        // VISUAL GUARD: Skip new discovery listings if they have no image
        if (!imageUrl || imageUrl.trim().length === 0) {
            console.log(`[local-scraper] ⏭️ Skipping listing without image: "${externalId}"`);
            continue;
        }

        // Description — look for dedicated text fields in the proximity
        const descMatch = 
            context.match(/"listing_description"\s*:\s*{\s*"text"\s*:\s*"([^"]{10,10000}?)"\s*}/) ||
            context.match(/"redacted_description"\s*:\s*{\s*"text"\s*:\s*"([^"]{10,10000}?)"\s*}/) ||
            context.match(/"description"\s*:\s*{\s*"text"\s*:\s*"([^"]{10,10000}?)"\s*}/);
        
        const rawDescription = descMatch ? descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) : null;

        // Must have BOTH a parseable price > 0 AND a title to be a real vehicle listing
        if (!titleMatch || priceValue <= 0) continue;

        const rawTitle = titleMatch![1];
        const title = rawTitle.replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).trim();

        // Skip known junk: category nav names, generic fallback titles
        // JUNK GUARD: Filter placeholders like "Marketplace Listing" or category nav nodes
        if (isJunkTitle(title)) {
            console.log(`[local-scraper] ⏭️ Skipping junk listing: "${title}"`);
            continue;
        }

        const priceStr = priceMatch?.[1] || '';
        const tileText = `$${priceStr} ${title}`;

        console.log(`[local-scraper] ✅ Listing: ${externalId} | "${title.substring(0, 60)}" | $${priceStr}`);
        listings.push({
            externalId,
            url: `https://www.facebook.com/marketplace/item/${externalId}/`,
            imageUrl,
            title: title.substring(0, 100),
            tileText,
            description: rawDescription
        });
    }

    // --- Strategy 2: Fallback — find IDs from "id":"NNNNN" JSON pattern ---
    // Sometimes FB only embeds IDs without the /item/ URL (e.g., in feed edge nodes)
    if (listings.length === 0) {
        console.log('[local-scraper] Strategy 1 (href IDs) found nothing, trying JSON ID pattern...');
        const jsonIdPattern = /"id"\s*:\s*"(\d{14,21})"/g;
        let jsonMatch: RegExpExecArray | null;
        while ((jsonMatch = jsonIdPattern.exec(rawHtml)) !== null) {
            const externalId = jsonMatch[1];
            if (seenIds.has(externalId)) continue;

            const ctxStart = Math.max(0, jsonMatch.index - 500);
            const ctxEnd = Math.min(rawHtml.length, jsonMatch.index + 800);
            const context = rawHtml.substring(ctxStart, ctxEnd);

            const titleMatch =
                context.match(/"marketplace_listing_title"\s*:\s*"([^"]{3,120})"/) ||
                context.match(/"listing_title"\s*:\s*"([^"]{3,120})"/);  // no generic "name" fallback here
            const priceMatch = context.match(/"amount"\s*:\s*"(\d+(?:\.\d+)?)"/);
            const priceValue2 = parseFloat((priceMatch?.[1] || '0').replace(/,/g, ''));
            const imgRaw2 = context.match(/"uri"\s*:\s*"(https:[^",]{10,}?\.(?:jpg|jpeg|png|webp)[^",]*)"/);
            const imageUrl = imgRaw2 ? imgRaw2[1].split('\\/').join('/') : null;

            // Description for Strategy 2
            const descMatch2 = 
                context.match(/"listing_description"\s*:\s*{\s*"text"\s*:\s*"([^"]{10,2000}?)"\s*}/) ||
                context.match(/"redacted_description"\s*:\s*{\s*"text"\s*:\s*"([^"]{10,2000}?)"\s*}/) ||
                context.match(/"description"\s*:\s*{\s*"text"\s*:\s*"([^"]{10,2000}?)"\s*}/);
            
            const rawDescription2 = descMatch2 ? descMatch2[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) : null;

            if (!titleMatch || priceValue2 <= 0) continue;

            const rawTitle = titleMatch![1];
            const title = rawTitle.replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).trim();
            // JUNK GUARD: Filter placeholders like "Marketplace Listing" or category nav nodes
            if (isJunkTitle(title)) {
                console.log(`[local-scraper] ⏭️ Skipping junk listing: "${title}"`);
                continue;
            }

            seenIds.add(externalId);
            const priceStr = priceMatch![1];
            const tileText = `$${priceStr} ${title}`;

            console.log(`[local-scraper] ✅ JSON Listing: ${externalId} | "${title.substring(0, 60)}" | $${priceStr}`);
            listings.push({
                externalId,
                url: `https://www.facebook.com/marketplace/item/${externalId}/`,
                imageUrl,
                title: title.substring(0, 100),
                tileText,
                description: rawDescription2
            });
        }
    }

    console.log(`[local-scraper] Total extracted: ${listings.length} listings`);

    if (listings.length === 0) {
        console.warn(`[local-scraper] No items found for ${location}. Facebook may be blocking or page didn't load.`);
    } else {
        console.log(`[local-scraper] Extracted sample item: PriceParsed=${parseTilePriceToCents(listings[0].tileText)} Title="${listings[0].title}" Img=${listings[0].imageUrl?.substring(0, 50)}...`);
    }

    let upserted = 0;
    const foundCity = MARKETPLACE_CITIES.find(c => c.slug === location);
    const slugLocation = foundCity 
        ? parseCityStateFromLabel(foundCity.label) 
        : { city: location, state: null };

    for (const item of listings) {
        if (!item.externalId) continue;
        
        const fallbackDescription = item.description || `AutoPulse local capture: ${item.tileText || item.title}`.substring(0, 2000);
        const parsedPrice = parseTilePriceToCents(item.tileText || item.title || "");

        // Skip zero-price listings — these are junk/FREE nav entries that slipped through
        if (parsedPrice <= 0) {
            console.log(`[local-scraper] ⏭️ Skipping zero-price entry: ${item.externalId} "${item.title}"`);
            continue;
        }
        const postedAt = parseRelativePostedAt(item.tileText);
        
        const parsed = parseListingText(item.title, fallbackDescription);

        // Skip if the parser couldn't identify a real make — these show as "Marketplace Listing" in the UI
        if (!parsed.make || parsed.make === 'Unknown') {
            console.log(`[local-scraper] ⏭️ Unparseable make, skipping: "${item.title}"`);
            continue;
        }

        // SEMANTIC DEDUPLICATION: Skip if a listing with identical specs already exists
        const duplicate = await prisma.listing.findFirst({
            where: {
                make: parsed.make,
                model: parsed.model,
                year: parsed.year,
                price: parsedPrice,
                mileage: parsed.mileage,
                city: slugLocation.city,
            },
            select: { externalId: true }
        });

        if (duplicate && duplicate.externalId !== item.externalId) {
            console.log(`[local-scraper] ⏭️ Semantic duplicate found (different ID), skipping: "${item.title}" ($${parsedPrice/100})`);
            continue;
        }

        await withRetry(() => prisma.listing.upsert({
            where: { externalId: item.externalId as string },
            update: {
                price: parsedPrice > 0 ? parsedPrice : undefined,
                imageUrl: item.imageUrl || undefined,
                features: parsed.features,
                rawTitle: item.title,
                rawDescription: fallbackDescription,
                postedAt: postedAt || undefined,
                parseScore: parsed.parseScore,
                updatedAt: new Date(),
            },
            create: {
                externalId: item.externalId as string,
                source: "facebook",
                make: parsed.make || "Unknown",
                model: parsed.model || "Unknown",
                year: parsed.year || 0,
                price: parsedPrice,
                mileage: parsed.mileage,
                city: slugLocation.city ?? location,
                state: slugLocation.state,
                listingUrl: item.url,
                imageUrl: item.imageUrl,
                description: fallbackDescription,
                postedAt: postedAt,
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
                owners: parsed.owners,
                accidents: parsed.accidents,
                features: parsed.features,
                rawTitle: item.title,
                rawDescription: fallbackDescription,
                parseScore: parsed.parseScore,
                parsedAt: new Date(),
            }
        }));

        // Trigger reactive alert matching
        try {
          const alertQueue = getAlertMatchQueue();
          await alertQueue.add("matchListing", { listingId: item.externalId as string }, {
            removeOnComplete: true,
            jobId: `match-${item.externalId as string}`
          });
        } catch (queueErr) {
          console.error(`[local-scraper] Failed to queue alert match for ${item.externalId as string}:`, queueErr);
        }

        upserted++;
        if (upserted % 10 === 0) {
            console.log(`[local-scraper] ${location}: Progress ${upserted}/${listings.length} saved.`);
        }
    }
    console.log(`[local-scraper] ${location}: Successfully upserted ${upserted} listings.`);

    // Enrichment is now handled on-demand by the user to save resources
    /*
    const enrichLimit = Math.max(0, Number(process.env.LOCAL_ENRICH_LIMIT ?? 10));
    ...
    console.log(`[local-scraper] Enriched ${enriched}/${candidates.length} listings in ${location}.`);
    */

    await browser.close();
    return { scraped: listings.length, upserted };
  } catch (error) {
    console.error(`[local-scraper] Failed for ${location}:`, error);
    await browser.close();
    throw error;
  }
}

export async function enrichListingLocally(url: string) {
  console.log(`[local-enrichment] Visiting ${url}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  });
  try {
    const page = await context.newPage();
    
    // Lightweight Mode: Block heavy assets for speed
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'font', 'media', 'stylesheet', 'other'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    const data = await enrichListingWithPage(page, url);
    await page.close();
    await browser.close();
    return data;
  } catch (error) {
    console.error(`[local-enrichment] Failed for ${url}:`, error);
    await browser.close();
    return null;
  }
}

async function enrichListingWithPage(page: Page, url: string) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait for the main content to appear
        await page.waitForSelector('div[role="main"]', { timeout: 10000 }).catch(() => {});
        
        // Strategy: Click "See More" if it exists to expand the description
        const seeMoreSelectors = [
            'div[role="button"]:has-text("See More")',
            'div[role="button"]:has-text("Voir plus")',
            'div[role="button"]:has-text("Afficher plus")',
            'span:has-text("See More")',
            'span:has-text("Voir plus")'
        ];
        
        for (const selector of seeMoreSelectors) {
            try {
                const btn = page.locator(selector).first();
                if (await btn.isVisible()) {
                    await btn.click();
                    await page.waitForTimeout(500); // Wait for expansion
                    break;
                }
            } catch (e) { /* ignore */ }
        }

        const data = await page.evaluate(() => {
            const getMeta = (prop: string) => document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') || 
                                          document.querySelector(`meta[name="${prop}"]`)?.getAttribute('content');
            
            const ogTitle = getMeta('og:title');
            const ogDesc = getMeta('og:description');
            const ogImg = getMeta('og:image');
            const bodyText = document.body?.innerText || "";
            
            // Primary: The specific data-testid for descriptions
            // Secondary:dir="auto" blocks within the marketplace details area
            const domDesc = document.querySelector('div[data-testid="marketplace_listing_description"]')?.textContent ||
                            document.querySelector('div[dir="auto"] > span[dir="auto"]')?.parentElement?.textContent ||
                            Array.from(document.querySelectorAll('div[dir="auto"]')).find(el => el.textContent?.length && el.textContent.length > 100)?.textContent;

            const conditionMatch = bodyText.match(/Condition\s*\n\s*([A-Za-z ]+)/i) || 
                                   bodyText.match(/État\s*\n\s*([A-Za-z ]+)/i);
            const condition = conditionMatch?.[1]?.trim() || null;

            const relTime =
              bodyText.match(/\b\d+\s*(?:minute|min|hour|hr|day|week)s?\s+ago\b/i)?.[0] || null;
            const locationMatch =
              bodyText.match(/\bin\s+([A-Za-z .'-]+),\s*([A-Z]{2})\b/) ||
              bodyText.match(/\b([A-Za-z .'-]+),\s*([A-Z]{2})\b/);

            return {
                description: (domDesc && domDesc.length > (ogDesc?.length || 0)) ? domDesc.substring(0, 3000) : ogDesc?.substring(0, 3000) || null,
                imageUrl: ogImg || null,
                ogTitle: ogTitle || null,
                relativePostedText: relTime,
                city: locationMatch?.[1]?.trim() || null,
                state: locationMatch?.[2]?.trim() || null,
                condition: condition,
            };
        });

        if (data.description?.includes("Marketplace is a convenient destination")) {
            data.description = null;
        }
        
        const postedAt = parseRelativePostedAt(data.relativePostedText);
        const priceCents = parseTilePriceToCents(
          `${data.ogTitle || ""} ${data.description || ""}`,
        );
        
        return {
          description: data.description,
          imageUrl: data.imageUrl,
          postedAt,
          priceCents,
          detailTitle: data.ogTitle,
          city: data.city,
          state: data.state,
          condition: data.condition,
        };
    } catch (error) {
        console.error(`[local-enrichment] Page error for ${url}:`, error);
        return null;
    }
}
