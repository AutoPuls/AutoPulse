import { chromium, Page } from 'playwright';
import { MARKETPLACE_CITIES } from '../cities';
import { parseListingText, isJunkTitle } from '../parser/listingParser';

export async function runLocalScraper() {
  console.log('--- STARTING LOCAL FREE SCRAPE (MISSION CONTROL) ---');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });

  const { prisma } = await import('../db');
  const { matchListingToSubscriptions } = await import('../alertMatcher');

  // We rotate through 5 random cities per run to stay under the radar
  const citiesToScrape = [...MARKETPLACE_CITIES]
    .sort(() => 0.5 - Math.random())
    .slice(0, 8);

  for (const city of citiesToScrape) {
    const page = await context.newPage();
    try {
      console.log(`[local-scraper] Targeting: ${city.label} (${city.slug})`);
      
      const url = `https://www.facebook.com/marketplace/${city.slug}/vehicles?exact=false`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      
      // Allow dynamic content to stabilize
      await page.waitForTimeout(5000);
      
      // Auto-scroll a bit to trigger more loading
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(2000);

      // Extract listing cards
      // selectors for FB Marketplace search cards (approximate, based on typical structure)
      const cards = await page.evaluate(() => {
        const items: any[] = [];
        // Look for common link patterns in Marketplace grid
        const links = Array.from(document.querySelectorAll('a[href*="/marketplace/item/"]'));
        
        links.forEach(link => {
          const href = link.getAttribute('href') || '';
          const match = href.match(/item\/(\d+)/);
          if (!match) return;
          
          const externalId = match[1];
          const container = link.closest('div[style*="max-width"]') || link.parentElement;
          if (!container) return;

          const titleEl = container.querySelector('span[style*="webkit-line-clamp"]');
          const priceEl = Array.from(container.querySelectorAll('span')).find(s => s.textContent?.includes('$'));
          const imgEl = container.querySelector('img');

          if (titleEl && priceEl) {
            items.push({
              externalId,
              title: titleEl.textContent?.trim(),
              priceText: priceEl.textContent?.trim(),
              imageUrl: imgEl?.getAttribute('src'),
              url: 'https://www.facebook.com' + href.split('?')[0]
            });
          }
        });
        return items;
      });

      console.log(`[local-scraper] Identified ${cards.length} potential leads in ${city.slug}.`);

      let cityCount = 0;
      for (const card of cards) {
        // Basic Price Parse
        const priceNum = parseInt(card.priceText.replace(/[^0-9]/g, ''), 10);
        if (isNaN(priceNum) || priceNum < 500) continue; // Skip outliers
        
        if (isJunkTitle(card.title)) continue;

        const parsed = parseListingText(card.title, ""); // No description in search view

        const listingData = {
          externalId: card.externalId,
          source: 'facebook',
          rawTitle: card.title,
          description: "Details pending deep scan...",
          listingUrl: card.url,
          price: priceNum * 100,
          imageUrls: card.imageUrl ? [card.imageUrl] : [],
          city: city.label.split(',')[0],
          state: city.label.split(',')[1]?.trim() || null,
          postedAt: new Date(),
          
          make: parsed.make,
          model: parsed.model,
          year: parsed.year,
          mileage: parsed.mileage,
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
          accidents: parsed.accidents,
          owners: parsed.owners,
          features: parsed.features,
          vin: parsed.vin,
          isJunk: parsed.isJunk,
          isCar: !parsed.isJunk && parsed.make !== "Unknown",
          parseScore: parsed.parseScore,
          parsedAt: new Date(),
        };

        try {
          const listing = await prisma.listing.upsert({
            where: { externalId: listingData.externalId },
            update: {
                // Only update basic info to avoid overwriting enriched data if it exists
                price: listingData.price,
                rawTitle: listingData.rawTitle,
                imageUrls: listingData.imageUrls.length > 0 ? listingData.imageUrls : undefined
            },
            create: listingData,
          });

          if (listing) {
            cityCount++;
            // Alert matcher for new leads
            matchListingToSubscriptions(listing).catch(() => {});
          }
        } catch (dbErr) {
            // Likely unique constraint or connection blip
        }
      }
      console.log(`[local-scraper] Committed ${cityCount} unique cars for ${city.slug}`);
      
    } catch (err: any) {
      console.error(`[local-scraper] Error in ${city.slug}:`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('--- LOCAL SCRAPE CYCLE COMPLETE ---');
}
