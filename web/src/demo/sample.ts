// Sample progress for the demo job, shared by local demo mode and the standalone preview.
import type { ElementState, Pin } from "@/lib/data/types";
import { attachedToSide, roomSides, siteLayout } from "@/lib/plan/geometry";
import type { Plan } from "@/lib/plan/types";

export function samplePins(plan: Plan): Partial<Pin>[] {
  const g = plan.floors.find((f) => f.level === 0) ?? plan.floors[0];
  const up = plan.floors.find((f) => f.level === 1);
  const kitchen = g.rooms.find((r) => r.type === "kitchen");
  const living = g.rooms.find((r) => r.type === "living");
  const crackWall = g.walls.find((w) => w.exterior && living && w.room_ids.includes(living.id)) ?? g.walls[0];
  const bath = up?.rooms.find((r) => r.type === "bathroom");
  // a note pinned on the exact spot of a bathroom wall, next to the toilet
  const wallNote = (() => {
    for (const f of plan.floors) for (const r of f.rooms.filter((x) => x.type === "bathroom" || x.type === "wc")) for (const side of roomSides(f, r)) {
      const t = attachedToSide(f, side).find((a) => a.f.kind === "toilet");
      if (t) return { element_id: t.f.id, floor_id: f.id, anchor: { view: "wall" as const, side: side.key, x: Math.round(t.to + 250), y: -1150 }, kind: "note" as const, title: "Move toilet 150 mm left, new soil pipe position" };
    }
    return null;
  })();
  const site = siteLayout(plan);
  const skip = site.drive ? site.drive[3] : [site.lot[0] + 2000, site.lot[3] - 2000];
  return [
    { element_id: kitchen?.id ?? null, floor_id: g.id, kind: "task", title: "Remove old base cabinets", status: "in_progress", priority: 1 },
    { element_id: crackWall?.id ?? null, floor_id: g.id, kind: "issue", title: "Crack above the window, check lintel", priority: 2, close_requirement: "photo" },
    { anchor: { view: "site", x: Math.round(skip[0] - 2600), y: Math.round(skip[1] - 2600) }, kind: "note", title: "Skip bin goes here, keep the drive clear" },
    ...(wallNote ? [wallNote] : []),
    ...(bath ? [{ element_id: bath.id, floor_id: up!.id, kind: "material" as const, title: "Order 12 m² floor tile", links: [{ title: "Tile supplier", url: "https://example.com/tile" }] }] : []),
  ];
}

export function sampleStates(plan: Plan): ElementState[] {
  const rooms = plan.floors.flatMap((f) => f.rooms);
  const out: ElementState[] = [];
  const mark = (type: string, status: ElementState["status"]) => rooms.filter((r) => r.type === type).forEach((r) => out.push({ element_id: r.id, status }));
  mark("kitchen", "in_progress");
  mark("garage", "existing");
  mark("dining", "done");
  mark("family", "done");
  mark("bathroom", "not_built");
  return out;
}
