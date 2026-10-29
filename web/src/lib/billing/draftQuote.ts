// A rules-based stand-in for the assistant drafting a quote from the plan. In the real app the assistant
// writes it; here each room type gets a few typical renovation lines at everyday US prices.
import type { Draw, LineItem, Quote, QuoteOption, Unit } from "./types";
import type { Fixture, Floor, Plan, Room } from "@/lib/plan/types";
import { newId, nextNumber } from "./money";
import { RULES } from "@/lib/plan/rules";

const SQFT = 10.764;
const PAINT_ROOMS = new Set(["bedroom", "living", "family", "dining", "study", "office"]);
const SMALL_ROOMS = new Set(["closet", "hallway", "foyer", "stair_hall", "laundry", "utility", "storage"]);
const CABINETS = new Set(["base_cabinet", "wall_cabinet", "kitchen_sink", "dishwasher"]);

export function draftQuote(plan: Plan, jobId: string, existingNumbers: string[], stageNames: string[]): Quote {
  const lines: LineItem[] = [];
  const add = (group: string, room_id: string | null, description: string, qty: number, unit: Unit, dollars: number, element_ids: string[] = [], extra: Partial<LineItem> = {}) =>
    lines.push({ id: newId(), group, room_id, description, qty: Math.max(1, Math.round(qty)), unit, unit_price: Math.round(dollars * 100), element_ids, ...extra });
  let smallSqft = 0;
  // good / better / best for the first kitchen's counters and the first bathroom's fixtures
  const options: QuoteOption[] = [
    { id: newId(), name: "Good", blurb: "Builder-grade finishes" },
    { id: newId(), name: "Better", blurb: "Mid-grade finishes. Most clients pick this." },
    { id: newId(), name: "Best", blurb: "Premium stone and fixtures throughout" },
  ];
  const [good, better, best] = options.map((o) => o.id);
  let kitchenTiers = false, bathTiers = false;

  for (const f of plan.floors) {
    const ids = (r: Room, kinds: string[]) => f.fixtures.filter((x) => x.room_id === r.id && kinds.includes(x.kind)).map((x) => x.id);
    for (const r of f.rooms) {
      if (r.outdoor) continue;
      const floorSqft = r.area_m2 * SQFT;
      const wallSqft = wallArea(r, f);
      if (r.type === "kitchen") {
        const cab = f.fixtures.filter((x: Fixture) => x.room_id === r.id && CABINETS.has(x.kind)).map((x) => x.id);
        add(r.name, r.id, "Demolition and haul-away of existing cabinets and counters", 1, "lot", 2400);
        add(r.name, r.id, "Shaker cabinets, supply and install", Math.max(10, Math.sqrt(r.area_m2) * 2 * 3.281 * 0.8), "lf", 410, cab);
        const top = floorSqft * 0.35, sink = ids(r, ["kitchen_sink"]);
        if (!kitchenTiers) {
          kitchenTiers = true;
          add(r.name, r.id, "Laminate countertops with drop-in sink", top, "sqft", 38, sink, { option_id: good });
          add(r.name, r.id, "Quartz countertops with undermount sink cut-out", top, "sqft", 85, sink, { option_id: better });
          add(r.name, r.id, "Quartzite countertops with waterfall edge and undermount sink", top, "sqft", 135, sink, { option_id: best });
        } else {
          add(r.name, r.id, "Quartz countertops with undermount sink cut-out", top, "sqft", 85, sink);
        }
        add(r.name, r.id, "Electrical: new outlets and under-cabinet lighting", 1, "lot", 1850);
        add(r.name, r.id, "Light fixtures: pendants and ceiling lights", 1, "lot", 900, [], { allowance: true });
        add(r.name, r.id, "Tile backsplash", top, "sqft", 28, [], { optional: true, allowance: true });
      } else if (r.type === "bathroom" || r.type === "wc") {
        const toilet = ids(r, ["toilet"]), basin = ids(r, ["washbasin"]), wet = ids(r, ["shower", "bathtub"]);
        add(r.name, r.id, "Demolition and haul-away", 1, "lot", r.type === "wc" ? 600 : 1400);
        if (r.type === "bathroom" && !bathTiers && (toilet.length || basin.length)) {
          bathTiers = true;
          if (toilet.length) {
            add(r.name, r.id, "Standard toilet, supply and install", toilet.length, "ea", 450, toilet, { option_id: good });
            add(r.name, r.id, "Comfort-height toilet with soft-close seat", toilet.length, "ea", 650, toilet, { option_id: better });
            add(r.name, r.id, "Wall-hung toilet with in-wall tank", toilet.length, "ea", 1650, toilet, { option_id: best });
          }
          if (basin.length) {
            add(r.name, r.id, "Stock vanity with cultured marble top and faucet", basin.length, "ea", 850, basin, { option_id: good });
            add(r.name, r.id, "Furniture-style vanity with quartz top and faucet", basin.length, "ea", 1600, basin, { option_id: better });
            add(r.name, r.id, "Floating vanity with quartz top, wall-mount faucet", basin.length, "ea", 2900, basin, { option_id: best });
          }
        } else {
          if (toilet.length) add(r.name, r.id, "New toilet, supply and install", toilet.length, "ea", 650, toilet);
          if (basin.length) add(r.name, r.id, "Vanity with basin and faucet", basin.length, "ea", 1200, basin);
        }
        if (wet.length) add(r.name, r.id, "Shower/tub: waterproofing, valve and trim", 1, "lot", 4800, wet);
        add(r.name, r.id, "Porcelain tile, floor and wet walls", floorSqft + (wet.length ? 60 : 0), "sqft", 24, [], { allowance: true });
        if (r.type === "bathroom") {
          add(r.name, r.id, "Light fixtures: vanity light and ceiling light", 1, "lot", 450, [], { allowance: true });
          add(r.name, r.id, "Heated floor", floorSqft, "sqft", 22, [], { optional: true });
        }
      } else if (PAINT_ROOMS.has(r.type)) {
        add(r.name, r.id, "Patch and paint walls and ceiling, two coats", wallSqft + floorSqft, "sqft", 2.5);
        add(r.name, r.id, "Engineered oak flooring, supply and install", floorSqft * 1.08, "sqft", 9.5);
      } else if (SMALL_ROOMS.has(r.type)) {
        smallSqft += wallSqft + floorSqft;
      }
    }
  }

  if (smallSqft) add("Whole house", null, "Paint halls, closets, foyer and stairs", smallSqft, "sqft", 2.25);
  add("Whole house", null, "Permits and inspections", 1, "lot", 1200, [], { taxable: false });
  add("Whole house", null, "Site protection and daily clean-up", 1, "lot", 950, [], { taxable: false });

  const mid = stageNames.find((s) => /rough/i.test(s)) ?? stageNames[Math.floor(stageNames.length / 2)] ?? null;
  const last = stageNames[stageNames.length - 1] ?? null;
  const schedule: Draw[] = [
    { id: newId(), label: "Deposit at signing", pct: 0.3, stage_name: null, invoice_id: null },
    { id: newId(), label: mid ? `${mid} done` : "Midway", pct: 0.4, stage_name: mid, invoice_id: null },
    { id: newId(), label: "Final payment", pct: 0.3, stage_name: last, invoice_id: null },
  ];
  const now = new Date();
  return {
    id: newId(), job_id: jobId, number: nextNumber("Q", existingNumbers), title: "Renovation quote", status: "draft",
    lines, chosen: [], options: kitchenTiers || bathTiers ? options : [], picked_option: null, financing: true,
    activity: [{ at: now.toISOString(), what: "Drafted from the plan" }], tax_rate: 0.0825, discount: 0, schedule,
    notes: kitchenTiers || bathTiers
      ? "Pick the package that suits you. Prices include labor and materials. Tile and light fixtures are allowances you choose later."
      : "Prices include labor and standard materials. Finishes can be changed before work starts.",
    terms: "Work starts within 2 weeks of the deposit. Changes are quoted as change orders before work.",
    valid_until: new Date(now.getTime() + 30 * 864e5).toISOString().slice(0, 10), ai_drafted: true,
    created_at: now.toISOString(), sent_at: null, viewed_at: null, approved_at: null, signed_by: null, declined_at: null,
  };
}

/** Wall area in sqft from the room outline and the floor height, less about 15% for doors and windows. */
function wallArea(r: Room, f: Floor) {
  const p = r.polygon;
  const perimMm = p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + Math.hypot(b[0] - a[0], b[1] - a[1]); }, 0)
    || 4 * Math.sqrt(r.area_m2) * 1000;
  const h = Math.min(f.height_mm || RULES.ceiling, RULES.ceiling);
  return (perimMm / 1000) * (h / 1000) * SQFT * 0.85;
}
