// Common sense the drawing doesn't carry, applied to every object before it is shown or reasoned
// about: which way things face when nobody said (chairs to their desk or table, stools to the counter,
// sofas to the TV, beds and cabinets with their backs to a wall), and what stands on what (a desk
// lamp or a computer sits on the desk, at the desk's height, and moves with it).
import { CATALOG, specOf, topOf, type ObjectSpec } from "./catalog";
import { roomSides } from "./geometry";
import type { Fixture, Floor, Plan, Pt } from "./types";

const SKIP = new Set(["door_leaf", "part"]);
const DIRS = [0, 90, 180, -90];
const vec = (deg: number): Pt => [Math.round(Math.cos((deg * Math.PI) / 180)), Math.round(Math.sin((deg * Math.PI) / 180))];

/** The ways a footprint can face: any of four when it's about square, else the two off its front side. */
function allowed(f: Fixture, spec: ObjectSpec | null): number[] {
  const bw = f.bbox[2] - f.bbox[0], bh = f.bbox[3] - f.bbox[1];
  // square things (chairs, stools) can face any way, whatever their armrests make the outline
  if (Math.max(bw, bh) / Math.max(1, Math.min(bw, bh)) < 1.15 || (spec && spec.w / spec.d > 0.8 && spec.w / spec.d < 1.25)) return DIRS;
  const frontOnLong = !spec || spec.w >= spec.d; // a sofa's front is its long side, a bed's its short one
  return bw > bh === frontOnLong ? [90, -90] : [0, 180];
}

/** Back to the nearest wall it can turn its back on, facing into the room. */
export function awayFromWall(fl: Floor, f: Fixture, dirs: number[]): number | null {
  const room = fl.rooms.find((r) => r.id === f.room_id);
  if (!room) return null;
  let best: { d: number; dir: number } | null = null;
  for (const s of roomSides(fl, room)) {
    const dir = DIRS.find((a) => { const v = vec(a); return v[0] * s.inward[0] + v[1] * s.inward[1] > 0.7; });
    if (dir == null || !dirs.includes(dir)) continue;
    const ux = (s.b[0] - s.a[0]) / s.length, uy = (s.b[1] - s.a[1]) / s.length;
    const t = (f.center[0] - s.a[0]) * ux + (f.center[1] - s.a[1]) * uy;
    if (t < -300 || t > s.length + 300) continue; // not along this side (L-shaped rooms)
    const half = Math.abs(s.inward[0]) > 0.5 ? (f.bbox[2] - f.bbox[0]) / 2 : (f.bbox[3] - f.bbox[1]) / 2;
    const d = (f.center[0] - s.a[0]) * s.inward[0] + (f.center[1] - s.a[1]) * s.inward[1] - half;
    if (!best || d < best.d) best = { d, dir };
  }
  return best?.dir ?? null;
}

const gap = (a: number[], b: number[]) => Math.hypot(Math.max(0, a[0] - b[2], b[0] - a[2]), Math.max(0, a[1] - b[3], b[1] - a[3]));

/** The nearest thing of the kinds it belongs with (a chair's desk or table), close by. */
export function partnerOf(list: Fixture[], f: Fixture, kinds: string[], reach = 1200): Fixture | null {
  let best: { g: number; x: Fixture } | null = null;
  for (const x of list) {
    if (x.id === f.id || !kinds.includes(x.kind)) continue;
    if (f.room_id && x.room_id && x.room_id !== f.room_id) continue;
    const g = gap(f.bbox, x.bbox);
    if (g <= reach && (!best || g < best.g)) best = { g, x };
  }
  return best?.x ?? null;
}

/** Facing that turns f toward the nearest point of `to`, among `dirs`. */
export function toward(f: { center: Pt }, to: { bbox: number[]; center: Pt }, dirs = DIRS): number {
  let dx = Math.min(Math.max(f.center[0], to.bbox[0]), to.bbox[2]) - f.center[0];
  let dy = Math.min(Math.max(f.center[1], to.bbox[1]), to.bbox[3]) - f.center[1];
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { dx = to.center[0] - f.center[0]; dy = to.center[1] - f.center[1]; }
  let best = dirs[0], bd = -Infinity;
  for (const a of dirs) { const v = vec(a); const d = v[0] * dx + v[1] * dy; if (d > bd) { bd = d; best = a; } }
  return best;
}

/** What a surface object stands on: the thing given, else the highest suitable top under its middle. */
export function supportOf(list: Fixture[], f: Fixture): Fixture | null {
  if (f.on) return list.find((x) => x.id === f.on) ?? null;
  const spec = specOf(f.kind);
  if (spec?.mount !== "surface") return null;
  const [cx, cy] = f.center;
  const under = list.filter((x) => x.id !== f.id && !SKIP.has(x.kind) && specOf(x.kind)?.mount !== "surface" && x.bbox[0] <= cx && cx <= x.bbox[2] && x.bbox[1] <= cy && cy <= x.bbox[3] && topOf(x) < 1300);
  under.sort((a, b) => Number(spec.on?.includes(b.kind)) - Number(spec.on?.includes(a.kind)) || topOf(b) - topOf(a));
  return under[0] ?? null;
}

function shift(f: Fixture, dx: number, dy: number): Fixture {
  if (!dx && !dy) return f;
  const t = (p: Pt): Pt => [p[0] + dx, p[1] + dy];
  return { ...f, center: t(f.center), bbox: [f.bbox[0] + dx, f.bbox[1] + dy, f.bbox[2] + dx, f.bbox[3] + dy], outline: f.outline.map((l) => l.map(t)), on_at: f.on_at ? t(f.on_at) : f.on_at };
}

/** Ties what stands on something in the drawing (a desk lamp on its desk) to it, so it moves with it. */
export function linkSupports(plan: Plan): Plan {
  return {
    ...plan,
    floors: plan.floors.map((fl) => {
      const list = fl.fixtures.map(refine);
      return { ...fl, fixtures: list.map((f) => { if (f.on || specOf(f.kind)?.mount !== "surface") return f; const s = supportOf(list, f); return s ? { ...f, on: s.id, on_at: s.center } : f; }) };
    }),
  };
}

/** Names that say more than the kind ("Desk lamp" read as a lamp is a table lamp). */
function refine(f: Fixture): Fixture {
  if (f.kind === "lamp" && /\b(desk|table|bedside)\b/i.test(f.name)) return { ...f, kind: "table_lamp" };
  return f;
}

/** The way f faces when nobody said, by what kind of thing it is (see the catalogue's `face`). */
export function naturalFacing(fl: Floor, list: Fixture[], f: Fixture): number | null {
  const spec = CATALOG[f.kind] ?? null;
  if (!spec || spec.face === "any") return null;
  const dirs = allowed(f, spec);
  if (spec.face === "to") {
    const p = partnerOf(list, f, spec.to ?? [], f.kind === "sofa" || f.kind === "armchair" ? 4000 : 1200);
    if (p) return toward(f, p, dirs);
  }
  if (spec.users) {
    const u = partnerOf(list, f, spec.users, 700);
    if (u) return toward(f, u, dirs);
  }
  if (spec.face === "with") {
    const sup = supportOf(list, f);
    const sf = sup ? sup.facing ?? naturalFacing(fl, list, sup) : null;
    if (sf != null) return sf;
  }
  return awayFromWall(fl, f, dirs);
}

function arrangeFloor(fl: Floor): Floor {
  let list = fl.fixtures.map(refine);
  // things on other things: carried along when what they sit on moved, at its height
  list = list.map((f) => {
    if (SKIP.has(f.kind)) return f;
    const sup = supportOf(list, f);
    if (!sup) return f;
    let g = f;
    if (f.on && f.on_at) g = { ...shift(f, sup.center[0] - f.on_at[0], sup.center[1] - f.on_at[1]), on_at: sup.center };
    // moved off it: it's on the floor now (or where it was hung)
    if (g.center[0] < sup.bbox[0] || g.center[0] > sup.bbox[2] || g.center[1] < sup.bbox[1] || g.center[1] > sup.bbox[3]) return { ...g, on: null, on_at: null, elevation_mm: g.on ? 0 : g.elevation_mm };
    const top = topOf(sup);
    return g.elevation_mm === top ? g : { ...g, elevation_mm: top };
  });
  // facing, for whatever wasn't given one: floor things first, then what sits on them
  list = list.map((f) => (f.facing != null || SKIP.has(f.kind) ? f : ((x) => (x == null ? f : { ...f, facing: x }))(naturalFacing(fl, list, f))));
  return { ...fl, fixtures: list };
}

/** The plan with every object facing and standing where common sense puts it. */
export function arrange(plan: Plan): Plan {
  return { ...plan, floors: plan.floors.map(arrangeFloor) };
}
