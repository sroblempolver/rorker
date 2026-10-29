// Scores a plan reading against the right answer for that drawing (the answer key), so every change
// to the plan reader can be measured on every test plan. Both are sketches (the reader's format). The
// read can sit anywhere and be off in scale, so each floor is lined up by its outline first; the scale
// error is scored on its own. Rooms are matched by overlap, then doors, windows and things are checked
// between the matched rooms.
import type { Plan, Pt } from "@/lib/plan/types";
import { expandUnits, roomType, type Side, type Sketch, type SketchFloor } from "@/lib/plan/sketch";
import { bboxOf } from "@/lib/plan/geometry";
import { pointInPoly } from "@/lib/plan/sketchEdit";

export interface ScoreLine { key: string; label: string; got: string; points: number; of: number }
export interface Score { total: number; lines: ScoreLine[]; misses: string[] }

const OUTSIDE = /^(outside|exterior|out|garden|yard|street)$/i;
const WEIGHTS = { floors: 5, homes: 10, rooms: 30, types: 10, scale: 10, doors: 15, windows: 5, things: 15 };
const CELL = 200;
/** the things every plan should show; loose furniture (chairs, lamps) isn't scored */
export const MAIN_THINGS = new Set(["kitchen_sink", "range", "cooktop", "oven", "fridge", "dishwasher", "island", "toilet", "washbasin", "vanity", "bathtub", "shower", "bed", "sofa", "dining_table", "car", "washing_machine", "fireplace"]);
const main = (f: SketchFloor) => (f.fixtures ?? []).filter((x) => MAIN_THINGS.has(x.kind)); // mm: rooms are compared on a grid this fine

const f1 = (hit: number, want: number, got: number) => (want + got === 0 ? 1 : (2 * hit) / (want + got));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const homesOf = (s: Sketch) => {
  const named = new Set(expandUnits(s).flatMap((f) => f.rooms.map((r) => r.unit).filter(Boolean)));
  return Math.max(1, named.size, s.units?.length ?? 0);
};

/** The grid cells a polygon covers, as numbers. */
function cells(poly: Pt[]): Set<number> {
  const [x0, y0, x1, y1] = bboxOf(poly);
  const out = new Set<number>();
  for (let i = Math.floor(x0 / CELL); i <= Math.ceil(x1 / CELL); i++)
    for (let j = Math.floor(y0 / CELL); j <= Math.ceil(y1 / CELL); j++)
      if (pointInPoly([(i + 0.5) * CELL, (j + 0.5) * CELL], poly)) out.add(i * 100003 + j);
  return out;
}
const iou = (a: Set<number>, b: Set<number>) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / Math.max(1, a.size + b.size - n); };

/** Line a read floor up on the answer's: same top-left corner, and stretched to the answer's size. */
function lineUp(read: SketchFloor, ans: SketchFloor) {
  const rb = bboxOf(read.rooms.flatMap((r) => r.polygon)), ab = bboxOf(ans.rooms.flatMap((r) => r.polygon));
  const k = Math.sqrt(((ab[2] - ab[0]) * (ab[3] - ab[1])) / Math.max(1, (rb[2] - rb[0]) * (rb[3] - rb[1])));
  const map = (p: Pt): Pt => [ab[0] + (p[0] - rb[0]) * k, ab[1] + (p[1] - rb[1]) * k];
  return { k, map };
}

const sideKey = (s?: Side) => s ?? "";

export function scoreSketch(read: Sketch | null | undefined, answer: Sketch): Score {
  const misses: string[] = [];
  const A = expandUnits(answer).filter((f) => f.rooms.length).sort((a, b) => a.level - b.level);
  const R = read ? expandUnits(read).filter((f) => f.rooms.length).sort((a, b) => a.level - b.level) : [];
  const lines: ScoreLine[] = [];
  const add = (key: keyof typeof WEIGHTS, label: string, got: string, frac: number) => lines.push({ key, label, got, points: Math.round(WEIGHTS[key] * Math.max(0, Math.min(1, frac)) * 10) / 10, of: WEIGHTS[key] });

  add("floors", "Floors", `${R.length} of ${A.length}`, A.length ? 1 - Math.abs(R.length - A.length) / A.length : 1);
  if (R.length !== A.length) misses.push(`Read ${R.length} floor${R.length === 1 ? "" : "s"}, the drawing has ${A.length}.`);
  const hA = homesOf(answer), hR = read ? homesOf(read) : 0;
  add("homes", "Homes", `${hR} of ${hA}`, 1 - Math.abs(hR - hA) / hA);
  if (hR !== hA) misses.push(`Read ${hR} home${hR === 1 ? "" : "s"}, the drawing has ${hA}.`);

  let roomHit = 0, roomWant = 0, roomGot = 0, typeHit = 0, scaleErr = 0, scaled = 0;
  let doorHit = 0, doorWant = 0, doorGot = 0, winHit = 0, winWant = 0, winGot = 0, thingHit = 0, thingWant = 0, thingGot = 0;
  A.forEach((af, fi) => {
    roomWant += af.rooms.length;
    doorWant += af.doors?.length ?? 0;
    winWant += new Set((af.windows ?? []).map((w) => `${w.room.toLowerCase()}|${w.side}`)).size;
    thingWant += main(af).length;
    const rf = R[fi];
    if (!rf) { misses.push(`Missed the whole ${af.name ?? `level ${af.level}`}.`); return; }
    roomGot += rf.rooms.length;
    doorGot += rf.doors?.length ?? 0;
    winGot += new Set((rf.windows ?? []).map((w) => `${w.room.toLowerCase()}|${w.side}`)).size;
    thingGot += main(rf).length;
    const { k, map } = lineUp(rf, af);
    scaleErr += Math.abs(1 / k - 1);
    scaled++;
    // rooms: best overlap first, one to one
    const ac = af.rooms.map((r) => cells(r.polygon)), rc = rf.rooms.map((r) => cells(r.polygon.map(map)));
    const pairs: { a: number; r: number; v: number }[] = [];
    ac.forEach((x, a) => rc.forEach((y, r) => { const v = iou(x, y); if (v >= 0.5) pairs.push({ a, r, v }); }));
    pairs.sort((x, y) => y.v - x.v);
    const toAns = new Map<number, number>(), usedA = new Set<number>();
    for (const p of pairs) if (!usedA.has(p.a) && !toAns.has(p.r)) { usedA.add(p.a); toAns.set(p.r, p.a); }
    roomHit += toAns.size;
    for (const [r, a] of toAns) {
      const ta = roomType(af.rooms[a].type, af.rooms[a].name), tr = roomType(rf.rooms[r].type, rf.rooms[r].name);
      if (ta === tr) typeHit++;
      else misses.push(`${af.rooms[a].name} read as a ${tr.replace(/_/g, " ")} ("${rf.rooms[r].name}").`);
    }
    af.rooms.forEach((r, a) => { if (!usedA.has(a)) misses.push(`Missed or misshaped: ${r.name} (${af.name ?? `level ${af.level}`}).`); });
    rf.rooms.forEach((r, i) => { if (!toAns.has(i)) misses.push(`Extra or misshaped room read: "${r.name}".`); });
    // read room names -> answer room names
    const nameMap = new Map<string, string>();
    for (const [r, a] of toAns) nameMap.set(rf.rooms[r].name.toLowerCase().trim(), af.rooms[a].name.toLowerCase().trim());
    const ansName = (n: string) => (OUTSIDE.test(n) ? "outside" : nameMap.get(n.toLowerCase().trim()) ?? null);
    // doors: the same two rooms (an outside door also on the same side)
    const want = (af.doors ?? []).map((d) => ({ key: [...d.rooms.map((n) => (OUTSIDE.test(n) ? "outside" : n.toLowerCase().trim()))].sort().join("|"), side: d.side, used: false }));
    for (const d of rf.doors ?? []) {
      const names = d.rooms.map(ansName);
      if (names.some((n) => !n)) continue;
      const key = [...names].sort().join("|");
      const m = want.find((w) => !w.used && w.key === key && (!key.includes("outside") || !w.side || !d.side || w.side === d.side));
      if (m) { m.used = true; doorHit++; }
    }
    for (const w of want) if (!w.used) misses.push(`Missed a door: ${w.key.replace("|", " to ")}${w.side ? ` (${w.side})` : ""}.`);
    // windows: by room and side
    const wantW = new Set((af.windows ?? []).map((w) => `${w.room.toLowerCase().trim()}|${sideKey(w.side)}`));
    const gotW = new Set((rf.windows ?? []).map((w) => { const n = ansName(w.room); return n ? `${n}|${sideKey(w.side)}` : null; }).filter(Boolean) as string[]);
    for (const x of gotW) if (wantW.has(x)) winHit++;
    // things: the same kind within a metre of where it should be
    const free = main(af).map((x) => ({ ...x, used: false }));
    for (const x of main(rf)) {
      const c = map(x.center);
      const m = free.filter((y) => !y.used && y.kind === x.kind).map((y) => ({ y, d: Math.hypot(y.center[0] - c[0], y.center[1] - c[1]) })).sort((p, q) => p.d - q.d)[0];
      if (m && m.d < 1000) { m.y.used = true; thingHit++; }
    }
    const lost = free.filter((y) => !y.used).reduce<Record<string, number>>((o, y) => ({ ...o, [y.kind]: (o[y.kind] ?? 0) + 1 }), {});
    const lostText = Object.entries(lost).map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`).join(", ");
    if (lostText) misses.push(`Things missed or misplaced on ${af.name ?? `level ${af.level}`}: ${lostText}.`);
  });

  add("rooms", "Rooms found (shape and place)", `${roomHit} of ${roomWant}, ${roomGot} read`, f1(roomHit, roomWant, roomGot));
  add("types", "Rooms named right", `${typeHit} of ${roomHit}`, roomHit ? typeHit / roomHit : 0);
  const se = scaled ? scaleErr / scaled : 1;
  add("scale", "Scale", scaled ? `off by ${pct(se)}` : "no plan", 1 - se * 4);
  if (scaled && se > 0.05) misses.push(`Sizes are off by about ${pct(se)}.`);
  add("doors", "Doors", `${doorHit} of ${doorWant}, ${doorGot} read`, f1(doorHit, doorWant, doorGot));
  add("windows", "Windows (room and side)", `${winHit} of ${winWant}, ${winGot} read`, f1(winHit, winWant, winGot));
  add("things", "Main fixtures (kitchen, bath, beds, sofas, cars)", `${thingHit} of ${thingWant}, ${thingGot} read`, f1(thingHit, thingWant, thingGot));
  const total = Math.round(lines.reduce((n, l) => n + l.points, 0));
  return { total, lines, misses };
}

const SIDE_OF: Record<number, Side> = { 0: "east", 90: "south", 180: "west", 270: "north" };
const sideOfDeg = (d: number | null | undefined) => (d == null ? null : SIDE_OF[((Math.round(d / 90) * 90) % 360 + 360) % 360] ?? null);

/** A finished plan back into a sketch, for using a reviewed plan (the sample house) as an answer key. */
export function sketchFromPlan(plan: Plan): Sketch {
  return {
    building_name: plan.building.name,
    floors: plan.floors.map((f) => {
      const rooms = f.rooms.filter((r) => r.polygon.length >= 3);
      const name = new Map(rooms.map((r) => [r.id, r.name]));
      const box = (id: string) => { const r = rooms.find((x) => x.id === id); return r ? bboxOf(r.polygon) : null; };
      const sideFrom = (roomId: string, a: Pt, b: Pt): Side => {
        const bb = box(roomId)!, c: Pt = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2], m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const dx = m[0] - c[0], dy = m[1] - c[1];
        return Math.abs(Math.abs(b[0] - a[0]) - Math.abs(b[1] - a[1])) < 1 ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "east" : "west") : dy > 0 ? "south" : "north")
          : Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? (dy > 0 ? "south" : "north") : dx > 0 ? "east" : "west";
      };
      const doors: SketchFloor["doors"] = [];
      const windows = new Map<string, { room: string; side: Side; count: number }>();
      for (const o of f.openings) {
        const ids = o.room_ids.filter((id) => name.has(id));
        if (!ids.length) continue;
        if (o.kind === "window") {
          const side = sideFrom(ids[0], o.a, o.b), k = `${ids[0]}|${side}`;
          const w = windows.get(k) ?? { room: name.get(ids[0])!, side, count: 0 };
          w.count++;
          windows.set(k, w);
        } else doors.push(ids.length >= 2 ? { rooms: [name.get(ids[0])!, name.get(ids[1])!], kind: o.kind } : { rooms: [name.get(ids[0])!, "outside"], kind: o.kind, side: sideFrom(ids[0], o.a, o.b) });
      }
      return {
        name: f.name, level: f.level,
        rooms: rooms.map((r) => ({ name: r.name, type: r.type, polygon: r.polygon, ...(r.unit ? { unit: r.unit } : {}) })),
        doors, windows: [...windows.values()],
        fixtures: f.fixtures.map((x) => ({ kind: x.kind, name: x.name, room: x.room_id ? name.get(x.room_id) : undefined, center: x.center, width_mm: Math.round(x.bbox[2] - x.bbox[0]), depth_mm: Math.round(x.bbox[3] - x.bbox[1]), facing: sideOfDeg(x.facing) })),
      };
    }),
  };
}
