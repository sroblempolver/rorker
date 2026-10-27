// Sample materials for the preview: the house job plus two smaller jobs, so the list, the split across
// jobs and the shopping run all have something in them. Placed lines sit on real elements of the plan.
import type { Member } from "@/lib/data/types";
import type { MaterialInput } from "@/lib/materials/types";
import type { Plan } from "@/lib/plan/types";

export const EXTRA_JOBS = [
  { id: "baker", name: "Baker St kitchen", address: "88 Baker Street", client_name: "Lena Ortiz", job_type: "remodel" },
  { id: "elm", name: "Elm Ave bathroom", address: "5 Elm Avenue", client_name: "Chris Wu", job_type: "remodel" },
];

const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export function sampleMaterials(plan: Plan, houseId: string, crew: Pick<Member, "id" | "title">[]): MaterialInput[] {
  const who = (t: string) => crew.find((m) => m.title === t)?.id ?? null;
  const [lead, elec, plumb] = [who("Site lead"), who("Electrician"), who("Plumber")];
  const g = plan.floors.find((f) => f.level === 0) ?? plan.floors[0];
  const up = plan.floors.find((f) => f.level === 1) ?? g;
  const kitchen = g.rooms.find((r) => r.type === "kitchen");
  const sink = g.fixtures.find((f) => f.kind === "kitchen_sink");
  const cab = g.fixtures.find((f) => f.kind === "base_cabinet");
  const bath = up.rooms.find((r) => r.type === "bathroom");
  const toilet = up.fixtures.find((f) => f.kind === "toilet");
  const door = up.openings.find((o) => o.kind === "door" && !o.exterior);
  const living = g.rooms.find((r) => r.type === "living");
  const at = (el: { id: string } | undefined, floorId: string) => ({ element_id: el?.id ?? null, floor_id: el ? floorId : null, x: null, y: null, anchor: null });
  const none = { element_id: null, floor_id: null, x: null, y: null, anchor: null };
  const base = { group_id: null, sku: null, link: null, deliver_to: null, installer: null, needed_by: null, stage_id: null, note: null, fulfil: "pickup" as const, status: "to_buy" as const };
  const L = (job: string, name: string, qty: number, unit: MaterialInput["unit"], unit_cost: number, store: string | null, buyer: string | null, more: Partial<MaterialInput> = {}): MaterialInput =>
    ({ ...base, ...none, job_id: job, name, qty, unit, unit_cost, store, buyer, ...more });
  return [
    // the house
    L(houseId, "Duplex outlet 15A, white", 6, "ea", 3.5, "Home Depot", elec, { ...at(kitchen, g.id), installer: elec, group_id: "g-outlets", needed_by: day(2), note: "Counter outlets, GFCI on the first of each run" }),
    L(houseId, "GFCI outlet 20A", 2, "ea", 22, "Home Depot", elec, { ...at(kitchen, g.id), installer: elec, needed_by: day(2) }),
    L(houseId, "Kitchen faucet, pull-down", 1, "ea", 180, "Ferguson", plumb, { ...at(sink, g.id), installer: plumb, status: "ordered", fulfil: "delivery", group_id: "g-faucet", note: "Matte black, client picked" }),
    L(houseId, "Garbage disposal ½ hp", 1, "ea", 140, "Ferguson", plumb, { ...at(sink, g.id), installer: plumb }),
    L(houseId, "Base cabinet", 5, "ea", 240, "Cabinet Depot", lead, { ...at(cab, g.id), installer: lead, status: "ordered", fulfil: "delivery", group_id: "g-cabinets", needed_by: day(6) }),
    L(houseId, "Porcelain floor tile", 54, "sqft", 3.5, "Floor & Decor", lead, { ...at(bath, up.id), group_id: "g-tile", needed_by: day(4), note: "12×24 matte grey, 10% extra" }),
    L(houseId, "Thinset mortar 50 lb", 2, "bag", 22, "Floor & Decor", lead, { ...at(bath, up.id), group_id: "g-thinset" }),
    L(houseId, "Toilet, elongated", 1, "ea", 260, "Home Depot", plumb, { ...at(toilet, up.id), installer: plumb, status: "got" }),
    L(houseId, "Wax ring with bolts", 1, "ea", 6, "Home Depot", plumb, { ...at(toilet, up.id), installer: plumb, group_id: "g-wax" }),
    L(houseId, "Drywall 4×8 ½ in", 24, "sheet", 16, "Home Depot", lead, { ...at(living, g.id), needed_by: day(1), group_id: "g-drywall" }),
    L(houseId, "Drywall screws 1¼ in", 2, "box", 12, null, lead, { ...at(living, g.id), fulfil: "stock" }),
    L(houseId, "Wall paint", 6, "gal", 42, "Sherwin-Williams", null, { ...at(living, g.id), note: "Agreeable Gray, eggshell" }),
    L(houseId, "Interior door slab 32 in", 3, "ea", 89, "Home Depot", lead, { ...at(door, up.id), status: "installed" }),
    // Baker St kitchen
    L("baker", "Duplex outlet 15A, white", 4, "ea", 3.5, "Home Depot", elec, { group_id: "g-outlets", installer: elec, needed_by: day(2) }),
    L("baker", "Kitchen faucet, pull-down", 1, "ea", 180, "Ferguson", plumb, { group_id: "g-faucet", status: "ordered", fulfil: "delivery" }),
    L("baker", "Base cabinet", 3, "ea", 240, "Cabinet Depot", lead, { group_id: "g-cabinets", status: "ordered", fulfil: "delivery" }),
    L("baker", "Drywall 4×8 ½ in", 8, "sheet", 16, "Home Depot", lead, { group_id: "g-drywall" }),
    // Elm Ave bathroom
    L("elm", "Porcelain floor tile", 40, "sqft", 3.5, "Floor & Decor", lead, { group_id: "g-tile" }),
    L("elm", "Thinset mortar 50 lb", 1, "bag", 22, "Floor & Decor", lead, { group_id: "g-thinset" }),
    L("elm", "Wax ring with bolts", 1, "ea", 6, "Home Depot", plumb, { group_id: "g-wax" }),
    L("elm", "Vanity 30 in", 1, "ea", 380, "Home Depot", plumb, { fulfil: "delivery", needed_by: day(5) }),
  ];
}
