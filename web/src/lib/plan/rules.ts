// House rules: the code-normal sizes a house is built to. A drawing rarely says how high a window sill is
// or how far the eaves stick out, so whatever it leaves out is filled in from here, and the 3D, the
// elevations and the plan reader's self-check all build from the same numbers. Millimetres throughout.
// Mirror of agent/rorker_agent/rules.py.
import type { Floor, Opening, Plan, RoomType } from "./types";

export type RoofKind = "hip" | "gable" | "flat";

export const RULES = {
  /** floor to floor, and finished floor to ceiling */
  storey: 3000, ceiling: 2700, slab: 200,
  wallExterior: 300, wallInterior: 120,
  /** windows: sill and head above the floor; wet rooms and kitchens sit higher (privacy, counters) */
  sill: 900, sillWet: 1200, sillKitchen: 1050, head: 2100,
  /** doors: interior and entry 2100 (6'10"), garage 2300, a cased opening 2400 */
  doorHead: 2100, garageHead: 2300, openingHead: 2400,
  /** pitched roofs: main roof 6/12, low roofs over a garage or porch 4/12, eaves 450 out, fascia 200 */
  pitch: 26.6, lowPitch: 18.4, eave: 450, fascia: 200, flatOverhang: 150,
  /** the ground floor sits on a foundation this far above the grade */
  plinth: 450, step: 225, tread: 300,
  /** guards on balconies and porches more than a step up */
  railing: 1000,
  /** paths and drives */
  walk: 1200,
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
  if (o.kind === "window") {
    const types = floor ? o.room_ids.map((id) => floor.rooms.find((r) => r.id === id)?.type) : [];
    const sill = types.some((t) => t && WET.has(t)) ? RULES.sillWet : types.includes("kitchen") ? RULES.sillKitchen : RULES.sill;
    return [sill, RULES.head];
  }
  if (o.kind === "garage_door") return [0, RULES.garageHead];
  if (o.kind === "opening") return [0, RULES.openingHead];
  return [0, RULES.doorHead];
}
