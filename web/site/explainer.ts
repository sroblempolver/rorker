// The 30-second explainer on rorker.com, as a script. A cursor works the real 3D house: a new job from a
// drawing, into the ground floor, a pin on the kitchen, the electrician tagged, a leak pinned for the
// plumber, a question to the assistant, and the job moving forward. Each step sets what the house shows
// (Scene), where the camera goes (Pose) and what the overlay shows (Hud); the page runs it in a loop.
import type * as THREE from "three";
import type { PinKind } from "@/lib/data/types";
import { clearMarks, showMarks } from "@/lib/plan/marks";
import { BASE_SCENE, GROUND, makePin, resetPins, plan, roomByType, roomPlanPoint, roomPoint, squareFeet, type Pose, type Scene } from "./stage";

export const CREW = [
  { name: "Marco Diaz", title: "Site lead" },
  { name: "Aisha Khan", title: "Electrician" },
  { name: "Tom Reilly", title: "Plumber" },
  { name: "Dana Brooks", title: "Office" },
];

export const CHAPTERS = [
  { key: "drawing", title: "Drop in the drawing", line: "AutoCAD, PDF or a photo of the plan. Out comes the house, every room numbered." },
  { key: "walk", title: "Walk in", line: "Click a floor and the roof comes off. Click a room and it's yours." },
  { key: "pin", title: "Pin the work", line: "Drop the task on the exact spot. Type it the way you'd say it." },
  { key: "crew", title: "Tag the crew", line: "Drag a guy onto the task. He gets a text with a link, no app to download." },
  { key: "ask", title: "Ask it anything", line: "Talk to it. It answers and points at the spot on the map." },
  { key: "move", title: "Watch it move", line: "Rooms turn green as the work gets done. You see the whole job from above." },
];

export interface Job { id: string; name: string; sub: string; pct: number; stage: string; late?: number; fresh?: boolean }
export interface Note { pinId: string; kind: PinKind; title: string; due: string; tagged: string[]; world: [number, number, number]; editing?: boolean }
export interface LogLine { id: number; time: string; text: string; tone?: "done" | "late" | "new" }

export interface Hud {
  chapter: number;
  breadcrumb: string[];
  newJob: null | { phase: "drop" | "reading" | "read"; progress: number; file: boolean };
  /** the drawing being dragged from the files tray */
  dragFile: boolean;
  jobs: Job[];
  note: Note | null;
  /** the crew member being dragged onto a task */
  dragging: string | null;
  /** faces over the pins in the house */
  tags: { pinId: string; who: string[]; world: [number, number, number] }[];
  ask: null | { q: string; a: string; listening: boolean };
  banner: null | { title: string; sub: string };
  log: LogLine[];
  /** a HUD button shown pressed */
  hot: string | null;
  /** the explainer's end card */
  end: boolean;
}

export const START_JOBS: Job[] = [
  { id: "birch", name: "88 Birch Ln", sub: "Deck rebuild", pct: 72, stage: "Finish" },
  { id: "mill", name: "5 Mill St", sub: "Basement", pct: 15, stage: "Framing", late: 1 },
];

export const EMPTY_HUD: Hud = {
  chapter: 0, breadcrumb: ["All jobs"], newJob: null, dragFile: false, jobs: START_JOBS, note: null, dragging: null, tags: [], ask: null, banner: null, log: [], hot: null, end: false,
};

/** Where the cursor goes: a spot in the house, a HUD element (by its data-hud name) or a screen fraction. */
export type Target = { world: () => THREE.Vector3 } | { el: string } | { x: number; y: number };

export interface Ctx {
  scene(p: Partial<Scene> | ((s: Scene) => Partial<Scene>)): void;
  hud(p: Partial<Hud> | ((h: Hud) => Partial<Hud>)): void;
  pose(p: Pose): void;
  /** glide the cursor to a target */
  to(t: Target, ms?: number): Promise<void>;
  /** press and let go, with the ripple */
  click(): Promise<void>;
  down(): void;
  up(): void;
  wait(ms: number): Promise<void>;
  /** type text a few letters at a time */
  type(text: string, set: (s: string) => void, cps?: number): Promise<void>;
  /** animate a number */
  count(from: number, to: number, ms: number, set: (v: number) => void): Promise<void>;
  log(text: string, tone?: LogLine["tone"]): void;
  chapter(i: number): void;
}

const kitchen = roomByType(GROUND, "kitchen");
const lav = GROUND.rooms.find((r) => r.type === "wc") ?? roomByType(GROUND, "laundry");
const floorAt = (id: string, up: number) => () => roomPoint(id, up);
const arr = (v: THREE.Vector3): [number, number, number] => [v.x, v.y, v.z];
const counts = () => {
  const rooms = plan.floors.reduce((n, f) => n + f.rooms.length, 0);
  const doors = plan.floors.reduce((n, f) => n + f.openings.filter((o) => o.kind.includes("door")).length, 0);
  const windows = plan.floors.reduce((n, f) => n + f.openings.filter((o) => o.kind.includes("window")).length, 0);
  const fixtures = plan.floors.reduce((n, f) => n + f.fixtures.length, 0);
  return { rooms, doors, windows, fixtures, floors: plan.floors.length };
};

export async function explainer(c: Ctx) {
  const n = counts();
  // ----------------------------------------------------------------- 1. a new job from the drawing
  c.chapter(0);
  clearMarks();
  resetPins();
  c.scene({ ...BASE_SCENE, look: "slab" });
  c.hud({ ...EMPTY_HUD });
  c.pose({ az: 0.95, pol: 0.62, dist: 4.4, spin: 0.05 });
  await c.wait(600);
  await c.to({ el: "new-job" }, 900);
  await c.click();
  c.hud({ newJob: { phase: "drop", progress: 0, file: false }, breadcrumb: ["All jobs", "New job"] });
  await c.wait(250);
  await c.to({ el: "file" }, 650);
  c.down();
  c.hud({ dragFile: true });
  await c.to({ el: "drop" }, 700);
  c.up();
  c.hud({ dragFile: false, newJob: { phase: "reading", progress: 0, file: true } });
  c.log("Reading house.dwg");
  const looks = ["slab", "framing", "drywall", "finished"] as const;
  for (let i = 1; i <= 3; i++) {
    await c.count((i - 1) / 3, i / 3, 650, (v) => c.hud((h) => ({ newJob: h.newJob && { ...h.newJob, progress: v } })));
    c.scene({ look: looks[i] });
    if (i === 1) c.log(`${n.rooms} rooms on ${n.floors} floors`);
    if (i === 2) c.log(`${n.doors} doors, ${n.windows} windows, ${n.fixtures} fixtures`);
  }
  c.hud({ newJob: { phase: "read", progress: 1, file: true } });
  c.log("14 Hadley Rd is ready", "new");
  await c.wait(500);
  c.hud((h) => ({ newJob: null, jobs: [{ id: "hadley", name: "14 Hadley Rd", sub: "Kitchen and 2 baths", pct: 0, stage: "Demo", fresh: true }, ...h.jobs], breadcrumb: ["All jobs", "14 Hadley Rd"] }));
  c.pose({ az: 0.55, pol: 0.92, dist: 3.0, spin: 0.03 });
  await c.wait(700);

  // ----------------------------------------------------------------- 2. into the ground floor
  c.chapter(1);
  c.pose({ az: 0.45, pol: 0.86, dist: 2.2 });
  await c.to({ world: floorAt(kitchen.id, 3.2) }, 1100);
  await c.click();
  c.scene({ mode: "floor", floorId: GROUND.id });
  c.hud((h) => ({ breadcrumb: [...h.breadcrumb, GROUND.name] }));
  const kp = roomPlanPoint(kitchen.id);
  c.pose({ az: 0.3, pol: 0.6, dist: 1.9, at: [kp[0] / 1000, 0, kp[1] / 1000] });
  await c.wait(700);
  await c.to({ world: floorAt(kitchen.id, 0.1) }, 700);
  await c.click();
  c.scene({ selected: kitchen.id });
  c.hud((h) => ({ breadcrumb: [...h.breadcrumb, kitchen.name] }));
  c.log(`${kitchen.id} ${kitchen.name}, ${squareFeet(kitchen.area_m2 ?? 9)}`);
  await c.wait(500);

  // ----------------------------------------------------------------- 3. a pin on the kitchen
  c.chapter(2);
  await c.to({ el: "pin-tool" }, 700);
  await c.click();
  c.hud({ hot: "pin-tool" });
  c.scene({ pinMode: true });
  await c.to({ world: floorAt(kitchen.id, 0.05) }, 650);
  await c.click();
  const outlets = makePin({ kind: "task", title: "Rough-in counter outlets", element_id: kitchen.id, floor_id: GROUND.id });
  c.scene({ pins: [outlets], selectedPin: outlets.id, pinMode: false, selected: null });
  c.hud({ hot: null, note: { pinId: outlets.id, kind: "task", title: "", due: "Fri", tagged: [], world: arr(roomPoint(kitchen.id, 0.6)) } });
  await c.wait(250);
  await c.type(outlets.title, (s) => c.hud((h) => ({ note: h.note && { ...h.note, title: s } })), 30);
  c.log(`Pin ${outlets.number}, task in the ${kitchen.name.toLowerCase()}`);
  await c.wait(250);

  // ----------------------------------------------------------------- 4. tag the electrician, then the plumber
  c.chapter(3);
  await c.to({ el: "crew-Aisha Khan" }, 700);
  c.down();
  c.hud({ dragging: "Aisha Khan" });
  await c.to({ el: "note-tags" }, 750);
  c.up();
  const at1 = roomPoint(kitchen.id, 1.5);
  c.hud((h) => ({ dragging: null, note: h.note && { ...h.note, tagged: ["Aisha Khan"] }, tags: [{ pinId: outlets.id, who: ["Aisha Khan"], world: arr(at1) }] }));
  c.log("Aisha Khan tagged, text sent with her link");
  await c.wait(350);
  await c.to({ el: "note-save" }, 500);
  await c.click();
  c.hud({ note: null });
  c.scene({ selectedPin: null });
  // the leak, quicker: P, click, type, drag
  c.hud({ hot: "pin-tool" });
  c.scene({ pinMode: true });
  await c.to({ world: floorAt(lav.id, 0.05) }, 800);
  await c.click();
  const leak = makePin({ kind: "issue", title: "Leak under the vanity", element_id: lav.id, floor_id: GROUND.id, close_requirement: "photo" });
  c.scene((s) => ({ pins: [...s.pins, leak], selectedPin: leak.id, pinMode: false }));
  c.hud({ hot: null, note: { pinId: leak.id, kind: "issue", title: "", due: "Today", tagged: [], world: arr(roomPoint(lav.id, 0.6)) } });
  await c.type(leak.title, (s) => c.hud((h) => ({ note: h.note && { ...h.note, title: s } })), 40);
  await c.to({ el: "crew-Tom Reilly" }, 550);
  c.down();
  c.hud({ dragging: "Tom Reilly" });
  await c.to({ el: "note-tags" }, 600);
  c.up();
  const at2 = roomPoint(lav.id, 1.5);
  c.hud((h) => ({ dragging: null, note: h.note && { ...h.note, tagged: ["Tom Reilly"] }, tags: [...h.tags, { pinId: leak.id, who: ["Tom Reilly"], world: arr(at2) }] }));
  c.log("Tom Reilly tagged on the leak, close with a photo", "late");
  await c.wait(300);
  await c.to({ el: "note-save" }, 450);
  await c.click();
  c.hud({ note: null });
  c.scene({ selectedPin: null });

  // ----------------------------------------------------------------- 5. ask the assistant
  c.chapter(4);
  c.pose({ az: 0.2, pol: 0.5, dist: 2.1 });
  await c.to({ el: "mic" }, 750);
  await c.click();
  c.hud({ ask: { q: "", a: "", listening: true } });
  await c.type("What's left in the kitchen?", (s) => c.hud((h) => ({ ask: h.ask && { ...h.ask, q: s } })), 32);
  c.hud((h) => ({ ask: h.ask && { ...h.ask, listening: false } }));
  await c.wait(350);
  const lp = roomPlanPoint(lav.id);
  showMarks([
    { floor_id: GROUND.id, x: kp[0], y: kp[1], z: 900, label: "Counter outlets", color: "#3b9bff", id: kitchen.id },
    { floor_id: GROUND.id, x: lp[0], y: lp[1], z: 900, label: "Leak", color: "#ff4fa3", id: lav.id },
  ]);
  await c.type("One task: the counter outlets, Aisha, due Friday. The blue dot. Tom has the leak next door, the pink one.", (s) => c.hud((h) => ({ ask: h.ask && { ...h.ask, a: s } })), 70);
  await c.wait(1300);

  // ----------------------------------------------------------------- 6. the work gets done
  c.chapter(5);
  c.hud({ ask: null });
  clearMarks();
  const rooms = (t: string) => GROUND.rooms.filter((r) => r.type === t).map((r) => r.id);
  const st: Scene["states"] = {};
  for (const id of rooms("garage")) st[id] = "existing";
  for (const id of [...rooms("dining"), ...rooms("family")]) st[id] = "done";
  for (const id of [...rooms("living"), ...rooms("foyer"), ...rooms("study")]) st[id] = "in_progress";
  st[kitchen.id] = "in_progress";
  st[lav.id] = "not_built";
  c.scene({ colorMode: "progress", states: st });
  c.pose({ az: 0.1, pol: 0.32, dist: 2.2, at: null });
  await c.wait(900);
  c.log("Aisha: outlets done, 2 photos", "done");
  c.scene((s) => ({ pins: s.pins.map((p) => (p.id === outlets.id ? { ...p, status: "done" as const } : p)), states: { ...s.states, [kitchen.id]: "done" } }));
  c.hud((h) => ({ tags: h.tags.filter((t) => t.pinId !== outlets.id), banner: { title: `${kitchen.name} done`, sub: "Rough-in, 3 of 7 rooms" } }));
  await c.count(0, 38, 1100, (v) => c.hud((h) => ({ jobs: h.jobs.map((j) => (j.id === "hadley" ? { ...j, pct: Math.round(v), stage: v > 20 ? "Rough-in" : j.stage } : j)) })));
  await c.wait(500);
  c.log("Tom: on the way to Hadley");
  c.scene((s) => ({ states: { ...s.states, [lav.id]: "in_progress" } }));
  await c.wait(900);
  c.hud({ banner: null });
  c.scene({ mode: "building", floorId: null, colorMode: "type", selected: null });
  c.hud((h) => ({ breadcrumb: h.breadcrumb.slice(0, 2), tags: [] }));
  c.pose({ az: 0.7, pol: 0.95, dist: 3.1, spin: 0.06 });
  await c.wait(400);
  c.hud({ end: true });
  await c.to({ el: "open-app" }, 900);
  await c.wait(3200);
  c.hud({ end: false });
}
