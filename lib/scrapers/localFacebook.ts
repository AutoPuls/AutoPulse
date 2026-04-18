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
    headless: process.env.SCRAPER_HEADLESS !== 'false',
    args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=390,844'
    ]
  });

  const context = await browser.newContext({
    userAgent: ua,
    viewport: { 
      width: 390, 
      height: 844 
    },
    extraHTTPHeaders: {
      'Referer': 'https://m.facebook.com/',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  // 1. Load Session (DB -> ENV -> Empty)
  let cookiesToLoad = await getStoredSession();
  let sessionSource = "database";
  
  if (!cookiesToLoad) {
    const fbCookiesEnv = process.env.FB_COOKIES;
    if (fbCookiesEnv) {
        try {
            const raw = JSON.parse(fbCookiesEnv);
            cookiesToLoad = (Array.isArray(raw) ? raw : Object.values(raw));
            sessionSource = "FB_COOKIES env";
        } catch (e) { /* ignore */ }
    }
  }

  if (cookiesToLoad) {
      console.log(`[local-scraper] 🛡️ Using session from ${sessionSource}.`);
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
      console.log(`[local-scraper] ✅ Injected ${mapped.length} session cookies.`);
  } else {
      console.warn(`[local-scraper] 🆕 No stored session found. Proceeding with guest mobile browse.`);
  }

  const page = await context.newPage();

  const url = `https://m.facebook.com/marketplace/${location}/vehicles?sortBy=creation_time_descend&exact=false`;
  console.log(`[local-scraper] Searching ${location} (Mobile View)...`);

    try {
        await page.goto(url, { waitUntil: 'load', timeout: 90000 });
        
        // --- AUTO-LOGIN TRIGGER ---
        const currentUrl = page.url();
        if (currentUrl.includes("/login/") || currentUrl.includes("checkpoint")) {
            console.log(`[local-scraper] 🔄 Login/Checkpoint detected. Attempting automated login fallback...`);
            const loginSuccess = await performHeadlessLogin(page);
            if (loginSuccess) {
                console.log(`[local-scraper] ✅ Automated login attempt finished. Resuming bypass flow...`);
                // Re-navigate to target after login if needed, though login often redirects to 'next'
                if (!page.url().includes("/marketplace/")) {
                    await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
                }
            } else {
                console.warn(`[local-scraper] ⚠️ Automated login failed or partially blocked.`);
            }
        }

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

        const bodySnippet = await page.evaluate(() => document.body?.innerText?.substring(0, 500)?.replace(/\n/g, ' ') || "No body content");
        console.log(`[local-scraper] [v2.3] Current URL: ${page.url()}`);
        console.log(`[local-scraper] Page Title: ${pageTitle}`);
        console.log(`[local-scraper] Page Snippet length: ${bodySnippet.length}`);
        console.log(`[local-scraper] Page Snippet: ${bodySnippet}`);

        // --- RELIABILITY: Ultra-Persistent Multi-stage Session Bypass ---
        let loopCount = 0;
        const maxLoops = 40; // Increased further for complex checkpoints
        let bypassSuccessful = false;
        let lastUrl = page.url();
        let homeRedirected = false;

        while (loopCount < maxLoops) {
            const currentUrl = page.url();
            const currentTitle = await page.title();
            
            // If the URL has not changed for 3 iterations despite clicking, try a reload
            if (loopCount > 0 && loopCount % 3 === 0 && currentUrl === lastUrl) {
                console.log(`[local-scraper] 🔄 URL stuck at ${currentUrl}. Forcing page reload...`);
                await page.reload({ waitUntil: 'load' }).catch(() => {});
                await page.waitForTimeout(5000);
                continue;
            }
            
            // If stuck mid-way and haven't tried Home, try a "warm up" navigation
            if (loopCount === 15 && !homeRedirected && !currentUrl.includes("/marketplace/")) {
                console.log(`[local-scraper] 🔄 Mid-loop recovery: Navigating to Home to anchor session...`);
                await page.goto("https://www.facebook.com/", { waitUntil: 'load', timeout: 30000 }).catch(() => {});
                await page.waitForTimeout(3000);
                homeRedirected = true;
                continue; // Re-evaluate at the new URL
            }
            
            lastUrl = currentUrl;

            // Check if we already reached Marketplace during a bypass step
            if (currentUrl.includes("/marketplace/")) {
                bypassSuccessful = true;
                break;
            }
            
            // 1. Proactive Checkbox Handling (Enhanced Evaluation)
            try {
                await page.evaluate(() => {
                    // Look for any input that is a checkbox or radio
                    const inputs = document.querySelectorAll('input[type="checkbox"], input[type="radio"]');
                    inputs.forEach((input: any) => {
                        if (!input.checked) {
                            console.log("Checking checkbox: " + input.name);
                            input.click();
                        }
                    });
                    // Also look for elements that might be custom-styled checkboxes
                    const customBoxes = document.querySelectorAll('div[role="checkbox"], div[role="radio"]');
                    customBoxes.forEach((box: any) => {
                        if (box.getAttribute('aria-checked') !== 'true') {
                            box.click();
                        }
                    });
                });
            } catch (e) { /* ignore */ }

            // 2. Expanded Button Selection (Deep check)
            const continueSelectors = [
                'button[type="submit"]:has-text("Continue")',
                'button[type="submit"]:has-text("Confirm")',
                'button[name="reset_action"]', // Common on login checkpoints
                'button[name="checkpoint_action"]',
                'button[name="submit"][value="1"]',
                'button:has-text("Log In")', // Force log in to get form
                'text="Use another profile"',
                '[role="button"]:has-text("Log In")',
                '[role="button"]:has-text("Continue")',
                'div[role="button"]:has-text("Confirm")',
                'button:has-text("Yes")',
                'button:has-text("This was me")',
                '[aria-label*="Continue"]',
                '[aria-label*="Log In"]',
                'text="Keep using this browser"',
                'a:has-text("Continue")',
                '[href*="/login/device-based/"]'
            ];
            
            let actionTaken = false;
            for (const sel of continueSelectors) {
                try {
                    const btn = page.locator(sel).first();
                    if (await btn.isVisible()) {
                        const btnText = await btn.innerText().catch(() => "Unknown");
                        console.log(`[local-scraper] 🔄 Clicking button: "${sel}" (Label: "${btnText}")...`);
                        await btn.click({ force: true });
                        await page.waitForTimeout(5000); // Wait for potential 302
                        actionTaken = true;
                        break; 
                    }
                } catch (e) { /* ignore */ }
            }

            // Special: Account Chooser / "Continue as..."
            if (!actionTaken) {
                try {
                    // Look for profile images or mentions of names that look like account choices
                    const accountChoice = await page.evaluate(() => {
                        const items = document.querySelectorAll('div[role="link"], div[role="button"]');
                        for (const item of Array.from(items)) {
                            const text = item.textContent || "";
                            if (text.length > 2 && text.length < 50 && !text.includes("Log In") && !text.includes("Create")) {
                                (item as HTMLElement).click();
                                return text;
                            }
                        }
                        return null;
                    });
                    if (accountChoice) {
                        console.log(`[local-scraper] 🔄 Clicking potential account choice: "${accountChoice}"`);
                        await page.waitForTimeout(5000);
                        actionTaken = true;
                    }
                } catch (e) { /* ignore */ }
            }

            if (!actionTaken) {
                if (loopCount > 0 && loopCount % 5 === 0) {
                    console.warn(`[local-scraper] ⚠️ No bypass actions found on step ${loopCount + 1}. Page snippet: ${await page.evaluate(() => document.body.innerText.substring(0, 100))}`);
                }
                
                if (currentUrl.includes("/login/") && !currentUrl.includes("next=")) {
                    // We are on a hard login page without a return path, cookies likely dead
                    console.error(`[local-scraper] 🚨 Hard login detected without redirect. Cookies are likely expired.`);
                    break;
                }
                await page.waitForTimeout(3000);
            }

            loopCount++;
        }

        if (loopCount >= maxLoops) {
            console.error(`[local-scraper] 🚨 Bypass loop exceeded max steps (${maxLoops}). Session is likely stuck or cookies are invalid.`);
        }

        // Final settling and re-navigation
        if (bypassSuccessful || loopCount > 0) {
            const currentUrl = page.url();
            if (!currentUrl.includes("/marketplace/")) {
                console.log(`[local-scraper] 🔄 Attempting recovery navigation to Mobile Home...`);
                await page.goto("https://m.facebook.com/home.php", { waitUntil: 'load', timeout: 30000 }).catch(() => {});
                await page.waitForTimeout(5000);
                
                console.log(`[local-scraper] 🔄 Final re-navigation to target Mobile Marketplace: ${url}`);
                await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
            }

            // --- SESSION PERSISTENCE ---
            // If we've successfully reached Marketplace or Home after a bypass/login, save the cookies
            const newCookies = await context.cookies();
            if (newCookies.some(c => c.name === 'c_user')) {
                await saveStoredSession(newCookies);
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

    const listingsSource: string[] = [];
    const listings: ListingRaw[] = [];
    const seenIds = new Set<string>();

    const collectFromDom = async () => {
        const domListings = await page.evaluate(() => {
            const results: any[] = [];
            // Target all marketplace item links
            document.querySelectorAll('a[href*="/marketplace/item/"]').forEach(a => {
                const href = (a as HTMLAnchorElement).getAttribute('href') || "";
                const idMatch = href.match(/(?:\/item\/|[\?&]id=)(\d{10,21})/);
                if (!idMatch) return;
                const id = idMatch[1];
                
                const container = a.closest('div[style*="aspect-ratio"], div.x1gslohp, div.x1n2onr6') || a.parentElement;
                const img = a.querySelector('img') || container?.querySelector('img');
                const imgSrc = img?.getAttribute('src') || "";
                
                const textContent = (a as HTMLElement).innerText || (container as HTMLElement)?.innerText || "";
                const lines = textContent.split('\n').map(l => l.trim()).filter(Boolean);
                
                let price = "";
                let title = "";
                for(const line of lines) {
                    if (line.includes('$') || line.includes('£') || line.includes('€')) {
                        if (!price) price = line;
                    } else if (line.length > 5 && !title) {
                        title = line;
                    }
                }

                results.push({
                    externalId: id,
                    imageUrl: imgSrc,
                    title: title || lines[0] || "Unknown Listing",
                    tileText: textContent
                });
            });
            return results;
        });

        for (const item of domListings) {
            if (!seenIds.has(item.externalId)) {
                seenIds.add(item.externalId);
                listings.push({
                    ...item,
                    url: `https://www.facebook.com/marketplace/item/${item.externalId}/`,
                    description: null
                });
            }
        }
    };
        // --- Strategy 1: Find marketplace item IDs ---
        // Mobile FB can use: /item/ID, /item/?id=ID, or absolute URLs
        const itemIdPattern = /(?:\/item\/|[\?&]id=|listing_id=|marketplace_id=|item_id=)(\d{10,21})/g;
        let idMatch: RegExpExecArray | null;
        while ((idMatch = itemIdPattern.exec(htmlFragment)) !== null) {
            const externalId = idMatch[1];
            if (seenIds.has(externalId)) continue;
            seenIds.add(externalId);
    
            // Convert mobile URL to desktop URL for the database
            const url = `https://www.facebook.com/marketplace/item/${externalId}/`;
            
            // Pull surrounding context
            const ctxStart = Math.max(0, idMatch.index - 1000);
            const ctxEnd = Math.min(htmlFragment.length, idMatch.index + 1000);
            const context = htmlFragment.substring(ctxStart, ctxEnd);
    
            // Title — on mobile, sometimes it's easier to find in aria-labels or neighboring text
            const strictTitleMatch =
                context.match(/"marketplace_listing_title"\s*:\s*"([^"]{3,120})"/) ||
                context.match(/"title"\s*:\s*"([^"]{3,120})"/) ||
                context.match(/aria-label=["']([^"']{3,120})["']/) ||
                context.match(/>([^<]{3,125})<\/div>/);

            // Price — compute early
            const priceMatchEarly =
                context.match(/"amount"\s*:\s*["']?(\d+(?:\.\d+)?)["']?/) || 
                context.match(/\$\s*([\d,]+)/);
            const priceValueEarly = parseFloat((priceMatchEarly?.[1] || '0').replace(/,/g, ''));

            const nameFallback = priceValueEarly > 0
                ? context.match(/"name"\s*:\s*"([^"]{5,120})"/) ?? null
                : null;
            const titleMatch = strictTitleMatch || nameFallback;

            const priceValue = priceValueEarly;

            // Image — uri field pointing to CDN
            const imgRaw = 
                context.match(/"primary_listing_photo"\s*:\s*{\s*"image"\s*:\s*{\s*"uri"\s*:\s*"(https:[^",]{10,}?\.(?:jpg|jpeg|png|webp)[^",]*)"/) ||
                context.match(/"preferred_thumbnail"\s*:\s*{\s*"image"\s*:\s*{\s*"uri"\s*:\s*"(https:[^",]{10,}?\.(?:jpg|jpeg|png|webp)[^",]*)"/) ||
                context.match(/<img[^>]+src=["'](https:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/) ||
                context.match(/"uri"\s*:\s*"(https:[^",]{10,}?\.(?:jpg|jpeg|png|webp)[^",]*)"/);
            const imageUrl = imgRaw ? imgRaw[1].split('\\/').join('/') : null;
            
            if (!imageUrl || imageUrl.trim().length === 0) continue;

            const descMatch = 
                context.match(/"listing_description"\s*:\s*{\s*"text"\s*:\s*"([^"]{10,10000}?)"\s*}/) ||
                context.match(/"redacted_description"\s*:\s*{\s*"text"\s*:\s*"([^"]{10,10000}?)"\s*}/) ||
                context.match(/"description"\s*:\s*{\s*"text"\s*:\s*"([^"]{10,10000}?)"\s*}/);
            
            const rawDescription = descMatch ? descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) : null;

            if (!titleMatch || priceValue <= 0) continue;

            const rawTitle = titleMatch![1];
            const title = rawTitle.replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).trim();

            if (isJunkTitle(title)) continue;

            const priceStr = priceMatchEarly?.[1] || '0';
            const tileText = `$${priceStr} ${title}`;

            listings.push({
                externalId,
                url: `https://www.facebook.com/marketplace/item/${externalId}/`,
                imageUrl,
                title: title.substring(0, 100),
                tileText,
                description: rawDescription
            });
        }
    };

    console.log(`[local-scraper] Starting cumulative infinite scroll for ${scrollSteps} steps...`);
    
    for (let i = 0; i < scrollSteps; i++) {
        // Step 1: Force scroll
        await page.evaluate(() => {
          document.body.style.overflow = 'auto';
          document.documentElement.style.overflow = 'auto';
          
          const overlays = document.querySelectorAll('div[data-testid="mask"], div[class*="x1n2onr6"]');
          overlays.forEach(ov => (ov as HTMLElement).style.display = 'none');

          const dialogs = document.querySelectorAll('div[role="dialog"]');
          dialogs.forEach(d => {
              const text = d.textContent?.toLowerCase() || "";
              if (text.includes("login") || text.includes("connexion") || text.includes("account")) {
                  (d as HTMLElement).style.display = 'none';
              }
          });
          
          const items = document.querySelectorAll('a[href*="/marketplace/item/"], [role="link"]');
          if (items.length > 0) {
              items[items.length - 1].scrollIntoView({ behavior: 'smooth' });
          } else {
              window.scrollBy(0, 800);
          }
        });

        await new Promise(r => setTimeout(r, scrollDelayMs));

        // Step 2: Capture Snapshot (Crucial for virtualization)
        await new Promise(r => setTimeout(r, scrollDelayMs));

        // Step 2: Capture Snapshot via DOM
        await collectFromDom();
        
        if (i % 5 === 0) {
          console.log(`[local-scraper] Scroll step ${i}: Total items seen so far: ${seenIds.size}`);
        }
    }

    // Step 3: Final check
    await collectFromDom();

    console.log(`[local-scraper] Total extracted: ${listings.length} listings`);

    // --- Phase 4: Dynamic Enrichment Phase ---
    // For new listings, visit their detail pages to get full descriptions/images
    const NEW_ENRICH_LIMIT = 15; // Limit per city run to keep it fast
    let enrichedCount = 0;

    console.log(`[local-scraper] 💎 Starting Enrichment Phase (Limit: ${NEW_ENRICH_LIMIT})...`);
    for (const item of listings) {
        if (enrichedCount >= NEW_ENRICH_LIMIT) break;

        // Only enrich if it doesn't exist or is a generic placeholder
        const existing = await prisma.listing.findUnique({ 
            where: { externalId: item.externalId },
            select: { description: true }
        });

        if (!existing || !existing.description || existing.description.includes("AutoPulse local capture")) {
            console.log(`[local-scraper] 🔍 Deep Scanning: ${item.externalId} | "${item.title}"...`);
            const details = await enrichListingWithPage(page, item.url);
            if (details) {
                item.imageUrl = details.imageUrl || item.imageUrl;
                item.description = details.description;
                enrichedCount++;
                // Small gap between detail pages
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

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
