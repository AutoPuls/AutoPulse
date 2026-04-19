import { prisma } from './lib/prisma';
import * as dotenv from 'dotenv';
dotenv.config();

async function purgeMotorcycles() {
    console.log("Connecting to database to purge motorcycles...");

    const keywords = ['motorcycle', 'scooter', 'moped', 'dirt bike', 'atv', 'utv', 'harley', 'yamaha', 'ninja', 'tao', 'grom', 'ducati', 'kawasaki', 'vespa', 'polaris', 'can-am', 'sea-doo', 'ski-doo', 'snowmobile', 'rv ', 'camper', 'trailer'];
    
    // Constructing OR conditions for each keyword
    const orConditions = keywords.map(kw => ({
        rawTitle: {
            contains: kw,
            mode: 'insensitive' as const
        }
    }));

    const result = await prisma.listing.deleteMany({
        where: {
            OR: orConditions
        }
    });

    console.log(`✅ Successfully purged ${result.count} motorcycles, ATVs, and boats from the database.`);
    
    // Also delete any with price <= 100 just to be safe as they are usually parts/ghosts
    const badPrices = await prisma.listing.deleteMany({
        where: {
            price: { lte: 25000 } // <= $250
        }
    });
    console.log(`✅ Also purged ${badPrices.count} ultra-low price listings (<= $250).`);
}

purgeMotorcycles()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
