import http from 'http';

const PORT = process.env.PORT || 7860;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('AutoPulse Serverless Engine is active. Ingestion handled via Apify Webhooks.\n');
});

server.listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
  console.log('Ingestion is now serverless. This container remains active for status monitoring.');
});
