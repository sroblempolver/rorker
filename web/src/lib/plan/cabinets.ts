// Kitchen and bath cabinets: the US stock catalog (base, drawer base, sink base, corners, wall, tall,
// oven, fridge wall, vanity, linen, medicine cabinets, fillers and panels), each with its industry code
// (B18, DB24, SB36, W3030, U188424), the stock widths and heights it comes in, and its fronts (doors and
// drawers). Every default size is a company standard (`cab.*`, `bath.*`) so a contractor can build to
// their own line, and any cabinet can be typed to any size: a size that isn't stock is a custom size.
// A cabinet is a sketch fixture with a `cab` field; sizes live on the fixture (width, depth, height,
// elevation) like any other thing. Lengths in mm; the catalog's own lists are in inches, as sold.
import { defineStandards, std } from "./standards";
import { INCH } from "./units";
import type { Part } from "./catalog";

const inch = (n: number) => Math.round(n * INCH * 10) / 10;
const step = (a: number, b: number, by = 3) => Array.from({ length: Math.floor((b - a) / by) + 1 }, (_, i) => a + i * by);

defineStandards([
  { key: "cab.base.height", group: "Kitchen cabinets", label: "Base cabinet height", value: inch(34.5), unit: "len", help: "The box without the countertop. With a 1½\" top the counter is at 36\"." },
  { key: "cab.base.depth", group: "Kitchen cabinets", label: "Base cabinet depth", value: inch(24), unit: "len" },
  { key: "cab.toekick", group: "Kitchen cabinets", label: "Toe kick height", value: inch(4.5), unit: "len" },
  { key: "cab.toekick.depth", group: "Kitchen cabinets", label: "Toe kick depth", value: inch(3), unit: "len" },
  { key: "cab.wall.height", group: "Kitchen cabinets", label: "Wall cabinet height", value: inch(30), unit: "len", help: "30\" under an 8' ceiling with a soffit or crown; 36\" or 42\" to go higher." },
  { key: "cab.wall.depth", group: "Kitchen cabinets", label: "Wall cabinet depth", value: inch(12), unit: "len" },
  { key: "cab.wall.bottom", group: "Kitchen cabinets", label: "Wall cabinets, bottom above the floor", value: inch(54), unit: "len", help: "36\" counter plus an 18\" backsplash." },
  { key: "cab.tall.height", group: "Kitchen cabinets", label: "Tall cabinet height", value: inch(84), unit: "len", help: "Lines up with the top of 30\" wall cabinets. 90\" and 96\" are also stock." },
  { key: "cab.tall.depth", group: "Kitchen cabinets", label: "Tall cabinet depth", value: inch(24), unit: "len" },
  { key: "cab.fridgewall.height", group: "Kitchen cabinets", label: "Cabinet over the fridge, height", value: inch(15), unit: "len" },
  { key: "cab.fridgewall.depth", group: "Kitchen cabinets", label: "Cabinet over the fridge, depth", value: inch(24), unit: "len", help: "24\" deep so it lines up with the fridge front." },
  { key: "cab.fill.max", group: "Kitchen cabinets", label: "Widest cabinet when filling a wall", value: inch(36), unit: "len" },
  { key: "cab.width.step", group: "Kitchen cabinets", label: "Stock widths go up by", value: inch(3), unit: "len" },
  { key: "cab.snap", group: "Kitchen cabinets", label: "A typed width this close to a stock width snaps to it", value: inch(0.5), unit: "len" },
  { key: "cab.sink.width", group: "Kitchen cabinets", label: "Sink base width", value: inch(36), unit: "len" },
  { key: "cab.filler.width", group: "Countertops and trim", label: "Filler width", value: inch(3), unit: "len", help: "Stock fillers are 3\" and 6\", cut to fit." },
  { key: "cab.filler.end", group: "Countertops and trim", label: "Filler at a wall, at least", value: inch(1.5), unit: "len", help: "So doors and drawers open past the wall and its trim." },
  { key: "cab.panel.thick", group: "Countertops and trim", label: "End panel thickness", value: inch(0.75), unit: "len" },
  { key: "cab.counter.thick", group: "Countertops and trim", label: "Countertop thickness", value: inch(1.25), unit: "len", help: "Stone slabs are about 1¼\"; laminate with a built-up edge 1½\"." },
  { key: "cab.counter.overhang", group: "Countertops and trim", label: "Countertop overhang at the front", value: inch(1.5), unit: "len", help: "A 24\" base with 1½\" overhang is a 25½\" deep top." },
  { key: "cab.crown", group: "Countertops and trim", label: "Crown molding height", value: inch(3), unit: "len" },
  { key: "cab.lightrail", group: "Countertops and trim", label: "Light rail height", value: inch(1.5), unit: "len" },
  { key: "cab.range.width", group: "Appliance spaces", label: "Range opening", value: inch(30), unit: "len" },
  { key: "cab.dw.width", group: "Appliance spaces", label: "Dishwasher opening", value: inch(24), unit: "len" },
  { key: "cab.fridge.width", group: "Appliance spaces", label: "Fridge opening, width", value: inch(36), unit: "len" },
  { key: "cab.fridge.depth", group: "Appliance spaces", label: "Fridge depth", value: inch(30), unit: "len" },
  { key: "cab.fridge.height", group: "Appliance spaces", label: "Fridge opening, height", value: inch(70), unit: "len", help: "Clear height under the cabinet over the fridge." },
  { key: "cab.hood.bottom", group: "Appliance spaces", label: "Range hood, bottom above the floor", value: inch(66), unit: "len", help: "About 30\" over the cooking surface." },
  { key: "cab.vanity.height", group: "Bath", label: "Vanity height", value: inch(34.5), unit: "len", help: "Comfort height. Older and kids' vanities are 30½\"." },
  { key: "cab.vanity.depth", group: "Bath", label: "Vanity depth", value: inch(21), unit: "len" },
  { key: "cab.linen.height", group: "Bath", label: "Linen cabinet height", value: inch(84), unit: "len" },
  { key: "cab.linen.depth", group: "Bath", label: "Linen cabinet depth", value: inch(21), unit: "len" },
  { key: "cab.medicine.height", group: "Bath", label: "Medicine cabinet height", value: inch(30), unit: "len" },
  { key: "cab.medicine.depth", group: "Bath", label: "Medicine cabinet depth", value: inch(5), unit: "len" },
  { key: "cab.medicine.bottom", group: "Bath", label: "Medicine cabinet, bottom above the floor", value: inch(46), unit: "len" },
  { key: "bath.toilet.width", group: "Bath", label: "Toilet width", value: inch(20), unit: "len" },
  { key: "bath.toilet.depth", group: "Bath", label: "Toilet depth", value: inch(28), unit: "len" },
  { key: "bath.tub.length", group: "Bath", label: "Bathtub length", value: inch(60), unit: "len" },
  { key: "bath.tub.width", group: "Bath", label: "Bathtub width", value: inch(30), unit: "len" },
  { key: "bath.tub.height", group: "Bath", label: "Bathtub height", value: inch(20), unit: "len" },
  { key: "bath.shower.width", group: "Bath", label: "Shower width", value: inch(36), unit: "len" },
  { key: "bath.shower.depth", group: "Bath", label: "Shower depth", value: inch(36), unit: "len" },
]);

export type Zone = "base" | "wall" | "tall";
export type CabFamily =
  | "base" | "drawer" | "sink" | "blind" | "susan" | "filler_base" | "panel_base"
  | "wall" | "wall_corner" | "wall_blind" | "wall_end" | "fridge_wall" | "filler_wall" | "valance"
  | "tall" | "oven" | "filler_tall" | "panel_tall"
  | "vanity" | "vanity_drawer" | "linen" | "medicine";

/** What a sketch fixture carries when it's a cabinet. Sizes are the fixture's own. */
export interface CabSpec {
  fam: CabFamily;
  /** the doors and drawers on its front (see FRONTS) */
  config?: string;
  /** which side a single door hinges on, or which side is blind on a blind corner */
  hinge?: "L" | "R";
  /** countertop on a base cabinet, crown molding and light rail on a wall or tall one */
  counter?: boolean; crown?: boolean; rail?: boolean;
}

export interface FamilyDef {
  id: CabFamily; label: string; zone: Zone; group: CabGroup;
  /** the code before the size: B, DB, SB, W, U, OC, V */
  prefix: string;
  /** stock widths, and heights when it comes in several (inches) */
  widths: number[]; heights?: number[];
  configs: string[];
  /** catalogue kind it is drawn and counted as elsewhere */
  kind: string;
  /** the size codes carry: width only (B18), width and height (W3030), or all three (W361524) */
  code: "w" | "wh" | "whd";
  /** blind part of a blind corner, inches */
  blind?: number;
}
export type CabGroup = "Base" | "Wall" | "Tall" | "Corners" | "Fillers and panels" | "Bath";

const WALL_H = [12, 15, 18, 24, 30, 36, 42];
export const FAMILIES: FamilyDef[] = [
  { id: "base", label: "Base", zone: "base", group: "Base", prefix: "B", widths: step(9, 48), configs: ["1d1dr", "2d1dr", "2d2dr", "1d", "2d"], kind: "base_cabinet", code: "w" },
  { id: "drawer", label: "Drawer base", zone: "base", group: "Base", prefix: "DB", widths: step(12, 36), configs: ["3dr", "4dr", "2dr"], kind: "base_cabinet", code: "w" },
  { id: "sink", label: "Sink base", zone: "base", group: "Base", prefix: "SB", widths: step(24, 42), configs: ["sink2", "sink1"], kind: "kitchen_sink", code: "w" },
  { id: "blind", label: "Blind corner base", zone: "base", group: "Corners", prefix: "BBC", widths: step(36, 48), configs: ["blind"], kind: "base_cabinet", code: "w", blind: 24 },
  { id: "susan", label: "Lazy susan", zone: "base", group: "Corners", prefix: "LS", widths: [33, 36], configs: ["susan"], kind: "base_cabinet", code: "w" },
  { id: "wall", label: "Wall", zone: "wall", group: "Wall", prefix: "W", widths: step(9, 48), heights: WALL_H, configs: ["1d", "2d", "glass1", "glass2", "open"], kind: "wall_cabinet", code: "wh" },
  { id: "fridge_wall", label: "Over the fridge", zone: "wall", group: "Wall", prefix: "W", widths: [30, 33, 36], heights: [12, 15, 18, 24], configs: ["2d", "1d"], kind: "wall_cabinet", code: "whd" },
  { id: "wall_end", label: "Open end shelf", zone: "wall", group: "Wall", prefix: "WES", widths: [9, 12], heights: [30, 36, 42], configs: ["open"], kind: "wall_cabinet", code: "wh" },
  { id: "wall_corner", label: "Wall diagonal corner", zone: "wall", group: "Corners", prefix: "WDC", widths: [24, 27], heights: [30, 36, 42], configs: ["1d", "glass1"], kind: "wall_cabinet", code: "wh" },
  { id: "wall_blind", label: "Wall blind corner", zone: "wall", group: "Corners", prefix: "WBC", widths: step(24, 36), heights: [30, 36, 42], configs: ["blind"], kind: "wall_cabinet", code: "wh", blind: 12 },
  { id: "tall", label: "Pantry", zone: "tall", group: "Tall", prefix: "U", widths: [18, 24, 30, 36], heights: [84, 90, 96], configs: ["pantry2", "pantry1"], kind: "tall_cabinet", code: "whd" },
  { id: "oven", label: "Oven cabinet", zone: "tall", group: "Tall", prefix: "OC", widths: [27, 30, 33], heights: [84, 90, 96], configs: ["oven", "oven2"], kind: "tall_cabinet", code: "wh" },
  { id: "filler_base", label: "Base filler", zone: "base", group: "Fillers and panels", prefix: "BF", widths: [3, 6], configs: ["plain"], kind: "filler", code: "w" },
  { id: "filler_wall", label: "Wall filler", zone: "wall", group: "Fillers and panels", prefix: "WF", widths: [3, 6], heights: WALL_H, configs: ["plain"], kind: "filler", code: "wh" },
  { id: "filler_tall", label: "Tall filler", zone: "tall", group: "Fillers and panels", prefix: "TF", widths: [3, 6], heights: [84, 90, 96], configs: ["plain"], kind: "filler", code: "wh" },
  { id: "panel_base", label: "Dishwasher / end panel", zone: "base", group: "Fillers and panels", prefix: "DWP", widths: [0.75], configs: ["plain"], kind: "filler", code: "w" },
  { id: "panel_tall", label: "Fridge end panel", zone: "tall", group: "Fillers and panels", prefix: "REP", widths: [0.75], heights: [84, 90, 96], configs: ["plain"], kind: "filler", code: "wh" },
  { id: "valance", label: "Valance (over a window)", zone: "wall", group: "Fillers and panels", prefix: "VAL", widths: [30, 36, 48, 60], configs: ["plain"], kind: "filler", code: "w" },
  { id: "vanity", label: "Vanity", zone: "base", group: "Bath", prefix: "V", widths: [18, 24, 30, 36, 42, 48, 60, 72], configs: ["vsink2", "vsink1", "vsides", "1d1dr"], kind: "vanity", code: "w" },
  { id: "vanity_drawer", label: "Vanity drawers", zone: "base", group: "Bath", prefix: "VDB", widths: [12, 15, 18, 21, 24], configs: ["3dr", "4dr"], kind: "vanity", code: "w" },
  { id: "linen", label: "Linen cabinet", zone: "tall", group: "Bath", prefix: "LC", widths: [18, 24], heights: [84, 90, 96], configs: ["linen_dr", "linen_d"], kind: "tall_cabinet", code: "wh" },
  { id: "medicine", label: "Medicine cabinet", zone: "wall", group: "Bath", prefix: "MC", widths: [16, 20, 24, 30, 36], heights: [26, 30], configs: ["mirror"], kind: "medicine_cabinet", code: "wh" },
];
export const famOf = (id: string): FamilyDef => FAMILIES.find((f) => f.id === id) ?? FAMILIES[0];
const BASE_ZONE_KITCHEN = new Set<CabFamily>(["base", "drawer", "sink", "blind", "susan", "filler_base"]);

/** Fronts on a cabinet: what you see facing it, top row first. */
export const FRONTS: Record<string, string> = {
  "1d1dr": "1 door, 1 drawer", "2d1dr": "2 doors, 1 drawer", "2d2dr": "2 doors, 2 drawers", "1d": "Full door", "2d": "2 doors",
  "2dr": "2 drawers", "3dr": "3 drawers", "4dr": "4 drawers", sink2: "2 doors, false front", sink1: "1 door, false front",
  glass1: "Glass door", glass2: "2 glass doors", open: "Open shelves", blind: "Door and blind panel", susan: "Corner doors (lazy susan)",
  pantry2: "2 doors over 2 doors", pantry1: "Door over door", oven: "Oven, door above, drawer below", oven2: "Double oven",
  vsink2: "Sink, 2 doors", vsink1: "Sink, 1 door", vsides: "Doors with drawers each side", linen_dr: "Doors over drawers", linen_d: "Door over door",
  mirror: "Mirror door", plain: "Plain",
};

// ----- sizes -----

/** Where a wall cabinet's top lines up: the standard bottom plus the standard height. */
export const wallTop = () => std("cab.wall.bottom") + std("cab.wall.height");

/** The sizes a new cabinet of this family starts at (mm): width, depth, height, bottom above the floor. */
export function defaults(fam: CabFamily, wIn?: number, hIn?: number): { w: number; d: number; h: number; z: number } {
  const F = famOf(fam);
  const w = inch(wIn ?? (fam === "sink" ? std("cab.sink.width") / INCH : fam.startsWith("filler") ? std("cab.filler.width") / INCH : F.widths.includes(18) ? 18 : F.widths[Math.floor(F.widths.length / 2)]));
  const panel = fam === "panel_base" || fam === "panel_tall";
  const width = panel ? std("cab.panel.thick") : w;
  const h = hIn ? inch(hIn) : heightOf(fam);
  if (F.zone === "base") {
    const bath = fam === "vanity" || fam === "vanity_drawer";
    return { w: width, d: bath ? std("cab.vanity.depth") : std("cab.base.depth"), h, z: 0 };
  }
  if (F.zone === "tall") return { w: width, d: fam === "linen" ? std("cab.linen.depth") : std("cab.tall.depth"), h, z: 0 };
  const d = fam === "fridge_wall" ? std("cab.fridgewall.depth") : fam === "medicine" ? std("cab.medicine.depth") : fam === "wall_corner" ? inch(24) : fam === "valance" ? inch(0.75) : std("cab.wall.depth");
  return { w: width, d, h, z: bottomFor(fam, h) };
}
function heightOf(fam: CabFamily): number {
  const F = famOf(fam);
  if (F.zone === "base") return fam === "vanity" || fam === "vanity_drawer" ? std("cab.vanity.height") : std("cab.base.height");
  if (F.zone === "tall") return fam === "linen" ? std("cab.linen.height") : std("cab.tall.height");
  if (fam === "fridge_wall") return std("cab.fridgewall.height");
  if (fam === "medicine") return std("cab.medicine.height");
  if (fam === "valance") return inch(6);
  return std("cab.wall.height");
}
/** A wall cabinet's bottom: short ones (over a fridge, range or sink) line up their tops with the rest. */
export function bottomFor(fam: CabFamily, h: number): number {
  if (fam === "medicine") return std("cab.medicine.bottom");
  if (fam === "valance") return std("cab.wall.bottom");
  return h < std("cab.wall.height") - 1 ? wallTop() - h : std("cab.wall.bottom");
}
/** What it starts with: a counter on kitchen base cabinets and vanities, crown on wall and tall ones. */
export function newSpec(fam: CabFamily, wMm: number): CabSpec {
  const F = famOf(fam);
  const spec: CabSpec = { fam, config: defaultConfig(fam, wMm) };
  if (BASE_ZONE_KITCHEN.has(fam) || fam === "vanity" || fam === "vanity_drawer") spec.counter = true;
  if ((F.zone === "wall" || F.zone === "tall") && !["medicine", "valance", "panel_tall"].includes(fam)) spec.crown = true;
  if (F.configs.some((c) => c === "1d" || c === "glass1" || c === "1d1dr" || c === "blind" || c === "sink1" || c === "vsink1" || c === "pantry1" || c === "linen_d")) spec.hinge = fam === "blind" || fam === "wall_blind" ? "L" : "L";
  return spec;
}
/** Single doors up to 21" wide, a pair from 24". */
export function defaultConfig(fam: CabFamily, wMm: number): string {
  const F = famOf(fam), wide = wMm >= inch(23);
  if (fam === "base") return wide ? "2d1dr" : "1d1dr";
  if (fam === "sink") return wide ? "sink2" : "sink1";
  if (fam === "wall" || fam === "fridge_wall") return wide ? "2d" : "1d";
  if (fam === "tall") return wide ? "pantry2" : "pantry1";
  if (fam === "vanity") return wMm >= inch(47) ? "vsides" : wide ? "vsink2" : "vsink1";
  return F.configs[0];
}

const isIn = (list: number[], mm: number) => list.some((x) => Math.abs(inch(x) - mm) < 1.5);
/** Whether a cabinet is a stock size: a listed width and height (or the standard one) and the standard depth. */
export function isStock(fam: CabFamily, w: number, d: number, h: number): boolean {
  const F = famOf(fam), def = defaults(fam);
  if (fam.startsWith("filler")) return Math.abs(d - def.d) < 1.5 && (F.heights ? isIn(F.heights, h) || Math.abs(h - def.h) < 1.5 : Math.abs(h - def.h) < 1.5);
  const okW = fam === "panel_base" || fam === "panel_tall" ? Math.abs(w - def.w) < 1.5 : isIn(F.widths, w);
  const okH = F.heights ? isIn(F.heights, h) || Math.abs(h - def.h) < 1.5 : Math.abs(h - def.h) < 1.5;
  return okW && okH && Math.abs(d - def.d) < 1.5;
}
/** A typed width pulled onto the nearest stock width when it's within the company's snap (else as typed). */
export function snapWidth(fam: CabFamily, mm: number): number {
  const F = famOf(fam);
  let best = mm, d = std("cab.snap") + 0.01;
  for (const w of F.widths) { const x = inch(w); if (Math.abs(x - mm) < d) { d = Math.abs(x - mm); best = x; } }
  return best;
}

/** Inches for a code: 9 -> "09", 34.5 -> "34½", 17.25 -> "17¼". */
function codeNum(mm: number): string {
  const q = Math.round((mm / INCH) * 4) / 4, whole = Math.floor(q), frac = q - whole;
  const f = frac === 0.25 ? "¼" : frac === 0.5 ? "½" : frac === 0.75 ? "¾" : "";
  return `${whole < 10 && whole > 0 ? "0" : ""}${whole}${f}`;
}
/** The industry code for a cabinet at its own size: B18, DB24, SB36, W3030, W361524, U188424. */
export function cabCode(c: CabSpec, w: number, d: number, h: number): string {
  const F = famOf(c.fam);
  if (c.fam === "panel_base") return "DWP";
  if (c.fam === "panel_tall") return `REP${codeNum(h)}`;
  // a filler is named for the stock filler it's cut from: BF3, WF330, TF684
  if (c.fam.startsWith("filler")) { const s = w <= inch(3) + 1 ? "3" : w <= inch(6) + 1 ? "6" : codeNum(w); return F.prefix + s + (F.code !== "w" ? codeNum(h) : ""); }
  const base = F.prefix + codeNum(w) + (F.code !== "w" ? codeNum(h) : "") + (F.code === "whd" ? codeNum(d) : "");
  if (c.fam === "base" && c.config === "1d") return `BFH${codeNum(w)}`;
  if (c.fam === "drawer" && c.config === "4dr") return `${base}-4`;
  if (c.fam === "wall" && (c.config === "glass1" || c.config === "glass2")) return `${base}GD`;
  return base;
}

// ----- fronts -----

export type FrontKind = "door" | "drawer" | "false" | "glass" | "open" | "oven" | "blind" | "mirror" | "plain";
/** One door or drawer front, mm from the cabinet's left end and from the bottom of its front. */
export interface Front { t: FrontKind; x: number; y: number; w: number; h: number; hinge?: "L" | "R" }
type Row = { t: FrontKind; h?: number; frac?: number; n?: number };

const REVEAL = 3;
/** Rows of fronts from the top: fixed heights (inches), fractions of the front, and the rest shared. */
function rows(list: Row[], W: number, H: number, hinge: "L" | "R"): Front[] {
  const fixed = list.reduce((s, r) => s + (r.h ? inch(r.h) : r.frac ? r.frac * H : 0), 0);
  const flex = list.filter((r) => !r.h && !r.frac).length;
  const rest = flex ? Math.max(0, H - fixed) / flex : 0;
  const out: Front[] = [];
  let top = H;
  for (const r of list) {
    const rh = r.h ? inch(r.h) : r.frac ? r.frac * H : rest, n = r.n ?? 1, cw = W / n;
    for (let k = 0; k < n; k++) {
      const fr: Front = { t: r.t, x: k * cw + REVEAL / 2, y: top - rh + REVEAL / 2, w: cw - REVEAL, h: rh - REVEAL };
      if (r.t === "door" || r.t === "glass" || r.t === "mirror") fr.hinge = n === 1 ? hinge : k === 0 ? "L" : "R";
      out.push(fr);
    }
    top -= rh;
  }
  return out;
}

/** The fronts on a cabinet of W x H mm of front, by its configuration. */
export function frontsOf(c: CabSpec, W: number, H: number): Front[] {
  const hinge = c.hinge ?? "L", F = famOf(c.fam);
  const two = W >= inch(23) ? 2 : 1;
  switch (c.config ?? defaultConfig(c.fam, W)) {
    case "1d1dr": return rows([{ t: "drawer", h: 6 }, { t: "door" }], W, H, hinge);
    case "2d1dr": return rows([{ t: "drawer", h: 6 }, { t: "door", n: 2 }], W, H, hinge);
    case "2d2dr": return rows([{ t: "drawer", h: 6, n: 2 }, { t: "door", n: 2 }], W, H, hinge);
    case "1d": return rows([{ t: "door" }], W, H, hinge);
    case "2d": return rows([{ t: "door", n: 2 }], W, H, hinge);
    case "2dr": return rows([{ t: "drawer", frac: 0.42 }, { t: "drawer" }], W, H, hinge);
    case "3dr": return rows([{ t: "drawer", h: 6 }, { t: "drawer", frac: 0.37 }, { t: "drawer" }], W, H, hinge);
    case "4dr": return rows([{ t: "drawer", h: 5 }, { t: "drawer", h: 6 }, { t: "drawer", frac: 0.3 }, { t: "drawer" }], W, H, hinge);
    case "sink2": case "vsink2": return rows([{ t: "false", h: 6 }, { t: "door", n: 2 }], W, H, hinge);
    case "sink1": case "vsink1": return rows([{ t: "false", h: 6 }, { t: "door" }], W, H, hinge);
    case "glass1": return rows([{ t: "glass" }], W, H, hinge);
    case "glass2": return rows([{ t: "glass", n: 2 }], W, H, hinge);
    case "open": return rows([{ t: "open" }], W, H, hinge);
    case "mirror": return rows([{ t: "mirror", n: W > inch(29) ? 2 : 1 }], W, H, hinge);
    case "plain": return [];
    case "pantry2": return rows([{ t: "door", n: two, frac: 0.42 }, { t: "door", n: two }], W, H, hinge);
    case "pantry1": return rows([{ t: "door", frac: 0.42 }, { t: "door" }], W, H, hinge);
    case "linen_d": return rows([{ t: "door", frac: 0.45 }, { t: "door" }], W, H, hinge);
    case "linen_dr": return rows([{ t: "door", n: two }, { t: "drawer", h: 10 }, { t: "drawer", h: 10 }], W, H, hinge);
    case "oven": return rows([{ t: "door" }, { t: "oven", h: 30 }, { t: "drawer", h: 12 }], W, H, hinge);
    case "oven2": return rows([{ t: "door" }, { t: "oven", h: 28 }, { t: "oven", h: 28 }, { t: "drawer", h: 6 }], W, H, hinge);
    case "susan": return rows([{ t: "drawer", h: 6, n: 2 }, { t: "door", n: 2 }], W, H, hinge);
    case "blind": {
      // the blind part sits in the corner behind the cabinet on the other wall; the door is the rest
      const bw = Math.min(W - inch(9), inch(F.blind ?? 24)), dw = W - bw;
      const door = rows(c.fam === "blind" ? [{ t: "drawer", h: 6 }, { t: "door" }] : [{ t: "door" }], dw, H, hinge === "L" ? "R" : "L");
      const blindLeft = hinge === "L";
      return [{ t: "blind", x: (blindLeft ? 0 : dw) + REVEAL / 2, y: REVEAL / 2, w: bw - REVEAL, h: H - REVEAL }, ...door.map((f) => ({ ...f, x: f.x + (blindLeft ? bw : 0) }))];
    }
    case "vsides": {
      // drawer banks at both ends, doors under a false front in the middle
      const side = Math.min(inch(12), W / 4), mid = W - side * 2;
      const bank = rows([{ t: "drawer", h: 6 }, { t: "drawer", frac: 0.37 }, { t: "drawer" }], side, H, hinge);
      const doors = rows([{ t: "false", h: 6 }, { t: "door", n: mid >= inch(23) ? 2 : 1 }], mid, H, hinge);
      return [...bank, ...doors.map((f) => ({ ...f, x: f.x + side })), ...bank.map((f) => ({ ...f, x: f.x + side + mid }))];
    }
  }
  return rows([{ t: "door", n: two }], W, H, hinge);
}

/** Height of the toe kick under a cabinet (0 for wall cabinets). */
export const toeOf = (c: CabSpec) => (famOf(c.fam).zone === "wall" || c.fam.startsWith("panel") ? 0 : std("cab.toekick"));

/** The face of a cabinet: where its fronts go, mm up from its own bottom. */
export function faceOf(c: CabSpec, h: number): [number, number] { return [toeOf(c), h]; }

/** Which `front` word the plan viewer's elevations use for it. */
export function viewerFront(c: CabSpec): string {
  const k = c.config ?? "";
  if (c.fam.startsWith("filler")) return "filler";
  if (c.fam.startsWith("panel") || c.fam === "valance") return "panel";
  if (c.fam === "blind") return "blind_corner";
  if (c.fam === "susan") return "lazy_susan";
  if (/dr$/.test(k) && !/d1dr|d2dr/.test(k)) return "drawers";
  if (k.startsWith("sink") || k.startsWith("vsink")) return "sink";
  if (k === "1d" || k === "glass1" || k === "1d1dr") return "door";
  return "doors";
}

// ----- 3D -----

const C3 = { box: "#d9d0bf", front: "#efe8da", kick: "#2f2d2a", top: "#4a4844", handle: "#6d6a63", glass: "#8fb8c9", dark: "#2a2b2e", steel: "#b9bec4", mirror: "#cfe6ee", wood: "#a07850" };

/** A cabinet built from boxes at its true size, for the 3D: box, toe kick, fronts, handles, countertop,
 *  crown and light rail. In the catalogue's part frame (x right seen from the front, y up from its bottom,
 *  z toward the front, mm from the middle of its footprint). */
export function cabinetParts(c: CabSpec, w: number, d: number, h: number): Part[] {
  const P: Part[] = [];
  const b = (x: number, y: number, z: number, bw: number, bd: number, bh: number, color: string) => P.push({ shape: "box", x, y, z, w: bw, h: bh, d: bd, color });
  const toe = toeOf(c), F = famOf(c.fam), bath = c.fam === "vanity" || c.fam === "vanity_drawer";
  const body = bath ? C3.wood : C3.box;
  if (c.fam.startsWith("panel")) { b(0, 0, 0, w, d, h, C3.front); return P; }
  if (c.fam === "valance") { b(0, 0, d / 2 - 10, w, 19, h, C3.front); return P; }
  const kd = std("cab.toekick.depth");
  if (toe > 0) { b(0, 0, -kd / 2, w - 2, d - kd, toe, C3.kick); b(0, toe, 0, w, d - 19, h - toe, body); }
  else b(0, 0, 0, w, d - 19, h, body);
  const zf = d / 2 - 10;
  if (c.fam.startsWith("filler")) { b(0, toe, zf, w, 19, h - toe, C3.front); }
  else for (const f of frontsOf(c, w, h - toe)) {
    const x = -w / 2 + f.x + f.w / 2, y = toe + f.y;
    const col = f.t === "glass" ? C3.glass : f.t === "open" ? C3.dark : f.t === "oven" ? C3.dark : f.t === "mirror" ? C3.mirror : bath ? "#b48a5e" : C3.front;
    if (f.t === "open") { b(x, y, zf - 150, f.w, 10, f.h, C3.dark); for (let k = 1; k < 3; k++) b(x, y + (f.h * k) / 3, 0, f.w, d - 40, 15, body); continue; }
    b(x, y, zf, f.w, 19, f.h, col);
    if (f.t === "oven") { b(x, y + f.h - 60, zf + 25, f.w * 0.7, 20, 20, C3.steel); continue; }
    if (f.t === "drawer") b(x, y + f.h - Math.min(70, f.h / 3), zf + 20, Math.min(160, f.w * 0.4), 20, 12, C3.handle);
    else if (f.t === "door" || f.t === "glass") {
      const hx = f.hinge === "R" ? x - f.w / 2 + 40 : x + f.w / 2 - 40;
      const up = F.zone === "wall";
      b(hx, up ? y + 40 : y + f.h - 200, zf + 20, 12, 20, 140, C3.handle);
    }
  }
  if (c.counter) {
    const t = std("cab.counter.thick"), o = std("cab.counter.overhang");
    b(0, h, o / 2, w, d + o, t, bath ? "#e8e4dc" : C3.top);
    if (c.fam === "sink" || c.config?.startsWith("vsink") || c.config === "vsides") {
      b(0, h + t, 0, Math.min(w * 0.75, inch(30)), d * 0.6, 4, C3.steel);
      b(0, h + t, -d / 2 + 70, 30, 30, 300, C3.steel);
    }
  }
  if (c.crown) { const ch = std("cab.crown"); b(0, h, 20, w + (F.zone === "wall" ? 0 : 0), d + 40, ch, C3.front); }
  if (c.rail && F.zone === "wall") { const rh = std("cab.lightrail"); b(0, -rh, 10, w, 20, rh, C3.front); }
  return P;
}

/** Everything the plan needs for a sketch cabinet: the parts for 3D, the viewer's front word, its name,
 *  and the full height with the countertop. */
export function cabinetFixture(c: CabSpec, w: number, d: number, h: number) {
  const top = c.counter ? std("cab.counter.thick") : 0;
  return { parts: cabinetParts(c, w, d, h), front: viewerFront(c), height_mm: Math.round(h + top + (c.crown ? std("cab.crown") : 0)), spec: cabCode(c, w, d, h) };
}

// ----- the list -----

export interface CabItem { code: string; label: string; count: number; custom: boolean }
type Fx = { cab?: CabSpec; kind: string; width_mm?: number; depth_mm?: number; height_mm?: number };
/** The cabinet list for a floor (a KCD-style item list): codes and counts, then trim by the foot and
 *  countertop by the square foot. */
export function cabinetList(fixtures: Fx[]) {
  const items = new Map<string, CabItem>();
  let crown = 0, rail = 0, kick = 0, counter = 0;
  for (const f of fixtures) {
    if (!f.cab) continue;
    const def = defaults(f.cab.fam), w = f.width_mm ?? def.w, d = f.depth_mm ?? def.d, h = f.height_mm ?? def.h;
    const code = cabCode(f.cab, w, d, h), custom = !isStock(f.cab.fam, w, d, h);
    const it = items.get(code) ?? { code, label: famOf(f.cab.fam).label, count: 0, custom };
    it.count++;
    items.set(code, it);
    if (f.cab.crown) crown += w;
    if (f.cab.rail) rail += w;
    if (toeOf(f.cab) > 0 && !f.cab.fam.startsWith("panel")) kick += w;
    if (f.cab.counter) counter += w * (d + std("cab.counter.overhang"));
  }
  return { items: [...items.values()].sort((a, b) => a.code.localeCompare(b.code)), crown, rail, kick, counterSqft: counter / (304.8 * 304.8) };
}
