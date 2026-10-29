// The catalogue tray in the drawing tool: everything in CATALOG sorted two ways, by the room it goes in
// (Kitchen, Bath...) and by what it is (Cabinets, Appliances...), plus search on names and other words.
// A section is just a group of items, so another part of the app adds its own with addTrayGroup (for
// example cabinets in their stock widths). Anything in the catalogue no group names lands in Other.
import { CATALOG } from "./catalog";

/** One thing in the tray: a catalogue kind, optionally at its own size and with its own name. */
export interface TrayItem { kind: string; label?: string; w?: number; d?: number; h?: number }
/** A tab of the tray. `by` says which row of tabs it sits in. */
export interface TrayGroup { id: string; label: string; by: "room" | "kind"; items: TrayItem[] }

const its = (s: string): TrayItem[] => s.split(/\s+/).filter(Boolean).map((kind) => ({ kind }));

const ROOMS: TrayGroup[] = [
  { id: "kitchen", label: "Kitchen", by: "room", items: its("base_cabinet wall_cabinet tall_cabinet island kitchen_sink dishwasher range cooktop oven wall_oven range_hood fridge wine_cooler chest_freezer microwave coffee_machine kettle toaster blender stand_mixer air_fryer bar_stool trash_can recycling_bin kitchen_cart water_dispenser dish_rack") },
  { id: "bath", label: "Bath", by: "room", items: its("toilet washbasin vanity bathtub shower bidet urinal mirror medicine_cabinet towel_radiator towel_bar toilet_roll_holder laundry_hamper") },
  { id: "bedroom", label: "Bedroom", by: "room", items: its("bed bunk_bed sofa_bed crib nightstand wardrobe dresser dressing_table blanket_chest floor_mirror clothes_rack bench changing_table table_lamp") },
  { id: "living", label: "Living", by: "room", items: its("sofa sectional_sofa loveseat armchair recliner chaise_longue ottoman bean_bag coffee_table side_table console_table sideboard tv soundbar floor_speaker game_console bookshelf wall_shelf picture rug fireplace piano lamp table_lamp plant ceiling_fan pendant_light aquarium grandfather_clock wall_clock coat_rack umbrella_stand bar_cart room_divider") },
  { id: "dining", label: "Dining", by: "room", items: its("dining_table round_dining_table table chair high_chair china_cabinet sideboard pendant_light") },
  { id: "office", label: "Office", by: "room", items: its("desk standing_desk corner_desk office_chair computer monitor laptop printer filing_cabinet shredder whiteboard pinboard router server_rack projector projector_screen safe conference_table") },
  { id: "laundry", label: "Laundry & utility", by: "room", items: its("washing_machine dryer utility_sink ironing_board drying_rack laundry_hamper vacuum_cleaner water_heater water_softener furnace boiler ac_unit electrical_panel dehumidifier space_heater radiator") },
  { id: "garage", label: "Garage & gym", by: "room", items: its("car motorcycle bicycle lawn_mower workbench tool_chest metal_shelving ladder treadmill exercise_bike rowing_machine weight_bench dumbbell_rack punching_bag yoga_mat") },
  { id: "outside", label: "Outside", by: "room", items: its("patio_table patio_chair outdoor_sofa sun_lounger garden_bench patio_umbrella bbq_grill fire_pit hot_tub planter ac_condenser") },
  { id: "hobbies", label: "Kids & hobbies", by: "room", items: its("kids_table high_chair crib rocking_chair dog_bed cat_tree pool_table ping_pong_table dartboard guitar drum_kit piano floor_fan humidifier") },
];

const KINDS: TrayGroup[] = [
  { id: "cabinets", label: "Cabinets", by: "kind", items: its("base_cabinet wall_cabinet tall_cabinet island vanity medicine_cabinet china_cabinet") },
  { id: "appliances", label: "Appliances", by: "kind", items: its("fridge range cooktop oven wall_oven range_hood dishwasher microwave wine_cooler chest_freezer coffee_machine kettle toaster blender stand_mixer air_fryer water_dispenser washing_machine dryer vacuum_cleaner") },
  { id: "plumbing", label: "Plumbing", by: "kind", items: its("kitchen_sink toilet washbasin bathtub shower bidet urinal utility_sink water_heater water_softener hot_tub") },
  { id: "furniture", label: "Furniture", by: "kind", items: its("bed bunk_bed sofa_bed crib nightstand dresser dressing_table bench changing_table sofa sectional_sofa loveseat armchair recliner chaise_longue ottoman bean_bag coffee_table side_table console_table table dining_table round_dining_table chair bar_stool high_chair desk standing_desk corner_desk office_chair conference_table kids_table rocking_chair room_divider workbench patio_table patio_chair outdoor_sofa sun_lounger garden_bench") },
  { id: "storage", label: "Storage", by: "kind", items: its("wardrobe sideboard bookshelf wall_shelf filing_cabinet blanket_chest clothes_rack coat_rack umbrella_stand bar_cart kitchen_cart trash_can recycling_bin dish_rack laundry_hamper towel_bar toilet_roll_holder drying_rack safe tool_chest metal_shelving") },
  { id: "lighting", label: "Lighting", by: "kind", items: its("lamp table_lamp pendant_light") },
  { id: "heating", label: "Heating & air", by: "kind", items: its("fireplace towel_radiator radiator furnace boiler ac_unit ac_condenser space_heater ceiling_fan floor_fan dehumidifier humidifier") },
  { id: "tech", label: "Electrical & tech", by: "kind", items: its("electrical_panel tv soundbar floor_speaker game_console computer monitor laptop printer shredder router server_rack projector projector_screen") },
  { id: "decor", label: "Decor", by: "kind", items: its("mirror floor_mirror picture rug plant planter aquarium grandfather_clock wall_clock whiteboard pinboard dartboard") },
];

let extra: TrayGroup[] = [];
/**
 * Add a section to the tray, or replace the one with the same id (a "cabinets" group replaces the
 * built-in Cabinets tab). Call it at module load, before the tray first opens.
 */
export function addTrayGroup(g: TrayGroup) { extra = [...extra.filter((x) => x.id !== g.id), g]; }

/** All the tray's tabs, room row then kind row, with Other holding whatever no tab names. */
export function trayGroups(): TrayGroup[] {
  const ids = new Set(extra.map((g) => g.id));
  const all = [...ROOMS, ...KINDS].filter((g) => !ids.has(g.id)).concat(extra);
  const ordered = [...all.filter((g) => g.by === "room"), ...all.filter((g) => g.by === "kind")]
    .map((g) => ({ ...g, items: g.items.filter((it) => CATALOG[it.kind]) }));
  const named = new Set(ordered.filter((g) => g.by === "kind").flatMap((g) => g.items.map((it) => it.kind)));
  const rest = Object.keys(CATALOG).filter((k) => !named.has(k)).map((kind) => ({ kind }));
  return rest.length ? [...ordered, { id: "other", label: "Other", by: "kind", items: rest }] : ordered;
}

/** The tray tab that fits a room type (a kitchen opens on Kitchen). */
export const tabForRoom = (type?: string): string | null =>
  ({ kitchen: "kitchen", bathroom: "bath", wc: "bath", bedroom: "bedroom", living: "living", family: "living", dining: "dining", study: "office", office: "office", laundry: "laundry", utility: "laundry", garage: "garage", balcony: "outside", porch: "outside", terrace: "outside" } as Record<string, string>)[type ?? ""] ?? null;

export const itemLabel = (it: TrayItem) => it.label ?? CATALOG[it.kind]?.label ?? it.kind.replace(/_/g, " ");
const itemKey = (it: TrayItem) => `${it.kind}|${it.label ?? ""}|${it.w ?? ""}|${it.d ?? ""}`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * What the tray shows: a search looks through every name and the catalogue's other words (all tabs);
 * otherwise the items in both the picked room tab and the picked kind tab (either can be "all").
 */
export function trayItems(groups: TrayGroup[], room: string | null, kind: string | null, q: string): TrayItem[] {
  const seen = new Set<string>(), out: TrayItem[] = [];
  const add = (it: TrayItem) => { const k = itemKey(it); if (!seen.has(k)) { seen.add(k); out.push(it); } };
  const words = norm(q).split(" ").filter(Boolean);
  if (words.length) {
    for (const g of groups) for (const it of g.items) {
      const s = CATALOG[it.kind], hay = norm([itemLabel(it), it.kind, ...(s?.words ?? [])].join(" "));
      if (words.every((w) => hay.includes(w))) add(it);
    }
    return out;
  }
  const inRoom = room ? new Set(groups.find((g) => g.id === room)?.items.map((it) => it.kind) ?? []) : null;
  const kindGroup = kind ? groups.find((g) => g.id === kind) : null;
  // a kind tab's own items (its sizes and names) come first; a room tab alone shows its own list
  const source = kindGroup ? kindGroup.items : room ? groups.find((g) => g.id === room)?.items ?? [] : groups.filter((g) => g.by === "kind").flatMap((g) => g.items);
  for (const it of source) if (!inRoom || inRoom.has(it.kind)) add(it);
  return out;
}
