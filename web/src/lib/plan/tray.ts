// The catalogue in the drawing tool, as a two-step menu: four big choices (Kitchen, Bath, Rooms, Other),
// each opening a list of sections (Base cabinets, Wall cabinets, Vanities, Bedroom...), each a grid of
// things to put in. Search looks through every section. Sections are added with addTraySection, so
// another part of the app brings its own (lib/plan/cabinetTray.ts adds every stock cabinet by its code).
// Anything in CATALOG that no section names lands in Other, Everything else.
import { CATALOG } from "./catalog";
import type { CabSpec } from "./cabinets";

/** One thing in the tray: a catalogue kind, optionally at its own size and with its own name. */
export interface TrayItem {
  kind: string; label?: string; w?: number; d?: number; h?: number;
  /** a stock cabinet (B18, W3030): placed as one, see lib/plan/cabinets.ts */
  cab?: CabSpec;
  /** goes in a cabinet run (range, dishwasher, toilet): backs onto the nearest wall and lines up with
   *  its neighbours. The id of the item in lib/plan/cabinetLayout.ts PLAIN. */
  run?: string;
  /** the code or size shown big on the card (B18, 60" x 30") */
  code?: string;
  /** a small heading inside the section it starts (30" high, Pantries) */
  sub?: string;
}
export type TopId = "kitchen" | "bath" | "rooms" | "other";
/** One section of a top: its items (a function so they follow the company's standards). */
export interface TraySection { id: string; label: string; items: TrayItem[] | (() => TrayItem[]); note?: string }
export interface TrayTop { id: TopId; label: string; blurb: string; sections: TraySection[] }

const its = (s: string): TrayItem[] => s.split(/\s+/).filter(Boolean).map((kind) => ({ kind }));

const TOPS: { id: TopId; label: string; blurb: string }[] = [
  { id: "kitchen", label: "Kitchen", blurb: "Cabinets at every stock size, appliances, sinks, fillers and trim" },
  { id: "bath", label: "Bath", blurb: "Vanities, toilets, tubs and showers, storage" },
  { id: "rooms", label: "Rooms", blurb: "Bedroom, living, dining and office furniture" },
  { id: "other", label: "Other", blurb: "Laundry, outside, garage and lighting" },
];

/** The built-in sections. Kitchen and Bath get theirs from cabinetTray.ts; these are the fallbacks. */
const BUILT: Record<TopId, TraySection[]> = {
  kitchen: [
    { id: "appliances", label: "Appliances", items: its("fridge range cooktop oven wall_oven range_hood dishwasher microwave wine_cooler chest_freezer coffee_machine kettle toaster blender stand_mixer air_fryer water_dispenser") },
    { id: "kitchen_more", label: "Islands, stools and bins", items: its("base_cabinet wall_cabinet tall_cabinet kitchen_sink island bar_stool kitchen_cart trash_can recycling_bin") },
  ],
  bath: [
    { id: "toilets", label: "Toilets", items: its("toilet bidet urinal") },
    { id: "tubs", label: "Tubs and showers", items: its("bathtub shower") },
    { id: "storage", label: "Storage", items: its("vanity washbasin medicine_cabinet mirror towel_bar towel_radiator toilet_roll_holder laundry_hamper") },
  ],
  rooms: [
    { id: "bedroom", label: "Bedroom", items: its("bed bunk_bed sofa_bed crib nightstand wardrobe dresser dressing_table blanket_chest floor_mirror clothes_rack bench changing_table table_lamp") },
    { id: "living", label: "Living", items: its("sofa sectional_sofa loveseat armchair recliner chaise_longue ottoman bean_bag coffee_table side_table console_table sideboard tv soundbar floor_speaker game_console bookshelf wall_shelf picture rug fireplace piano plant aquarium grandfather_clock wall_clock coat_rack umbrella_stand bar_cart room_divider") },
    { id: "dining", label: "Dining", items: its("dining_table round_dining_table table chair high_chair china_cabinet sideboard") },
    { id: "office", label: "Office", items: its("desk standing_desk corner_desk office_chair computer monitor laptop printer filing_cabinet shredder whiteboard pinboard router server_rack projector projector_screen safe conference_table") },
  ],
  other: [
    { id: "laundry", label: "Laundry", items: its("washing_machine dryer utility_sink ironing_board drying_rack laundry_hamper vacuum_cleaner water_heater water_softener furnace boiler ac_unit electrical_panel dehumidifier space_heater radiator") },
    { id: "outside", label: "Outside", items: its("patio_table patio_chair outdoor_sofa sun_lounger garden_bench patio_umbrella bbq_grill fire_pit hot_tub planter ac_condenser") },
    { id: "garage", label: "Garage", items: its("car motorcycle bicycle lawn_mower workbench tool_chest metal_shelving ladder treadmill exercise_bike rowing_machine weight_bench dumbbell_rack punching_bag yoga_mat") },
    { id: "lighting", label: "Lighting", items: its("lamp table_lamp pendant_light ceiling_fan floor_fan") },
    { id: "hobbies", label: "Kids and hobbies", items: its("kids_table rocking_chair dog_bed cat_tree pool_table ping_pong_table dartboard guitar drum_kit humidifier") },
  ],
};

const added: { top: TopId; s: TraySection }[] = [];
/**
 * Add a section to a top, or replace the one with the same id. Added sections come first, in the order
 * they were added, then the built-in ones. Call it at module load, before the tray first opens.
 */
export function addTraySection(top: TopId, s: TraySection) {
  const i = added.findIndex((a) => a.top === top && a.s.id === s.id);
  if (i >= 0) added.splice(i, 1);
  added.push({ top, s });
}

/** A section's items, leaving out catalogue kinds that don't exist (cabinets and run items always stay). */
export function sectionItems(s: TraySection): TrayItem[] {
  return (typeof s.items === "function" ? s.items() : s.items).filter((it) => it.cab || it.run || CATALOG[it.kind]);
}

/** The four tops with their sections, and Everything else in Other for whatever no section names. */
export function trayTops(): TrayTop[] {
  const tops = TOPS.map((t) => {
    const mine = added.filter((a) => a.top === t.id).map((a) => a.s);
    return { ...t, sections: [...mine, ...BUILT[t.id].filter((s) => !mine.some((m) => m.id === s.id))] };
  });
  const named = new Set(tops.flatMap((t) => t.sections.flatMap((s) => sectionItems(s).map((it) => it.kind))));
  const rest = Object.keys(CATALOG).filter((k) => !named.has(k)).map((kind) => ({ kind }));
  if (rest.length) tops[3].sections = [...tops[3].sections, { id: "everything_else", label: "Everything else", items: rest }];
  return tops;
}

/** Where the tray opens for a room type: a kitchen on Kitchen, a bedroom on Rooms, Bedroom. */
export const tabForRoom = (type?: string): string | null =>
  ({ kitchen: "kitchen", bathroom: "bath", wc: "bath", bedroom: "rooms/bedroom", living: "rooms/living", family: "rooms/living", dining: "rooms/dining", study: "rooms/office", office: "rooms/office", laundry: "other/laundry", utility: "other/laundry", garage: "other/garage", balcony: "other/outside", porch: "other/outside", terrace: "other/outside" } as Record<string, string>)[type ?? ""] ?? null;

export const itemLabel = (it: TrayItem) => it.label ?? CATALOG[it.kind]?.label ?? it.kind.replace(/_/g, " ");
const itemKey = (it: TrayItem) => `${it.kind}|${it.code ?? ""}|${it.label ?? ""}|${it.w ?? ""}|${it.d ?? ""}|${it.h ?? ""}|${it.cab?.fam ?? ""}|${it.cab?.config ?? ""}`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A search through every section: names, codes (B18, W3030), kinds and the catalogue's other words. */
export function traySearch(tops: TrayTop[], q: string): { item: TrayItem; where: string }[] {
  const words = norm(q).split(" ").filter(Boolean);
  if (!words.length) return [];
  const seen = new Set<string>(), out: { item: TrayItem; where: string }[] = [];
  for (const t of tops) for (const s of t.sections) for (const it of sectionItems(s)) {
    const k = itemKey(it);
    if (seen.has(k)) continue;
    const hay = norm([itemLabel(it), it.code ?? "", it.sub ?? "", it.kind, s.label, ...(CATALOG[it.kind]?.words ?? [])].join(" "));
    // a code is matched from its start, so "b3" finds B30 and B33 and not DB30
    const code = norm(it.code ?? "").replace(/ /g, "");
    if (words.every((w) => hay.includes(w) || code.startsWith(w))) { seen.add(k); out.push({ item: it, where: `${t.label}, ${s.label}` }); }
  }
  // codes that start with what was typed come first
  const w0 = words[0];
  return out.sort((a, b) => Number(!norm(a.item.code ?? "").replace(/ /g, "").startsWith(w0)) - Number(!norm(b.item.code ?? "").replace(/ /g, "").startsWith(w0)));
}

/** Two tray items are the same pick (for showing which one is in hand). */
export const sameItem = (a: TrayItem | null, b: TrayItem) => !!a && itemKey(a) === itemKey(b);
