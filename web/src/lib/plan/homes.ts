// Several homes in one drawing (a duplex, a row of townhouses, an apartment building): which rooms make
// up each home, renaming one, and copying one beside itself (or mirrored, the way a duplex is built),
// or up to the floor above. Uses the sketch's own `unit` on rooms and the SketchUnit copy model, so a
// copy is the same rooms, doors, windows and furniture under the new home's name.
import type { Pt } from "./types";
import { expandUnits, type Sketch, type SketchFloor } from "./sketch";
import { bboxOf, polyArea } from "./geometry";
import { renameIn } from "./suggest";

const low = (s?: string) => (s ?? "").trim().toLowerCase();
const OUTDOOR = new Set(["balcony", "porch", "terrace"]);
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export interface Home { name: string; rooms: { fi: number; i: number; name: string }[]; area_m2: number; floors: number[] }

/** Every home in the drawing with its rooms (by floor) and floor area inside. */
export function homesOf(sk: Sketch): Home[] {
  const map = new Map<string, Home>();
  sk.floors.forEach((f, fi) => f.rooms.forEach((r, i) => {
    if (!r.unit) return;
    const h = map.get(low(r.unit)) ?? { name: r.unit, rooms: [], area_m2: 0, floors: [] };
    h.rooms.push({ fi, i, name: r.name });
    if (!OUTDOOR.has(r.type ?? "")) h.area_m2 += polyArea(r.polygon) / 1e6;
    if (!h.floors.includes(fi)) h.floors.push(fi);
    map.set(low(r.unit), h);
  }));
  return [...map.values()];
}

/** A name for the next home: "Unit 3" after "Unit 1" and "Unit 2", else "Home 2". */
export function nextHomeName(sk: Sketch, like = "Unit 1"): string {
  const taken = new Set(sk.floors.flatMap((f) => f.rooms.map((r) => low(r.unit))));
  const m = /^(.*?)(\d+)\s*$/.exec(like.trim());
  const stem = m ? m[1] : `${like.trim()} `;
  for (let k = m ? +m[2] + 1 : 2; ; k++) if (!taken.has(low(`${stem}${k}`))) return `${stem}${k}`;
}

/** Put every room that isn't in a home into one (the first step to a drawing of several homes). */
export const intoOneHome = (sk: Sketch, name = "Unit 1"): Sketch => ({ ...sk, floors: sk.floors.map((f) => ({ ...f, rooms: f.rooms.map((r) => (r.unit ? r : { ...r, unit: name })) })) });

/** A home renamed everywhere; room names that start with its name follow ("Unit 1 kitchen"). */
export function renameHome(sk: Sketch, from: string, to: string): Sketch {
  const re = new RegExp(`^${from.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  return {
    ...sk, units: sk.units?.map((u) => (low(u.name) === low(from) ? { ...u, name: to } : u)),
    floors: sk.floors.map((f) => {
      let g: SketchFloor = { ...f, rooms: f.rooms.map((r) => (low(r.unit) === low(from) ? { ...r, unit: to } : r)) };
      for (const r of f.rooms) if (low(r.unit) === low(from) && re.test(r.name.trim()) && to.trim()) g = renameIn(g, r.name, r.name.trim().replace(re, to));
      return g;
    }),
  };
}

/**
 * A copy of a home beside the whole drawing (to the east), or its mirror image the way a duplex is
 * built. Uses the drawing's SketchUnit copy model, then keeps the copy as rooms of its own.
 */
export function copyHomeBeside(sk: Sketch, name: string, mirror: boolean): { sketch: Sketch; name: string } {
  const to = nextHomeName(sk, name);
  const src = sk.floors.flatMap((f) => f.rooms.filter((r) => low(r.unit) === low(name)).flatMap((r) => r.polygon));
  if (!src.length) return { sketch: sk, name: to };
  const all = bboxOf(sk.floors.flatMap((f) => f.rooms.flatMap((r) => r.polygon)));
  const b = bboxOf(src);
  // right after everything drawn, lined up with the home it copies
  const offset: Pt = [all[2] - b[0], 0];
  const names = [...new Set(sk.floors.flatMap((f) => f.rooms.map((r) => r.unit).filter(Boolean) as string[]))];
  const floors = expandUnits({ ...sk, units: [...names.map((n) => ({ name: n })), { name: to, copy_of: name, mirror, offset_mm: offset }] });
  return { sketch: { ...sk, floors }, name: to };
}

/** A copy of a home on the floor above (made when there isn't one), right over it, as a new home. */
export function copyHomeUp(sk: Sketch, name: string): { sketch: Sketch; name: string; fi: number } | null {
  const fi = sk.floors.findIndex((f) => f.rooms.some((r) => low(r.unit) === low(name)));
  if (fi < 0) return null;
  const f = sk.floors[fi], to = nextHomeName(sk, name);
  const mine = f.rooms.filter((r) => low(r.unit) === low(name));
  const re = new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  const taken = new Set(sk.floors.flatMap((x) => x.rooms.map((r) => low(r.name))));
  const rename = new Map<string, string>();
  for (const r of mine) {
    let n = re.test(r.name.trim()) ? r.name.trim().replace(re, to) : `${to} ${r.name.trim()}`, k = 2;
    const base = n;
    while (taken.has(low(n))) n = `${base} ${k++}`;
    taken.add(low(n));
    rename.set(low(r.name), n);
  }
  const nm = (n?: string) => (n ? rename.get(low(n)) : undefined);
  const inside = (c: Pt) => mine.some((r) => { const b = bboxOf(r.polygon); return c[0] >= b[0] && c[0] <= b[2] && c[1] >= b[1] && c[1] <= b[3]; });
  const add: SketchFloor = {
    level: f.level + 1, rooms: mine.map((r) => ({ ...clone(r), name: nm(r.name)!, unit: to })),
    doors: (f.doors ?? []).filter((d) => d.rooms.some((n) => nm(n)) && d.rooms.every((n) => nm(n) || /^outside$/i.test(n))).map((d) => ({ ...clone(d), rooms: d.rooms.map((n) => nm(n) ?? n) as [string, string] })),
    windows: (f.windows ?? []).filter((w) => nm(w.room)).map((w) => ({ ...clone(w), room: nm(w.room)! })),
    fixtures: (f.fixtures ?? []).filter((x) => (x.room ? nm(x.room) : inside(x.center))).map((x) => ({ ...clone(x), room: nm(x.room) })),
  };
  let ui = sk.floors.findIndex((x) => x.level === f.level + 1);
  const floors = sk.floors.map((x) => ({ ...x }));
  if (ui < 0) {
    const ORD = ["Ground", "First", "Second", "Third", "Fourth", "Fifth"];
    floors.push({ name: add.level < ORD.length ? `${ORD[add.level]} floor` : `Level ${add.level}`, level: add.level, rooms: [], doors: [], windows: [], fixtures: [] });
    ui = floors.length - 1;
  }
  const up = floors[ui];
  // where the floor above already has rooms in that spot, the copy doesn't go on top of them
  const clash = add.rooms.some((r) => { const a = bboxOf(r.polygon); return up.rooms.some((o) => { const b = bboxOf(o.polygon); return Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 20 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 20; }); });
  if (clash) return null;
  floors[ui] = { ...up, rooms: [...up.rooms, ...add.rooms], doors: [...(up.doors ?? []), ...add.doors!], windows: [...(up.windows ?? []), ...add.windows!], fixtures: [...(up.fixtures ?? []), ...add.fixtures!] };
  return { sketch: { ...sk, floors }, name: to, fi: ui };
}
