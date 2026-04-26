import { chromium, Page } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { parseListingText } from '../parser/listingParser';

const prisma = new PrismaClient();

export async function enrichListingDetails(listingId: string, existingPage?: Page) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || !listing.listingUrl) return null;

  console.log(`📡 Deep scanning car: ${listing.rawTitle}...`);
  
  let browser = null;
  let page = existingPage;
  
  try {
    if (!page) {
      browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      page = await browser.newPage();
    }
    
    if (!listing.listingUrl || listing.listingUrl === "none" || listing.listingUrl.trim() === "") {
      console.log(`⚠️ Skipping enrichment for ${listing.id}: missing or invalid URL`);
      return false;
    }
    
    await page.goto(listing.listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Wait for FB's slow loading

    const rawPageTitle = await page.title();
    let scrapedTitle = rawPageTitle.replace(/\s*\|\s*Facebook/i, '').trim();
    
    // Fallback if title extraction is generic
    if (!scrapedTitle || scrapedTitle.toLowerCase().includes('marketplace')) {
        scrapedTitle = listing.rawTitle || '';
    }

    // Extract description and all visible text (for specs like mileage, transmission)
    const description = await page.evaluate(() => {
        const bodyText = document.body?.innerText || '';
        const spans = Array.from(document.querySelectorAll('span'));
        const descSpan = spans.find(s => s.textContent && s.textContent.length > 200 && !s.textContent.includes(' Marketplace'));
        const cleanDesc = descSpan ? descSpan.textContent : '';
        
        return `${cleanDesc}\n\n--- FULL PAGE SPECS ---\n\n${bodyText}`;
    });

    const parsed = parseListingText(scrapedTitle || listing.rawTitle || '', description || '');

    const updated = await prisma.listing.update({
      where: { id: listingId },
      data: {
        rawTitle: scrapedTitle || listing.rawTitle,
        description: description || listing.description,
        make: parsed.make !== "Unknown" ? parsed.make : listing.make,
        model: parsed.model !== "Unknown" ? parsed.model : listing.model,
        year: parsed.year > 0 ? parsed.year : listing.year,
        mileage: parsed.mileage || listing.mileage,
        transmission: parsed.transmission || listing.transmission,
        trim: parsed.trim || listing.trim,
        
        // Save the expanded specs
        bodyStyle: parsed.bodyStyle || listing.bodyStyle,
        driveType: parsed.driveType || listing.driveType,
        engine: parsed.engine || listing.engine,
        fuelType: parsed.fuelType || listing.fuelType,
        color: parsed.color || listing.color,
        doors: parsed.doors || listing.doors,
        titleStatus: parsed.titleStatus || listing.titleStatus,
        condition: parsed.condition || listing.condition,
        accidents: parsed.accidents !== null ? parsed.accidents : listing.accidents,
        owners: parsed.owners || listing.owners,
        features: parsed.features && parsed.features.length > 0 ? parsed.features : listing.features,
        
        isCar: !parsed.isJunk && (parsed.make !== "Unknown" || listing.make !== "Unknown"),
        isJunk: parsed.isJunk,
        parseScore: parsed.parseScore,
        parsedAt: new Date(),
      }
    });

    return updated;
  } catch (err) {
    console.error(`Failed to enrich ${listingId}:`, err);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
