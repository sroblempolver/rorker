// The outside of the building worked out from the plan and the house rules: which roof goes where,
// which bits are porches and balconies, what the posts on them hold up, where the steps go. Pure data;
// the 3D draws it (components/plan/exterior3d.ts).
import { bboxOf, labelPoint, pointInPoly, siteLayout, type Site } from "./geometry";
import { buildingRules, RULES, type BuildingRules } from "./rules";
import type { BBox, Floor, Opening, Plan, Pt } from "./types";

export type Side = "x0" | "y0" | "x1" | "y1";

/** One roof over a rectangle of the building. `high` is the side a lean-to roof rises toward. */
export interface RoofPart {
  rect: BBox; kind: "hip" | "gable" | "shed" | "flat"; high: Side | null; pitch: number;
  floorIndex: number; floorId: string; /** top of the walls it sits on, mm above grade level 0 */ eaveY: number; main: boolean;
}

/** A porch (ground floor, on a platform) or a balcony (upper floor, on a slab) beside the house. */
export interface Zone {
  floorIndex: number; floorId: string; rect: BBox; house: Side | null; kind: "porch" | "balcony";
  /** what's over it: the balcony of the floor above, its own canopy on the posts, or open sky */
  cover: "balcony" | "canopy" | null;
}

/** A wall the reader found with no room on either side, on a porch or balcony. */
export interface WallRole { kind: "column" | "post" | "edge"; height: number }

export interface Exterior {
  rules: BuildingRules;
  roofs: RoofPart[];
  zones: Zone[];
  walls: Map<string, WallRole>;
  /** porch fronts the reader saw as openings: open air, no header or glass */
  gaps: Set<string>;
  entry: Opening | null;
  site: Site;
  /** stoops outside doors that open straight onto the grade */
  stoops: { door: Opening; out: Pt; width: number }[];
  /** each floor's footprint pieces that hold rooms, bottom floor first */
  rings: Pt[][][];
  base: (fi: number) => number;
  height: (fi: number) => number;
}

const SNAP = 150;
const ringOf = (f: Floor): Pt[][] => (f.footprint.length ? f.footprint : [[[f.bounds[0], f.bounds[1]], [f.bounds[2], f.bounds[1]], [f.bounds[2], f.bounds[3]], [f.bounds[0], f.bounds[3]]]]);

/** The footprint rings with rooms inside them (the house itself, not its porches). */
function indoorRings(f: Floor): Pt[][] {
  const pts = f.rooms.filter((r) => !r.outdoor).map((r) => labelPoint(r.polygon));
  return ringOf(f).filter((ring) => pts.some((p) => pointInPoly(p, ring)));
}

/** Coordinates within SNAP of each other become one, so a 68 mm drawing misalignment between floors
 *  doesn't turn into a sliver of roof. */
function snapAxis(vals: number[]): number[] {
  const s = [...new Set(vals.map((v) => Math.round(v)))].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of s) if (!out.length || v - out[out.length - 1] > SNAP) out.push(v);
  return out;
}

/** A gap narrower than this between parts of the house (the wall between rooms drawn apart, a sliver
 *  the reader left) is roofed over, so the roof is one piece over the outside of the house. */
const GAP = 900;

/** One roof over the house however many walls are inside it: empty cells closed in by the house (a hole
 *  between rooms) and narrow strips between two parts of it are roofed too. Changes `cell` in place. */
function closeGaps(cell: number[][], xs: number[], ys: number[]) {
  const nx = cell.length, ny = cell[0]?.length ?? 0;
  if (!nx || !ny) return;
  const on = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < ny && cell[i][j] !== 0;
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      if (cell[i][j] !== 0) continue;
      // the run of empty cells this one is in, across and down: bridged when short and walled at both ends
      let a = i, b = i;
      while (a > 0 && cell[a - 1][j] === 0) a--;
      while (b < nx - 1 && cell[b + 1][j] === 0) b++;
      const across = on(a - 1, j) && on(b + 1, j) && xs[b + 1] - xs[a] <= GAP;
      let c = j, d = j;
      while (c > 0 && cell[i][c - 1] === 0) c--;
      while (d < ny - 1 && cell[i][d + 1] === 0) d++;
      const down = on(i, c - 1) && on(i, d + 1) && ys[d + 1] - ys[c] <= GAP;
      if (across || down) { cell[i][j] = 1; changed = true; }
    }
  }
  // empty cells the outside can't reach are inside the house
  const out = cell.map((col) => col.map(() => false));
  const stack: [number, number][] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if ((i === 0 || j === 0 || i === nx - 1 || j === ny - 1) && cell[i][j] === 0) { out[i][j] = true; stack.push([i, j]); }
  while (stack.length) {
    const [i, j] = stack.pop()!;
    for (const [u, v] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) if (u >= 0 && v >= 0 && u < nx && v < ny && !out[u][v] && cell[u][v] === 0) { out[u][v] = true; stack.push([u, v]); }
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (cell[i][j] === 0 && !out[i][j]) cell[i][j] = 1;
}

/** Splits what a floor needs roofed (its rooms minus whatever the floors above cover) into rectangles,
 *  biggest first. Returns the grid too, so the roofs can tell what they lean against. */
function roofRects(own: Pt[][], above: Pt[][]) {
  const xs = snapAxis([...own, ...above].flat().map((p) => p[0]));
  const ys = snapAxis([...own, ...above].flat().map((p) => p[1]));
  const nx = xs.length - 1, ny = ys.length - 1;
  // 0 outside, 1 to roof, 2 covered by a floor above
  const cell: number[][] = [];
  for (let i = 0; i < nx; i++) {
    cell.push([]);
    for (let j = 0; j < ny; j++) {
      const c: Pt = [(xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2];
      cell[i].push(above.some((r) => pointInPoly(c, r)) ? 2 : own.some((r) => pointInPoly(c, r)) ? 1 : 0);
    }
  }
  closeGaps(cell, xs, ys);
  const owner: number[][] = cell.map((col) => col.map(() => -1));
  const rects: { i0: number; j0: number; i1: number; j1: number }[] = [];
  for (;;) {
    let best: { i0: number; j0: number; i1: number; j1: number; a: number } | null = null;
    for (let i0 = 0; i0 < nx; i0++) for (let j0 = 0; j0 < ny; j0++) {
      if (cell[i0][j0] !== 1 || owner[i0][j0] >= 0) continue;
      let jMax = ny - 1;
      for (let i1 = i0; i1 < nx; i1++) {
        let j = j0;
        while (j <= jMax && cell[i1][j] === 1 && owner[i1][j] < 0) j++;
        jMax = j - 1;
        if (jMax < j0) break;
        const a = (xs[i1 + 1] - xs[i0]) * (ys[jMax + 1] - ys[j0]);
        if (!best || a > best.a) best = { i0, j0, i1, j1: jMax, a };
      }
    }
    if (!best) break;
    for (let i = best.i0; i <= best.i1; i++) for (let j = best.j0; j <= best.j1; j++) owner[i][j] = rects.length;
    rects.push(best);
  }
  return { xs, ys, cell, owner, rects };
}

export function planExterior(plan: Plan): Exterior {
  const rules = buildingRules(plan);
  const floors = [...plan.floors].sort((a, b) => a.level - b.level);
  const base = (fi: number) => floors[fi]?.elevation_mm || fi * rules.storey;
  const height = (fi: number) => floors[fi]?.height_mm || RULES.ceiling;
  const rings = floors.map(indoorRings);

  // ---- roofs: each floor's rooms that nothing above covers, top floor first
  const roofs: RoofPart[] = [];
  for (let fi = floors.length - 1; fi >= 0; fi--) {
    if (!rings[fi].length) continue;
    const { xs, ys, cell, owner, rects } = roofRects(rings[fi], rings.slice(fi + 1).flat());
    const placed: number[] = [];
    rects.forEach((r, k) => {
      const rect: BBox = [xs[r.i0], ys[r.j0], xs[r.i1 + 1], ys[r.j1 + 1]];
      const w = rect[2] - rect[0], d = rect[3] - rect[1];
      if (Math.min(w, d) < 600) return;
      // how much of each side runs along a taller part of the house, or a roof already placed
      const touch = (s: Side, what: (i: number, j: number) => boolean) => {
        let n = 0;
        if (s === "x0" || s === "x1") { const i = s === "x0" ? r.i0 - 1 : r.i1 + 1; if (i >= 0 && i < xs.length - 1) for (let j = r.j0; j <= r.j1; j++) if (what(i, j)) n += ys[j + 1] - ys[j]; }
        else { const j = s === "y0" ? r.j0 - 1 : r.j1 + 1; if (j >= 0 && j < ys.length - 1) for (let i = r.i0; i <= r.i1; i++) if (what(i, j)) n += xs[i + 1] - xs[i]; }
        return n;
      };
      const sides: Side[] = ["x0", "y0", "x1", "y1"];
      const tall = sides.map((s) => [s, touch(s, (i, j) => cell[i][j] === 2)] as const).sort((a, b) => b[1] - a[1])[0];
      const sib = sides.map((s) => [s, touch(s, (i, j) => placed.includes(owner[i][j]))] as const).sort((a, b) => b[1] - a[1])[0];
      const top = fi === floors.length - 1;
      const eaveY = base(fi) + height(fi);
      let kind: RoofPart["kind"] = rules.roof, high: Side | null = null, pitch = top && !roofs.length ? rules.pitch : rules.lowPitch;
      if (rules.roof === "flat") kind = "flat";
      else if (tall[1] > 600) { kind = "shed"; high = tall[0]; }
      // a shed roof on its own rises toward the back (north), across the short way
      else if (kind === "shed") high = w >= d ? "y0" : "x0";
      // a bump-out on the same floor gets its own small roof at the main roof's pitch, tucked into it
      else if (sib[1] > 600) pitch = roofs.find((q) => q.floorIndex === fi)?.pitch ?? pitch;
      // a lean-to against the floor above stays under that floor's windows
      if (kind === "shed") {
        const run = high === "x0" || high === "x1" ? w : d;
        const room = fi < floors.length - 1 ? height(fi + 1) * 0.3 : Infinity;
        pitch = Math.min(pitch, (Math.atan(room / run) * 180) / Math.PI);
      }
      roofs.push({ rect, kind, high, pitch, floorIndex: fi, floorId: floors[fi].id, eaveY, main: !roofs.length });
      placed.push(k);
    });
  }

  // ---- porches and balconies: footprint pieces with no rooms in them, and the walls standing on their own
  const zones: Zone[] = [];
  const walls = new Map<string, WallRole>();
  const gaps = new Set<string>();
  floors.forEach((f, fi) => {
    if (!rings[fi].length) return;
    const items: { ids: string[]; box: BBox }[] = [];
    for (const ring of ringOf(f)) if (!rings[fi].includes(ring)) items.push({ ids: [], box: bboxOf(ring) });
    for (const w of f.walls) if (!w.room_ids.length && !w.free) items.push({ ids: [w.id], box: bboxOf(w.polygon) });
    // pieces close together are one porch
    const groups: { ids: string[]; box: BBox }[] = [];
    for (const it of items) {
      const near = groups.find((g) => it.box[0] < g.box[2] + 1500 && it.box[2] > g.box[0] - 1500 && it.box[1] < g.box[3] + 1500 && it.box[3] > g.box[1] - 1500);
      if (near) { near.ids.push(...it.ids); near.box = [Math.min(near.box[0], it.box[0]), Math.min(near.box[1], it.box[1]), Math.max(near.box[2], it.box[2]), Math.max(near.box[3], it.box[3])]; }
      else groups.push({ ids: [...it.ids], box: [...it.box] as BBox });
    }
    const house = rings[fi].map(bboxOf).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
    for (const g of groups) {
      const b = g.box;
      const tol = 300;
      // reach back to the house wall it stands against
      let rect: BBox = b, side: Side | null = null;
      if (b[1] >= house[3] - tol) { rect = [b[0], house[3], b[2], b[3]]; side = "y0"; }
      else if (b[3] <= house[1] + tol) { rect = [b[0], b[1], b[2], house[1]]; side = "y1"; }
      else if (b[0] >= house[2] - tol) { rect = [house[2], b[1], b[2], b[3]]; side = "x0"; }
      else if (b[2] <= house[0] + tol) { rect = [b[0], b[1], house[0], b[3]]; side = "x1"; }
      else continue; // inside the house's outline: not a porch
      zones.push({ floorIndex: fi, floorId: f.id, rect, house: side, kind: fi === 0 ? "porch" : "balcony", cover: null });
      for (const o of f.openings) {
        const m: Pt = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
        if (!o.room_ids.length && m[0] >= rect[0] - 50 && m[0] <= rect[2] + 50 && m[1] >= rect[1] - 50 && m[1] <= rect[3] + 50) gaps.add(o.id);
      }
    }
  });
  const overlap = (a: BBox, b: BBox) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  for (const z of zones) {
    const f = floors[z.floorIndex];
    const own = f.walls.filter((w) => !w.room_ids.length && !w.free && overlap(bboxOf(w.polygon), z.rect) > 0);
    const columns = own.filter((w) => { const b = bboxOf(w.polygon); return Math.max(b[2] - b[0], b[3] - b[1]) <= 600 && Math.min(b[2] - b[0], b[3] - b[1]) > 200; });
    const upper = zones.find((u) => u.floorIndex === z.floorIndex + 1 && overlap(u.rect, z.rect) > 0.3 * Math.min((z.rect[2] - z.rect[0]) * (z.rect[3] - z.rect[1]), (u.rect[2] - u.rect[0]) * (u.rect[3] - u.rect[1])));
    z.cover = upper ? "balcony" : columns.length ? "canopy" : null;
    const H = height(z.floorIndex);
    for (const w of own) {
      const b = bboxOf(w.polygon);
      const big = Math.max(b[2] - b[0], b[3] - b[1]), thin = Math.min(b[2] - b[0], b[3] - b[1]);
      // a column stops under what it holds up: the canopy, or the balcony slab of the floor above
      if (big <= 600 && thin > 200) walls.set(w.id, { kind: "column", height: z.cover ? H - 250 : RULES.railing });
      else if (big <= 600) walls.set(w.id, { kind: "post", height: RULES.railing });
      else walls.set(w.id, { kind: "edge", height: z.kind === "porch" ? 0 : RULES.railing });
    }
  }

  // ---- the way in, and steps down to the grade from every other outside door
  const g = floors[0];
  const site = siteLayout(plan);
  const entryRooms = new Set(["foyer", "hallway", "stair_hall"]);
  const entry = g?.openings
    .filter((o) => o.exterior && ["door", "double_door"].includes(o.kind) && o.room_ids.some((id) => entryRooms.has(g.rooms.find((r) => r.id === id)?.type ?? "")))
    .sort((p, q) => q.width_mm - p.width_mm)[0] ?? null;
  const stoops: Exterior["stoops"] = [];
  for (const o of g?.openings ?? []) {
    if (!o.exterior || !["door", "double_door", "sliding_door"].includes(o.kind)) continue;
    const m: Pt = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
    if (zones.some((z) => z.floorIndex === 0 && m[0] >= z.rect[0] - 400 && m[0] <= z.rect[2] + 400 && m[1] >= z.rect[1] - 400 && m[1] <= z.rect[3] + 400)) continue;
    stoops.push({ door: o, out: outward(g, o), width: o.width_mm + 600 });
  }
  return { rules, roofs, zones, walls, gaps, entry, site, stoops, rings, base, height };
}

/** The unit vector from a door or window out of the building (away from its rooms). */
export function outward(f: Floor, o: Opening): Pt {
  const dx = o.b[0] - o.a[0], dy = o.b[1] - o.a[1], L = Math.hypot(dx, dy) || 1;
  let n: Pt = [-dy / L, dx / L];
  const m: Pt = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
  const probe: Pt = [m[0] + n[0] * (o.thickness_mm / 2 + 250), m[1] + n[1] * (o.thickness_mm / 2 + 250)];
  if (f.rooms.some((r) => !r.outdoor && pointInPoly(probe, r.polygon))) n = [-n[0], -n[1]];
  return n;
}
