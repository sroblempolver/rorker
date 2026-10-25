// Where to stand to see a pin: the view it was dropped in, or the room (or floor) of what it's on.
import type { Pin } from "@/lib/data/types";
import type { Plan } from "@/lib/plan/types";
import { findElement, roomOf } from "@/lib/plan/geometry";
import type { Level } from "./PlanViewer";

export function pinLevel(plan: Plan, pin: Pin): Level | null {
  if (pin.anchor?.view === "site" || pin.anchor?.view === "exterior") return { kind: pin.anchor.view };
  if (pin.anchor?.view === "point") return { kind: "exterior" };
  if (pin.anchor?.view === "wall" && pin.anchor.side) {
    const roomId = pin.anchor.side.split(":")[0];
    const f = plan.floors.find((x) => x.rooms.some((r) => r.id === roomId));
    if (f) return { kind: "wall", floorId: f.id, roomId, sideKey: pin.anchor.side };
  }
  const e = pin.element_id ? findElement(plan, pin.element_id) : null;
  const floorId = e?.floor.id ?? pin.floor_id;
  if (!floorId) return null;
  const rid = e ? roomOf(e) : null;
  return rid ? { kind: "room", floorId, roomId: rid } : { kind: "floor", floorId };
}
