// Build stages: the house as it stands on site. A job goes slab -> framing -> sheetrock -> finished, and
// the plan can show any of them. Furnishing is separate: a newly read plan starts empty, and the
// contractor says which floors get their cabinets, fixtures and furniture (all of them, or one by one).
// Both are saved with the job's edits under one key, so nothing new is needed in the database.
import type { ElementEdit, JobStage } from "@/lib/data/types";
import type { Plan, Pt } from "./types";

export type BuildLook = "slab" | "framing" | "drywall" | "finished";

export const LOOKS: { look: BuildLook; label: string; hint: string }[] = [
  { look: "slab", label: "Slab", hint: "No walls yet: the slab with the walls, doors and windows chalked out on it" },
  { look: "framing", label: "Framing", hint: "The walls as 2x4 studs, plates and headers, windows in" },
  { look: "drywall", label: "Sheetrock", hint: "Walls boarded, nothing hung yet: no doors, trim or cabinets" },
  { look: "finished", label: "Finished", hint: "Done: finishes, doors, and the cabinets and furniture on the floors you furnished" },
];
export const LOOK_LABEL = Object.fromEntries(LOOKS.map((l) => [l.look, l.label])) as Record<BuildLook, string>;

/** A stage the contractor added: their own name, drawn like one of the four looks. */
export interface CustomStage { id: string; name: string; look: BuildLook }

/** "all", or the floors that are furnished. Not set yet: the plan hasn't been asked about. */
export type Furnish = "all" | string[];

/** The job-wide settings live in the edits under this key (it never matches a plan element). */
export const JOB_KEY = "@job";
export interface JobSettings { furnish?: Furnish; build_stages?: CustomStage[] }
export const jobSettings = (edits: Record<string, ElementEdit>): JobSettings => edits[JOB_KEY] ?? {};

export function furnishedFloors(plan: Plan, f: Furnish | undefined): Set<string> {
  if (f === "all") return new Set(plan.floors.map((x) => x.id));
  return new Set(f ?? []);
}

/** The plan as built at this stage: objects only on furnished floors, and only once it's finished. */
export function stagedPlan(plan: Plan, look: BuildLook, furnished: Set<string> | null): Plan {
  if (look === "finished" && !furnished) return plan;
  return { ...plan, floors: plan.floors.map((fl) => (look === "finished" && furnished!.has(fl.id) ? fl : { ...fl, fixtures: [] })) };
}

/** The look that goes with a job stage, from its name ("Framing", "Insulation and drywall" ...). */
export function lookForStage(name: string): BuildLook {
  const n = name.toLowerCase();
  if (/final|punch|handover|close|walkthrough|cabinet|counter|fixture|appliance|trim|glass|backsplash|exterior finish/.test(n)) return "finished";
  if (/drywall|sheetrock|plaster|board|insulation|waterproof|paint|tile|flooring|interior finish/.test(n)) return "drywall";
  if (/fram|structur|rough|roof|window|inspection/.test(n)) return "framing";
  if (/permit|survey|site|foundation|slab|demo|design|measure|layout|mitigation|damage|approval/.test(n)) return "slab";
  return "finished";
}

/** Where the job is now: the look of the stage in progress, or finished when none has started. */
export function currentLook(stages: Pick<JobStage, "name" | "status">[]): BuildLook {
  const active = stages.find((s) => s.status === "active");
  return active ? lookForStage(active.name) : "finished";
}

/** A wall or opening outline as a straight run: start and end on its centre line, unit direction and
 *  normal, length and thickness. Taken along the outline's longest edge. */
export interface Run { a: Pt; b: Pt; u: Pt; n: Pt; length: number; thickness: number }
export function runOf(poly: Pt[]): Run | null {
  if (poly.length < 3) return null;
  let best = 0, u: Pt = [1, 0];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L > best) { best = L; u = [(q[0] - p[0]) / L, (q[1] - p[1]) / L]; }
  }
  const n: Pt = [-u[1], u[0]];
  let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
  for (const p of poly) {
    const s = p[0] * u[0] + p[1] * u[1], t = p[0] * n[0] + p[1] * n[1];
    s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t);
  }
  const tm = (t0 + t1) / 2;
  const at = (s: number): Pt => [u[0] * s + n[0] * tm, u[1] * s + n[1] * tm];
  return { a: at(s0), b: at(s1), u, n, length: s1 - s0, thickness: t1 - t0 };
}

/** Where the studs stand along a run, mm from its start: one at each end, the rest at 16" centres. */
export function studsAlong(length: number, stud: number, spacing: number): number[] {
  if (length < stud) return [length / 2];
  const out = [stud / 2];
  for (let s = spacing; s < length - stud; s += spacing) out.push(s);
  out.push(length - stud / 2);
  return out;
}

/** Asking the assistant to furnish the house, or one room, turns furnishing on there: the whole house,
 *  or the floor that room is on. */
export function furnishWhere(plan: Plan, current: Furnish | undefined, room: string | null): Furnish {
  if (!room || current === "all") return "all";
  const fl = plan.floors.find((f) => f.rooms.some((r) => r.name.toLowerCase() === room.toLowerCase()));
  const on = new Set(current ?? []);
  if (fl) on.add(fl.id);
  return on.size >= plan.floors.length ? "all" : plan.floors.filter((f) => on.has(f.id)).map((f) => f.id);
}
