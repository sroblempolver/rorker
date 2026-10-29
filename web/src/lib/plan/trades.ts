// What the job is, so each trade gets the drawing tool shaped for its work: a kitchen job puts the
// Cabinets tool up front with a short list of what a kitchen drawing needs, a painter sees wall and
// ceiling areas and gallons, a flooring crew sees floor area and doorways, a property manager sees the
// homes in the building. Nothing is hidden: every tool stays where it is, only the order and the side
// panel change. Saved on the sketch as `trade` (and the things ticked off by hand as `trade_done`).
import type { Sketch, SketchFixture, SketchFloor } from "./sketch";
import type { Nudge } from "./checks";
import { famOf } from "./cabinets";
import { pointInPoly } from "./geometry";

export type Trade = "house" | "kitchen" | "bath" | "paint" | "floor" | "property" | "other";
export const TRADES: { id: Trade; label: string; hint: string }[] = [
  { id: "house", label: "Whole house / addition", hint: "Every room, floor and roof" },
  { id: "kitchen", label: "Kitchen", hint: "Cabinets first, and what a kitchen drawing needs" },
  { id: "bath", label: "Bathroom", hint: "Vanity, toilet, tub or shower and their clearances" },
  { id: "paint", label: "Painting", hint: "Wall and ceiling areas, trim and gallons" },
  { id: "floor", label: "Flooring", hint: "Floor areas, doorways and baseboard" },
  { id: "property", label: "Property / building", hint: "The homes in the building, counted" },
  { id: "other", label: "Other", hint: "The drawing tool as it is" },
];
export const tradeOf = (sk: Sketch): Trade => (TRADES.some((t) => t.id === sk.trade) ? (sk.trade as Trade) : "house");

/** The tools in the order this trade reaches for them: kitchens and baths get Cabinets right after Select. */
export function toolOrder<T extends { id: string }>(trade: Trade, tools: T[]): T[] {
  if (trade !== "kitchen" && trade !== "bath") return tools;
  const cab = tools.find((t) => t.id === "cabinet");
  if (!cab) return tools;
  const rest = tools.filter((t) => t !== cab), at = rest.findIndex((t) => t.id === "select") + 1;
  return [...rest.slice(0, at), cab, ...rest.slice(at)];
}

/** The standards whose checks this trade cares about most. */
const CHECK_KEYS: Partial<Record<Trade, RegExp>> = { kitchen: /^(check\.kitchen|cab\.)/, bath: /^check\.bath/, property: /^check\.(room|door|bed)/ };
/** This trade's checks first, the rest after in the order they were. */
export function checksFirst(trade: Trade, list: Nudge[]): Nudge[] {
  const re = CHECK_KEYS[trade];
  if (!re) return list;
  const mine = (n: Nudge) => re.test(n.std ?? "");
  return [...list.filter(mine), ...list.filter((n) => !mine(n))];
}

export interface Step { id: string; label: string; done: boolean; /** found on the drawing (else ticked by hand) */ auto: boolean; hint: string }

const low = (s?: string) => (s ?? "").trim().toLowerCase();
const KITCHEN = new Set(["kitchen"]), BATH = new Set(["bathroom", "wc"]);

/** The rooms of these kinds, with what's in them, across every floor. */
function roomsOfType(sk: Sketch, types: Set<string>) {
  return sk.floors.flatMap((f) => f.rooms.filter((r) => types.has(low(r.type))).map((r) => {
    const key = low(r.name);
    const inside = (x: SketchFixture) => (x.room ? low(x.room) === key : Array.isArray(x.center) && pointInPoly(x.center, r.polygon));
    return {
      f, r, things: (f.fixtures ?? []).filter(inside),
      doors: (f.doors ?? []).filter((d) => d.rooms.some((n) => low(n) === key)),
      windows: (f.windows ?? []).filter((w) => low(w.room) === key),
    };
  }));
}
type Found = ReturnType<typeof roomsOfType>;
const has = (rs: Found, ok: (x: SketchFixture) => boolean) => rs.some((x) => x.things.some(ok));
const sized = (rs: Found) => rs.some((x) => x.doors.length || x.windows.length) && rs.every((x) => x.doors.every((d) => d.width_mm) && x.windows.every((w) => w.width_mm && w.height_mm));
const zone = (x: SketchFixture) => (x.cab ? famOf(x.cab.fam).zone : null);
const missing = (list: [boolean, string][]) => list.filter(([ok]) => !ok).map(([, n]) => n);
const still = (m: string[]) => (m.length ? `Still to place: ${m.join(", ")}.` : "");

/** The short list for a kitchen or bath job, worked out from the drawing; what can't be seen on the
 *  drawing (that the walls were measured) is ticked by hand. `open` is the checks still to look at. */
export function checklist(sk: Sketch, trade: Trade, open: Nudge[]): Step[] | null {
  const ticked = new Set(sk.trade_done ?? []);
  const step = (id: string, label: string, found: boolean | null, hint: string): Step => ({ id, label, done: !!found || ticked.has(id), auto: found !== null, hint });
  if (trade === "kitchen") {
    const k = roomsOfType(sk, KITCHEN);
    const sink = has(k, (x) => x.kind === "kitchen_sink" || x.cab?.fam === "sink");
    const cook = has(k, (x) => ["range", "cooktop", "oven", "wall_oven"].includes(x.kind) || x.cab?.fam === "oven");
    const fridge = has(k, (x) => x.kind === "fridge");
    const base = k.flatMap((x) => x.things.filter((t) => zone(t) === "base" && t.cab?.fam !== "filler_base"));
    const wall = has(k, (x) => zone(x) === "wall");
    const aisles = open.filter((n) => /^check\.kitchen/.test(n.std ?? ""));
    return [
      step("room", "Kitchen drawn", k.length > 0, "Draw the room and set its kind to Kitchen."),
      step("walls", "Walls measured", null, "Type each wall's length from the tape, then tick this."),
      step("openings", "Window and door sizes", sized(k), "See each kitchen wall from the side and type the door and window sizes."),
      step("appliances", "Appliances placed", sink && cook && fridge, still(missing([[sink, "sink"], [cook, "range or cooktop"], [fridge, "fridge"]])) || "Sink, range and fridge are in."),
      step("cabinets", "Cabinets filled", base.length > 0 && wall, still(missing([[base.length > 0, "base cabinets"], [wall, "wall cabinets"]])) || "Base and wall cabinets are in."),
      step("counters", "Counters", base.length > 0 && base.every((t) => t.cab?.counter), base.length ? "Every base cabinet gets a countertop (pick one to turn it on)." : "Counters go on the base cabinets."),
      step("aisles", "Aisles clear", k.length > 0 && !aisles.length, aisles.length ? `${aisles.length} aisle ${aisles.length === 1 ? "check" : "checks"} to look at.` : "Room to work between the counters."),
    ];
  }
  if (trade === "bath") {
    const b = roomsOfType(sk, BATH);
    const full = b.some((x) => low(x.r.type) === "bathroom");
    const tight = open.filter((n) => /^check\.bath/.test(n.std ?? ""));
    const toilet = has(b, (x) => x.kind === "toilet");
    const list = [
      step("room", "Bathroom drawn", b.length > 0, "Draw the room and set its kind to Bathroom (or WC for a half bath)."),
      step("walls", "Walls measured", null, "Type each wall's length from the tape, then tick this."),
      step("openings", "Window and door sizes", sized(b), "See each wall from the side and type the door and window sizes."),
      step("vanity", "Vanity", has(b, (x) => x.kind === "vanity" || x.kind === "washbasin" || x.cab?.fam === "vanity"), "A vanity from Cabinets, or a basin from Furniture."),
      step("toilet", "Toilet", toilet, "From Furniture, against a wall."),
    ];
    if (full || !b.length) list.push(step("wet", "Tub or shower", has(b, (x) => x.kind === "bathtub" || x.kind === "shower"), "From Furniture, in a corner or along a wall."));
    list.push(step("clear", "Clearances", toilet && !tight.length, tight.length ? `${tight.length} ${tight.length === 1 ? "clearance" : "clearances"} to look at.` : toilet ? "Room beside and in front of the toilet." : "Checked once the toilet is in."));
    return list;
  }
  return null;
}

/** The sketch with a step ticked or unticked by hand. */
export function tick(sk: Sketch, id: string, on: boolean): Sketch {
  const cur = sk.trade_done ?? [];
  const next = on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id);
  return { ...sk, trade_done: next.length ? next : undefined };
}

/** The ceiling height of a floor, for areas: its own or the company's. */
export const ceilingOf = (f: SketchFloor, fallback: number) => f.height_mm ?? fallback;
