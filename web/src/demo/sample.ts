// Sample progress for the demo job, shared by local demo mode and the standalone preview.
import type { ElementState, Pin } from "@/lib/data/types";
import type { Plan } from "@/lib/plan/types";

export function samplePins(plan: Plan): Partial<Pin>[] {
  const g = plan.floors.find((f) => f.level === 0) ?? plan.floors[0];
  const up = plan.floors.find((f) => f.level === 1);
  const kitchen = g.rooms.find((r) => r.type === "kitchen");
  const living = g.rooms.find((r) => r.type === "living");
  const crackWall = g.walls.find((w) => w.exterior && living && w.room_ids.includes(living.id)) ?? g.walls[0];
  const bath = up?.rooms.find((r) => r.type === "bathroom");
  return [
    { element_id: kitchen?.id ?? null, floor_id: g.id, kind: "task", title: "Remove old base cabinets", status: "in_progress", priority: 1 },
    { element_id: crackWall?.id ?? null, floor_id: g.id, kind: "issue", title: "Crack above the window, check lintel", priority: 2, close_requirement: "photo" },
    ...(bath ? [{ element_id: bath.id, floor_id: up!.id, kind: "material" as const, title: "Order 12 m² floor tile", links: [{ title: "Tile supplier", url: "https://example.com/tile" }] }] : []),
  ];
}

export function sampleStates(plan: Plan): ElementState[] {
  const kitchen = plan.floors.flatMap((f) => f.rooms).find((r) => r.type === "kitchen");
  return kitchen ? [{ element_id: kitchen.id, status: "in_progress" }] : [];
}
