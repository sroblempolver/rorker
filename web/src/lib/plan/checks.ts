// Real rules, as nudges. The checks read the drawing as it is and say in plain words what a building
// inspector or a kitchen designer would point at: a step that's too tall, a bedroom you can't climb out
// of, a toilet squeezed against the wall. They never stop anything: each one can be ignored right there,
// and every limit is one of the company's standards (US residential code values to start with), so the
// contractor decides what the rules are.
//
// Only what the sketch reliably says is checked. Left out on purpose, because the drawing doesn't know
// it: handrail heights and graspability, window types (so the clear opening of a window is taken as its
// size), whether a wall is really load-bearing (only a hint when a removed wall sat over another), smoke
// alarms, egress paths through other rooms, fire separation from a garage, and electrical clearances.
import type { Pt } from "./types";
import type { Sketch, SketchFloor, SketchFixture, SketchRoom } from "./sketch";
import { OUTSIDE, doorSpot, doorWidth, edgesOf, nearSeg, pointInPoly, roomArea, sharedEdge, windowSpots, type Seg } from "./sketchEdit";
import { centroid, edgeDistance } from "./geometry";
import { CATALOG } from "./catalog";
import { RULES } from "./rules";
import { defineStandards, std } from "./standards";
import { floorAbove, floorBelow, floorRise, stairGeom } from "./stairs";
import { fmtLen } from "./units";

const IN = 25.4;
defineStandards([
  { key: "check.room.minArea", group: "Rooms", label: "Smallest living room or bedroom", value: 70, unit: "sqft", help: "IRC R304.1: habitable rooms 70 ft² minimum (kitchens don't count)." },
  { key: "check.room.minDim", group: "Rooms", label: "Narrowest living room or bedroom", value: 84 * IN, unit: "len", help: "IRC R304.2: 7' 0\" minimum in any direction." },
  { key: "check.room.ceiling", group: "Rooms", label: "Lowest ceiling in living spaces", value: 84 * IN, unit: "len", help: "IRC R305.1: 7' 0\" minimum ceiling height." },
  { key: "check.room.hall", group: "Rooms", label: "Narrowest hallway", value: 36 * IN, unit: "len", help: "IRC R311.6: 3' 0\" minimum hallway width." },
  { key: "check.room.overhang", group: "Rooms", label: "Upstairs overhang past the wall below", value: 24 * IN, unit: "len", help: "A rough limit: floor joists hanging further than this past the wall below usually need an engineer or posts (IRC R502.3.3)." },
  { key: "check.room.guardHeight", group: "Rooms", label: "Guard height on balconies and stairwells", value: 36 * IN, unit: "len", help: "IRC R312.1.2: guards 36\" high minimum." },
  { key: "check.bed.escapeArea", group: "Bedrooms", label: "Escape window opening", value: 5.7, unit: "sqft", help: "IRC R310.2.1: 5.7 ft² net clear opening (5.0 ft² on a ground floor at grade)." },
  { key: "check.bed.escapeW", group: "Bedrooms", label: "Escape window clear width", value: 20 * IN, unit: "len", help: "IRC R310.2.1: 20\" minimum." },
  { key: "check.bed.escapeH", group: "Bedrooms", label: "Escape window clear height", value: 24 * IN, unit: "len", help: "IRC R310.2.1: 24\" minimum." },
  { key: "check.bed.escapeSill", group: "Bedrooms", label: "Highest escape window sill", value: 44 * IN, unit: "len", help: "IRC R310.2.2: 44\" maximum from the floor to the bottom of the opening." },
  { key: "check.bath.toiletSide", group: "Bathrooms", label: "Toilet centre to a side wall or fixture", value: 15 * IN, unit: "len", help: "IRC R307.1 (Figure R307.2): 15\" minimum." },
  { key: "check.bath.toiletFront", group: "Bathrooms", label: "Clear space in front of a toilet", value: 21 * IN, unit: "len", help: "IRC R307.1 (Figure R307.2): 21\" minimum." },
  { key: "check.kitchen.aisle", group: "Kitchens", label: "Aisle between counters", value: 42 * IN, unit: "len", help: "NKBA kitchen planning guideline: 42\" for one cook." },
  { key: "check.kitchen.aisleTwo", group: "Kitchens", label: "Aisle for two cooks", value: 48 * IN, unit: "len", help: "NKBA kitchen planning guideline: 48\" when two people cook." },
  { key: "check.door.clear", group: "Doors", label: "Clear width of the main door", value: 32 * IN, unit: "len", help: "IRC R311.2: 32\" clear, door open, between the door face and the stop." },
  { key: "check.door.loss", group: "Doors", label: "Width lost to the door and its stop", value: 2 * IN, unit: "len", help: "What a door's own thickness and stop take off its width: a 36\" door leaves about 34\" clear." },
]);

export type CheckEl = { t: "room" | "door" | "window" | "thing" | "stair"; i: number };
export interface Nudge {
  /** stable for the same problem on the same thing, so ignoring it sticks */
  id: string;
  /** index into sketch.floors */
  floor: number;
  severity: "warn" | "info";
  title: string; text: string;
  /** the standard the limit comes from, for "see the rule" */
  std?: string;
  at: Pt; el?: CheckEl;
}

const HABITABLE = new Set(["bedroom", "living", "dining", "family", "study", "office"]);
const OUTDOOR = new Set(["balcony", "porch", "terrace"]);
const COUNTER = new Set(["base_cabinet", "kitchen_sink", "range", "dishwasher", "island", "tall_cabinet", "fridge"]);
const FACE: Record<string, Pt> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

/** A length the way people say it: 7¾" or 44" under four feet, 6' 8" above. */
export function says(mm: number) {
  const q = Math.round((mm / IN) * 4) / 4;
  if (q >= 48) return fmtLen(mm, "ft");
  const whole = Math.floor(q), part = ["", "¼", "½", "¾"][Math.round((q - whole) * 4)];
  return `${whole || !part ? whole : ""}${part}"`;
}
const sqft = (m2: number) => m2 * 10.7639;
const typeOf = (r: SketchRoom) => (r.type ?? "other").toLowerCase();

/** A fixture's box on the plan: x0, y0, x1, y1 (width across its front, depth front to back). */
function boxOf(f: SketchFixture): [number, number, number, number] {
  const across = f.facing === "east" || f.facing === "west";
  const w = (across ? f.depth_mm : f.width_mm) ?? CATALOG[f.kind]?.w ?? 600, d = (across ? f.width_mm : f.depth_mm) ?? CATALOG[f.kind]?.d ?? 600;
  return [f.center[0] - w / 2, f.center[1] - d / 2, f.center[0] + w / 2, f.center[1] + d / 2];
}
const boxSegs = (b: [number, number, number, number]): Seg[] => edgesOf([[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]);

/** How far a ray goes before it hits one of the segments. */
function ray(o: Pt, d: Pt, segs: Seg[]): number {
  let best = Infinity;
  for (const [a, b] of segs) {
    const ex = b[0] - a[0], ey = b[1] - a[1], den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den, s = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / den;
    if (t > 0.5 && s >= -1e-6 && s <= 1 + 1e-6) best = Math.min(best, t);
  }
  return best;
}

/** The narrowest a room gets: across or along, the shortest wall-to-wall line through any spot in it. */
export function narrowest(poly: Pt[]): { w: number; at: Pt } {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const n = 14, segs = edgesOf(poly);
  let best = { w: Infinity, at: centroid(poly) };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p: Pt = [x0 + ((i + 0.5) / n) * (x1 - x0), y0 + ((j + 0.5) / n) * (y1 - y0)];
    if (!pointInPoly(p, poly)) continue;
    const h = ray(p, [1, 0], segs) + ray(p, [-1, 0], segs), v = ray(p, [0, 1], segs) + ray(p, [0, -1], segs);
    const w = Math.min(h, v);
    if (w < best.w) best = { w, at: p };
  }
  return best;
}

/** Spots spread over a room, for the overhang check. */
function spots(poly: Pt[], n = 16): Pt[] {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const p: Pt = [x0 + (i / n) * (x1 - x0), y0 + (j / n) * (y1 - y0)];
    if (pointInPoly(p, poly) || edgeDistance(p, poly) < 2) out.push(p);
  }
  return out;
}

/** The walls between two rooms of a floor. */
function insideWalls(f: SketchFloor): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < f.rooms.length; i++) for (let j = i + 1; j < f.rooms.length; j++) { const s = sharedEdge(f.rooms[i].polygon, f.rooms[j].polygon); if (s) out.push(s); }
  return out;
}
const mid = (s: Seg): Pt => [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2];
const r100 = (v: number) => Math.round(v / 100);

/**
 * Every check over the whole sketch. `before` is the drawing as it was when editing started, for the
 * walls that were taken out. Ignored ones (sketch.ignored_checks) are returned apart.
 */
export function runChecks(sk: Sketch, before?: Sketch | null): { open: Nudge[]; ignored: Nudge[] } {
  const all: Nudge[] = [];
  sk.floors.forEach((f, fi) => {
    const tag = `L${f.level}`;
    const add = (n: Omit<Nudge, "floor" | "id"> & { id: string }) => all.push({ ...n, id: `${tag}:${n.id}`, floor: fi });
    const roomIdx = (name?: string) => (name ? f.rooms.findIndex((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase()) : -1);
    const rise = floorRise(sk, f);

    // rooms
    f.rooms.forEach((r, ri) => {
      const t = typeOf(r), key = r.name.trim().toLowerCase(), c = centroid(r.polygon), el: CheckEl = { t: "room", i: ri };
      if (HABITABLE.has(t)) {
        const a = sqft(roomArea(r)), min = std("check.room.minArea");
        if (a < min) add({ id: `area:${key}`, severity: "warn", title: `${r.name} is small for a ${t}`, text: `It's ${Math.round(a)} ft². A room people live or sleep in needs ${min} ft² at least.`, std: "check.room.minArea", at: c, el });
        const nw = narrowest(r.polygon), minD = std("check.room.minDim");
        if (nw.w < minD) add({ id: `narrow:${key}`, severity: "warn", title: `${r.name} is narrow`, text: `It's ${says(nw.w)} across here. A room people live or sleep in should be ${says(minD)} each way.`, std: "check.room.minDim", at: nw.at, el });
      }
      if (t === "hallway") {
        const nw = narrowest(r.polygon), min = std("check.room.hall");
        if (nw.w < min) add({ id: `hall:${key}`, severity: "warn", title: `${r.name} is a tight squeeze`, text: `The hall is ${says(nw.w)} wide here. Halls need ${says(min)}.`, std: "check.room.hall", at: nw.at, el });
      }
      if (t === "bedroom") {
        // a way out in a fire: a door straight outside, or a window big and low enough to climb through
        const outDoor = (f.doors ?? []).some((d) => d.rooms.some((n) => n.trim().toLowerCase() === key) && d.rooms.some((n) => OUTSIDE.test(n.trim()) || OUTDOOR.has(typeOf(f.rooms[roomIdx(n)] ?? { name: "", polygon: [] }))));
        const wins = (f.windows ?? []).map((w, i) => ({ w, i })).filter(({ w }) => w.room.trim().toLowerCase() === key);
        if (!outDoor && !wins.length) add({ id: `escape:${key}`, severity: "warn", title: `${r.name} has no way out but the door`, text: `A bedroom needs a window big enough to climb out of in a fire (${std("check.bed.escapeArea")} ft² open, sill at most ${says(std("check.bed.escapeSill"))} up) or a door outside.`, std: "check.bed.escapeArea", at: c, el });
        else if (!outDoor) {
          const size = ({ w }: { w: (typeof wins)[0]["w"] }) => {
            const sill = w.sill_mm ?? RULES.sill, h = w.height_mm ?? RULES.head - sill, wd = w.width_mm ?? 1200;
            return { sill, h, wd, ft2: (wd * h) / 92903 };
          };
          const best = wins.map((x) => ({ ...x, ...size(x) })).sort((a, b) => b.ft2 - a.ft2)[0];
          const spot = windowSpots(f, best.w)[0];
          const at = spot ? mid(spot) : c, wel: CheckEl = { t: "window", i: best.i };
          const need = std("check.bed.escapeArea"), needW = std("check.bed.escapeW"), needH = std("check.bed.escapeH"), sillMax = std("check.bed.escapeSill");
          if (best.ft2 < need || best.wd < needW || best.h < needH) add({ id: `escapeSize:${key}`, severity: "warn", title: `${r.name}'s window may be too small to climb out of`, text: `The biggest is ${says(best.wd)} by ${says(best.h)}. An escape window opens at least ${need} ft², ${says(needW)} wide and ${says(needH)} high.`, std: "check.bed.escapeArea", at, el: wel });
          if (best.sill > sillMax) add({ id: `escapeSill:${key}`, severity: "warn", title: `${r.name}'s window sill is high`, text: `It's ${says(best.sill)} off the floor. To climb out in a fire it should be ${says(sillMax)} or lower.`, std: "check.bed.escapeSill", at, el: wel });
        }
      }
      if (OUTDOOR.has(t) && f.level > 0) add({ id: `guard:${key}`, severity: "info", title: `${r.name} needs a guard`, text: `Its open edges need a guard at least ${says(std("check.room.guardHeight"))} high.`, std: "check.room.guardHeight", at: c, el });
    });

    // ceiling height of the floor's living spaces
    const living = f.rooms.filter((r) => HABITABLE.has(typeOf(r)) || typeOf(r) === "kitchen");
    const ceiling = rise - std("stair.floorDepth");
    if (living.length && ceiling < std("check.room.ceiling")) add({ id: "ceiling", severity: "warn", title: `${f.name || "This floor"}: low ceiling`, text: `Floor to floor ${says(rise)} leaves about ${says(ceiling)} to the ceiling. Living spaces need ${says(std("check.room.ceiling"))}.`, std: "check.room.ceiling", at: centroid(living[0].polygon), el: { t: "room", i: f.rooms.indexOf(living[0]) } });

    // fixtures: toilets, kitchen aisles
    const fx = f.fixtures ?? [];
    const inRoom = (x: SketchFixture) => { const i = roomIdx(x.room); return i >= 0 ? i : f.rooms.findIndex((r) => pointInPoly(x.center, r.polygon)); };
    fx.forEach((x, i) => {
      if (x.kind !== "toilet" || !x.facing || !FACE[x.facing]) return;
      const ri = inRoom(x);
      if (ri < 0) return;
      const F = FACE[x.facing], L: Pt = [-F[1], F[0]];
      const w = x.width_mm ?? CATALOG.toilet?.w ?? 400, d = x.depth_mm ?? CATALOG.toilet?.d ?? 700;
      const segs = [...edgesOf(f.rooms[ri].polygon), ...fx.filter((o, k) => k !== i && inRoom(o) === ri && CATALOG[o.kind]?.mount !== "wall" && CATALOG[o.kind]?.mount !== "ceiling").flatMap((o) => boxSegs(boxOf(o)))];
      const at = (fwd: number, side: number): Pt => [x.center[0] + F[0] * fwd + L[0] * side, x.center[1] + F[1] * fwd + L[1] * side];
      let side = Infinity, sideAt: Pt = x.center;
      for (const k of [-0.4, 0, 0.4]) for (const s of [1, -1]) { const o = at(k * d, 0), dd = ray(o, [L[0] * s, L[1] * s], segs); if (dd < side) { side = dd; sideAt = at(k * d, s * dd); } }
      const front = Math.min(...[-0.8, -0.4, 0, 0.4, 0.8].map((m) => ray(at(d / 2, (m * w) / 2), F, segs)));
      const ws = std("check.bath.toiletSide"), wf = std("check.bath.toiletFront"), el: CheckEl = { t: "thing", i };
      const id = `${r100(x.center[0])},${r100(x.center[1])}`;
      if (side < ws) add({ id: `toiletSide:${id}`, severity: "warn", title: "Toilet is tight to the side", text: `${says(side)} from its centre to the wall or fixture beside it. It needs ${says(ws)}.`, std: "check.bath.toiletSide", at: sideAt, el });
      if (front < wf) add({ id: `toiletFront:${id}`, severity: "warn", title: "Not much room in front of the toilet", text: `${says(front)} clear in front. It needs ${says(wf)}.`, std: "check.bath.toiletFront", at: at(d / 2 + front / 2, 0), el });
    });
    const counters = fx.map((x, i) => ({ x, i, b: boxOf(x), ri: inRoom(x) })).filter((c) => COUNTER.has(c.x.kind));
    // one nudge per aisle, however many cabinets line it
    const aisles = new Set<string>();
    for (let a = 0; a < counters.length; a++) for (let b = a + 1; b < counters.length; b++) {
      const A = counters[a], B = counters[b];
      if (A.ri !== B.ri) continue;
      for (const ax of [0, 1] as const) {
        const o = ax === 0 ? 1 : 0;
        const over = Math.min(A.b[o + 2], B.b[o + 2]) - Math.max(A.b[o], B.b[o]);
        const [lo, hi] = A.b[ax + 2] <= B.b[ax] ? [A, B] : B.b[ax + 2] <= A.b[ax] ? [B, A] : [null, null];
        if (!lo || !hi || over < 300) continue;
        const gap = hi.b[ax] - lo.b[ax + 2];
        // a real aisle: someone works at one of them facing the other (an island always counts)
        const towards = (c: typeof A, dir: number) => c.x.kind === "island" || (c.x.facing && FACE[c.x.facing]?.[ax] === dir);
        if (gap < 150 || gap > 2500 || !(towards(lo, 1) || towards(hi, -1))) continue;
        const m: Pt = ax === 0 ? [(lo.b[2] + hi.b[0]) / 2, (Math.max(A.b[1], B.b[1]) + Math.min(A.b[3], B.b[3])) / 2] : [(Math.max(A.b[0], B.b[0]) + Math.min(A.b[2], B.b[2])) / 2, (lo.b[3] + hi.b[1]) / 2];
        const id = `aisle:${ax}:${Math.round(lo.b[ax + 2] / 50)}:${Math.round(hi.b[ax] / 50)}`;
        if (aisles.has(id)) continue;
        aisles.add(id);
        const one = std("check.kitchen.aisle"), two = std("check.kitchen.aisleTwo");
        if (gap < one) add({ id, severity: "warn", title: "Kitchen aisle is tight", text: `${says(gap)} between the counters. One cook needs ${says(one)}.`, std: "check.kitchen.aisle", at: m, el: { t: "thing", i: lo.i } });
        else if (gap < two) add({ id, severity: "info", title: "Aisle fits one cook", text: `${says(gap)} between the counters. Two people cooking need ${says(two)}.`, std: "check.kitchen.aisleTwo", at: m, el: { t: "thing", i: lo.i } });
      }
    }

    // the main door, on the lowest floor
    if (f.level === Math.min(...sk.floors.map((x) => x.level))) {
      const outs = (f.doors ?? []).map((d, i) => ({ d, i })).filter(({ d }) => (!d.rooms[1] || OUTSIDE.test(d.rooms[1].trim())) && (d.kind ?? "door") !== "garage_door" && d.kind !== "opening" && d.kind !== "sliding_door");
      const main = outs.sort((p, q) => doorWidth(q.d) - doorWidth(p.d))[0];
      const loss = std("check.door.loss"), need = std("check.door.clear");
      if (main && main.d.kind !== "double_door" && doorWidth(main.d) - loss < need) {
        const spot = doorSpot(f, main.d);
        add({ id: `mainDoor:${main.d.rooms.join("|").toLowerCase()}`, severity: "info", title: "Front door is on the narrow side", text: `A ${says(doorWidth(main.d))} door leaves about ${says(doorWidth(main.d) - loss)} clear. The way out needs ${says(need)} clear, so a ${says(need + loss + 2 * IN)} door is usual.`, std: "check.door.clear", at: spot ? mid(spot) : centroid(f.rooms[0]?.polygon ?? [[0, 0]]), el: { t: "door", i: main.i } });
      }
    }

    // upstairs hanging past the walls below
    const below = floorBelow(sk, f);
    if (below?.rooms.length) {
      f.rooms.forEach((r, ri) => {
        if (OUTDOOR.has(typeOf(r))) return;
        let worst = 0, at: Pt | null = null;
        for (const p of spots(r.polygon)) {
          if (below.rooms.some((b) => pointInPoly(p, b.polygon))) continue;
          const d = Math.min(...below.rooms.map((b) => edgeDistance(p, b.polygon)));
          if (d > worst) { worst = d; at = p; }
        }
        const lim = std("check.room.overhang");
        if (at && worst > lim) add({ id: `overhang:${r.name.trim().toLowerCase()}`, severity: "warn", title: `${r.name} hangs out past the floor below`, text: `Up to ${says(worst)} with no wall under it. More than ${says(lim)} usually needs an engineer, a beam or posts.`, std: "check.room.overhang", at, el: { t: "room", i: ri } });
      });
    }

    // a wall taken out that lined up with a wall below or above
    const was = before?.floors.find((x) => x.level === f.level);
    if (was) {
      const now = insideWalls(f), above = floorAbove(sk, f);
      const stacked = [...(below?.rooms ?? []).flatMap((r) => edgesOf(r.polygon)), ...(above ? insideWalls(above) : [])];
      for (const s of insideWalls(was)) {
        const m = mid(s);
        if (now.some((t) => nearSeg(m, t).d < 60) || f.rooms.every((r) => !pointInPoly(m, r.polygon) && edgeDistance(m, r.polygon) > 60)) continue;
        if (!stacked.some((t) => nearSeg(m, t).d < 80)) continue;
        add({ id: `wallOut:${r100(m[0])},${r100(m[1])}`, severity: "info", title: "A wall that may hold weight was taken out", text: "It lined up with a wall on the floor below or above, so it may carry the floor or the roof. Have it checked before it comes out.", at: m });
      }
    }

    // stairs
    (f.stairs ?? []).forEach((st, si) => {
      const g = stairGeom(st, rise), el: CheckEl = { t: "stair", i: si }, c = centroid(g.footprint), id = `stair${si}`;
      if (g.riser > std("stair.riserMax") + 0.5) add({ id: `${id}:riser`, severity: "warn", title: "Steps are too tall", text: `Each step is ${says(g.riser)} high. Steps can be ${says(std("stair.riserMax"))} at most: add a step.`, std: "stair.riserMax", at: g.path[0], el });
      if (g.tread < std("stair.treadMin") - 0.5) add({ id: `${id}:tread`, severity: "warn", title: "Treads are shallow", text: `Each tread is ${says(g.tread)} deep. They need ${says(std("stair.treadMin"))} at least.`, std: "stair.treadMin", at: c, el });
      if (g.width < std("stair.widthMin") - 0.5) add({ id: `${id}:width`, severity: "warn", title: "Stairs are narrow", text: `${says(g.width)} wide. Stairs need ${says(std("stair.widthMin"))}.`, std: "stair.widthMin", at: c, el });
      if (st.shape !== "straight" && g.landing < (g.width * std("stair.landing")) / 100 - 0.5) add({ id: `${id}:landing`, severity: "warn", title: "Landing is short", text: `The landing is ${says(g.landing)} deep. It should be at least as deep as the stairs are wide (${says(g.width)}).`, std: "stair.landing", at: g.steps.find((s) => s.landing) ? centroid(g.steps.find((s) => s.landing)!.polygon) : c, el });
      if (g.headroom < std("stair.headroom") - 0.5) add({ id: `${id}:headroom`, severity: "warn", title: "Low headroom on the stairs", text: `Only ${says(g.headroom)} under the floor above. People need ${says(std("stair.headroom"))}.`, std: "stair.headroom", at: c, el });
      if (rise > std("stair.guardDrop")) {
        const edges = f.rooms.flatMap((r) => edgesOf(r.polygon));
        const walled = ([a, b]: [Pt, Pt]) => [0.1, 0.3, 0.5, 0.7, 0.9].every((k) => edges.some((s) => nearSeg([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], s).d < 150));
        const open = g.sides.filter((s) => !walled(s));
        if (open.length) add({ id: `${id}:guard`, severity: "info", title: "Open side of the stairs needs a guard", text: `${open.length === 1 ? "One side isn't" : `${open.length} sides aren't`} against a wall. Open sides and the edge of the opening upstairs need a guard ${says(std("check.room.guardHeight"))} high, and the stairs a handrail.`, std: "stair.guardDrop", at: mid(open[0]), el });
      }
      if (!floorAbove(sk, f)) add({ id: `${id}:above`, severity: "info", title: "Nothing drawn above the stairs", text: "Add the floor they lead up to, so its opening shows and the checks can see it.", at: c, el });
    });
  });
  const skip = new Set(sk.ignored_checks ?? []);
  return { open: all.filter((n) => !skip.has(n.id)), ignored: all.filter((n) => skip.has(n.id)) };
}
