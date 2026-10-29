// Stairs in a hand-drawn plan. A stair is stored as where its foot is (the middle of the bottom step's
// front edge), which way it goes up, its shape and width; everything else comes from the floor-to-floor
// height and the company's standards: how many steps, how high each one is, how deep the treads are,
// how long the run is, and the hole it needs in the floor above so nobody hits their head.
// Straight runs, L stairs (a quarter turn on a landing) and U stairs (a switchback on a landing).
import type { Pt } from "./types";
import type { Sketch, SketchFloor, SketchStair } from "./sketch";
import "./rules"; // registers the house standards read below
import { defineStandards, std } from "./standards";

const IN = 25.4;
defineStandards([
  { key: "stair.width", group: "Stairs", label: "Width of new stairs", value: 36 * IN, unit: "len", help: "Clear width between the walls or guards." },
  { key: "stair.riser", group: "Stairs", label: "Step height new stairs aim for", value: 7.25 * IN, unit: "len", help: "The number of steps is the floor-to-floor height divided by this, rounded up." },
  { key: "stair.tread", group: "Stairs", label: "Tread depth of new stairs", value: 11 * IN, unit: "len", help: "Front to back of each step, not counting the nosing." },
  { key: "stair.floorDepth", group: "Stairs", label: "Floor thickness above the stairs", value: 12 * IN, unit: "len", help: "Joists, subfloor and ceiling. Used for the headroom and the hole in the floor above." },
  { key: "stair.headroom", group: "Stairs", label: "Headroom over stairs", value: 80 * IN, unit: "len", help: "IRC R311.7.2: 6' 8\" minimum, measured straight up from the line of the step noses." },
  { key: "stair.riserMax", group: "Stairs", label: "Tallest step", value: 7.75 * IN, unit: "len", help: "IRC R311.7.5.1: 7¾\" maximum riser height." },
  { key: "stair.treadMin", group: "Stairs", label: "Shallowest tread", value: 10 * IN, unit: "len", help: "IRC R311.7.5.2: 10\" minimum tread depth." },
  { key: "stair.widthMin", group: "Stairs", label: "Narrowest stairs", value: 36 * IN, unit: "len", help: "IRC R311.7.1: 36\" minimum clear width." },
  { key: "stair.landing", group: "Stairs", label: "Landing depth, as a share of the stair width", value: 100, unit: "pct", help: "IRC R311.7.6: a landing at least as deep as the stairs are wide." },
  { key: "stair.guardDrop", group: "Stairs", label: "Drop that needs a guard", value: 30 * IN, unit: "len", help: "IRC R312.1.1: a guard on any open side more than 30\" above the floor below." },
]);

export type StairShape = SketchStair["shape"];
export const STAIR_SHAPES: [StairShape, string][] = [["straight", "Straight"], ["L", "L (quarter turn)"], ["U", "U (switchback)"]];

/** Floor to floor for a floor of the sketch: its own height, or the building's storey height. */
export function floorRise(sk: Pick<Sketch, "storey_height_mm">, f: Pick<SketchFloor, "height_mm">): number {
  // a floor's own height is its ceiling; floor to floor adds the floor framing above it (as planFromSketch)
  const storey = Math.max(2400, Math.min(4500, sk.storey_height_mm ?? std("house.storey")));
  return f.height_mm ? f.height_mm + Math.max(0, storey - std("house.ceiling")) : storey;
}

export interface StairGeom {
  /** risers (rises from floor to floor), each riser's height, tread depth, treads you stand on */
  risers: number; riser: number; tread: number; treads: number; width: number;
  /** treads before and after the landing (all of them in the first flight on a straight stair) */
  flight1: number; flight2: number; landing: number;
  /** the whole outline seen from above */
  footprint: Pt[];
  /** each tread (and the landing) with how high its top is, in climbing order; `landing` marks it */
  steps: { polygon: Pt[]; top: number; landing?: boolean }[];
  /** the walking line, foot to top, for the arrow */
  path: Pt[];
  /** the hole the floor above needs, and the headroom left under the part of that floor that stays */
  hole: Pt[]; headroom: number;
  /** the two long sides of each flight, for the guards check */
  sides: [Pt, Pt][];
  /** length of the run, foot to the top step's back edge, along the first flight */
  run: number;
}

/** Everything about a stair, from its few stored numbers and the floor-to-floor height. */
export function stairGeom(st: SketchStair, rise: number): StairGeom {
  const W = st.width_mm ?? std("stair.width");
  const risers = Math.max(2, st.risers ?? Math.ceil(rise / Math.max(100, std("stair.riser"))));
  const riser = rise / risers, t = st.tread_mm ?? std("stair.tread");
  const treads = risers - 1;
  const turn = st.shape !== "straight";
  // a landing takes the place of one tread
  const inFlights = turn ? Math.max(0, treads - 1) : treads;
  const n1 = turn ? Math.max(0, Math.min(inFlights, st.split ?? Math.floor(inFlights / 2))) : treads, n2 = turn ? inFlights - n1 : 0;
  const Ld = turn ? st.landing_mm ?? W : 0;
  // local frame: f along the first flight (up), a across it; a turn to the left mirrors a
  const th = (st.rotation * Math.PI) / 180, u: Pt = [Math.cos(th), Math.sin(th)], s = st.turn === "left" ? -1 : 1, r: Pt = [-u[1] * s, u[0] * s];
  const P = (a: number, f: number): Pt => [Math.round(st.at[0] + u[0] * f + r[0] * a), Math.round(st.at[1] + u[1] * f + r[1] * a)];
  const rect = (a0: number, a1: number, f0: number, f1: number) => [P(a0, f0), P(a1, f0), P(a1, f1), P(a0, f1)];
  const h = W / 2;
  const steps: StairGeom["steps"] = [];
  for (let i = 0; i < n1; i++) steps.push({ polygon: rect(-h, h, i * t, (i + 1) * t), top: (i + 1) * riser });
  let footprint: Pt[], path: Pt[], sides: [Pt, Pt][];
  const top1 = n1 * t;
  if (st.shape === "L") {
    const b = Math.max(0, top1 + Ld - W);
    steps.push({ polygon: rect(-h, h, top1, top1 + Ld), top: (n1 + 1) * riser, landing: true });
    for (let j = 0; j < n2; j++) steps.push({ polygon: rect(h + j * t, h + (j + 1) * t, b, top1 + Ld), top: (n1 + 2 + j) * riser });
    footprint = [P(-h, 0), P(h, 0), P(h, b), P(h + n2 * t, b), P(h + n2 * t, top1 + Ld), P(-h, top1 + Ld)];
    path = [P(0, 0), P(0, b + W / 2), P(h + n2 * t, b + W / 2)];
    sides = [[P(-h, 0), P(-h, top1 + Ld)], [P(h, 0), P(h, b)], [P(h, b), P(h + n2 * t, b)], [P(h, top1 + Ld), P(h + n2 * t, top1 + Ld)]];
  } else if (st.shape === "U") {
    steps.push({ polygon: rect(-h, 3 * h, top1, top1 + Ld), top: (n1 + 1) * riser, landing: true });
    for (let j = 0; j < n2; j++) steps.push({ polygon: rect(h, 3 * h, top1 - (j + 1) * t, top1 - j * t), top: (n1 + 2 + j) * riser });
    footprint = [P(-h, 0), P(h, 0), P(h, top1 - n2 * t), P(3 * h, top1 - n2 * t), P(3 * h, top1 + Ld), P(-h, top1 + Ld)];
    path = [P(0, 0), P(0, top1 + Ld / 2), P(2 * h, top1 + Ld / 2), P(2 * h, top1 - n2 * t)];
    sides = [[P(-h, 0), P(-h, top1 + Ld)], [P(3 * h, top1 - n2 * t), P(3 * h, top1 + Ld)], [P(h, 0), P(h, top1)]];
  } else {
    footprint = rect(-h, h, 0, treads * t);
    path = [P(0, 0), P(0, treads * t)];
    sides = [[P(-h, 0), P(-h, treads * t)], [P(h, 0), P(h, treads * t)]];
  }
  // the floor above can reach out over the low steps as long as the step under its edge still has the
  // headroom: the edge sits over tread j's nose, which is (j+1) risers up
  const clear = rise - std("stair.floorDepth"), need = std("stair.headroom");
  let j = Math.max(0, Math.floor((clear - need) / riser) - 1);
  j = Math.min(j, turn ? n1 : Math.max(0, treads - 1));
  const headroom = clear - (j + 1) * riser;
  const f0 = j * t;
  const hole = st.shape === "L" ? [P(-h, f0), P(h, f0), P(h, Math.max(f0, Math.max(0, top1 + Ld - W))), ...footprint.slice(3)]
    : st.shape === "U" ? [P(-h, f0), P(h, f0), ...footprint.slice(2)]
    : rect(-h, h, f0, treads * t);
  return { risers, riser, tread: t, treads, width: W, flight1: n1, flight2: n2, landing: Ld, footprint, steps, path, hole, headroom, sides, run: turn ? top1 + Ld : treads * t };
}

/** A new stair at a spot, going up the given way, sized from the standards. */
export const newStair = (at: Pt, rotation: number, shape: StairShape = "straight"): SketchStair => ({ at, rotation, shape, turn: "right" });

/** The stairs of the floor below this one (the floor whose stairs come up through this floor). */
export function floorBelow(sk: Sketch, f: SketchFloor): SketchFloor | null {
  const lower = sk.floors.filter((x) => x !== f && x.level < f.level).sort((a, b) => b.level - a.level)[0];
  return lower && lower.level === f.level - 1 ? lower : null;
}
export function floorAbove(sk: Sketch, f: SketchFloor): SketchFloor | null {
  const upper = sk.floors.filter((x) => x !== f && x.level > f.level).sort((a, b) => a.level - b.level)[0];
  return upper && upper.level === f.level + 1 ? upper : null;
}
