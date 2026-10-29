// Build-mode edits on whole rooms, the way you'd push a room about in a house game: slide a wall and
// what stands against it slides too, drag a room and its furniture comes along, turn a room a quarter
// turn. Doors and windows keep their place sensibly. Works on the sketch (lib/plan/sketch.ts), mm.
import type { Pt } from "./types";
import type { Side, SketchFixture, SketchFloor, SketchRoom } from "./sketch";
import { doorWall, edgesOf, moveWall, pointInPoly, segLen, sideWall, type Seg } from "./sketchEdit";
import { bboxOf } from "./geometry";
import { defineStandards, std } from "./standards";

defineStandards([
  { key: "draw.snapAngle", group: "Drawing", label: "Walls snap to every", value: 45, unit: "deg", help: "Drawing corner by corner, a wall turns in steps of this many degrees (90 for square rooms only)." },
  { key: "draw.wallTouch", group: "Drawing", label: "Furniture moves with a wall within", value: 51, unit: "len", help: "Furniture this close to a wall slides with the wall when the wall is pushed or pulled." },
  { key: "draw.minRoom", group: "Drawing", label: "Smallest room side", value: 610, unit: "len", help: "Pushing a wall stops when a room would get narrower than this." },
]);

const E = 1;
const horiz = (s: Seg) => Math.abs(s[0][1] - s[1][1]) < E;
const vert = (s: Seg) => Math.abs(s[0][0] - s[1][0]) < E;
const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Half its size across x and across y on the plan (width and depth swap when it faces east or west). */
export function halfSize(f: SketchFixture): [number, number] {
  const across = f.facing === "east" || f.facing === "west";
  const w = (across ? f.depth_mm : f.width_mm) ?? 600, d = (across ? f.width_mm : f.depth_mm) ?? 600;
  return [w / 2, d / 2];
}

/** Which room a piece of furniture belongs to: the one it names, else the one its middle stands in. */
export function roomOfFixture(f: SketchFloor, x: SketchFixture): number {
  const named = x.room ? f.rooms.findIndex((r) => same(r.name, x.room)) : -1;
  if (named >= 0) return named;
  return f.rooms.findIndex((r) => pointInPoly(x.center, r.polygon));
}
/** The furniture of room `ri`: what names it, or whose middle is inside it. */
export const fixturesIn = (f: SketchFloor, ri: number) => {
  const r = f.rooms[ri];
  return (f.fixtures ?? []).map((x, i) => ((x.room ? same(x.room, r.name) : false) || pointInPoly(x.center, r.polygon) ? i : -1)).filter((i) => i >= 0);
};

/** Push a piece of furniture back inside its room's outline (the room's box) so it never pokes through a
 *  wall; one bigger than the room is centred in it. */
export function keepInside(x: SketchFixture, poly: Pt[]): SketchFixture {
  const [x0, y0, x1, y1] = bboxOf(poly), [hw, hd] = halfSize(x);
  const fit = (c: number, lo: number, hi: number, h: number) => (hi - lo < 2 * h ? (lo + hi) / 2 : Math.min(hi - h, Math.max(lo + h, c)));
  const c: Pt = [Math.round(fit(x.center[0], x0, x1, hw)), Math.round(fit(x.center[1], y0, y1, hd))];
  return c[0] === x.center[0] && c[1] === x.center[1] ? x : { ...x, center: c };
}

/** How far a wall can really move: no room it drags along gets narrower than the smallest room side. */
function clampBy(rooms: SketchRoom[], s: Seg, by: number): number {
  const h = horiz(s), k = h ? 1 : 0, line = s[0][k], min = std("draw.minRoom");
  const moved = moveWall(rooms, s, by);
  let out = by;
  rooms.forEach((r, i) => {
    if (moved[i] === r) return;
    const others = r.polygon.map((p) => p[k]).filter((v) => Math.abs(v - line) > E);
    if (!others.length) return;
    const below = others.filter((v) => v < line), above = others.filter((v) => v > line);
    // which side of the wall the room lies on: just off the middle of its own edge on that line
    const t = edgesOf(r.polygon).find((e) => (h ? horiz(e) : vert(e)) && Math.abs(e[0][k] - line) < E);
    if (!t) return;
    const m: Pt = [(t[0][0] + t[1][0]) / 2, (t[0][1] + t[1][1]) / 2];
    m[k] -= 30;
    // on the low side the wall may come down only to the room's far side plus the minimum, and so on
    if (pointInPoly(m, r.polygon)) { if (below.length) out = Math.max(out, Math.max(...below) + min - line); }
    else if (above.length) out = Math.min(out, Math.min(...above) - min - line);
  });
  return out;
}

/** Map a point through a wall move: corners on the moved stretch of line slide, the rest stay. */
const mover = (s: Seg, by: number) => {
  const h = horiz(s), k = h ? 1 : 0, line = s[0][k];
  return (p: Pt): Pt => (Math.abs(p[k] - line) < E ? (h ? [p[0], p[1] + by] : [p[0] + by, p[1]]) : p);
};

/** Keep each door and placed window the same distance from the wall end it was nearer to, so a door
 *  by a corner stays by that corner when its wall gets longer or shorter. */
export function keepOpenings(before: SketchFloor, after: SketchFloor, map: (p: Pt) => Pt): SketchFloor {
  const refit = (w0: Seg | null, w1: Seg | null, at: number) => {
    if (!w0 || !w1) return at;
    const L0 = segLen(w0), L1 = segLen(w1);
    if (L0 < 1 || L1 < 1) return at;
    const c = at * L0, near = c < L0 / 2 ? 0 : 1, dd = near === 0 ? c : L0 - c;
    const e = map(w0[near]), end = Math.hypot(w1[0][0] - e[0], w1[0][1] - e[1]) <= Math.hypot(w1[1][0] - e[0], w1[1][1] - e[1]) ? 0 : 1;
    const t = end === 0 ? dd / L1 : 1 - dd / L1;
    return Math.round(Math.max(0, Math.min(1, t)) * 1000) / 1000;
  };
  const doors = (after.doors ?? []).map((d, i) => {
    const d0 = (before.doors ?? [])[i];
    return d0 ? { ...d, at: refit(doorWall(before, d0), doorWall(after, d), d0.at ?? 0.5) } : d;
  });
  const windows = (after.windows ?? []).map((w, i) => {
    const w0 = (before.windows ?? [])[i];
    if (!w0?.at?.length) return w;
    const r0 = before.rooms.findIndex((r) => same(r.name, w0.room)), r1 = after.rooms.findIndex((r) => same(r.name, w.room));
    if (r0 < 0 || r1 < 0) return w;
    const a = sideWall(before, r0, w0.side), b = sideWall(after, r1, w.side);
    return { ...w, at: w0.at.map((t) => refit(a, b, t)) };
  });
  return { ...after, doors, windows };
}

/**
 * Push or pull a straight wall by `by` mm (Sims-style). The rooms on either side follow (moveWall);
 * furniture standing against the wall, on either side, slides with it; anything that no longer fits is
 * pushed back inside its room; doors and windows keep their distance from the nearer corner.
 * Returns the floor and how far the wall really went (it stops before a room gets too small).
 */
export function pushWall(f: SketchFloor, s: Seg, want: number): { floor: SketchFloor; by: number } {
  if (!horiz(s) && !vert(s)) return { floor: f, by: 0 };
  const by = clampBy(f.rooms, s, want);
  const rooms = moveWall(f.rooms, s, by);
  const h = horiz(s), k = h ? 1 : 0, al = h ? 0 : 1, line = s[0][k];
  // the stretch of line that really moved: every moved room edge on it
  let lo = Infinity, hi = -Infinity;
  rooms.forEach((r, i) => {
    if (r === f.rooms[i]) return;
    for (const t of edgesOf(f.rooms[i].polygon)) if ((h ? horiz(t) : vert(t)) && Math.abs(t[0][k] - line) < E) {
      const a = Math.min(t[0][al], t[1][al]), b = Math.max(t[0][al], t[1][al]);
      if (Math.min(b, Math.max(s[0][al], s[1][al])) - Math.max(a, Math.min(s[0][al], s[1][al])) >= 50) { lo = Math.min(lo, a); hi = Math.max(hi, b); }
    }
  });
  const touch = std("draw.wallTouch");
  const next: SketchFloor = { ...f, rooms };
  next.fixtures = (f.fixtures ?? []).map((x) => {
    const half = halfSize(x);
    const near = Math.abs(Math.abs(x.center[k] - line) - half[k]) <= touch && x.center[al] + half[al] > lo && x.center[al] - half[al] < hi;
    let y: SketchFixture = near ? { ...x, center: (h ? [x.center[0], x.center[1] + by] : [x.center[0] + by, x.center[1]]) as Pt } : x;
    const ri = roomOfFixture(f, x);
    if (ri >= 0 && rooms[ri] !== f.rooms[ri]) y = keepInside(y, rooms[ri].polygon);
    return y;
  });
  return { floor: keepOpenings(f, next, mover(s, by)), by };
}

/** Move room `ri` by `d` with its furniture. Doors and windows name the room, so they come along. */
export function moveRoom(f: SketchFloor, ri: number, d: Pt): SketchFloor {
  const mine = new Set(fixturesIn(f, ri));
  const sh = (p: Pt): Pt => [Math.round(p[0] + d[0]), Math.round(p[1] + d[1])];
  return {
    ...f, rooms: f.rooms.map((r, i) => (i === ri ? { ...r, polygon: r.polygon.map(sh) } : r)),
    fixtures: (f.fixtures ?? []).map((x, i) => (mine.has(i) ? { ...x, center: sh(x.center) } : x)),
  };
}

const CW: Record<Side, Side> = { north: "east", east: "south", south: "west", west: "north" };
const CCW: Record<Side, Side> = { north: "west", west: "south", south: "east", east: "north" };
/** A side a quarter turn on: clockwise as seen on the plan, or the other way. */
export const turnSide = (s: Side, cw = true) => (cw ? CW : CCW)[s];

/** Turn room `ri` a quarter turn about its middle, with its furniture, its windows and its outside doors. */
export function turnRoom(f: SketchFloor, ri: number, cw = true): SketchFloor {
  const r = f.rooms[ri], [x0, y0, x1, y1] = bboxOf(r.polygon);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  // y points down the page, so clockwise takes east (1, 0) to south (0, 1)
  const rot = (p: Pt): Pt => { const dx = p[0] - cx, dy = p[1] - cy; return cw ? [Math.round(cx - dy), Math.round(cy + dx)] : [Math.round(cx + dy), Math.round(cy - dx)]; };
  const mine = new Set(fixturesIn(f, ri));
  return {
    ...f,
    rooms: f.rooms.map((q, i) => (i === ri ? { ...q, polygon: q.polygon.map(rot) } : q)),
    fixtures: (f.fixtures ?? []).map((x, i) => {
      if (!mine.has(i)) return x;
      // a thing with no front keeps its width across the page, so swap its sizes to turn it
      return x.facing ? { ...x, center: rot(x.center), facing: turnSide(x.facing, cw) } : { ...x, center: rot(x.center), width_mm: x.depth_mm, depth_mm: x.width_mm };
    }),
    windows: (f.windows ?? []).map((w) => (same(w.room, r.name) ? { ...w, side: turnSide(w.side, cw) } : w)),
    doors: (f.doors ?? []).map((d) => (d.side && same(d.rooms[0], r.name) ? { ...d, side: turnSide(d.side, cw) } : d)),
  };
}

/** The way out of the room from a straight wall (a unit vector), for the push and pull arrows. */
export function outward(poly: Pt[], s: Seg): Pt {
  const dx = s[1][0] - s[0][0], dy = s[1][1] - s[0][1], L = Math.hypot(dx, dy) || 1;
  const n: Pt = [-dy / L, dx / L], mid: Pt = [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2];
  return pointInPoly([mid[0] + n[0] * 30, mid[1] + n[1] * 30], poly) ? [-n[0], -n[1]] : n;
}
