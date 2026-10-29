// Geometry for drawing a plan by hand (the sketch editor): which rooms share a wall, where a door or
// window of a sketch sits, snapping, and cutting a room in two. Works on the same sketch the plan reader
// hands back, so a hand fix and a read are one format. Rooms are mostly straight walls at right angles.
import type { Pt } from "./types";
import { expandUnits, type Side, type Sketch, type SketchFloor, type SketchRoom } from "./sketch";
import { polyArea } from "./geometry";

export type Seg = [Pt, Pt];
const E = 1; // mm: closer than this is the same line

export const edgesOf = (p: Pt[]): Seg[] => p.map((a, i) => [a, p[(i + 1) % p.length]] as Seg);
const horiz = (s: Seg) => Math.abs(s[0][1] - s[1][1]) < E;
const vert = (s: Seg) => Math.abs(s[0][0] - s[1][0]) < E;
export const segLen = (s: Seg) => Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);

export function pointInPoly(p: Pt, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The overlap of two straight edges lying on one horizontal or vertical line, low end first. */
function overlap(s: Seg, t: Seg): Seg | null {
  if (horiz(s) && horiz(t) && Math.abs(s[0][1] - t[0][1]) < E) {
    const lo = Math.max(Math.min(s[0][0], s[1][0]), Math.min(t[0][0], t[1][0])), hi = Math.min(Math.max(s[0][0], s[1][0]), Math.max(t[0][0], t[1][0]));
    return hi - lo > 50 ? [[lo, s[0][1]], [hi, s[0][1]]] : null;
  }
  if (vert(s) && vert(t) && Math.abs(s[0][0] - t[0][0]) < E) {
    const lo = Math.max(Math.min(s[0][1], s[1][1]), Math.min(t[0][1], t[1][1])), hi = Math.min(Math.max(s[0][1], s[1][1]), Math.max(t[0][1], t[1][1]));
    return hi - lo > 50 ? [[s[0][0], lo], [s[0][0], hi]] : null;
  }
  return null;
}

/** The longest stretch of wall two rooms share, or null when they don't touch. */
export function sharedEdge(a: Pt[], b: Pt[]): Seg | null {
  let best: Seg | null = null;
  for (const s of edgesOf(a)) for (const t of edgesOf(b)) { const o = overlap(s, t); if (o && (!best || segLen(o) > segLen(best))) best = o; }
  return best;
}

/** Which side of the room an edge is on: the way you'd face standing in the room looking at it. */
export function sideOf(poly: Pt[], s: Seg): Side {
  const mid: Pt = [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2];
  const dx = s[1][0] - s[0][0], dy = s[1][1] - s[0][1], L = Math.hypot(dx, dy) || 1;
  let nx = -dy / L, ny = dx / L;
  if (pointInPoly([mid[0] + nx * 30, mid[1] + ny * 30], poly)) { nx = -nx; ny = -ny; }
  return Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? "east" : "west") : ny > 0 ? "south" : "north";
}

/** The parts of a room's edges that no other room on the floor shares: its outside walls. */
export function outsidePieces(f: SketchFloor, ri: number): Seg[] {
  const me = f.rooms[ri];
  const out: Seg[] = [];
  for (const s of edgesOf(me.polygon)) {
    if (!horiz(s) && !vert(s)) { out.push(s); continue; }
    const h = horiz(s), k = h ? 0 : 1, fixed = h ? s[0][1] : s[0][0];
    const lo = Math.min(s[0][k], s[1][k]), hi = Math.max(s[0][k], s[1][k]);
    let pieces: [number, number][] = [[lo, hi]];
    f.rooms.forEach((r, j) => {
      if (j === ri) return;
      for (const t of edgesOf(r.polygon)) {
        const o = overlap(s, t);
        if (!o) continue;
        const [a, b] = [o[0][k], o[1][k]];
        pieces = pieces.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : ([[p, a], [b, q]] as [number, number][]).filter(([x, y]) => y - x > 100)));
      }
    });
    for (const [p, q] of pieces) out.push(h ? [[p, fixed], [q, fixed]] : [[fixed, p], [fixed, q]]);
  }
  return out;
}

const byName = (f: SketchFloor, n: string) => {
  const s = n.toLowerCase().trim();
  const i = f.rooms.findIndex((r) => r.name.toLowerCase().trim() === s);
  return i >= 0 ? i : f.rooms.findIndex((r) => r.name.toLowerCase().includes(s) || s.includes(r.name.toLowerCase()));
};
export const OUTSIDE = /^(outside|exterior|out|garden|yard|street)$/i;

/** The outside wall of a room on one side (its longest piece), where an outside door or windows go. */
export function sideWall(f: SketchFloor, ri: number, side: Side): Seg | null {
  const poly = f.rooms[ri].polygon;
  return outsidePieces(f, ri).filter((s) => sideOf(poly, s) === side).sort((a, b) => segLen(b) - segLen(a))[0] ?? null;
}

const along = (s: Seg, t: number): Pt => [s[0][0] + (s[1][0] - s[0][0]) * t, s[0][1] + (s[1][1] - s[0][1]) * t];

type DoorLike = { rooms: [string, string]; at?: number; width_mm?: number; side?: Side; kind?: string };
type WindowLike = { room: string; side: Side; width_mm?: number; count?: number; at?: number[] };

/** The stretch of wall a door's `at` is measured along: the wall the two rooms share, or the room's
 *  outside wall on the door's side. */
export function doorWall(f: SketchFloor, d: DoorLike): Seg | null {
  const i = byName(f, d.rooms[0] ?? "");
  if (i < 0) return null;
  const out = !d.rooms[1] || OUTSIDE.test(d.rooms[1]);
  if (out) return d.side ? sideWall(f, i, d.side) : outsidePieces(f, i).sort((a, b) => segLen(b) - segLen(a))[0] ?? null;
  const j = byName(f, d.rooms[1]);
  return j >= 0 ? sharedEdge(f.rooms[i].polygon, f.rooms[j].polygon) : null;
}
export const doorWidth = (d: DoorLike) => d.width_mm ?? (d.kind === "garage_door" ? 2400 : d.kind === "double_door" || d.kind === "sliding_door" ? 1500 : d.kind === "opening" ? 1200 : 820);
export const windowWall = (f: SketchFloor, w: WindowLike) => { const i = byName(f, w.room); return i >= 0 ? sideWall(f, i, w.side) : null; };

/** A piece of `wall` `width` long centred at `at` (0 to 1), kept clear of the corners. */
function piece(wall: Seg, at: number, width: number): Seg {
  const L = segLen(wall), w = Math.max(100, Math.min(width, L - 200));
  const c = Math.max(w / 2 + 100, Math.min(L - w / 2 - 100, at * L));
  return [along(wall, (c - w / 2) / L), along(wall, (c + w / 2) / L)];
}

/** Where a door of the sketch is drawn: a short piece of its wall, or null when it can't be placed. */
export function doorSpot(f: SketchFloor, d: DoorLike): Seg | null {
  const wall = doorWall(f, d);
  return wall ? piece(wall, d.at ?? 0.5, doorWidth(d)) : null;
}

/** Where a sketch's windows are drawn: at their own spots, or evenly along the room's outside wall. */
export function windowSpots(f: SketchFloor, w: WindowLike): Seg[] {
  const wall = windowWall(f, w);
  if (!wall) return [];
  const n = Math.max(1, Math.min(4, w.count ?? 1)), wd = Math.min(w.width_mm ?? 1200, segLen(wall) / n - 100);
  return Array.from({ length: n }, (_, k) => piece(wall, w.at?.[k] ?? (k + 1) / (n + 1), wd));
}

/** How far along `s` (0 to 1) the point nearest `p` is, not clamped. */
export function param(p: Pt, s: Seg) {
  const dx = s[1][0] - s[0][0], dy = s[1][1] - s[0][1];
  return ((p[0] - s[0][0]) * dx + (p[1] - s[0][1]) * dy) / (dx * dx + dy * dy || 1);
}
/** Whether two straight pieces lie on one line (a door's wall and a room's edge). */
export function sameLine(s: Seg, t: Seg) {
  const L = segLen(s) || 1, cross = (p: Pt) => Math.abs((s[1][0] - s[0][0]) * (p[1] - s[0][1]) - (s[1][1] - s[0][1]) * (p[0] - s[0][0])) / L;
  return cross(t[0]) < 5 && cross(t[1]) < 5;
}

/** Distance from a point to a segment, and how far along it (0 to 1) the nearest point is. */
export function nearSeg(p: Pt, s: Seg) {
  const dx = s[1][0] - s[0][0], dy = s[1][1] - s[0][1], L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - s[0][0]) * dx + (p[1] - s[0][1]) * dy) / L2));
  return { d: Math.hypot(p[0] - (s[0][0] + dx * t), p[1] - (s[0][1] + dy * t)), t };
}

/** Where a click on a wall would put a door: between two rooms, or an outside door of one room. */
export function wallAt(f: SketchFloor, p: Pt, tol: number): { rooms: [number, number | null]; wall: Seg; t: number; side: Side } | null {
  let best: { ri: number; s: Seg; d: number } | null = null;
  f.rooms.forEach((r, ri) => { for (const s of edgesOf(r.polygon)) { const { d } = nearSeg(p, s); if (d < tol && (!best || d < best.d)) best = { ri, s, d }; } });
  if (!best) return null;
  const { ri, s } = best as { ri: number; s: Seg };
  // a neighbour on the other side of the same stretch of wall
  for (let j = 0; j < f.rooms.length; j++) {
    if (j === ri) continue;
    for (const t of edgesOf(f.rooms[j].polygon)) {
      const o = overlap(s, t);
      if (!o || nearSeg(p, o).d > tol) continue;
      const shared = sharedEdge(f.rooms[ri].polygon, f.rooms[j].polygon) ?? o;
      return { rooms: [ri, j], wall: shared, t: nearSeg(p, shared).t, side: sideOf(f.rooms[ri].polygon, s) };
    }
  }
  const side = sideOf(f.rooms[ri].polygon, s);
  const wall = sideWall(f, ri, side) ?? s;
  return { rooms: [ri, null], wall, t: nearSeg(p, wall).t, side };
}

/** Pull a value onto a nearby line (another room's wall) when there is one, else onto the grid. */
export function snapTo(v: number, lines: number[], tol: number, grid: number) {
  let best = v, d = tol;
  for (const l of lines) if (Math.abs(l - v) < d) { d = Math.abs(l - v); best = l; }
  return d < tol ? best : Math.round(v / grid) * grid;
}

/** Cut a polygon along x = v (axis "x") or y = v (axis "y") into the part below and the part above. */
export function splitPoly(poly: Pt[], axis: "x" | "y", v: number): [Pt[], Pt[]] {
  const k = axis === "x" ? 0 : 1;
  const clip = (keep: (q: Pt) => boolean) => {
    const out: Pt[] = [];
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length];
      if (keep(a)) out.push(a);
      if (keep(a) !== keep(b)) { const t = (v - a[k]) / (b[k] - a[k]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    });
    return out.map((q) => [Math.round(q[0]), Math.round(q[1])] as Pt).filter((q, i, arr) => i === 0 || q[0] !== arr[i - 1][0] || q[1] !== arr[i - 1][1]);
  };
  return [clip((q) => q[k] <= v), clip((q) => q[k] >= v)];
}

/** Move a corner and keep the walls either side of it straight (a wall that ran across stays across). */
export function moveCorner(poly: Pt[], i: number, to: Pt): Pt[] {
  const n = poly.length, out = poly.map((p) => [...p] as Pt);
  const prev = (i - 1 + n) % n, next = (i + 1) % n;
  for (const j of [prev, next]) {
    const s: Seg = [poly[j], poly[i]];
    if (horiz(s)) out[j][1] = to[1];
    else if (vert(s)) out[j][0] = to[0];
  }
  out[i] = [to[0], to[1]];
  return out;
}

/** Slide a straight wall: every room edge on that line within its span moves with it, so the rooms
 *  either side stay joined. */
export function moveWall(rooms: SketchRoom[], s: Seg, by: number): SketchRoom[] {
  const h = horiz(s), v = vert(s);
  if (!h && !v) return rooms;
  const k = h ? 1 : 0, along = h ? 0 : 1, line = s[0][k];
  const lo = Math.min(s[0][along], s[1][along]), hi = Math.max(s[0][along], s[1][along]);
  return rooms.map((r) => {
    const poly = r.polygon.map((p) => [...p] as Pt);
    let hit = false;
    edgesOf(r.polygon).forEach((t, i) => {
      const same = h ? horiz(t) : vert(t);
      if (!same || Math.abs(t[0][k] - line) > E) return;
      const tl = Math.min(t[0][along], t[1][along]), th = Math.max(t[0][along], t[1][along]);
      if (th - lo < 50 || hi - tl < 50) return;
      poly[i][k] = line + by;
      poly[(i + 1) % poly.length][k] = line + by;
      hit = true;
    });
    return hit ? { ...r, polygon: poly } : r;
  });
}

export const roomArea = (r: SketchRoom) => polyArea(r.polygon) / 1e6;

/** The sketch with every repeated home drawn out in full (a copy becomes real rooms), so each one can be
 *  fixed on its own. */
export function flatten(s: Sketch): Sketch {
  const c: Sketch = JSON.parse(JSON.stringify(s));
  if (!c.units?.some((u) => u.copy_of)) return c;
  return { ...c, floors: expandUnits(c), units: c.units.map((u) => ({ name: u.name })) };
}

/**
 * A piece of furniture put near a wall, pushed back flat against it and turned to face the room (how the
 * Sims and floor planners place a cabinet). Only when its back is within `reach` mm of a straight
 * (square to the page) wall; otherwise it stays where it was put.
 */
export function hugWall(poly: Pt[], c: Pt, width: number, depth: number, reach = 450): { center: Pt; facing: Side } | null {
  let best: { center: Pt; facing: Side; gap: number } | null = null;
  for (const s of edgesOf(poly)) {
    const horiz = Math.abs(s[0][1] - s[1][1]) < 1, vert = Math.abs(s[0][0] - s[1][0]) < 1;
    if (!horiz && !vert) continue;
    const ax = horiz ? 0 : 1, line = horiz ? s[0][1] : s[0][0];
    const lo = Math.min(s[0][ax], s[1][ax]), hi = Math.max(s[0][ax], s[1][ax]);
    if (c[ax] < lo || c[ax] > hi || hi - lo < 300) continue;
    // which way the room is from this wall
    const mid: Pt = horiz ? [(lo + hi) / 2, line + 30] : [line + 30, (lo + hi) / 2];
    const into = pointInPoly(mid, poly) ? 1 : -1;
    const off = (c[1 - ax] - line) * into;
    if (off < -100) continue;
    const gap = Math.abs(off - depth / 2);
    if (gap > reach || (best && gap >= best.gap)) continue;
    const along = Math.min(hi - width / 2, Math.max(lo + width / 2, c[ax]));
    const across = line + into * depth / 2;
    const center: Pt = horiz ? [along, across] : [across, along];
    const facing: Side = horiz ? (into > 0 ? "south" : "north") : into > 0 ? "east" : "west";
    best = { center, facing, gap };
  }
  return best && { center: best.center, facing: best.facing };
}

/**
 * A new rectangular room trimmed back to the rooms it was drawn over, so rooms never overlap: an edge
 * that runs into a neighbour stops at the neighbour's wall (one shared wall, not two). Null when it's
 * mostly on top of another room, or not a rectangle (left as drawn).
 */
export function trimOverlap(poly: Pt[], others: Pt[][]): Pt[] | null {
  const rect = (p: Pt[]) => p.length === 4 && edgesOf(p).every(([a, b]) => Math.abs(a[0] - b[0]) < 1 || Math.abs(a[1] - b[1]) < 1);
  if (!rect(poly)) return poly;
  let [x0, y0, x1, y1] = [Math.min(...poly.map((p) => p[0])), Math.min(...poly.map((p) => p[1])), Math.max(...poly.map((p) => p[0])), Math.max(...poly.map((p) => p[1]))];
  for (const o of others) {
    if (!rect(o)) continue;
    const [bx0, by0, bx1, by1] = [Math.min(...o.map((p) => p[0])), Math.min(...o.map((p) => p[1])), Math.max(...o.map((p) => p[0])), Math.max(...o.map((p) => p[1]))];
    const ox = Math.min(x1, bx1) - Math.max(x0, bx0), oy = Math.min(y1, by1) - Math.max(y0, by0);
    if (ox <= 1 || oy <= 1) continue;
    // pull back the side that went in the least
    if (ox <= oy) { if (x0 + x1 < bx0 + bx1) x1 = Math.min(x1, bx0); else x0 = Math.max(x0, bx1); }
    else if (y0 + y1 < by0 + by1) y1 = Math.min(y1, by0); else y0 = Math.max(y0, by1);
    if (x1 - x0 < 300 || y1 - y0 < 300) return null;
  }
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}
