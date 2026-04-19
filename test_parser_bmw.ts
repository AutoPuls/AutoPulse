import { parseListingText } from './lib/parser/listingParser';

const aria = "2015 BMW 3 series 328i Sedan 4D";
const parsed = parseListingText(aria, aria);

console.log(JSON.stringify(parsed, null, 2));
