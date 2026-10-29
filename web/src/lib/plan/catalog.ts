// What each kind of object is in the real world: its usual size, weight, where it is mounted (on the
// floor, on top of something, on a wall) and which way it faces. Drawings carry no furniture heights,
// so every view and the assistant fall back on these. Sizes are millimetres, width across the front,
// depth front to back, height from its own bottom; weight in kilograms.
import { EXTRA } from "./catalog-extra";

/** floor: stands on the floor. surface: sits on top of another object (a computer on a desk).
 *  wall: hangs on a wall with its bottom `at` mm up. ceiling: hangs from the ceiling. */
export type Mount = "floor" | "surface" | "wall" | "ceiling";

/** Which way its front faces when nobody says:
 *  room: its back to the nearest wall, facing into the room (beds, wardrobes, cabinets, desks)
 *  to: toward the nearest of `to` (a chair to its desk, a stool to the counter, a sofa to the TV)
 *  with: the same way as what it sits on (a monitor faces whoever sits at the desk)
 *  any: round or loose things; keeps what it was given */
export type Facing = "room" | "to" | "with" | "any";

export interface ObjectSpec {
  label: string; w: number; d: number; h: number; kg: number; mount: Mount;
  /** wall and ceiling: height of its bottom above the floor */
  at?: number;
  /** surface: what it can stand on, best first; with no such thing it goes on the wall at `at` or the floor */
  on?: string[];
  face: Facing;
  to?: string[];
  /** who uses it from the front: a desk faces the chair pulled up to it */
  users?: string[];
  /** where on what it sits: toward the back (a monitor) or wherever it was put */
  back?: boolean;
  /** other words people use for it */
  words?: string[];
  /** top-view colour in the plan */
  fill: string;
  /** looks like this other kind, stretched to its own size */
  like?: string;
  /** how it looks, built from simple shapes at the catalogue size (stretched to the real size) */
  parts?: Part[];
}

const WOOD = "#a07850", DARK = "#8a6a48", CAB = "#5b5750", WHITE = "#f4efe6", STEEL = "#b9bec4", BLACK = "#232426", FABRIC = "#6f7486";
const DESKS = ["desk", "table", "dining_table", "sideboard", "dresser", "nightstand"];
const COUNTERS = ["base_cabinet", "island", "kitchen_sink", "sideboard", "table"];

const BASE: Record<string, ObjectSpec> = {
  // kitchen
  base_cabinet: { label: "Base cabinet", w: 600, d: 600, h: 900, kg: 35, mount: "floor", face: "room", fill: CAB },
  wall_cabinet: { label: "Wall cabinet", w: 600, d: 350, h: 700, kg: 18, mount: "wall", at: 1450, face: "room", fill: CAB },
  tall_cabinet: { label: "Tall cabinet", w: 600, d: 600, h: 2200, kg: 70, mount: "floor", face: "room", words: ["pantry"], fill: "#d9d2c4" },
  kitchen_sink: { label: "Kitchen sink", w: 800, d: 600, h: 900, kg: 45, mount: "floor", face: "room", fill: CAB },
  dishwasher: { label: "Dishwasher", w: 600, d: 600, h: 850, kg: 45, mount: "floor", face: "room", fill: CAB },
  range: { label: "Range", w: 600, d: 600, h: 900, kg: 60, mount: "floor", face: "room", words: ["stove", "cooker"], fill: BLACK },
  cooktop: { label: "Cooktop", w: 600, d: 520, h: 900, kg: 10, mount: "floor", face: "room", words: ["hob"], fill: BLACK },
  oven: { label: "Oven", w: 600, d: 600, h: 900, kg: 35, mount: "floor", face: "room", fill: BLACK },
  range_hood: { label: "Range hood", w: 600, d: 500, h: 600, kg: 12, mount: "wall", at: 1600, face: "room", words: ["extractor", "hood"], fill: STEEL },
  fridge: { label: "Fridge", w: 700, d: 700, h: 1850, kg: 80, mount: "floor", face: "room", words: ["refrigerator", "freezer"], fill: STEEL },
  island: { label: "Kitchen island", w: 1800, d: 900, h: 900, kg: 150, mount: "floor", face: "any", fill: CAB },
  microwave: { label: "Microwave", w: 500, d: 380, h: 300, kg: 14, mount: "surface", on: COUNTERS, back: true, face: "with", fill: BLACK },
  coffee_machine: { label: "Coffee machine", w: 280, d: 400, h: 380, kg: 9, mount: "surface", on: COUNTERS, back: true, face: "with", words: ["espresso"], fill: BLACK },
  kettle: { label: "Kettle", w: 220, d: 160, h: 250, kg: 1.2, mount: "surface", on: COUNTERS, back: true, face: "with", fill: STEEL },
  toaster: { label: "Toaster", w: 300, d: 180, h: 200, kg: 2, mount: "surface", on: COUNTERS, back: true, face: "with", fill: STEEL },
  bar_stool: { label: "Bar stool", w: 400, d: 400, h: 1000, kg: 6, mount: "floor", face: "to", to: ["island", "base_cabinet", "kitchen_sink", "bar_counter"], words: ["counter stool", "stool"], fill: WOOD },
  // bathroom
  toilet: { label: "Toilet", w: 400, d: 650, h: 800, kg: 30, mount: "floor", face: "room", words: ["wc"], fill: WHITE },
  washbasin: { label: "Washbasin", w: 600, d: 450, h: 900, kg: 18, mount: "floor", face: "room", words: ["basin", "sink"], fill: WHITE },
  vanity: { label: "Vanity", w: 800, d: 480, h: 900, kg: 45, mount: "floor", face: "room", fill: WOOD },
  bathtub: { label: "Bathtub", w: 1700, d: 700, h: 580, kg: 50, mount: "floor", face: "room", words: ["bath", "tub"], fill: WHITE },
  shower: { label: "Shower", w: 900, d: 900, h: 2050, kg: 60, mount: "floor", face: "room", fill: "#cfe6ee" },
  mirror: { label: "Mirror", w: 600, d: 30, h: 800, kg: 8, mount: "wall", at: 1100, face: "room", fill: "#8fd3f0" },
  towel_radiator: { label: "Towel radiator", w: 500, d: 100, h: 1200, kg: 12, mount: "wall", at: 300, face: "room", fill: WHITE },
  // bedroom
  bed: { label: "Bed", w: 1600, d: 2000, h: 1050, kg: 70, mount: "floor", face: "room", fill: "#e9e3d6" },
  nightstand: { label: "Nightstand", w: 450, d: 400, h: 550, kg: 12, mount: "floor", face: "room", words: ["bedside table"], fill: DARK },
  wardrobe: { label: "Wardrobe", w: 1200, d: 600, h: 2200, kg: 90, mount: "floor", face: "room", words: ["closet", "armoire"], fill: DARK },
  dresser: { label: "Dresser", w: 1000, d: 480, h: 800, kg: 45, mount: "floor", face: "room", words: ["chest of drawers", "drawers"], fill: DARK },
  crib: { label: "Crib", w: 700, d: 1300, h: 900, kg: 25, mount: "floor", face: "room", words: ["cot"], fill: WHITE },
  // living and dining
  sofa: { label: "Sofa", w: 2100, d: 900, h: 850, kg: 60, mount: "floor", face: "to", to: ["tv", "fireplace", "coffee_table"], words: ["couch"], fill: FABRIC },
  armchair: { label: "Armchair", w: 850, d: 850, h: 850, kg: 25, mount: "floor", face: "to", to: ["coffee_table", "tv", "fireplace", "sofa"], fill: FABRIC },
  coffee_table: { label: "Coffee table", w: 1100, d: 600, h: 420, kg: 20, mount: "floor", face: "any", fill: WOOD },
  table: { label: "Table", w: 1200, d: 800, h: 750, kg: 30, mount: "floor", face: "any", fill: WOOD },
  dining_table: { label: "Dining table", w: 1600, d: 900, h: 750, kg: 45, mount: "floor", face: "any", fill: WOOD },
  chair: { label: "Chair", w: 450, d: 450, h: 900, kg: 5, mount: "floor", face: "to", to: ["dining_table", "table", "desk"], fill: WOOD },
  sideboard: { label: "Sideboard", w: 1600, d: 450, h: 750, kg: 55, mount: "floor", face: "room", words: ["tv unit", "tv stand", "credenza", "buffet"], fill: DARK },
  tv: { label: "TV", w: 1230, d: 80, h: 720, kg: 15, mount: "surface", on: ["sideboard", "dresser", "tv_stand"], at: 1100, face: "with", back: true, words: ["television", "screen"], fill: "#151618" },
  bookshelf: { label: "Bookshelf", w: 800, d: 300, h: 2000, kg: 40, mount: "floor", face: "room", words: ["bookcase", "shelving"], fill: DARK },
  wall_shelf: { label: "Wall shelf", w: 800, d: 250, h: 40, kg: 4, mount: "wall", at: 1500, face: "room", words: ["floating shelf"], fill: WOOD },
  picture: { label: "Picture", w: 700, d: 30, h: 500, kg: 3, mount: "wall", at: 1350, face: "room", words: ["painting", "art", "frame", "poster"], fill: "#c9a46a" },
  rug: { label: "Rug", w: 2000, d: 1400, h: 10, kg: 8, mount: "floor", face: "any", words: ["carpet"], fill: "#7a5a4a" },
  fireplace: { label: "Fireplace", w: 1200, d: 400, h: 1150, kg: 200, mount: "floor", face: "room", fill: "#8d8a83" },
  piano: { label: "Upright piano", w: 1500, d: 600, h: 1250, kg: 230, mount: "floor", face: "room", users: ["chair", "bar_stool"], fill: "#151618" },
  lamp: { label: "Floor lamp", w: 400, d: 400, h: 1600, kg: 5, mount: "floor", face: "any", words: ["floor lamp", "standing lamp"], fill: "#f3c56b" },
  table_lamp: { label: "Table lamp", w: 280, d: 280, h: 450, kg: 2, mount: "surface", on: ["nightstand", "desk", "sideboard", "dresser", "table"], face: "any", words: ["desk lamp", "bedside lamp"], fill: "#f3c56b" },
  plant: { label: "Plant", w: 400, d: 400, h: 1200, kg: 10, mount: "floor", face: "any", fill: "#3f7a4a" },
  ceiling_fan: { label: "Ceiling fan", w: 1300, d: 1300, h: 400, kg: 7, mount: "ceiling", at: 2250, face: "any", fill: "#d9d2c4" },
  pendant_light: { label: "Pendant light", w: 400, d: 400, h: 400, kg: 2, mount: "ceiling", at: 1900, face: "any", words: ["chandelier", "ceiling light"], fill: "#f3c56b" },
  // office
  desk: { label: "Desk", w: 1200, d: 600, h: 750, kg: 30, mount: "floor", face: "room", users: ["office_chair", "chair"], fill: WOOD },
  office_chair: { label: "Office chair", w: 600, d: 600, h: 1100, kg: 14, mount: "floor", face: "to", to: ["desk", "table"], words: ["desk chair", "swivel chair"], fill: "#2b2c30" },
  computer: { label: "Computer", w: 900, d: 450, h: 460, kg: 12, mount: "surface", on: DESKS, back: true, face: "with", words: ["pc", "desktop", "desktop computer", "workstation", "imac"], fill: BLACK },
  monitor: { label: "Monitor", w: 620, d: 200, h: 460, kg: 5, mount: "surface", on: DESKS, back: true, face: "with", words: ["screen", "display"], fill: BLACK },
  laptop: { label: "Laptop", w: 340, d: 240, h: 230, kg: 1.6, mount: "surface", on: DESKS, face: "with", words: ["notebook", "macbook"], fill: "#9da3aa" },
  printer: { label: "Printer", w: 450, d: 400, h: 250, kg: 10, mount: "surface", on: ["desk", "sideboard", "filing_cabinet", "table"], face: "with", fill: "#e6e1d6" },
  filing_cabinet: { label: "Filing cabinet", w: 400, d: 600, h: 720, kg: 30, mount: "floor", face: "room", words: ["drawer unit", "pedestal"], fill: "#7d8187" },
  // laundry, services, outside
  washing_machine: { label: "Washing machine", w: 600, d: 600, h: 850, kg: 70, mount: "floor", face: "room", words: ["washer"], fill: WHITE },
  dryer: { label: "Dryer", w: 600, d: 600, h: 850, kg: 40, mount: "floor", face: "room", fill: WHITE },
  water_heater: { label: "Water heater", w: 560, d: 560, h: 1500, kg: 60, mount: "floor", face: "room", words: ["geyser", "hot water tank"], fill: "#e6e1d6" },
  treadmill: { label: "Treadmill", w: 800, d: 1900, h: 1400, kg: 90, mount: "floor", face: "room", fill: "#2b2c30" },
  car: { label: "Car", w: 1800, d: 4500, h: 1500, kg: 1400, mount: "floor", face: "any", fill: "#55606b" },
};

export const CATALOG: Record<string, ObjectSpec> = { ...BASE, ...EXTRA };

export const OBJECT_KINDS = [...Object.keys(CATALOG), "other"];

/** One line per kind for a model's instructions: "monitor 550x200x450 on desk/counter". */
export function catalogBrief(): string {
  return Object.entries(CATALOG).map(([k, s]) => {
    const where = s.mount === "wall" ? `wall, ${s.at ?? 1200} up` : s.mount === "ceiling" ? "ceiling" : s.mount === "surface" ? `on ${(s.on ?? []).slice(0, 2).join("/") || "a surface"}` : "";
    return `${k} ${s.w}x${s.d}x${s.h}${where ? ` ${where}` : ""}`;
  }).join("; ");
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The catalogue kind for a word ("PC", "couch", "bar stool"), or null when it isn't one we know. */
export function kindFor(word: string | null | undefined): string | null {
  const w = norm(word ?? "");
  if (!w) return null;
  const key = w.replace(/ /g, "_");
  if (CATALOG[key]) return key;
  for (const [k, s] of Object.entries(CATALOG)) if (norm(s.label) === w || s.words?.some((x) => norm(x) === w)) return k;
  return null;
}

export const specOf = (kind: string): ObjectSpec | null => CATALOG[kind] ?? null;

/** Usual height of a kind, mm (850 when nobody knows). */
export const typicalHeight = (kind: string) => CATALOG[kind]?.h ?? 850;

/** A part of a custom-built object, in its own frame: x to the right as seen from the front, y up from
 *  its bottom, z toward the front, all mm from the middle of its footprint; w, h, d its size. */
export interface Part { shape: "box" | "cylinder" | "sphere"; x: number; y: number; z: number; w: number; h: number; d: number; color?: string }

/** Height of its bottom above the floor, mm: as placed, else where its kind usually hangs. */
export function bottomOf(f: { kind: string; elevation_mm?: number | null }): number {
  if (f.elevation_mm) return f.elevation_mm;
  const s = CATALOG[f.kind];
  return s && (s.mount === "wall" || s.mount === "ceiling") ? s.at ?? 0 : 0;
}
export const topOf = (f: { kind: string; elevation_mm?: number | null; height_mm?: number | null }) => bottomOf(f) + (f.height_mm ?? typicalHeight(f.kind));
export const weightOf = (f: { kind: string; weight_kg?: number | null }) => f.weight_kg ?? CATALOG[f.kind]?.kg ?? null;

/** A catalogue kind's own parts, stretched to an object of w x d x h mm; null when it has none. */
export function partsOf(kind: string, w: number, d: number, h: number): Part[] | null {
  const s = CATALOG[kind];
  if (!s?.parts?.length) return null;
  const sx = w / s.w, sz = d / s.d, sy = h / s.h;
  return s.parts.map((q) => ({ ...q, x: q.x * sx, w: q.w * sx, z: q.z * sz, d: q.d * sz, y: q.y * sy, h: q.h * sy }));
}
/** The kind it is drawn as: its own, or the one it looks like (a loveseat is drawn as a sofa). */
export const drawnAs = (kind: string) => CATALOG[kind]?.like ?? kind;
/** Long things whose front is along their long side (sofas, benches, desks). */
export const wideFront = (kind: string) => { const s = CATALOG[drawnAs(kind)] ?? CATALOG[kind]; return !!s && s.w > s.d * 1.15; };
