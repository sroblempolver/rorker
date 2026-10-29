// Putting cabinets on walls, the way a kitchen designer does: a cabinet clicked near a wall backs onto the
// wall's inside face (not the middle of the wall the room outline runs along) and lines up edge to edge
// with the cabinets beside it, and "Fill this wall with cabinets" lays out a whole run between the
// corners, doors, windows and appliances: the widest even stock widths, a sink base under the window,
// fillers at the walls, wall cabinets above but none over a window or the range, a cabinet over the fridge.
// A wall can be filled as a plain run, a stove wall (a range in the middle with drawer bases either side
// and a hood over it) or a sink wall (a sink base under the window with the dishwasher beside it). Any
// range or cooktop put in gets a hood above it, as the mechanical code expects.
import type { Pt } from "./types";
import type { Side, SketchFixture, SketchFloor } from "./sketch";
import { doorSpot, edgesOf, outsidePieces, pointInPoly, sameLine, windowSpots, type Seg } from "./sketchEdit";
import { CATALOG, bottomOf, topOf } from "./catalog";
import { RULES } from "./rules";
import { std } from "./standards";
import { INCH, fmtLen } from "./units";
import { bottomFor, cabCode, defaultConfig, defaults, famOf, newSpec, wallTop, type CabFamily, type CabSpec } from "./cabinets";


/** Things that aren't cabinets but go in a cabinet run or a bathroom, at US sizes from the standards. */
export interface PlainItem { id: string; label: string; kind: string; group: "Appliances" | "Bath"; widths: number[]; size: () => { w: number; d: number; h: number; z: number } }
const I = (n: number) => n * INCH;
export const PLAIN: PlainItem[] = [
  { id: "range", label: "Range", kind: "range", group: "Appliances", widths: [30, 36], size: () => ({ w: std("cab.range.width"), d: std("cab.base.depth") + I(1), h: std("cab.base.height") + std("cab.counter.thick"), z: 0 }) },
  { id: "dishwasher", label: "Dishwasher", kind: "dishwasher", group: "Appliances", widths: [18, 24], size: () => ({ w: std("cab.dw.width"), d: std("cab.base.depth"), h: std("cab.base.height"), z: 0 }) },
  { id: "fridge", label: "Fridge", kind: "fridge", group: "Appliances", widths: [30, 33, 36], size: () => ({ w: std("cab.fridge.width"), d: std("cab.fridge.depth"), h: std("cab.fridge.height"), z: 0 }) },
  { id: "cooktop_base", label: "Cooktop over a base", kind: "cooktop", group: "Appliances", widths: [30, 36], size: () => ({ w: std("cab.range.width"), d: std("cab.base.depth"), h: std("cab.base.height") + std("cab.counter.thick"), z: 0 }) },
  { id: "oven_base", label: "Oven under the counter", kind: "oven", group: "Appliances", widths: [30], size: () => ({ w: std("cab.range.width"), d: std("cab.base.depth"), h: std("cab.base.height"), z: 0 }) },
  { id: "range_hood", label: "Range hood", kind: "range_hood", group: "Appliances", widths: [30, 36], size: () => ({ w: std("cab.range.width"), d: I(20), h: I(18), z: std("cab.hood.bottom") }) },
  { id: "toilet", label: "Toilet", kind: "toilet", group: "Bath", widths: [], size: () => ({ w: std("bath.toilet.width"), d: std("bath.toilet.depth"), h: I(30), z: 0 }) },
  { id: "bathtub", label: "Bathtub", kind: "bathtub", group: "Bath", widths: [60, 66, 72], size: () => ({ w: std("bath.tub.length"), d: std("bath.tub.width"), h: std("bath.tub.height"), z: 0 }) },
  { id: "shower", label: "Shower", kind: "shower", group: "Bath", widths: [32, 36, 42, 48, 60], size: () => ({ w: std("bath.shower.width"), d: std("bath.shower.depth"), h: I(80), z: 0 }) },
];
export const plainOf = (id: string) => PLAIN.find((p) => p.id === id) ?? null;

/** What a click puts down: a cabinet family (or an appliance / bath fixture) at a size picked in the
 *  catalogue tray, or, with the Cabinets tool, a whole wall filled. */
export interface CabPick { item: string; w?: number; d?: number; h?: number; config?: string; hinge?: "L" | "R"; mode: "place" | "fill"; fillBase: boolean; fillWall: boolean; fillKind?: FillKind }
export const DEFAULT_PICK: CabPick = { item: "base", mode: "fill", fillBase: true, fillWall: true, fillKind: "regular" };
/** What a wall is filled as: plain cabinets, a range wall, or a sink wall. */
export type FillKind = "regular" | "stove" | "sink";
export const FILL_KINDS: { id: FillKind; label: string; hint: string }[] = [
  { id: "regular", label: "Regular wall", hint: "Base and wall cabinets corner to corner" },
  { id: "stove", label: "Stove wall", hint: "A range in the middle, drawers either side, a hood above" },
  { id: "sink", label: "Sink wall", hint: "A sink base under the window, the dishwasher beside it" },
];
const COOK = new Set(["range", "cooktop"]);

/** One wall of a room seen from inside: x runs left to right along the room outline's edge (as in the
 *  wall view), the run between the inside corners is [s0, s1], and the inside face is `t/2` in from it. */
export interface Face { ri: number; edge: number; A: Pt; u: Pt; n: Pt; L: number; t: number; s0: number; s1: number; facing: Side }

const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];

/** How thick the wall along a room's edge is, as the plan builds it (sketch.ts): a wall piece drawn on
 *  that line sets its own thickness, else the company's inside or outside wall. The room outline runs
 *  down the middle of each wall. */
function thick(f: SketchFloor, ri: number, s: Seg): number {
  const mid: Pt = [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2];
  const within = (o: Seg) => Math.min(o[0][0], o[1][0]) - 1 <= mid[0] && mid[0] <= Math.max(o[0][0], o[1][0]) + 1 && Math.min(o[0][1], o[1][1]) - 1 <= mid[1] && mid[1] <= Math.max(o[0][1], o[1][1]) + 1;
  const piece = (f.walls ?? []).find((w) => w.thickness_mm && sameLine([w.a, w.b], s) && within([w.a, w.b]));
  if (piece) return piece.thickness_mm!;
  return outsidePieces(f, ri).some((o) => sameLine(o, s) && within(o)) ? std("wall.exterior") : std("wall.interior");
}

/** A room's wall as seen standing in the room, with its inside corners. Null for a slanted wall. */
export function faceOf(f: SketchFloor, ri: number, edge: number): Face | null {
  const poly = f.rooms[ri]?.polygon;
  if (!poly) return null;
  const es = edgesOf(poly), s = es[edge];
  if (!s) return null;
  if (Math.abs(s[0][0] - s[1][0]) > 1 && Math.abs(s[0][1] - s[1][1]) > 1) return null;
  const L = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) || 1;
  let ux = (s[1][0] - s[0][0]) / L, uy = (s[1][1] - s[0][1]) / L;
  const mid: Pt = [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2];
  // into the room, then left to right as you face the wall (your right hand, y down the page)
  let n: Pt = [-uy, ux];
  if (!pointInPoly([mid[0] + n[0] * 30, mid[1] + n[1] * 30], poly)) n = [uy, -ux];
  const right: Pt = [n[1], -n[0]];
  const flip = ux * right[0] + uy * right[1] < 0;
  const A = flip ? s[1] : s[0], B = flip ? s[0] : s[1];
  [ux, uy] = right;
  const k = es.length, prev = es[(edge - 1 + k) % k], next = es[(edge + 1) % k];
  const [atA, atB] = flip ? [next, prev] : [prev, next];
  // the wall meeting this one at a corner: in a normal corner it eats into the run, round an outside corner the run goes past
  const end = (adj: Seg, p: Pt) => {
    const other = Math.hypot(adj[0][0] - p[0], adj[0][1] - p[1]) < 1 ? adj[1] : adj[0];
    const into = dot(sub(other, p), n) > 0 ? 1 : -1;
    return (into * thick(f, ri, adj)) / 2;
  };
  const t = thick(f, ri, s);
  const facing: Side = Math.abs(n[0]) > Math.abs(n[1]) ? (n[0] > 0 ? "east" : "west") : n[1] > 0 ? "south" : "north";
  return { ri, edge, A, u: [ux, uy], n, L, t, s0: end(atA, A), s1: L - end(atB, B), facing };
}

/** The wall a point is nearest to, inside the room it's in, when it's within `reach` of the wall's face. */
export function faceNear(f: SketchFloor, p: Pt, reach: number): Face | null {
  const rooms = f.rooms.map((r, i) => i).filter((i) => pointInPoly(p, f.rooms[i].polygon));
  let best: { face: Face; d: number } | null = null;
  for (const ri of rooms) {
    edgesOf(f.rooms[ri].polygon).forEach((_, e) => {
      const fc = faceOf(f, ri, e);
      if (!fc) return;
      const x = dot(sub(p, fc.A), fc.u), off = dot(sub(p, fc.A), fc.n) - fc.t / 2;
      if (x < fc.s0 - 300 || x > fc.s1 + 300 || off > reach || off < -fc.t) return;
      if (!best || off < best.d) best = { face: fc, d: off };
    });
  }
  return best ? (best as { face: Face }).face : null;
}

const inZone = (b0: number, t0: number, b1: number, t1: number) => b0 < t1 - 5 && b1 < t0 - 5;
type OnFace = { i: number; x0: number; x1: number; bottom: number; top: number; f: SketchFixture };

/** The things standing against a wall's face: their spans along it and how high they are. */
export function onFace(f: SketchFloor, fc: Face): OnFace[] {
  const room = f.rooms[fc.ri].name.toLowerCase();
  return (f.fixtures ?? []).flatMap((x, i): OnFace[] => {
    if (x.room && x.room.toLowerCase() !== room) return [];
    if (CATALOG[x.kind]?.mount === "ceiling") return [];
    // its back is on this wall only when it faces away from it (a corner cabinet's side touches the other wall)
    if (x.facing && x.facing !== fc.facing) return [];
    const back = !x.facing || x.facing === fc.facing;
    const w = (back ? x.width_mm : x.depth_mm) ?? 600, d = (back ? x.depth_mm : x.width_mm) ?? 600;
    const cx = dot(sub(x.center, fc.A), fc.u), off = dot(sub(x.center, fc.A), fc.n) - fc.t / 2 - d / 2;
    if (Math.abs(off) > 120 || cx < fc.s0 - 50 || cx > fc.s1 + 50) return [];
    return [{ i, x0: cx - w / 2, x1: cx + w / 2, bottom: bottomOf(x), top: topOf(x), f: x }];
  });
}

/** A fixture centred `x` along the face, its back on the face. */
export function fixtureAt(f: SketchFloor, fc: Face, x: number, size: { w: number; d: number; h: number; z: number }, kind: string, name: string, cab?: CabSpec): SketchFixture {
  const k = fc.t / 2 + size.d / 2;
  const c: Pt = [Math.round(fc.A[0] + fc.u[0] * x + fc.n[0] * k), Math.round(fc.A[1] + fc.u[1] * x + fc.n[1] * k)];
  return { kind, name, room: f.rooms[fc.ri].name, center: c, width_mm: Math.round(size.w * 10) / 10, depth_mm: Math.round(size.d * 10) / 10, height_mm: Math.round(size.h * 10) / 10, facing: fc.facing, ...(size.z > 0 ? { elevation_mm: Math.round(size.z) } : {}), ...(cab ? { cab } : {}) };
}

/** A hood over the range or cooktop at `i`, as wide as it, when there isn't one over it yet. */
export function addHood(f: SketchFloor, i: number): { floor: SketchFloor; added: boolean } {
  const x = f.fixtures?.[i];
  if (!x || !COOK.has(x.kind)) return { floor: f, added: false };
  const near = (f.fixtures ?? []).some((o) => o.kind === "range_hood" && Math.hypot(o.center[0] - x.center[0], o.center[1] - x.center[1]) < Math.max(x.width_mm ?? 600, x.depth_mm ?? 600));
  if (near) return { floor: f, added: false };
  const fc = faceNear(f, x.center, (x.depth_mm ?? 600) + 300);
  const hood = plainOf("range_hood")!.size();
  const w = x.width_mm ?? hood.w;
  if (!fc) return { floor: { ...f, fixtures: [...(f.fixtures ?? []), { kind: "range_hood", name: "Range hood", room: x.room, center: x.center, width_mm: w, depth_mm: hood.d, height_mm: hood.h, facing: x.facing ?? null, elevation_mm: Math.round(hood.z) }] }, added: true };
  const at = dot(sub(x.center, fc.A), fc.u);
  return { floor: { ...f, fixtures: [...(f.fixtures ?? []), fixtureAt(f, fc, at, { ...hood, w }, "range_hood", "Range hood")] }, added: true };
}

/** Things on the other walls (round a corner) that reach into the strip `depth` deep in front of this
 *  face at heights [zb, zt]: their spans along it. */
export function crossBlocks(f: SketchFloor, fc: Face, zb: number, zt: number, depth: number, skip: Set<number>): { x0: number; x1: number }[] {
  const room = f.rooms[fc.ri].name.toLowerCase();
  return (f.fixtures ?? []).flatMap((x, i) => {
    if (skip.has(i) || (x.room && x.room.toLowerCase() !== room) || !inZone(zb, zt, bottomOf(x), topOf(x)) || CATALOG[x.kind]?.mount === "ceiling") return [];
    const across = x.facing === "east" || x.facing === "west", hw = ((across ? x.depth_mm : x.width_mm) ?? 600) / 2, hd = ((across ? x.width_mm : x.depth_mm) ?? 600) / 2;
    const pts: Pt[] = [[x.center[0] - hw, x.center[1] - hd], [x.center[0] + hw, x.center[1] + hd]];
    const xs = pts.map((q) => dot(sub(q, fc.A), fc.u)), os = pts.map((q) => dot(sub(q, fc.A), fc.n) - fc.t / 2);
    const b = { x0: Math.min(...xs), x1: Math.max(...xs) };
    return Math.max(...os) > 5 && Math.min(...os) < depth - 5 && b.x1 > fc.s0 && b.x0 < fc.s1 ? [b] : [];
  });
}

/** Where along the face a thing of width `w` goes when put at `x`: snapped edge to edge with its
 *  neighbours at its height (or the inside corners) within `tol`, and never overlapping one. */
export function slot(f: SketchFloor, fc: Face, x: number, w: number, z: number, h: number, skip = -1, tol = 6 * INCH, depth = 600): number {
  const on = onFace(f, fc);
  const others: { x0: number; x1: number }[] = [...on.filter((o) => o.i !== skip && inZone(z, z + h, o.bottom, o.top)),
    // and what stands in the corner on the next wall
    ...crossBlocks(f, fc, z, z + h, depth, new Set([skip, ...on.map((o) => o.i)]))];
  let best = x, d = tol;
  const lefts = [fc.s0, ...others.map((o) => o.x1)], rights = [fc.s1, ...others.map((o) => o.x0)];
  for (const l of lefts) if (Math.abs(x - w / 2 - l) < d) { d = Math.abs(x - w / 2 - l); best = l + w / 2; }
  for (const r of rights) if (Math.abs(x + w / 2 - r) < d) { d = Math.abs(x + w / 2 - r); best = r - w / 2; }
  // off anything it lands on: to whichever side is nearer
  for (let k = 0; k < 4; k++) {
    const hit = others.find((o) => best + w / 2 > o.x0 + 1 && best - w / 2 < o.x1 - 1);
    if (!hit) break;
    // only to a side it fits on, between the corners
    const sides = [hit.x0 - w / 2, hit.x1 + w / 2], fits = sides.filter((c) => c - w / 2 >= fc.s0 - 1 && c + w / 2 <= fc.s1 + 1);
    const cur = best;
    best = (fits.length ? fits : sides).reduce((a, b) => (Math.abs(a - cur) <= Math.abs(b - cur) ? a : b));
  }
  if (fc.s1 - fc.s0 >= w) best = Math.min(fc.s1 - w / 2, Math.max(fc.s0 + w / 2, best));
  return best;
}

/** The free stretch of the face around `x` at heights [z, z + h]: between the inside corners and whatever
 *  stands there (on this wall, or round the corner on the next). Null when `x` itself is taken. */
export function freeSpan(f: SketchFloor, fc: Face, x: number, z: number, h: number, skip = -1, depth = 600): { lo: number; hi: number } | null {
  const on = onFace(f, fc);
  const others = [...on.filter((o) => o.i !== skip && inZone(z, z + h, o.bottom, o.top)), ...crossBlocks(f, fc, z, z + h, depth, new Set([skip, ...on.map((o) => o.i)]))];
  if (others.some((o) => x > o.x0 + 1 && x < o.x1 - 1)) return null;
  const lo = Math.max(fc.s0, ...others.filter((o) => o.x1 <= x + 1).map((o) => o.x1));
  const hi = Math.min(fc.s1, ...others.filter((o) => o.x0 >= x - 1).map((o) => o.x0));
  return hi > lo ? { lo, hi } : null;
}

/** Where a thing `w` wide goes on the face near `x`: snapped edge to edge with its neighbours and kept
 *  off them, or, when the free stretch there is narrower than it, how wide that stretch is (it isn't
 *  squeezed in or pushed somewhere else). */
export function fitOnFace(f: SketchFloor, fc: Face, x: number, w: number, z: number, h: number, skip = -1, depth = 600): { x: number } | { room: number; lo: number } {
  const sx = slot(f, fc, x, w, z, h, skip, 6 * INCH, depth);
  const span = freeSpan(f, fc, sx, z, h, skip, depth) ?? freeSpan(f, fc, x, z, h, skip, depth);
  if (span && span.hi - span.lo >= w - 0.5) return { x: Math.min(span.hi - w / 2, Math.max(span.lo + w / 2, sx)) };
  const near = freeSpan(f, fc, x, z, h, skip, depth);
  return near ? { room: near.hi - near.lo, lo: near.lo } : { room: 0, lo: x };
}

/** What a placement that doesn't fit offers: the biggest stock width that fits (with the gap left for a
 *  filler), or the cabinet cut down to the stretch exactly. Each is applied only when picked. */
export interface FitAsk { text: string; options: { label: string; floor: SketchFloor; sel: number }[] }

/** Put the pick on face `fc` at `x` (and, for something that hangs, as high as `mid` says). */
export function placeOnFace(f: SketchFloor, fc: Face, x: number, pick: CabPick, mid?: number): { floor?: SketchFloor; sel?: number; note?: string; ask?: FitAsk } {
  const { size, kind, name, cab } = pickSize(pick);
  // something that hangs goes where it was let go (`mid` its middle off the floor), at its usual height when near it
  const hangs = cab ? famOf(cab.fam).zone === "wall" : size.z > 0;
  const want = mid != null ? mid - size.h / 2 : size.z;
  const z = hangs && Math.abs(want - size.z) > 6 * INCH ? Math.max(0, Math.round(want)) : size.z;
  const s = { ...size, z };
  const list = f.fixtures ?? [];
  const put = (w: number, at: number, c?: CabSpec, nm = name) => {
    const fx = fixtureAt(f, fc, at, { ...s, w }, kind, nm, c);
    const h = addHood({ ...f, fixtures: [...list, fx] }, list.length);
    return { floor: h.floor, sel: list.length, ...(h.added ? { note: `${nm} in, with a hood above it (the code wants one over a range or cooktop).` } : {}) };
  };
  const fit = fitOnFace(f, fc, x, s.w, s.z, s.h, -1, s.d);
  if ("x" in fit) return put(s.w, fit.x, cab);
  if (fit.room < 3 * INCH) return { note: `There's no room for the ${name} there. Move or take out what's in the way first.` };
  // offer smaller: the widest stock width that fits, and the exact width of the gap
  const options: FitAsk["options"] = [];
  const stock = cab ? famOf(cab.fam).widths.map((v) => v * INCH).filter((v) => v <= fit.room + 0.5).sort((a, b) => b - a)[0] : undefined;
  const label = (w: number, c?: CabSpec) => (c ? `${cabCode(c, w, s.d, s.h)} ${famOf(c.fam).label.toLowerCase()}` : name);
  const exact = !!stock && Math.abs(stock - fit.room) <= 0.5;
  if (cab && stock) { const c: CabSpec = { ...cab, config: defaultConfig(cab.fam, stock) }; options.push({ label: exact ? `Use a ${cabCode(c, stock, s.d, s.h)} (fits exactly)` : `Use a stock ${cabCode(c, stock, s.d, s.h)} (${fmtLen(stock, "ft", true)}) and a filler`, ...put(stock, fit.lo + stock / 2, c, label(stock, c)) }); }
  if (!exact) {
    const c2: CabSpec | undefined = cab ? { ...cab, config: defaultConfig(cab.fam, fit.room) } : undefined;
    options.push({ label: `Shrink it to ${fmtLen(fit.room, "ft", true)}${cab ? " (made to order)" : ""}`, ...put(fit.room, fit.lo + fit.room / 2, c2, label(fit.room, c2)) });
  }
  return { ask: { text: `The ${name} is ${fmtLen(s.w, "ft", true)} wide, but there's only ${fmtLen(fit.room, "ft", true)} free there.`, options } };
}

/** The size, kind and name of what the pick puts down. */
export function pickSize(pick: CabPick) {
  const plain = plainOf(pick.item);
  if (plain) {
    const s = plain.size();
    return { size: { ...s, w: pick.w ?? s.w, d: pick.d ?? s.d, h: pick.h ?? s.h }, kind: plain.kind, name: plain.label, cab: undefined as CabSpec | undefined };
  }
  const fam = pick.item as CabFamily, F = famOf(fam), def = defaults(fam);
  const w = pick.w ?? def.w, h = pick.h ?? def.h;
  const cab: CabSpec = { ...newSpec(fam, w), ...(pick.config && F.configs.includes(pick.config) ? { config: pick.config } : {}), ...(pick.hinge ? { hinge: pick.hinge } : {}) };
  const z = F.zone === "wall" ? bottomFor(fam, h) : 0;
  return { size: { w, d: def.d, h, z }, kind: F.kind, name: `${cabCode(cab, w, def.d, h)} ${F.label.toLowerCase()}`, cab };
}

/** A click with the Cabinets tool: put the picked cabinet against the nearest wall, or fill that wall. */
export function cabinetClick(f: SketchFloor, p: Pt, pick: CabPick): { floor?: SketchFloor; sel?: number; note?: string; ask?: FitAsk } {
  if (pick.mode === "fill") {
    const fc = faceNear(f, p, 900);
    if (!fc) return { note: "Click inside the kitchen, close to the wall you want filled." };
    return fillWall(f, fc.ri, fc.edge, { base: pick.fillBase, wall: pick.fillWall, kind: pick.fillKind ?? "regular" });
  }
  const { size } = pickSize(pick);
  const fc = faceNear(f, p, Math.max(900, size.d + 600));
  if (!fc) return { note: "Click inside a room, near the wall it goes on. It backs onto the wall and lines up with the cabinets beside it." };
  return placeOnFace(f, fc, dot(sub(p, fc.A), fc.u), pick);
}

/** A cabinet (or appliance) dragged to `c`: along the nearest wall, snapping to its neighbours. Null when
 *  it's away from any wall. */
export function slideCabinet(f: SketchFloor, i: number, c: Pt): SketchFixture | null {
  const x0 = f.fixtures?.[i];
  if (!x0) return null;
  const d = (x0.depth_mm ?? 600), w = x0.width_mm ?? 600;
  const fc = faceNear(f, c, d + 450);
  if (!fc) return null;
  const z = bottomOf(x0), h = topOf(x0) - z;
  const fit = fitOnFace(f, fc, dot(sub(c, fc.A), fc.u), w, z, h, i, d);
  // no room where it's being dragged: it stays where it was rather than going through a neighbour
  if (!("x" in fit)) return x0;
  const x = fit.x;
  const k = fc.t / 2 + d / 2;
  return { ...x0, facing: fc.facing, room: f.rooms[fc.ri].name, center: [Math.round(fc.A[0] + fc.u[0] * x + fc.n[0] * k), Math.round(fc.A[1] + fc.u[1] * x + fc.n[1] * k)] };
}

/** A cabinet resized: its back stays on the wall and its left end (seen from the room) stays put. */
export function resized(x: SketchFixture, ch: { w?: number; d?: number; h?: number }): SketchFixture {
  const n: Pt = x.facing === "north" ? [0, -1] : x.facing === "south" ? [0, 1] : x.facing === "east" ? [1, 0] : x.facing === "west" ? [-1, 0] : [0, 0];
  const right: Pt = [n[1], -n[0]];
  const w0 = x.width_mm ?? 600, d0 = x.depth_mm ?? 600;
  const dw = (ch.w ?? w0) - w0, dd = (ch.d ?? d0) - d0;
  const c: Pt = [Math.round(x.center[0] + right[0] * dw / 2 + n[0] * dd / 2), Math.round(x.center[1] + right[1] * dw / 2 + n[1] * dd / 2)];
  return { ...x, center: c, ...(ch.w != null ? { width_mm: ch.w } : {}), ...(ch.d != null ? { depth_mm: ch.d } : {}), ...(ch.h != null ? { height_mm: ch.h } : {}) };
}

// ----- filling a wall -----

const REFILL = new Set<CabFamily>(["base", "drawer", "sink", "filler_base", "wall", "wall_end", "fridge_wall", "filler_wall"]);

/** Stock widths for a stretch: as few cabinets as fit, as even as the width steps allow, each no wider
 *  than the fill maximum. What's left over goes to fillers. */
export function splitRun(len: number, min = I(9)): number[] {
  const stepW = Math.max(I(1), std("cab.width.step")), maxW = Math.max(min, std("cab.fill.max"));
  if (len < min) return [];
  let n = Math.ceil(len / maxW - 1e-6);
  let w = Math.floor(len / n / stepW) * stepW;
  while (w < min && n > 1) { n--; w = Math.floor(len / n / stepW) * stepW; }
  w = Math.min(maxW, Math.max(min, w));
  const out = Array(n).fill(w);
  // spread the spare width in whole steps from the middle out
  let spare = len - w * n;
  for (let k = 0; spare >= stepW - 0.01 && k < n; k++) { const j = Math.floor(n / 2) + (k % 2 ? -Math.ceil(k / 2) : Math.ceil(k / 2)); if (j < 0 || j >= n || out[j] + stepW > maxW + 0.01) continue; out[j] += stepW; spare -= stepW; }
  return out;
}

type Block = { x0: number; x1: number };
/** The stretches of [lo, hi] not covered by any block. */
function gaps(lo: number, hi: number, blocks: Block[]): Block[] {
  const out: Block[] = [];
  let cur = lo;
  for (const b of [...blocks].sort((a, c) => a.x0 - c.x0)) {
    if (b.x1 <= cur) continue;
    if (b.x0 > cur) out.push({ x0: cur, x1: Math.min(b.x0, hi) });
    cur = Math.max(cur, b.x1);
    if (cur >= hi) break;
  }
  if (cur < hi) out.push({ x0: cur, x1: hi });
  return out.filter((g) => g.x1 - g.x0 > 3);
}

/**
 * Fill a room's wall with stock cabinets (KCD-style): base cabinets along the run, wall cabinets above
 * when asked. Doors, windows (by their height), appliances, tall cabinets and corner cabinets already
 * there are kept and worked around; base and wall cabinets that were there are replaced.
 */
export function fillWall(f: SketchFloor, ri: number, edge: number, opt: { base: boolean; wall: boolean; kind?: FillKind }): { floor?: SketchFloor; note?: string } {
  const kind = opt.kind ?? "regular";
  const fc = faceOf(f, ri, edge);
  if (!fc) return { note: "Cabinets go on straight, square walls. This one is on a slant." };
  if (!opt.base && !opt.wall) return { note: "Tick base cabinets, wall cabinets or both." };
  const room = f.rooms[ri];
  const on = (s: Seg | null) => !!s && sameLine(s, [fc.A, [fc.A[0] + fc.u[0] * fc.L, fc.A[1] + fc.u[1] * fc.L]]);
  const span = (s: Seg): Block => { const a = dot(sub(s[0], fc.A), fc.u), b = dot(sub(s[1], fc.A), fc.u); return { x0: Math.min(a, b), x1: Math.max(a, b) }; };
  const baseTop = std("cab.base.height") + std("cab.counter.thick"), wb = std("cab.wall.bottom"), wt = wallTop();
  const kitchen = room.type === "kitchen" || /kitchen/i.test(room.name);
  const defSill = kitchen ? RULES.sillKitchen : RULES.sill;

  // what's on this wall now
  const here = onFace(f, fc);
  const replace = new Set(here.filter((o) => o.f.cab && REFILL.has(o.f.cab.fam) && ((opt.base && famOf(o.f.cab.fam).zone === "base") || (opt.wall && famOf(o.f.cab.fam).zone === "wall"))).map((o) => o.i));
  const kept = here.filter((o) => !replace.has(o.i));
  // cabinets on the wall round the corner reach into this run: it stops at their fronts
  const hereIds = new Set(here.map((o) => o.i));
  const corner = (zb: number, zt: number, depth: number): Block[] => crossBlocks(f, fc, zb, zt, depth, hereIds);
  const cornerB = corner(0, baseTop - 10, std("cab.base.depth")), cornerW = corner(wb + 10, wt - 10, std("cab.wall.depth"));
  const doors = (f.doors ?? []).map((d) => doorSpot(f, d)).filter(on).map((s) => span(s!));
  const windows = (f.windows ?? []).flatMap((w) => windowSpots(f, w).filter((s) => on(s)).map((s) => ({ ...span(s), sill: w.sill_mm ?? defSill, head: (w.sill_mm ?? defSill) + (w.height_mm ?? 1200) })));

  const add: SketchFixture[] = [];
  const names: string[] = [];
  let fillers = 0;
  const make = (x0: number, w: number, fam: CabFamily, h?: number) => {
    const def = defaults(fam), hh = h ?? def.h, cab = newSpec(fam, w);
    cab.config = defaultConfig(fam, w);
    const z = famOf(fam).zone === "wall" ? bottomFor(fam, hh) : 0;
    return { fx: fixtureAt(f, fc, x0 + w / 2, { w, d: def.d, h: hh, z }, famOf(fam).kind, `${cabCode(cab, w, def.d, hh)} ${famOf(fam).label.toLowerCase()}`, cab), code: cabCode(cab, w, def.d, hh) };
  };
  const put = (x0: number, w: number, fam: CabFamily, h?: number) => {
    const { fx, code } = make(x0, w, fam, h);
    add.push(fx);
    if (fam.startsWith("filler")) fillers++; else names.push(code);
  };
  /** an appliance with its left end at x0 */
  const appliance = (x0: number, id: string) => {
    const it = plainOf(id)!, size = it.size();
    add.push(fixtureAt(f, fc, x0 + size.w / 2, size, it.kind, it.label));
    names.push(it.label.toLowerCase());
    return { x0, x1: x0 + size.w };
  };
  const stepW = std("cab.width.step"), fe = std("cab.filler.end");
  /** where a thing `w` wide goes in gap g near `c`, leaving a filler at a wall and whole steps either side */
  const placeIn = (g: Block, w: number, c: number) => {
    const lf = Math.abs(g.x0 - fc.s0) < 2 ? fe : 0, rf = Math.abs(g.x1 - fc.s1) < 2 ? fe : 0;
    const x0 = Math.min(g.x1 - w - rf, Math.max(g.x0 + lf, c - w / 2));
    const snapped = g.x0 + lf + Math.round((x0 - g.x0 - lf) / stepW) * stepW;
    return Math.abs(snapped - x0) < stepW / 2 && snapped + w <= g.x1 - rf + 0.5 && snapped >= g.x0 ? snapped : x0;
  };
  const widest = (list: Block[]) => list.reduce<Block | null>((a, g) => (!a || g.x1 - g.x0 > a.x1 - a.x0 ? g : a), null);
  /** ranges and cooktops on this wall, kept or just put in: no wall cabinet over them, and a hood */
  const cooks: Block[] = [];
  let hoods = 0;
  /** Cabinets and fillers along one free stretch; fillers go where the stretch meets a wall. */
  const fillGap = (g: Block, fam: CabFamily, filler: CabFamily) => {
    const cb = fam === "wall" ? cornerW : cornerB;
    const atL = Math.abs(g.x0 - fc.s0) < 2 || cb.some((b) => Math.abs(b.x1 - g.x0) < 2), atR = Math.abs(g.x1 - fc.s1) < 2 || cb.some((b) => Math.abs(b.x0 - g.x1) < 2), fe = std("cab.filler.end");
    const reserve = (atL ? fe : 0) + (atR ? fe : 0);
    const widths = splitRun(g.x1 - g.x0 - reserve);
    const used = widths.reduce((a, b) => a + b, 0);
    const spare = g.x1 - g.x0 - used;
    let fl = 0, fr = 0;
    if (!widths.length) { if (spare >= I(1)) fl = spare; }
    else if (atL && atR) { fl = fr = spare / 2; }
    else if (atL) fl = spare; else if (atR) fr = spare;
    else if (spare >= I(1)) fr = spare;
    let x = g.x0;
    if (fl >= I(0.5)) { put(x, fl, filler); x += fl; } else x += fl;
    for (const w of widths) { put(x, w, fam); x += w; }
    if (fr >= I(0.5)) put(x, fr, filler);
  };

  if (opt.base) {
    const blocks: Block[] = [...doors, ...windows.filter((w) => w.sill < baseTop - 10), ...kept.filter((o) => o.bottom < baseTop - 10), ...cornerB];
    const hasSinkHere = kept.some((o) => o.f.kind === "kitchen_sink" || o.f.cab?.fam === "sink");
    const hasCookHere = kept.some((o) => COOK.has(o.f.kind));
    if (kind === "sink" && !hasSinkHere) {
      // the sink under the window (or in the middle of the longest stretch), the dishwasher beside it
      const sw = std("cab.sink.width"), dw = plainOf("dishwasher")!.size().w;
      const win = windows.find((w) => w.sill >= baseTop - 10);
      const free = gaps(fc.s0, fc.s1, blocks);
      const c0 = win ? (win.x0 + win.x1) / 2 : null;
      const g = (c0 != null && free.find((x) => x.x0 <= c0 && c0 <= x.x1 && x.x1 - x.x0 >= sw)) || widest(free.filter((x) => x.x1 - x.x0 >= sw));
      if (g) {
        const sx = placeIn(g, sw, c0 != null && g.x0 <= c0 && c0 <= g.x1 ? c0 : (g.x0 + g.x1) / 2);
        put(sx, sw, "sink");
        blocks.push({ x0: sx, x1: sx + sw });
        const rf = Math.abs(g.x1 - fc.s1) < 2 ? fe : 0, lf = Math.abs(g.x0 - fc.s0) < 2 ? fe : 0;
        if (g.x1 - rf - (sx + sw) >= dw) blocks.push(appliance(sx + sw, "dishwasher"));
        else if (sx - (g.x0 + lf) >= dw) blocks.push(appliance(sx - dw, "dishwasher"));
      }
    }
    if (kind === "stove" && !hasCookHere) {
      // the range in the middle of the longest stretch, with room for a cabinet either side
      const rw = plainOf("range")!.size().w;
      const g = widest(gaps(fc.s0, fc.s1, blocks).filter((x) => x.x1 - x.x0 >= rw));
      if (g) {
        const b = appliance(placeIn(g, rw, (g.x0 + g.x1) / 2), "range");
        blocks.push(b);
        cooks.push(b);
        add.push(fixtureAt(f, fc, (b.x0 + b.x1) / 2, { ...plainOf("range_hood")!.size(), w: rw }, "range_hood", "Range hood"));
        hoods++;
      }
    }
    const before = add.length;
    for (const g of gaps(fc.s0, fc.s1, blocks)) fillGap(g, "base", "filler_base");
    // on a stove wall the cabinets either side of the range are drawer bases, for pots and pans
    if (kind === "stove") {
      const cook = [...cooks, ...kept.filter((o) => COOK.has(o.f.kind))];
      for (let k = before; k < add.length; k++) {
        const x = add[k];
        if (x.cab?.fam !== "base") continue;
        const w = x.width_mm ?? 600, c = dot(sub(x.center, fc.A), fc.u), x0 = c - w / 2, x1 = c + w / 2;
        if (!cook.some((b) => Math.abs(b.x0 - x1) < 2 || Math.abs(b.x1 - x0) < 2) || !famOf("drawer").widths.some((v) => Math.abs(v * INCH - w) < 2)) continue;
        const m = make(x0, w, "drawer");
        add[k] = m.fx;
        const at = names.indexOf(cabCode(x.cab, w, x.depth_mm ?? 600, x.height_mm ?? 600));
        if (at >= 0) names[at] = m.code; else names.push(m.code);
      }
    }
  }
  if (opt.wall) {
    const blocks: Block[] = [...doors, ...windows.filter((w) => w.head > wb + 10 && w.sill < wt - 10), ...cornerW];
    for (const o of kept) {
      const k = o.f.kind;
      // over the range is the hood's; over the fridge a cabinet as deep as the fridge
      if (COOK.has(k)) { blocks.push(o); continue; }
      if (k === "fridge") {
        blocks.push(o);
        const room = wt - o.top - I(1), hs = famOf("fridge_wall").heights!.map(I).filter((h) => h <= room + 1);
        if (hs.length && !here.some((x) => x.f.cab?.fam === "fridge_wall" && !replace.has(x.i) && x.x0 < o.x1 && x.x1 > o.x0)) put(o.x0, o.x1 - o.x0, "fridge_wall", Math.max(...hs));
        continue;
      }
      if (inZone(wb, wt, o.bottom, o.top)) blocks.push(o);
    }
    blocks.push(...cooks);
    for (const g of gaps(fc.s0, fc.s1, blocks)) fillGap(g, "wall", "filler_wall");
  }
  if (!add.length) return { note: "There's no free stretch on this wall for cabinets (doors, windows and appliances take it up)." };
  let fixtures = [...(f.fixtures ?? []).filter((_, i) => !replace.has(i)), ...add];
  // a range or cooktop already on this wall with no hood gets one
  for (const o of kept) if (COOK.has(o.f.kind)) {
    const at = fixtures.indexOf(o.f), r = at >= 0 ? addHood({ ...f, fixtures }, at) : null;
    if (r?.added) { fixtures = r.floor.fixtures!; hoods++; }
  }
  const run = fmtLen(fc.s1 - fc.s0, "ft");
  const count = (list: string[]) => [...list.reduce((m, c) => m.set(c, (m.get(c) ?? 0) + 1), new Map<string, number>())].map(([c, k]) => (k > 1 ? `${c} ×${k}` : c)).join(", ");
  return { floor: { ...f, fixtures }, note: `Filled ${run} of the ${fc.facing === "south" ? "north" : fc.facing === "north" ? "south" : fc.facing === "east" ? "west" : "east"} wall: ${count(names)}${fillers ? `, and ${fillers} filler${fillers > 1 ? "s" : ""}` : ""}${hoods ? `, and a hood over the ${kind === "stove" ? "range" : "cooktop"}` : ""}.` };
}

/** Families and plain items in the order the Cabinets panel shows them. */
