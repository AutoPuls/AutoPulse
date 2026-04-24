import { Listing, Prisma, Subscription } from "@prisma/client";
import { newListingsEmail, sendMail, MailListing } from "./mailer";

/**
 * Finds all active subscriptions that match a given listing's attributes.
 */
export async function findMatchingSubscriptions(listing: Listing): Promise<Subscription[]> {
  const { prisma } = await import("./db");

  // --- GLOBAL MOTORCYCLE/JUNK FILTER ---
  const blockRegex = /\b(motorcycle|motercycle|scooter|moped|dirt bike|atv|utv|harley|yamaha|kawasaki|ducati|ninja|polaris|can-am|sea-doo|ski-doo|snowmobile|rv|camper|trailer|tráiler|boat|jet ski|bicycle|bycycle|tractor|mower|coachmen|jayco|winnebago|keystone|equipment)\b/i;
  const titleText = (listing.rawTitle || "").toLowerCase();
  const descText = (listing.description || "").toLowerCase();
  
  if (blockRegex.test(titleText) || blockRegex.test(descText)) {
    console.log(`[alertMatcher] Blocking notification for non-car vehicle: ${listing.rawTitle}`);
    return [];
  }
  // ------------------------------------

  const where: Prisma.SubscriptionWhereInput = {
    AND: [
      {
        OR: [
          { make: null },
          { make: { equals: listing.make?.trim(), mode: 'insensitive' } },
        ]
      },
      {
        OR: [
          { model: null },
          { model: { equals: listing.model?.trim(), mode: 'insensitive' } },
        ]
      },
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
      {
        OR: [
          { city: null },
          { city: { equals: listing.city ?? '', mode: 'insensitive' } },
        ]
      },
      // === NEW ADVANCED FILTERS ===
      {
        OR: [
          { transmission: null },
          { transmission: { equals: listing.transmission ?? '___UNKNOWN___', mode: 'insensitive' } }
        ]
      },
      {
        OR: [
          { bodyStyle: null },
          { bodyStyle: { equals: listing.bodyStyle ?? '___UNKNOWN___', mode: 'insensitive' } }
        ]
      },
      {
        OR: [
          { driveType: null },
          { driveType: { equals: listing.driveType ?? '___UNKNOWN___', mode: 'insensitive' } }
        ]
      },
      {
        OR: [
          { titleStatus: null },
          { titleStatus: { equals: listing.titleStatus ?? '___UNKNOWN___', mode: 'insensitive' } }
        ]
      },
      {
        OR: [
          { fuelType: null },
          { fuelType: { equals: listing.fuelType ?? '___UNKNOWN___', mode: 'insensitive' } }
        ]
      }
    ]
  };

  // Accident Filter
  if (listing.accidents === true) {
    // If car HAS accidents, user MUST NOT have noAccidents: true
    where.AND!.push({
      OR: [
        { noAccidents: null },
        { noAccidents: false }
      ]
    });
  }

  // Owners Filter
  if (listing.owners && listing.owners > 0) {
    where.AND!.push({
      OR: [
        { maxOwners: null },
        { maxOwners: { gte: listing.owners } }
      ]
    });
  }

  return await prisma.subscription.findMany({ where });
}

/**
 * Orchestrates matching and alerting for a single new listing.
 */
export async function matchListingToSubscriptions(listing: Listing) {
  try {
    const matches = await findMatchingSubscriptions(listing);
    if (matches.length === 0) return;

    const mailListing: MailListing = {
      id: listing.id,
      make: listing.make,
      model: listing.model,
      year: listing.year,
      price: listing.price,
      mileage: listing.mileage,
      city: listing.city,
      state: listing.state,
      imageUrls: listing.imageUrls,
      listingUrl: listing.listingUrl,
      // Add extra details for the email template
      trim: listing.trim || undefined,
      transmission: listing.transmission || undefined,
      condition: listing.condition || undefined
    };

    for (const sub of matches) {
      try {
        const { subject, html } = newListingsEmail({
          email: sub.email,
          listings: [mailListing],
          filters: {
            make: sub.make || undefined,
            model: sub.model || undefined,
            yearMin: sub.yearMin || undefined,
            yearMax: sub.yearMax || undefined,
            priceMin: sub.priceMin || undefined,
            priceMax: sub.priceMax || undefined,
            mileageMax: sub.mileageMax || undefined,
            city: sub.city || undefined,
          }
        });

        await sendMail({
          to: sub.email,
          subject,
          html
        });
        
        console.log(`[alertMatcher] Sent alert to ${sub.email} for ${listing.year} ${listing.make} ${listing.model}`);
      } catch (err) {
        console.error(`[alertMatcher] Failed to send email to ${sub.email}:`, err);
      }
    }
  } catch (err) {
    console.error(`[alertMatcher] Processing error:`, err);
  }
}

