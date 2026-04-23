import { Listing, Prisma, Subscription } from "@/prisma/generated/client";

/**
 * Finds all active subscriptions that match a given listing's attributes.
 */
export async function findMatchingSubscriptions(listing: Listing): Promise<Subscription[]> {
  const { prisma } = await import("./db");

  // --- GLOBAL MOTORCYCLE/JUNK FILTER ---
  const blockRegex = /\b(motorcycle|scooter|moped|dirt bike|atv|utv|harley|yamaha|ninja|tao|grom|ducati|kawasaki|vespa|polaris|can-am|sea-doo|ski-doo|snowmobile|rv|camper|trailer|boat|jet ski)\b/i;
  const titleText = (listing.rawTitle || "").toLowerCase();
  
  if (blockRegex.test(titleText)) {
    console.log(`[alertMatcher] Blocking notification for non-car vehicle: ${listing.rawTitle}`);
    return [];
  }
  // ------------------------------------

  const where: Prisma.SubscriptionWhereInput = {
    AND: [
      // Make/Model matching (Case insensitive contains or exact)
      {
        OR: [
          { make: null },
          { make: { equals: listing.make?.trim(), mode: 'insensitive' } },
          { make: { equals: listing.make?.trim() + " ", mode: 'insensitive' } }, // Handle common trailing space in DB
        ]
      },
      {
        OR: [
          { model: null },
          { model: { equals: listing.model?.trim(), mode: 'insensitive' } },
          { model: { equals: listing.model?.trim() + " ", mode: 'insensitive' } },
        ]
      },
      // Numeric ranges
      {
        OR: [
          { yearMin: null },
          { yearMin: { lte: listing.year } }
        ]
      },
      {
        OR: [
          { yearMax: null },
          { yearMax: { gte: listing.year } }
        ]
      },
      {
        OR: [
          { priceMin: null },
          { priceMin: { lte: listing.price } }
        ]
      },
      {
        OR: [
          { priceMax: null },
          { priceMax: { gte: listing.price } }
        ]
      },
      {
        OR: [
          { mileageMax: null },
          { mileageMax: { gte: listing.mileage ?? 9999999 } }
        ]
      },
      // City matching
      {
        OR: [
          { city: null },
          { city: { equals: listing.city ?? '', mode: 'insensitive' } },
        ]
      },
      // Advanced Filters
      {
        OR: [
          { titleStatus: null },
          { titleStatus: { equals: listing.titleStatus ?? '', mode: 'insensitive' } }
        ]
      },
      {
        OR: [
          { transmission: null },
          { transmission: { equals: listing.transmission ?? '', mode: 'insensitive' } }
        ]
      },
      {
        OR: [
          { fuelType: null },
          { fuelType: { equals: listing.fuelType ?? '', mode: 'insensitive' } }
        ]
      },
      {
        OR: [
          { color: null },
          { color: { equals: listing.color ?? '', mode: 'insensitive' } }
        ]
      },
      {
        OR: [
          { bodyStyle: null },
          { bodyStyle: { equals: listing.bodyStyle ?? '', mode: 'insensitive' } }
        ]
      },
      {
        OR: [
          { driveType: null },
          { driveType: { equals: listing.driveType ?? '', mode: 'insensitive' } }
        ]
      }
    ]
  };

  const matches = await prisma.subscription.findMany({ where });

  // Post-filtering for keywords (until Prisma supports array-to-string overlaps natively)
  return matches.filter(sub => {
    if (!sub.keywords || sub.keywords.length === 0) return true;
    
    const searchText = `${listing.rawTitle} ${listing.rawDescription}`.toLowerCase();
    return sub.keywords.some(kw => searchText.includes(kw.toLowerCase()));
  });
}
