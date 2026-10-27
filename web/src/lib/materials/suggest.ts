// What you'd likely buy for a spot on the plan, worked out from what that spot is and what's in it.
// A kitchen gets counter outlets spaced by code, backsplash from the cabinet run, pulls for each cabinet;
// a bathroom gets cement board for the shower, a fan, the parts for each toilet and basin; a bedroom gets
// outlets every 12 ft of wall and a smoke alarm. Quantities come from the real size; prices are rough
// US big-box numbers for the demo, and lead times are typical days to get it (special-order items).
import type { ItemKind } from "@/lib/data/types";
import type { Element, Fixture, Floor, Pt, Room } from "@/lib/plan/types";
import type { Unit } from "./types";

export type SuggestGroup = "Finishes" | "Electrical" | "Plumbing" | "Cabinets & hardware" | "Doors & windows" | "Framing & drywall" | "Safety";
export const GROUP_ORDER: SuggestGroup[] = ["Cabinets & hardware", "Plumbing", "Electrical", "Doors & windows", "Finishes", "Framing & drywall", "Safety"];

export interface Suggestion { name: string; qty: number; unit: Unit; unit_cost: number; why?: string; link?: string | null; group?: SuggestGroup; lead?: number }

const SQFT = 1 / 92903.04;   // mm² → ft²
const FT = 1 / 304.8;        // mm → ft
const up = (n: number) => Math.max(1, Math.ceil(n - 1e-9));
const perimeter = (poly: Pt[]) => poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);
const inches = (mm: number) => Math.round((mm / 25.4) / 3) * 3;
const s = (group: SuggestGroup, name: string, qty: number, unit: Unit, unit_cost: number, why?: string, lead?: number): Suggestion => ({ group, name, qty, unit, unit_cost, why, lead });

/** Paint: two coats, about 350 ft² a gallon. */
const paint = (sqft: number, what = "Wall paint"): Suggestion => s("Finishes", what, up((sqft * 2) / 350), "gal", 42, `${Math.round(sqft)} ft², 2 coats`);

/** A cabinet's width along the wall: the side that isn't its depth. */
function cabWidth(f: Fixture) {
  const w = f.bbox[2] - f.bbox[0], h = f.bbox[3] - f.bbox[1];
  const depth = f.kind === "wall_cabinet" ? 330 : 600;
  return Math.abs(w - depth) < Math.abs(h - depth) ? h : w;
}

/** The parts each kind of fixture needs, sized from the fixture where it matters. */
function fixtureParts(f: Fixture): Suggestion[] {
  const w = Math.max(f.bbox[2] - f.bbox[0], f.bbox[3] - f.bbox[1]);
  switch (f.kind) {
    case "toilet": return [s("Plumbing", "Toilet, elongated", 1, "ea", 260, undefined, 2), s("Plumbing", "Wax ring with bolts", 1, "ea", 6), s("Plumbing", "Toilet supply line 12 in", 1, "ea", 9), s("Plumbing", "Quarter-turn stop valve", 1, "ea", 11)];
    case "washbasin": return [s("Plumbing", `Vanity ${inches(w)} in with top`, 1, "ea", 380, "sized from the plan", 7), s("Plumbing", "Bathroom faucet", 1, "ea", 95), s("Plumbing", "P-trap kit 1¼ in", 1, "ea", 12), s("Plumbing", "Faucet supply line", 2, "ea", 9), s("Plumbing", "Quarter-turn stop valve", 2, "ea", 11)];
    case "kitchen_sink": return [s("Plumbing", "Kitchen faucet, pull-down", 1, "ea", 180), s("Plumbing", "Garbage disposal ½ hp", 1, "ea", 140), s("Plumbing", "P-trap kit 1½ in", 1, "ea", 14), s("Plumbing", "Faucet supply line", 2, "ea", 9)];
    case "shower": return [s("Plumbing", "Shower valve and trim kit", 1, "ea", 150), s("Plumbing", "Shower drain", 1, "ea", 45), s("Framing & drywall", "Cement board ½ in 3×5", up((perimeter([[0, 0], [w, 0], [w, w], [0, w]]) * 2100 * SQFT * 0.75) / 15), "sheet", 14, "three shower walls to 7 ft"), s("Finishes", "Waterproofing membrane", 1, "gal", 65)];
    case "bathtub": return [s("Plumbing", `Bathtub ${inches(w)} in`, 1, "ea", 420, "sized from the plan", 5), s("Plumbing", "Tub drain kit", 1, "ea", 35), s("Plumbing", "Tub/shower valve and trim", 1, "ea", 160), s("Finishes", "Silicone, white", 2, "tube", 8)];
    case "dishwasher": return [s("Plumbing", "Dishwasher install kit", 1, "ea", 25)];
    case "range": return [s("Electrical", "Range cord, 4-wire", 1, "ea", 28), s("Cabinets & hardware", "Anti-tip bracket", 1, "ea", 12)];
    case "range_hood": return [s("Electrical", "Range hood duct kit", 1, "ea", 35)];
    case "fridge": return [s("Plumbing", "Ice maker line 10 ft", 1, "ea", 15)];
    case "washing_machine": return [s("Plumbing", "Washer hoses, braided", 1, "set", 22), s("Plumbing", "Washer outlet box", 1, "ea", 30), s("Electrical", "Dryer vent kit", 1, "ea", 25)];
    case "base_cabinet": return [s("Cabinets & hardware", `Base cabinet ${inches(cabWidth(f))} in`, 1, "ea", 240, "sized from the plan", 14), s("Cabinets & hardware", "Cabinet pulls", 2, "ea", 4), s("Cabinets & hardware", "Countertop", up((cabWidth(f) * 640 * SQFT)), "sqft", 65, "25 in deep over this cabinet", 10)];
    case "wall_cabinet": return [s("Cabinets & hardware", `Wall cabinet ${inches(cabWidth(f))} in`, 1, "ea", 180, "sized from the plan", 14), s("Cabinets & hardware", "Cabinet pulls", 1, "ea", 4), s("Electrical", "Under-cabinet LED light", 1, "ea", 35)];
    case "wardrobe": return [s("Cabinets & hardware", "Closet shelf and rod kit", 1, "ea", 45)];
    case "lamp": return [s("Electrical", "Light fixture", 1, "ea", 60), s("Electrical", "LED bulbs 4-pack", 1, "box", 12)];
    default: return [];
  }
}

/** Add up parts across several fixtures: two basins → 4 supply lines, one line on the list. */
function merge(list: Suggestion[]): Suggestion[] {
  const out = new Map<string, Suggestion>();
  for (const x of list) {
    const k = `${x.name}|${x.unit}`;
    const have = out.get(k);
    if (have) out.set(k, { ...have, qty: have.qty + x.qty });
    else out.set(k, { ...x });
  }
  return [...out.values()];
}

/** A wall (one face or both) or one side of a room seen from inside. */
export function wallSuggestions(lengthMm: number, heightMm: number, faces: number, openingsMm2 = 0): Suggestion[] {
  const face = Math.max(0, lengthMm * heightMm - openingsMm2) * SQFT;
  const sheets = up((face * faces * 1.1) / 32);
  const ft = lengthMm * FT;
  return [
    paint(face * faces),
    s("Framing & drywall", "Drywall 4×8 ½ in", sheets, "sheet", 16, `${Math.round(face * faces)} ft² + 10%`),
    s("Framing & drywall", "2×4×10 studs", up(lengthMm / 406) + 1, "ea", 6.8, `16 in centres over ${ft.toFixed(1)} ft`),
    s("Framing & drywall", "2×4×12 plates", up((ft * 3) / 12), "ea", 8, "one bottom, two top"),
    s("Framing & drywall", "Joint compound 4.5 gal", up(sheets / 12), "ea", 19),
    s("Framing & drywall", "Drywall screws 1¼ in", 1, "box", 12),
    s("Electrical", "Duplex outlet 15A, white", up(ft / 12), "ea", 3.5, "one every 12 ft of wall"),
    s("Electrical", "Old-work box, 1-gang", up(ft / 12), "ea", 2.8),
    s("Finishes", "Baseboard", up(ft * faces * 1.1), "lf", 1.6),
  ];
}

const WET = new Set(["bathroom", "wc", "laundry", "kitchen", "utility"]);
const SOFT = new Set(["bedroom", "closet"]);
const LIVING = new Set(["living", "family", "dining", "study", "office", "bedroom"]);
const PASSAGE = new Set(["hallway", "foyer", "stair_hall"]);

/** Everything for one room: finishes from its size, then what its type and contents need. */
export function roomSuggestions(floor: Floor, r: Room): Suggestion[] {
  const H = floor.height_mm || 2700;
  const area = r.area_m2 * 10.7639;
  const per = perimeter(r.polygon);
  const perFt = per * FT;
  const ops = floor.openings.filter((o) => o.room_ids.includes(r.id));
  const opArea = ops.reduce((a, o) => a + o.width_mm * (o.kind === "window" ? 1200 : 2100), 0);
  const walls = Math.max(0, per * H - opArea) * SQFT;
  const inside = floor.fixtures.filter((f) => f.room_id === r.id);
  const count = (k: string) => inside.filter((f) => f.kind === k).length;
  const out: Suggestion[] = [];

  // what's in it: every fixture's parts, added up
  out.push(...inside.flatMap(fixtureParts));

  const base = inside.filter((f) => f.kind === "base_cabinet");
  const run = base.reduce((a, f) => a + cabWidth(f), 0) + inside.filter((f) => f.kind === "kitchen_sink" || f.kind === "dishwasher" || f.kind === "range").reduce((a, f) => a + cabWidth(f), 0);
  if (r.type === "kitchen") {
    out.push(
      s("Electrical", "GFCI outlet 20A", Math.max(2, up((run / 25.4) / 48)), "ea", 22, `${Math.round(run * FT)} ft of counter, one every 4 ft (NEC 210.52)`),
      s("Electrical", "LED recessed light 6 in", up(area / 30), "ea", 18, `${Math.round(area)} ft², one per 30 ft²`),
      s("Electrical", "12/2 wire, 250 ft", 1, "roll", 125, "two 20A small-appliance circuits"),
      s("Finishes", "Backsplash tile", up(run * FT * 1.5 * 1.1), "sqft", 12, "18 in high along the counter, +10%"),
      s("Finishes", "Tile adhesive (mastic)", 1, "gal", 28),
    );
  }
  if (r.type === "bathroom" || r.type === "wc") {
    out.push(
      s("Electrical", "GFCI outlet 20A", Math.max(1, count("washbasin")), "ea", 22, "one by each basin"),
      s("Electrical", "Vanity light", Math.max(1, count("washbasin")), "ea", 70),
      ...(count("shower") || count("bathtub") ? [s("Electrical", "Bath exhaust fan 80 CFM", 1, "ea", 110, "a shower or tub is in here"), s("Electrical", "4 in duct kit", 1, "ea", 20)] : []),
      s("Cabinets & hardware", "Towel bar 24 in", Math.max(1, count("washbasin")), "ea", 25),
      s("Cabinets & hardware", "Toilet paper holder", Math.max(1, count("toilet")), "ea", 15),
      s("Cabinets & hardware", "Mirror", Math.max(1, count("washbasin")), "ea", 90),
      s("Finishes", "Grout sealer", 1, "ea", 14),
    );
  }
  if (r.type === "laundry" || r.type === "utility") out.push(s("Electrical", "GFCI outlet 20A", 1, "ea", 22), s("Plumbing", "Floor drain pan", 1, "ea", 35));
  if (r.type === "garage") out.push(s("Electrical", "GFCI outlet 20A", up(perFt / 25), "ea", 22, "garage outlets need GFCI"), s("Electrical", "LED shop light 4 ft", up(area / 100), "ea", 30, `${Math.round(area)} ft²`));
  if (LIVING.has(r.type)) {
    out.push(
      s("Electrical", "Duplex outlet 15A, white", up(perFt / 12), "ea", 3.5, `${Math.round(perFt)} ft of wall, one every 12 ft (NEC 210.52)`),
      s("Electrical", "Outlet cover plate", up(perFt / 12), "ea", 1.2),
      s("Electrical", "LED recessed light 6 in", up(area / 36), "ea", 18, `${Math.round(area)} ft²`),
      s("Electrical", "Dimmer switch", 1, "ea", 25),
    );
  }
  if (PASSAGE.has(r.type)) out.push(s("Electrical", "Flush ceiling light", up(area / 60), "ea", 45), ...(r.type === "stair_hall" ? [s("Electrical", "3-way switch", 2, "ea", 9, "top and bottom of the stairs"), s("Doors & windows", "Stair handrail 8 ft", 1, "ea", 75)] : []));
  if (r.type === "closet") out.push(s("Cabinets & hardware", "Closet shelf and rod kit", up(perFt / 8), "ea", 45));
  if (r.type === "bedroom" || PASSAGE.has(r.type)) out.push(s("Safety", "Smoke and CO alarm, hardwired", 1, "ea", 55, r.type === "bedroom" ? "one in every bedroom" : "one outside the bedrooms"));

  // doors and windows that open into it
  const doors = ops.filter((o) => o.kind === "door" || o.kind === "double_door");
  const intDoors = doors.filter((o) => !o.exterior).reduce((a, o) => a + (o.kind === "double_door" ? 2 : 1), 0);
  if (intDoors) out.push(
    s("Doors & windows", r.type === "bathroom" || r.type === "wc" || r.type === "bedroom" ? "Privacy handle set" : "Passage handle set", intDoors, "set", 28),
    s("Doors & windows", "Door stop", intDoors, "ea", 4),
  );
  const windows = ops.filter((o) => o.kind === "window");
  for (const w of windows) out.push(s("Doors & windows", `Window blind ${inches(w.width_mm)} in`, 1, "ea", 35, "sized from the plan", 7));

  // finishes from the size
  if (r.type === "garage") out.push(s("Finishes", "Epoxy floor kit", up(area / 250), "ea", 120, `${Math.round(area)} ft²`));
  else if (WET.has(r.type)) out.push(
    s("Finishes", "Porcelain floor tile", up(area * 1.1), "sqft", 3.5, `${Math.round(area)} ft² + 10%`),
    s("Finishes", "Thinset mortar 50 lb", up(area / 50), "bag", 22),
    s("Finishes", "Sanded grout 25 lb", up(area / 100), "bag", 18),
  );
  else if (SOFT.has(r.type)) out.push(s("Finishes", "Carpet and pad", up(area * 1.1), "sqft", 3, `${Math.round(area)} ft² + 10%`));
  else out.push(s("Finishes", "Engineered hardwood", up(area * 1.1), "sqft", 5.2, `${Math.round(area)} ft² + 10%`, 5));
  out.push(paint(walls), paint(area, "Ceiling paint"));
  if (r.type !== "garage" && !WET.has(r.type)) out.push(s("Finishes", "Baseboard", up(perFt * 1.1), "lf", 1.6, `${Math.round(perFt)} ft around`));
  out.push(s("Finishes", "Painter's tape", up(perFt / 60), "roll", 7));

  return merge(out);
}

const ITEM: Record<ItemKind, Suggestion[]> = {
  outlet: [s("Electrical", "Duplex outlet 15A, white", 1, "ea", 3.5), s("Electrical", "Old-work box, 1-gang", 1, "ea", 2.8), s("Electrical", "Outlet cover plate", 1, "ea", 1.2)],
  switch: [s("Electrical", "Single-pole switch", 1, "ea", 3), s("Electrical", "Old-work box, 1-gang", 1, "ea", 2.8), s("Electrical", "Switch cover plate", 1, "ea", 1.2)],
  light: [s("Electrical", "Light fixture", 1, "ea", 60), s("Electrical", "Ceiling box, round", 1, "ea", 4)],
  data: [s("Electrical", "Cat6 keystone jack", 1, "ea", 5), s("Electrical", "Low-voltage bracket", 1, "ea", 2)],
  plumbing: [s("Plumbing", "Quarter-turn stop valve", 1, "ea", 11)],
  vent: [s("Finishes", "Vent cover", 1, "ea", 9)],
  thermostat: [s("Electrical", "Smart thermostat", 1, "ea", 130)],
  mount: [s("Cabinets & hardware", "TV wall mount", 1, "ea", 45)],
  other: [],
};

export const itemSuggestions = (kind: ItemKind) => ITEM[kind] ?? [];

/** Suggestions for any element of the plan. */
export function suggestFor(e: Element): Suggestion[] {
  const H = e.floor.height_mm || 2700;
  if (e.kind === "room") return roomSuggestions(e.floor, e.el);
  if (e.kind === "wall") return wallSuggestions(e.el.length_mm, H, e.el.exterior ? 1 : 2);
  if (e.kind === "opening") {
    const o = e.el;
    const w = inches(o.width_mm);
    const casing = s("Doors & windows", "Casing", up(((2 * (o.kind === "window" ? 1200 : 2032) + o.width_mm) * (o.exterior ? 1 : 2) * FT) * 1.1), "lf", 1.4);
    if (o.kind === "window") return [s("Doors & windows", `Window ${w} in wide`, 1, "ea", 320, "sized from the plan", 21), casing, s("Doors & windows", `Window blind ${w} in`, 1, "ea", 35, undefined, 7), s("Finishes", "Window caulk", 2, "tube", 7), s("Finishes", "Low-expansion foam", 1, "ea", 9)];
    if (o.kind === "garage_door") return [s("Doors & windows", "Garage door opener", 1, "ea", 280), s("Doors & windows", "Garage door weatherstrip", up((o.width_mm + 4200) * FT), "lf", 2.2)];
    if (o.kind === "sliding_door") return [s("Doors & windows", `Sliding patio door ${w} in`, 1, "ea", 900, "sized from the plan", 21), casing, s("Doors & windows", "Door sill pan", 1, "ea", 40)];
    if (o.kind === "opening") return [casing, paint((2 * 2032 + o.width_mm) * 150 * SQFT * 2, "Trim paint")];
    const leaves = o.kind === "double_door" ? 2 : 1;
    const each = inches(o.width_mm / leaves);
    const rooms = o.room_ids.map((id) => e.floor.rooms.find((r) => r.id === id)?.type);
    const privacy = rooms.some((t) => t === "bathroom" || t === "wc" || t === "bedroom");
    return o.exterior
      ? [s("Doors & windows", `Exterior door, pre-hung ${each} in`, leaves, "ea", 420, "sized from the plan", 10), s("Doors & windows", "Entry lockset with deadbolt", 1, "set", 85), casing, s("Doors & windows", "Door sweep", leaves, "ea", 14)]
      : [s("Doors & windows", `Interior door, pre-hung ${each} in`, leaves, "ea", 160, "sized from the plan", 7), s("Doors & windows", privacy ? "Privacy handle set" : "Passage handle set", 1, "set", 28, privacy ? "opens into a bedroom or bathroom" : undefined), s("Doors & windows", "Door stop", leaves, "ea", 4), casing, s("Doors & windows", "Shims", 1, "box", 6)];
  }
  if (e.kind === "fixture") {
    const f = e.el;
    const own: Suggestion[] = f.product_name ? [{ name: f.product_name, qty: 1, unit: "ea", unit_cost: 0, link: f.product_url ?? null, why: "the product picked for it" }] : [];
    const parts = fixtureParts(f);
    return [...own, ...(parts.length ? parts : [s("Cabinets & hardware", f.kind === "other" ? "Replacement part" : f.name, 1, "ea", 0), s("Cabinets & hardware", "Mounting hardware", 1, "box", 8)])];
  }
  return [s("Framing & drywall", "Stair tread", 13, "ea", 38), s("Doors & windows", "Stair handrail 8 ft", 1, "ea", 75), s("Framing & drywall", "Construction adhesive", 2, "tube", 6)];
}

/** Ready-made bundles for common jobs, added in one go. */
export const KITS: { name: string; items: Suggestion[] }[] = [
  { name: "Swap a toilet", items: fixtureParts({ kind: "toilet", bbox: [0, 0, 400, 700] } as Fixture) },
  { name: "Swap an interior door", items: [s("Doors & windows", "Interior door, pre-hung 30 in", 1, "ea", 160, undefined, 7), s("Doors & windows", "Passage handle set", 1, "set", 28), s("Doors & windows", "Casing", 34, "lf", 1.4), s("Doors & windows", "Shims", 1, "box", 6), s("Finishes", "Trim paint", 1, "gal", 42)] },
  { name: "Patch and paint a room", items: [s("Framing & drywall", "Drywall 4×8 ½ in", 2, "sheet", 16), s("Framing & drywall", "Joint compound 4.5 gal", 1, "ea", 19), s("Framing & drywall", "Mesh tape", 1, "roll", 6), s("Finishes", "Primer", 1, "gal", 30), s("Finishes", "Wall paint", 2, "gal", 42), s("Finishes", "Painter's tape", 2, "roll", 7)] },
  { name: "Add a circuit (20A)", items: [s("Electrical", "20A breaker", 1, "ea", 12), s("Electrical", "12/2 wire, 250 ft", 1, "roll", 125), s("Electrical", "GFCI outlet 20A", 1, "ea", 22), s("Electrical", "Duplex outlet 20A", 3, "ea", 5), s("Electrical", "Old-work box, 1-gang", 4, "ea", 2.8), s("Electrical", "Wire nuts", 1, "box", 6)] },
  { name: "Tile 50 ft² of floor", items: [s("Finishes", "Porcelain floor tile", 55, "sqft", 3.5), s("Finishes", "Thinset mortar 50 lb", 1, "bag", 22), s("Finishes", "Sanded grout 25 lb", 1, "bag", 18), s("Finishes", "Tile spacers", 1, "box", 5), s("Finishes", "Grout sealer", 1, "ea", 14)] },
];

/** "2 outlets" → 2 and "outlets"; anything else is qty 1. */
export function parseQty(text: string): { qty: number; name: string } {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(?:x|×)?\s+(.+)$/i);
  return m ? { qty: Number(m[1]), name: m[2] } : { qty: 1, name: text.trim() };
}
