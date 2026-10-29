// Where the plumber is needed: every sink, dishwasher, toilet, tub, shower, washer and fridge on the
// drawing marks a water (and drain) point, so the plumbing trade sees its tags without anyone adding them.
// Found from the fixtures each time, so moving the sink moves the mark.
import type { Pt } from "./types";
import type { SketchFixture, SketchFloor } from "./sketch";

export interface PlumbPoint { i: number; at: Pt; what: string; needs: string }

/** What a fixture needs from the plumber, or null. */
export function plumbingFor(x: SketchFixture): { what: string; needs: string } | null {
  const fam = x.cab?.fam;
  if (x.kind === "kitchen_sink" || fam === "sink") return { what: "Kitchen sink", needs: "Hot and cold water, drain and vent" };
  if (x.kind === "vanity" && (!x.cab || /sink/.test(x.cab.config ?? "vsink"))) return { what: "Vanity sink", needs: "Hot and cold water, drain and vent" };
  if (x.kind === "washbasin") return { what: "Basin", needs: "Hot and cold water, drain and vent" };
  if (x.kind === "dishwasher") return { what: "Dishwasher", needs: "Hot water and drain (to the sink)" };
  if (x.kind === "toilet") return { what: "Toilet", needs: "Cold water, 3\" drain and vent" };
  if (x.kind === "bathtub") return { what: "Tub", needs: "Hot and cold water, drain and vent" };
  if (x.kind === "shower") return { what: "Shower", needs: "Hot and cold water, drain and vent" };
  if (x.kind === "washing_machine") return { what: "Washer", needs: "Hot and cold water and a standpipe drain" };
  if (x.kind === "water_heater") return { what: "Water heater", needs: "Water in and out, relief drain" };
  if (x.kind === "fridge") return { what: "Fridge", needs: "Cold water line for the ice maker" };
  return null;
}

/** Every plumbing point on a floor. */
export function plumbingPoints(f: SketchFloor): PlumbPoint[] {
  return (f.fixtures ?? []).flatMap((x, i) => { const p = plumbingFor(x); return p ? [{ i, at: x.center, ...p }] : []; });
}
