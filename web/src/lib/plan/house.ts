// Build mode: changes to the house itself made inside a job (a wall moved, a room cut in two, a door or
// window added, moved, resized or taken out), applied on top of the plan as read, like every other edit.
// The drawing is never changed, so "put back as drawn" always works, and pins keep their ids.
//
// Everything works on the sides of rooms (the straight inside faces, as the wall view shows them), not on
// wall outlines, because a read AutoCAD wall can be one long outline round several corners. The wall
// itself is found by feeling outwards from a room's face until the wall ends.
import type { AddedOpening, ElementEdit, Heading } from "@/lib/data/types";
import type { DoorLeaf, Floor, Opening, OpeningKind, Plan, Pt, Room, Wall } from "./types";
import { bboxOf, edgeDistance, pointInPoly, polyArea, roomSides, type WallSide } from "./geometry";
import { splitPoly } from "./sketchEdit";
import { DOOR_W, WIN, openingName, standardWidth } from "./standard";
import clip from "polygon-clipping";

const dot = (p: Pt, u: Pt) => p[0] * u[0] + p[1] * u[1];
const sub = (p: Pt, q: Pt): Pt => [p[0] - q[0], p[1] - q[1]];
const add = (p: Pt, v: Pt, k = 1): Pt => [p[0] + v[0] * k, p[1] + v[1] * k];
const r10 = (v: number) => Math.round(v / 10) * 10;
const area = (p: Pt[]) => Math.round(polyArea(p) / 1e5) / 10;
const dirOf = (s: { a: Pt; b: Pt }): Pt => { const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1; return [(s.b[0] - s.a[0]) / L, (s.b[1] - s.a[1]) / L]; };
const segDist = (p: Pt, a: Pt, b: Pt) => edgeDistance(p, [a, b]);

/** How far the wall goes from a room's face: outwards (out of the room) and inwards (a plan drawn on
 *  the wall centre lines has half the wall inside the room). Felt for at a few points along the side. */
export function wallDepth(f: Floor, side: WallSide, at?: number): { out: number; inn: number } {
  const u = dirOf(side), o: Pt = [-side.inward[0], -side.inward[1]];
  const solid = (p: Pt) => f.walls.some((w) => pointInPoly(p, w.polygon)) || f.openings.some((x) => pointInPoly(p, x.polygon));
  // in 15 mm steps, then to the millimetre
  const feel = (from: Pt, dir: Pt) => { let k = 0; while (k < 800 && solid(add(from, dir, k + 15))) k += 15; while (k < 815 && solid(add(from, dir, k + 1))) k += 1; return k; };
  const spots = at != null ? [at] : [0.25, 0.5, 0.75].map((t) => t * side.length);
  let out = 0, inn = 0;
  for (const s of spots) { const p = add(side.a, u, s); out = Math.max(out, feel(p, o)); inn = Math.max(inn, feel(p, side.inward)); }
  // nothing found (a line drawing with no wall shapes): a standard inside wall either side of the line
  if (!out && !inn) return { out: 60, inn: 60 };
  return { out, inn };
}

/** The side of a room facing `heading` nearest a point (each room can have two north walls, say). */
export function sideNear(f: Floor, room: Room, heading: Heading, at: Pt): WallSide | null {
  return roomSides(f, room).filter((s) => s.heading === heading).sort((x, y) => segDist(at, x.a, x.b) - segDist(at, y.a, y.b))[0] ?? null;
}

/** The room side nearest a point on the floor, and how far along it that is. */
export function sideAt(f: Floor, p: Pt, reach = 700): { room: Room; side: WallSide; along: number } | null {
  let best: { room: Room; side: WallSide; d: number } | null = null;
  for (const r of f.rooms) for (const s of roomSides(f, r)) {
    const d = segDist(p, s.a, s.b);
    if (d < reach && (!best || d < best.d)) best = { room: r, side: s, d };
  }
  if (!best) return null;
  return { room: best.room, side: best.side, along: Math.max(0, Math.min(best.side.length, dot(sub(p, best.side.a), dirOf(best.side)))) };
}

/** Which room is on the other side of a wall (null: the outside). */
function across(f: Floor, side: WallSide, along: number, depth: number): Room | null {
  const p = add(add(side.a, dirOf(side), along), side.inward, -(depth + 80));
  return f.rooms.find((r) => r.id !== side.roomId && pointInPoly(p, r.polygon)) ?? null;
}

/** A band of thickness t along a to b. */
function band(a: Pt, b: Pt, t: number): Pt[] {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (-(b[1] - a[1]) / L) * (t / 2), ny = ((b[0] - a[0]) / L) * (t / 2);
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
}

const swings = (k: string) => k === "door" || k === "double_door";
function newLeaves(kind: string, a: Pt, b: Pt, width: number): DoorLeaf[] {
  if (!swings(kind)) return [];
  const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  if (kind === "double_door") return [{ hinge: a, radius: width / 2, start_angle: ang, end_angle: ang + 90 }, { hinge: b, radius: width / 2, start_angle: ang + 90, end_angle: ang + 180 }];
  return [{ hinge: a, radius: width, start_angle: ang, end_angle: ang + 90 }];
}

/** Make a door or window from what was added in Build mode, in its wall as that wall now stands. */
function addedOpening(id: string, ad: AddedOpening, f: Floor): Opening | null {
  const room = f.rooms.find((r) => r.id === ad.room_id);
  let side = room ? sideNear(f, room, ad.heading, ad.at) : null;
  // its room was cut in two since: the half it's in now
  if (!side || segDist(ad.at, side.a, side.b) > 1500) {
    const all = f.rooms.flatMap((r) => (r.id === ad.room_id || r.id.startsWith(ad.room_id) ? roomSides(f, r) : [])).filter((s) => s.heading === ad.heading);
    side = all.sort((x, y) => segDist(ad.at, x.a, x.b) - segDist(ad.at, y.a, y.b))[0] ?? side;
  }
  if (!side) return null;
  const u = dirOf(side);
  const width = Math.max(300, Math.min(ad.width, side.length - 100));
  const along = Math.max(width / 2 + 50, Math.min(side.length - width / 2 - 50, dot(sub(ad.at, side.a), u)));
  const d = wallDepth(f, side, along);
  // the middle of the wall, not the room's face
  const mid = add(add(side.a, u, along), side.inward, -(d.out - d.inn) / 2);
  const t = Math.max(100, d.out + d.inn);
  const a = add(mid, u, -width / 2), b = add(mid, u, width / 2);
  const other = across(f, side, along, d.out);
  const kind = ad.kind as OpeningKind;
  return {
    id, kind, name: openingName(kind, !other), a, b, width_mm: Math.round(width), thickness_mm: t, exterior: !other,
    polygon: band(a, b, t), room_ids: [side.roomId, ...(other ? [other.id] : [])], leaves: newLeaves(kind, a, b, width), confidence: 1,
    ...(kind === "window" ? { sill_mm: ad.sill_mm ?? WIN.sill, height_mm: ad.height_mm ?? WIN.height } : ad.height_mm ? { height_mm: ad.height_mm } : {}),
  };
}

/** The straight run of wall a door or window can slide along: the side of its room it's on. */
function runOf(f: Floor, o: Opening): { a: Pt; u: Pt; length: number } | null {
  const mid: Pt = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2], ou = dirOf(o);
  for (const id of o.room_ids) {
    const r = f.rooms.find((x) => x.id === id);
    if (!r) continue;
    const s = roomSides(f, r).filter((x) => Math.abs(dot(dirOf(x), ou)) > 0.9).sort((x, y) => segDist(mid, x.a, x.b) - segDist(mid, y.a, y.b))[0];
    if (s && segDist(mid, s.a, s.b) < 800) return { a: s.a, u: dirOf(s), length: s.length };
  }
  return null;
}

/** A door or window changed: slid along its wall, made wider or narrower, made another kind. */
function editOpening(o: Opening, e: ElementEdit, run: { a: Pt; u: Pt; length: number } | null): Opening {
  const out: Opening = { ...o };
  if (e.name) out.name = e.name;
  if (e.sill_mm != null) out.sill_mm = e.sill_mm;
  if (e.height_mm) out.height_mm = e.height_mm;
  const kind = (e.kind as OpeningKind | undefined) ?? o.kind;
  if (!e.slide && !e.width && kind === o.kind) return out;
  const u = dirOf(o);
  const width = e.width ?? (kind !== o.kind ? DOOR_W[kind] ?? (kind === "window" ? WIN.width : o.width_mm) : o.width_mm);
  let mid = add([(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2], u, e.slide ?? 0);
  if (run) {
    // stays on its stretch of wall, clear of the corners
    const s = dot(sub(mid, run.a), run.u), lo = width / 2 + 50, hi = run.length - width / 2 - 50;
    if (lo <= hi) mid = add(mid, run.u, Math.max(lo, Math.min(hi, s)) - s);
  }
  const a = add(mid, u, -width / 2), b = add(mid, u, width / 2);
  const hingeAtA = (lf: DoorLeaf) => Math.hypot(lf.hinge[0] - o.a[0], lf.hinge[1] - o.a[1]) <= Math.hypot(lf.hinge[0] - o.b[0], lf.hinge[1] - o.b[1]);
  out.a = a; out.b = b; out.width_mm = Math.round(width); out.kind = kind;
  out.polygon = band(a, b, o.thickness_mm);
  out.leaves = kind === o.kind && o.leaves.length
    ? o.leaves.map((lf) => ({ ...lf, hinge: hingeAtA(lf) ? a : b, radius: (lf.radius * width) / (o.width_mm || width) }))
    : newLeaves(kind, a, b, width);
  if (kind !== o.kind) {
    if (!e.name) out.name = openingName(kind, o.exterior);
    if (kind === "window") { out.sill_mm = e.sill_mm ?? o.sill_mm ?? WIN.sill; out.height_mm = e.height_mm ?? WIN.height; }
    else if (o.kind === "window") { delete out.sill_mm; if (!e.height_mm) delete out.height_mm; }
  }
  return out;
}

type Poly = [number, number][][];
const ring = (p: Pt[]): Poly => [p.map((q) => [q[0], q[1]] as [number, number])];
/** Pieces of a boolean worth keeping: not the hair-thin slivers a wall's edge leaves behind. */
const real = (mp: Poly[]) => mp.filter((pg) => {
  const r = pg[0], a = Math.abs(polyArea(r.map((q) => [q[0], q[1]] as Pt)));
  const per = r.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - r[i - 1][0], q[1] - r[i - 1][1]) : s), 0);
  return a > 2e4 && a / (per || 1) > 12;
});
/** The outline left after a boolean: the biggest piece's outer ring, without the closing point. */
function outer(mp: Poly[]): Pt[] | null {
  const rings = mp.map((pg) => pg[0].slice(0, -1).map((q) => [Math.round(q[0]), Math.round(q[1])] as Pt)).filter((r) => r.length >= 3);
  return rings.sort((a, b) => polyArea(b) - polyArea(a))[0] ?? null;
}

/**
 * Slide one side of a room straight out (by > 0) or in. The room grows or shrinks along that side, the
 * room on the other side of the wall gives up or gets the strip, and the wall (its doors and windows
 * too) goes with it. Where the wall carried on past the room, it now steps, like a real wall would.
 */
export function moveSide(f: Floor, side: WallSide, by: number): Floor {
  const u = dirOf(side), o: Pt = [-side.inward[0], -side.inward[1]], mv: Pt = [o[0] * by, o[1] * by];
  const d = wallDepth(f, side);
  const L = side.length;
  /** a box on the plan, given along the side (from a) and across it (out of the room) */
  const box = (s0: number, s1: number, t0: number, t1: number): Poly =>
    ring([add(add(side.a, u, s0), o, t0), add(add(side.a, u, s1), o, t0), add(add(side.a, u, s1), o, t1), add(add(side.a, u, s0), o, t1)]);
  // how far the walls that meet this one at each end reach along it
  const solid = (p: Pt) => f.walls.some((w) => pointInPoly(p, w.polygon));
  const mid = (d.out - d.inn) / 2;
  const reachEnd = (from: Pt, dir: Pt) => { let k = 0; while (k < 800 && solid(add(from, dir, k + 15))) k += 15; return k ? k + 15 : 0; };
  const back: Pt = [-u[0], -u[1]];
  // past each end, and (on a plan drawn on centre lines) the half of the meeting wall inside the span
  const eA = reachEnd(add(side.a, o, mid), back), eB = reachEnd(add(side.b, o, mid), u);
  const fA = Math.max(reachEnd(add(side.a, o, d.out + 20), u), reachEnd(add(side.a, o, -d.inn - 20), u));
  const fB = Math.max(reachEnd(add(side.b, o, d.out + 20), back), reachEnd(add(side.b, o, -d.inn - 20), back));
  const oldStrip = box(-eA, L + eB, -d.inn, d.out);
  // pushed out, the walls meeting it at each end stretch across the gap to keep meeting it
  const endBoxes = by > 0 ? [...(eA ? [box(-eA, Math.min(fA, L / 2), -d.inn, d.out + by)] : []), ...(eB ? [box(L - Math.min(fB, L / 2), L + eB, -d.inn, d.out + by)] : [])] : [];
  // the walls: the stretch along this side lifted out and put back moved, the walls meeting it stretched
  const walls: Wall[] = [];
  for (const w of f.walls) {
    const piece = clip.intersection(ring(w.polygon), oldStrip);
    if (!piece.length) { walls.push(w); continue; }
    const moved = piece.map((pg) => pg.map((rg) => rg.map((q) => [q[0] + mv[0], q[1] + mv[1]] as [number, number])));
    const ends = endBoxes.filter((b) => clip.intersection(ring(w.polygon), b).length);
    const rest = real(clip.difference(ring(w.polygon), oldStrip));
    const next = clip.union(rest.length ? rest : [], ...moved, ...ends);
    const out = outer(next);
    if (!out) continue;
    const length_mm = out.length === 4 ? Math.round(Math.max(Math.hypot(out[1][0] - out[0][0], out[1][1] - out[0][1]), Math.hypot(out[2][0] - out[1][0], out[2][1] - out[1][1]))) : w.length_mm;
    walls.push({ ...w, polygon: out, length_mm });
  }
  // the rooms: this one along its side, and whatever is on the other side of the wall
  // where the room on the other side starts: past the wall, or on the same line when the plan is
  // drawn on the walls' centre lines
  const nf = Math.max(0, d.out - d.inn);
  const grow = by > 0 ? box(0, L, 0, by) : null, shrink = by < 0 ? box(0, L, by, 0) : null;
  const theirs = by > 0 ? box(0, L, 0, nf + by) : box(0, L, nf + by, nf);
  const other = across(f, side, L / 2, d.out);
  const rooms = f.rooms.map((r) => {
    let poly: Poly[] | null = null;
    if (r.id === side.roomId) poly = grow ? clip.union(ring(r.polygon), grow) : clip.difference(ring(r.polygon), shrink!);
    else if (by > 0 && clip.intersection(ring(r.polygon), theirs).length) poly = clip.difference(ring(r.polygon), theirs);
    else if (by < 0 && r.id === other?.id) poly = clip.union(ring(r.polygon), theirs);
    const out = poly && outer(poly);
    return out ? { ...r, polygon: out, area_m2: area(out) } : r;
  });
  const inStrip = (p: Pt) => { const s = dot(sub(p, side.a), u), t = dot(sub(p, side.a), o); return s >= 0 && s <= L && t >= -d.inn - 10 && t <= d.out + 10; };
  const openings = f.openings.map((x) => {
    if (!inStrip([(x.a[0] + x.b[0]) / 2, (x.a[1] + x.b[1]) / 2]) || Math.abs(dot(dirOf(x), u)) < 0.9) return x;
    return { ...x, a: add(x.a, mv), b: add(x.b, mv), polygon: x.polygon.map((q) => add(q, mv)), leaves: x.leaves.map((lf) => ({ ...lf, hinge: add(lf.hinge, mv) })) };
  });
  // the building's outline, when this is an outside wall
  let footprint = f.footprint;
  if (!other && f.footprint.length) {
    const fp = f.footprint.map((r) => ring(r));
    const next = by > 0 ? clip.union(fp[0], ...fp.slice(1), box(-eA, L + eB, 0, d.out + by)) : clip.difference(clip.union(fp[0], ...fp.slice(1)), box(0, L, d.out + by, d.out + 10));
    const rings = next.map((pg) => pg[0].slice(0, -1).map((q) => [Math.round(q[0]), Math.round(q[1])] as Pt)).filter((r) => r.length >= 3);
    if (rings.length) footprint = rings;
  }
  return { ...f, rooms, walls, openings, footprint };
}

/** Cut a room in two with a new wall straight across it. The first half keeps the room's id (and its
 *  pins); the other half is a new room. Doors, windows and objects go with the half they are in. */
function splitRoom(f: Floor, r: Room, sp: NonNullable<ElementEdit["split"]>): Floor {
  const [A, B] = splitPoly(r.polygon, sp.axis, sp.at);
  if (A.length < 3 || B.length < 3 || polyArea(A) < 5e5 || polyArea(B) < 5e5) return f;
  const k = sp.axis === "x" ? 0 : 1, o = 1 - k;
  const on = A.filter((q) => Math.abs(q[k] - sp.at) < 2).map((q) => q[o]);
  if (on.length < 2) return f;
  const p: Pt = k === 0 ? [sp.at, Math.min(...on)] : [Math.min(...on), sp.at], q: Pt = k === 0 ? [sp.at, Math.max(...on)] : [Math.max(...on), sp.at];
  const nid = `${r.id}b`, t = 100;
  const wall: Wall = { id: `${r.id}-W`, polygon: band(p, q, t), length_mm: Math.round(Math.hypot(q[0] - p[0], q[1] - p[1])), thickness_mm: t, exterior: false, room_ids: [r.id, nid] };
  const inB = (pt: Pt) => (pointInPoly(pt, B) ? true : pointInPoly(pt, A) ? false : edgeDistance(pt, B) < edgeDistance(pt, A));
  const mid = (x: { a: Pt; b: Pt }): Pt => [(x.a[0] + x.b[0]) / 2, (x.a[1] + x.b[1]) / 2];
  const walls = f.walls.map((w) => {
    if (!w.room_ids.includes(r.id)) return w;
    // a wall along both halves borders both
    const near = (poly: Pt[]) => w.polygon.some((pt) => pointInPoly(pt, poly) || edgeDistance(pt, poly) < 400);
    const ids = [...(near(A) ? [r.id] : []), ...(near(B) ? [nid] : [])];
    return { ...w, room_ids: w.room_ids.flatMap((id) => (id === r.id ? (ids.length ? ids : [r.id]) : [id])) };
  });
  const openings = f.openings.map((x) => (x.room_ids.includes(r.id) && inB(mid(x)) ? { ...x, room_ids: x.room_ids.map((id) => (id === r.id ? nid : id)) } : x));
  const fixtures = f.fixtures.map((x) => (x.room_id === r.id && inB(x.center) ? { ...x, room_id: nid } : x));
  const keep: Room = { ...r, polygon: A, area_m2: area(A) };
  const other: Room = {
    ...r, id: nid, name: sp.name || `${r.name} 2`, polygon: B, area_m2: area(B), label_source: "contractor", confidence: 1,
    wall_ids: [], opening_ids: [], drawing_labels: [], drawing_area_m2: null, notes: null,
  };
  return { ...f, rooms: f.rooms.flatMap((x) => (x.id === r.id ? [keep, other] : [x])), walls: [...walls, wall], openings, fixtures };
}

/** Rebuild each room's lists of walls and doors from what borders it now. */
function relist(f: Floor): Floor {
  return {
    ...f,
    rooms: f.rooms.map((r) => ({ ...r, wall_ids: f.walls.filter((w) => w.room_ids.includes(r.id)).map((w) => w.id), opening_ids: f.openings.filter((o) => o.room_ids.includes(r.id)).map((o) => o.id) })),
    bounds: bboxOf([...f.rooms.flatMap((r) => r.polygon), ...f.walls.flatMap((w) => w.polygon)]),
  };
}

export function applyHouseEdits(plan: Plan, edits: Record<string, ElementEdit>): Plan {
  const all = Object.entries(edits).sort(([a], [b]) => (a < b ? -1 : 1));
  // walls moved and rooms cut, in the order they were done
  const ops = all.filter(([, e]) => e.move?.by || e.split).sort(([, a], [, b]) => ((a.move ?? a.split)!.t ?? 0) - ((b.move ?? b.split)!.t ?? 0));
  const added = all.filter(([, e]) => e.opening);
  const changed = all.filter(([, e]) => e.slide || e.width || e.kind || e.removed || e.sill_mm != null || e.height_mm || e.name);
  if (!ops.length && !added.length && !changed.length) return plan;
  return {
    ...plan,
    floors: plan.floors.map((f0) => {
      let f = f0;
      for (const [id, e] of ops) {
        if (e.move) {
          const r = f.rooms.find((x) => x.id === e.move!.room_id);
          const s = r ? sideNear(f, r, e.move.heading, e.move.at) : null;
          if (s) f = moveSide(f, s, e.move.by);
        } else {
          const r = f.rooms.find((x) => x.id === id);
          if (r) f = splitRoom(f, r, e.split!);
        }
      }
      const fresh = added.filter(([, e]) => e.opening!.floor_id === f.id).map(([id, e]) => addedOpening(id, e.opening!, f)).filter((o): o is Opening => !!o);
      const openings = [...f.openings, ...fresh]
        .filter((o) => !edits[o.id]?.removed)
        .map((o) => (edits[o.id] ? editOpening(o, edits[o.id], edits[o.id].slide || edits[o.id].width ? runOf(f, o) : null) : o));
      return f === f0 && !fresh.length && openings.length === f0.openings.length && openings.every((o, i) => o === f0.openings[i]) ? f0 : relist({ ...f, openings });
    }),
  };
}

/** A new door or window where a wall was clicked, at the standard size. Returns the id to save it
 *  under and the edit; null when there is no wall there or it's too short. */
export function newOpening(f: Floor, p: Pt, kind: string, width?: number): { id: string; edit: ElementEdit; exterior: boolean } | null {
  const hit = sideAt(f, p);
  if (!hit) return null;
  const d = wallDepth(f, hit.side, hit.along);
  const exterior = !across(f, hit.side, hit.along, d.out);
  const w = width ?? standardWidth(kind, exterior);
  if (hit.side.length < Math.min(w, 600) + 100) return null;
  const at = add(hit.side.a, dirOf(hit.side), hit.along);
  const prefix = kind === "window" ? "WN" : kind === "opening" ? "OP" : "D";
  const id = `${f.id}-${prefix}-${Date.now().toString(36)}`;
  return {
    id, exterior,
    edit: { opening: { floor_id: f.id, room_id: hit.room.id, heading: hit.side.heading, kind, at: [r10(at[0]), r10(at[1])], width: w, ...(kind === "window" ? { sill_mm: WIN.sill, height_mm: WIN.height } : {}) } },
  };
}

/** Where a room would be cut: straight across its longer way, through the middle, on a 10 mm grid. */
export function splitGuess(r: Room): { axis: "x" | "y"; at: number } {
  const b = bboxOf(r.polygon);
  return b[2] - b[0] >= b[3] - b[1] ? { axis: "x", at: r10((b[0] + b[2]) / 2) } : { axis: "y", at: r10((b[1] + b[3]) / 2) };
}

/** The side of a room a wall move was saved for, as the plan stands now: an existing move of that
 *  side (so nudges add up under one key), or a new key. */
export function moveFor(edits: Record<string, ElementEdit>, f: Floor, roomId: string, side: WallSide): { key: string; edit: ElementEdit | null } {
  const o: Pt = [-side.inward[0], -side.inward[1]], u = dirOf(side);
  for (const [key, e] of Object.entries(edits)) {
    const m = e.move;
    if (!m || m.room_id !== roomId || m.heading !== side.heading || !f.rooms.some((r) => r.id === roomId)) continue;
    // where that move left the side: its drawn point pushed out by `by`
    const p = add(m.at, o, m.by), s = dot(sub(p, side.a), u);
    if (s >= -10 && s <= side.length + 10 && Math.abs(dot(sub(p, side.a), o)) < 30) return { key, edit: e };
  }
  return { key: `${roomId}~${side.heading}~${Date.now().toString(36)}`, edit: null };
}

/** A point in the middle of a side, where a move of it is saved from. */
export const sideMid = (s: WallSide): [number, number] => [r10((s.a[0] + s.b[0]) / 2), r10((s.a[1] + s.b[1]) / 2)];
