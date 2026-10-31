// The catalogue in the drawing tool ("Home items": everything that goes in a house, not only furniture),
// as a two-step menu: a big choice per room (Kitchen, Bath, Bedroom, Living room, Dining, Office, Kids,
// Laundry and utility, Outdoor, Garage, Gym and games, Lights and decor), each opening a list of sections
// (Base cabinets, Beds, Sofas and sectionals...), each a grid of things to put in. Search looks through
// every section. Sections are added with addTraySection, so another part of the app brings its own
// (lib/plan/cabinetTray.ts adds every stock cabinet by its code); the rest come from HOME_SECTIONS in
// lib/plan/catalog-home.ts. Anything in CATALOG that no section names lands in the last top, Everything else.
import { CATALOG } from "./catalog";
import { HOME_SECTIONS } from "./catalog-home";
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
export type TopId = "kitchen" | "bath" | "bedroom" | "living" | "dining" | "office" | "kids" | "laundry" | "outdoor" | "garage" | "gym" | "decor";
/** One section of a top: its items (a function so they follow the company's standards). */
export interface TraySection { id: string; label: string; items: TrayItem[] | (() => TrayItem[]); note?: string }
export interface TrayTop { id: TopId; label: string; blurb: string; sections: TraySection[] }

const its = (s: string): TrayItem[] => s.split(/\s+/).filter(Boolean).map((kind) => ({ kind }));

/** What the whole menu is called: everything in a house, not only furniture (a toilet isn't furniture). */
export const TRAY_NAME = "Home items";

const TOPS: { id: TopId; label: string; blurb: string }[] = [
  { id: "kitchen", label: "Kitchen", blurb: "Cabinets at every stock size, appliances, dishes and cookware" },
  { id: "bath", label: "Bath", blurb: "Vanities, toilets, tubs and showers, towels" },
  { id: "bedroom", label: "Bedroom", blurb: "Beds at every size, dressers, nightstands, closets" },
  { id: "living", label: "Living room", blurb: "Sofas, chairs, tables, fireplaces, TVs and stereos" },
  { id: "dining", label: "Dining", blurb: "Tables, chairs, benches, buffets and hutches" },
  { id: "office", label: "Office", blurb: "Desks, office chairs, files, computers" },
  { id: "kids", label: "Kids and nursery", blurb: "Cribs, kids' beds, toys and play" },
  { id: "laundry", label: "Laundry and utility", blurb: "Washers, vacuums, heating, water and power" },
  { id: "outdoor", label: "Outdoor and garden", blurb: "Patio sets, grills, fire, sheds, pools, yard" },
  { id: "garage", label: "Garage and vehicles", blurb: "Cars, trucks, motorcycles, bikes, mowers, tools" },
  { id: "gym", label: "Gym, games and pets", blurb: "Fitness, boxing, game tables, hobbies, pets" },
  { id: "decor", label: "Lights and decor", blurb: "Ceiling lights, lamps, art, plants, rugs" },
];

/** The built-in sections. Kitchen and Bath get their cabinets and fixtures from cabinetTray.ts. */
const BUILT: Record<TopId, TraySection[]> = Object.fromEntries(TOPS.map((t) => [t.id, [] as TraySection[]])) as Record<TopId, TraySection[]>;
BUILT.bath.push(
  { id: "toilets", label: "Toilets", items: its("toilet bidet urinal") },
  { id: "tubs", label: "Tubs and showers", items: its("bathtub shower") },
  { id: "storage", label: "Storage", items: its("vanity washbasin medicine_cabinet mirror towel_bar towel_radiator toilet_roll_holder laundry_hamper") },
);
for (const [top, id, label, kinds] of HOME_SECTIONS) BUILT[top as TopId]?.push({ id, label, items: its(kinds) });

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

/** The tops with their sections, and Everything else in the last one for whatever no section names. */
export function trayTops(): TrayTop[] {
  const tops = TOPS.map((t) => {
    const mine = added.filter((a) => a.top === t.id).map((a) => a.s);
    return { ...t, sections: [...mine, ...BUILT[t.id].filter((s) => !mine.some((m) => m.id === s.id))] };
  });
  const named = new Set(tops.flatMap((t) => t.sections.flatMap((s) => sectionItems(s).map((it) => it.kind))));
  const rest = Object.keys(CATALOG).filter((k) => !named.has(k)).map((kind) => ({ kind }));
  if (rest.length) tops[tops.length - 1].sections = [...tops[tops.length - 1].sections, { id: "everything_else", label: "Everything else", items: rest }];
  return tops;
}

/** Where the tray opens for a room type: a kitchen on Kitchen, a bedroom on Bedroom, Beds. */
export const tabForRoom = (type?: string): string | null =>
  ({ kitchen: "kitchen", bathroom: "bath", wc: "bath", bedroom: "bedroom/beds", nursery: "kids", kids: "kids", living: "living/sofas", family: "living/sofas", dining: "dining/dining_tables", study: "office/desks", office: "office/desks", laundry: "laundry/laundry_machines", utility: "laundry", garage: "garage", gym: "gym", balcony: "outdoor/patio", porch: "outdoor/patio", terrace: "outdoor/patio", patio: "outdoor/patio", deck: "outdoor/patio", yard: "outdoor", garden: "outdoor/garden" } as Record<string, string>)[type ?? ""] ?? null;

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
