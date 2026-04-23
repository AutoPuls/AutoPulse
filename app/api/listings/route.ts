import { NextRequest, NextResponse } from "next/server";
import {
  buildListingOrderBy,
  buildListingWhere,
  parseListingParams,
} from "@/lib/listingFilters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const sp = req.nextUrl.searchParams;
    const raw = Object.fromEntries(sp.entries());
    const parsed = parseListingParams(raw);

    const where = buildListingWhere(parsed);
    const orderBy = buildListingOrderBy(parsed);
    const { page, limit } = parsed;
    const skip = (page - 1) * limit;

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          year: true,
          make: true,
          model: true,
          price: true,
          imageUrls: true,
          city: true,
          state: true,
          mileage: true,
          transmission: true,
          trim: true,
          postedAt: true,
          engine: true,
          description: true,
          listingUrl: true,
          condition: true,
        },
      }),
      prisma.listing.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      listings,
      total,
      page,
      totalPages,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch listings";
    console.error("[api/listings]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
