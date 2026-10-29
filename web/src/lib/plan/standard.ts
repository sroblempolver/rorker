// Standard sizes (US): what a new door or window starts as, and what one without its own numbers is
// drawn at. Kept in millimetres like the rest of the plan. Shared by the drawing tool (new jobs) and
// Build mode (changing the house inside a job), so there is one place to change them.
import type { OpeningKind } from "./types";

const IN = 25.4;
const inch = (n: number) => Math.round(n * IN);

/** a window: 36 x 48 in, its bottom 36 in off the floor */
export const WIN = { width: inch(36), height: inch(48), sill: inch(36) };
/** doors: 32 in inside, 36 in for a door to the outside, 72 in patio door, 16 ft garage door */
export const DOOR_W: Record<string, number> = { door: inch(32), double_door: inch(60), sliding_door: inch(72), opening: inch(48), garage_door: inch(192) };
export const ENTRY_DOOR_W = inch(36);
export const DOOR_H: Record<string, number> = { opening: inch(84), garage_door: inch(84) };
/** 80 in, a standard door */
export const doorHeight = (kind: string, h?: number | null) => h ?? DOOR_H[kind] ?? inch(80);
export const BALCONY_DEPTH = inch(72);
export const DOOR_KINDS = [["door", "Door"], ["double_door", "Double door"], ["sliding_door", "Patio door"], ["opening", "Opening"], ["garage_door", "Garage door"]] as const;

/** The usual widths to pick from with one tap, per kind (mm). */
export const WIDTHS: Record<string, number[]> = {
  door: [inch(30), inch(32), inch(36)],
  double_door: [inch(48), inch(60), inch(72)],
  sliding_door: [inch(60), inch(72), inch(96)],
  opening: [inch(36), inch(48), inch(72)],
  garage_door: [inch(96), inch(108), inch(192)],
  window: [inch(24), inch(36), inch(48), inch(72)],
};

/** The standard width of a new one: a door to the outside is wider. */
export const standardWidth = (kind: string, exterior: boolean) =>
  kind === "window" ? WIN.width : kind === "door" && exterior ? ENTRY_DOOR_W : DOOR_W[kind] ?? DOOR_W.door;

export const openingName = (kind: OpeningKind | string, exterior: boolean) =>
  kind === "window" ? "Window" : kind === "opening" ? "Opening" : kind === "sliding_door" ? "Patio door" : kind === "garage_door" ? "Garage door"
    : kind === "double_door" ? "Double door" : exterior ? "Outside door" : "Door";
