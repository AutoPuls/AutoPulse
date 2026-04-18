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

async function getStoredSession() {
    try {
        const session = await prisma.scraperSession.findUnique({
            where: { id: "facebook-default" }
        });

        if (session && session.cookies) {
            const cookies = session.cookies as any[];
            // Basic health check: must have c_user or xs to be valid
            const isAuth = cookies.some(c => c.name === 'c_user');
            if (isAuth) {
                console.log(`[local-scraper] 🔑 Valid session found in database.`);
                return cookies;
            } else {
                console.warn(`[local-scraper] ⚠️ Session in DB appears unauthenticated (missing c_user). Skipping...`);
            }
        }
    } catch (e) {
        console.warn(`[local-scraper] ⚠️ Failed to load session from DB:`, e);
    }
    return null;
}

async function saveStoredSession(cookies: any[]) {
    try {
        await prisma.scraperSession.upsert({
            where: { id: "facebook-default" },
            update: { cookies, updatedAt: new Date() },
            create: { id: "facebook-default", cookies, updatedAt: new Date() }
        });
        console.log(`[local-scraper] 💾 Saved session to database (${cookies.length} cookies).`);
    } catch (e) {
        console.warn(`[local-scraper] ⚠️ Failed to save session to DB:`, e);
    }
}

interface ListingRaw {
    externalId: string;
    url: string;
    imageUrl: string | null;
    title: string;
    tileText: string;
    description: string | null;
}

async function performHeadlessLogin(page: Page): Promise<boolean> {
    const email = process.env.FB_EMAIL;
    const password = process.env.FB_PASSWORD;

    if (!email || !password) {
        console.error(`[local-scraper] 🚨 FB_EMAIL or FB_PASSWORD missing. Cannot perform auto-login.`);
        return false;
    }

    console.log(`[local-scraper] 🔐 Starting automated login for ${email.substring(0, 3)}...`);
    
    try {
        await page.goto("https://m.facebook.com/login", { waitUntil: 'load', timeout: 60000 });
        
        // 1. Determine if we are on a login form or an account chooser
        const formOrButton = await Promise.race([
            page.waitForSelector('input[name="email"]', { timeout: 8000 }).then(() => 'form').catch(() => null),
            page.waitForSelector('input[name="m_ts"]', { timeout: 8000 }).then(() => 'form').catch(() => null), // Mobile hidden field
            // Prioritize "Log In" or "Use another profile" to get to the actual form
            page.waitForSelector('button:has-text("Log In"), [role="button"]:has-text("Log In"), text="Use another profile"', { timeout: 8500 }).then(() => 'force-form').catch(() => null),
            page.waitForSelector('[role="button"]:has-text("Continue"), [aria-label*="Continue"]', { timeout: 8500 }).then(() => 'button').catch(() => null),
            page.waitForTimeout(9000).then(() => 'none')
        ]);

        if (formOrButton === 'force-form' || formOrButton === 'button') {
            const selector = formOrButton === 'force-form' 
                ? 'button:has-text("Log In"), [role="button"]:has-text("Log In"), text="Use another profile"' 
                : '[role="button"]:has-text("Continue"), [aria-label*="Continue"]';
            
            console.log(`[local-scraper] 🔄 Account chooser detected (${formOrButton}). Clicking to reveal form...`);
            await page.locator(selector).first().click({ force: true });
            await page.waitForTimeout(5000);
        }

        // 2. NUCLEAR RESET: If still no form, clear cookies and try one more fresh navigate
        let emailInput = page.locator('input[name="email"], #m_login_email').first();
        if (!(await emailInput.isVisible({ timeout: 2000 }).catch(() => false))) {
            console.warn(`[local-scraper] 🧨 Form still hidden after interaction. Clearing cookies and trying fresh login...`);
            await page.context().clearCookies();
            await page.goto("https://m.facebook.com/login", { waitUntil: 'load', timeout: 30000 });
            emailInput = page.locator('input[name="email"], #m_login_email').first();
        }

        // 3. Handle potential Cookie Banners (Common in Datacenters/EU)
        const cookieBanner = page.locator('button[data-cookiebanner="accept_button"], button:has-text("Allow all cookies"), button:has-text("Accept All")').first();
        if (await cookieBanner.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log(`[local-scraper] 🍪 Cookie banner detected. Clearing it...`);
            await cookieBanner.click().catch(() => {});
            await page.waitForTimeout(1000);
        }

        // 4. Now try to fill the form if it is visible
        if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await emailInput.fill(email);
            await page.fill('input[name="pass"], #m_login_password', password);
            await page.waitForTimeout(1000 + Math.random() * 1000);
            
            console.log(`[local-scraper] ⌨️ Submitting mobile form via Enter key...`);
            await page.keyboard.press('Enter');
            
            // Backup: Try clicking the button too
            const loginBtn = page.locator('button[name="login"], #loginbutton, [type="submit"], button[value="Log In"]').first();
            await loginBtn.click({ force: true, timeout: 3000 }).catch(() => {
                console.log(`[local-scraper] ℹ️ Button click skipped (likely handled by Enter key).`);
            });

            await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
        } else {
            console.log(`[local-scraper] ❓ No login form visible after nuclear reset. URL: ${page.url()}.`);
        }
        
        return true;
    } catch (e) {
        console.error(`[local-scraper] 🚨 performHeadlessLogin failed:`, e);
        return false;
    }
}

export async function scrapeLocalMarketplace(
  location: string,
  filters: MarketplaceScrapeFilters = {}
) {
  // Use a strictly Mobile Chrome User Agent for better Chromium compatibility
  const ua = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
  
  const browser = await chromium.launch({ 
    args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
    ],
    headless: true,
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    viewport: { 
      width: 390, 
      height: 844 
    },
    extraHTTPHeaders: {
      'Referer': 'https://m.facebook.com/',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  let cookiesToLoad = await getStoredSession();
  if (!cookiesToLoad) {
    const fbCookiesEnv = process.env.FB_COOKIES;
    if (fbCookiesEnv) {
        try {
            const raw = JSON.parse(fbCookiesEnv);
            cookiesToLoad = (Array.isArray(raw) ? raw : Object.values(raw));
        } catch (e) { /* ignore */ }
    }
  }

  if (cookiesToLoad) {
      const mapped = cookiesToLoad.map((c: any) => ({
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
      await context.addCookies(mapped);
      console.log(`[local-scraper] injected ${mapped.length} session cookies.`);
  }

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.text().includes('[local-eval]')) {
        console.log(msg.text());
    }
  });

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

  const forcedId = FORCED_LOCATION_IDS[location];
  const url = forcedId 
    ? `https://m.facebook.com/marketplace/${location}/search/?query=car&location_id=${forcedId}&vertical=CARS_AND_TRUCKS`
    : `https://m.facebook.com/marketplace/${location}/search/?query=car&vertical=CARS_AND_TRUCKS`;
    
  console.log(`[local-scraper] Searching ${location}...`);

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 90000 });
    
    let loopCount = 0;
    let lastUrl = "";
    let stuckCount = 0;

    while (loopCount < 20) {
      const currentUrl = page.url();
      if (currentUrl.includes("/marketplace/")) break;
      
      // Stuck Detection: If URL hasn't changed for multiple loops, force a reload
      if (currentUrl === lastUrl) {
          stuckCount++;
      } else {
          stuckCount = 0;
          lastUrl = currentUrl;
      }

      // Phase 1: Detailed Diagnostics
      const screenInfo = await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button, [role="button"]'))
                           .find(el => {
                               const t = el.textContent?.toLowerCase() || "";
                               return t.includes('continue') || t.includes('confirm') || t.includes('accept') || t.includes('agree');
                           });
          return {
              title: document.title,
              buttonText: btn?.textContent?.trim() || "None",
              bodySnippet: document.body.innerText.substring(0, 150).replace(/\n/g, ' ')
          };
      });
      console.log(`[local-eval] Screen State: URL=${currentUrl} | Title="${screenInfo.title}" | Button="${screenInfo.buttonText}" | Snip="${screenInfo.bodySnippet}"`);

      // NEW: Login Wall Detection & Guest Mode Fallback
      if (currentUrl.includes("/login/") || screenInfo.bodySnippet.toLowerCase().includes("log in")) {
          console.log(`[local-eval] Bypass Phase: Login Wall detected. Purging session and forcing Mobile Guest Mode...`);
          await context.clearCookies();
          // Force the mobile subdomain and add a Referer to look organic
          const guestUrl = `https://m.facebook.com/marketplace/${location}/search/?query=car&vertical=CARS_AND_TRUCKS`;
          await page.setExtraHTTPHeaders({ 
              'Referer': 'https://www.google.com/',
              'Accept-Language': 'en-US,en;q=0.9'
          });
          await page.goto(guestUrl, { waitUntil: 'networkidle', timeout: 60000 });
          await page.waitForTimeout(7000);
          loopCount++;
          continue;
      }

      if (stuckCount > 3) {
          console.log(`[local-eval] Bypass Phase: Stuck on same state for 3 loops. Reloading page...`);
          await page.reload({ waitUntil: 'load' });
          stuckCount = 0;
          await page.waitForTimeout(3000);
          loopCount++;
          continue;
      }

      // Phase 2: Pre-emptive Dialog / Overlay Nuke
      await page.evaluate(() => {
          const overlays = document.querySelectorAll('div[role="dialog"], div[aria-modal="true"], div[class*="x78zum5"]');
          overlays.forEach(el => {
              const text = el.textContent?.toLowerCase() || "";
              if (text.includes('log in') || text.includes('continue') || text.includes('confirm') || text.includes('accept')) {
                   // Possible interactive element, don't hide yet
              } else {
                   (el as HTMLElement).style.display = 'none';
                   (el as HTMLElement).style.zIndex = '-1';
              }
          });
      });

      const continueBtn = page.locator('button:has-text("Continue"), [role="button"]:has-text("Continue"), [role="button"]:has-text("Confirm"), button:has-text("Confirm"), button:has-text("Accept"), button:has-text("Agree")').first();
      
      if (await continueBtn.isVisible()) {
        console.log(`[local-eval] Bypass Phase: Found "${screenInfo.buttonText}". Attempting Nuclear Click...`);
        try {
            await continueBtn.click({ force: true, timeout: 5000 });
        } catch (e) {
            await continueBtn.evaluate(el => (el as HTMLElement).click());
        }
        await page.waitForTimeout(3000);
      } else {
        await page.waitForTimeout(2000);
        if (!page.url().includes("/marketplace/")) {
             console.log(`[local-eval] Bypass Phase: No button visible, but not on marketplace. Retrying...`);
        } else {
             break;
        }
      }
      loopCount++;
    }

    const newCookies = await context.cookies();
    if (newCookies.some(c => c.name === 'c_user')) {
      await saveStoredSession(newCookies);
    }

    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 5000));
    const cityLabel = location.replace(/-/g, ' ');
    const isStuck = location !== 'san-francisco' && 
                    !pageText.toLowerCase().includes(cityLabel.toLowerCase()) && 
                    (pageText.includes("San Francisco") || pageText.includes("Menlo Park"));

    if (isStuck) {
      console.log(`[local-scraper] 📍 Location mismatch (Stuck in SF). Overriding...`);
      try {
        const locBtn = page.locator('text=/San Francisco|Menlo Park|CA/i').first();
        if (await locBtn.isVisible()) {
          await locBtn.click();
          await page.waitForTimeout(3000);
          const input = page.locator('input[type="text"]').first();
          if (await input.isVisible()) {
            await input.fill(cityLabel);
            await page.waitForTimeout(2000);
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
            await page.waitForTimeout(2000);
            const apply = page.locator('div[role="button"]:has-text("Apply")').first();
            if (await apply.isVisible()) await apply.click();
            await page.waitForTimeout(5000);
          }
        }
      } catch (e) { await page.keyboard.press('Escape'); }
    }

    await page.evaluate(() => {
      document.querySelectorAll('div[role="dialog"], div[class*="x1n2onr6"]').forEach(d => {
        if (d.textContent?.toLowerCase().includes("location") || d.textContent?.toLowerCase().includes("login")) {
          (d as HTMLElement).style.display = 'none';
        }
      });
    });

    await page.waitForFunction(() => {
      const t = document.body.innerText;
      return (t.includes("$") || t.includes("Vehicles")) && !t.includes("Choose a city");
    }, { timeout: 15000 }).catch(() => {});

    const scrollSteps = Math.max(1, Number(process.env.LOCAL_SCROLL_STEPS ?? 25));
    const scrollDelay = Math.max(1000, Number(process.env.LOCAL_SCROLL_DELAY_MS ?? 2500));
    const listings: ListingRaw[] = [];
    const seenIds = new Set<string>();

    const collectFromDom = async () => {
      const results = await page.evaluate(() => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a, [role="link"], [aria-label*="listing"]').forEach(el => {
          const html = el.outerHTML;
          const idMatch = html.match(/(?:\/item\/|listing_id=|"id":")(\d{14,21})/);
          if (!idMatch) return;
          const id = idMatch[1];
          if (seen.has(id)) return;
          seen.add(id);

          const img = el.querySelector('img');
          const src = img?.getAttribute('srcset')?.split(',').pop()?.trim().split(' ')[0] || img?.getAttribute('src') || "";
          const text = (el as HTMLElement).innerText || "";
          found.push({ externalId: id, imageUrl: src, tileText: text });
        });
        return found;
      });

      for (const item of results) {
        if (!seenIds.has(item.externalId)) {
          seenIds.add(item.externalId);
          listings.push({ ...item, title: item.tileText.split('\n')[0] || "Unknown", url: `https://www.facebook.com/marketplace/item/${item.externalId}/`, description: null });
        }
      }
    };

    for (let i = 0; i < scrollSteps; i++) {
      await page.evaluate(() => {
        document.querySelectorAll('div[role="dialog"]').forEach(d => (d as HTMLElement).style.display = 'none');
        window.scrollBy(0, 800);
      });
      await page.waitForTimeout(scrollDelay);
      await collectFromDom();
    }

    const ENRICH_LIMIT = 40;
    let enriched = 0;
    for (const item of listings) {
      if (enriched >= ENRICH_LIMIT) break;
      const existing = await prisma.listing.findUnique({ where: { externalId: item.externalId }, select: { description: true } });
      if (!existing || !existing.description || existing.description.includes("AutoPulse local capture")) {
        const details = await enrichListingWithPage(page, item.url);
        if (details) {
          if (details.imageUrl) item.imageUrl = details.imageUrl;
          if (details.description) item.description = details.description;
          enriched++;
          await page.waitForTimeout(800);
        }
      }
    }

    let upserted = 0;
    const foundCity = MARKETPLACE_CITIES.find(c => c.slug === location);
    const slugLoc = foundCity ? parseCityStateFromLabel(foundCity.label) : { city: location, state: null };

    for (const item of listings) {
      if (!item.externalId) continue;
      const price = parseTilePriceToCents(item.tileText);
      if (price <= 0) continue;
      
      const desc = item.description || `AutoPulse local capture: ${item.tileText}`.substring(0, 2000);
      const parsed = parseListingText(item.title, desc);
      
      await withRetry(() => prisma.listing.upsert({
        where: { externalId: item.externalId as string },
        update: {
          price: price,
          imageUrl: item.imageUrl || undefined,
          description: item.description || undefined,
          updatedAt: new Date(),
        },
        create: {
          externalId: item.externalId as string,
          source: "facebook",
          make: parsed.make || "Unknown",
          model: parsed.model || "Unknown",
          year: parsed.year || 0,
          price: price,
          mileage: parsed.mileage,
          city: slugLoc.city ?? location,
          state: slugLoc.state,
          listingUrl: item.url,
          imageUrl: item.imageUrl,
          description: desc,
          rawTitle: item.title,
          parseScore: parsed.parseScore,
          parsedAt: new Date(),
        }
      }));
      
      try {
        const q = getAlertMatchQueue();
        await q.add("matchListing", { listingId: item.externalId as string }, { removeOnComplete: true, jobId: `match-${item.externalId}` });
      } catch (e) {}
      upserted++;
    }

    console.log(`[local-scraper] ${location}: Done. Scraped=${listings.length}, Upserted=${upserted}`);
    await browser.close();
    return { scraped: listings.length, upserted };
  } catch (error) {
    console.error(`[local-scraper] Critical path failure for ${location}:`, error);
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
