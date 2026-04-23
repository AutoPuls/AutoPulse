// Simple in-memory cache for market stats to ensure smooth grid scrolling
const statsCache = new Map<string, { median: number; count: number; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

export type DealRating = "great" | "good" | "fair" | "high" | "unknown";

export interface MarketAnalysis {
  medianPrice: number;
  diffAmount: number;
  diffPercent: number;
  rating: DealRating;
  competitorCount: number;
}

export async function getMarketAnalysis(
  priceCents: number,
  make: string,
  model: string,
  year: number
): Promise<MarketAnalysis | null> {
  if (!priceCents || priceCents <= 0 || !make || !model || make === "Unknown") {
    return null;
  }

  const { prisma } = await import("./db");
  const cacheKey = `${make}-${model}-${year}`.toLowerCase();
  const now = Date.now();
  
  let stats = statsCache.get(cacheKey);

  if (!stats || now - stats.timestamp > CACHE_TTL) {
    // Range query: same make/model and +/- 2 years to get a better sample size
    const siblings = await prisma.listing.findMany({
      where: {
        make: { equals: make, mode: "insensitive" },
        model: { equals: model, mode: "insensitive" },
        year: { gte: year - 2, lte: year + 2 },
        price: { gt: 10000 }, // Ignore outliers/broken prices
      },
      select: { price: true },
    });

    if (siblings.length < 3) {
      // Not enough data for a reliable score
      return null;
    }

    const prices = siblings.map(s => s.price).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];
    
    stats = { median, count: prices.length, timestamp: now };
    statsCache.set(cacheKey, stats);
  }

  const diffAmount = stats.median - priceCents;
  const diffPercent = (diffAmount / stats.median) * 100;

  let rating: DealRating = "fair";
  if (diffPercent >= 12) rating = "great";
  else if (diffPercent >= 5) rating = "good";
  else if (diffPercent <= -10) rating = "high";

  return {
    medianPrice: stats.median,
    diffAmount,
    diffPercent: Math.round(diffPercent),
    rating,
    competitorCount: stats.count,
  };
}
