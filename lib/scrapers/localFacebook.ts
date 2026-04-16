import { chromium, Browser, Page } from "playwright";
import { prisma } from "../prisma";
import { parseListingText } from "../parser/listingParser";
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

  // Pattern 1: $1,234 (Prefix)
  const symbolRegex = /([\$£€])\s*([\d\s,]+)(?:\s*([kK]))?/g;
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

export async function scrapeLocalMarketplace(
  location: string,
  filters: MarketplaceScrapeFilters = {}
) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: {
      'Referer': 'https://www.google.com/',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  const page = await context.newPage();

  const url = `https://m.facebook.com/marketplace/${location}/vehicles?sortBy=creation_time_descend&exact=false`;
  console.log(`[local-scraper] Searching ${location}...`);

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    
    // --- DIAGNOSTICS ---
    const finalUrl = page.url();
    const pageTitle = await page.title();
    const bodySnippet = await page.evaluate(() => document.body.innerText.substring(0, 300).replace(/\n/g, ' '));
    console.log(`[local-scraper] Current URL: ${finalUrl}`);
    console.log(`[local-scraper] Page Title: ${pageTitle}`);
    console.log(`[local-scraper] Page Snippet: ${bodySnippet}`);

    if (finalUrl.includes("/login/") || pageTitle.includes("Log In") || pageTitle.includes("Connexion")) {
        console.warn(`[local-scraper] ⚠️ REDIRECTED TO LOGIN. Facebook is blocking this IP.`);
    }
    
    // 2. Scroll to load more (Infinite Scroll logic with Modal Bypass)
    const scrollSteps = Math.max(1, Number(process.env.LOCAL_SCROLL_STEPS ?? 25));
    const scrollDelayMs = Math.max(500, Number(process.env.LOCAL_SCROLL_DELAY_MS ?? 1500));
    
    // Wait for at least one listing or a timeout
    console.log(`[local-scraper] Waiting for mobile listing items...`);
    // Mobile selector can be different, so we use a broad search for marketplace item links
    await page.waitForSelector('a[href*="/marketplace/item/"]', { timeout: 15000 }).catch(() => {
        console.warn(`[local-scraper] Timed out waiting for items. Checking if redirected...`);
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
          const items = document.querySelectorAll('a[href*="/marketplace/item/"]');
          if (items.length > 0) {
              items[items.length - 1].scrollIntoView({ behavior: 'smooth' });
          } else {
              window.scrollBy(0, 600 + Math.random() * 400);
          }
        });

        await new Promise(r => setTimeout(r, scrollDelayMs));

        
        if (i % 5 === 0) {
          const count = await page.evaluate(() => document.querySelectorAll('a[href*="/marketplace/item/"]').length);
          console.log(`[local-scraper] Scroll step ${i}: found ${count} items so far.`);
        }
    }

    // 3. Extract IDs and basic data from the grid
    const listings = await page.evaluate(() => {
        // Broad selector: any 'a' tag linking to an item
        const allLinks = Array.from(document.querySelectorAll('a'));
        
        const marketplaceLinks = allLinks.filter(a => {
            const href = a.getAttribute('href') || '';
            return href.includes('/marketplace/item/');
        });

        return marketplaceLinks.map(a => {
            const href = a.getAttribute('href') || '';
            const idMatch = href.match(/\/item\/(\d{10,20})/);
            const externalId = idMatch ? idMatch[1] : null;

            const img = a.querySelector("img");
            
            // Clean up mashed text from the grid
            const tileText = (a.textContent || "").replace(/\n/g, " ").trim();
            const ariaLabel = (a.getAttribute('aria-label') || "").trim();

            return {
                externalId,
                url: href.startsWith('http') ? href : `https://m.facebook.com${href}`,
                imageUrl: img?.src || null,
                title: ariaLabel || tileText.substring(0, 100),
                tileText
            };
        }).filter(x => x.externalId);
    });

    if (listings.length === 0) {
        console.warn(`[local-scraper] No items found for ${location}. Facebook may be blocking or page didn't load.`);
    }

    let upserted = 0;
    const foundCity = MARKETPLACE_CITIES.find(c => c.slug === location);
    const slugLocation = foundCity 
        ? parseCityStateFromLabel(foundCity.label) 
        : { city: location, state: null };

    for (const item of listings) {
        if (!item.externalId) continue;
        
        const fallbackDescription = `AutoPulse local capture: ${item.tileText || item.title}`.substring(0, 2000);
        const parsedPrice = parseTilePriceToCents(item.tileText || item.title || "");
        const postedAt = parseRelativePostedAt(item.tileText);
        
        const parsed = parseListingText(item.title, fallbackDescription);

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
