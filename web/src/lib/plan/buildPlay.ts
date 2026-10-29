// "Build it": the house going up in the order it's built, as a quick preview of the work order (not a
// game). Each step is one of the build looks the 3D already draws (lib/plan/build.ts: slab, framing,
// sheetrock, finished), with how many floors stand, whether the roof is on and which objects are in.
// A step can carry the crew days it takes (from the job's schedule, later); then the scrubber shows the
// day each step starts.
import type { BuildLook } from "./build";
import type { Fixture, Plan } from "./types";
import { outsideAt, stagesFromSpec, type BuildSpec, type Surface } from "./buildSpec";

/** The stages of the work, in order. `days` keys use these ids. */
export type StageId = "foundation" | "floor" | "framing" | "walls" | "roof" | "openings" | "cabinets" | "fixtures";
export interface BuildStep {
  id: StageId; label: string; look: BuildLook;
  /** how many floors stand, lowest first */
  floors: number;
  /** the walls drawn at all (the bare foundation has none, not even chalk lines) */
  walls: boolean; roof: boolean;
  objects: "none" | "cabinets" | "all";
  /** crew days this step takes, when the job has a schedule */
  days?: number;
  /** from how it's built: the siding and roof chosen, and the layer on the outside walls at this step */
  outside?: { siding: Surface | null; roof: Surface | null; layer: Surface | null; roofOn: boolean };
}

const CABINETS = new Set(["base_cabinet", "wall_cabinet", "tall_cabinet", "kitchen_sink", "vanity", "filler", "island", "medicine_cabinet"]);
export const isCabinet = (x: Pick<Fixture, "kind">) => CABINETS.has(x.kind);
const ORD = ["ground floor", "floor 2", "floor 3", "floor 4", "floor 5", "floor 6"];

/**
 * The steps for this plan: foundation, floor, framing (a floor at a time when there are several), walls,
 * roof, windows and doors, then cabinets and the fixtures and furniture when there are any.
 * `days`: crew days by stage (framing's are shared out over its floors).
 */
export function buildSteps(plan: Plan, days?: Partial<Record<StageId, number>>, spec?: BuildSpec): BuildStep[] {
  const n = Math.max(1, plan.floors.length);
  if (spec && Object.keys(spec).length) return specSteps(plan, spec, days);
  const things = plan.floors.flatMap((f) => f.fixtures ?? []);
  const d = (id: StageId, share = 1) => (days?.[id] != null ? { days: days[id]! / share } : {});
  const s: BuildStep[] = [
    { id: "foundation", label: "Foundation", look: "slab", floors: 1, walls: false, roof: false, objects: "none", ...d("foundation") },
    { id: "floor", label: "Floor", look: "slab", floors: 1, walls: true, roof: false, objects: "none", ...d("floor") },
    ...Array.from({ length: n }, (_, k): BuildStep => ({ id: "framing", label: n > 1 ? `Framing, ${ORD[k] ?? `floor ${k + 1}`}` : "Framing", look: "framing", floors: k + 1, walls: true, roof: false, objects: "none", ...d("framing", n) })),
    { id: "walls", label: "Walls", look: "drywall", floors: n, walls: true, roof: false, objects: "none", ...d("walls") },
    { id: "roof", label: "Roof", look: "drywall", floors: n, walls: true, roof: true, objects: "none", ...d("roof") },
    { id: "openings", label: "Windows and doors", look: "finished", floors: n, walls: true, roof: true, objects: "none", ...d("openings") },
  ];
  if (things.some(isCabinet)) s.push({ id: "cabinets", label: "Cabinets", look: "finished", floors: n, walls: true, roof: true, objects: "cabinets", ...d("cabinets") });
  if (things.some((x) => !isCabinet(x))) s.push({ id: "fixtures", label: "Fixtures and furniture", look: "finished", floors: n, walls: true, roof: true, objects: "all", ...d("fixtures") });
  return s;
}

// the job's own stages (from the build questions) as the steps: each wall layer goes on in its turn
const SPEC_ID: Record<string, StageId> = { site: "foundation", foundation: "foundation", framing: "framing", roof: "roof", openings: "openings", fixtures: "fixtures", final: "fixtures" };
function specSteps(plan: Plan, spec: BuildSpec, days?: Partial<Record<StageId, number>>): BuildStep[] {
  const n = Math.max(1, plan.floors.length);
  const stages = stagesFromSpec(spec), names = stages.map((s) => s.name);
  const roofAt = stages.findIndex((s) => s.key === "roof");
  const things = plan.floors.flatMap((f) => f.fixtures ?? []);
  const share = (id: StageId) => stages.filter((s) => (SPEC_ID[s.key] ?? "walls") === id).length;
  return stages.map((s, i): BuildStep => {
    const id = SPEC_ID[s.key] ?? "walls";
    const bare = s.key === "site" || s.key === "foundation";
    return {
      id, label: s.name, look: s.look, floors: bare ? 1 : n, walls: !bare, roof: roofAt >= 0 && i >= roofAt,
      objects: s.key === "fixtures" || s.key === "final" ? (things.some((x) => !isCabinet(x)) ? "all" : "cabinets") : "none",
      outside: outsideAt(spec, names, i),
      ...(days?.[id] != null ? { days: days[id]! / share(id) } : {}),
    };
  });
}

/** The step on show at `t`, 0 (start) to 1 (all built). */
export const stepAt = (steps: BuildStep[], t: number) => Math.max(0, Math.min(steps.length - 1, Math.floor(t * steps.length)));

/** The day a step starts on (day 1 first), or null when the steps have no crew days. */
export function dayOf(steps: BuildStep[], i: number): number | null {
  if (!steps.some((s) => s.days != null)) return null;
  return 1 + Math.round(steps.slice(0, i).reduce((n, s) => n + (s.days ?? 0), 0));
}

/** The plan as it stands at a step: the floors up so far, and only the objects in by then. */
export function planAtStep(plan: Plan, s: BuildStep): Plan {
  const floors = [...plan.floors].sort((a, b) => a.level - b.level).slice(0, s.floors);
  return { ...plan, floors: floors.map((f) => (s.objects === "all" ? f : { ...f, fixtures: s.objects === "cabinets" ? f.fixtures.filter(isCabinet) : [] })) };
}
