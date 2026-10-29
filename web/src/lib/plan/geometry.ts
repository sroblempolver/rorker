import type { BBox, Element, Fixture, Floor, Opening, Plan, Pt, Room, Wall } from "./types";
import { RULES } from "./rules";

export function polyArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return Math.abs(a / 2);
}

export function centroid(p: Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const f = p[j][0] * p[i][1] - p[i][0] * p[j][1];
    a += f;
    cx += (p[j][0] + p[i][0]) * f;
    cy += (p[j][1] + p[i][1]) * f;
  }
  if (Math.abs(a) < 1e-6) return [p[0][0], p[0][1]];
  return [cx / (3 * a), cy / (3 * a)];
}

/** A point well inside the polygon for labels (centroid if inside, else best grid sample). */
export function labelPoint(p: Pt[]): Pt {
  const c = centroid(p);
  if (pointInPoly(c, p) && edgeDistance(c, p) > 400) return c;
  const b = bboxOf(p);
  let best: Pt = c, bestD = -1;
  for (let i = 1; i < 12; i++)
    for (let j = 1; j < 12; j++) {
      const q: Pt = [b[0] + ((b[2] - b[0]) * i) / 12, b[1] + ((b[3] - b[1]) * j) / 12];
      if (!pointInPoly(q, p)) continue;
      const d = edgeDistance(q, p);
      if (d > bestD) { bestD = d; best = q; }
    }
  return best;
}

export function pointInPoly(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function edgeDistance(p: Pt, poly: Pt[]): number {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, segDist(p, poly[j], poly[i]));
  return d;
}

export function bboxOf(pts: Pt[]): BBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

export function unionBBox(bs: BBox[]): BBox {
  return [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))];
}

export function pathD(p: Pt[]): string {
  return p.length ? "M" + p.map(([x, y]) => `${x.toFixed(0)} ${y.toFixed(0)}`).join("L") + "Z" : "";
}

export function lineD(lines: Pt[][]): string {
  return lines.map((ln) => "M" + ln.map(([x, y]) => `${x.toFixed(0)} ${y.toFixed(0)}`).join("L")).join("");
}

export function floorBBox(f: Floor): BBox {
  const pts = f.footprint.flat().concat(f.walls.flatMap((w) => w.polygon));
  return pts.length ? bboxOf(pts) : f.bounds;
}

export function elementBBox(e: Element): BBox {
  switch (e.kind) {
    case "room": case "wall": case "opening": case "stair": return bboxOf(e.el.polygon);
    case "fixture": return e.el.bbox;
  }
}

export function elementCenter(e: Element): Pt {
  if (e.kind === "room") return labelPoint(e.el.polygon);
  if (e.kind === "fixture") return e.el.center;
  const b = elementBBox(e);
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
}

export function findElement(plan: Plan, id: string): Element | null {
  for (const floor of plan.floors) {
    const r = floor.rooms.find((x) => x.id === id); if (r) return { kind: "room", floor, el: r };
    const w = floor.walls.find((x) => x.id === id); if (w) return { kind: "wall", floor, el: w };
    const o = floor.openings.find((x) => x.id === id); if (o) return { kind: "opening", floor, el: o };
    const f = floor.fixtures.find((x) => x.id === id); if (f) return { kind: "fixture", floor, el: f };
    const s = floor.stairs.find((x) => x.id === id); if (s) return { kind: "stair", floor, el: s };
  }
  return null;
}

export function elementLabel(e: Element): string {
  switch (e.kind) {
    case "room": return e.el.name;
    case "wall": return e.el.exterior ? "Exterior wall" : "Interior wall";
    case "opening": return e.el.name;
    case "fixture": return e.el.name;
    case "stair": return "Stairs";
  }
}

export function elementKindLabel(e: Element): string {
  return { room: "Room", wall: "Wall", opening: e.kind === "opening" && e.el.kind === "window" ? "Window" : "Opening", fixture: "Item", stair: "Stairs" }[e.kind];
}

/** Which room an element belongs to (for pin counts and the room view). */
export function roomOf(e: Element): string | null {
  if (e.kind === "room") return e.el.id;
  if (e.kind === "fixture") return e.el.room_id;
  if (e.kind === "stair") return e.el.room_id;
  if (e.kind === "wall" || e.kind === "opening") return e.el.room_ids[0] ?? null;
  return null;
}

// ------------------------------------------------------------------ wall view (room sides)

export interface WallSide {
  key: string;           // room id + side index
  roomId: string;
  index: number;
  a: Pt; b: Pt;          // along the inside face of the room, a -> b
  length: number;
  heading: "north" | "east" | "south" | "west";
  /** "North wall", or "North wall A" / "B" when an L-shaped room has two */
  label: string;
  /** unit vector into the room */
  inward: Pt;
  segments: { id: string; kind: "wall" | "opening"; from: number; to: number; el: Wall | Opening }[];
}

/** Straight sides of a room (collinear edges merged), with the walls and openings along each side. */
export function roomSides(floor: Floor, room: Room): WallSide[] {
  const p = room.polygon;
  const edges: [Pt, Pt][] = [];
  for (let i = 0; i < p.length; i++) edges.push([p[i], p[(i + 1) % p.length]]);
  const merged: [Pt, Pt][] = [];
  for (const e of edges) {
    const last = merged[merged.length - 1];
    if (last && collinear(last[0], last[1], e[1])) last[1] = e[1];
    else merged.push([e[0], e[1]]);
  }
  if (merged.length > 1 && collinear(merged[merged.length - 1][0], merged[0][0], merged[0][1])) {
    merged[0][0] = merged[merged.length - 1][0];
    merged.pop();
  }
  const sides: WallSide[] = [];
  merged.forEach(([a, b], i) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 500) return;
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
    const segs: WallSide["segments"] = [];
    const project = (poly: Pt[]) => {
      let lo = Infinity, hi = -Infinity, near = Infinity;
      for (const q of poly) {
        const t = (q[0] - a[0]) * ux + (q[1] - a[1]) * uy;
        const d = Math.abs((q[0] - a[0]) * -uy + (q[1] - a[1]) * ux);
        near = Math.min(near, d);
        lo = Math.min(lo, t); hi = Math.max(hi, t);
      }
      return { lo: Math.max(0, lo), hi: Math.min(len, hi), near };
    };
    for (const o of floor.openings) {
      if (!o.room_ids.includes(room.id)) continue;
      const pr = project(o.polygon);
      if (pr.near < 120 && pr.hi - pr.lo > 200) segs.push({ id: o.id, kind: "opening", from: pr.lo, to: pr.hi, el: o });
    }
    for (const w of floor.walls) {
      if (!w.room_ids.includes(room.id)) continue;
      const pr = project(w.polygon);
      if (pr.near < 120 && pr.hi - pr.lo > 150) segs.push({ id: w.id, kind: "wall", from: pr.lo, to: pr.hi, el: w });
    }
    segs.sort((s, t) => s.from - t.from);
    // heading of the wall as seen from inside the room: outward normal
    const nx = uy, ny = -ux; // y down; polygon orientation varies, fix with centroid test
    const c = centroid(p);
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const out = (mid[0] + nx * 100 - c[0]) ** 2 + (mid[1] + ny * 100 - c[1]) ** 2 > (mid[0] - c[0]) ** 2 + (mid[1] - c[1]) ** 2 ? [nx, ny] : [-nx, -ny];
    const heading = Math.abs(out[0]) > Math.abs(out[1]) ? (out[0] > 0 ? "east" : "west") : out[1] > 0 ? "south" : "north";
    sides.push({ key: `${room.id}:${i}`, roomId: room.id, index: i, a, b, length: len, heading, label: "", segments: segs, inward: [-out[0], -out[1]] });
  });
  for (const s of sides) {
    const same = sides.filter((t) => t.heading === s.heading);
    s.label = `${s.heading[0].toUpperCase()}${s.heading.slice(1)} wall${same.length > 1 ? ` ${"ABCDEF"[same.indexOf(s)]}` : ""}`;
  }
  return sides;
}

function collinear(a: Pt, b: Pt, c: Pt): boolean {
  const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
  return Math.abs(cross) / l < 60;
}

// ------------------------------------------------------------------ exterior (estimated front view)

export interface FrontView {
  width: number; minX: number;
  /** which edge of the plan (y down) the front faces */
  side: "top" | "bottom";
  storeys: { floor: Floor; x0: number; x1: number; y0: number; y1: number; openings: { o: Opening; x0: number; x1: number; kind: string }[] }[];
  roofPeak: number; height: number;
}

/** Front elevation estimated from the footprint: the side with the main exterior door is the front. */
export function frontView(plan: Plan): FrontView {
  const floors = [...plan.floors].sort((a, b) => a.level - b.level);
  const all = floors.map(floorBBox);
  const bb = unionBBox(all);
  const ground = floors[0];
  const extDoors = ground?.openings.filter((o) => o.exterior && ["door", "double_door", "sliding_door"].includes(o.kind)) ?? [];
  // the front is the side of the main entrance: a door into the foyer or hall beats a wider back door
  const entry = (o: Opening) => (o.room_ids.some((id) => ["foyer", "hallway", "stair_hall"].includes(ground!.rooms.find((r) => r.id === id)?.type ?? "")) ? 1e6 : 0) + o.width_mm;
  let side: "bottom" | "top" = "bottom";
  if (extDoors.length) {
    const d = [...extDoors].sort((a, b) => entry(b) - entry(a))[0];
    const cy = (d.a[1] + d.b[1]) / 2;
    side = cy - bb[1] < bb[3] - cy ? "top" : "bottom";
  }
  const H = plan.building.exterior.storey_height_mm || RULES.storey;
  const storeys: FrontView["storeys"] = floors.map((f, i) => {
    const fb = floorBBox(f);
    // the front wall line: the outermost real door or window on that side (porch gaps don't count)
    const horiz = f.openings.filter((o) => o.exterior && o.kind !== "opening" && Math.abs(o.a[1] - o.b[1]) < 300);
    const ys = horiz.map((o) => (o.a[1] + o.b[1]) / 2).filter((y) => (side === "bottom" ? y > (fb[1] + fb[3]) / 2 : y < (fb[1] + fb[3]) / 2));
    const edge = ys.length ? (side === "bottom" ? Math.max(...ys) : Math.min(...ys)) : side === "bottom" ? fb[3] : fb[1];
    const ops = f.openings
      .filter((o) => o.exterior && o.kind !== "opening" && Math.abs((o.a[1] + o.b[1]) / 2 - edge) < 900 && Math.abs(o.a[1] - o.b[1]) < 300)
      .map((o) => ({ o, x0: Math.min(o.a[0], o.b[0]), x1: Math.max(o.a[0], o.b[0]), kind: o.kind }));
    return { floor: f, x0: fb[0], x1: fb[2], y0: -(i + 1) * H, y1: -i * H, openings: ops };
  });
  const width = bb[2] - bb[0];
  return { width, minX: bb[0], side, storeys, roofPeak: Math.min(3200, width * 0.22), height: floors.length * H };
}

// ------------------------------------------------------------------ things attached to a wall


export interface Attached { f: Fixture; from: number; to: number; gap: number }

/** Fixtures standing against one side of a room, projected along it (from/to in mm from side.a). */
export function attachedToSide(floor: Floor, side: WallSide, reach = 450): Attached[] {
  const { a, b, length: len } = side;
  const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
  const out: Attached[] = [];
  for (const f of floor.fixtures) {
    if (f.room_id !== side.roomId || f.kind === "car" || f.kind === "door_leaf" || f.kind === "part") continue;
    const [x0, y0, x1, y1] = f.bbox;
    const corners: Pt[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    let lo = Infinity, hi = -Infinity, gap = Infinity, far = 0;
    for (const q of corners) {
      const t = (q[0] - a[0]) * ux + (q[1] - a[1]) * uy;
      const d = Math.abs((q[0] - a[0]) * -uy + (q[1] - a[1]) * ux);
      lo = Math.min(lo, t); hi = Math.max(hi, t); gap = Math.min(gap, d); far = Math.max(far, d);
    }
    // skip thin linework, things that only touch the side at a corner, and big pieces that fill the
    // room (an L-shaped counter's box touches every side; it belongs to none of them)
    const deep = ["bed", "bathtub", "car", "sofa"].includes(f.kind) ? 2600 : 1400;
    if (gap > reach || far > deep || hi < 150 || lo > len - 150 || hi - lo < 120) continue;
    out.push({ f, from: Math.max(0, lo), to: Math.min(len, hi), gap });
  }
  return out.sort((p, q) => p.from - q.from);
}

/** Doors, windows and fixtures on or against one wall piece. */
export function attachedToWall(floor: Floor, wall: Wall): { openings: Opening[]; fixtures: Fixture[] } {
  const near = (q: Pt, d: number) => pointInPoly(q, wall.polygon) || edgeDistance(q, wall.polygon) < d;
  const openings = floor.openings.filter((o) => near([(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2], wall.thickness_mm + 60));
  const fixtures = floor.fixtures.filter((f) => {
    if (f.kind === "car" || f.kind === "door_leaf" || f.kind === "part" || f.kind === "other" && (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]) < 150 * 150) return false;
    const [x0, y0, x1, y1] = f.bbox;
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].some((q) => near(q as Pt, 450));
  });
  return { openings, fixtures };
}

/** The room side that a wall piece belongs to, for "face this wall". Prefers the given room. */
export function sideOfWall(floor: Floor, wallId: string, preferRoom?: string | null): WallSide | null {
  const rooms = floor.rooms.filter((r) => r.wall_ids.includes(wallId) || floor.walls.find((w) => w.id === wallId)?.room_ids.includes(r.id));
  rooms.sort((r, q) => (q.id === preferRoom ? 1 : 0) - (r.id === preferRoom ? 1 : 0));
  for (const r of rooms) {
    const sides = roomSides(floor, r).filter((s) => s.segments.some((g) => g.id === wallId));
    if (sides.length) {
      const seg = (s: WallSide) => s.segments.filter((g) => g.id === wallId).reduce((n, g) => n + g.to - g.from, 0);
      return sides.sort((s, t) => seg(t) - seg(s))[0];
    }
  }
  return null;
}

// ------------------------------------------------------------------ the site around the building

export interface Site {
  lot: BBox;               // estimated lot, in plan coordinates
  street: BBox;            // band in front of the lot
  front: "top" | "bottom";
  building: BBox;
  drive: Pt[] | null;      // from the garage door to the street
  path: Pt[] | null;       // from the main entrance to the street
}

/** A plausible lot drawn around the building: street on the front side, drive to the garage door,
 *  a path to the front door. Clearly an estimate; it gives the job a place to pin site things. */
export function siteLayout(plan: Plan): Site {
  const floors = [...plan.floors].sort((a, b) => a.level - b.level);
  const bb = unionBBox(floors.map(floorBBox));
  const fv = frontView(plan);
  const front = fv.side;
  const side = 6000, frontYard = 9000, back = 12000;
  const lot: BBox = front === "bottom"
    ? [bb[0] - side, bb[1] - back, bb[2] + side, bb[3] + frontYard]
    : [bb[0] - side, bb[1] - frontYard, bb[2] + side, bb[3] + back];
  const street: BBox = front === "bottom" ? [lot[0] - 40000, lot[3] + 1500, lot[2] + 40000, lot[3] + 9500] : [lot[0] - 40000, lot[1] - 9500, lot[2] + 40000, lot[1] - 1500];
  const edgeY = front === "bottom" ? lot[3] + 1500 : lot[1] - 1500;
  const g = floors[0];
  const toStreet = (o: Opening | undefined): Pt[] | null => {
    if (!o) return null;
    const mx = (o.a[0] + o.b[0]) / 2, my = (o.a[1] + o.b[1]) / 2;
    if (front === "bottom" ? my < (bb[1] + bb[3]) / 2 : my > (bb[1] + bb[3]) / 2) return null; // not on the street side
    const hw = Math.max(o.width_mm / 2, 600);
    return [[mx - hw, my], [mx + hw, my], [mx + hw, edgeY], [mx - hw, edgeY]];
  };
  const garage = g?.openings.find((o) => o.exterior && o.kind === "garage_door")
    ?? g?.openings.find((o) => o.exterior && g.rooms.find((r) => r.id === o.room_ids[0])?.type === "garage" && o.width_mm > 2000);
  const entryRooms = new Set(["foyer", "hallway", "stair_hall"]);
  const entry = g?.openings
    .filter((o) => o.exterior && ["door", "double_door"].includes(o.kind) && o.room_ids.some((id) => entryRooms.has(g.rooms.find((r) => r.id === id)?.type ?? "")))
    .sort((p, q) => q.width_mm - p.width_mm)[0];
  let drive = toStreet(garage);
  if (!drive && garage) {
    // garage door on the side: run the drive along the building to the street
    const gr = g.rooms.find((r) => garage.room_ids.includes(r.id));
    if (gr) { const rb = bboxOf(gr.polygon); drive = [[rb[0] + 300, front === "bottom" ? rb[3] : rb[1]], [rb[2] - 300, front === "bottom" ? rb[3] : rb[1]], [rb[2] - 300, edgeY], [rb[0] + 300, edgeY]]; }
  }
  const p = toStreet(entry);
  const path = p ? p.map(([x, y], i) => [i === 0 || i === 3 ? x + (p[1][0] - p[0][0]) / 2 - 650 : x - (p[1][0] - p[0][0]) / 2 + 650, y] as Pt) : null;
  return { lot, street, front, building: bb, drive, path };
}

/** Convex hull (monotone chain), for filling a fixture drawn as loose linework. */
export function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** The fixture's footprint: its first closed outline when it has one (cabinets), else the hull of its linework. */
export function footprint(f: Fixture): Pt[] {
  const ring = f.outline.find((l) => l.length >= 4 && Math.hypot(l[0][0] - l[l.length - 1][0], l[0][1] - l[l.length - 1][1]) < 1);
  if (ring && f.front) return ring;
  const pts = f.outline.flat();
  if (pts.length >= 3) return hull(pts);
  const [x0, y0, x1, y1] = f.bbox;
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

/** Point on a wall side: `along` mm from its start, `off` mm into the room. */
export function sidePoint(side: WallSide, along: number, off = 0): Pt {
  const ux = (side.b[0] - side.a[0]) / side.length, uy = (side.b[1] - side.a[1]) / side.length;
  return [side.a[0] + ux * along + side.inward[0] * off, side.a[1] + uy * along + side.inward[1] * off];
}
