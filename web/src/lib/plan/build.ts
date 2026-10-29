// Build stages: the house as it stands on site. A job goes slab -> framing -> sheetrock -> finished, and
// the plan can show any of them. Furnishing is separate: a newly read plan starts empty, and the
// contractor says which floors get their cabinets, fixtures and furniture (all of them, or one by one).
// Both are saved with the job's edits under one key, so nothing new is needed in the database.
import type { ElementEdit, JobStage } from "@/lib/data/types";
import { pointInPoly } from "./geometry";
import type { Fixture, Plan, Pt } from "./types";
import type { BuildSpec } from "./buildSpec";

export type BuildLook = "slab" | "framing" | "drywall" | "finished";

export const LOOKS: { look: BuildLook; label: string; hint: string }[] = [
  { look: "slab", label: "Slab", hint: "No walls yet: the slab with the walls, doors and windows chalked out on it" },
  { look: "framing", label: "Framing", hint: "The walls as 2x4 studs, plates and headers, windows in" },
  { look: "drywall", label: "Sheetrock", hint: "Walls boarded, nothing hung yet: no doors, trim or cabinets" },
  { look: "finished", label: "Finished", hint: "Done: finishes, doors, and the cabinets and furniture on the floors you furnished" },
];
export const LOOK_LABEL = Object.fromEntries(LOOKS.map((l) => [l.look, l.label])) as Record<BuildLook, string>;

/** "all", or the floors that are furnished. Not set yet: the plan hasn't been asked about. */
export type Furnish = "all" | string[];

/** The job-wide settings live in the edits under this key (it never matches a plan element). */
export const JOB_KEY = "@job";
/** stage_looks: the look a stage was set to by hand, by stage id, over the one guessed from its name;
 *  build: how the house is built (the answers to the build questions, lib/plan/buildSpec.ts) */
export interface JobSettings { furnish?: Furnish; stage_looks?: Record<string, BuildLook>; build?: BuildSpec }
export const jobSettings = (edits: Record<string, ElementEdit>): JobSettings => edits[JOB_KEY] ?? {};

/** What can be furnished one by one: each home when the drawing has several, otherwise each floor. */
export interface Place { id: string; name: string }
export function furnishPlaces(plan: Plan): { kind: "home" | "floor"; places: Place[] } {
  const units = [...new Set(plan.floors.flatMap((f) => f.rooms.map((r) => r.unit)).filter(Boolean) as string[])];
  if (units.length > 1) return { kind: "home", places: units.map((u) => ({ id: `unit:${u}`, name: u })) };
  return { kind: "floor", places: [...plan.floors].sort((a, b) => a.level - b.level).map((f) => ({ id: f.id, name: f.name })) };
}

/** The places that are furnished (floor ids, or "unit:<name>" for a home). */
export function furnishedSet(plan: Plan, f: Furnish | undefined): Set<string> {
  if (f === "all") return new Set(furnishPlaces(plan).places.map((x) => x.id));
  return new Set(f ?? []);
}

/** The plan as built at this stage: objects only once it's finished, and only where it's furnished.
 *  null furnishing shows everything (a plan nobody can be asked about). */
export function stagedPlan(plan: Plan, look: BuildLook, furnish: Furnish | undefined | null): Plan {
  if (look === "finished" && (furnish === null || furnish === "all")) return plan;
  const on = look === "finished" ? furnishedSet(plan, furnish ?? undefined) : new Set<string>();
  return { ...plan, floors: plan.floors.map((fl) => {
    if (on.has(fl.id)) return fl;
    const unitOf = (x: Fixture) => (fl.rooms.find((r) => r.id === x.room_id) ?? fl.rooms.find((r) => pointInPoly(x.center, r.polygon)))?.unit;
    // a thing outside every home (a shared garage, the street) comes in with the first home furnished
    const fixtures = on.size ? fl.fixtures.filter((x) => { const u = unitOf(x); return u ? on.has(`unit:${u}`) : [...on].some((id) => id.startsWith("unit:")); }) : [];
    return fixtures.length === fl.fixtures.length ? fl : { ...fl, fixtures };
  }) };
}

/** The look that goes with a job stage, from its name ("Framing", "Insulation and drywall" ...). */
export function lookForStage(name: string): BuildLook {
  const n = name.toLowerCase();
  if (/vapou?r|sheath|weather barrier|house wrap|felt|block wall/.test(n)) return "framing";
  if (/insulation:/.test(n)) return "framing";
  if (/final|punch|handover|close|walkthrough|cabinet|counter|fixture|appliance|trim|glass|backsplash|exterior finish|siding|cladding/.test(n)) return "finished";
  if (/drywall|sheetrock|plaster|board|insulation|waterproof|paint|tile|flooring|interior finish/.test(n)) return "drywall";
  if (/fram|structur|rough|roof|window|inspection/.test(n)) return "framing";
  if (/permit|survey|site|foundation|slab|demo|design|measure|layout|mitigation|damage|approval/.test(n)) return "slab";
  return "finished";
}

/** How the map draws the house for a stage picked in Stages: the look set for it, or one from its name. */
export function stageLook(stage: Pick<JobStage, "id" | "name">, settings: JobSettings): BuildLook {
  return settings.stage_looks?.[stage.id] ?? lookForStage(stage.name);
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
 *  or the home (or floor) that room is in. */
export function furnishWhere(plan: Plan, current: Furnish | undefined, room: string | null): Furnish {
  if (!room || current === "all") return "all";
  const { kind, places } = furnishPlaces(plan);
  const fl = plan.floors.find((f) => f.rooms.some((r) => r.name.toLowerCase() === room.toLowerCase()));
  const r = fl?.rooms.find((x) => x.name.toLowerCase() === room.toLowerCase());
  const on = new Set(current ?? []);
  if (kind === "home" && r?.unit) on.add(`unit:${r.unit}`);
  else if (kind === "floor" && fl) on.add(fl.id);
  return places.every((x) => on.has(x.id)) ? "all" : places.filter((x) => on.has(x.id)).map((x) => x.id);
}

/** The homes on show, by unit name, for looking at one or a few homes of a row; null keeps them all.
 *  Rooms with no home (a shared stair, the street) stay, and so does whatever stands in them. */
export function homesPlan(plan: Plan, homes: string[] | null): Plan {
  if (!homes) return plan;
  const keep = new Set(homes);
  return { ...plan, floors: plan.floors.map((fl) => {
    const rooms = fl.rooms.filter((r) => !r.unit || keep.has(r.unit));
    if (rooms.length === fl.rooms.length) return fl;
    const ids = new Set(rooms.map((r) => r.id));
    const mine = (x: { room_ids: string[] }) => !x.room_ids.length || x.room_ids.some((id) => ids.has(id));
    const inside = (pt: Pt) => { const r = fl.rooms.find((q) => pointInPoly(pt, q.polygon)); return !r || ids.has(r.id); };
    const mid = (ps: Pt[]): Pt => [ps.reduce((a, q) => a + q[0], 0) / ps.length, ps.reduce((a, q) => a + q[1], 0) / ps.length];
    return {
      ...fl, rooms, walls: fl.walls.filter(mine), openings: fl.openings.filter(mine),
      fixtures: fl.fixtures.filter((x) => (x.room_id ? ids.has(x.room_id) : inside(x.center))),
      stairs: fl.stairs.filter((st) => inside(mid(st.polygon))),
    };
  }) };
}
