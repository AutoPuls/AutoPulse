import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { smartTextWhereFromParams } from "@/lib/listingTextWhere";

/** Drop empty / whitespace-only values from the query record. */
function cleanFlatQuery(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (first === undefined) continue;
    const t = String(first).trim();
    if (t !== "") flat[k] = t;
  }
  return flat;
}

/** Dollars/Units in the URL; handles "10k" or decimals. */
const optionalPriceDollars = z.preprocess((val: unknown) => {
  if (val === undefined || val === null) return undefined;
  let s = String(val).trim().toLowerCase();
  if (s === "") return undefined;
  
  // Handle "10k" or "15.5k"
  if (s.endsWith("k")) {
    const n = Number(s.slice(0, -1));
    return isFinite(n) ? n * 1000 : undefined;
  }
  
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}, z.number().optional());

const optionalInt = z.preprocess((val: unknown) => {
  if (val === undefined || val === null) return undefined;
  let s = String(val).trim().toLowerCase();
  if (s === "") return undefined;

  // Handle "100k"
  if (s.endsWith("k")) {
    const n = Number(s.slice(0, -1));
    return isFinite(n) ? Math.trunc(n * 1000) : undefined;
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}, z.number().int().optional());

const paramsSchema = z.object({
  /** Free-text: words are AND’ed; each word matches make, model, or description. */
  keywords: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  yearMin: optionalInt,
  yearMax: optionalInt,
  priceMin: optionalPriceDollars,
  priceMax: optionalPriceDollars,
  mileageMax: optionalInt,
  city: z.string().optional(),
  trim: z.string().optional(),
  bodyStyle: z.string().optional(),
  driveType: z.string().optional(),
  transmission: z.string().optional(),
  fuelType: z.string().optional(),
  color: z.string().optional(),
  titleStatus: z.string().optional(),
  maxOwners: optionalInt,
  noAccidents: z
    .preprocess((val: unknown) => {
      if (val === undefined || val === null) return undefined;
      const s = String(val).trim().toLowerCase();
      if (s === "") return undefined;
      return s === "true" || s === "1" || s === "yes";
    }, z.boolean().optional()),
  features: z.string().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "year_desc", "year_asc"]).optional(),

  page: z.preprocess((val: unknown) => {
    if (val === undefined || val === null) return undefined;
    const s = String(val).trim();
    if (s === "") return undefined;
    const n = Number(s);
    if (!Number.isFinite(n)) return undefined;
    const t = Math.trunc(n);
    return t >= 1 ? t : undefined;
  }, z.number().int().min(1).optional().default(1)),
  limit: z.preprocess((val: unknown) => {
    if (val === undefined || val === null) return undefined;
    const s = String(val).trim();
    if (s === "") return undefined;
    const n = Number(s);
    if (!Number.isFinite(n)) return undefined;
    const t = Math.trunc(n);
    if (t < 1) return undefined;
    return Math.min(100, Math.max(1, t));
  }, z.number().int().min(1).max(100).optional().default(20)),
});

export type ParsedListingParams = z.infer<typeof paramsSchema>;

export function parseListingParams(
  raw: Record<string, string | string[] | undefined>,
): ParsedListingParams {
  const flat = cleanFlatQuery(raw);
  const parsed = paramsSchema.safeParse(flat);
  if (!parsed.success) {
    return { page: 1, limit: 20 } as ParsedListingParams;
  }
  return parsed.data;
}

export function toSearchParams(p: ParsedListingParams): URLSearchParams {
  const u = new URLSearchParams();
  if (p.keywords) u.set("keywords", p.keywords);
  if (p.make) u.set("make", p.make);
  if (p.model) u.set("model", p.model);
  if (p.yearMin != null) u.set("yearMin", String(p.yearMin));
  if (p.yearMax != null) u.set("yearMax", String(p.yearMax));
  if (p.priceMin != null) u.set("priceMin", String(p.priceMin));
  if (p.priceMax != null) u.set("priceMax", String(p.priceMax));
  if (p.mileageMax != null) u.set("mileageMax", String(p.mileageMax));
  if (p.city) u.set("city", p.city);
  if (p.trim) u.set("trim", p.trim);
  if (p.bodyStyle) u.set("bodyStyle", p.bodyStyle);
  if (p.driveType) u.set("driveType", p.driveType);
  if (p.transmission) u.set("transmission", p.transmission);
  if (p.fuelType) u.set("fuelType", p.fuelType);
  if (p.color) u.set("color", p.color);
  if (p.titleStatus) u.set("titleStatus", p.titleStatus);
  if (p.maxOwners != null) u.set("maxOwners", String(p.maxOwners));
  if (p.noAccidents != null) u.set("noAccidents", String(p.noAccidents));
  if (p.features) u.set("features", p.features);
  if (p.sort) u.set("sort", p.sort);

  return u;
}

/** Year, price, mileage. */
export function buildStructuredWhere(
  p: ParsedListingParams,
): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = {
    isJunk: false,
    isCar: true,
  };

  
  // Basic numeric
  if (p.yearMin != null || p.yearMax != null) {
    where.year = {};
    if (p.yearMin != null) where.year.gte = p.yearMin;
    if (p.yearMax != null) where.year.lte = p.yearMax;
  }
  if (p.priceMin != null || p.priceMax != null) {
    where.price = { gt: 0 };
    if (p.priceMin != null) {
      where.price.gte = Math.round(p.priceMin * 100);
    }
    if (p.priceMax != null) {
      where.price.lte = Math.round(p.priceMax * 100);
    }
  }
  if (p.mileageMax != null) {
    where.mileage = { lte: p.mileageMax };
  }
  if (p.trim) {
    where.trim = { contains: p.trim, mode: "insensitive" };
  }
  if (p.bodyStyle) {
    const b = p.bodyStyle;
    where.AND = [...(where.AND as any[] || []), {
      OR: [
        { bodyStyle: { contains: b, mode: "insensitive" } },
        { rawTitle: { contains: b, mode: "insensitive" } },
        { description: { contains: b, mode: "insensitive" } }
      ]
    }];
  }
  if (p.driveType) {
    where.driveType = { contains: p.driveType, mode: "insensitive" };
  }
  if (p.transmission) {
    const t = p.transmission;
    const ors: Prisma.ListingWhereInput[] = [
      { transmission: { contains: t, mode: "insensitive" } },
      { rawTitle: { contains: t, mode: "insensitive" } },
      { description: { contains: t, mode: "insensitive" } }
    ];
    // Add common variants
    if (t === 'automatic') ors.push({ rawTitle: { contains: 'auto', mode: "insensitive" } });
    if (t === 'manual') ors.push({ rawTitle: { contains: 'stick', mode: "insensitive" } });

    where.AND = [...(where.AND as any[] || []), { OR: ors }];
  }
  if (p.fuelType) {
    const f = p.fuelType;
    where.AND = [...(where.AND as any[] || []), {
      OR: [
        { fuelType: { contains: f, mode: "insensitive" } },
        { description: { contains: f, mode: "insensitive" } }
      ]
    }];
  }
  if (p.color) {
    const c = p.color;
    where.AND = [...(where.AND as any[] || []), {
      OR: [
        { color: { contains: c, mode: "insensitive" } },
        { rawTitle: { contains: c, mode: "insensitive" } },
        { description: { contains: c, mode: "insensitive" } }
      ]
    }];
  }
  if (p.titleStatus) {
    const s = p.titleStatus;
    where.AND = [...(where.AND as any[] || []), {
      OR: [
        { titleStatus: { contains: s, mode: "insensitive" } },
        { rawTitle: { contains: s, mode: "insensitive" } },
        { description: { contains: s, mode: "insensitive" } }
      ]
    }];
  }
  if (p.maxOwners != null) {
    where.owners = { lte: p.maxOwners };
  }
  if (p.noAccidents === true) {
    where.accidents = false;
  }
  if (p.features) {
    const reqFeatures = p.features
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    if (reqFeatures.length > 0) {
      where.features = { hasEvery: reqFeatures };
    }
  }

  return where;
}

export function buildListingWhere(
  p: ParsedListingParams,
): Prisma.ListingWhereInput {
  const structured = buildStructuredWhere(p);
  const smart = smartTextWhereFromParams({
    keywords: p.keywords,
    make: p.make,
    model: p.model,
    city: p.city,
  });
  if (!smart) return structured;
  if (Object.keys(structured).length === 0) return smart;
  return { AND: [structured, smart] };
}

export function buildListingOrderBy(
  p: ParsedListingParams,
): Prisma.ListingOrderByWithRelationInput | Prisma.ListingOrderByWithRelationInput[] {
  switch (p.sort) {
    case "price_asc":
      return { price: "asc" };
    case "price_desc":
      return { price: "desc" };
    case "year_desc":
      return { year: "desc" };
    case "year_asc":
      return { year: "asc" };
    case "newest":
    default:
      return [{ postedAt: "desc" }, { createdAt: "desc" }];
  }
}
