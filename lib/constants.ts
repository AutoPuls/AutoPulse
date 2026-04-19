export const MAKES = [
  "toyota", "honda", "ford", "chevrolet", "chevy", "nissan", "hyundai",
  "kia", "jeep", "dodge", "ram", "gmc", "buick", "cadillac", "lincoln",
  "chrysler", "bmw", "mercedes", "mercedes-benz", "audi", "volkswagen",
  "vw", "volvo", "subaru", "mazda", "mitsubishi", "lexus", "infiniti",
  "acura", "tesla", "genesis", "rivian", "lucid", "porsche", "land rover",
  "jaguar", "mini", "fiat", "alfa romeo", "maserati", "ferrari", "lamborghini",
  "bentley", "rolls royce", "aston martin", "mclaren", "lotus", "pontiac",
  "saturn", "oldsmobile", "mercury", "hummer", "scion", "suzuki", "isuzu",
  "datsun", "geo", "daewoo", "smart", "saab", "eagle", "plymouth", "volvo",
  "land-rover", "rover", "buick", "lincoln", "olds"
];

export const MAKE_NORMALIZATION: Record<string, string> = {
  chevy: "Chevrolet",
  vw: "Volkswagen",
  mercedes: "Mercedes-Benz",
  "mercedes-benz": "Mercedes-Benz",
  bmw: "BMW",
  audi: "Audi",
  tesla: "Tesla"
};

export const MODEL_MAP: Record<string, string[]> = {
  Toyota: ["camry", "corolla", "rav4", "highlander", "tacoma", "tundra", "4runner", "sienna", "prius", "avalon", "venza", "sequoia", "land cruiser", "yaris", "supra", "gr86", "solara", "celica", "matrix", "fj cruiser", "echo", "tercel", "avalon", "c-hr", "chr", "auris", "aygo", "hilux", "vios"],
  Honda: ["civic", "accord", "cr-v", "pilot", "odyssey", "ridgeline", "passport", "hrv", "hr-v", "fit", "insight", "element", "cr-z", "prelude", "s2000", "crosstour"],
  Ford: ["f-150", "f150", "f-250", "f250", "f-350", "f350", "mustang", "explorer", "escape", "edge", "fusion", "focus", "ranger", "bronco", "expedition", "maverick", "transit", "ecosport", "fiesta", "flex", "taurus", "crown victoria", "expedition el", "excursion", "e-150", "e150", "e-250", "e250", "e-350", "e350", "windstar", "freestar", "f-450", "f450", "f-550", "f550"],
  Chevrolet: ["silverado", "equinox", "malibu", "traverse", "tahoe", "suburban", "colorado", "blazer", "trax", "spark", "impala", "camaro", "corvette", "trailblazer", "express", "cruze", "sonic", "volt", "bolt", "hhr", "avalanche", "cobalt", "uplander", "venture", "astro", "cheyenne", "s10", "c1500", "k1500", "c2500", "k2500", "c3500", "k3500"],
  Nissan: ["altima", "sentra", "maxima", "rogue", "pathfinder", "murano", "frontier", "titan", "armada", "kicks", "versa", "leaf", "quest", "xterra", "370z", "350z", "juke", "cube", "nv200", "titan xd", "frontier desert runner", "note", "qashqai"],
  BMW: ["3 series", "5 series", "7 series", "x1", "x3", "x5", "x7", "m3", "m5", "x6", "i3", "i4", "i7", "z4", "2 series", "4 series", "8 series", "x2", "x4", "m4", "m2", "m8", "x5 m", "x6 m", "1 series", "116i", "118i", "120i", "325i", "328i", "330i", "335i", "430i", "435i", "525i", "528i", "530i", "535i", "540i", "750li"],
  "Mercedes-Benz": ["c-class", "e-class", "s-class", "glc", "gle", "gls", "gla", "glb", "cla", "cls", "sl", "g-class", "amg", "eqb", "eqe", "eqs", "glk", "ml", "gl", "slk", "cl", "clk", "sprinter", "metris"],
  Jeep: ["wrangler", "grand cherokee", "cherokee", "compass", "renegade", "gladiator", "patriot", "commander", "wagoneer", "grand wagoneer", "tj", "jk", "jl"],
  Dodge: ["charger", "challenger", "durango", "ram", "dart", "journey", "viper", "hornet", "caravan", "grand caravan", "nitro", "magnum", "avenger", "caliber", "dakota", "ram 1500", "ram 2500", "ram 3500"],
  Ram: ["1500", "2500", "3500", "promaster", "ramcharger", "1500 classic", "2500 heavy duty", "3500 heavy duty", "700", "1500 hemi", "2500 diesel"],
  Gmc: ["sierra", "yukon", "terrain", "acadia", "canyon", "envoy", "safari", "savana", "jimmy", "sonoma", "1500", "2500", "3500"],
  Hyundai: ["elantra", "sonata", "tucson", "santa fe", "palisade", "kona", "ioniq", "veloster", "genesis", "accent", "azera", "nexo", "tiburon", "entourage", "veracruz", "venue"],
  Kia: ["optima", "sorento", "sportage", "telluride", "stinger", "soul", "forte", "rio", "carnival", "k5", "niro", "ev6", "seltos", "cadenza", "sedona", "borrego", "amanti", "spectra", "rondo"],
  Subaru: ["outback", "forester", "impreza", "legacy", "crosstrek", "wrx", "sti", "ascent", "brz", "baja", "tribeca", "xv crosstrek", "crosstour"],
  Audi: ["a3", "a4", "a5", "a6", "a7", "a8", "q3", "q5", "q7", "q8", "e-tron", "tt", "r8", "s4", "s5", "s6", "rs3", "rs5", "rs7", "allroad", "sq5", "q5 e"],
  Volkswagen: ["jetta", "passat", "tiguan", "atlas", "golf", "gti", "r", "beetle", "touareg", "arteon", "taos", "id.4", "cc", "eos", "routan", "rabbit"],
  Lexus: ["es", "is", "gs", "ls", "nx", "rx", "gx", "lx", "ux", "lc", "rc", "ct", "sc", "it"],
  Tesla: ["model 3", "model s", "model x", "model y", "cybertruck", "roadster"],
  Mazda: ["cx-5", "cx-9", "cx-30", "cx-50", "mazda3", "mazda6", "mx-5 miata", "miata", "cx-3", "cx-7", "mazda2", "mazda5", "tribute", "b2300", "b3000", "b4000"],
  Volvo: ["s60", "s90", "v60", "v90", "xc40", "xc60", "xc90", "c40", "v40", "c30", "s40", "s70", "s80", "v70"],
  Infiniti: ["q50", "q60", "qx50", "qx60", "qx80", "g35", "g37", "fx35", "fx45", "ex35", "m35", "m37", "qx56", "qx70"],
  Acura: ["mdx", "rdx", "tlx", "ilx", "integra", "tsx", "tl", "rlx", "nsx", "zdx", "rsx", "cl"],
  Buick: ["enclave", "encore", "envision", "lacrosse", "regal", "verano", "lucerne", "lesabre", "century", "park avenue", "riviera", "roadmaster"],
  Mitsubishi: ["outlander", "eclipse", "lancer", "pajero", "montero", "asx", "mirage", "fuso"],
  Geo: ["tracker", "prizm", "metro", "storm"],
  Suzuki: ["sx4", "vitara", "grand vitara", "swift", "equator", "kizashi", "xl7", "forenza", "reno", "verona", "sidekick", "samurai"],
  Smart: ["fortwo"]
};

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "f150": "F-150",
  "f250": "F-250",
  "f350": "F-350",
  "cr-v": "CR-V",
  "crv": "CR-V",
  "hr-v": "HR-V",
  "hrv": "HR-V",
  "3 series": "3 Series",
  "5 series": "5 Series",
  "7 series": "7 Series"
};
