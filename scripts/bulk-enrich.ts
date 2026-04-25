import { PrismaClient } from '@prisma/client';
import { enrichListingDetails } from '../lib/scraper/enricher';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

async function bulkEnrich() {
    console.log('👷 Starting FREE Bulk Detail Sync...');
    
    // Find cars with "Unknown" or missing details
    const targets = await prisma.listing.findMany({
        where: {
            OR: [
                { make: 'Unknown' },
                { mileage: null },
                { description: { contains: 'pending' } }
            ],
            isJunk: false
        },
        take: 500, // Processing a large batch to fix everything
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${targets.length} cars that need details. Starting sync...`);
    const { matchListingToSubscriptions } = await import('../lib/alertMatcher');
    const { chromium } = await import('playwright');

    const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    let count = 0;
    for (const car of targets) {
        try {
            const success = await enrichListingDetails(car.id, page);
            if (success) {
                // Fetch the updated listing to get new make/model/etc.
                const updated = await prisma.listing.findUnique({ where: { id: car.id } });
                if (updated) {
                    console.log(`✅ [${++count}/${targets.length}] Enriched & Checking Alerts: ${updated.year} ${updated.make} ${updated.model}`);
                    await matchListingToSubscriptions(updated);
                }
            } else {
                console.log(`⚠️  [${++count}/${targets.length}] Failed to enrich: ${car.rawTitle}`);
            }
        } catch (e) {
            console.error(`Error with ${car.id}:`, e);
        }
    }

    await browser.close();
    console.log('\n✨ Done! Refresh your site to see the full details.');
    await prisma.$disconnect();
}

bulkEnrich().catch(console.error);
