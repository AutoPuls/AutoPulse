import "../lib/envBootstrap";
import { scrapeLocalMarketplace } from "../lib/scrapers/localFacebook";

async function main() {
    try {
        console.log("Starting test scrape for chicago...");
        // The scraper will log its own progress
        const result = await scrapeLocalMarketplace("chicago");
        console.log("Scrape result:", result);
    } catch (err) {
        console.error("Scrape failed:", err);
    }
}

main();
