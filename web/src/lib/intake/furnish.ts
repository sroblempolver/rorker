// Furniture for a plan the reader just made, so "Furnished" shows a lived-in house: what the drawing shows
// stays as drawn, and each room gets the usual pieces it is missing (nightstands and a dresser by the bed,
// a sofa facing the TV or the fireplace, chairs round the table, rails in the closets). Kitchen and bath
// cabinets are never made up: they come only from the drawing. Pieces go against solid walls, clear of
// doors and of each other; a piece that doesn't fit is left out. Runs again on every reading and only
// adds what a room still lacks, so the assistant's later edits keep what is there.
import type { Pt } from "@/lib/plan/types";
import { roomType, type Side, type Sketch, type SketchFixture, type SketchFloor, type SketchRoom } from "@/lib/plan/sketch";
import { CATALOG } from "@/lib/plan/catalog";
import { pointInPoly } from "@/lib/plan/geometry";

type Box = [number, number, number, number];
interface Wall { a: Pt; b: Pt; /** into the room */ n: Pt; side: Side; length: number; window: boolean }

const OFF = 90; // a piece's back from the wall's centre line: half a wall and a finger's gap
const NORMAL_SIDE = (n: Pt): Side => (n[1] > 0 ? "north" : n[1] < 0 ? "south" : n[0] > 0 ? "west" : "east");
const FACE = (n: Pt): Side => (n[1] > 0 ? "south" : n[1] < 0 ? "north" : n[0] > 0 ? "east" : "west");
const size = (kind: string) => { const s = CATALOG[kind]; return { w: s?.w ?? 600, d: s?.d ?? 600 }; };
const overlaps = (p: Box, q: Box, gap = 0) => p[0] < q[2] + gap && q[0] < p[2] + gap && p[1] < q[3] + gap && q[1] < p[3] + gap;
const isClothes = (r: SketchRoom) => /\b(his|hers?|walk[- ]?in|w\.?i\.?c\.?|wardrobe|dressing|clothes)\b/i.test(r.name) || (roomType(r.type, r.name) === "closet" && !/pantry|linen|coat|storage|utility|mech/i.test(r.name));

/** a footprint, w along the wall it backs onto and d out from it */
function footprint(c: Pt, w: number, d: number, facing: Side): Box {
  const [hx, hy] = facing === "east" || facing === "west" ? [d / 2, w / 2] : [w / 2, d / 2];
  return [c[0] - hx, c[1] - hy, c[0] + hx, c[1] + hy];
}

function wallsOf(r: SketchRoom, windowSides: Set<Side>): Wall[] {
  const p = r.polygon, out: Wall[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 600 || (Math.abs(a[0] - b[0]) > 1 && Math.abs(a[1] - b[1]) > 1)) continue; // only straight runs on the grid
    const along: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let n: Pt = [-along[1], along[0]];
    if (!pointInPoly([m[0] + n[0] * 50, m[1] + n[1] * 50], p)) n = [-n[0], -n[1]];
    const side = NORMAL_SIDE(n);
    out.push({ a, b, n, side, length: len, window: windowSides.has(side) });
  }
  return out;
}

/** where the doors of a room are, as points on its walls */
function doorSpots(f: SketchFloor, r: SketchRoom): { at: Pt; reach: number }[] {
  const out: { at: Pt; reach: number }[] = [];
  const me = r.name.toLowerCase();
  for (const d of f.doors ?? []) {
    const names = d.rooms.map((n) => n.toLowerCase());
    if (!names.includes(me)) continue;
    const other = names[0] === me ? names[1] : names[0];
    const o = f.rooms.find((x) => x.name.toLowerCase() === other);
    const reach = (d.width_mm ?? (d.kind === "double_door" || d.kind === "garage_door" ? 1600 : 850)) / 2 + 450;
    // the stretch of wall the two rooms share (or, for an outside door, the walls on its side)
    const segs: [Pt, Pt][] = [];
    const p = r.polygon;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      if (o) {
        const q = o.polygon;
        for (let j = 0; j < q.length; j++) {
          const c = q[j], e = q[(j + 1) % q.length];
          if (Math.abs(a[1] - b[1]) < 1 && Math.abs(c[1] - e[1]) < 1 && Math.abs(a[1] - c[1]) < 60) {
            const lo = Math.max(Math.min(a[0], b[0]), Math.min(c[0], e[0])), hi = Math.min(Math.max(a[0], b[0]), Math.max(c[0], e[0]));
            if (hi - lo > 300) segs.push([[lo, a[1]], [hi, a[1]]]);
          } else if (Math.abs(a[0] - b[0]) < 1 && Math.abs(c[0] - e[0]) < 1 && Math.abs(a[0] - c[0]) < 60) {
            const lo = Math.max(Math.min(a[1], b[1]), Math.min(c[1], e[1])), hi = Math.min(Math.max(a[1], b[1]), Math.max(c[1], e[1]));
            if (hi - lo > 300) segs.push([[a[0], lo], [a[0], hi]]);
          }
        }
      } else if (d.side) {
        const horiz = Math.abs(a[1] - b[1]) < 1, mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const n: Pt = horiz ? [0, pointInPoly([mid[0], mid[1] + 50], p) ? 1 : -1] : [pointInPoly([mid[0] + 50, mid[1]], p) ? 1 : -1, 0];
        if (NORMAL_SIDE(n) === d.side) segs.push([a, b]);
      }
    }
    if (!segs.length) continue;
    const [a, b] = segs.sort((x, y) => Math.hypot(y[1][0] - y[0][0], y[1][1] - y[0][1]) - Math.hypot(x[1][0] - x[0][0], x[1][1] - x[0][1]))[0];
    const t = d.at ?? 0.5;
    out.push({ at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], reach });
  }
  return out;
}

class Room {
  walls: Wall[];
  taken: Box[];
  doors: { at: Pt; reach: number }[];
  added: SketchFixture[] = [];
  constructor(public f: SketchFloor, public r: SketchRoom, public have: SketchFixture[]) {
    const winSides = new Set((f.windows ?? []).filter((w) => w.room.toLowerCase() === r.name.toLowerCase()).map((w) => w.side));
    this.walls = wallsOf(r, winSides).sort((a, b) => b.length - a.length);
    this.doors = doorSpots(f, r);
    this.taken = have.map((x) => { const s = size(x.kind); return footprint(x.center, x.width_mm ?? s.w, x.depth_mm ?? s.d, x.facing ?? "south"); });
  }
  has(...kinds: string[]) { return [...this.have, ...this.added].some((x) => kinds.includes(x.kind)); }
  fits(b: Box, gap = 40) {
    const p = this.r.polygon;
    const inset = 20, corners: Pt[] = [[b[0] + inset, b[1] + inset], [b[2] - inset, b[1] + inset], [b[2] - inset, b[3] - inset], [b[0] + inset, b[3] - inset], [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]];
    if (!corners.every((c) => pointInPoly(c, p))) return false;
    if (this.taken.some((t) => overlaps(b, t, gap))) return false;
    // clear of every door and its swing
    return this.doors.every((d) => Math.max(b[0] - d.at[0], 0, d.at[0] - b[2]) ** 2 + Math.max(b[1] - d.at[1], 0, d.at[1] - b[3]) ** 2 >= d.reach ** 2);
  }
  put(kind: string, c: Pt, facing: Side, w?: number, d?: number, opts: { flat?: boolean; name?: string } = {}): SketchFixture {
    const s = size(kind), fx: SketchFixture = { kind, room: this.r.name, center: [Math.round(c[0]), Math.round(c[1])], facing, ...(w && w !== s.w ? { width_mm: Math.round(w) } : {}), ...(d && d !== s.d ? { depth_mm: Math.round(d) } : {}), ...(opts.name ? { name: opts.name } : {}) };
    if (!opts.flat) this.taken.push(footprint(fx.center, w ?? s.w, d ?? s.d, facing));
    this.added.push(fx);
    return fx;
  }
  /** a piece with its back to a wall: the first wall (in the order asked) with room for it, nearest the wall's middle */
  againstWall(kind: string, walls: Wall[] = this.walls, o: { w?: number; d?: number; gap?: number } = {}): { fx: SketchFixture; wall: Wall } | null {
    const s = size(kind), w = o.w ?? s.w, d = o.d ?? s.d;
    for (const wall of walls) {
      if (wall.length < w + 100) continue;
      const along: Pt = [(wall.b[0] - wall.a[0]) / wall.length, (wall.b[1] - wall.a[1]) / wall.length], half = wall.length / 2;
      for (let k = 0; k <= half; k += 100) for (const sgn of k ? [1, -1] : [1]) {
        const t = half + sgn * k;
        if (t - w / 2 < 60 || t + w / 2 > wall.length - 60) continue;
        const c: Pt = [wall.a[0] + along[0] * t + wall.n[0] * (OFF + d / 2), wall.a[1] + along[1] * t + wall.n[1] * (OFF + d / 2)];
        const facing = FACE(wall.n);
        if (this.fits(footprint(c, w, d, facing), o.gap)) return { fx: this.put(kind, c, facing, o.w, o.d), wall };
      }
    }
    return null;
  }
  /** a piece beside another along the same wall (a nightstand by the bed), on each side that has room */
  beside(of: SketchFixture, wall: Wall, kind: string, ofWidth: number) {
    const s = size(kind), along: Pt = [(wall.b[0] - wall.a[0]) / wall.length, (wall.b[1] - wall.a[1]) / wall.length];
    // on the wall, behind the piece (a drawn bed is not always tight to it)
    const t = (of.center[0] - wall.a[0]) * along[0] + (of.center[1] - wall.a[1]) * along[1];
    const back: Pt = [wall.a[0] + along[0] * t + wall.n[0] * OFF, wall.a[1] + along[1] * t + wall.n[1] * OFF];
    for (const sgn of [1, -1]) {
      const off = ofWidth / 2 + 80 + s.w / 2;
      const c: Pt = [back[0] + along[0] * off * sgn + wall.n[0] * (s.d / 2), back[1] + along[1] * off * sgn + wall.n[1] * (s.d / 2)];
      if (this.fits(footprint(c, s.w, s.d, of.facing ?? "south"), 20)) this.put(kind, c, of.facing ?? "south");
    }
  }
  /** a piece out in front of another, `gap` mm clear of its front */
  inFront(of: SketchFixture, kind: string, gap: number, o: { w?: number; d?: number; flat?: boolean; turn?: boolean } = {}) {
    const s = size(kind), w = o.w ?? s.w, d = o.d ?? s.d, n = dirOf(of.facing ?? "south");
    const ofd = of.depth_mm ?? size(of.kind).d;
    const c: Pt = [of.center[0] + n[0] * (ofd / 2 + gap + d / 2), of.center[1] + n[1] * (ofd / 2 + gap + d / 2)];
    const facing = o.turn ? OPP[of.facing ?? "south"] : of.facing ?? "south";
    if (o.flat && pointInPoly(c, this.r.polygon)) {
      // a rug stays on the floor of its room: shrunk and moved to clear the walls
      const xs = this.r.polygon.map((p) => p[0]), ys = this.r.polygon.map((p) => p[1]), inset = 300;
      const across = facing === "east" || facing === "west";
      let [hx, hy] = across ? [d / 2, w / 2] : [w / 2, d / 2];
      hx = Math.min(hx, (Math.max(...xs) - Math.min(...xs)) / 2 - inset); hy = Math.min(hy, (Math.max(...ys) - Math.min(...ys)) / 2 - inset);
      if (hx < 300 || hy < 300) return null;
      const cc: Pt = [Math.min(Math.max(c[0], Math.min(...xs) + inset + hx), Math.max(...xs) - inset - hx), Math.min(Math.max(c[1], Math.min(...ys) + inset + hy), Math.max(...ys) - inset - hy)];
      const [ww, dd] = across ? [2 * hy, 2 * hx] : [2 * hx, 2 * hy];
      return this.put(kind, cc, facing, ww, dd, { flat: true });
    }
    if (!o.flat && this.fits(footprint(c, w, d, facing), 20)) return this.put(kind, c, facing, o.w, o.d);
    return null;
  }
  nearestWall(c: Pt): Wall | undefined {
    const dist = (w: Wall) => {
      const along: Pt = [(w.b[0] - w.a[0]) / w.length, (w.b[1] - w.a[1]) / w.length];
      const t = (c[0] - w.a[0]) * along[0] + (c[1] - w.a[1]) * along[1];
      return t < 0 || t > w.length ? Infinity : Math.abs((c[0] - w.a[0]) * w.n[0] + (c[1] - w.a[1]) * w.n[1]);
    };
    return [...this.walls].sort((a, b) => dist(a) - dist(b))[0];
  }
  opposite(wall: Wall) { return this.walls.filter((x) => x.n[0] === -wall.n[0] && x.n[1] === -wall.n[1]); }
  centre(): Pt {
    const xs = this.r.polygon.map((p) => p[0]), ys = this.r.polygon.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }
}
const OPP: Record<Side, Side> = { north: "south", south: "north", east: "west", west: "east" };
const dirOf = (s: Side): Pt => (s === "north" ? [0, -1] : s === "south" ? [0, 1] : s === "east" ? [1, 0] : [-1, 0]);
const solidFirst = (ws: Wall[]) => [...ws.filter((w) => !w.window), ...ws.filter((w) => w.window)];

/** a table in the open middle of the room, chairs all round */
function tableWithChairs(R: Room, kind: "dining_table" | "round_dining_table" | "table", at?: Pt) {
  const c = at ?? R.centre();
  for (const [w, d, n] of kind === "round_dining_table" ? [[1200, 1200, 4]] : [[1830, 915, 6], [1220, 760, 4]]) {
    const b = footprint(c, w, d, "south");
    // a chair's depth plus room to pull it out, all round
    if (!R.fits([b[0] - 600, b[1] - 600, b[2] + 600, b[3] + 600], 0)) continue;
    const t = R.put(kind, c, "south", w, d);
    const ch = size("chair").d / 2 + 50;
    const spots: [Pt, Side][] = n === 4 && kind === "round_dining_table"
      ? [[[c[0], c[1] - w / 2 - ch], "south"], [[c[0], c[1] + w / 2 + ch], "north"], [[c[0] - w / 2 - ch, c[1]], "east"], [[c[0] + w / 2 + ch, c[1]], "west"]]
      : [...(n === 6 ? [-1, 0, 1] : [-0.5, 0.5]).flatMap((k) => [[[c[0] + k * (w / 3), c[1] - d / 2 - ch], "south"], [[c[0] + k * (w / 3), c[1] + d / 2 + ch], "north"]] as [Pt, Side][]),
        [[c[0] - w / 2 - ch, c[1]], "east"], [[c[0] + w / 2 + ch, c[1]], "west"]];
    for (const [p, f] of spots) R.put("chair", p, f);
    return t;
  }
  return null;
}

function furnishRoom(R: Room, master: boolean) {
  const type = roomType(R.r.type, R.r.name);
  if (/open to below/i.test(R.r.name)) return;
  if (isClothes(R.r)) {
    // rails along the walls, as many as fit
    for (const wall of R.walls) for (let i = 0; i < 4; i++) if (!R.againstWall("clothes_rack", [wall])) break;
    if (!R.has("clothes_rack")) R.againstWall("clothes_rack", R.walls, { w: 800 });
    return;
  }
  switch (type) {
    case "bedroom": {
      let bed = [...R.have, ...R.added].find((x) => x.kind === "bed");
      let bedWall: Wall | undefined;
      if (!bed) {
        const got = R.againstWall("bed", solidFirst(R.walls), master ? { w: 1930, d: 2032 } : { w: 1524, d: 2032 });
        if (got) { bed = got.fx; bedWall = got.wall; }
      } else {
        // the wall its head is against: the one it faces away from, else the nearest
        bedWall = (bed.facing ? R.walls.find((w) => FACE(w.n) === bed!.facing) : undefined) ?? R.nearestWall(bed.center);
        if (bedWall && !bed.facing) bed = { ...bed, facing: FACE(bedWall.n) };
      }
      if (bed && bedWall) {
        if (!R.has("nightstand")) R.beside(bed, bedWall, "nightstand", bed.width_mm ?? size("bed").w);
        R.inFront(bed, "rug", -(bed.depth_mm ?? 2032) * 0.6, { w: 2400, d: 1700, flat: true });
        if (master) R.inFront(bed, "bench", 150);
      }
      if (!R.has("dresser", "wardrobe")) R.againstWall("dresser", solidFirst(R.walls));
      if (master && !R.has("armchair")) R.againstWall("armchair", R.walls.filter((w) => w.window).concat(R.walls));
      if (!R.has("plant")) R.againstWall("plant");
      break;
    }
    case "living": case "family": {
      const fire = R.have.find((x) => x.kind === "fireplace");
      let focus: SketchFixture | null = fire ?? null;
      if (!focus && !R.has("tv", "sideboard")) {
        const got = R.againstWall("sideboard", solidFirst(R.walls));
        if (got) { focus = got.fx; R.put("tv", got.fx.center, got.fx.facing ?? "south", undefined, undefined, { flat: true }); }
      }
      if (!R.has("sofa", "sectional_sofa")) {
        const facingWall = focus ? R.walls.find((w) => FACE(w.n) === focus!.facing) : undefined;
        // the sofa faces the TV or the fireplace: against the wall across from it, else out in the room
        const s = (facingWall ? R.againstWall("sofa", R.opposite(facingWall))?.fx : null)
          ?? (focus ? R.inFront(focus, "sofa", 2400, { turn: true }) : R.againstWall("sofa")?.fx) ?? null;
        if (s) {
          R.inFront(s, "coffee_table", 450);
          R.inFront(s, "rug", 200, { w: 2400, d: 1700, flat: true });
        }
      }
      if (!R.has("armchair")) R.againstWall("armchair", R.walls.slice(1));
      if (!R.has("lamp")) R.againstWall("lamp");
      if (!R.has("plant")) R.againstWall("plant");
      break;
    }
    case "dining":
      if (!R.has("dining_table", "round_dining_table", "table")) tableWithChairs(R, "dining_table");
      if (!R.has("sideboard", "china_cabinet")) R.againstWall("sideboard", solidFirst(R.walls));
      break;
    case "kitchen": {
      // stools along the island's open side; a breakfast table when the room has the space
      const island = R.have.find((x) => x.kind === "island");
      if (island && !R.has("bar_stool")) {
        const iw = island.width_mm ?? size("island").w, idp = island.depth_mm ?? size("island").d;
        const across = island.facing === "east" || island.facing === "west";
        const n = Math.max(2, Math.min(4, Math.floor(iw / 600)));
        for (const sgn of [1, -1]) {
          const before = R.added.length;
          for (let i = 0; i < n; i++) {
            const t = -iw / 2 + (iw / n) * (i + 0.5), out = idp / 2 + 280;
            const c: Pt = across ? [island.center[0] + sgn * out, island.center[1] + t] : [island.center[0] + t, island.center[1] + sgn * out];
            const f: Side = across ? (sgn > 0 ? "west" : "east") : sgn > 0 ? "north" : "south";
            if (R.fits(footprint(c, 400, 400, f), 20)) R.put("bar_stool", c, f);
          }
          if (R.added.length > before) break;
        }
      }
      const area = polyArea(R.r.polygon);
      if (area > 25e6 && !R.has("dining_table", "round_dining_table", "table")) {
        // the emptiest spot: try a few places across the room
        const [x0, y0, x1, y1] = [Math.min(...R.r.polygon.map((p) => p[0])), Math.min(...R.r.polygon.map((p) => p[1])), Math.max(...R.r.polygon.map((p) => p[0])), Math.max(...R.r.polygon.map((p) => p[1]))];
        for (const fx of [0.75, 0.25, 0.5]) for (const fy of [0.5, 0.3, 0.7]) if (!R.has("round_dining_table") && tableWithChairs(R, "round_dining_table", [x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy])) break;
      }
      break;
    }
    case "study": case "office": {
      if (!R.has("desk")) {
        const got = R.againstWall("desk", [...R.walls.filter((w) => w.window), ...R.walls]);
        if (got) { R.put("monitor", got.fx.center, got.fx.facing ?? "south", undefined, undefined, { flat: true }); R.inFront(got.fx, "office_chair", -100, { turn: true, flat: true }); }
      }
      if (!R.has("bookshelf")) R.againstWall("bookshelf", solidFirst(R.walls));
      if (!R.has("armchair")) R.againstWall("armchair");
      break;
    }
    case "foyer":
      if (!R.has("console_table")) R.againstWall("console_table", solidFirst(R.walls));
      if (!R.has("plant")) R.againstWall("plant");
      break;
    case "bathroom": case "wc":
      if (!R.has("towel_bar")) R.againstWall("towel_bar", solidFirst(R.walls));
      if (type === "bathroom" && !R.has("laundry_hamper")) R.againstWall("laundry_hamper");
      break;
    case "laundry":
      if (!R.has("washing_machine")) R.againstWall("washing_machine");
      if (!R.has("dryer")) R.againstWall("dryer");
      break;
  }
}

const polyArea = (p: Pt[]) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;

export function furnishFloor(f: SketchFloor): SketchFloor {
  const fixtures = [...(f.fixtures ?? [])];
  // by where it stands; by its room's name only when it stands in no room (names can repeat: "Bedroom")
  const inRoom = (r: SketchRoom) => fixtures.filter((x) => pointInPoly(x.center, r.polygon) || (!!x.room && x.room.toLowerCase() === r.name.toLowerCase() && !f.rooms.some((o) => pointInPoly(x.center, o.polygon))));
  const beds = f.rooms.filter((r) => roomType(r.type, r.name) === "bedroom" && !isClothes(r));
  const master = beds.find((r) => /master|primary|owner/i.test(r.name)) ?? [...beds].sort((a, b) => polyArea(b.polygon) - polyArea(a.polygon))[0];
  const rooms = f.rooms.map((r) => (isClothes(r) && roomType(r.type, r.name) !== "closet" ? { ...r, type: "closet" } : r));
  for (const r of rooms) {
    if (r.polygon.length < 3) continue;
    const R = new Room(f, r, inRoom(r));
    furnishRoom(R, r === master);
    fixtures.push(...R.added);
  }
  return { ...f, rooms, fixtures };
}

/** The reader's plan with every room furnished (only what is missing is added). */
export function furnishSketch(sk: Sketch): Sketch {
  return { ...sk, floors: sk.floors.map(furnishFloor) };
}
