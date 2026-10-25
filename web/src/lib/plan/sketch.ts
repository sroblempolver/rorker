// Turns a simple room sketch (what the New project assistant reads off an upload: rooms as outlines in
// mm, which rooms a door joins, which side a window is on, the main objects) into a full plan the
// viewers can draw in 2D and 3D. Walls are traced from the room edges: an edge two rooms share is an
// inside wall, an edge only one room has is an outside wall.
import type { BBox, Fixture, Floor, Opening, OpeningKind, Plan, Pt, Question, Room, RoomType, Wall } from "./types";
import { bboxOf, polyArea } from "./geometry";

export type Side = "north" | "south" | "east" | "west";
export interface SketchRoom { name: string; type?: string; polygon: Pt[] }
export interface SketchDoor { rooms: [string, string]; kind?: OpeningKind; width_mm?: number; at?: number }
export interface SketchWindow { room: string; side: Side; width_mm?: number; count?: number }
export interface SketchFixture { kind: string; name?: string; room?: string; center: Pt; width_mm?: number; depth_mm?: number; facing?: Side | null }
export interface SketchFloor { name?: string; level: number; height_mm?: number; rooms: SketchRoom[]; doors?: SketchDoor[]; windows?: SketchWindow[]; fixtures?: SketchFixture[] }
export interface Sketch {
  building_name?: string; storey_height_mm?: number; roof?: string; floors: SketchFloor[];
  questions?: { text: string; options?: string[]; rooms?: string[] }[];
}
export interface SketchSource { kind: string; filename: string }

const ROOM_TYPES: RoomType[] = ["kitchen", "bathroom", "wc", "bedroom", "living", "dining", "family", "study", "office", "hallway", "foyer", "stair_hall", "laundry", "utility", "closet", "garage", "storage", "balcony", "porch", "terrace", "other"];
const OUTDOOR = new Set<RoomType>(["balcony", "porch", "terrace"]);
const OUTSIDE = /^(outside|exterior|out|garden|yard|street)$/i;
const ANGLE: Record<Side, number> = { east: 0, south: 90, west: 180, north: -90 };
const SNAP = 150;  // edges this close are the same line (a read drawing is never exact)
const EXT_T = 250, INT_T = 120;

const r10 = (v: number) => Math.round(v / 10) * 10;
const key = (p: Pt) => `${p[0]},${p[1]}`;
const len = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Pull nearly equal x values together (and y values), so neighbouring rooms meet on one line. */
function snapAxis(values: number[]): Map<number, number> {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const out = new Map<number, number>();
  let group: number[] = [];
  const flush = () => { if (!group.length) return; const m = r10(group.reduce((a, b) => a + b, 0) / group.length); for (const g of group) out.set(g, m); group = []; };
  for (const v of sorted) { if (group.length && v - group[0] > SNAP) flush(); group.push(v); }
  flush();
  return out;
}

function roomType(t: string | undefined, name: string): RoomType {
  const s = (t ?? "").toLowerCase().replace(/[^a-z_]/g, "");
  if ((ROOM_TYPES as string[]).includes(s)) return s as RoomType;
  const n = name.toLowerCase();
  const guess: [RegExp, RoomType][] = [[/kitchen/, "kitchen"], [/bath|ensuite|shower/, "bathroom"], [/wc|toilet|powder/, "wc"], [/bed|master/, "bedroom"], [/living|lounge|sitting/, "living"], [/dining/, "dining"], [/family|den/, "family"], [/study/, "study"], [/office/, "office"], [/hall|corridor|passage/, "hallway"], [/foyer|entry|lobby/, "foyer"], [/stair/, "stair_hall"], [/laundry/, "laundry"], [/utility|mech|boiler/, "utility"], [/closet|wardrobe|wic|pantry/, "closet"], [/garage/, "garage"], [/stor/, "storage"], [/balcony/, "balcony"], [/porch|veranda/, "porch"], [/terrace|patio|deck/, "terrace"]];
  return guess.find(([re]) => re.test(n))?.[1] ?? "other";
}

function floorCode(level: number, used: Set<string>) {
  let c = level === 0 ? "G" : level < 0 ? (level === -1 ? "B" : `B${-level}`) : String(level);
  while (used.has(c)) c += "x";
  used.add(c);
  return c;
}

/** A band of the given thickness along a centre line, stretched past both ends by `ext`. */
function band(a: Pt, b: Pt, t: number, ext = 0): Pt[] {
  const L = len(a, b) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy * t / 2, ny = ux * t / 2;
  const A: Pt = [a[0] - ux * ext, a[1] - uy * ext], B: Pt = [b[0] + ux * ext, b[1] + uy * ext];
  return [[A[0] + nx, A[1] + ny], [B[0] + nx, B[1] + ny], [B[0] - nx, B[1] - ny], [A[0] - nx, A[1] - ny]].map(([x, y]) => [r10(x), r10(y)] as Pt);
}

function onSegment(p: Pt, a: Pt, b: Pt) {
  const L = len(a, b);
  if (L < 1) return false;
  const cross = Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / L;
  const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (L * L);
  return cross < 2 && t > 0.001 && t < 0.999;
}

interface Seg { a: Pt; b: Pt; rooms: string[] }

function buildFloor(sf: SketchFloor, fi: number, code: string, storey: number, notes: string[]): Floor {
  // rooms, snapped onto shared lines
  const raw = sf.rooms.filter((r) => Array.isArray(r.polygon) && r.polygon.length >= 3);
  const xs = snapAxis(raw.flatMap((r) => r.polygon.map((p) => p[0])));
  const ys = snapAxis(raw.flatMap((r) => r.polygon.map((p) => p[1])));
  const rooms: Room[] = raw.map((r, i) => {
    const poly = r.polygon.map((p) => [xs.get(p[0]) ?? r10(p[0]), ys.get(p[1]) ?? r10(p[1])] as Pt).filter((p, j, a) => j === 0 || key(p) !== key(a[j - 1]));
    if (poly.length > 1 && key(poly[0]) === key(poly[poly.length - 1])) poly.pop();
    const type = roomType(r.type, r.name);
    return {
      id: `${code}-R${String(i + 1).padStart(2, "0")}`, name: r.name?.trim() || "Room", type, polygon: poly, area_m2: Math.round(polyArea(poly) / 1e5) / 10,
      label_source: "ai", confidence: 0.7, outdoor: OUTDOOR.has(type), wall_ids: [], opening_ids: [], drawing_labels: [], drawing_area_m2: null, notes: null,
    };
  }).filter((r) => r.polygon.length >= 3 && r.area_m2 > 0.3);
  const byName = (n: string) => { const s = n.toLowerCase().trim(); return rooms.find((r) => r.name.toLowerCase() === s) ?? rooms.find((r) => r.name.toLowerCase().includes(s) || s.includes(r.name.toLowerCase())) ?? rooms.find((r) => r.id.toLowerCase() === s) ?? null; };

  // every room edge, cut wherever another room's corner sits on it, then grouped by who shares it
  const corners = rooms.flatMap((r) => r.polygon);
  const segs = new Map<string, Seg>();
  for (const r of rooms) {
    r.polygon.forEach((a, i) => {
      const b = r.polygon[(i + 1) % r.polygon.length];
      const cuts = corners.filter((p) => onSegment(p, a, b)).map((p) => ({ p, t: len(a, p) })).sort((x, y) => x.t - y.t).map((c) => c.p);
      const pts = [a, ...cuts, b].filter((p, j, arr) => j === 0 || key(p) !== key(arr[j - 1]));
      for (let j = 0; j < pts.length - 1; j++) {
        const [p, q] = [pts[j], pts[j + 1]].sort((u, v) => u[0] - v[0] || u[1] - v[1]);
        const k = `${key(p)}|${key(q)}`;
        const s = segs.get(k) ?? { a: p, b: q, rooms: [] };
        if (!s.rooms.includes(r.id)) s.rooms.push(r.id);
        segs.set(k, s);
      }
    });
  }

  // join straight runs between the same rooms into one wall
  const groups = new Map<string, Seg[]>();
  for (const s of segs.values()) {
    const horiz = s.a[1] === s.b[1], vert = s.a[0] === s.b[0];
    const line = horiz ? `h${s.a[1]}` : vert ? `v${s.a[0]}` : `d${key(s.a)}|${key(s.b)}`;
    const g = `${[...s.rooms].sort().join("+")}#${line}`;
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  const outdoorIds = new Set(rooms.filter((r) => r.outdoor).map((r) => r.id));
  const walls: Wall[] = [];
  for (const list of groups.values()) {
    const horiz = list[0].a[1] === list[0].b[1];
    list.sort((u, v) => (horiz ? u.a[0] - v.a[0] : u.a[1] - v.a[1]));
    const runs: Seg[] = [];
    for (const s of list) {
      const last = runs[runs.length - 1];
      if (last && key(last.b) === key(s.a)) last.b = s.b; else runs.push({ ...s });
    }
    for (const s of runs) {
      const inside = s.rooms.filter((id) => !outdoorIds.has(id));
      // an outdoor space (porch, terrace) gets no wall of its own on its open sides
      if (!inside.length) continue;
      const exterior = inside.length === 1;
      const L = len(s.a, s.b);
      if (L < 200) continue;
      const t = exterior ? EXT_T : INT_T;
      const id = `${code}-W${String(walls.length + 1).padStart(2, "0")}`;
      walls.push({ id, polygon: band(s.a, s.b, t, t / 2), length_mm: Math.round(L), thickness_mm: t, exterior, room_ids: [...s.rooms] });
      (s as Seg & { id?: string }).id = id;
      for (const rid of s.rooms) rooms.find((r) => r.id === rid)?.wall_ids.push(id);
    }
    // keep the centre lines for doors and windows
    for (const s of runs) wallLines.set((s as Seg & { id?: string }).id ?? "", s);
  }
  wallLines.delete("");

  // doors between rooms, windows on a room's outside walls
  const openings: Opening[] = [];
  const used = new Map<string, number[]>();
  const place = (w: Wall, width: number, at: number, kind: OpeningKind, name: string, prefix: string) => {
    const s = wallLines.get(w.id)!;
    const L = len(s.a, s.b);
    const wd = Math.min(width, Math.max(500, L - 200));
    let c = Math.max(wd / 2 + 100, Math.min(L - wd / 2 - 100, at * L));
    const taken = used.get(w.id) ?? [];
    // two openings on one wall shouldn't overlap: slide along to the next free spot
    for (let k = 0; k < 6 && taken.some((t) => Math.abs(t - c) < wd); k++) c = Math.min(L - wd / 2 - 100, c + wd + 200);
    taken.push(c);
    used.set(w.id, taken);
    const ux = (s.b[0] - s.a[0]) / L, uy = (s.b[1] - s.a[1]) / L;
    const a: Pt = [r10(s.a[0] + ux * (c - wd / 2)), r10(s.a[1] + uy * (c - wd / 2))], b: Pt = [r10(s.a[0] + ux * (c + wd / 2)), r10(s.a[1] + uy * (c + wd / 2))];
    const n = openings.filter((o) => o.id.startsWith(`${code}-${prefix}`)).length + 1;
    const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    const o: Opening = {
      id: `${code}-${prefix}${String(n).padStart(2, "0")}`, kind, name, a, b, width_mm: Math.round(wd), thickness_mm: w.thickness_mm, exterior: w.exterior,
      polygon: band(a, b, w.thickness_mm), room_ids: [...w.room_ids], confidence: 0.6,
      leaves: kind === "door" ? [{ hinge: a, radius: Math.round(wd), start_angle: ang, end_angle: ang + 90 }] : [],
    };
    openings.push(o);
    for (const rid of w.room_ids) rooms.find((r) => r.id === rid)?.opening_ids.push(o.id);
  };
  for (const d of sf.doors ?? []) {
    const [n1, n2] = d.rooms ?? [];
    const r1 = n1 ? byName(n1) : null;
    const out = !n2 || OUTSIDE.test(n2);
    const r2 = out ? null : byName(n2);
    if (!r1 || (!out && !r2)) { notes.push(`Couldn't place the door between ${n1} and ${n2}.`); continue; }
    const cands = walls.filter((w) => (out ? w.exterior && w.room_ids.includes(r1.id) : w.room_ids.includes(r1.id) && w.room_ids.includes(r2!.id)) || (out && r1.outdoor && w.room_ids.includes(r1.id)));
    const w = cands.sort((x, y) => y.length_mm - x.length_mm)[0];
    if (!w) { if (!out) notes.push(`${r1.name} and ${r2!.name} don't share a wall, so the door between them was left out.`); continue; }
    const kind = d.kind && d.kind !== "window" ? d.kind : "door";
    place(w, d.width_mm ?? (kind === "garage_door" ? 2400 : kind === "double_door" || kind === "sliding_door" ? 1500 : kind === "opening" ? 1200 : 820), d.at ?? 0.5, kind, kind === "opening" ? "Opening" : out ? "Front door" : "Door", kind === "opening" ? "OP" : "D");
  }
  for (const wn of sf.windows ?? []) {
    const r = byName(wn.room);
    if (!r) continue;
    const want = ANGLE[wn.side] ?? 0;
    const cands = walls.filter((w) => w.exterior && w.room_ids.includes(r.id)).filter((w) => {
      const s = wallLines.get(w.id)!;
      const mid: Pt = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
      const c = bboxOf(r.polygon);
      const out = (Math.atan2(mid[1] - (c[1] + c[3]) / 2, mid[0] - (c[0] + c[2]) / 2) * 180) / Math.PI;
      const L = len(s.a, s.b), horiz = Math.abs(s.b[1] - s.a[1]) < Math.abs(s.b[0] - s.a[0]);
      const face = horiz ? (out < 0 ? -90 : 90) : Math.abs(out) > 90 ? 180 : 0;
      return L > 600 && ((face - want + 540) % 360) - 180 === 0;
    }).sort((x, y) => y.length_mm - x.length_mm);
    const w = cands[0];
    if (!w) continue;
    const count = Math.max(1, Math.min(4, wn.count ?? 1));
    for (let k = 0; k < count; k++) place(w, wn.width_mm ?? 1200, (k + 1) / (count + 1), "window", "Window", "WN");
  }

  // objects at their real size, facing into the room
  const fixtures: Fixture[] = (sf.fixtures ?? []).filter((f) => Array.isArray(f.center) && f.kind).map((f, i) => {
    const w = Math.max(200, f.width_mm ?? 600), d = Math.max(200, f.depth_mm ?? 600);
    const facing = f.facing && f.facing in ANGLE ? ANGLE[f.facing] : null;
    const across = facing === 0 || facing === 180;
    const [hx, hy] = across ? [d / 2, w / 2] : [w / 2, d / 2];
    const c: Pt = [r10(f.center[0]), r10(f.center[1])];
    const bbox: BBox = [c[0] - hx, c[1] - hy, c[0] + hx, c[1] + hy];
    const room = (f.room ? byName(f.room) : null) ?? rooms.find((r) => { const b = bboxOf(r.polygon); return c[0] >= b[0] && c[0] <= b[2] && c[1] >= b[1] && c[1] <= b[3]; }) ?? null;
    return {
      id: `${code}-F${String(i + 1).padStart(2, "0")}`, kind: f.kind, name: f.name || f.kind.replace(/_/g, " "), room_id: room?.id ?? null, center: c, bbox, rotation: 0,
      outline: [[[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]], [bbox[0], bbox[1]]]], source: "ai", source_ref: null, confidence: 0.6, facing,
    } as Fixture;
  });

  const bounds = bboxOf([...rooms.flatMap((r) => r.polygon), ...walls.flatMap((w) => w.polygon)]);
  return {
    id: code, name: sf.name?.trim() || (sf.level === 0 ? "Ground floor" : sf.level < 0 ? "Basement" : `Level ${sf.level}`), level: sf.level,
    elevation_mm: fi === 0 && sf.level <= 0 ? 0 : sf.level * storey, height_mm: sf.height_mm ?? storey,
    footprint: outline([...segs.values()].filter((s) => s.rooms.length === 1 && !outdoorIds.has(s.rooms[0])), bounds), bounds, rooms, walls, openings, fixtures, stairs: [],
  };
}
// centre lines of the walls of the floor being built (doors and windows sit on them)
const wallLines = new Map<string, Seg>();

/** The building's outline on this floor: the outside edges chained into rings. */
function outline(edges: Seg[], fallback: BBox): Pt[][] {
  const next = new Map<string, Seg[]>();
  for (const s of edges) for (const p of [s.a, s.b]) next.set(key(p), [...(next.get(key(p)) ?? []), s]);
  const left = new Set(edges);
  const rings: Pt[][] = [];
  while (left.size) {
    const first = left.values().next().value!;
    left.delete(first);
    const ring: Pt[] = [first.a];
    let at = first.b;
    for (let guard = 0; guard < 2000 && key(at) !== key(ring[0]); guard++) {
      ring.push(at);
      const s = (next.get(key(at)) ?? []).find((x) => left.has(x));
      if (!s) break;
      left.delete(s);
      at = key(s.a) === key(at) ? s.b : s.a;
    }
    if (ring.length >= 3 && polyArea(ring) > 4e6) rings.push(ring);
  }
  return rings.length ? rings : [[[fallback[0], fallback[1]], [fallback[2], fallback[1]], [fallback[2], fallback[3]], [fallback[0], fallback[3]]]];
}

export function planFromSketch(sk: Sketch, src: SketchSource): { plan: Plan; notes: string[] } {
  const storey = Math.max(2400, Math.min(4500, sk.storey_height_mm ?? 3000));
  const notes: string[] = [];
  const used = new Set<string>();
  const floorsIn = [...(sk.floors ?? [])].filter((f) => f.rooms?.length).sort((a, b) => a.level - b.level);
  const floors = floorsIn.map((f, i) => {
    // each floor from its own top-left corner, so floors drawn side by side stack up
    const b0 = bboxOf(f.rooms.flatMap((r) => r.polygon ?? []));
    const shift = (p: Pt): Pt => [p[0] - b0[0] + 1000, p[1] - b0[1] + 1000];
    wallLines.clear();
    const moved: SketchFloor = { ...f, rooms: f.rooms.map((r) => ({ ...r, polygon: (r.polygon ?? []).map(shift) })), fixtures: (f.fixtures ?? []).map((x) => ({ ...x, center: shift(x.center) })) };
    return buildFloor(moved, i, floorCode(f.level, used), storey, notes);
  });
  const bb = floors.length ? bboxOf(floors.flatMap((f) => [[f.bounds[0], f.bounds[1]], [f.bounds[2], f.bounds[3]]] as Pt[])) : [0, 0, 10000, 10000];
  const rooms = floors.flatMap((f) => f.rooms);
  const byName = (n: string) => rooms.find((r) => r.name.toLowerCase() === n.toLowerCase().trim());
  const questions: Question[] = (sk.questions ?? []).slice(0, 8).map((q, i) => ({
    id: `Q${i + 1}`, text: q.text, element_ids: (q.rooms ?? []).map((n) => byName(n)?.id).filter((x): x is string => !!x),
    options: q.options ?? [], default: q.options?.[0] ?? null, kind: "ai", answer: null,
  }));
  const plan: Plan = {
    schema_version: 1, units: "mm",
    building: { name: sk.building_name || "Building", size_mm: [Math.round(bb[2] - bb[0]), Math.round(bb[3] - bb[1])], exterior: { estimated: true, storey_height_mm: storey, roof: sk.roof || "unknown", notes: null } },
    floors, questions, flags: notes.map((m) => ({ code: "sketch", message: m, element_ids: [], severity: "info" })),
    source: { kind: src.kind, filename: src.filename, pipeline_version: "sketch-0.1", model: null, ai_used: true },
    stats: { mode: "assistant" },
  };
  return { plan, notes };
}
