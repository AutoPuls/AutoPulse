import http from 'http';
import cron from 'node-cron';
import { runLocalScraper } from '../lib/scraper/localScraper';

const PORT = process.env.PORT || 7860;

// Create dummy server for HF/Vercel health checks
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('AutoPulse Mission Control: Local Ingestion Worker Active.\n');
});

server.listen(PORT, () => {
  console.log(`[worker] Intelligence uplink active on port ${PORT}`);
  console.log('[worker] Free local ingestion activated. Targeting 1000+ leads daily.');
  
  // 1. Initial run on startup
  setTimeout(() => {
    runLocalScraper().catch(console.error);
  }, 5000);

  // 2. Schedule regular scans every 30 minutes
  // This will rotate through cities and ingest fresh data for $0 Apify credits
  cron.schedule('*/30 * * * *', () => {
    runLocalScraper().catch(console.error);
  });
});
