// The Kitchen and Bath parts of the catalogue tray: every stock cabinet at every stock size as its own
// pick (B09 to B48, W0930 to W4842, SB24 to SB42, U188424...), with its code, plus appliances, sinks,
// fillers, panels and bath fixtures at their US sizes. Sizes come from the company's standards (cab.*,
// bath.*), so the lists are built when the tray opens. Imported for its side effect by CatalogTray.
import { INCH } from "./units";
import { std } from "./standards";
import { addTraySection, type TrayItem } from "./tray";
import { cabCode, defaultConfig, defaults, famOf, newSpec, type CabFamily } from "./cabinets";
import { plainOf } from "./cabinetLayout";

const I = (n: number) => Math.round(n * INCH * 10) / 10;
const range = (a: number, b: number, by = 3) => Array.from({ length: Math.floor((b - a) / by) + 1 }, (_, i) => a + i * by);

/** A stock cabinet at a width (and height), inches. */
function cab(fam: CabFamily, wIn: number, hIn?: number, config?: string, label?: string, sub?: string): TrayItem {
  const F = famOf(fam), d = defaults(fam), w = I(wIn), h = hIn ? I(hIn) : d.h;
  const spec = { ...newSpec(fam, w), config: config ?? defaultConfig(fam, w) };
  return { kind: F.kind, label: label ?? F.label, w, d: d.d, h, cab: spec, code: cabCode(spec, w, d.d, h), sub };
}
/** Every width of a family at one height; the first one starts a heading. */
const widths = (fam: CabFamily, ws: number[], hIn?: number, sub?: string, config?: string, label?: string) =>
  ws.map((w, i) => cab(fam, w, hIn, config, label, i === 0 ? sub : undefined));
/** Things that go in a run (range, toilet, tub): the size in inches, and the code shown as the size. */
function run(id: string, wIn?: number, dIn?: number, label?: string, sub?: string): TrayItem {
  const p = plainOf(id)!, s = p.size(), w = wIn ? I(wIn) : s.w, d = dIn ? I(dIn) : s.d;
  return { kind: p.kind, run: id, label: label ?? p.label, w, d, h: s.h, code: `${Math.round(w / INCH)}"${dIn ? ` x ${Math.round(d / INCH)}"` : ""}`, sub };
}
const plain = (kind: string, wIn: number, dIn: number, hIn: number, label: string, sub?: string): TrayItem =>
  ({ kind, label, w: I(wIn), d: I(dIn), h: I(hIn), code: `${wIn}"`, sub });
const kinds = (s: string, sub?: string): TrayItem[] => s.split(" ").map((kind, i) => ({ kind, sub: i === 0 ? sub : undefined }));

// ----- Kitchen -----

addTraySection("kitchen", { id: "base", label: "Base cabinets", note: "24\" deep, 34½\" high plus the countertop.", items: () => [
  ...widths("base", range(9, 21), undefined, "1 door, 1 drawer"),
  ...widths("base", range(24, 48), undefined, "2 doors, 1 drawer"),
  ...widths("base", range(9, 21), undefined, "Full height door", "1d", "Full height door base"),
] });
addTraySection("kitchen", { id: "drawer", label: "Drawer bases", items: () => [
  ...widths("drawer", range(12, 36), undefined, "3 drawers", "3dr"),
  ...widths("drawer", range(12, 36), undefined, "4 drawers", "4dr"),
] });
addTraySection("kitchen", { id: "sink", label: "Sink bases", note: "Put one under the window. The sink comes with it.", items: () => widths("sink", range(24, 42)) });
addTraySection("kitchen", { id: "corner", label: "Corner cabinets", items: () => [
  ...widths("blind", range(36, 48), undefined, "Blind corner base"),
  ...widths("susan", [33, 36], undefined, "Lazy susan"),
  ...[30, 36, 42].flatMap((h, k) => widths("wall_corner", [24, 27], h, k === 0 ? "Wall diagonal corner" : undefined)),
  ...[30, 36, 42].flatMap((h, k) => widths("wall_blind", range(24, 36), h, k === 0 ? "Wall blind corner" : undefined)),
] });
addTraySection("kitchen", { id: "wall", label: "Wall cabinets", note: "12\" deep. 30\" under an 8' ceiling with crown; 36\" or 42\" to go higher.", items: () => [
  ...[30, 36, 42].flatMap((h) => widths("wall", range(9, 48), h, `${h}" high`)),
  ...[12, 15, 18, 24].flatMap((h, k) => widths("wall", range(24, 36), h, k === 0 ? "Short, over a range, sink or window" : undefined)),
  ...[12, 15, 18, 24].flatMap((h, k) => widths("fridge_wall", [30, 33, 36], h, k === 0 ? "Over the fridge, 24\" deep" : undefined)),
  ...[30, 36, 42].flatMap((h, k) => widths("wall", [12, 15, 18, 24, 30, 36], h, k === 0 ? "Glass doors" : undefined, undefined, "Glass door wall").map((it) => ({ ...it, cab: { ...it.cab!, config: it.w! >= I(23) ? "glass2" : "glass1" }, code: cabCode({ ...it.cab!, config: "glass1" }, it.w!, it.d!, it.h!) }))),
  ...[30, 36, 42].flatMap((h, k) => widths("wall_end", [9, 12], h, k === 0 ? "Open end shelves" : undefined)),
] });
addTraySection("kitchen", { id: "tall", label: "Tall and pantry", note: "24\" deep. 84\" lines up with 30\" wall cabinets.", items: () => [
  ...[84, 90, 96].flatMap((h, k) => widths("tall", [18, 24, 30, 36], h, k === 0 ? "Pantries" : undefined)),
  ...[84, 90, 96].flatMap((h, k) => widths("oven", [27, 30, 33], h, k === 0 ? "Oven cabinets" : undefined, "oven")),
  ...[84, 90, 96].flatMap((h, k) => widths("oven", [27, 30, 33], h, k === 0 ? "Double oven cabinets" : undefined, "oven2", "Double oven cabinet")),
] });
addTraySection("kitchen", { id: "appliances", label: "Appliances", note: "These go in the run like a cabinet: back to the wall, beside their neighbours.", items: () => [
  run("range", 30, undefined, "Range", "Cooking"), run("range", 36, undefined, "Range"), run("range_hood", 30, undefined, "Range hood"), run("range_hood", 36, undefined, "Range hood"),
  run("cooktop_base", 30, undefined, "Cooktop"), run("cooktop_base", 36, undefined, "Cooktop"), run("oven_base", 30, undefined, "Oven under the counter"),
  ...kinds("wall_oven microwave"),
  run("fridge", 30, undefined, "Fridge", "Cold"), run("fridge", 33, undefined, "Fridge"), run("fridge", 36, undefined, "Fridge"),
  ...kinds("wine_cooler chest_freezer"),
  run("dishwasher", 18, undefined, "Dishwasher", "Cleaning"), run("dishwasher", 24, undefined, "Dishwasher"),
  ...kinds("coffee_machine kettle toaster blender stand_mixer air_fryer water_dispenser", "On the counter"),
] });
addTraySection("kitchen", { id: "sinks", label: "Sinks and faucets", note: "A sink base (SB) already holds its sink and faucet. These are for an island, a bar or a laundry.", items: () => {
  const h = (std("cab.base.height") + std("cab.counter.thick")) / INCH;
  return [
    plain("kitchen_sink", 24, 22, h, "Single bowl sink", "Drop-in and undermount"), plain("kitchen_sink", 30, 22, h, "Single bowl sink"),
    plain("kitchen_sink", 33, 22, h, "Double bowl sink"), plain("kitchen_sink", 36, 22, h, "Double bowl sink"),
    plain("kitchen_sink", 30, 25, h, "Farmhouse sink", "Farmhouse (apron front)"), plain("kitchen_sink", 33, 25, h, "Farmhouse sink"), plain("kitchen_sink", 36, 25, h, "Farmhouse sink"),
    plain("kitchen_sink", 15, 15, h, "Bar sink", "Bar and prep"),
    ...kinds("utility_sink dish_rack"),
  ];
} });
addTraySection("kitchen", { id: "trim", label: "Fillers, panels and trim", note: "Crown, light rail, toe kick and countertop are switches on a picked cabinet.", items: () => [
  ...widths("filler_base", [3, 6], undefined, "Base fillers"),
  ...[30, 36, 42].flatMap((h, k) => widths("filler_wall", [3, 6], h, k === 0 ? "Wall fillers" : undefined)),
  ...[84, 90, 96].flatMap((h, k) => widths("filler_tall", [3, 6], h, k === 0 ? "Tall fillers" : undefined)),
  cab("panel_base", 0.75, undefined, undefined, undefined, "Panels"),
  ...[84, 90, 96].map((h) => cab("panel_tall", 0.75, h)),
  ...widths("valance", [30, 36, 48, 60], undefined, "Valance over a window"),
] });

// ----- Bath -----

addTraySection("bath", { id: "vanities", label: "Vanities", note: "21\" deep, 34½\" high (comfort height).", items: () => [
  ...widths("vanity", [18, 24, 30, 36, 42, 48, 60, 72], undefined, "Sink vanities"),
  ...widths("vanity_drawer", [12, 15, 18, 21, 24], undefined, "Drawer banks"),
  ...kinds("washbasin", "Pedestal and wall-hung"),
] });
addTraySection("bath", { id: "toilets", label: "Toilets", items: () => [
  run("toilet", 20, 28, "Round toilet"), run("toilet", 20, 30, "Elongated toilet"),
  ...kinds("bidet urinal"),
] });
addTraySection("bath", { id: "tubs", label: "Tubs and showers", items: () => [
  run("bathtub", 60, 30, "Bathtub", "Tubs"), run("bathtub", 60, 32, "Bathtub"), run("bathtub", 66, 32, "Bathtub"), run("bathtub", 72, 36, "Bathtub"),
  run("shower", 32, 32, "Shower", "Shower bases"), run("shower", 36, 36, "Shower"), run("shower", 42, 36, "Shower"), run("shower", 48, 36, "Shower"), run("shower", 60, 32, "Shower"),
] });
addTraySection("bath", { id: "storage", label: "Storage", items: () => [
  ...[84, 90, 96].flatMap((h, k) => widths("linen", [18, 24], h, k === 0 ? "Linen cabinets" : undefined)),
  ...[26, 30].flatMap((h, k) => widths("medicine", [16, 20, 24, 30, 36], h, k === 0 ? "Medicine cabinets" : undefined)),
  ...kinds("mirror towel_bar towel_radiator toilet_roll_holder laundry_hamper", "Mirrors and towels"),
] });

