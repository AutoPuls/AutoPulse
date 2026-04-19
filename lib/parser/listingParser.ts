export interface ParsedListing {
  // Vehicle identity
  make: string;
  model: string;
  year: number;
  trim: string | null;
  bodyStyle: string | null;
  driveType: string | null;
  engine: string | null;
  transmission: string | null;
  fuelType: string | null;
  color: string | null;
  doors: number | null;

  // Numeric
  mileage: number | null;

  // Condition
  titleStatus: string | null;
  condition: string | null;
  accidents: boolean | null;
  owners: number | null;

  // Extras
  features: string[];

  // Meta
  parseScore: number;
  isJunk: boolean;
}

import { MAKES, MAKE_NORMALIZATION, MODEL_MAP, MODEL_DISPLAY_NAMES } from "../constants";

const TRIMS = [
  "sel premium", "limited", "platinum", "sport", "touring", "ex-l", "ex-t", "ltz", "z71", "rst", "trail boss", "at4", "denali", "slt", "sle", "sxt", "scat pack", "hellcat", "redeye", "xlt", "lariat", "king ranch", "raptor", "tremor", "fx4", "stx", "work truck", "pro", "overland", "rubicon", "sahara", "sport s", "trailhawk", "high altitude", "summit", "laredo", "n line", "calligraphy", "night edition", "black edition", "svt", "shelby", "gt500", "gt350", "ecoboost", "performance", "competition", "m sport", "m package", "amg", "f sport", "s line", "r design", "inscription", "momentum", "r-dynamic", "p90d", "long range", "dual motor", "awd", "rwd", "se", "sel", "le", "xle", "xse", "trd", "lx", "ex", "exl", "lt", "ls", "gt", "r/t", "r t", "wt", "base", "premium", "prestige", "titanium"
];

const COLORS = [
  "black", "white", "silver", "grey", "gray", "red", "blue", "green", "brown", "tan", "beige", "orange", "yellow", "gold", "purple", "maroon", "navy", "teal", "champagne", "pearl", "bronze", "dark blue", "dark grey", "dark gray", "light blue", "charcoal", "gunmetal", "burgundy", "metallic", "matte", "diamond white", "midnight black", "candy red", "nardo grey", "lime green"
];

const FEATURE_KEYWORDS = [
  "leather seats", "leather interior", "heated seats", "cooled seats", "sunroof", "moonroof", "panoramic roof", "navigation", "nav system", "backup camera", "rear camera", "blind spot", "lane assist", "apple carplay", "carplay", "android auto", "bluetooth", "wifi", "remote start", "keyless entry", "push start", "push button start", "third row", "3rd row", "captain chairs", "running boards", "tow package", "trailer hitch", "roof rack", "bed liner", "lift kit", "leveling kit", "new tires", "new brakes", "new battery", "fresh oil change", "fully loaded", "low miles", "highway miles", "one owner", "clean carfax", "carfax available", "no rust", "heated steering wheel", "ventilated seats", "massage seats", "head up display", "hud", "premium sound", "bose", "harman kardon", "jbl", "bang olufsen", "mark levinson", "burmester", "adaptive cruise", "cruise control", "auto park", "self parking", "night vision", "surround camera", "360 camera", "ambient lighting", "power tailgate", "power liftgate", "wireless charging", "usb ports", "dual zone climate", "tri zone climate", "air suspension", "sport suspension", "performance exhaust", "cold air intake", "aftermarket wheels", "chrome wheels", "sport wheels", "tinted windows", "tint", "window tint", "power windows", "power locks", "keyless go", "clean title", "rebuilt title", "salvage title", "fwd", "awd", "4wd", "rwd", "turbo", "hybrid", "electric", "manual", "auto", "diesel"
];

const POSITIVE_SIGNALS = [
  "excellent", "perfect", "like new", "immaculate", "pristine", "mint", "runs great", "runs perfect", "no issues", "well maintained", "garaged", "highway miles", "low miles", "one owner", "clean title", "new tires", "new brakes", "fully loaded", "no rust", "needs nothing"
];

const NEGATIVE_SIGNALS = [
  "needs work", "as-is", "project car", "salvage", "damage", "rust", "dent", "scratch", "cracked", "broken", "not running", "high miles", "rebuilt", "flood", "burns oil", "check engine", "rough", "fixer"
];

function capitalize(s: string): string {
  if (!s) return "";
  const normalized = MAKE_NORMALIZATION[s.toLowerCase()];
  if (normalized) return normalized;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Robust junk title detection for Facebook Marketplace.
 * Catches category nav nodes, placeholders, and generic listings.
 */
export function isJunkTitle(title: string): boolean {
  const low = title.toLowerCase().trim();
  const junkPatterns = [
    "marketplace listing", "explore", "advanced filters enabled",
    "voitures", "bateaux", "bateau", "motos", "moto", "camions", "camion",
    "caravanes", "caravane", "camping-cars", "camping-car",
    "sports mécaniques", "sport mécanique",
    "powersports", "rv", "campers", "boats", "trailers",
    "vehicles", "cars", "trucks", "annonces", "autos", "carros", "venta"
  ];
  
  // Exact or contains "marketplace listing"
  if (low.includes("marketplace listing")) return true;
  
  // Full match for category nav nodes
  return junkPatterns.some(p => low === p);
}

/**
 * Main parser function to convert unstructured text into car data.
 */
export function parseListingText(title: string, description: string = ""): ParsedListing {
  const titleText = title.toLowerCase();
  const descriptionText = (description || "").toLowerCase();
  const fullText = (titleText + " " + descriptionText).trim().replace(/\s+/g, " ");
  let parseScore = 100;

  // 1. YEAR extraction - Prioritize numbers that look like years (1970-2026)
  const years = fullText.match(/\b(19[5-9]\d|20[0-2]\d)\b/g);
  let year = 0;
  if (years) {
    // If multiple years are found (e.g. 2018 Camry, 2024 tires), take the one in the title or the first one
    const titleYear = titleText.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
    year = titleYear ? parseInt(titleYear[1], 10) : parseInt(years[0], 10);
  }
  if (year === 0) parseScore -= 20;

  // 2. MAKE extraction - Use word boundaries to avoid substrings (e.g. "Ram" matching "Ramp")
  let make = "Unknown";
  for (const m of MAKES) {
    if (new RegExp(`\\b${m}\\b`, "i").test(titleText)) {
      make = MAKE_NORMALIZATION[m] || capitalize(m);
      break;
    }
  }
  if (make === "Unknown") {
    for (const m of MAKES) {
      if (new RegExp(`\\b${m}\\b`, "i").test(descriptionText)) {
        make = MAKE_NORMALIZATION[m] || capitalize(m);
        break;
      }
    }
  }

  // 3. MODEL extraction & Mapping
  let model = "Unknown";
  
  if (make !== "Unknown") {
    const definedModels = MODEL_MAP[make] || [];
    // Sort by length descending to match "Grand Cherokee" before "Cherokee"
    const sortedModels = [...definedModels].sort((a, b) => b.length - a.length);
    
    // Check title then description
    for (const m of sortedModels) {
      const escapedModel = m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[- ]/g, "[- ]?");
      if (new RegExp(`\\b${escapedModel}\\b`, "i").test(fullText)) {
        model = MODEL_DISPLAY_NAMES[m] || capitalize(m);
        break;
      }
    }
  }

  // 3.1 Reverse Look-up (Model -> Make) if Make is still unknown
  if (make === "Unknown") {
    for (const [mKey, mList] of Object.entries(MODEL_MAP)) {
      const sortedMList = [...mList].sort((a,b) => b.length - a.length);
      for (const mName of sortedMList) {
        const escapedMName = mName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[- ]/g, "[- ]?");
        if (new RegExp(`\\b${escapedMName}\\b`, "i").test(titleText)) {
          make = mKey;
          model = MODEL_DISPLAY_NAMES[mName] || capitalize(mName);
          break;
        }
      }
      if (make !== "Unknown") break;
    }
  }

  // 3.2 Special Case: BMW/Mercedes series matching
  if (make === "BMW" && model === "Unknown") {
    const seriesMatch = fullText.match(/\b([1-8])\s*(?:series|serie)\b/i) || fullText.match(/\b([1-8])(\d{2})i?\b/i);
    if (seriesMatch) model = `${seriesMatch[1]} Series`;
  }
  if (make === "Mercedes-Benz" && model === "Unknown") {
    const classMatch = fullText.match(/\b([cesgl]\d{3})\b/i) || fullText.match(/\b([abcesglk])\s*class\b/i);
    if (classMatch) model = `${classMatch[1].toUpperCase()}-Class`;
  }

  if (make === "Unknown") parseScore -= 25;
  if (model === "Unknown") parseScore -= 15;

  // 4. TRIM extraction
  let trim: string | null = null;
  const sortedTrims = [...TRIMS].sort((a, b) => b.length - a.length);
  for (const t of sortedTrims) {
    if (new RegExp(`\\b${t}\\b`, "i").test(fullText)) {
      trim = t.toUpperCase();
      break;
    }
  }

  // 5. MILEAGE extraction - Improved robustness
  let mileage: number | null = null;
  // Regex 1: "125,000 miles" or "125k"
  const mMatch = fullText.match(/(\d{1,3}(?:[ ,]\d{3})*)\s*(?:miles?|mi\.?|mls?)\b/i) || 
                 fullText.match(/(\d{1,3}(?:[.,]\d{1,3})?)\s*k\s*(?:miles?|mi\.?|mls?)?\b/i) ||
                 fullText.match(/\b(\d{1,3})k\b/i);

  if (mMatch) {
    const valStr = mMatch[1].replace(/[ ,]/g, "");
    let val = parseFloat(valStr);
    if (mMatch[0].toLowerCase().includes('k')) val *= 1000;
    mileage = Math.round(val);
  } else {
    // Regex 2: "Kilométrage: 125000" or "Miles: 125000"
    const mLabel = fullText.match(/(?:mileage|miles|mi\.?|mls?|kilométrage|km)[^0-9]{0,10}(\d{1,3}(?:[ ,]\d{3})*)\b/i);
    if (mLabel) {
      mileage = parseInt(mLabel[1].replace(/[ ,]/g, ""), 10);
    }
  }

  // Validate mileage (must be sane)
  if (mileage !== null && (mileage < 100 || mileage > 600000)) {
    // Check if it's actually 1900-2026 (likely a year)
    if (mileage >= 1950 && mileage <= 2026) mileage = null;
    else if (mileage > 600000) mileage = null;
  }
  if (mileage === null) parseScore -= 10;

  // 6. TRANSMISSION
  let transmission: string | null = null;
  if (/\b(automatic|auto|automatica|at)\b/i.test(fullText)) transmission = "automatic";
  else if (/\b(manual|stick|standard|6-speed|5-speed|manuelle|mt)\b/i.test(fullText)) transmission = "manual";
  else if (/\bcvt\b/i.test(fullText)) transmission = "CVT";

  // 7. DRIVE TYPE
  let driveType: string | null = null;
  if (/\b(4x4|4wd|4x2|awd|fwd|rwd|all.wheel.drive|4.wheel.drive|four.wheel.drive)\b/i.test(fullText)) {
      const dt = fullText.match(/\b(4x4|4wd|4x2|awd|fwd|rwd)\b/i)?.[0].toUpperCase();
      driveType = (dt === '4X4' ? '4WD' : (dt ?? null));
  }

  // 8. ENGINE
  let engine: string | null = null;
  const engMatch = fullText.match(/\b(v\d|l\d|inline\s*\d|\d\.\d\s*l|turbo|hybrid|diesel)\b/i);
  if (engMatch) engine = engMatch[0].toUpperCase();

  // 9. FUEL TYPE
  let fuelType: string | null = "gasoline";
  if (make === "Tesla" || /\b(electric|ev|bev)\b/i.test(fullText)) fuelType = "electric";
  else if (/\b(hybrid|phev|hybrid synergestic)\b/i.test(fullText)) fuelType = "hybrid";
  else if (/\b(diesel|tdi|duramax|powerstroke|cummins)\b/i.test(fullText)) fuelType = "diesel";

  // 10. BODY STYLE
  let bodyStyle: string | null = null;
  if (/\b(sedan|cupe|coupe|suv|truck|pickup|van|minivan|hatchback|convertible|wagon)\b/i.test(fullText)) {
      const bs = fullText.match(/\b(sedan|coupe|suv|truck|van|hatchback|convertible|wagon)\b/i)?.[0].toLowerCase();
      bodyStyle = bs ?? null;
  }

  // 11. COLOR
  let color: string | null = null;
  for (const c of COLORS) {
    if (new RegExp(`\\b${c}\\b`, "i").test(fullText)) {
      color = (c === "grey" || c === "gray") ? "gray" : c;
      break;
    }
  }

  // 12. TITLE STATUS
  let titleStatus: string | null = null;
  if (/\b(clean|clear)\s*title\b/i.test(fullText)) titleStatus = "clean";
  else if (/\b(salvage|rebuilt|rebuilt\s*title|lemon|reconstruction)\b/i.test(fullText)) titleStatus = "salvage";

  // 13. CONDITION & FEATURES
  const featuresSet = new Set<string>();
  for (const f of FEATURE_KEYWORDS) {
    if (new RegExp(`\\b${f}\\b`, "i").test(fullText)) featuresSet.add(f);
  }

  const isJunk = isJunkTitle(title);
  
  return {
    make,
    model,
    year,
    trim,
    bodyStyle,
    driveType,
    engine,
    transmission,
    fuelType,
    color,
    doors: (/\b(2|4)\s*door\b/i.test(fullText)) ? parseInt(fullText.match(/\b(2|4)\b/)?.[0] || "4") : null,
    mileage,
    titleStatus,
    condition: (/\b(excellent|perfect|mint|new)\b/i.test(fullText)) ? "excellent" : (/\b(fair|good)\b/i.test(fullText)) ? "good" : "fair",
    accidents: (/\b(no\s*accidents|no\s*accident|accident\s*free)\b/i.test(fullText)) ? false : (/\b(accident|fender\s*bender)\b/i.test(fullText)) ? true : null,
    owners: (/\b(1\s*owner|one\s*owner)\b/i.test(fullText)) ? 1 : (/\b(2\s*owners|two\s*owners)\b/i.test(fullText)) ? 2 : null,
    features: Array.from(featuresSet),
    parseScore: Math.max(0, parseScore),
    isJunk
  };
}
