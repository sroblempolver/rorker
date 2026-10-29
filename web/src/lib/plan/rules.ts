// House rules: the code-normal sizes a house is built to. A drawing rarely says how high a window sill is
// or how far the eaves stick out, so whatever it leaves out is filled in from here, and the 3D, the
// elevations and the plan reader's self-check all build from the same numbers. US residential sizes,
// kept in whole inches and stored as millimetres (`inch(80)` is an 80" door head).
// Mirror of agent/rorker_agent/rules.py.
import type { Floor, Opening, Plan, RoomType } from "./types";

export type RoofKind = "hip" | "gable" | "flat";

const inch = (n: number) => n * 25.4;

export const RULES = {
  /** floor to floor 10' 1", finished floor to ceiling 9' (8' is the other common one), floor framing 8" */
  storey: inch(121), ceiling: inch(108), slab: inch(8),
  /** 2x6 outside walls with sheathing, siding and drywall about 7"; 2x4 inside walls with drywall 4½" */
  wallExterior: inch(7), wallInterior: inch(4.5),
  /** windows: 36" sill and 80" head, lined up with the doors; bathrooms 48" (privacy), kitchens 42" (over the counter) */
  sill: inch(36), sillWet: inch(48), sillKitchen: inch(42), head: inch(80),
  /** doors: interior and entry 6' 8", garage 7', a cased opening 7' */
  doorHead: inch(80), garageHead: inch(84), openingHead: inch(84),
  /** pitched roofs: main roof 6/12, low roofs over a garage or porch 4/12, eaves 18" out, 8" fascia */
  pitch: 26.6, lowPitch: 18.4, eave: inch(18), fascia: inch(8), flatOverhang: inch(6),
  /** the ground floor sits on a foundation 18" above the grade; steps 7½" up and 11" deep */
  plinth: inch(18), step: inch(7.5), tread: inch(11),
  /** guards on balconies and porches more than 30" up: 36" (IRC) */
  railing: inch(36),
  /** paths and drives: a 4' walk */
  walk: inch(48),
} as const;

/** Framing: 2x4 studs (38 x 89 mm) at 16" (406 mm) centres, one plate below and two above, 2x10 headers
 *  over doors and windows, a sill under each window; outside walls in 2x6 (140 mm). Drawn in the Framing build stage. */
export const FRAMING = { stud: 38, depth: 89, depthExt: 140, spacing: 406, plate: 38, header: 235, wood: "#c9a36a", plateWood: "#b08a55" } as const;

/** Colours for each part of the outside: siding, trim, roof and so on. */
export const FINISH = {
  siding: "#d8d0c0", trim: "#f2eee6", roof: "#3d3f43", fascia: "#efebe3", gutter: "#e9e5dd",
  foundation: "#77746d", frame: "#2e2c29", glass: "#30424c", frontDoor: "#6e3524", door: "#8a6a48",
  garageDoor: "#e6e1d7", deck: "#7d6046", paving: "#8c8981", lawn: "#3d4a33", soffit: "#e4ded3", rail: "#2b2a28",
} as const;

export interface BuildingRules {
  storey: number;
  roof: RoofKind;
  /** true when the drawing didn't say and the roof is the rule's guess */
  roofGuessed: boolean;
  pitch: number;
  eave: number;
  plinth: number;
}

/** The rules for this building: what the plan says, code-normal defaults for the rest. */
export function buildingRules(plan: Plan): BuildingRules {
  const ex = plan.building.exterior;
  const known = ex.roof === "hip" || ex.roof === "gable" || ex.roof === "flat";
  return {
    storey: ex.storey_height_mm || RULES.storey,
    roof: known ? (ex.roof as RoofKind) : "hip",
    roofGuessed: !known,
    pitch: ex.roof_pitch_deg ?? RULES.pitch,
    eave: ex.eave_mm ?? RULES.eave,
    plinth: ex.plinth_mm ?? RULES.plinth,
  };
}

const WET = new Set<RoomType>(["bathroom", "wc", "laundry"]);

/** Bottom and top of a door or window above its floor: the drawing's own numbers when it has them. */
export function openingSpan(o: Opening, floor: Floor | null): [number, number] {
  const [bot, top] = ruleSpan(o, floor);
  const b = o.sill_mm ?? bot;
  return [b, o.height_mm ? b + o.height_mm : Math.max(b + 300, top)];
}
function ruleSpan(o: Opening, floor: Floor | null): [number, number] {
  if (o.kind === "window") {
    const types = floor ? o.room_ids.map((id) => floor.rooms.find((r) => r.id === id)?.type) : [];
    const sill = types.some((t) => t && WET.has(t)) ? RULES.sillWet : types.includes("kitchen") ? RULES.sillKitchen : RULES.sill;
    return [sill, RULES.head];
  }
  if (o.kind === "garage_door") return [0, RULES.garageHead];
  if (o.kind === "opening") return [0, RULES.openingHead];
  return [0, RULES.doorHead];
}
