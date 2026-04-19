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
  const fullText = (titleText + " " + descriptionText).trim();
  let parseScore = 100;

  // 1. YEAR extraction
  const yearMatch = fullText.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  if (year === 0) parseScore -= 20;

  // 2. MAKE extraction - Check title FIRST (higher priority)
  let make = "Unknown";
  // Pass 1: Check title
  for (const m of MAKES) {
    if (new RegExp(`\\b${m}\\b`, "i").test(titleText)) {
      make = MAKE_NORMALIZATION[m] || capitalize(m);
      break;
    }
  }
  // Pass 2: Check description only if title failed
  if (make === "Unknown") {
    for (const m of MAKES) {
      if (new RegExp(`\\b${m}\\b`, "i").test(descriptionText)) {
        make = MAKE_NORMALIZATION[m] || capitalize(m);
        break;
      }
    }
  }

  // 3. MODEL extraction & Implicit Make Detection
  let model = "Unknown";
  if (make !== "Unknown") {
    const definedModels = MODEL_MAP[make] || [];
    const sortedModels = [...definedModels].sort((a, b) => b.length - a.length);
    // Pass 1: Check title
    for (const m of sortedModels) {
      if (new RegExp(`\\b${m.replace("-", "[- ]?")}\\b`, "i").test(titleText)) {
        model = MODEL_DISPLAY_NAMES[m] || capitalize(m);
        break;
      }
    }
    // Pass 2: Check description only if title failed
    if (model === "Unknown") {
      for (const m of sortedModels) {
        if (new RegExp(`\\b${m.replace("-", "[- ]?")}\\b`, "i").test(descriptionText)) {
          model = MODEL_DISPLAY_NAMES[m] || capitalize(m);
          break;
        }
      }
    }
  } else {
    // Try to find make via model match if make is missing - check title FIRST
    outer: for (const [mKey, mList] of Object.entries(MODEL_MAP)) {
      for (const mName of mList) {
        if (new RegExp(`\\b${mName.replace("-", "[- ]?")}\\b`, "i").test(titleText)) {
          make = mKey;
          model = MODEL_DISPLAY_NAMES[mName] || capitalize(mName);
          break outer;
        }
      }
    }
    // Fallback to description for make/model via model match
    if (make === "Unknown") {
      outer: for (const [mKey, mList] of Object.entries(MODEL_MAP)) {
        for (const mName of mList) {
          if (new RegExp(`\\b${mName.replace("-", "[- ]?")}\\b`, "i").test(descriptionText)) {
            make = mKey;
            model = MODEL_DISPLAY_NAMES[mName] || capitalize(mName);
            break outer;
          }
        }
      }
    }
  }

  // 3.5 DIGIT-ONLY MODEL FALLBACK (The Truck Logic)
  if (model === "Unknown" && make !== "Unknown") {
    const truckDigits = fullText.match(/\b(1500|2500|3500)\b/);
    if (truckDigits) {
      if (make === "Chevrolet") model = "Silverado";
      if (make === "Gmc") model = "Sierra";
      if (make === "Ram") model = "Ram 1500";
    }
  }

  if (make === "Unknown") parseScore -= 20;
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

  // 5. MILEAGE extraction
  let mileage: number | null = null;
  const m1 = fullText.match(/(\d{1,3}(?:,\d{3})*)\s*(?:miles?|mi\.?|mls?)\b/i);
  const m2 = fullText.match(/(\d{1,3}(?:,\d{3})*)\s*(?:k)\s*(?:miles?|mi\.?)?\b/i);
  const m3 = fullText.match(/\b(\d{1,3})k\b/i);

  if (m1) {
    mileage = parseInt(m1[1].replace(/,/g, ""), 10);
  } else if (m2) {
    mileage = parseInt(m2[1].replace(/,/g, ""), 10) * 1000;
  } else if (m3) {
    mileage = parseInt(m3[1], 10) * 1000;
  } else {
    // Try "Unit then Number" e.g. "miles: 45000" or "miles 45,000"
    // Handle specific "miles 45000" or "miles: 45000"
    const m4 = fullText.match(/(?:miles?|mi\.?|mls?|mileage)[^0-9\n]{0,10}(\d{1,3}(?:,\d{3})*)\b/i);
    if (m4) {
      mileage = parseInt(m4[1].replace(/,/g, ""), 10);
    }
    if (mileage === null) {
       // FINAL FALLBACK: just look for a large number 500-400000 that isn't the year
       const allNums = fullText.match(/\b\d{3,6}\b/g);
       if (allNums) {
         for (const nStr of allNums) {
           const n = parseInt(nStr, 10);
           if (n > 500 && n < 500000 && n !== year) {
             mileage = n;
             break;
           }
         }
       }
    }
  }

  if (mileage != null && (mileage < 100 || mileage > 500000)) {
    mileage = null;
  }
  if (mileage === null) parseScore -= 10;

  // 6. TRANSMISSION
  let transmission: string | null = null;
  if (/\b(automatic|auto)\b/i.test(fullText)) transmission = "automatic";
  else if (/\b(manual|stick|stick shift|6-speed|5-speed)\b/i.test(fullText)) transmission = "manual";
  else if (/\bcvt\b/i.test(fullText)) transmission = "CVT";
  if (!transmission) parseScore -= 5;

  // 7. DRIVE TYPE
  let driveType: string | null = null;
  if (/\b(4x4|4wd|four wheel drive|four-wheel)\b/i.test(fullText)) driveType = "4WD";
  else if (/\b(awd|all wheel drive|all-wheel)\b/i.test(fullText)) driveType = "AWD";
  else if (/\b(fwd|front wheel drive|front-wheel)\b/i.test(fullText)) driveType = "FWD";
  else if (/\b(rwd|rear wheel drive|rear-wheel|2wd)\b/i.test(fullText)) driveType = "RWD";

  // 8. ENGINE
  let engine: string | null = null;
  const vMatch = fullText.match(/\b(v\d)\b/i);
  const lMatch = fullText.match(/\b(\d+(?:\.\d+)?)\s*l(?:iter)?\b/i);
  const parts: string[] = [];
  if (vMatch) parts.push(vMatch[1].toUpperCase());
  if (lMatch) parts.push(lMatch[1].toUpperCase() + "L");
  if (/\b(4[- ]?cyl(?:inder)?|four[- ]?cyl(?:inder)?)\b/i.test(fullText)) parts.push("4-cylinder");
  if (/\b(6[- ]?cyl(?:inder)?|six[- ]?cyl(?:inder)?)\b/i.test(fullText)) parts.push("6-cylinder");
  if (/\bturbo(?:charged)?\b/i.test(fullText)) parts.push("turbocharged");
  engine = parts.join(" ") || null;

  // 9. FUEL TYPE
  let fuelType: string | null = "gasoline";
  if (make === "Tesla" || /\b(electric|ev|battery)\b/i.test(fullText)) {
    fuelType = "electric";
  } else if (/\b(hybrid|plug-in|phev|prius)\b/i.test(fullText)) {
    fuelType = "hybrid";
  } else if (/\b(diesel|duramax|cummins|powerstroke)\b/i.test(fullText)) {
    fuelType = "diesel";
  }

  // 10. BODY STYLE
  let bodyStyle: string | null = null;
  if (/\b(truck|pickup|f150|silverado|tacoma|tundra|sierra|ranger)\b/i.test(fullText)) bodyStyle = "truck";
  else if (/\b(suv|crossover|rav4|cr-v|explorer|highlander|pathfinder)\b/i.test(fullText)) bodyStyle = "suv";
  else if (/\b(sedan|camry|accord|altima|civic|corolla|malibu)\b/i.test(fullText)) bodyStyle = "sedan";
  else if (/\b(coupe|mustang|camaro|charger|challenger)\b/i.test(fullText)) bodyStyle = "coupe";
  else if (/\b(van|minivan|odyssey|sienna|caravan|transit)\b/i.test(fullText)) bodyStyle = "van";
  else if (/\b(convertible|cabriolet|roadster|spyder)\b/i.test(fullText)) bodyStyle = "convertible";
  else if (/\b(hatchback|hatch|golf|fit|soul)\b/i.test(fullText)) bodyStyle = "hatchback";
  else if (/\b(wagon|outback|legacy wagon)\b/i.test(fullText)) bodyStyle = "wagon";

  // 11. COLOR
  let color: string | null = null;
  for (const c of COLORS) {
    if (new RegExp(`\\b${c}\\b`, "i").test(fullText)) {
      color = (c === "grey" || c === "gray") ? "gray" : c;
      break;
    }
  }
  if (!color) parseScore -= 5;

  // 12. TITLE STATUS
  let titleStatus: string | null = null;
  if (/\b(clean title|clear title)\b/i.test(fullText)) titleStatus = "clean";
  else if (/\b(salvage|salvage title|rebuilt title|rebuilt|flood|lemon)\b/i.test(fullText)) titleStatus = "salvage";
  else if (/\b(lien|lien on title)\b/i.test(fullText)) titleStatus = "lien";
  if (!titleStatus) parseScore -= 5;

  // 13. OWNERS
  let owners: number | null = null;
  if (/\b(one owner|1 owner|single owner|1st owner)\b/i.test(fullText)) owners = 1;
  else if (/\b(two owners|2 owners|second owner)\b/i.test(fullText)) owners = 2;
  else if (/\b(three owners|3 owners)\b/i.test(fullText)) owners = 3;

  // 14. ACCIDENTS
  let accidents: boolean | null = null;
  if (/\b(no accidents|no accident|accident free|accident-free|clean carfax)\b/i.test(fullText)) accidents = false;
  else if (/\b(has accident|accident history|minor accident|fender bender)\b/i.test(fullText)) accidents = true;

  // 15. CONDITION
  let condScore = 0;
  // Boost "like new" and "perfect" to have more weight
  if (/\b(perfect|immaculate|like new|mint|pristine|runs perfect|no issues)\b/i.test(fullText)) condScore += 3;
  
  for (const s of POSITIVE_SIGNALS) {
    if (new RegExp(`\\b${s}\\b`, "i").test(fullText)) {
      condScore += 1;
    }
  }
  for (const s of NEGATIVE_SIGNALS) {
    if (new RegExp(`\\b${s}\\b`, "i").test(fullText)) condScore -= 2;
  }
  let condition: string | null = "fair";
  if (condScore >= 3) condition = "excellent";
  else if (condScore >= 1) condition = "good";
  else if (condScore >= -1) condition = "fair";
  else condition = "poor";

  // 16. FEATURES
  const featuresSet = new Set<string>();
  for (const f of FEATURE_KEYWORDS) {
    if (new RegExp(`\\b${f}\\b`, "i").test(fullText)) {
      featuresSet.add(f);
    }
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
    doors: (/\b(2|2-?door)\b/i.test(fullText)) ? 2 : (/\b(4|4-?door)\b/i.test(fullText)) ? 4 : null,
    mileage,
    titleStatus,
    condition,
    accidents,
    owners,
    features: Array.from(featuresSet),
    parseScore: Math.max(0, parseScore),
    isJunk
  };
}
