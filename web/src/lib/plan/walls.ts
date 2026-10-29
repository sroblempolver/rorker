// Walls as pieces, the way a house game builds: every line drawn is a wall of its own, walls snap end to
// end (an L) or end to middle (a T), and wherever they close a loop there is a room. A room drawn as a
// shape keeps tracing its own walls (push and pull work on it) until its walls are separated; then its
// outline follows the wall pieces, and if the loop opens the room's floor goes until it is closed again.
// Works on the sketch (lib/plan/sketch.ts), mm. Only types come from sketch.ts, so it can import this.
import type { Pt, Wall } from "./types";
import type { SketchFloor, SketchRoom, SketchWall } from "./sketch";
import { centroid, edgeDistance, pointInPoly, polyArea } from "./geometry";
import { defineStandards, std } from "./standards";

defineStandards([
  { key: "wall.interior", group: "Walls", label: "Inside wall thickness", value: 4.5 * 25.4, unit: "len", help: "2x4 studs (3½\") with ½\" drywall both sides: 4½\" finished." },
  { key: "wall.exterior", group: "Walls", label: "Outside wall thickness", value: 6.5 * 25.4, unit: "len", help: "2x6 studs (5½\") with sheathing outside and drywall inside: about 6½\" before siding." },
  { key: "wall.halfHeight", group: "Walls", label: "Half wall height", value: 42 * 25.4, unit: "len", help: "A pony wall or kitchen knee wall: 3' 6\" is usual (counter height plus a cap)." },
]);

type Seg = [Pt, Pt];
const E = 2; // mm: ends closer than this are joined
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rnd = (p: Pt): Pt => [Math.round(p[0]), Math.round(p[1])];
export const wallLen = (w: { a: Pt; b: Pt }) => dist(w.a, w.b);
const edges = (p: Pt[]): Seg[] => p.map((a, i) => [a, p[(i + 1) % p.length]] as Seg);

/** Distance from p to a segment, and how far along (0 to 1) the nearest point is. */
export function onWall(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  const q: Pt = [a[0] + dx * t, a[1] + dy * t];
  return { d: dist(p, q), t, q };
}

/** A wall's thickness: its own, else outside or inside by what lies either side of it. */
export function wallThickness(w: SketchWall, outside = false) { return w.thickness_mm ?? std(outside ? "wall.exterior" : "wall.interior"); }
/** A wall's height: its own, a half wall's standard height, or up to the ceiling. */
export function wallHeight(w: SketchWall, ceiling: number) { return w.height_mm ?? (w.half ? std("wall.halfHeight") : ceiling); }

/** Whether a wall has a room on one side only, or none (a lone wall, most often the start of the outside
 *  of a house): an outside wall. The plan (freeWallsToPlan) asks the same, so 2D and 3D agree. */
export function isOutside(rooms: { polygon: Pt[] }[], w: { a: Pt; b: Pt }) {
  const L = wallLen(w) || 1, n: Pt = [-(w.b[1] - w.a[1]) / L, (w.b[0] - w.a[0]) / L], m: Pt = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
  const side = (k: number) => rooms.some((r) => pointInPoly([m[0] + n[0] * 60 * k, m[1] + n[1] * 60 * k], r.polygon));
  return !(side(1) && side(-1));
}

/** The walls a room drawn as a shape makes, each edge once at the thickness the plan gives it, so a box
 *  room shows the same walls on the drawing as one drawn wall by wall. */
export function roomWalls(rooms: SketchRoom[]): { a: Pt; b: Pt; t: number }[] {
  const out: { a: Pt; b: Pt; t: number }[] = [];
  for (const r of rooms) {
    if (r.loose) continue;
    for (const [a, b] of edges(r.polygon)) {
      if (dist(a, b) < 5 || out.some((o) => (dist(o.a, a) < E && dist(o.b, b) < E) || (dist(o.a, b) < E && dist(o.b, a) < E))) continue;
      out.push({ a, b, t: std(isOutside(rooms, { a, b }) ? "wall.exterior" : "wall.interior") });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------- loops

/** A point surely inside a polygon (its middle when that is inside, else the middle of a crossing). */
export function insidePoint(poly: Pt[]): Pt {
  const c = centroid(poly);
  if (pointInPoly(c, poly)) return c;
  const ys = poly.map((p) => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  for (const k of [0.5, 0.3, 0.7, 0.15, 0.85]) {
    const y = y0 + (y1 - y0) * k, xs: number[] = [];
    for (const [a, b] of edges(poly)) if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    xs.sort((u, v) => u - v);
    if (xs.length >= 2) return [(xs[0] + xs[1]) / 2, y];
  }
  return c;
}

/** Signed area (shoelace on the raw numbers): which way round a ring goes. */
const signed = (p: Pt[]) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return a / 2; };

/** No repeated corners and no corner in the middle of a straight run. */
function tidy(poly: Pt[]): Pt[] {
  let out = poly.filter((q, i, a) => dist(q, a[(i + 1) % a.length]) > 1);
  for (let changed = true; changed && out.length > 3;) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / (dist(a, c) || 1) < 3) { out = out.filter((_, j) => j !== i); changed = true; break; }
    }
  }
  return out;
}

/**
 * The closed loops a set of wall lines makes (the faces of the drawing), each with whether a free wall
 * piece is part of it. Lines are cut where they cross or where one ends on another, ends that stick out
 * are left off, and the outside of everything is not a loop.
 */
export function loopsOf(lines: { s: Seg; free: boolean }[]): { poly: Pt[]; free: boolean }[] {
  // the corners: every end, and every crossing
  const pts: Pt[] = [];
  const vid = (p: Pt) => { const i = pts.findIndex((q) => dist(p, q) < 3); if (i >= 0) return i; pts.push(rnd(p)); return pts.length - 1; };
  const cuts = lines.map(() => [0, 1] as number[]);
  for (let i = 0; i < lines.length; i++) for (let j = 0; j < lines.length; j++) {
    if (i === j) continue;
    const [a, b] = lines[i].s, [c, d] = lines[j].s;
    // an end of j on i
    for (const p of [c, d]) { const h = onWall(p, a, b); if (h.d < 3 && h.t > 0.0005 && h.t < 0.9995) cuts[i].push(h.t); }
    // a true crossing
    const r: Pt = [b[0] - a[0], b[1] - a[1]], s: Pt = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-9) continue;
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    if (t > 0.0005 && t < 0.9995 && u > -0.0005 && u < 1.0005) cuts[i].push(t);
  }
  const adj = new Map<number, Set<number>>(), freeEdge = new Set<string>();
  const ek = (u: number, v: number) => (u < v ? `${u}-${v}` : `${v}-${u}`);
  lines.forEach((l, i) => {
    const ts = [...new Set(cuts[i].map((t) => Math.round(t * 1e5) / 1e5))].sort((x, y) => x - y);
    const ids = ts.map((t) => vid([l.s[0][0] + (l.s[1][0] - l.s[0][0]) * t, l.s[0][1] + (l.s[1][1] - l.s[0][1]) * t]));
    for (let k = 0; k < ids.length - 1; k++) {
      const [u, v] = [ids[k], ids[k + 1]];
      if (u === v) continue;
      if (!adj.has(u)) adj.set(u, new Set());
      if (!adj.has(v)) adj.set(v, new Set());
      adj.get(u)!.add(v); adj.get(v)!.add(u);
      if (l.free) freeEdge.add(ek(u, v));
    }
  });
  // ends sticking out can't be part of a loop
  for (let changed = true; changed;) {
    changed = false;
    for (const [u, set] of adj) if (set.size < 2) { for (const v of set) adj.get(v)?.delete(u); adj.delete(u); changed = true; }
  }
  const ang = (u: number, v: number) => Math.atan2(pts[v][1] - pts[u][1], pts[v][0] - pts[u][0]);
  const order = new Map<number, number[]>();
  for (const [u, set] of adj) order.set(u, [...set].sort((x, y) => ang(u, x) - ang(u, y)));
  const seen = new Set<string>(), out: { poly: Pt[]; free: boolean }[] = [];
  for (const [u0, list] of order) for (const v0 of list) {
    if (seen.has(`${u0}>${v0}`)) continue;
    const ring: number[] = [];
    let [u, v] = [u0, v0], free = false;
    for (let guard = 0; guard < 4000 && !seen.has(`${u}>${v}`); guard++) {
      seen.add(`${u}>${v}`);
      ring.push(u);
      if (freeEdge.has(ek(u, v))) free = true;
      const around = order.get(v)!, k = around.indexOf(u);
      const w = around[(k - 1 + around.length) % around.length];
      [u, v] = [v, w];
    }
    const poly = ring.map((i) => pts[i]);
    if (poly.length >= 3 && signed(poly) > 0) out.push({ poly: tidy(poly), free });
  }
  return out;
}

/** Whether a wall piece lies along a room's outline (both ends and its middle on the edge). */
export function onOutline(w: SketchWall, poly: Pt[]) {
  const m: Pt = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
  return [w.a, w.b, m].every((p) => edgeDistance(p, poly) < 5);
}

/**
 * After the walls change: each room that follows its walls takes the loop it is in (and is taken off,
 * remembered on its walls, when its loop has opened); a new loop with a free wall in it, where no room is,
 * becomes a room. `name` gives a new room its name. Returns the floor and the rooms made and lost.
 */
export function refit(f: SketchFloor, name: () => string): { floor: SketchFloor; made: string[]; opened: string[] } {
  const walls = (f.walls ?? []).map((w) => ({ ...w }));
  if (!walls.length && !f.rooms.some((r) => r.loose)) return { floor: f, made: [], opened: [] };
  const lines = [
    ...walls.filter((w) => wallLen(w) > 5).map((w) => ({ s: [w.a, w.b] as Seg, free: true })),
    ...f.rooms.filter((r) => !r.loose).flatMap((r) => edges(r.polygon).map((s) => ({ s, free: false }))),
  ];
  const loops = loopsOf(lines).filter((l) => l.free && polyArea(l.poly) > 0.3e6).sort((a, b) => polyArea(a.poly) - polyArea(b.poly));
  const taken = new Set<number>(), made: string[] = [], opened: string[] = [];
  const rooms: SketchRoom[] = [];
  for (const r of f.rooms) {
    if (!r.loose) { rooms.push(r); continue; }
    // a room with none of its walls on the floor (pasted from a library, say) traces its own again
    if (!walls.some((w) => onOutline(w, r.polygon))) { rooms.push({ ...r, loose: undefined }); continue; }
    const seed = insidePoint(r.polygon);
    let k = loops.findIndex((l, i) => !taken.has(i) && pointInPoly(seed, l.poly));
    // the wall was dragged across the old middle: the loop that shares the most corners
    if (k < 0) {
      let best = 0;
      loops.forEach((l, i) => { if (taken.has(i)) return; const n = l.poly.filter((p) => r.polygon.some((q) => dist(p, q) < 5)).length; if (n > best) { best = n; k = i; } });
      if (best < 2) k = -1;
    }
    if (k >= 0) { taken.add(k); rooms.push({ ...r, polygon: loops[k].poly }); continue; }
    opened.push(r.name);
    for (const w of walls) if (onOutline(w, r.polygon)) w.room = { name: r.name, ...(r.type ? { type: r.type } : {}), ...(r.unit ? { unit: r.unit } : {}) };
  }
  loops.forEach((l, i) => {
    if (taken.has(i)) return;
    const seed = insidePoint(l.poly);
    if (rooms.some((r) => pointInPoly(seed, r.polygon) || pointInPoly(insidePoint(r.polygon), l.poly))) return;
    // a room whose loop opened comes back as it was
    const mine = walls.filter((w) => w.room && onOutline(w, l.poly));
    const was = mine.map((w) => w.room!).find((x) => !rooms.some((r) => r.name.toLowerCase() === x.name.toLowerCase()));
    const room: SketchRoom = was ? { name: was.name, type: was.type ?? "other", ...(was.unit ? { unit: was.unit } : {}), polygon: l.poly, loose: true } : { name: name(), type: "other", polygon: l.poly, loose: true };
    for (const w of mine) delete w.room;
    rooms.push(room);
    made.push(room.name);
  });
  return { floor: { ...f, rooms, walls }, made, opened };
}

// ------------------------------------------------------------------------------- room <-> walls

/** Turn room `ri`'s edges into wall pieces of their own; the room then follows them. */
export function separateRoom(f: SketchFloor, ri: number): SketchFloor {
  const r = f.rooms[ri], have = f.walls ?? [];
  const add: SketchWall[] = edges(r.polygon).filter(([a, b]) => dist(a, b) > 5 && !have.some((w) => onOutline(w, [a, b]) && onOutline({ a, b }, [w.a, w.b]))).map(([a, b]) => ({ a: rnd(a), b: rnd(b) }));
  return { ...f, rooms: f.rooms.map((q, i) => (i === ri ? { ...q, loose: true } : q)), walls: [...have, ...add] };
}

/** Make a room that follows its walls whole again: it traces its own outline and its wall pieces go
 *  (a piece some other room that follows its walls still needs stays). */
export function joinRoom(f: SketchFloor, ri: number): SketchFloor {
  const r = f.rooms[ri], others = f.rooms.filter((q, i) => i !== ri && q.loose);
  const walls = (f.walls ?? []).filter((w) => !onOutline(w, r.polygon) || others.some((q) => onOutline(w, q.polygon)));
  return { ...f, rooms: f.rooms.map((q, i) => (i === ri ? { name: q.name, ...(q.type ? { type: q.type } : {}), ...(q.unit ? { unit: q.unit } : {}), polygon: q.polygon } : q)), walls };
}

/** Take a room that follows its walls off with the wall pieces only it uses. */
export function dropLooseRoom(f: SketchFloor, ri: number): SketchWall[] {
  const r = f.rooms[ri], others = f.rooms.filter((q, i) => i !== ri && q.loose);
  return (f.walls ?? []).filter((w) => !onOutline(w, r.polygon) || others.some((q) => onOutline(w, q.polygon)));
}

// ------------------------------------------------------------------------------ editing pieces

/** The wall ends joined to point p (end `0` is a, `1` is b), leaving out wall `skip`. */
const endsAt = (walls: SketchWall[], p: Pt, skip = -1) => walls.flatMap((w, i) => (i === skip ? [] : ([0, 1] as const).filter((e) => dist(e ? w.b : w.a, p) < E).map((e) => ({ i, e }))));
const setEnd = (w: SketchWall, e: 0 | 1, p: Pt): SketchWall => (e ? { ...w, b: rnd(p) } : { ...w, a: rnd(p) });

/** Whether wall i has anything joined to it (another wall's end on either end or along it). */
export function isJoined(walls: SketchWall[], i: number) {
  const w = walls[i];
  return walls.some((o, j) => j !== i && [o.a, o.b].some((p) => onWall(p, w.a, w.b).d < E));
}

/** Move one end of wall i to `to`; the ends joined there come along unless `alone`. */
export function moveEnd(walls: SketchWall[], i: number, e: 0 | 1, to: Pt, alone = false): SketchWall[] {
  const from = e ? walls[i].b : walls[i].a, carry = alone ? [] : endsAt(walls, from, i);
  return walls.map((w, j) => {
    let out = j === i ? setEnd(w, e, to) : w;
    for (const c of carry) if (c.i === j) out = setEnd(out, c.e, to);
    return out;
  });
}

/** Slide wall i by d: walls joined to its ends stretch to follow, and walls ending along it slide too. */
export function shiftWall(walls: SketchWall[], i: number, d: Pt): SketchWall[] {
  const w = walls[i], mv = (p: Pt): Pt => [p[0] + d[0], p[1] + d[1]];
  return walls.map((o, j) => {
    if (j === i) return { ...o, a: rnd(mv(o.a)), b: rnd(mv(o.b)) };
    let out = o;
    for (const e of [0, 1] as const) { const p = e ? o.b : o.a; if (onWall(p, w.a, w.b).d < E) out = setEnd(out, e, mv(p)); }
    return out;
  });
}

/** Make wall i `len` long, keeping end `keep` where it is (0 a, 1 b) or its middle ("mid"). */
export function setLength(walls: SketchWall[], i: number, len: number, keep: 0 | 1 | "mid"): SketchWall[] {
  const w = walls[i], L = wallLen(w) || 1, u: Pt = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L];
  if (keep === 0) return moveEnd(walls, i, 1, [w.a[0] + u[0] * len, w.a[1] + u[1] * len]);
  if (keep === 1) return moveEnd(walls, i, 0, [w.b[0] - u[0] * len, w.b[1] - u[1] * len]);
  const m: Pt = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
  const first = moveEnd(walls, i, 0, [m[0] - (u[0] * len) / 2, m[1] - (u[1] * len) / 2]);
  return moveEnd(first, i, 1, [m[0] + (u[0] * len) / 2, m[1] + (u[1] * len) / 2]);
}

/** A straight run of pieces from points in order, each end snapped by `snap`. */
export const chain = (pts: Pt[]): SketchWall[] => pts.slice(1).map((b, k) => ({ a: rnd(pts[k]), b: rnd(b) })).filter((w) => wallLen(w) > 50);

/**
 * Where a dragged or drawn wall end lands: on another wall's end or a room's corner when it is within
 * `tol`, else on another wall or a room's edge (a T), else where the pointer is.
 */
export function snapEnd(p: Pt, f: SketchFloor, tol: number, skip = -1): { p: Pt; hit: boolean } {
  const walls = f.walls ?? [];
  let best: Pt | null = null, d = tol;
  for (const [j, w] of walls.entries()) if (j !== skip) for (const q of [w.a, w.b]) if (dist(p, q) < d) { d = dist(p, q); best = q; }
  for (const r of f.rooms) if (!r.loose) for (const q of r.polygon) if (dist(p, q) < d) { d = dist(p, q); best = q; }
  if (best) return { p: best, hit: true };
  d = tol;
  const segs: Seg[] = [...walls.filter((_, j) => j !== skip).map((w) => [w.a, w.b] as Seg), ...f.rooms.filter((r) => !r.loose).flatMap((r) => edges(r.polygon))];
  for (const [a, b] of segs) { const h = onWall(p, a, b); if (h.d < d) { d = h.d; best = h.q; } }
  return best ? { p: rnd(best), hit: true } : { p, hit: false };
}

// --------------------------------------------------------------------------------- the plan

/**
 * The free wall pieces as plan walls. Where a piece lies on a wall the rooms already make, that wall takes
 * the piece's own thickness and height (one wall, not two); the rest of it is a wall of its own.
 */
export function freeWallsToPlan(free: SketchWall[], built: Wall[], lines: Map<string, { a: Pt; b: Pt; rooms: string[] }>, code: string, band: (a: Pt, b: Pt, t: number, ext: number) => Pt[], ceiling: number, rooms: { polygon: Pt[] }[] = []): Wall[] {
  const out: Wall[] = [];
  let n = built.length;
  for (const w of free) {
    const L = wallLen(w);
    if (L < 100) continue;
    const u: Pt = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L];
    const covered: [number, number][] = [];
    for (const rw of built) {
      const l = lines.get(rw.id), s: Seg | null = l ? [l.a, l.b] : null;
      if (!s) continue;
      const off = (p: Pt) => Math.abs((p[0] - w.a[0]) * u[1] - (p[1] - w.a[1]) * u[0]);
      if (off(s[0]) > 12 || off(s[1]) > 12) continue;
      const t0 = (s[0][0] - w.a[0]) * u[0] + (s[0][1] - w.a[1]) * u[1], t1 = (s[1][0] - w.a[0]) * u[0] + (s[1][1] - w.a[1]) * u[1];
      const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(L, Math.max(t0, t1));
      if (hi - lo < 50) continue;
      covered.push([lo, hi]);
      const t = w.thickness_mm ?? rw.thickness_mm, h = w.height_mm ?? (w.half ? std("wall.halfHeight") : undefined);
      if (t !== rw.thickness_mm) { rw.thickness_mm = t; rw.polygon = band(s[0], s[1], t, t / 2); }
      if (h != null) rw.height_mm = h;
    }
    covered.sort((a, b) => a[0] - b[0]);
    const gaps: [number, number][] = [];
    let at = 0;
    for (const [lo, hi] of covered) { if (lo - at > 100) gaps.push([at, lo]); at = Math.max(at, hi); }
    if (L - at > 100) gaps.push([at, L]);
    const h = wallHeight(w, ceiling);
    for (const [lo, hi] of gaps) {
      const a: Pt = [w.a[0] + u[0] * lo, w.a[1] + u[1] * lo], b: Pt = [w.a[0] + u[0] * hi, w.a[1] + u[1] * hi];
      const t = wallThickness(w, isOutside(rooms, { a, b }));
      const id = `${code}-W${String(++n).padStart(2, "0")}`;
      out.push({ id, polygon: band(a, b, t, t / 2), length_mm: Math.round(hi - lo), thickness_mm: t, exterior: false, room_ids: [], free: true, ...(h < ceiling ? { height_mm: h } : {}) });
      lines.set(id, { a, b, rooms: [] });
    }
  }
  return out;
}
