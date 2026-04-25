import { execSync } from 'child_process';

async function missionControl() {
    console.log('🚀 AUTOPULSE MISSION CONTROL STARTED');
    console.log('------------------------------------');
    console.log('Mode: Continuous Scraping + Free Detail Enrichment');
    
    while (true) {
        try {
            console.log(`\n[${new Date().toLocaleTimeString()}] 📡 Phase 1: Checking for NEW cars on Apify...`);
            // Run the scraper (this takes ~5-10 mins)
            execSync('npx ts-node scripts/mega-harvest-v2.ts', { stdio: 'inherit' });

            console.log(`\n[${new Date().toLocaleTimeString()}] 🛠️ Phase 2: Starting background detail repair...`);
            // Run the free enrichment for 20 minutes before next scrape
            for (let i = 0; i < 4; i++) {
                console.log(`   Sync batch ${i+1}/4...`);
                execSync('npx ts-node scripts/bulk-enrich.ts', { stdio: 'inherit' });
                
                // Every other batch, let's also check for sold cars (keep inventory clean)
                if (i % 2 === 0) {
                    console.log('   Checking for sold vehicles...');
                    execSync('npx ts-node scripts/check-sold.ts', { stdio: 'inherit' });
                }

                await new Promise(r => setTimeout(r, 60000)); 
            }

            console.log('\n😴 Resting for 1 hour before next major scrape...');
            await new Promise(r => setTimeout(r, 3600000)); // 1 hour pause
        } catch (err) {
            console.error('⚠️ Mission Control encountered an error, restarting in 5 mins...', err);
            await new Promise(r => setTimeout(r, 300000));
        }
    }
}

missionControl();
