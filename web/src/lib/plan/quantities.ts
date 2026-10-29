// Quantities a trade reads off the drawing: for a painter the wall and ceiling area of each room, the
// trim to paint and how many gallons that takes; for a flooring crew the floor area with extra for
// cuts, the doorways that need a transition strip and the baseboard to put back. No prices: only
// amounts, worked out from the rooms, doors and windows as drawn. Everything in mm and mm² here;
// shown in ft-in and ft² by the panels.
import type { Sketch, SketchDoor, SketchFloor, SketchRoom, SketchWindow } from "./sketch";
import { doorWidth, edgesOf, segLen, windowSpots } from "./sketchEdit";
import { polyArea } from "./geometry";
import { RULES } from "./rules";
import { defineStandards, std } from "./standards";
import { homesOf } from "./homes";
import { onOutline, wallHeight, wallLen } from "./walls";

defineStandards([
  { key: "paint.coverage", group: "Painting", label: "Coverage, ft² per gallon per coat", value: 350, unit: "count", help: "Most interior latex paints say 350 to 400 ft² a gallon on smooth walls; less on new drywall or texture." },
  { key: "paint.coats", group: "Painting", label: "Coats", value: 2, unit: "count", help: "Two finish coats is the usual; add a primer coat on new drywall or a strong colour change." },
  { key: "paint.waste", group: "Painting", label: "Extra for waste and touch-ups", value: 10, unit: "pct", help: "Paint left in the tray, the roller and the can, and some kept for touch-ups." },
  { key: "flooring.waste", group: "Flooring", label: "Extra for cuts and waste", value: 10, unit: "pct", help: "About 10% for straight lay in plank or tile; 15% for diagonal or herringbone." },
]);

/** mm² in a square foot */
export const FT2 = 92903.04;
export const ft2 = (mm2: number) => mm2 / FT2;

const low = (s?: string) => (s ?? "").trim().toLowerCase();
export const OUTDOOR = new Set(["balcony", "porch", "terrace"]);
const WET = new Set(["bathroom", "wc", "laundry"]);

/** A door's height: its own, or the house rule for its kind. */
export const doorHeight = (d: SketchDoor) => d.height_mm ?? (d.kind === "garage_door" ? RULES.garageHead : d.kind === "opening" ? RULES.openingHead : RULES.doorHead);

/** A window's sill and height in a room: its own, or the house rule (higher in wet rooms and kitchens). */
export function windowSize(w: SketchWindow, roomType?: string): { sill: number; h: number } {
  const t = low(roomType);
  const sill = w.sill_mm ?? (WET.has(t) ? RULES.sillWet : t === "kitchen" ? RULES.sillKitchen : RULES.sill);
  return { sill, h: w.height_mm ?? Math.max(300, RULES.head - sill) };
}

export interface Hole { w: number; h: number }
export interface RoomSurfaces {
  fi: number; i: number; name: string; type: string;
  /** walls all the way round, mm, and floor to ceiling */
  perimeter: number; height: number;
  floor: number; ceiling: number;
  /** wall area, mm²: all of it, and less the doors and windows */
  wallGross: number; wall: number;
  doors: (Hole & { to: string; kind: string })[]; windows: Hole[];
  /** baseboard: the walls less the door widths; casing round each door (this side) and window */
  baseboard: number; doorCasing: number; windowCasing: number;
}

/** A room's walls, ceiling, floor and trim. `height` is its floor's ceiling height. */
export function roomSurfaces(f: SketchFloor, i: number, height: number, fi = 0): RoomSurfaces {
  const r: SketchRoom = f.rooms[i], key = low(r.name);
  const perimeter = edgesOf(r.polygon).reduce((n, s) => n + segLen(s), 0);
  const area = polyArea(r.polygon);
  const doors = (f.doors ?? []).filter((d) => d.rooms.some((n) => low(n) === key)).map((d) => {
    const other = d.rooms.find((n) => low(n) !== key) ?? "Outside";
    return { w: doorWidth(d), h: Math.min(height, doorHeight(d)), to: other, kind: d.kind ?? "door" };
  });
  const windows = (f.windows ?? []).filter((w) => low(w.room) === key).flatMap((w) => {
    const { sill, h } = windowSize(w, r.type);
    const tall = Math.max(0, Math.min(h, height - sill));
    // as drawn on the wall when it can be placed there, else its own width and count
    const spots = windowSpots(f, w);
    return spots.length ? spots.map((s) => ({ w: segLen(s), h: tall })) : Array.from({ length: Math.max(1, w.count ?? 1) }, () => ({ w: w.width_mm ?? 1200, h: tall }));
  });
  const wallGross = perimeter * height;
  const holes = [...doors, ...windows].reduce((n, o) => n + o.w * o.h, 0);
  const doorW = doors.reduce((n, d) => n + d.w, 0);
  return {
    fi, i, name: r.name, type: low(r.type) || "other", perimeter, height, floor: area, ceiling: area,
    wallGross, wall: Math.max(0, wallGross - holes), doors, windows,
    baseboard: Math.max(0, perimeter - doorW),
    // up both sides and across the top of each opening, on this room's side
    doorCasing: doors.reduce((n, d) => n + 2 * d.h + d.w, 0),
    windowCasing: windows.reduce((n, w) => n + 2 * (w.w + w.h), 0),
  };
}

/** Every indoor room on every floor (balconies, porches and terraces left out). */
export function allSurfaces(sk: Sketch, ceiling: (f: SketchFloor) => number): RoomSurfaces[] {
  return sk.floors.flatMap((f, fi) => f.rooms.map((r, i) => (Array.isArray(r.polygon) && r.polygon.length >= 3 && !OUTDOOR.has(low(r.type)) ? roomSurfaces(f, i, ceiling(f), fi) : null)).filter((x): x is RoomSurfaces => !!x));
}

export interface FreeWall { fi: number; k: number; length: number; height: number; half: boolean; /** both faces, mm² */ area: number; /** along both sides */ baseboard: number }
/** The walls drawn on their own (a half wall, a wall that doesn't close a room): both faces, at their own
 *  height. Pieces lying on a room's outline are that room's walls and are counted with the room. */
export function freeWalls(sk: Sketch, ceiling: (f: SketchFloor) => number): FreeWall[] {
  return sk.floors.flatMap((f, fi) => (f.walls ?? []).map((w, k) => {
    if (f.rooms.some((r) => Array.isArray(r.polygon) && r.polygon.length >= 3 && onOutline(w, r.polygon))) return null;
    const length = wallLen(w), height = Math.min(ceiling(f), wallHeight(w, ceiling(f)));
    return length < 100 ? null : { fi, k, length, height, half: !!w.half || height < ceiling(f), area: 2 * length * height, baseboard: 2 * length };
  }).filter((x): x is FreeWall => !!x));
}

/** Gallons for an area: area × coats with the extra for waste, over the coverage of a gallon. */
export function gallons(area_ft2: number, coverage: number, coats: number, wastePct: number): number {
  if (!(coverage > 0) || !(area_ft2 > 0)) return 0;
  return (area_ft2 * Math.max(0, coats) * (1 + Math.max(0, wastePct) / 100)) / coverage;
}
/** Gallons as bought: to the next quarter (a quart), so a can is never short. */
export const toQuarts = (gal: number) => Math.ceil(gal * 4 - 1e-9) / 4;
/** "2¾ gal", "1 qt" */
export function fmtGal(gal: number): string {
  const q = toQuarts(gal);
  if (q <= 0) return "0 gal";
  if (q < 1) return `${q * 4} qt`;
  const whole = Math.floor(q), frac = ["", "¼", "½", "¾"][Math.round((q - whole) * 4)];
  return `${whole}${frac} gal`;
}

export interface PaintSum { wall_ft2: number; ceiling_ft2: number; baseboard: number; casing: number; wallGal: number; ceilingGal: number }
/** The painting totals for a set of rooms, with the company's coverage, coats and waste. */
export function paintSum(rooms: RoomSurfaces[], o = { coverage: std("paint.coverage"), coats: std("paint.coats"), waste: std("paint.waste") }, free: FreeWall[] = []): PaintSum {
  const wall_ft2 = ft2(rooms.reduce((n, r) => n + r.wall, 0) + free.reduce((n, w) => n + w.area, 0)), ceiling_ft2 = ft2(rooms.reduce((n, r) => n + r.ceiling, 0));
  return {
    wall_ft2, ceiling_ft2,
    baseboard: rooms.reduce((n, r) => n + r.baseboard, 0) + free.reduce((n, w) => n + w.baseboard, 0),
    casing: rooms.reduce((n, r) => n + r.doorCasing + r.windowCasing, 0),
    wallGal: gallons(wall_ft2, o.coverage, o.coats, o.waste),
    ceilingGal: gallons(ceiling_ft2, o.coverage, o.coats, o.waste),
  };
}

export interface Doorway { fi: number; rooms: [string, string]; width: number; outside: boolean }
/** Doorways that need a transition strip or threshold: every door and open passage but garage doors.
 *  Counted once, between the two rooms (or a room and outside). */
export function doorways(sk: Sketch): Doorway[] {
  return sk.floors.flatMap((f, fi) => (f.doors ?? []).filter((d) => d.kind !== "garage_door").map((d) => {
    const names = f.rooms.map((r) => low(r.name));
    const outside = !d.rooms[1] || d.rooms.some((n) => !names.includes(low(n)) || OUTDOOR.has(low(f.rooms[names.indexOf(low(n))]?.type)));
    return { fi, rooms: [d.rooms[0], d.rooms[1] ?? "Outside"] as [string, string], width: doorWidth(d), outside };
  }));
}

/** Floor area with the extra for cuts: what to order. */
export const withWaste = (area_ft2: number, wastePct = std("flooring.waste")) => area_ft2 * (1 + Math.max(0, wastePct) / 100);

export interface HomeTotal { name: string; rooms: number; area_ft2: number; bedrooms: number; bathrooms: number; halfBaths: number; floors: number }
/** Each home in a building, counted: rooms, floor area, bedrooms, full and half baths. With no homes
 *  marked, the whole drawing as one. */
export function homeTotals(sk: Sketch): HomeTotal[] {
  const homes = homesOf(sk);
  const list = homes.length ? homes : [{ name: sk.building_name || "The house", rooms: sk.floors.flatMap((f, fi) => f.rooms.map((r, i) => ({ fi, i, name: r.name }))), area_m2: 0, floors: [] as number[] }];
  return list.map((h) => {
    const rooms = h.rooms.map((x) => sk.floors[x.fi]?.rooms[x.i]).filter((r): r is SketchRoom => !!r);
    const t = (r: SketchRoom) => low(r.type);
    const indoor = rooms.filter((r) => !OUTDOOR.has(t(r)));
    return {
      name: h.name, rooms: rooms.length,
      area_ft2: ft2(indoor.reduce((n, r) => n + polyArea(r.polygon), 0)),
      bedrooms: rooms.filter((r) => t(r) === "bedroom").length,
      bathrooms: rooms.filter((r) => t(r) === "bathroom").length,
      halfBaths: rooms.filter((r) => t(r) === "wc").length,
      floors: new Set(h.rooms.map((x) => x.fi)).size,
    };
  });
}
/** "2½ baths", "1 bath" */
export const fmtBaths = (full: number, half: number) => {
  const n = full + half / 2, whole = Math.floor(n);
  return `${whole || n % 1 ? (whole || "") : 0}${n % 1 ? "½" : ""} bath${n > 1 || n === 0 ? "s" : ""}`;
};
