import type { ElementStatus, RoomType } from "@/lib/plan/types";
import type { PinKind, PinStatus } from "@/lib/data/types";

// Floor colours by room type: calm, dark tints so walls, pins and status colours stand out on top.
export const ROOM_FILL: Record<RoomType, string> = {
  living: "#2c4a40", family: "#2c4a40", dining: "#2b4159", kitchen: "#47395a", bedroom: "#2b3d5e", bathroom: "#24505a",
  wc: "#24505a", hallway: "#4a4331", foyer: "#4a4331", stair_hall: "#4a4331", laundry: "#37474f", utility: "#37474f",
  closet: "#493a40", storage: "#493a40", garage: "#353c44", study: "#4d3d2b", office: "#4d3d2b", balcony: "#2a4230",
  porch: "#2a4230", terrace: "#2a4230", other: "#343b45",
};

export const STATUS_COLOR: Record<ElementStatus, string> = {
  not_built: "#e5534b", in_progress: "#e9a23b", done: "#4cb782", existing: "#8a94a0", demolish: "#b07be0",
};
export const STATUS_LABEL: Record<ElementStatus, string> = {
  not_built: "Not built", in_progress: "In progress", done: "Done", existing: "Existing", demolish: "Demolish",
};
export const STATUS_ORDER: ElementStatus[] = ["not_built", "in_progress", "done", "existing", "demolish"];

export const PIN_COLOR: Record<PinKind, string> = { task: "#f0a83a", issue: "#e5534b", note: "#7cc3e6", material: "#b38cf0" };
export const PIN_LABEL: Record<PinKind, string> = { task: "Task", issue: "Issue", note: "Note", material: "Material" };
export const PIN_STATUS_LABEL: Record<PinStatus, string> = { open: "Open", in_progress: "In progress", done: "Done" };

export const WALL_FILL = "#d5dbe3";
export const WALL_EXT_FILL = "#e6eaef";
export const GLASS = "#7cc3e6";
export const FIXTURE_STROKE = "#9fb4cc";
