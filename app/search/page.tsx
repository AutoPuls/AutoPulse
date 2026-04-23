import type { ReactElement } from "react";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import {
  buildListingWhere,
  parseListingParams,
  toSearchParams,
  buildListingOrderBy,
} from "@/lib/listingFilters";
import { ListingGrid } from "@/components/ListingGrid";
import { Pagination } from "@/components/Pagination";
import { SearchLayout } from "@/components/SearchLayout";
import { getMarketAnalysis } from "@/lib/intelligence";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function SearchPage({
  searchParams,
}: PageProps): Promise<ReactElement> {
  const parsed = parseListingParams(searchParams);
  const where = buildListingWhere(parsed);
  const skip = (parsed.page - 1) * parsed.limit;

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: buildListingOrderBy(parsed),
      skip,
      take: parsed.limit,
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

  // ENRICH WITH MARKET INTELLIGENCE
  const listingsWithAnalysis = await Promise.all(
    listings.map(async (l) => {
      const analysis = await getMarketAnalysis(l.price, l.make || "", l.model || "", l.year);
      return { ...l, analysis };
    })
  );

  const totalPages = Math.max(1, Math.ceil(total / parsed.limit));

  const u = toSearchParams(parsed);
  u.delete("page");
  const queryWithoutPage = u.toString();

  const sidebarInitial = {
    keywords: parsed.keywords ?? "",
    make: parsed.make ?? "",
    model: parsed.model ?? "",
    yearMin: parsed.yearMin != null ? String(parsed.yearMin) : "",
    yearMax: parsed.yearMax != null ? String(parsed.yearMax) : "",
    priceMin: parsed.priceMin != null ? String(parsed.priceMin) : "",
    priceMax: parsed.priceMax != null ? String(parsed.priceMax) : "",
    mileageMax: parsed.mileageMax != null ? String(parsed.mileageMax) : "",
    city: parsed.city ?? "",
    trim: parsed.trim ?? "",
    bodyStyle: parsed.bodyStyle ?? "",
    driveType: parsed.driveType ?? "",
    transmission: parsed.transmission ?? "",
    fuelType: parsed.fuelType ?? "",
    color: parsed.color ?? "",
    titleStatus: parsed.titleStatus ?? "",
    maxOwners: parsed.maxOwners != null ? String(parsed.maxOwners) : "",
    noAccidents: parsed.noAccidents != null ? String(parsed.noAccidents) : "",
  };


  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 text-muted sm:px-6 lg:px-8">
          Loading search…
        </div>
      }
    >
      <SearchLayout total={total} sidebarInitial={sidebarInitial}>
        <ListingGrid listings={listingsWithAnalysis} />
        <Pagination
          page={parsed.page}
          totalPages={totalPages}
          queryWithoutPage={queryWithoutPage}
        />
      </SearchLayout>
    </Suspense>
  );
}
