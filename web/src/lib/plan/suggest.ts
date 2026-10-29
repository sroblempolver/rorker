// A client's suggested changes to the plan. The client draws on a copy of the contractor's sketch; the
// two sketches are compared here into a list of plain changes ("Kitchen: 12' 0" wide → 13' 6"",
// "Added a window in Bedroom 2, north side", "Moved the sofa"), each with an id that stays the same
// for the same two sketches. The contractor approves all of them or some, and only those are put into
// the real sketch. Sketch rooms have no ids, so rooms are matched by name (a rename is a room whose
// outline didn't change), doors by the rooms they join, windows by room and side, and furniture by
// kind and nearest spot.
import type { Pt } from "./types";
import type { Sketch, SketchDoor, SketchFixture, SketchFloor, SketchRoom, SketchStair, SketchWindow } from "./sketch";
import { bboxOf } from "./geometry";
import { CATALOG } from "./catalog";
import { fmtLen, type Units } from "./units";
import { sharedEdge } from "./sketchEdit";

export type ChangeKind = "house" | "floor" | "room" | "door" | "window" | "thing" | "stair";
interface ChangeBase {
  id: string; what: "add" | "remove" | "edit"; text: string;
  /** the floor's level, and its name to show beside the change */
  level: number; floorName: string;
  /** the rooms it touches (their names in the suggested version), to light them up */
  rooms: string[];
  /** other changes it can't go in without (a door into a room that's being added) */
  needs?: string[];
  /** the client's room names that are the plan's under another name (suggested -> plan) */
  names?: Record<string, string>;
}
export type Change = ChangeBase & (
  | { kind: "house"; field: HouseField; before?: number | string; after?: number | string }
  | { kind: "floor"; part?: "name" | "height"; before?: SketchFloor; after?: SketchFloor }
  | { kind: "room"; part?: "name" | "type" | "unit" | "shape"; before?: SketchRoom; after?: SketchRoom }
  | { kind: "door"; before?: SketchDoor; after?: SketchDoor }
  | { kind: "window"; before?: SketchWindow; after?: SketchWindow }
  | { kind: "thing"; before?: SketchFixture; after?: SketchFixture }
  | { kind: "stair"; before?: SketchStair; after?: SketchStair }
);
type HouseField = "roof" | "roof_pitch_deg" | "eave_mm" | "plinth_mm" | "storey_height_mm";
const HOUSE: { k: HouseField; label: string; len?: boolean; deg?: boolean }[] = [
  { k: "roof", label: "Roof" }, { k: "roof_pitch_deg", label: "Roof pitch", deg: true }, { k: "eave_mm", label: "Roof overhang", len: true },
  { k: "plinth_mm", label: "Foundation height", len: true }, { k: "storey_height_mm", label: "Floor to floor", len: true },
];

const low = (s?: string) => (s ?? "").trim().toLowerCase();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const polyKey = (p: Pt[]) => p.map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).join(" ");
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const TYPE_LABEL: Record<string, string> = { wc: "WC", stair_hall: "Stair hall" };
const typeLabel = (t?: string) => (t ? TYPE_LABEL[t] ?? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ") : "Other");
const thingName = (f: SketchFixture) => (CATALOG[f.kind]?.label ?? f.name ?? f.kind.replace(/_/g, " ")).toLowerCase();
const doorName = (d: SketchDoor) => ({ double_door: "double door", sliding_door: "sliding door", garage_door: "garage door", opening: "opening" } as Record<string, string>)[d.kind ?? ""] ?? "door";
const isOut = (n?: string) => !n || /^(outside|exterior|out|garden|yard|street)$/i.test(n.trim());
const doorWhere = (d: SketchDoor) => (isOut(d.rooms[1]) ? `the outside ${doorName(d)} of ${d.rooms[0]}${d.side ? ` (${d.side} side)` : ""}` : `the ${doorName(d)} between ${d.rooms[0]} and ${d.rooms[1]}`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Compare the plan with the client's version: every difference as one change, plan order. */
export function diffSketches(base: Sketch, mine: Sketch, u: Units = "ft"): Change[] {
  const out: Change[] = [];
  const ids = new Map<string, number>();
  const push = (c: Omit<ChangeBase, "id" | "floorName"> & { floorName?: string } & Record<string, unknown>, key: string) => {
    const n = ids.get(key) ?? 0;
    ids.set(key, n + 1);
    out.push({ floorName: "", ...c, id: n ? `${key}#${n + 1}` : key } as Change);
    return out[out.length - 1].id;
  };
  const L = (mm: number) => fmtLen(mm, u);

  for (const h of HOUSE) {
    const b = base[h.k], a = mine[h.k];
    if (b === a || (b == null && a == null)) continue;
    const show = (v?: number | string) => (v == null ? "standard" : h.len ? L(+v) : h.deg ? `${v}°` : String(v));
    push({ kind: "house", what: "edit", field: h.k, before: b, after: a, level: 0, rooms: [], text: `${h.label}: ${show(b)} → ${show(a)}` }, `house:${h.k}`);
  }

  const levels = [...new Set([...base.floors.map((f) => f.level), ...mine.floors.map((f) => f.level)])].sort((x, y) => x - y);
  const many = levels.length > 1;
  for (const lv of levels) {
    const B = base.floors.find((f) => f.level === lv), A = mine.floors.find((f) => f.level === lv);
    const floorName = many ? (A ?? B)?.name || `Level ${lv}` : "";
    if (!B && A) { push({ kind: "floor", what: "add", after: A, level: lv, floorName, rooms: A.rooms.map((r) => r.name), text: `Added ${A.name || `level ${lv}`} with ${plural(A.rooms.length, "room")}` }, `floor:${lv}:add`); continue; }
    if (B && !A) { push({ kind: "floor", what: "remove", before: B, level: lv, floorName, rooms: [], text: `Removed ${B.name || `level ${lv}`}` }, `floor:${lv}:remove`); continue; }
    if (!A || !B) continue;
    const at = { level: lv, floorName };
    if ((B.name ?? "") !== (A.name ?? "")) push({ kind: "floor", what: "edit", part: "name", before: B, after: A, ...at, rooms: [], text: `Renamed ${B.name || "the floor"} to ${A.name}` }, `floor:${lv}:name`);
    if (B.height_mm !== A.height_mm) push({ kind: "floor", what: "edit", part: "height", before: B, after: A, ...at, rooms: [], text: `${A.name || "Floor"}: ceiling ${B.height_mm ? L(B.height_mm) : "standard"} → ${A.height_mm ? L(A.height_mm) : "standard"}` }, `floor:${lv}:height`);

    // rooms: by name, then a room whose outline didn't change under a new name is a rename
    const pairs: [SketchRoom, SketchRoom][] = [];
    const leftB = B.rooms.filter((r) => { const m = A.rooms.find((x) => low(x.name) === low(r.name)); if (m) pairs.push([r, m]); return !m; });
    let leftA = A.rooms.filter((r) => !B.rooms.some((x) => low(x.name) === low(r.name)));
    const lostB: SketchRoom[] = [];
    for (const r of leftB) {
      const m = leftA.find((x) => polyKey(x.polygon) === polyKey(r.polygon)) ?? (leftB.length === 1 && leftA.length === 1 && overlaps(r.polygon, leftA[0].polygon) ? leftA[0] : undefined);
      if (m) { pairs.push([r, m]); leftA = leftA.filter((x) => x !== m); } else lostB.push(r);
    }
    // the client's names for the plan's rooms (only where they differ)
    const names: Record<string, string> = {};
    for (const [b, a] of pairs) if (low(b.name) !== low(a.name)) names[a.name] = b.name;
    const toMine = (n: string) => { const e = Object.entries(names).find(([, b]) => low(b) === low(n)); return e ? e[0] : n; };
    const roomKey = (n: string) => `room:${lv}:${low(n)}`;
    const added = new Map<string, string>();

    for (const [b, a] of pairs) {
      const k = roomKey(b.name), nm = { names };
      if (low(b.name) !== low(a.name)) push({ kind: "room", what: "edit", part: "name", before: b, after: a, ...at, ...nm, rooms: [a.name], text: `Renamed ${b.name} to ${a.name}` }, `${k}:name`);
      if ((b.type ?? "other") !== (a.type ?? "other")) push({ kind: "room", what: "edit", part: "type", before: b, after: a, ...at, ...nm, rooms: [a.name], text: `${a.name}: ${typeLabel(b.type)} → ${typeLabel(a.type)}` }, `${k}:type`);
      if ((b.unit ?? "") !== (a.unit ?? "")) push({ kind: "room", what: "edit", part: "unit", before: b, after: a, ...at, ...nm, rooms: [a.name], text: a.unit ? `${a.name}: moved into ${a.unit}` : `${a.name}: taken out of ${b.unit}` }, `${k}:unit`);
      if (polyKey(b.polygon) !== polyKey(a.polygon)) push({ kind: "room", what: "edit", part: "shape", before: b, after: a, ...at, ...nm, rooms: [a.name], text: shapeText(a.name, b.polygon, a.polygon, u) }, `${k}:shape`);
    }
    // two rooms whose shared wall was slid go in together (one gets bigger as the other gets smaller)
    const shaped = out.filter((c): c is Extract<Change, { kind: "room" }> => c.kind === "room" && c.part === "shape" && c.level === lv);
    for (const x of shaped) for (const y of shaped) {
      if (x === y) continue;
      const before = sharedEdge(x.before!.polygon, y.before!.polygon), after = sharedEdge(x.after!.polygon, y.after!.polygon);
      if (before && after && !same(before, after)) x.needs = [...(x.needs ?? []), y.id];
    }
    for (const r of lostB) push({ kind: "room", what: "remove", before: r, ...at, rooms: [], text: `Removed ${r.name}` }, `${roomKey(r.name)}:remove`);
    for (const r of leftA) {
      const bb = bboxOf(r.polygon);
      added.set(low(r.name), push({ kind: "room", what: "add", after: r, ...at, rooms: [r.name], text: `Added a room: ${r.name}, ${L(bb[2] - bb[0])} × ${L(bb[3] - bb[1])}` }, `${roomKey(r.name)}:add`));
    }
    const gone = new Set(lostB.map((r) => low(r.name)));
    const needs = (list: (string | undefined)[]) => { const n = list.map((x) => added.get(low(x))).filter((x): x is string => !!x); return n.length ? { needs: n } : {}; };

    // doors, by the rooms they join (in the client's names)
    const dKey = (d: SketchDoor) => `${d.rooms.map((n) => (isOut(n) ? "outside" : low(n))).sort().join("+")}|${isOut(d.rooms[1]) ? d.side ?? "" : ""}`;
    const asMine = (d: SketchDoor): SketchDoor => ({ ...d, rooms: d.rooms.map((n) => (isOut(n) ? n : toMine(n))) as [string, string] });
    matchUp(B.doors ?? [], A.doors ?? [], (d) => dKey(asMine(d)), dKey, (b, a) => same(asMine(b), a), (b, a) => {
      const k = `door:${lv}:${dKey(asMine((b ?? a)!))}`;
      if (b && a) {
        const bits: string[] = [];
        if ((b.kind ?? "door") !== (a.kind ?? "door")) bits.push(`now a ${doorName(a)}`);
        if ((b.at ?? 0.5) !== (a.at ?? 0.5)) bits.push("moved along the wall");
        if (b.width_mm !== a.width_mm) bits.push(`${a.width_mm ? L(a.width_mm) : "standard"} wide`);
        if (b.height_mm !== a.height_mm) bits.push(`${a.height_mm ? L(a.height_mm) : "standard"} high`);
        const t = doorWhere(asMine(b));
        push({ kind: "door", what: "edit", before: b, after: a, ...at, names, rooms: a.rooms.filter((n) => !isOut(n)), text: `${t.charAt(0).toUpperCase()}${t.slice(1)}: ${bits.join(", ") || "changed"}` }, k);
      } else if (a) push({ kind: "door", what: "add", after: a, ...at, names, ...needs(a.rooms), rooms: a.rooms.filter((n) => !isOut(n)), text: `Added ${doorWhere(a).replace(/^the /, "a ")}` }, k);
      else if (b && !b.rooms.some((n) => gone.has(low(n)))) push({ kind: "door", what: "remove", before: b, ...at, names, rooms: asMine(b).rooms.filter((n) => !isOut(n)), text: `Removed ${doorWhere(asMine(b))}` }, k);
    });

    // windows, by room and side
    const wKey = (w: SketchWindow) => `${low(w.room)}|${w.side}`;
    const wMine = (w: SketchWindow): SketchWindow => ({ ...w, room: toMine(w.room) });
    matchUp(B.windows ?? [], A.windows ?? [], (w) => wKey(wMine(w)), wKey, (b, a) => same(wMine(b), a), (b, a) => {
      const k = `window:${lv}:${wKey(wMine((b ?? a)!))}`;
      if (b && a) {
        const bits: string[] = [];
        if ((b.count ?? 1) !== (a.count ?? 1)) bits.push(`${plural(b.count ?? 1, "window")} → ${a.count ?? 1}`);
        if (b.width_mm !== a.width_mm) bits.push(`${a.width_mm ? L(a.width_mm) : "standard"} wide`);
        if (b.height_mm !== a.height_mm || b.sill_mm !== a.sill_mm) bits.push("new height");
        if (!same(b.at, a.at)) bits.push("moved along the wall");
        push({ kind: "window", what: "edit", before: b, after: a, ...at, names, rooms: [a.room], text: `${a.room}, ${a.side} side: ${bits.join(", ") || "changed"}` }, k);
      } else if (a) push({ kind: "window", what: "add", after: a, ...at, names, ...needs([a.room]), rooms: [a.room], text: `Added ${(a.count ?? 1) > 1 ? `${a.count} windows` : "a window"} in ${a.room}, ${a.side} side` }, k);
      else if (b && !gone.has(low(b.room))) push({ kind: "window", what: "remove", before: b, ...at, names, rooms: [toMine(b.room)], text: `Removed the ${(b.count ?? 1) > 1 ? "windows" : "window"} in ${toMine(b.room)}, ${b.side} side` }, k);
    });

    // furniture: the same kind, untouched ones first, then the nearest
    const fMine = (f: SketchFixture): SketchFixture => (f.room ? { ...f, room: toMine(f.room) } : f);
    const seen = new Map<string, number>();
    matchUp(B.fixtures ?? [], A.fixtures ?? [], (f) => f.kind, (f) => f.kind, (b, a) => same(fMine(b), a), (b, a) => {
      const f = (a ?? b)!, n = (seen.get(f.kind) ?? 0) + 1;
      seen.set(f.kind, n);
      const k = `thing:${lv}:${f.kind}:${n}`, the = `the ${thingName(f)}`;
      if (b && a) {
        const bits: string[] = [];
        const moved = Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1]) > 5;
        if (b.width_mm !== a.width_mm || b.depth_mm !== a.depth_mm) bits.push(`${L(a.width_mm ?? 600)} × ${L(a.depth_mm ?? 600)}`);
        if (b.facing !== a.facing && a.facing) bits.push(`facing ${a.facing}`);
        if (b.height_mm !== a.height_mm || b.elevation_mm !== a.elevation_mm) bits.push("new height");
        const into = moved && a.room && low(toMine(b.room ?? "")) !== low(a.room) ? ` to ${a.room}` : "";
        const text = moved ? `Moved ${the}${into}${bits.length ? `, ${bits.join(", ")}` : ""}` : `${the.charAt(4).toUpperCase()}${the.slice(5)}: ${bits.join(", ") || "changed"}`;
        push({ kind: "thing", what: "edit", before: b, after: a, ...at, names, rooms: a.room ? [a.room] : [], text }, k);
      } else if (a) push({ kind: "thing", what: "add", after: a, ...at, names, ...needs([a.room]), rooms: a.room ? [a.room] : [], text: `Added a ${thingName(a)}${a.room ? ` in ${a.room}` : ""}` }, k);
      else if (b) push({ kind: "thing", what: "remove", before: b, ...at, names, rooms: [], text: `Removed ${the}${b.room ? ` from ${toMine(b.room)}` : ""}` }, k);
    });

    // stairs, nearest first
    let sn = 0;
    const stairRoom = (st: SketchStair) => A.rooms.find((r) => inPoly(st.at, r.polygon))?.name;
    const shapeName = (st: SketchStair) => (st.shape === "straight" ? "stairs" : `${st.shape}-shaped stairs`);
    matchUp(B.stairs ?? [], A.stairs ?? [], () => "stair", () => "stair", same, (b, a) => {
      const k = `stair:${lv}:${++sn}`, st = (a ?? b)!, rm = stairRoom(st), where = rm ? ` in ${rm}` : "";
      if (b && a) {
        const bits: string[] = [];
        if (Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]) > 5 || a.rotation !== b.rotation) bits.push("moved");
        if (a.shape !== b.shape) bits.push(`now ${shapeName(a)}`);
        if (a.width_mm !== b.width_mm) bits.push(`${a.width_mm ? L(a.width_mm) : "standard"} wide`);
        if (a.risers !== b.risers || a.tread_mm !== b.tread_mm || a.landing_mm !== b.landing_mm || a.turn !== b.turn || a.split !== b.split) bits.push("new steps");
        push({ kind: "stair", what: "edit", before: b, after: a, ...at, rooms: rm ? [rm] : [], text: `The stairs${where}: ${bits.join(", ") || "changed"}` }, k);
      } else if (a) push({ kind: "stair", what: "add", after: a, ...at, rooms: rm ? [rm] : [], text: `Added ${shapeName(a)}${where}` }, k);
      else if (b) push({ kind: "stair", what: "remove", before: b, ...at, rooms: [], text: "Removed the stairs" }, k);
    });
  }
  return out;
}

/** Pair up two lists by group: equal ones first, then in order (furniture: nearest first). */
function matchUp<T>(B: T[], A: T[], keyB: (x: T) => string, keyA: (x: T) => string, eq: (b: T, a: T) => boolean, each: (b: T | null, a: T | null) => void) {
  const left = new Set(A);
  const pairs: [T | null, T | null][] = [];
  const restB: T[] = [];
  for (const b of B) {
    const m = A.find((a) => left.has(a) && keyA(a) === keyB(b) && eq(b, a));
    if (m) left.delete(m); else restB.push(b);
  }
  const near = (b: T, a: T) => { const spot = (x: T) => (x as { center?: Pt }).center ?? (x as { at?: unknown }).at; const cb = spot(b), ca = spot(a); return Array.isArray(cb) && Array.isArray(ca) ? Math.hypot(cb[0] - ca[0], cb[1] - ca[1]) : 0; };
  for (const b of restB) {
    const m = [...left].filter((a) => keyA(a) === keyB(b)).sort((x, y) => near(b, x) - near(b, y))[0];
    if (m) { left.delete(m); pairs.push([b, m]); } else pairs.push([b, null]);
  }
  for (const a of A) if (left.has(a)) pairs.push([null, a]);
  for (const [b, a] of pairs) each(b, a);
}

function inPoly(p: Pt, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function overlaps(p: Pt[], q: Pt[]) {
  const a = bboxOf(p), b = bboxOf(q);
  return Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 300 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 300;
}

function shapeText(name: string, before: Pt[], after: Pt[], u: Units) {
  const b = bboxOf(before), a = bboxOf(after), L = (mm: number) => fmtLen(mm, u);
  const [wb, db, wa, da] = [b[2] - b[0], b[3] - b[1], a[2] - a[0], a[3] - a[1]];
  const dw = Math.abs(wa - wb) > 5, dd = Math.abs(da - db) > 5;
  const dx = a[0] - b[0], dy = a[1] - b[1];
  const shifted = before.length === after.length && before.every((p, i) => Math.abs(after[i][0] - p[0] - dx) < 5 && Math.abs(after[i][1] - p[1] - dy) < 5);
  if (shifted) {
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "east" : "west") : dy > 0 ? "south" : "north";
    return `Moved ${name} ${L(Math.max(Math.abs(dx), Math.abs(dy)))} ${dir}`;
  }
  if (dw && dd) return `${name}: ${L(wb)} × ${L(db)} → ${L(wa)} × ${L(da)}`;
  if (dw) return `${name}: ${L(wb)} wide → ${L(wa)}`;
  if (dd) return `${name}: ${L(db)} deep → ${L(da)}`;
  return `Reshaped ${name}`;
}

/** The same room names, doors, windows and furniture with one room renamed (like the editor does). */
export function renameIn(f: SketchFloor, from: string, to: string): SketchFloor {
  const is = (n?: string) => !!n && low(n) === low(from);
  return {
    ...f, rooms: f.rooms.map((r) => (is(r.name) ? { ...r, name: to } : r)),
    doors: (f.doors ?? []).map((d) => ({ ...d, rooms: d.rooms.map((n) => (is(n) ? to : n)) as [string, string] })),
    windows: (f.windows ?? []).map((w) => (is(w.room) ? { ...w, room: to } : w)),
    fixtures: (f.fixtures ?? []).map((x) => (is(x.room) ? { ...x, room: to } : x)),
  };
}

const ORDER: Record<string, number> = { house: 0, "floor:add": 1, "floor:edit": 2, "room:add": 3, "room:edit": 4, door: 6, window: 6, thing: 6, stair: 6, "room:remove": 7, "floor:remove": 8 };
const rank = (c: Change) => (c.kind === "room" && c.part === "name" ? 5 : ORDER[`${c.kind}:${c.what}`] ?? ORDER[c.kind] ?? 6);

/**
 * Put some of the changes into a sketch (the plan as it is now, which may have moved on since the
 * client looked). Each change finds what it changes by what it was; one that no longer finds it is
 * skipped, so approving twice, or after the contractor changed that room, never breaks the plan.
 */
export function applyChanges(sk: Sketch, changes: Change[]): Sketch {
  const out = clone(sk);
  for (const c of [...changes].sort((x, y) => rank(x) - rank(y))) {
    if (c.kind === "house") { const o = out as unknown as Record<string, unknown>; if (c.after == null) delete o[c.field]; else o[c.field] = c.after; continue; }
    if (c.kind === "floor" && c.what === "add") { if (c.after && !out.floors.some((f) => f.level === c.level)) out.floors.push(clone(c.after)); continue; }
    const fi = out.floors.findIndex((f) => f.level === c.level);
    if (fi < 0) continue;
    let f = out.floors[fi];
    if (c.kind === "floor") {
      if (c.what === "remove") { if (out.floors.length > 1) out.floors.splice(fi, 1); continue; }
      if (c.part === "name") f = { ...f, name: c.after?.name };
      if (c.part === "height") f = { ...f, height_mm: c.after?.height_mm };
      out.floors[fi] = f;
      continue;
    }
    // a name as it is in the plan now: the client's own, or the plan's when the rename wasn't taken
    const here = (n?: string) => {
      if (!n || isOut(n) || f.rooms.some((r) => low(r.name) === low(n))) return n;
      const alt = c.names?.[n] ?? Object.entries(c.names ?? {}).find(([, b]) => low(b) === low(n))?.[0];
      return alt && f.rooms.some((r) => low(r.name) === low(alt)) ? alt : n;
    };
    const eqName = (x?: string, y?: string) => low(here(x)) === low(here(y));
    if (c.kind === "room") {
      const find = () => f.rooms.findIndex((r) => [c.before?.name, c.after?.name].some((n) => n && low(r.name) === low(n)));
      if (c.what === "add") { if (c.after && !f.rooms.some((r) => low(r.name) === low(c.after!.name))) f = { ...f, rooms: [...f.rooms, clone(c.after)] }; }
      else if (c.what === "remove") {
        const i = find();
        if (i >= 0) { const n = low(f.rooms[i].name); f = { ...f, rooms: f.rooms.filter((_, k) => k !== i), doors: (f.doors ?? []).filter((d) => !d.rooms.some((x) => low(x) === n)), windows: (f.windows ?? []).filter((w) => low(w.room) !== n) }; }
      } else {
        const i = find(), a = c.after;
        if (i >= 0 && a) {
          if (c.part === "name") f = renameIn(f, f.rooms[i].name, a.name);
          else f = { ...f, rooms: f.rooms.map((r, k) => (k !== i ? r : c.part === "type" ? { ...r, type: a.type } : c.part === "unit" ? { ...r, unit: a.unit } : { ...r, polygon: clone(a.polygon) })) };
        }
      }
    } else if (c.kind === "door") {
      const fix = (d: SketchDoor): SketchDoor => ({ ...clone(d), rooms: d.rooms.map((n) => here(n) ?? n) as [string, string] });
      const list = f.doors ?? [];
      const b = c.before;
      const i = b ? list.findIndex((d) => d.rooms.every((n, k) => eqName(n, b.rooms[k])) && same({ ...d, rooms: 0 }, { ...b, rooms: 0 })) : -1;
      if (c.what === "add" && c.after) f = { ...f, doors: [...list, fix(c.after)] };
      else if (i >= 0) f = { ...f, doors: c.what === "remove" ? list.filter((_, k) => k !== i) : list.map((d, k) => (k === i ? fix(c.after!) : d)) };
    } else if (c.kind === "window") {
      const fix = (w: SketchWindow): SketchWindow => ({ ...clone(w), room: here(w.room) ?? w.room });
      const list = f.windows ?? [];
      const b = c.before;
      const i = b ? list.findIndex((w) => eqName(w.room, b.room) && same({ ...w, room: 0 }, { ...b, room: 0 })) : -1;
      if (c.what === "add" && c.after) {
        // the same room and side already has windows: take the client's count
        const j = list.findIndex((w) => eqName(w.room, c.after!.room) && w.side === c.after!.side);
        f = { ...f, windows: j >= 0 ? list.map((w, k) => (k === j ? fix(c.after!) : w)) : [...list, fix(c.after)] };
      } else if (i >= 0) f = { ...f, windows: c.what === "remove" ? list.filter((_, k) => k !== i) : list.map((w, k) => (k === i ? fix(c.after!) : w)) };
    } else if (c.kind === "thing") {
      const fix = (x: SketchFixture): SketchFixture => ({ ...clone(x), ...(x.room ? { room: here(x.room) } : {}) });
      const list = f.fixtures ?? [];
      const b = c.before;
      const i = b ? list.findIndex((x) => x.kind === b.kind && eqName(x.room, b.room) && same({ ...x, room: 0 }, { ...b, room: 0 })) : -1;
      if (c.what === "add" && c.after) f = { ...f, fixtures: [...list, fix(c.after)] };
      else if (i >= 0) f = { ...f, fixtures: c.what === "remove" ? list.filter((_, k) => k !== i) : list.map((x, k) => (k === i ? fix(c.after!) : x)) };
    } else if (c.kind === "stair") {
      const list = f.stairs ?? [];
      const i = c.before ? list.findIndex((x) => same(x, c.before)) : -1;
      if (c.what === "add" && c.after) f = { ...f, stairs: [...list, clone(c.after)] };
      else if (i >= 0) f = { ...f, stairs: c.what === "remove" ? list.filter((_, k) => k !== i) : list.map((x, k) => (k === i ? clone(c.after!) : x)) };
    }
    out.floors[fi] = f;
  }
  return out;
}

/** The changes to put in for the ones picked: each with what it needs. */
export function withNeeds(all: Change[], picked: Set<string>): Change[] {
  const want = new Set(picked);
  for (let grew = true; grew;) { grew = false; for (const c of all) if (want.has(c.id)) for (const n of c.needs ?? []) if (!want.has(n)) { want.add(n); grew = true; } }
  return all.filter((c) => want.has(c.id));
}

/** What the changes light up on a floor of the suggested version: room numbers and furniture numbers. */
export function marksOn(mine: Sketch, fi: number, changes: Change[]): { rooms: number[]; things: number[] } {
  const f = mine.floors[fi];
  if (!f) return { rooms: [], things: [] };
  const here = changes.filter((c) => c.level === f.level);
  const names = new Set(here.flatMap((c) => (c.kind === "thing" ? [] : c.rooms.map(low))));
  const things = here.flatMap((c) => (c.kind === "thing" && c.after ? [c.after] : []));
  return {
    rooms: f.rooms.map((r, i) => (names.has(low(r.name)) ? i : -1)).filter((i) => i >= 0),
    things: (f.fixtures ?? []).map((x, i) => (things.some((t) => same(t, x)) ? i : -1)).filter((i) => i >= 0),
  };
}

/** The change the other way round: put back what it changed (a client taking back one suggestion). */
export function reverse(c: Change): Change {
  const what = c.what === "add" ? "remove" : c.what === "remove" ? "add" : "edit";
  const names = c.names ? Object.fromEntries(Object.entries(c.names).map(([a, b]) => [b, a])) : undefined;
  return { ...c, what, before: c.after, after: c.before, names } as Change;
}
