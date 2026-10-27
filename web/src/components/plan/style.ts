import type { ElementStatus, RoomType } from "@/lib/plan/types";
import type { PinKind, PinStatus } from "@/lib/data/types";

// Floors are drawn as the material a room would really have, so the plan reads like a scale model
// rather than a coloured diagram. Each material is an SVG pattern defined in PlanDefs.
export type Material = "oak" | "walnut" | "tile" | "bathtile" | "concrete" | "carpet" | "deck";
export const ROOM_MATERIAL: Record<RoomType, Material> = {
  living: "oak", family: "oak", dining: "walnut", kitchen: "tile", bedroom: "carpet", bathroom: "bathtile", wc: "bathtile",
  hallway: "oak", foyer: "walnut", stair_hall: "oak", laundry: "tile", utility: "tile", closet: "carpet", storage: "concrete",
  garage: "concrete", study: "walnut", office: "walnut", balcony: "deck", porch: "deck", terrace: "deck", other: "concrete",
};
export const MATERIAL_BASE: Record<Material, string> = {
  oak: "#9c7a55", walnut: "#6e4f37", tile: "#8f9b9e", bathtile: "#a9bcc0", concrete: "#6c6a65", carpet: "#6f7486", deck: "#7d6046",
};
export const MATERIAL_LABEL: Record<Material, string> = {
  oak: "Oak floor", walnut: "Walnut floor", tile: "Porcelain tile", bathtile: "Wet-room tile", concrete: "Concrete", carpet: "Carpet", deck: "Decking",
};

export const STATUS_COLOR: Record<ElementStatus, string> = {
  not_built: "#e8432e", in_progress: "#f3c530", done: "#3fb46a", existing: "#9c978d", demolish: "#db4ea6",
};
export const STATUS_LABEL: Record<ElementStatus, string> = {
  not_built: "Not built", in_progress: "In progress", done: "Done", existing: "Existing", demolish: "Demolish",
};
export const STATUS_ORDER: ElementStatus[] = ["not_built", "in_progress", "done", "existing", "demolish"];

export const PIN_COLOR: Record<PinKind, string> = { task: "#ff6a1f", issue: "#e8432e", note: "#55b2ff", material: "#2fb7a1" };
export const PIN_LABEL: Record<PinKind, string> = { task: "Task", issue: "Issue", note: "Note", material: "Material" };
export const PIN_STATUS_LABEL: Record<PinStatus, string> = { open: "Open", in_progress: "In progress", done: "Done" };

export const CHALK = "#55b2ff";
export const WALL_TOP = "#efe8da";
export const WALL_EXT_TOP = "#e3d9c6";
export const WALL_SIDE = "#0a0a0b";
export const GLASS = "#8fd3f0";
export const FIXTURE_STROKE = "#f4efe6";
export const GROUND = "#1d1f1b";

/** build stages: boarded walls before paint, and walls chalked out on the bare slab */
export const DRYWALL = "#e3e0d9", CHALK_LINE = "#ece6d6", SUBFLOOR = "#a88d64";
