// Picking several things at once on the plan, like on a computer's desktop: drag a box from empty space
// and everything it catches is picked, then they move (or go) together. A box catches the furniture and
// stairs it touches, and the rooms and wall pieces that are wholly inside it (so a box drawn round a few
// chairs doesn't take the room they stand in).
import type { Pt } from "./types";
import type { SketchFloor, SketchWall } from "./sketch";
import { halfSize, fixturesIn } from "./roomEdit";
import { dropLooseRoom, followWall, onOutline, onWall } from "./walls";
import { bboxOf } from "./geometry";

export type Pick = { t: "room" | "door" | "window" | "thing" | "stair" | "wall"; i: number };
/** a box on the plan: [x0, y0, x1, y1] with x0 <= x1 and y0 <= y1 */
export type Box = [number, number, number, number];

export const boxOf = (a: Pt, b: Pt): Box => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
const inBox = (p: Pt, b: Box) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
const touches = (a: Box, b: Box) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
export const samePick = (a: Pick, b: Pick) => a.t === b.t && a.i === b.i;

/** What a box catches on the floor. `stairs` are the stairs' footprints on the plan. */
export function boxPicks(f: SketchFloor, box: Box, stairs: Pt[][]): Pick[] {
  const out: Pick[] = [];
  f.rooms.forEach((r, i) => { if (r.polygon.length && r.polygon.every((p) => inBox(p, box))) out.push({ t: "room", i }); });
  (f.walls ?? []).forEach((w, i) => { if (inBox(w.a, box) && inBox(w.b, box)) out.push({ t: "wall", i }); });
  (f.fixtures ?? []).forEach((x, i) => {
    const [hw, hd] = halfSize(x);
    if (touches([x.center[0] - hw, x.center[1] - hd, x.center[0] + hw, x.center[1] + hd], box)) out.push({ t: "thing", i });
  });
  stairs.forEach((fp, i) => { if (fp.length && touches(bboxOf(fp) as Box, box)) out.push({ t: "stair", i }); });
  return out;
}

/** Everything that moves when the picks move: a room brings its furniture (and, when it follows its
 *  walls, those walls), a wall piece brings what stands against it. Doors and windows ride on their walls. */
export interface Members { rooms: Set<number>; walls: Set<number>; things: Set<number>; stairs: Set<number> }
export function membersOf(f: SketchFloor, picks: Pick[]): Members {
  const m: Members = { rooms: new Set(), walls: new Set(), things: new Set(), stairs: new Set() };
  for (const p of picks) {
    if (p.t === "room" && f.rooms[p.i]) {
      m.rooms.add(p.i);
      for (const k of fixturesIn(f, p.i)) m.things.add(k);
      if (f.rooms[p.i].loose) (f.walls ?? []).forEach((w, k) => { if (onOutline(w, f.rooms[p.i].polygon)) m.walls.add(k); });
    } else if (p.t === "wall" && f.walls?.[p.i]) m.walls.add(p.i);
    else if (p.t === "thing" && f.fixtures?.[p.i]) m.things.add(p.i);
    else if (p.t === "stair" && f.stairs?.[p.i]) m.stairs.add(p.i);
  }
  // what stands against a moving wall piece goes with it (found by moving the wall a little)
  for (const k of m.walls) {
    const moved = followWall(f, k, [1, 0]).fixtures ?? [];
    moved.forEach((x, j) => { if (x !== f.fixtures![j]) m.things.add(j); });
  }
  return m;
}

const sh = (p: Pt, d: Pt): Pt => [Math.round(p[0] + d[0]), Math.round(p[1] + d[1])];

/** The floor with the group moved by d. Walls left behind keep hold of a moved wall: their end on it
 *  stretches along. The caller refits the rooms that follow their walls. */
export function moveGroup(f: SketchFloor, m: Members, d: Pt): SketchFloor {
  const walls = f.walls ?? [];
  const moved = walls.filter((_, i) => m.walls.has(i));
  const nextWalls: SketchWall[] = walls.map((w, i) => {
    if (m.walls.has(i)) return { ...w, a: sh(w.a, d), b: sh(w.b, d) };
    const hold = (p: Pt) => moved.some((o) => onWall(p, o.a, o.b).d < 2);
    const a = hold(w.a) ? sh(w.a, d) : w.a, b = hold(w.b) ? sh(w.b, d) : w.b;
    return a === w.a && b === w.b ? w : { ...w, a, b };
  });
  return {
    ...f,
    rooms: f.rooms.map((r, i) => (m.rooms.has(i) ? { ...r, polygon: r.polygon.map((p) => sh(p, d)) } : r)),
    fixtures: (f.fixtures ?? []).map((x, i) => (m.things.has(i) ? { ...x, center: sh(x.center, d) } : x)),
    stairs: f.stairs && f.stairs.map((s, i) => (m.stairs.has(i) ? { ...s, at: sh(s.at, d) } : s)),
    ...(f.walls ? { walls: nextWalls } : {}),
  };
}

/** The corners of the group's box, for snapping it onto the walls around it. */
export function groupBox(f: SketchFloor, m: Members): Box | null {
  const pts: Pt[] = [];
  m.rooms.forEach((i) => pts.push(...f.rooms[i].polygon));
  m.walls.forEach((i) => pts.push(f.walls![i].a, f.walls![i].b));
  m.things.forEach((i) => { const x = f.fixtures![i], [hw, hd] = halfSize(x); pts.push([x.center[0] - hw, x.center[1] - hd], [x.center[0] + hw, x.center[1] + hd]); });
  m.stairs.forEach((i) => pts.push(f.stairs![i].at));
  return pts.length ? (bboxOf(pts) as Box) : null;
}

/** The floor with all the picks taken out (rooms take their doors and windows with them). */
export function removePicks(f: SketchFloor, picks: Pick[]): SketchFloor {
  const of = (t: Pick["t"]) => new Set(picks.filter((p) => p.t === t).map((p) => p.i));
  const rooms = of("room"), walls = of("wall"), things = of("thing"), stairs = of("stair"), doors = of("door"), wins = of("window");
  let g: SketchFloor = { ...f, walls: f.walls && f.walls.filter((_, i) => !walls.has(i)) };
  for (const ri of rooms) if (f.rooms[ri]?.loose) g = { ...g, walls: dropLooseRoom(g, ri) };
  const gone = new Set([...rooms].map((i) => f.rooms[i]?.name.toLowerCase()));
  return {
    ...g,
    rooms: f.rooms.filter((_, i) => !rooms.has(i)),
    doors: (f.doors ?? []).filter((x, i) => !doors.has(i) && !x.rooms.some((n) => gone.has(n.toLowerCase()))),
    windows: (f.windows ?? []).filter((x, i) => !wins.has(i) && !gone.has(x.room.toLowerCase())),
    fixtures: (f.fixtures ?? []).filter((_, i) => !things.has(i)),
    stairs: f.stairs && f.stairs.filter((_, i) => !stairs.has(i)),
  };
}

/** "2 rooms, 3 pieces of furniture" */
export function describePicks(picks: Pick[]): string {
  const n = (t: Pick["t"]) => picks.filter((p) => p.t === t).length;
  const say = (k: number, one: string, many: string) => (k ? [`${k} ${k === 1 ? one : many}`] : []);
  return [...say(n("room"), "room", "rooms"), ...say(n("wall"), "wall", "walls"), ...say(n("thing"), "piece of furniture", "pieces of furniture"),
    ...say(n("stair"), "stairs", "stairs"), ...say(n("door"), "door", "doors"), ...say(n("window"), "window", "windows")].join(", ");
}
