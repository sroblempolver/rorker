// The company's library of saved rooms and houses: a bathroom laid out the way the company always does
// it, a kitchen with its cabinets, a whole house plan to start the next one from. A saved room keeps its
// outline, its furniture and cabinets, and the doors and windows on its own walls, all measured from its
// top-left corner, so it can be dropped anywhere. A door on its outside goes to whatever room is next to
// it where it lands (or outside). Saved in the browser for now (the preview); a company table in
// Supabase later (company_id, kind, name, piece or sketch, created_by, created_at).
import { useSyncExternalStore } from "react";
import type { Pt } from "./types";
import type { Side, Sketch, SketchDoor, SketchFixture, SketchFloor, SketchRoom, SketchWindow } from "./sketch";
import { bboxOf } from "./geometry";
import { OUTSIDE, doorSpot, edgesOf, nearSeg, sideOf, wallAt } from "./sketchEdit";

/** A door of a saved room: between two of its rooms, or on its outside (which room, side, how far along 0 to 1). */
export type PieceDoor = Omit<SketchDoor, "rooms" | "at" | "side"> & { rooms?: [string, string]; at?: number; edge?: { room: string; side: Side; t: number } };
/** One or a few rooms with what's in them, measured from their top-left corner. */
export interface Piece { rooms: SketchRoom[]; doors?: PieceDoor[]; windows?: SketchWindow[]; fixtures?: SketchFixture[] }
export interface LibItem {
  id: string; kind: "room" | "house"; name: string; note?: string;
  /** one of the starters that come with Rorker (can't be deleted) */
  starter?: boolean;
  created_at: string;
  piece?: Piece; sketch?: Sketch;
}

const low = (s?: string) => (s ?? "").trim().toLowerCase();
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const r10 = (v: number) => Math.round(v / 10) * 10;

/** A room of the floor, with its things and the doors and windows on its walls, as a piece to save. */
export function pieceOf(f: SketchFloor, ri: number): Piece {
  const r = f.rooms[ri], [x0, y0, x1, y1] = bboxOf(r.polygon), w = x1 - x0 || 1, h = y1 - y0 || 1;
  const sh = (p: Pt): Pt => [p[0] - x0, p[1] - y0];
  const mine = (n?: string) => low(n) === low(r.name);
  const doors: PieceDoor[] = [];
  for (const d of f.doors ?? []) {
    if (!d.rooms.some(mine)) continue;
    const s = doorSpot(f, d);
    if (!s) continue;
    const m: Pt = [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2];
    const e = edgesOf(r.polygon).map((q) => ({ q, d: nearSeg(m, q).d })).sort((a, b) => a.d - b.d)[0];
    const side = e ? sideOf(r.polygon, e.q) : d.side ?? "south";
    const t = side === "north" || side === "south" ? (m[0] - x0) / w : (m[1] - y0) / h;
    const { rooms: _r, at: _a, side: _s, ...rest } = d; // eslint-disable-line @typescript-eslint/no-unused-vars
    doors.push({ ...rest, edge: { room: r.name, side, t: Math.round(t * 100) / 100 } });
  }
  return {
    rooms: [{ ...clone(r), polygon: r.polygon.map(sh) }],
    doors,
    windows: (f.windows ?? []).filter((x) => mine(x.room)).map(clone),
    fixtures: (f.fixtures ?? []).filter((x) => mine(x.room)).map((x) => ({ ...clone(x), center: sh(x.center) })),
  };
}

export const pieceSize = (p: Piece): [number, number] => { const b = bboxOf(p.rooms.flatMap((r) => r.polygon)); return [b[2] - b[0], b[3] - b[1]]; };

/**
 * The floor with a piece put down with its top-left corner at `at`. Room names that are taken get a
 * number. Null when it would sit on top of a room that's there.
 */
export function placePiece(f: SketchFloor, p: Piece, at: Pt, taken: Set<string>): { floor: SketchFloor; rooms: number[] } | null {
  const mv = (q: Pt): Pt => [r10(q[0] + at[0]), r10(q[1] + at[1])];
  const names = new Map<string, string>();
  const used = new Set([...taken].map(low));
  for (const r of p.rooms) { let n = r.name, k = 2; while (used.has(low(n))) n = `${r.name} ${k++}`; used.add(low(n)); names.set(low(r.name), n); }
  const nm = (n?: string) => (n ? names.get(low(n)) ?? n : n);
  const rooms = p.rooms.map((r) => ({ ...clone(r), name: nm(r.name)!, polygon: r.polygon.map(mv) }));
  for (const r of rooms) {
    const a = bboxOf(r.polygon);
    for (const o of f.rooms) { const b = bboxOf(o.polygon); if (Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 20 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 20) return null; }
  }
  let g: SketchFloor = {
    ...f, rooms: [...f.rooms, ...rooms],
    windows: [...(f.windows ?? []), ...(p.windows ?? []).map((w) => ({ ...clone(w), room: nm(w.room)! }))],
    fixtures: [...(f.fixtures ?? []), ...(p.fixtures ?? []).map((x) => ({ ...clone(x), room: nm(x.room), center: mv(x.center) }))],
  };
  const doors: SketchDoor[] = [];
  for (const d of p.doors ?? []) {
    const { edge, rooms: two, ...rest } = d;
    if (two) { doors.push({ ...rest, rooms: two.map((n) => (OUTSIDE.test(n) ? n : nm(n)!)) as [string, string] }); continue; }
    if (!edge) continue;
    const ri = g.rooms.findIndex((r) => low(r.name) === low(nm(edge.room)));
    if (ri < 0) continue;
    const [x0, y0, x1, y1] = bboxOf(g.rooms[ri].polygon);
    const pt: Pt = edge.side === "north" ? [x0 + edge.t * (x1 - x0), y0] : edge.side === "south" ? [x0 + edge.t * (x1 - x0), y1] : edge.side === "west" ? [x0, y0 + edge.t * (y1 - y0)] : [x1, y0 + edge.t * (y1 - y0)];
    const w = wallAt(g, pt, 40);
    if (!w) continue;
    const [a, b] = w.rooms, t = Math.round(w.t * 100) / 100;
    // the room next door where it landed, or outside
    doors.push(b == null ? { ...rest, rooms: [g.rooms[a].name, "outside"], side: w.side, at: t } : { ...rest, rooms: [g.rooms[a].name, g.rooms[b].name], at: t });
  }
  g = { ...g, doors: [...(f.doors ?? []), ...doors] };
  return { floor: g, rooms: rooms.map((_, i) => f.rooms.length + i) };
}

// ---- starters: a few rooms every company draws, at the usual US sizes ----
const FT = 304.8, IN = 25.4;
const rect = (x0: number, y0: number, w: number, d: number): Pt[] => [[x0, y0], [x0 + w, y0], [x0 + w, y0 + d], [x0, y0 + d]].map(([x, y]) => [r10(x), r10(y)] as Pt);
/** A thing backed onto a wall: `along` is its middle along that wall, `wall` the wall's line. */
const fx = (kind: string, room: string, facing: Side, wall: number, along: number, w: number, d: number, extra: Partial<SketchFixture> = {}): SketchFixture => {
  const off = facing === "south" || facing === "east" ? wall + d / 2 : wall - d / 2;
  const center: Pt = facing === "south" || facing === "north" ? [r10(along), r10(off)] : [r10(off), r10(along)];
  return { kind, room, center, width_mm: Math.round(w), depth_mm: Math.round(d), facing, ...extra };
};
const out = (room: string, side: Side, t: number, width_mm?: number, kind?: SketchDoor["kind"]): PieceDoor => ({ edge: { room, side, t }, ...(width_mm ? { width_mm: Math.round(width_mm) } : {}), ...(kind ? { kind } : {}) });

function bathroom(): Piece {
  const W = 8 * FT, D = 5 * FT, n = "Bathroom";
  return {
    rooms: [{ name: n, type: "bathroom", polygon: rect(0, 0, W, D) }],
    doors: [out(n, "south", 0.72, 30 * IN)],
    fixtures: [
      fx("bathtub", n, "east", 0, D / 2, 60 * IN, 30 * IN),
      fx("toilet", n, "south", 0, 30 * IN + 18 * IN, 20 * IN, 28 * IN),
      fx("vanity", n, "south", 0, W - 18 * IN, 30 * IN, 21 * IN),
    ],
  };
}
function powder(): Piece {
  const W = 5 * FT, D = 4 * FT, n = "Powder room";
  return {
    rooms: [{ name: n, type: "wc", polygon: rect(0, 0, W, D) }],
    doors: [out(n, "south", 0.5, 28 * IN)],
    fixtures: [fx("toilet", n, "south", 0, 16 * IN, 20 * IN, 28 * IN), fx("washbasin", n, "south", 0, W - 14 * IN, 18 * IN, 16 * IN)],
  };
}
function kitchen(): Piece {
  const W = 12 * FT, D = 10 * FT, n = "Kitchen", B = 24 * IN, U = 12 * IN;
  // an L of base cabinets on the north and west walls, sink under the window, uppers at the corner
  const north: [string, number, number][] = [["base_cabinet", B, B], ["base_cabinet", B, B], ["kitchen_sink", 33 * IN, B], ["dishwasher", B, B], ["fridge", 36 * IN, 30 * IN]];
  let x = 0;
  const fixtures = north.map(([k, w, d]) => { const f = fx(k, n, "south", 0, x + w / 2, w, d); x += w; return f; });
  let y = B;
  for (const [k, w] of [["base_cabinet", B], ["range", 30 * IN], ["base_cabinet", B]] as [string, number][]) { fixtures.push(fx(k, n, "east", 0, y + w / 2, w, B)); y += w; }
  fixtures.push(fx("wall_cabinet", n, "south", 0, B / 2, B, U), fx("wall_cabinet", n, "south", 0, B * 1.5, B, U), fx("wall_cabinet", n, "south", 0, 2 * B + 33 * IN + B / 2, B, U));
  fixtures.push(fx("wall_cabinet", n, "east", 0, B * 1.5, B, U), fx("wall_cabinet", n, "east", 0, B + 30 * IN + B * 1.5, B, U));
  return {
    rooms: [{ name: n, type: "kitchen", polygon: rect(0, 0, W, D) }],
    doors: [out(n, "east", 0.6, 32 * IN)],
    windows: [{ room: n, side: "north", count: 1, width_mm: Math.round(36 * IN), at: [Math.round(((2 * B + 16.5 * IN) / W) * 100) / 100] }],
    fixtures,
  };
}
function bedroom(): Piece {
  const S = 12 * FT, C = 30 * IN, n = "Bedroom", c = "Closet";
  return {
    rooms: [{ name: n, type: "bedroom", polygon: rect(0, C, S, S) }, { name: c, type: "closet", polygon: rect(S / 2, 0, S / 2, C) }],
    doors: [{ rooms: [n, c], kind: "sliding_door", width_mm: Math.round(5 * FT), at: 0.5 }, out(n, "south", 0.8, 32 * IN)],
    windows: [{ room: n, side: "north", count: 1, width_mm: Math.round(36 * IN) }],
    fixtures: [
      fx("bed", n, "east", 0, C + S / 2, 60 * IN, 80 * IN),
      fx("nightstand", n, "east", 0, C + S / 2 - 30 * IN - 12 * IN, 18 * IN, 16 * IN),
      fx("nightstand", n, "east", 0, C + S / 2 + 30 * IN + 12 * IN, 18 * IN, 16 * IN),
      fx("dresser", n, "west", S, C + S / 2, 40 * IN, 19 * IN),
    ],
  };
}
function laundry(): Piece {
  const W = 8 * FT, D = 6 * FT, n = "Laundry";
  return {
    rooms: [{ name: n, type: "laundry", polygon: rect(0, 0, W, D) }],
    doors: [out(n, "south", 0.5, 30 * IN)],
    fixtures: [
      fx("washing_machine", n, "south", 0, 1 * IN + 13.5 * IN, 27 * IN, 28 * IN), fx("dryer", n, "south", 0, 29 * IN + 13.5 * IN, 27 * IN, 28 * IN),
      fx("utility_sink", n, "south", 0, 58 * IN + 12 * IN, 24 * IN, 22 * IN),
      fx("wall_cabinet", n, "south", 0, 1 * IN + 13.5 * IN, 27 * IN, 12 * IN), fx("wall_cabinet", n, "south", 0, 29 * IN + 13.5 * IN, 27 * IN, 12 * IN),
    ],
  };
}
/** A one-bedroom apartment: living room, kitchen, bedroom and bath (a property manager's typical unit). */
function apartment(): Sketch {
  const L = 14 * FT, K = 8 * FT, S = 12 * FT, B = 24 * IN;
  const fixtures: SketchFixture[] = [
    fx("sofa", "Living room", "east", 0, S / 2, 84 * IN, 36 * IN), fx("armchair", "Living room", "north", S, L * 0.6, 34 * IN, 34 * IN),
    fx("bed", "Bedroom", "west", L + S, S / 2, 60 * IN, 80 * IN),
    fx("bathtub", "Bathroom", "west", L + 8 * FT, S + 2.5 * FT, 60 * IN, 30 * IN),
    fx("toilet", "Bathroom", "north", S + 5 * FT, L + 8 * FT - 30 * IN - 18 * IN, 20 * IN, 28 * IN),
    fx("vanity", "Bathroom", "north", S + 5 * FT, L + 18 * IN, 30 * IN, 21 * IN),
  ];
  let x = 0;
  for (const [k, w, d] of [["base_cabinet", B, B], ["kitchen_sink", 33 * IN, B], ["dishwasher", B, B], ["base_cabinet", B, B], ["range", 30 * IN, B], ["fridge", 30 * IN, 30 * IN]] as [string, number, number][]) {
    fixtures.push(fx(k, "Kitchen", "north", S + K, x + w / 2, w, d)); x += w;
  }
  return {
    floors: [{
      name: "Ground floor", level: 0,
      rooms: [
        { name: "Living room", type: "living", polygon: rect(0, 0, L, S) }, { name: "Kitchen", type: "kitchen", polygon: rect(0, S, L, K) },
        { name: "Bedroom", type: "bedroom", polygon: rect(L, 0, S, S) }, { name: "Bathroom", type: "bathroom", polygon: rect(L, S, 8 * FT, 5 * FT) },
      ],
      doors: [
        { rooms: ["Living room", "outside"], side: "west", at: 0.75 }, { rooms: ["Living room", "Kitchen"], kind: "opening", at: 0.6 },
        { rooms: ["Living room", "Bedroom"], at: 0.8 }, { rooms: ["Bedroom", "Bathroom"], at: 0.5, width_mm: Math.round(30 * IN) },
      ],
      windows: [{ room: "Living room", side: "north", count: 2 }, { room: "Bedroom", side: "north", count: 1 }, { room: "Bedroom", side: "east", count: 1 }, { room: "Kitchen", side: "west", count: 1 }],
      fixtures,
    }],
  };
}

const T0 = "2026-01-01T00:00:00.000Z";
export const STARTERS: LibItem[] = [
  { id: "starter-bath", kind: "room", name: "Full bathroom, 5' × 8'", note: "Tub, toilet and vanity", starter: true, created_at: T0, piece: bathroom() },
  { id: "starter-powder", kind: "room", name: "Powder room, 4' × 5'", note: "Toilet and basin", starter: true, created_at: T0, piece: powder() },
  { id: "starter-kitchen", kind: "room", name: "Kitchen, 10' × 12'", note: "L of cabinets, sink under the window", starter: true, created_at: T0, piece: kitchen() },
  { id: "starter-bed", kind: "room", name: "Bedroom with closet, 12' × 12'", note: "Queen bed, closet with sliding doors", starter: true, created_at: T0, piece: bedroom() },
  { id: "starter-laundry", kind: "room", name: "Laundry, 6' × 8'", note: "Washer, dryer and utility sink", starter: true, created_at: T0, piece: laundry() },
  { id: "starter-apt", kind: "house", name: "One-bedroom apartment", note: "Living room, kitchen, bedroom and bath", starter: true, created_at: T0, sketch: apartment() },
];

// ---- the company's own, kept in this browser for now ----
const STORE = "rorker.library";
const listeners = new Set<() => void>();
let cache: LibItem[] | null = null;
const read = (): LibItem[] => { if (cache) return cache; try { cache = JSON.parse(localStorage.getItem(STORE) ?? "[]") ?? []; } catch { cache = []; } return cache!; };
const write = (list: LibItem[]) => { cache = list; try { localStorage.setItem(STORE, JSON.stringify(list)); } catch { /* private window: keep it for this visit */ } for (const l of listeners) l(); };
const newId = () => `lib-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function saveToLibrary(item: Omit<LibItem, "id" | "created_at">): LibItem {
  const it: LibItem = { ...clone(item), id: newId(), created_at: new Date().toISOString() };
  write([it, ...read()]);
  return it;
}
export const removeFromLibrary = (id: string) => write(read().filter((x) => x.id !== id));

/** Saved items, newest first, then the starters. */
export function useLibrary(): LibItem[] {
  const mine = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, read, read);
  return [...mine, ...STARTERS];
}
