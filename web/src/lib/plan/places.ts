// Places you can tag in a message ("@Bedroom 1 › Bed needs replacing"): every room, and every object in
// a room, with a name people would say. Clicking the tag later takes the map there and puts the
// assistant's blinking dot on it. No React here: the `build` function checks tags with it too.
import type { Plan } from "./types";
import { bboxOf, findElement, labelPoint } from "./geometry";
import { topOf } from "./catalog";
import type { Mark } from "./pointing";
import type { PlaceTag } from "./tags";

export { cleanPlaces, spokenTags, withTags, type PlaceTag } from "./tags";

const clean = (s: string) => s.replace(/\s*\((likely|probably|maybe)\)\s*$/i, "").trim() || "Item";

/** Numbers names that repeat ("Bedroom 1", "Bedroom 2"); a name that's there once stays as it is. */
function numbered<T>(list: T[], name: (t: T) => string): Map<T, string> {
  const count = new Map<string, number>();
  for (const t of list) count.set(name(t), (count.get(name(t)) ?? 0) + 1);
  const seen = new Map<string, number>();
  return new Map(list.map((t) => {
    const n = name(t);
    if (count.get(n)! < 2) return [t, n];
    const i = (seen.get(n) ?? 0) + 1;
    seen.set(n, i);
    return [t, `${n} ${i}`];
  }));
}

/** Every room, then the objects in it ("Kitchen › Sink"), in plan order. */
export function placeOptions(plan: Plan): PlaceTag[] {
  const rooms = plan.floors.flatMap((f) => f.rooms);
  const roomName = numbered(rooms, (r) => r.name || "Room");
  const out: PlaceTag[] = [];
  for (const f of plan.floors) for (const r of f.rooms) {
    const rn = roomName.get(r);
    if (!rn) continue;
    out.push({ id: r.id, label: rn });
    const things = f.fixtures.filter((x) => x.room_id === r.id);
    const thingName = numbered(things, (x) => clean(x.name));
    for (const x of things) out.push({ id: x.id, label: `${rn} › ${thingName.get(x)}` });
  }
  return out;
}

/** Where a place is, for a dot on the plan. */
export function markFor(plan: Plan, id: string, label: string, color: string): Mark | null {
  const e = findElement(plan, id);
  if (!e) return null;
  let pt: [number, number], z = 0;
  if (e.kind === "fixture") { pt = e.el.center; z = topOf(e.el); }
  else if (e.kind === "opening") { pt = [(e.el.a[0] + e.el.b[0]) / 2, (e.el.a[1] + e.el.b[1]) / 2]; z = 1000; }
  else if (e.kind === "room") pt = labelPoint(e.el.polygon);
  else { const b = bboxOf(e.el.polygon); pt = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; z = e.kind === "wall" ? 1200 : 0; }
  return { floor_id: e.floor.id, x: Math.round(pt[0]), y: Math.round(pt[1]), z: Math.round(z), label, color, id };
}
