// What you'd likely buy for a spot on the plan, with quantities worked out from its real size: paint
// and flooring from a room's walls and floor, drywall and studs from a wall, slabs, hinges and casing
// from a door. Prices are rough US big-box numbers for the demo; the contractor edits them.
import type { ItemKind } from "@/lib/data/types";
import type { Element, Pt } from "@/lib/plan/types";
import type { Unit } from "./types";

export interface Suggestion { name: string; qty: number; unit: Unit; unit_cost: number; why?: string; link?: string | null }

const SQFT = 1 / 92903.04;   // mm² → ft²
const FT = 1 / 304.8;        // mm → ft
const up = (n: number) => Math.max(1, Math.ceil(n - 1e-9));
const perimeter = (poly: Pt[]) => poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);
const inches = (mm: number) => Math.round((mm / 25.4) / 2) * 2;

/** Paint: two coats, about 350 ft² a gallon. */
const paint = (sqft: number, what = "Wall paint"): Suggestion => ({ name: what, qty: up((sqft * 2) / 350), unit: "gal", unit_cost: 42, why: `${Math.round(sqft)} ft², 2 coats` });

/** A wall (one face or both) or one side of a room seen from inside. */
export function wallSuggestions(lengthMm: number, heightMm: number, faces: number, openingsMm2 = 0): Suggestion[] {
  const face = Math.max(0, lengthMm * heightMm - openingsMm2) * SQFT;
  const sheets = up((face * faces * 1.1) / 32);
  return [
    paint(face * faces),
    { name: "Drywall 4×8 ½ in", qty: sheets, unit: "sheet", unit_cost: 16, why: `${Math.round(face * faces)} ft² + 10%` },
    { name: "2×4×10 studs", qty: up(lengthMm / 406) + 1, unit: "ea", unit_cost: 6.8, why: `16 in centres over ${(lengthMm * FT).toFixed(1)} ft` },
    { name: "Joint compound 4.5 gal", qty: up(sheets / 12), unit: "ea", unit_cost: 19 },
    { name: "Drywall screws 1¼ in", qty: 1, unit: "box", unit_cost: 12 },
    { name: "Baseboard", qty: up(lengthMm * FT * faces * 1.1), unit: "lf", unit_cost: 1.6 },
  ];
}

const WET = new Set(["bathroom", "wc", "laundry", "kitchen", "utility"]);
const SOFT = new Set(["bedroom", "closet"]);

const FIXTURE: Record<string, Suggestion[]> = {
  toilet: [{ name: "Toilet, elongated", qty: 1, unit: "ea", unit_cost: 260 }, { name: "Wax ring with bolts", qty: 1, unit: "ea", unit_cost: 6 }, { name: "Toilet supply line 12 in", qty: 1, unit: "ea", unit_cost: 9 }],
  washbasin: [{ name: "Bathroom faucet", qty: 1, unit: "ea", unit_cost: 95 }, { name: "P-trap kit 1¼ in", qty: 1, unit: "ea", unit_cost: 12 }, { name: "Faucet supply line", qty: 2, unit: "ea", unit_cost: 9 }],
  kitchen_sink: [{ name: "Kitchen faucet, pull-down", qty: 1, unit: "ea", unit_cost: 180 }, { name: "Garbage disposal ½ hp", qty: 1, unit: "ea", unit_cost: 140 }, { name: "P-trap kit 1½ in", qty: 1, unit: "ea", unit_cost: 14 }, { name: "Faucet supply line", qty: 2, unit: "ea", unit_cost: 9 }],
  shower: [{ name: "Shower valve trim kit", qty: 1, unit: "ea", unit_cost: 150 }, { name: "Shower head", qty: 1, unit: "ea", unit_cost: 45 }, { name: "Silicone, clear", qty: 2, unit: "tube", unit_cost: 8 }],
  bathtub: [{ name: "Bathtub 60 in", qty: 1, unit: "ea", unit_cost: 420 }, { name: "Tub drain kit", qty: 1, unit: "ea", unit_cost: 35 }, { name: "Silicone, white", qty: 2, unit: "tube", unit_cost: 8 }],
  dishwasher: [{ name: "Dishwasher install kit", qty: 1, unit: "ea", unit_cost: 25 }],
  range: [{ name: "Range cord, 4-wire", qty: 1, unit: "ea", unit_cost: 28 }, { name: "Anti-tip bracket", qty: 1, unit: "ea", unit_cost: 12 }],
  range_hood: [{ name: "Range hood duct kit", qty: 1, unit: "ea", unit_cost: 35 }],
  fridge: [{ name: "Ice maker line 10 ft", qty: 1, unit: "ea", unit_cost: 15 }],
  washing_machine: [{ name: "Washer hoses, braided", qty: 1, unit: "set", unit_cost: 22 }, { name: "Washer drain box", qty: 1, unit: "ea", unit_cost: 30 }],
  base_cabinet: [{ name: "Base cabinet", qty: 1, unit: "ea", unit_cost: 240 }, { name: "Cabinet screws", qty: 1, unit: "box", unit_cost: 9 }, { name: "Shims", qty: 1, unit: "box", unit_cost: 6 }],
  wall_cabinet: [{ name: "Wall cabinet", qty: 1, unit: "ea", unit_cost: 180 }, { name: "Cabinet screws", qty: 1, unit: "box", unit_cost: 9 }],
  lamp: [{ name: "Light fixture", qty: 1, unit: "ea", unit_cost: 60 }, { name: "LED bulbs 4-pack", qty: 1, unit: "box", unit_cost: 12 }],
};

const ITEM: Record<ItemKind, Suggestion[]> = {
  outlet: [{ name: "Duplex outlet 15A, white", qty: 1, unit: "ea", unit_cost: 3.5 }, { name: "Old-work box, 1-gang", qty: 1, unit: "ea", unit_cost: 2.8 }, { name: "Outlet cover plate", qty: 1, unit: "ea", unit_cost: 1.2 }],
  switch: [{ name: "Single-pole switch", qty: 1, unit: "ea", unit_cost: 3 }, { name: "Old-work box, 1-gang", qty: 1, unit: "ea", unit_cost: 2.8 }, { name: "Switch cover plate", qty: 1, unit: "ea", unit_cost: 1.2 }],
  light: [{ name: "Light fixture", qty: 1, unit: "ea", unit_cost: 60 }, { name: "Ceiling box, round", qty: 1, unit: "ea", unit_cost: 4 }],
  data: [{ name: "Cat6 keystone jack", qty: 1, unit: "ea", unit_cost: 5 }, { name: "Low-voltage bracket", qty: 1, unit: "ea", unit_cost: 2 }],
  plumbing: [{ name: "Quarter-turn stop valve", qty: 1, unit: "ea", unit_cost: 11 }],
  vent: [{ name: "Vent cover", qty: 1, unit: "ea", unit_cost: 9 }],
  thermostat: [{ name: "Smart thermostat", qty: 1, unit: "ea", unit_cost: 130 }],
  mount: [{ name: "TV wall mount", qty: 1, unit: "ea", unit_cost: 45 }],
  other: [],
};

export const itemSuggestions = (kind: ItemKind) => ITEM[kind] ?? [];

/** Suggestions for any element of the plan. */
export function suggestFor(e: Element): Suggestion[] {
  const H = e.floor.height_mm || 2700;
  if (e.kind === "room") {
    const r = e.el;
    const floor = r.area_m2 * 10.7639;
    const per = perimeter(r.polygon);
    const ops = e.floor.openings.filter((o) => o.room_ids.includes(r.id));
    const opArea = ops.reduce((a, o) => a + o.width_mm * (o.kind === "window" ? 1200 : 2100), 0);
    const walls = Math.max(0, per * H - opArea) * SQFT;
    const out: Suggestion[] = [];
    if (r.type === "garage") out.push({ name: "Epoxy floor kit", qty: up(floor / 250), unit: "ea", unit_cost: 120, why: `${Math.round(floor)} ft²` });
    else if (WET.has(r.type)) out.push(
      { name: "Porcelain floor tile", qty: up(floor * 1.1), unit: "sqft", unit_cost: 3.5, why: `${Math.round(floor)} ft² + 10%` },
      { name: "Thinset mortar 50 lb", qty: up(floor / 50), unit: "bag", unit_cost: 22 },
      { name: "Sanded grout 25 lb", qty: up(floor / 100), unit: "bag", unit_cost: 18 },
    );
    else if (SOFT.has(r.type)) out.push({ name: "Carpet and pad", qty: up(floor * 1.1), unit: "sqft", unit_cost: 3, why: `${Math.round(floor)} ft² + 10%` });
    else out.push({ name: "Engineered hardwood", qty: up(floor * 1.1), unit: "sqft", unit_cost: 5.2, why: `${Math.round(floor)} ft² + 10%` });
    out.push(paint(walls), paint(floor, "Ceiling paint"));
    if (r.type !== "garage" && !WET.has(r.type)) out.push({ name: "Baseboard", qty: up(per * FT * 1.1), unit: "lf", unit_cost: 1.6, why: `${Math.round(per * FT)} ft around` });
    out.push({ name: "Painter's tape", qty: up(per * FT / 60), unit: "roll", unit_cost: 7 });
    return out;
  }
  if (e.kind === "wall") return wallSuggestions(e.el.length_mm, H, e.el.exterior ? 1 : 2);
  if (e.kind === "opening") {
    const o = e.el;
    const w = inches(o.width_mm);
    const casing = { name: "Casing", qty: up(((2 * (o.kind === "window" ? 1200 : 2032) + o.width_mm) * (o.exterior ? 1 : 2) * FT) * 1.1), unit: "lf" as const, unit_cost: 1.4 };
    if (o.kind === "window") return [{ name: `Window ${w} in wide`, qty: 1, unit: "ea", unit_cost: 320 }, casing, { name: "Window caulk", qty: 2, unit: "tube", unit_cost: 7 }, { name: "Low-expansion foam", qty: 1, unit: "ea", unit_cost: 9 }];
    if (o.kind === "garage_door") return [{ name: "Garage door opener", qty: 1, unit: "ea", unit_cost: 280 }, { name: "Garage door weatherstrip", qty: up((o.width_mm + 4200) * FT), unit: "lf", unit_cost: 2.2 }];
    if (o.kind === "sliding_door") return [{ name: `Sliding patio door ${w} in`, qty: 1, unit: "ea", unit_cost: 900 }, casing, { name: "Door sill pan", qty: 1, unit: "ea", unit_cost: 40 }];
    if (o.kind === "opening") return [casing, paint((2 * 2032 + o.width_mm) * 150 * SQFT * 2, "Trim paint")];
    const leaves = o.kind === "double_door" ? 2 : 1;
    const each = inches(o.width_mm / leaves);
    return o.exterior
      ? [{ name: `Exterior door, pre-hung ${each} in`, qty: leaves, unit: "ea", unit_cost: 420 }, { name: "Entry lockset", qty: 1, unit: "set", unit_cost: 85 }, casing, { name: "Door sweep", qty: leaves, unit: "ea", unit_cost: 14 }]
      : [{ name: `Interior door slab ${each} in`, qty: leaves, unit: "ea", unit_cost: 89 }, { name: "Hinges 3½ in", qty: 3 * leaves, unit: "ea", unit_cost: 4.5 }, { name: "Passage handle set", qty: 1, unit: "set", unit_cost: 28 }, casing];
  }
  if (e.kind === "fixture") {
    const f = e.el;
    const own: Suggestion[] = f.product_name ? [{ name: f.product_name, qty: 1, unit: "ea", unit_cost: 0, link: f.product_url ?? null, why: "the product picked for it" }] : [];
    return [...own, ...(FIXTURE[f.kind] ?? [{ name: f.kind === "other" ? "Replacement part" : f.name, qty: 1, unit: "ea" as const, unit_cost: 0 }, { name: "Mounting hardware", qty: 1, unit: "box" as const, unit_cost: 8 }])];
  }
  return [{ name: "Stair tread", qty: 13, unit: "ea", unit_cost: 38 }, { name: "Construction adhesive", qty: 2, unit: "tube", unit_cost: 6 }];
}

/** "2 outlets" → 2 and "outlets"; anything else is qty 1. */
export function parseQty(text: string): { qty: number; name: string } {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(?:x|×)?\s+(.+)$/i);
  return m ? { qty: Number(m[1]), name: m[2] } : { qty: 1, name: text.trim() };
}
