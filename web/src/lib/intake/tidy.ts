// What the plan reader hands back, tidied before it becomes the plan. A reader measuring off a picture
// puts two rooms that share a wall a hand's width apart (a gap, or a sliver of overlap), and it can size
// a thing to the space it's in (one car stretched across a three-car garage). Both are fixed here.
import type { Sketch, SketchFixture, SketchFloor } from "@/lib/plan/sketch";
import { CATALOG } from "@/lib/plan/catalog";

/** walls closer than this are the same wall */
const SAME_WALL = 250;

/** Lines up every corner's x (and y) with the other corners within SAME_WALL of it, so rooms that were drawn touching touch. */
export function snapCorners(f: SketchFloor): SketchFloor {
  const fix = (vals: number[]) => {
    const sorted = [...new Set(vals)].sort((a, b) => a - b);
    const to = new Map<number, number>();
    let group: number[] = [];
    const flush = () => {
      // the middle one of the group, weighted by how many corners sit on each value
      const all = group.flatMap((v) => vals.filter((x) => x === v));
      const mid = all[Math.floor(all.length / 2)];
      for (const v of group) to.set(v, mid);
      group = [];
    };
    for (const v of sorted) {
      if (group.length && v - group[0] > SAME_WALL) flush();
      group.push(v);
    }
    if (group.length) flush();
    return to;
  };
  const pts = f.rooms.flatMap((r) => r.polygon);
  const xs = fix(pts.map((p) => p[0])), ys = fix(pts.map((p) => p[1]));
  return {
    ...f,
    rooms: f.rooms.map((r) => ({
      ...r,
      // corners that land on each other after the snap are one corner
      polygon: r.polygon.map((p) => [xs.get(p[0]) ?? p[0], ys.get(p[1]) ?? p[1]] as [number, number])
        .filter((p, i, a) => { const q = a[(i + a.length - 1) % a.length]; return a.length < 2 || p[0] !== q[0] || p[1] !== q[1]; }),
    })).filter((r) => r.polygon.length >= 3),
  };
}

// things that only come in one size: a size far off it was the room's size, not the thing's
const FIXED = new Set(["car", "toilet", "washbasin", "bathtub", "bed", "fridge", "range", "dishwasher", "washing_machine", "dryer", "sofa", "armchair", "nightstand", "fireplace", "piano", "motorcycle", "bicycle"]);

/** A thing at its real size; a car stretched over several bays becomes one car per bay. */
export function realSize(o: SketchFixture): SketchFixture[] {
  const spec = CATALOG[o.kind];
  if (!spec || !FIXED.has(o.kind)) return [o];
  const w = o.width_mm ?? spec.w, d = o.depth_mm ?? spec.d;
  if (o.kind === "car" && w > spec.w * 1.6) {
    // side by side, along the car's width: across the page when it faces north or south
    const n = Math.max(1, Math.round(w / 3000)), across = o.facing === "east" || o.facing === "west" ? 1 : 0, step = w / n;
    return Array.from({ length: n }, (_, i) => {
      const c: [number, number] = [o.center[0], o.center[1]];
      c[across] += -w / 2 + step * (i + 0.5);
      return { ...o, center: c, width_mm: spec.w, depth_mm: spec.d, name: n > 1 ? `Car ${i + 1}` : o.name };
    });
  }
  if (w > spec.w * 1.8 || d > spec.d * 1.8) { const { width_mm: _w, depth_mm: _d, ...rest } = o; void _w; void _d; return [rest]; }
  return [o];
}

export function tidySketch(sk: Sketch): Sketch {
  return { ...sk, floors: sk.floors.map((f) => ({ ...snapCorners(f), fixtures: f.fixtures?.flatMap(realSize) })) };
}
