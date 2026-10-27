// The contractor's price book: everyday US renovation items they add to a quote in one tap. Prices are
// in cents, labor and standard materials included. Demo prices; the real book is the contractor's own.
import type { Unit } from "./types";

export interface PriceBookItem { description: string; unit: Unit; unit_price: number }
export interface PriceBookGroup { group: string; items: PriceBookItem[] }

const i = (description: string, unit: Unit, dollars: number): PriceBookItem => ({ description, unit, unit_price: Math.round(dollars * 100) });

export const PRICE_BOOK: PriceBookGroup[] = [
  { group: "Demolition", items: [
    i("Kitchen demolition and haul-away", "lot", 2400),
    i("Bathroom demolition and haul-away", "lot", 1400),
    i("Remove flooring and haul away", "sqft", 2.25),
    i("Remove non-load-bearing wall", "lf", 95),
    i("20 yard dumpster, one haul", "ea", 650),
  ] },
  { group: "Framing", items: [
    i("Frame new interior wall, 2x4 studs", "lf", 48),
    i("New interior door opening with header", "ea", 850),
    i("Beam for load-bearing wall removal, engineered", "lot", 6500),
    i("Blocking for grab bars, TV or cabinets", "ea", 75),
  ] },
  { group: "Electrical", items: [
    i("New outlet, 20A, with wiring", "ea", 225),
    i("GFCI outlet", "ea", 185),
    i("Recessed LED light, 6 in", "ea", 195),
    i("Under-cabinet LED lighting", "lf", 65),
    i("Dedicated 240V circuit for range or dryer", "ea", 750),
    i("Electrician, hourly", "hr", 115),
  ] },
  { group: "Plumbing", items: [
    i("Relocate sink drain and supply", "ea", 950),
    i("Shower valve and trim, pressure balanced", "ea", 650),
    i("Install toilet, client supplied", "ea", 275),
    i("Install faucet, client supplied", "ea", 225),
    i("Tankless water heater, supply and install", "ea", 3800),
    i("Plumber, hourly", "hr", 125),
  ] },
  { group: "Drywall and paint", items: [
    i("Hang, tape and finish drywall", "sqft", 3.75),
    i("Patch and paint walls and ceiling, two coats", "sqft", 2.5),
    i("Paint interior door and trim", "ea", 145),
    i("Paint baseboard and casing", "lf", 2.75),
  ] },
  { group: "Flooring", items: [
    i("Luxury vinyl plank, supply and install", "sqft", 7),
    i("Engineered oak flooring, supply and install", "sqft", 9.5),
    i("Refinish hardwood floors, sand and 3 coats", "sqft", 4.5),
    i("Self-leveling underlayment", "sqft", 3.25),
  ] },
  { group: "Tile", items: [
    i("Porcelain floor tile, supply and install", "sqft", 24),
    i("Shower wall tile, supply and install", "sqft", 32),
    i("Tile backsplash, subway", "sqft", 28),
    i("Shower waterproofing membrane", "sqft", 6),
    i("Heated floor mat with thermostat", "sqft", 22),
  ] },
  { group: "Cabinets and counters", items: [
    i("Shaker cabinets, supply and install", "lf", 410),
    i("Laminate countertop", "sqft", 38),
    i("Quartz countertop", "sqft", 85),
    i("Quartzite countertop", "sqft", 135),
    i("Undermount sink cut-out and polish", "ea", 275),
  ] },
  { group: "Fixtures", items: [
    i("Toilet, comfort height, supply and install", "ea", 650),
    i("Vanity with top and faucet, 36 in", "ea", 1450),
    i("Frameless glass shower door", "ea", 1850),
    i("Light fixture, supply and install", "ea", 285),
    i("Bath exhaust fan, vented outside", "ea", 450),
  ] },
  { group: "Permits and fees", items: [
    i("Building permit and inspections", "lot", 1200),
    i("Electrical permit", "lot", 350),
    i("Plumbing permit", "lot", 350),
    i("Site protection and daily clean-up", "lot", 950),
  ] },
];

/** Groups that fit a room, by words in its name ("Kitchen", "Primary bath"). */
const FITS: [RegExp, string[]][] = [
  [/kitchen|pantry/i, ["Cabinets and counters", "Electrical", "Plumbing", "Tile", "Fixtures"]],
  [/bath|wc|lav|powder|shower|ensuite/i, ["Fixtures", "Tile", "Plumbing", "Electrical"]],
  [/bed|living|family|dining|study|office|den|hall|foyer|stair/i, ["Drywall and paint", "Flooring", "Electrical"]],
  [/laundry|utility/i, ["Plumbing", "Electrical", "Flooring"]],
  [/whole|house/i, ["Permits and fees", "Demolition", "Framing"]],
];

/** The price book with the groups that fit this room first. Every group is still there. */
export function priceBookFor(roomName: string | null): (PriceBookGroup & { fits: boolean })[] {
  const fit = FITS.find(([re]) => roomName && re.test(roomName))?.[1] ?? [];
  const rank = (g: string) => { const n = fit.indexOf(g); return n < 0 ? 99 : n; };
  return PRICE_BOOK.map((g) => ({ ...g, fits: fit.includes(g.group) })).sort((a, b) => rank(a.group) - rank(b.group));
}
