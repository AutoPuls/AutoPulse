import { NextRequest, NextResponse } from "next/server";
import { parseListingText } from "@/lib/parser/listingParser";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q");
    if (!q) {
      return NextResponse.json({ filters: {} });
    }

    // Reuse our powerful parser to identify what they're looking for
    const parsed = parseListingText(q, "");
    
    // Convert the parsed vehicle into search filters
    // We only include fields that were actually detected (not "Unknown")
    const filters: any = {};
    if (parsed.make !== "Unknown") filters.make = parsed.make;
    if (parsed.model !== "Unknown") filters.model = parsed.model;
    if (parsed.year > 0) {
      filters.yearMin = parsed.year;
      filters.yearMax = parsed.year;
    }
    if (parsed.trim) filters.trim = parsed.trim;
    if (parsed.bodyStyle) filters.bodyStyle = parsed.bodyStyle;
    if (parsed.driveType) filters.driveType = parsed.driveType;
    if (parsed.transmission) filters.transmission = parsed.transmission;
    if (parsed.fuelType) filters.fuelType = parsed.fuelType;
    if (parsed.color) filters.color = parsed.color;
    if (parsed.titleStatus) filters.titleStatus = parsed.titleStatus;
    if (parsed.condition) filters.condition = parsed.condition;
    if (parsed.owners != null) filters.maxOwners = parsed.owners;
    if (parsed.accidents === false) filters.noAccidents = true;
    
    // Features identified in the query
    if (parsed.features.length > 0) {
      filters.features = parsed.features.join(",");
    }

    // Special: look for price in the query string manually if parser skipped it
    const priceMatch = q.match(/(?:un?der|below|max)\s*(\d+k?)/i);
    if (priceMatch) {
      let val = priceMatch[1]!.toLowerCase();
      if (val.endsWith("k")) {
        filters.priceMax = parseInt(val, 10) * 1000;
      } else {
        filters.priceMax = parseInt(val, 10);
      }
    }

    // If parser confidence is low, preserve user intent as plain keywords.
    if (parsed.parseScore < 55) {
      filters.keywords = q.trim();
    }

    return NextResponse.json({ filters });
  } catch (e) {
    console.error("[api/search/parse]", e);
    return NextResponse.json({ error: "Failed to parse query" }, { status: 500 });
  }
}
