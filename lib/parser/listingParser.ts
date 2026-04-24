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
  vin: string | null;
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
export function isJunkTitle(title: string, description: string = ""): boolean {
  const low = (title + " " + (description || "")).toLowerCase().trim();
  
  // 1. Generic Placeholders & Category Nav Keywords
  const navPatterns = [
    "explore", "advanced filters enabled", "annonces de marketplace", "voitures", "autos", 
    "carros", "véhicules", "vehicles", "cars", "trucks", "annonces", "venta", "generic listing"
  ];
  
  if (navPatterns.some(p => low.includes(p))) return true;
  
  // Marketplace Listing is only junk if description is also empty or junk
  if (low === "marketplace listing" && description.length < 20) return true;

  // 2. Non-Car Vehicle Keywords (Aggressive but refined)
  const nonCarKeywords = [
    // Two-wheelers
    "motorcycle", "motercycle", "moto", "scooter", "moped", "dirt bike", "pit bike", "ebike", "bicycle", "bycycle", "bike",
    "kawasaki", "yamaha", "harley", "davidson", "ducati", "triumph", "vespa", "grom", "hayabusa", "ninja", "ktm",
    "\\bcbr\\b", "\\bgsxr\\b", "\\b250r\\b", "\\b600r\\b", "\\b1000r\\b", "\\d+cc\\b",

    // Off-road & Marine
    "atv", "utv", "quad", "four wheeler", "4 wheeler", "polaris", "can-am", "can am", "rzr", "maverick", "talon",
    "boat", "vessel", "yacht", "sea-doo", "seadoo", "jet ski", "jetski", "pontoon", "outboard", "sailboat",

    // RVs & Trailers
    "rv", "camper", "travel trailer", "fifth wheel", "motorhome", "winnebago", "coachmen", "jayco", "forest river", "keystone",
    "trailer", "tráiler", "utility trailer", "cargo trailer", "dump trailer", "flatbed", "car hauler", "enclosed",

    // Industrial/Garden
    "tractor", "mower", "zero turn", "kubota", "john deere", "bobcat", "skid steer", "equipment", 
    "parts only", "parting out", "shell only", "frame only", "wtb", "wtt"
  ];

  const hasNonCarKeyword = nonCarKeywords.some(k => new RegExp(`\\b${k}\\b`, "i").test(low));
  if (hasNonCarKeyword) return true;

  // 3. Buyer Intent Filter (WTB/WTT)
  // Only junk if at the start of title (e.g. "Looking for BMW") 
  // or specifically mentions wanting to buy/trade.
  if (/^(i am )?looking for\b/i.test(title.trim())) return true;
  if (/\b(looking to buy|looking for any|want to buy|wtb|wtt)\b/i.test(low)) return true;

  return false;
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

  // 8. ENGINE & CYLINDERS
  let engine: string | null = null;
  const engSizeMatch = fullText.match(/\b(\d\.\d)\s*(?:l|liter|litros)\b/i);
  const engCylMatch = fullText.match(/\b(v[468]|inline\s*[46]|l[46]|v1[02]|\d\s*cylinder|cyl)\b/i);
  
  if (engSizeMatch && engCylMatch) engine = `${engSizeMatch[1]}L ${engCylMatch[0].toUpperCase()}`;
  else if (engSizeMatch) engine = `${engSizeMatch[1]}L Engine`;
  else if (engCylMatch) engine = engCylMatch[0].toUpperCase();
  else if (/\b(turbo|hybrid|diesel|electric)\b/i.test(fullText)) {
      engine = fullText.match(/\b(turbo|hybrid|diesel|electric)\b/i)?.[0].toUpperCase() || null;
  }

  // 9. FUEL TYPE
  let fuelType: string | null = "gasoline";
  if (make === "Tesla" || /\b(electric|ev|bev|tesla)\b/i.test(fullText)) fuelType = "electric";
  else if (/\b(hybrid|phev|plug-in)\b/i.test(fullText)) fuelType = "hybrid";
  else if (/\b(diesel|duramax|powerstroke|cummins|tdi)\b/i.test(fullText)) fuelType = "diesel";

  // 9.1 INTERIOR (New)
  let interior: string | null = null;
  if (/\b(leather|cuir|piel)\b/i.test(fullText)) interior = "leather";
  else if (/\b(cloth|fabric|tissu)\b/i.test(fullText)) interior = "cloth";
  else if (/\b(suede|alcantara)\b/i.test(fullText)) interior = "suede";

  // 9.2 VIN (New)
  let vin: string | null = null;
  const vinMatch = fullText.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
  if (vinMatch) vin = vinMatch[1].toUpperCase();

  // 10. BODY STYLE
  let bodyStyle: string | null = null;
  const bsPatterns = [
      { key: "sedan", regex: /\b(sedan|berline)\b/i },
      { key: "suv", regex: /\b(suv|crossover|4x4)\b/i },
      { key: "truck", regex: /\b(truck|pickup|f150|silverado|ram|camion)\b/i },
      { key: "coupe", regex: /\b(coupe|cupe)\b/i },
      { key: "van", regex: /\b(van|minivan)\b/i },
      { key: "hatchback", regex: /\b(hatchback|hatch)\b/i },
      { key: "convertible", regex: /\b(convertible|cabriolet|soft top)\b/i },
      { key: "wagon", regex: /\b(wagon|estate|touring)\b/i }
  ];
  for (const p of bsPatterns) {
    if (p.regex.test(fullText)) {
        bodyStyle = p.key;
        break;
    }
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
  else if (/\b(salvage|rebuilt|lemon|reconstruction)\b/i.test(fullText)) titleStatus = "salvage";

  // 13. CONDITION & FEATURES
  const featuresSet = new Set<string>();
  for (const f of FEATURE_KEYWORDS) {
    if (new RegExp(`\\b${f}\\b`, "i").test(fullText)) featuresSet.add(f);
  }
  if (interior) featuresSet.add(`${interior} interior`);
  if (vin) featuresSet.add(`VIN: ${vin}`);

  const isJunk = isJunkTitle(title, description);
  
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
    isJunk,
    vin
  };
}
