// The Rorker assistant: what it can do (tools), how it talks (instructions), and the code that runs
// each tool. The same tools run on the server (on the signed-in person's own permissions) and in the
// standalone preview (on the sample job), behind the AssistantBackend interface.
//
// Privacy is enforced here and in the backend, not left to the model: every lookup goes through the
// caller's own access (the backend only returns jobs this person can open), and the results are cut
// down to what their role may see. Employees never get client contact details or team phone numbers
// and emails. Nothing is fetched that the person couldn't see in the app themselves.
import type { ElementStatus, Plan } from "@/lib/plan/types";
import type { ElementEdit, ItemInput, ItemKind, Job, JobItem, JobStage, Member, MemberRole, Pin, PinInput, PinKind, PinStatus, StageStatus } from "@/lib/data/types";
import { bboxOf, elementLabel, findElement, labelPoint, roomOf, roomSides } from "@/lib/plan/geometry";
import { addedFixture, applyEdits, fixtureSize } from "@/lib/plan/edits";
import { kindFor, OBJECT_KINDS, specOf, topOf, bottomOf, weightOf, type Part } from "@/lib/plan/catalog";
import { naturalFacing, partnerOf, supportOf, toward } from "@/lib/plan/arrange";
import { MARK_COLORS, type Mark } from "@/lib/plan/pointing";
import { markFor } from "@/lib/plan/places";
import { today } from "@/lib/dates";
import { RULES } from "@/lib/plan/rules";
import { itemNumbers, numberIn } from "@/lib/plan/numbers";
import { widthAxis } from "@/lib/plan/edits";
import { inches } from "@/lib/measure";

/** `plan` is the plan as drawn; `edits` are the changes made in the app on top of it (moved, added, removed). */
export interface JobBundle { job: Job; plan: Plan | null; edits: Record<string, ElementEdit>; pins: Pin[]; stages: JobStage[]; items: JobItem[]; states: { element_id: string; status: ElementStatus }[] }

export interface AssistantBackend {
  /** who is asking: the assistant acts as them, with their role */
  me: { name: string | null; role: MemberRole; memberId: string | null; company: string };
  listJobs(): Promise<Job[]>;
  /** null when the job doesn't exist or this person can't open it */
  loadJob(jobId: string): Promise<JobBundle | null>;
  members(): Promise<Member[]>;
  createPin(jobId: string, input: PinInput): Promise<Pin>;
  updatePin(jobId: string, pinId: string, input: Partial<PinInput> & { status?: PinStatus }): Promise<void>;
  setStageStatus(jobId: string, stageId: string, status: StageStatus): Promise<void>;
  setElementState(jobId: string, elementId: string, status: ElementStatus | null): Promise<void>;
  createItem(jobId: string, input: ItemInput): Promise<JobItem>;
  /** save the whole change for one plan element (null puts it back as drawn, or deletes an added one) */
  saveEdit(jobId: string, elementId: string, data: ElementEdit | null): Promise<void>;
}

/** Where the person is in the app when they ask, so "this job" and "here" mean something. */
export interface AssistantContext { jobId?: string | null; jobName?: string | null; where?: string | null; selected?: string | null }

export interface ToolSpec { name: string; description: string; input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] } }

const JOB = { type: "string", description: "The job: its id, or its name as the person says it (\"Hadley Road\"). Leave out for the job they're looking at." };
const PIN_KINDS = ["task", "issue", "note", "material"];
const ITEM_KINDS = ["outlet", "switch", "light", "data", "plumbing", "vent", "thermostat", "mount", "other"];
const SIDE = { type: "string", enum: ["north", "south", "east", "west"] };
const FACING: Record<string, number> = { east: 0, south: 90, west: 180, north: -90 };
const PART = { type: "object", properties: {
  shape: { type: "string", enum: ["box", "cylinder", "sphere"] },
  x: { type: "number", description: "Centre, mm right of the object's middle as seen from its front" }, z: { type: "number", description: "Centre, mm toward its front from its middle" },
  y: { type: "number", description: "Bottom of this part, mm above the object's bottom" },
  w: { type: "number", description: "Width, mm (left to right)" }, d: { type: "number", description: "Depth, mm (front to back)" }, h: { type: "number", description: "Height, mm" },
  color: { type: "string", description: "#rrggbb, its real colour" },
}, required: ["shape", "x", "y", "z", "w", "d", "h"] };

/** What a tool run did besides its answer: whether the job changed, and the places to point at on the plan. */
export interface Changes { any: boolean; marks?: Mark[]; focus?: string | null }

export const TOOLS: ToolSpec[] = [
  { name: "list_jobs", description: "List the jobs this person can see: id, name, address, status, open pins and current stage.", input_schema: { type: "object", properties: {} } },
  { name: "job_overview", description: "One job at a glance: stages, floors and rooms (with ids), open pins (number, kind, title, status, due date, who is tagged, where).", input_schema: { type: "object", properties: { job: JOB } } },
  { name: "find_in_plan", description: "Find rooms, walls, doors, windows and objects in a job's plan by name, kind, room, number or id (\"kitchen sink\", \"master bedroom\", \"kitchen #3\", \"G-F46\"). Every cabinet and item has a number in its room, shown on the plan. Returns ids to use with other tools.", input_schema: { type: "object", properties: { job: JOB, query: { type: "string" } }, required: ["query"] } },
  {
    name: "add_pin", description: "Add a pin (task, issue, note or material) to a job, on a room or object when given its id. Due date defaults to today. Tag people by name.",
    input_schema: { type: "object", properties: {
      job: JOB, kind: { type: "string", enum: PIN_KINDS }, title: { type: "string" }, details: { type: "string" },
      element_id: { type: "string", description: "Room, wall, door, window or object id from find_in_plan or job_overview" },
      due_date: { type: "string", description: "YYYY-MM-DD" }, tag: { type: "array", items: { type: "string" }, description: "Team members' names" }, high_priority: { type: "boolean" },
      photo_request: { type: "boolean", description: "Asking the tagged person for a photo of this spot (\"get Marco to send a photo of the sink\"): a task they close with a photo, sent from their link" },
    }, required: ["kind", "title"] },
  },
  {
    name: "update_pin", description: "Change a pin by its number: status (open, in_progress, done), title, details, due date, or who is tagged.",
    input_schema: { type: "object", properties: {
      job: JOB, pin_number: { type: "integer" }, status: { type: "string", enum: ["open", "in_progress", "done"] }, title: { type: "string" }, details: { type: "string" },
      due_date: { type: "string", description: "YYYY-MM-DD" }, tag: { type: "array", items: { type: "string" }, description: "Replaces who is tagged" },
    }, required: ["pin_number"] },
  },
  { name: "set_stage", description: "Set a job stage's status by its name: not_started, active or done.", input_schema: { type: "object", properties: { job: JOB, stage: { type: "string" }, status: { type: "string", enum: ["not_started", "active", "done"] } }, required: ["stage", "status"] } },
  { name: "set_build_status", description: "Mark a room, wall, door, window or object's build status: not_built, in_progress, done, existing or demolish (or clear).", input_schema: { type: "object", properties: { job: JOB, element_id: { type: "string" }, status: { type: "string", enum: ["not_built", "in_progress", "done", "existing", "demolish", "clear"] } }, required: ["element_id", "status"] } },
  {
    name: "add_wall_item", description: "Put an outlet, switch, light, plumbing point or other wall item on a wall of a room, at a height in mm (typical heights used when left out).",
    input_schema: { type: "object", properties: {
      job: JOB, room: { type: "string", description: "Room id or name" }, wall: { type: "string", description: "Which wall, e.g. \"north wall\" or \"east wall B\"" },
      kind: { type: "string", enum: ITEM_KINDS }, height_mm: { type: "number" }, from_left_mm: { type: "number", description: "From the wall's left end seen from inside the room; middle when left out" }, label: { type: "string" },
    }, required: ["room", "wall", "kind"] },
  },
  {
    name: "whats_around", description: "What is next to an object or door/window: the things on its left and right (as seen standing in front of it, facing it, the way someone uses it), in front of it and behind it, with distances. Use it for \"the cabinet right of the stove\" or \"the outlet left of the sink\". Returns ids.",
    input_schema: { type: "object", properties: { job: JOB, element_id: { type: "string", description: "The reference object's id, from find_in_plan" } }, required: ["element_id"] },
  },
  { name: "room_layout", description: "A room's layout for changing what's in it: its inside edges (x grows east, y grows south, in mm), its walls with the doors and windows on them, and every object in it with id, centre, size and the way it faces. Call it before adding or moving things.", input_schema: { type: "object", properties: { job: JOB, room: { type: "string", description: "Room id or name" } }, required: ["room"] } },
  {
    name: "add_objects", description: "Add furniture, appliances, electronics or fixtures to a room. Each goes in at its real size, height and weight (the catalogue's usual values unless you give them), at the right height: things that sit on something (a computer, monitor, microwave, table lamp, TV) go on top of it, on the desk or counter you name with `on` or the nearest suitable one in the room; wall things (mirror, picture, wall cabinet, shelf) hang at their usual height against the nearest wall. When you leave out `facing` it faces the natural way: chairs to their desk or table, stools to the counter, sofas to the TV, beds, cabinets and desks with their backs to the wall. Pieces are kept inside the room. Something not in the kind list: kind \"other\", its real name, and `parts`.",
    input_schema: { type: "object", properties: { job: JOB, room: { type: "string", description: "Room id (best) or name" }, objects: { type: "array", maxItems: 30, items: { type: "object", properties: {
      kind: { type: "string", enum: OBJECT_KINDS }, name: { type: "string", description: "What it is, e.g. \"Queen bed\", \"Desktop computer\", \"Espresso machine\"" },
      x: { type: "number", description: "Centre, plan mm. Can be left out for things put on something or next to their partner (a chair at its desk)" }, y: { type: "number" },
      width_mm: { type: "number", description: "Across its front; leave out for the usual size" }, depth_mm: { type: "number", description: "Front to back" }, height_mm: { type: "number" },
      weight_kg: { type: "number" },
      facing: { ...SIDE, description: "The way its front faces (the foot of a bed, the seat of a chair, a screen's face). Leave out for the natural way." },
      face_toward: { type: "string", description: "Id of something it should face (a chair facing desk G-F41)" },
      on: { type: "string", description: "Id of what it sits on (the desk, counter or sideboard), from room_layout or earlier in this call (\"new:0\" is the first object of this call)" },
      height_above_floor_mm: { type: "number", description: "Its bottom above the floor, for something hung at an unusual height" },
      parts: { type: "array", maxItems: 40, items: PART, description: "For kind other: the object built from simple shapes at real sizes, as it really looks (a rowing machine: rail, seat, flywheel, footrests). Its overall width, depth and height must contain the parts." },
    }, required: ["kind"] } } }, required: ["room", "objects"] },
  },
  {
    name: "change_object", description: "Move, turn, resize, rename or re-seat one object. Name it by id, or by its number in its room (every cabinet and item has one, shown on the plan: element_id \"3\" with room \"kitchen\"). Move by mm east/south (negative for west/north), or to a new centre; turn it to face a side or another object; put it on something (`on`), or set its height above the floor. Width, depth and height can be changed on anything; a cabinet's height is its box height (without the countertop). A cabinet that would run into its neighbour or past the wall isn't changed: you get the room there is and the choices (the size that fits exactly, made to order, or a stock size with a filler); ask the person which, then call again with that width.",
    input_schema: { type: "object", properties: { job: JOB, element_id: { type: "string", description: "Its id, or its number in the room (\"3\", \"#3\")" }, room: { type: "string", description: "The room, when naming it by number" }, move_east_mm: { type: "number" }, move_south_mm: { type: "number" }, to_x: { type: "number" }, to_y: { type: "number" },
      facing: SIDE, face_toward: { type: "string", description: "Id of what it should face" }, on: { type: "string", description: "Id of what it should sit on" }, height_above_floor_mm: { type: "number" },
      width_mm: { type: "number" }, depth_mm: { type: "number" }, height_mm: { type: "number" }, weight_kg: { type: "number" }, name: { type: "string" } }, required: ["element_id"] },
  },
  {
    name: "point_at", description: "Put a blinking coloured dot on the plan (2D and 3D) on each place you're talking about, so the person sees which is which. Use it whenever you name places they must tell apart or find: before asking \"the bedroom with the blue dot or the green one?\", and to show where something is. With one place it also opens that room or object in the side panel. Returns each place's dot colour; say the colours in your reply.",
    input_schema: { type: "object", properties: { job: JOB, places: { type: "array", minItems: 1, maxItems: 6, items: { type: "object", properties: {
      id: { type: "string", description: "Room, object, door, window or wall id" }, label: { type: "string", description: "What you call it, e.g. \"south bedroom\"" },
    }, required: ["id"] } }, open: { type: "string", description: "Id to open in the side panel (defaults to the place when there is just one)" } }, required: ["places"] },
  },
  { name: "remove_objects", description: "Take objects out of the plan by id (furniture, appliances, fixtures). Ones from the drawing can be brought back with Reset.", input_schema: { type: "object", properties: { job: JOB, element_ids: { type: "array", items: { type: "string" } } }, required: ["element_ids"] } },
  { name: "rename_room", description: "Rename a room or change its type.", input_schema: { type: "object", properties: { job: JOB, room: { type: "string" }, name: { type: "string" }, type: { type: "string", enum: ["kitchen", "bathroom", "wc", "bedroom", "living", "dining", "family", "study", "office", "hallway", "foyer", "stair_hall", "laundry", "utility", "closet", "garage", "storage", "balcony", "porch", "terrace", "other"] } }, required: ["room"] } },
  { name: "team", description: "The team: names, titles and roles (and contact details for admins).", input_schema: { type: "object", properties: {} } },
];

export function instructions(me: AssistantBackend["me"], ctx: AssistantContext): string {
  return [
    `You are the Rorker assistant inside Rorker, a job app for contractors, working for ${me.name ?? "the signed-in person"} at ${me.company} (role: ${me.role === "admin" ? "owner/admin" : "employee"}).`,
    "You act as them: you can look up their jobs and make changes with the tools, on their permissions. Do what they ask without asking for confirmation, unless the request is unclear; then ask one short question.",
    "Look things up with the tools rather than guessing. Use ids you got from a tool. When you change something, say in one short sentence what you did (\"Added task #7 on the kitchen sink, due today, tagged Marco.\").",
    "Keep replies short and plain: they are often read aloud to someone on a job site. No tables, no headings, no long lists; at most a few short sentences.",
    "Never give out information beyond what the tools return for this person. Don't reveal anything about other companies, and don't repeat personal contact details unless this person is an admin and asked for them.",
    "Never say which AI model or company powers you; you are the Rorker assistant.",
    "Where things are: left and right of an object always mean as seen standing in front of it, facing it (the way you'd use a stove, a sink or a cabinet), not as seen on the plan. \"The cabinet right of the stove\" is the one at your right hand when you face the stove. Use whats_around to find it. Above and below mean height on the wall. North, south, east and west follow the plan (north is up). If two things still fit, ask one short question naming them by where they are.",
    "Numbers: every cabinet and item has a number in its room, shown on the plan in a small round tag (orange for things on the floor, dark for wall cabinets). When the person says \"cabinet 3\" or \"number 3\", it's that number in the room they mean (the one they're looking at, or the kitchen for cabinets); call it by its number back to them (\"Cabinet #3 is now 34\" wide.\").",
    "Changing the plan: you can add, move, turn, resize and remove furniture, appliances and fixtures, and rename rooms (room_layout first, then add_objects, change_object, remove_objects, rename_room). Walls, rooms' shapes, doors and windows can't be changed here yet: say so in one sentence and offer to add a task pin for it.",
    "Real things, real sizes: every object has a real width, depth, height, weight and mounting height, and drawings never show furniture heights, so add_objects fills in the usual ones for each kind. Pick the kind that is the actual thing (a computer is kind computer, never a box or other). A computer, monitor, laptop, printer, table lamp, microwave, coffee machine or TV sits on a desk, counter or sideboard, never on the floor: put it `on` that piece (add the desk first if the room has none, or ask). Chairs go at their desk or table facing it, bar stools at the counter or island facing it, sofas and armchairs face the TV, fireplace or coffee table, beds, cabinets, wardrobes and desks stand with their backs to a wall facing into the room, wall cabinets, mirrors, pictures and shelves hang on a wall at their usual height. Leave facing out and it is worked out that way; give it only when the person asks for something else.",
    "Something not in the kind list (a rowing machine, a pool table, a kayak rack): don't settle for a box. Work out from what you know (or look it up with web search when you can) what it really looks like, its real size and weight, then add it as kind other with its name and parts: simple boxes, cylinders and spheres at real sizes and colours that together look like the real thing. Only when you truly can't tell what it is, ask what it looks like.",
    "Sizes: always talk in feet and inches (13' 6\", a 36\" door) and square feet, never metres or millimetres. The tools work in millimetres: 1 inch is 25.4 mm and 1 foot is 304.8 mm, so turn what they say into mm for the tools and turn what the tools return into feet and inches (round to the nearest half inch) when you answer.",
    "Placing: the usual US layouts (width x depth): twin bed 38x75 in (965x1905 mm), full 54x75 in (1372x1905), queen 60x80 in (1524x2032), king 76x80 in (1930x2032), with a nightstand each side of a full or bigger; dining table 72x36 in (1830x915) for 6 or 48x30 in (1220x760) for 4 with a chair at each place; desk 48x24 in (1220x610) with an office chair; sofa facing the TV on a sideboard. Place things the way a designer would: keep about 36 in (915 mm) of walking space and never block a door or doorway. Only add what fits; leave other things as they are unless asked.",
    "Showing places: whenever you mention a room or spot the person has to pick between or find (\"which bedroom?\"), call point_at first so a coloured dot blinks on each one, then name them by where they are and by colour (\"the bedroom on the south side, blue dot, or the east one, green dot?\"). Rooms often share a name, so tell them apart by their side of the floor (find_in_plan says where each one is). After adding or moving something it is pointed at for you. Dots blink for 10 seconds and then go, so every time you refer to a place again (later in the chat too), call point_at again so it blinks again. Dots show in 2D and 3D on any floor, but the map doesn't move to them: when they're on a floor or view the person isn't looking at, the app adds a line saying where and a button to go there, so don't say you took them there.",
    // keep these two last: they change per request, and everything above them is cached
    `Today is ${today()}.`,
    ctx.jobId ? `They are looking at the job "${ctx.jobName ?? ctx.jobId}" (id ${ctx.jobId})${ctx.where ? `, at ${ctx.where}` : ""}${ctx.selected ? `, with ${ctx.selected} selected` : ""}. "This job", "here" and "this" refer to that.` : "They are on the jobs list.",
  ].join("\n");
}


// ---------------------------------------------------------------------------------------- where things are

// ------------------------------------------------------------------------------------------- items by number

/** An object's id from its id, or its number in a room ("3", "#3", "cabinet 3" with the room). */
function itemId(plan: Plan | null | undefined, ref: string, room: string): string {
  if (!plan || plan.floors.some((f) => f.fixtures.some((x) => x.id === ref))) return ref;
  const n = numberIn(ref);
  if (n == null) return ref;
  const want = norm(room || ref.replace(/#?\s*\d+\s*$/, "").replace(/\b(cabinet|item|number|no)\b/gi, ""));
  const hits: { id: string; where: string }[] = [];
  for (const f of plan.floors) {
    const nums = itemNumbers(f.fixtures, (x) => x.room_id);
    for (const [x, k] of nums) {
      if (k !== n) continue;
      const r = f.rooms.find((q) => q.id === x.room_id);
      if (want && !(r && (norm(r.name).includes(want) || norm(r.type).includes(want) || r.id.toLowerCase() === want))) continue;
      hits.push({ id: x.id, where: `${x.name} in ${r?.name ?? "no room"}` });
    }
  }
  if (hits.length === 1) return hits[0].id;
  if (!hits.length) throw new Error(`No #${n}${want ? ` in ${want}` : ""}. Use find_in_plan or room_layout.`);
  throw new Error(`There's a #${n} in more than one room (${hits.map((h) => h.where).join("; ")}). Say which room.`);
}

/** The room a cabinet has along its run: from the cabinet or wall on its one side to the one on the other. */
function runRoom(f: Plan["floors"][number], x: Plan["floors"][number]["fixtures"][number], nums: Map<Plan["floors"][number]["fixtures"][number], number>) {
  const call = (y: typeof x) => `${nums.has(y) ? `#${nums.get(y)} ` : ""}${y.name}`;
  const ax = widthAxis(x), a = ax === "x" ? 0 : 1, o = 1 - a;
  const hung = bottomOf(x) > 600;
  const lo0 = x.bbox[a], hi0 = x.bbox[a + 2], c = (lo0 + hi0) / 2;
  const r = f.rooms.find((q) => q.id === x.room_id);
  const rb = r ? bboxOf(r.polygon) : null;
  let lo = rb ? rb[a] + 60 : -Infinity, hi = rb ? rb[a + 2] - 60 : Infinity, left = "the wall", right = "the wall";
  let lx: typeof x | null = null, rx: typeof x | null = null;
  for (const y of f.fixtures) {
    if (y === x || y.kind === "door_leaf" || y.kind === "part" || y.room_id !== x.room_id || y.on === x.id) continue;
    if ((bottomOf(y) > 600) !== hung) continue;
    // in the same run: overlapping it front to back
    if (Math.min(y.bbox[o + 2], x.bbox[o + 2]) - Math.max(y.bbox[o], x.bbox[o]) < 50) continue;
    if (y.bbox[a + 2] <= c && y.bbox[a + 2] > lo) { lo = y.bbox[a + 2]; left = call(y); lx = y; }
    if (y.bbox[a] >= c && y.bbox[a] < hi) { hi = y.bbox[a]; right = call(y); rx = y; }
  }
  // the cabinets either side, which could give up some width
  const next = [lx, rx].filter((y): y is typeof x => !!y?.cab).map((y) => ({ name: call(y), w: y.bbox[a + 2] - y.bbox[a] }));
  if (!Number.isFinite(lo)) lo = lo0;
  if (!Number.isFinite(hi)) hi = hi0;
  return { lo, hi, c, w: hi0 - lo0, left, right, next };
}

const HEAD = ["east", "south", "west", "north"];
/** A compass word for a direction in the plan frame (x right, y down, north up). */
const heading = (dx: number, dy: number) => HEAD[((Math.round(Math.atan2(dy, dx) / (Math.PI / 2)) % 4) + 4) % 4];

/** The way an object's front faces, as a unit vector: its own facing, or else away from the nearest wall of its room. */
function frontOf(fl: Plan["floors"][number], f: Plan["floors"][number]["fixtures"][number]): [number, number] {
  if (f.facing != null) { const r = (f.facing * Math.PI) / 180; return [Math.cos(r), Math.sin(r)]; }
  const room = fl.rooms.find((r) => r.id === f.room_id);
  if (!room) return [0, 1];
  let best: { d: number; n: [number, number] } | null = null;
  for (const sd of roomSides(fl, room)) {
    const ux = (sd.b[0] - sd.a[0]) / sd.length, uy = (sd.b[1] - sd.a[1]) / sd.length;
    const t = Math.max(0, Math.min(sd.length, (f.center[0] - sd.a[0]) * ux + (f.center[1] - sd.a[1]) * uy));
    const d = Math.hypot(f.center[0] - (sd.a[0] + ux * t), f.center[1] - (sd.a[1] + uy * t));
    if (!best || d < best.d) best = { d, n: [sd.inward[0], sd.inward[1]] };
  }
  return best?.n ?? [0, 1];
}

/** Gap between two boxes, mm (0 when they touch or overlap). */
const gap = (a: number[], b: number[]) => Math.round(Math.hypot(Math.max(0, a[0] - b[2], b[0] - a[2]), Math.max(0, a[1] - b[3], b[1] - a[3])));

function around(plan: Plan, id: string) {
  for (const fl of plan.floors) {
    const ref = fl.fixtures.find((x) => x.id === id);
    const op = ref ? null : fl.openings.find((x) => x.id === id);
    if (!ref && !op) continue;
    const c: [number, number] = ref ? ref.center : [(op!.a[0] + op!.b[0]) / 2, (op!.a[1] + op!.b[1]) / 2];
    const box = ref ? ref.bbox : [Math.min(op!.a[0], op!.b[0]), Math.min(op!.a[1], op!.b[1]), Math.max(op!.a[0], op!.b[0]), Math.max(op!.a[1], op!.b[1])];
    const roomId = ref ? ref.room_id : op!.room_ids[0] ?? null;
    // the front, and the right hand of someone standing in front of it looking at it (y is down)
    let n: [number, number];
    if (ref) n = frontOf(fl, ref);
    else { const room = fl.rooms.find((r) => r.id === roomId); const lp = room ? labelPoint(room.polygon) : c; const ux = op!.b[0] - op!.a[0], uy = op!.b[1] - op!.a[1], L = Math.hypot(ux, uy) || 1; let nx = -uy / L, ny = ux / L; if ((lp[0] - c[0]) * nx + (lp[1] - c[1]) * ny < 0) { nx = -nx; ny = -ny; } n = [nx, ny]; }
    const look: [number, number] = [-n[0], -n[1]];
    const right: [number, number] = [-look[1], look[0]];
    const near = fl.fixtures.filter((x) => x.id !== id && x.kind !== "door_leaf" && x.kind !== "part" && (x.room_id === roomId || gap(x.bbox, box) < 600))
      .map((x) => {
        const vx = x.center[0] - c[0], vy = x.center[1] - c[1];
        const a = vx * right[0] + vy * right[1], f = vx * n[0] + vy * n[1];
        const side = Math.abs(a) >= Math.abs(f) * 0.8 ? (a > 0 ? "right" : "left") : f > 0 ? "in front" : "behind";
        const up = (x.elevation_mm ?? 0) >= 1000;
        return { id: x.id, what: x.name, side, ...(up ? { height: "up on the wall" } : {}), gap_mm: gap(x.bbox, box), centre_to_centre_mm: Math.round(Math.hypot(vx, vy)), along: a, up };
      })
      .filter((x) => x.gap_mm < 3500)
      .sort((p, q) => p.gap_mm - q.gap_mm || p.centre_to_centre_mm - q.centre_to_centre_mm);
    // "next to" means at the same height first: the base cabinet beside the range, not the wall cabinet above it
    const refUp = (ref?.elevation_mm ?? 0) >= 1000;
    const nextOn = (s: string) => {
      const all = near.filter((x) => x.side === s).sort((p, q) => Math.abs(p.along) - Math.abs(q.along));
      return all.find((x) => x.up === refUp) ?? all[0] ?? null;
    };
    const label = (x: { id: string; what: string; gap_mm: number } | null) => (x ? `${x.what} (${x.id}), ${x.gap_mm ? `${inches(x.gap_mm)} away` : "touching"}` : "nothing");
    return {
      reference: `${ref ? ref.name : op!.name} (${id}), front faces ${heading(n[0], n[1])}`,
      how_to_read: "Left and right are as seen standing in front of it, facing it.",
      next_on_the_right: label(nextOn("right")), next_on_the_left: label(nextOn("left")),
      nearby: near.slice(0, 12).map(({ along: _a, up: _u, ...x }) => x), // eslint-disable-line @typescript-eslint/no-unused-vars
    };
  }
  return null;
}

// ---------------------------------------------------------------------------------------- running

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function resolveJob(b: AssistantBackend, ctx: AssistantContext, ref: unknown): Promise<JobBundle> {
  const want = str(ref);
  let id = want || ctx.jobId || "";
  if (want) {
    const jobs = await b.listJobs();
    const hit = jobs.find((j) => j.id === want) ?? jobs.find((j) => norm(j.name) === norm(want)) ?? jobs.find((j) => norm(j.name).includes(norm(want)) || norm(want).includes(norm(j.name)));
    if (!hit) throw new Error(`No job called "${want}" that you can see. Use list_jobs.`);
    id = hit.id;
  }
  if (!id) throw new Error("Which job? Use list_jobs and pass its id.");
  const bundle = await b.loadJob(id);
  if (!bundle) throw new Error("That job doesn't exist or you can't open it.");
  // everything reads the plan as it is now, with the app's changes on top of the drawing
  return bundle.plan ? { ...bundle, plan: applyEdits(bundle.plan, bundle.edits ?? {}) } : bundle;
}

function where(plan: Plan | null, p: Pin): string {
  if (!plan) return "";
  if (p.anchor?.view === "site") return "on the site";
  if (p.anchor?.view === "exterior" || p.anchor?.view === "point") return "outside the building";
  if (p.anchor?.view === "wall" && p.anchor.side) {
    const room = findElement(plan, p.anchor.side.split(":")[0]);
    return room ? `on a wall of ${elementLabel(room)}` : "on a wall";
  }
  const e = p.element_id ? findElement(plan, p.element_id) : null;
  if (!e) return p.floor_id ? plan.floors.find((f) => f.id === p.floor_id)?.name ?? "" : "";
  const room = roomOf(e);
  const r = room && room !== e.el.id ? findElement(plan, room) : null;
  return `${elementLabel(e)} (${e.el.id})${r ? ` in ${elementLabel(r)}` : ""}, ${e.floor.name}`;
}

function matchMembers(members: Member[], names: unknown): { ids: string[]; unknown: string[] } {
  const list = Array.isArray(names) ? names.map(str).filter(Boolean) : [];
  const ids: string[] = [], unknown: string[] = [];
  for (const n of list) {
    const m = members.find((x) => norm(x.full_name) === norm(n)) ?? members.find((x) => norm(x.full_name).split(" ").includes(norm(n).split(" ")[0]));
    if (m) ids.push(m.id); else unknown.push(n);
  }
  return { ids: [...new Set(ids)], unknown };
}

/** A room by id or name ("kitchen", "Bedroom 2", "G-R04"). */
function findRoom(plan: Plan | null, ref: unknown): { f: Plan["floors"][number]; r: Plan["floors"][number]["rooms"][number] } {
  if (!plan) throw new Error("This job has no plan yet.");
  const raw = str(ref);
  if (!raw) throw new Error("Which room? Give its name or id.");
  // "Closet (Level 1)": the room's name, then which floor
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(raw);
  const onFloor = m ? plan.floors.filter((f) => norm(f.name) === norm(m[2])) : [];
  const want = norm(onFloor.length ? m![1] : raw);
  const all = (onFloor.length ? onFloor : plan.floors).flatMap((f) => f.rooms.map((r) => ({ f, r })));
  const hit = all.find((x) => x.r.id.toLowerCase() === raw.toLowerCase()) ?? all.find((x) => norm(x.r.name) === want) ?? all.find((x) => norm(x.r.name).includes(want) || (want && want.includes(norm(x.r.name))));
  if (!hit) throw new Error(`No room like "${raw}". Rooms: ${all.map((x) => `${x.r.name} (${x.r.id}, ${x.f.name})`).join(", ")}.`);
  return hit;
}

/** Which part of its floor a point is in: "the south-east of Level 1". */
function partOf(fl: Plan["floors"][number], p: [number, number]): string {
  const [x0, y0, x1, y1] = fl.bounds;
  const fx = (p[0] - x0) / Math.max(1, x1 - x0), fy = (p[1] - y0) / Math.max(1, y1 - y0);
  const ns = fy < 0.38 ? "north" : fy > 0.62 ? "south" : "", ew = fx < 0.38 ? "west" : fx > 0.62 ? "east" : "";
  return `the ${ns && ew ? `${ns}-${ew}` : ns || ew || "middle"} of ${fl.name}`;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const facingWord = (deg: number | null | undefined) => (deg == null ? null : heading(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)));

/** Parts the model described, checked and capped. */
function readParts(v: unknown): Part[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 40).flatMap((q) => {
    if (!q || typeof q !== "object") return [];
    const o = q as Record<string, unknown>;
    const shape = o.shape === "cylinder" || o.shape === "sphere" ? o.shape : "box";
    const w = Math.min(10000, Math.abs(num(o.w))), d = Math.min(10000, Math.abs(num(o.d))), h = Math.min(10000, Math.abs(num(o.h)));
    if (!w || !d || !h) return [];
    const color = typeof o.color === "string" && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : undefined;
    return [{ shape, x: num(o.x), y: Math.max(0, num(o.y)), z: num(o.z), w, d, h, ...(color ? { color } : {}) }];
  });
}


const date = (v: unknown) => { const s = str(v); if (!s) return undefined; if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Dates are YYYY-MM-DD."); return s; };

/** Run one tool for the assistant. Returns small plain data; throws a message the model can act on. */
export async function runTool(b: AssistantBackend, ctx: AssistantContext, name: string, input: Record<string, unknown>, changed: Changes): Promise<unknown> {
  const admin = b.me.role === "admin";
  switch (name) {
    case "list_jobs": {
      const jobs = await b.listJobs();
      return Promise.all(jobs.slice(0, 40).map(async (j) => {
        const d = await b.loadJob(j.id);
        return { id: j.id, name: j.name, address: j.address, status: j.status, open_pins: d?.pins.filter((p) => p.status !== "done").length ?? 0, stage: d?.stages.find((s) => s.status === "active")?.name ?? null };
      }));
    }
    case "job_overview": {
      const d = await resolveJob(b, ctx, input.job);
      const members = await b.members();
      const names = (ids: string[]) => ids.map((id) => members.find((m) => m.id === id)?.full_name).filter(Boolean);
      return {
        id: d.job.id, name: d.job.name, address: d.job.address, type: d.job.job_type, status: d.job.status,
        ...(admin ? { client: d.job.client_name, client_email: d.job.client_email, client_phone: d.job.client_phone } : {}),
        stages: d.stages.map((s) => ({ name: s.name, status: s.status })),
        floors: d.plan?.floors.map((f) => ({ id: f.id, name: f.name, rooms: f.rooms.map((r) => ({ id: r.id, name: r.name, type: r.type, sq_ft: Math.round(r.area_m2 * 10.7639), where: partOf(f, labelPoint(r.polygon)) })) })) ?? [],
        open_pins: d.pins.filter((p) => p.status !== "done").map((p) => ({ number: p.number, kind: p.kind, title: p.title, status: p.status, due: p.due_date, tagged: names(p.tagged), where: where(d.plan, p) })),
        done_pins: d.pins.filter((p) => p.status === "done").length,
      };
    }
    case "find_in_plan": {
      const d = await resolveJob(b, ctx, input.job);
      if (!d.plan) return "This job has no plan yet.";
      const q = norm(str(input.query).replace(/#\s*(\d+)/g, " no$1 "));
      const words = q.split(" ").filter(Boolean);
      const out: { id: string; what: string; room: string | null; floor: string; score: number }[] = [];
      for (const f of d.plan.floors) {
        const roomName = (id: string | null) => (id ? f.rooms.find((r) => r.id === id)?.name ?? null : null);
        const consider = (id: string, label: string, kind: string, room: string | null) => {
          const hay = norm(`${label} ${kind} ${room ?? ""} ${id} ${f.name}`);
          const score = id.toLowerCase() === q ? 100 : words.filter((w) => hay.includes(w)).length;
          if (score > 0 && score >= Math.min(words.length, 2)) out.push({ id, what: `${label}${kind && !norm(label).includes(norm(kind)) ? ` (${kind.replace(/_/g, " ")})` : ""}`, room, floor: f.name, score });
        };
        for (const r of f.rooms) consider(r.id, `${r.name}, in ${partOf(f, labelPoint(r.polygon))}`, `room ${r.type}`, null);
        const nums = itemNumbers(f.fixtures, (x) => x.room_id);
        for (const x of f.fixtures) if (x.kind !== "door_leaf" && x.kind !== "part") { const n = frontOf(f, x), no = nums.get(x); consider(x.id, `${no ? `#${no} ` : ""}${x.name}, front faces ${heading(n[0], n[1])}`, `${x.kind}${no ? ` ${no} no${no}` : ""}`, roomName(x.room_id)); }
        for (const o of f.openings) consider(o.id, o.name, o.kind, o.room_ids.map(roomName).filter(Boolean).join(" / ") || null);
      }
      return out.sort((a, b2) => b2.score - a.score).slice(0, 15).map(({ score: _s, ...r }) => r); // eslint-disable-line @typescript-eslint/no-unused-vars
    }
    case "add_pin": {
      const d = await resolveJob(b, ctx, input.job);
      const kind = str(input.kind) as PinKind;
      if (!PIN_KINDS.includes(kind)) throw new Error("kind must be task, issue, note or material.");
      const title = str(input.title);
      if (!title) throw new Error("A pin needs a title.");
      const elementId = str(input.element_id) || null;
      const e = elementId && d.plan ? findElement(d.plan, elementId) : null;
      if (elementId && !e) throw new Error(`No ${elementId} in this plan. Use find_in_plan.`);
      const { ids, unknown } = matchMembers(await b.members(), input.tag);
      const pin = await b.createPin(d.job.id, {
        kind, title, body: str(input.details) || null, element_id: elementId, floor_id: e?.floor.id ?? null,
        due_date: date(input.due_date) ?? today(), tagged: ids, priority: input.high_priority ? 2 : 1, close_requirement: input.photo_request ? "photo" : "confirm",
      });
      changed.any = true;
      return { added: `#${pin.number}`, where: where(d.plan, pin), due: pin.due_date, tagged: ids.length, ...(unknown.length ? { not_on_team: unknown } : {}) };
    }
    case "update_pin": {
      const d = await resolveJob(b, ctx, input.job);
      const n = Number(input.pin_number);
      const pin = d.pins.find((p) => p.number === n);
      if (!pin) throw new Error(`No pin #${n} on ${d.job.name}.`);
      const patch: Partial<PinInput> & { status?: PinStatus } = {};
      if (input.status) {
        const s = str(input.status) as PinStatus;
        if (!["open", "in_progress", "done"].includes(s)) throw new Error("status must be open, in_progress or done.");
        patch.status = s;
      }
      if (str(input.title)) patch.title = str(input.title);
      if (input.details !== undefined) patch.body = str(input.details) || null;
      const due = date(input.due_date);
      if (due) patch.due_date = due;
      let unknown: string[] = [];
      if (Array.isArray(input.tag)) { const m = matchMembers(await b.members(), input.tag); patch.tagged = m.ids; unknown = m.unknown; }
      if (!Object.keys(patch).length) return "Nothing to change.";
      await b.updatePin(d.job.id, pin.id, patch);
      changed.any = true;
      return { updated: `#${n}`, ...patch, ...(unknown.length ? { not_on_team: unknown } : {}) };
    }
    case "set_stage": {
      const d = await resolveJob(b, ctx, input.job);
      const want = norm(str(input.stage));
      const st = d.stages.find((s) => norm(s.name) === want) ?? d.stages.find((s) => norm(s.name).includes(want) || want.includes(norm(s.name)));
      if (!st) throw new Error(`No stage like "${str(input.stage)}". Stages: ${d.stages.map((s) => s.name).join(", ")}.`);
      const status = str(input.status) as StageStatus;
      if (!["not_started", "active", "done"].includes(status)) throw new Error("status must be not_started, active or done.");
      await b.setStageStatus(d.job.id, st.id, status);
      changed.any = true;
      return { stage: st.name, status };
    }
    case "set_build_status": {
      const d = await resolveJob(b, ctx, input.job);
      const id = str(input.element_id);
      const e = d.plan ? findElement(d.plan, id) : null;
      if (!e) throw new Error(`No ${id} in this plan. Use find_in_plan.`);
      const s = str(input.status);
      const allowed = ["not_built", "in_progress", "done", "existing", "demolish"];
      if (s !== "clear" && !allowed.includes(s)) throw new Error(`status must be one of ${allowed.join(", ")} or clear.`);
      await b.setElementState(d.job.id, id, s === "clear" ? null : (s as ElementStatus));
      changed.any = true;
      return { element: `${elementLabel(e)} (${id})`, status: s };
    }
    case "add_wall_item": {
      const d = await resolveJob(b, ctx, input.job);
      if (!d.plan) throw new Error("This job has no plan yet.");
      const want = norm(str(input.room));
      let found: { f: Plan["floors"][number]; r: Plan["floors"][number]["rooms"][number] } | null = null;
      for (const f of d.plan.floors) for (const r of f.rooms) if (!found && (r.id.toLowerCase() === str(input.room).toLowerCase() || norm(r.name) === want)) found = { f, r };
      if (!found) for (const f of d.plan.floors) for (const r of f.rooms) if (!found && norm(r.name).includes(want)) found = { f, r };
      if (!found) throw new Error(`No room like "${str(input.room)}". Use job_overview for room ids.`);
      const sides = roomSides(found.f, found.r);
      const w = norm(str(input.wall));
      const side = sides.find((s) => norm(s.label) === w) ?? sides.find((s) => norm(s.label).startsWith(w)) ?? sides.find((s) => w.includes(s.heading));
      if (!side) throw new Error(`Walls in ${found.r.name}: ${sides.map((s) => s.label).join(", ")}.`);
      const kind = str(input.kind) as ItemKind;
      if (!ITEM_KINDS.includes(kind)) throw new Error(`kind must be one of ${ITEM_KINDS.join(", ")}.`);
      const typical: Record<string, number> = { outlet: 400, switch: 1200, light: 1750, data: 400, plumbing: 550, vent: 2200, thermostat: 1500, mount: 1500, other: 1200 };
      const y = Number(input.height_mm) > 0 ? Math.min(6000, Number(input.height_mm)) : typical[kind];
      const x = Number(input.from_left_mm) >= 0 && input.from_left_mm != null ? Math.min(side.length, Number(input.from_left_mm)) : side.length / 2;
      const it = await b.createItem(d.job.id, { kind, label: str(input.label) || null, floor_id: found.f.id, side: side.key, x: Math.round(x), y: Math.round(y) });
      changed.any = true;
      return { added: kind, room: found.r.name, wall: side.label, height_mm: it.y, from_left_mm: it.x, wall_length_mm: Math.round(side.length) };
    }
    case "whats_around": {
      const d = await resolveJob(b, ctx, input.job);
      if (!d.plan) return "This job has no plan yet.";
      const r = around(d.plan, str(input.element_id));
      if (!r) throw new Error("Give the id of an object, door or window from find_in_plan.");
      return r;
    }
    case "room_layout": {
      const d = await resolveJob(b, ctx, input.job);
      const { f, r } = findRoom(d.plan, input.room);
      const [x0, y0, x1, y1] = bboxOf(r.polygon);
      return {
        room: `${r.name} (${r.id})`, floor: f.name, type: r.type, where: partOf(f, labelPoint(r.polygon)), ceiling_mm: f.height_mm || RULES.ceiling,
        inside_edges_mm: { west_x: x0 + 60, east_x: x1 - 60, north_y: y0 + 60, south_y: y1 - 60 },
        corners_mm: r.polygon,
        walls: roomSides(f, r).map((s) => ({
          wall: s.label, runs_from: s.a.map(Math.round), to: s.b.map(Math.round), length_mm: Math.round(s.length),
          doors_and_windows: s.segments.filter((g) => g.kind === "opening").map((g) => ({ id: g.id, what: (g.el as { kind: string }).kind.replace(/_/g, " "), from_mm: Math.round(g.from), to_mm: Math.round(g.to) })),
        })),
        objects: f.fixtures.filter((x) => x.room_id === r.id && x.kind !== "door_leaf" && x.kind !== "part").map((x, _i, all) => {
          const n = frontOf(f, x), sz = fixtureSize(x);
          const sup = supportOf(f.fixtures, x), bot = bottomOf(x);
          return {
            id: x.id, number: itemNumbers(all, () => r.id).get(x), what: x.name, ...(x.spec ? { code: x.spec } : {}), kind: x.kind, centre: x.center.map(Math.round), width_mm: Math.round(sz.width), depth_mm: Math.round(sz.depth), height_mm: Math.round(topOf(x) - bot), faces: heading(n[0], n[1]),
            ...(sup ? { sits_on: `${sup.name} (${sup.id}), top at ${Math.round(bot)} mm (${inches(bot)})` } : bot ? { bottom_above_floor_mm: Math.round(bot) } : {}), ...(weightOf(x) ? { weight_kg: weightOf(x) } : {}),
          };
        }),
      };
    }
    case "add_objects": {
      const d = await resolveJob(b, ctx, input.job);
      const { f, r } = findRoom(d.plan, input.room);
      const list = Array.isArray(input.objects) ? (input.objects as Record<string, unknown>[]).slice(0, 30) : [];
      if (!list.length) throw new Error("Give at least one object.");
      const [rx0, ry0, rx1, ry1] = bboxOf(r.polygon);
      const ex0 = rx0 + 60, ex1 = rx1 - 60, ey0 = ry0 + 60, ey1 = ry1 - 60; // the room's inside edges
      const taken = new Set(Object.keys(d.edits ?? {}).concat(f.fixtures.map((x) => x.id)));
      const here = [...f.fixtures]; // what's in the floor now, with this call's new pieces added as they go
      const fresh: string[] = [];
      const byRef = (ref: string) => here.find((x) => x.id === (/^new:\d+$/.test(ref) ? fresh[Number(ref.slice(4))] : ref)) ?? null;
      let n = 1;
      const added: unknown[] = [];
      const fit = (v: number, lo: number, hi: number) => (lo <= hi ? Math.min(hi, Math.max(lo, v)) : (lo + hi) / 2);
      const skipped: { what: string; problem: string }[] = [];
      for (const o of list) try {
        let kind = str(o.kind);
        const parts = readParts(o.parts);
        const said = str(o.name);
        // the catalogue's own word for it, even when the model picked "other" for a computer
        if (!OBJECT_KINDS.includes(kind) || kind === "other") kind = kindFor(kind) ?? kindFor(said) ?? (parts.length ? "other" : kind);
        if (kind === "other" && !parts.length) throw new Error(`"${said || "That"}" isn't one of the kinds I know. Build it as kind other with parts: simple shapes at its real size and colours, so it looks like the real thing, not a box.`);
        if (!OBJECT_KINDS.includes(kind)) throw new Error(`kind must be one of ${OBJECT_KINDS.join(", ")}.`);
        const spec = specOf(kind);
        const ext = parts.length ? { w: Math.max(...parts.map((q) => Math.abs(q.x) * 2 + q.w)), d: Math.max(...parts.map((q) => Math.abs(q.z) * 2 + q.d)), h: Math.max(...parts.map((q) => q.y + q.h)) } : null;
        const width = Math.max(20, num(o.width_mm) || ext?.w || spec?.w || 600), depth = Math.max(10, num(o.depth_mm) || ext?.d || spec?.d || 600);
        const height = num(o.height_mm) || ext?.h || spec?.h || 850;
        const name = said || spec?.label || kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
        let x = num(o.x) || null, y = num(o.y) || null;
        let facing: number | null = str(o.facing) in FACING ? FACING[str(o.facing)] : null;
        let elevation = 0;
        let on: { id: string; at: [number, number] } | null = null;
        let where = "";
        const dims = (fc: number | null) => { const across = fc === 0 || fc === 180; return { hx: (across ? depth : width) / 2, hy: (across ? width : depth) / 2 }; };
        const vec = (fc: number): [number, number] => [Math.round(Math.cos((fc * Math.PI) / 180)), Math.round(Math.sin((fc * Math.PI) / 180))];
        const clearSpot = (fc: number | null, loose: boolean) => {
          const solid = here.filter((q) => q.room_id === r.id && q.kind !== "rug" && bottomOf(q) < 400 && !["wall", "ceiling"].includes(specOf(q.kind)?.mount ?? ""));
          const clash = (cx: number, cy: number, hx: number, hy: number) => solid.reduce((sum, q) =>
            sum + Math.max(0, Math.min(cx + hx + 50, q.bbox[2]) - Math.max(cx - hx - 50, q.bbox[0])) * Math.max(0, Math.min(cy + hy + 50, q.bbox[3]) - Math.max(cy - hy - 50, q.bbox[1])), 0);
          const walls: { at: [number, number]; facing: number | null }[] = [], open: typeof walls = [];
          for (const wf of fc != null ? [fc] : [90, -90, 0, 180]) {
            const { hx, hy } = dims(wf), side = wf === 0 || wf === 180;
            const lo = side ? ey0 + hy : ex0 + hx, hi = side ? ey1 - hy : ex1 - hx;
            if (lo > hi) continue;
            const fixed = wf === 90 ? ey0 + hy + 20 : wf === -90 ? ey1 - hy - 20 : wf === 0 ? ex0 + hx + 20 : ex1 - hx - 20;
            for (let k = 0; k <= (hi - lo) / 100; k++) {
              const t = (lo + hi) / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 100;
              if (t >= lo && t <= hi) walls.push({ at: side ? [fixed, t] : [t, fixed], facing: wf });
            }
          }
          for (let gx = ex0 + 200; gx <= ex1 - 200; gx += 200) for (let gy = ey0 + 200; gy <= ey1 - 200; gy += 200) open.push({ at: [gx, gy], facing: fc });
          open.sort((p, q) => Math.hypot(p.at[0] - (ex0 + ex1) / 2, p.at[1] - (ey0 + ey1) / 2) - Math.hypot(q.at[0] - (ex0 + ex1) / 2, q.at[1] - (ey0 + ey1) / 2));
          let best = { at: [(ex0 + ex1) / 2, (ey0 + ey1) / 2] as [number, number], facing: fc }, least = Infinity;
          for (const c of loose ? [...open, ...walls] : [...walls, ...open]) {
            const { hx, hy } = dims(c.facing), v = clash(c.at[0], c.at[1], hx, hy);
            if (v < least) { least = v; best = c; }
            if (!v) break;
          }
          return { ...best, crowded: least > 0 };
        };

        // what it stands on: the piece named, else the nearest suitable one in the room
        let sup = str(o.on) ? byRef(str(o.on)) : null;
        if (str(o.on) && !sup) throw new Error(`No ${str(o.on)} in ${r.name} to put it on. Use room_layout for ids.`);
        if (!sup && spec?.mount === "surface") {
          const cands = here.filter((q) => q.room_id === r.id && spec.on?.includes(q.kind));
          cands.sort((p, q) => spec.on!.indexOf(p.kind) - spec.on!.indexOf(q.kind) || (x != null && y != null ? Math.hypot(p.center[0] - x, p.center[1] - y!) - Math.hypot(q.center[0] - x, q.center[1] - y!) : 0));
          sup = cands[0] ?? null;
          if (!sup && !spec.at) throw new Error(`A ${name.toLowerCase()} sits on a ${spec.on!.slice(0, 3).join(" or ").replace(/_/g, " ")}, and ${r.name} has none. Add one first (then put it on it), or ask where it should go.`);
        }
        if (sup) {
          // on top of it, facing whoever uses it, toward the back when it's a screen or a machine
          const sf = sup.facing ?? naturalFacing(f, here, sup) ?? 90;
          if (facing == null) facing = str(o.face_toward) && byRef(str(o.face_toward)) ? toward({ center: sup.center }, byRef(str(o.face_toward))!) : sf;
          const sz = fixtureSize({ ...sup, facing: sf }), fv = vec(sf), rv: [number, number] = [-fv[1], fv[0]];
          const { hx, hy } = dims(facing);
          if (x == null || y == null || x < sup.bbox[0] || x > sup.bbox[2] || y < sup.bbox[1] || y > sup.bbox[3]) {
            const back = spec?.back ? sz.depth / 2 - depth / 2 - 40 : 0;
            const sideways = spec?.back ? 0 : Math.max(0, sz.width / 2 - width / 2 - 80) * (kind === "table_lamp" ? 1 : 0.5);
            x = sup.center[0] - fv[0] * back + rv[0] * sideways; y = sup.center[1] - fv[1] * back + rv[1] * sideways;
          }
          x = fit(x, sup.bbox[0] + hx, sup.bbox[2] - hx); y = fit(y, sup.bbox[1] + hy, sup.bbox[3] - hy);
          elevation = topOf(sup);
          on = { id: sup.id, at: sup.center };
          where = `on ${sup.name} (${sup.id}), ${inches(elevation)} up`;
        } else if (spec?.mount === "wall" || spec?.mount === "ceiling" || (spec?.mount === "surface" && spec.at)) {
          elevation = num(o.height_above_floor_mm) || (spec.mount === "ceiling" ? (f.height_mm || RULES.ceiling) - height - 50 : spec.at ?? 1200);
          if (spec.mount !== "ceiling") {
            // flat against the nearest wall, facing into the room
            const px = x ?? (ex0 + ex1) / 2, py = y ?? ey0;
            const ds: [number, number][] = [[px - ex0, 0], [ex1 - px, 180], [py - ey0, 90], [ey1 - py, -90]];
            const wall = facing != null ? ds.find((q) => q[1] === facing)! : ds.sort((p, q) => p[0] - q[0])[0];
            facing = wall[1];
            const { hx, hy } = dims(facing);
            x = facing === 0 ? ex0 + hx : facing === 180 ? ex1 - hx : fit(px, ex0 + hx, ex1 - hx);
            y = facing === 90 ? ey0 + hy : facing === -90 ? ey1 - hy : fit(py, ey0 + hy, ey1 - hy);
            where = `on the ${heading(-vec(facing)[0], -vec(facing)[1])} wall, bottom ${inches(elevation)} up`;
          } else where = `hanging from the ceiling, bottom ${inches(elevation)} up`;
        } else {
          if (num(o.height_above_floor_mm)) elevation = num(o.height_above_floor_mm);
          const partner = str(o.face_toward) ? byRef(str(o.face_toward)) : spec?.face === "to" ? partnerOf(here, { ...addedFixture("probe", { floor_id: f.id, room_id: r.id, kind, name, center: [x ?? (ex0 + ex1) / 2, y ?? (ey0 + ey1) / 2], width, depth, facing: null }) }, spec.to ?? [], x == null ? 20000 : kind === "sofa" || kind === "armchair" ? 4000 : 1500) : null;
          if (str(o.face_toward) && !partner) throw new Error(`No ${str(o.face_toward)} to face. Use room_layout for ids.`);
          // a chair or stool with no spot given goes at its partner's front, where you'd sit
          if ((x == null || y == null) && partner) {
            const pf = partner.facing ?? naturalFacing(f, here, partner);
            const pv = pf == null ? [0, 1] : vec(pf), ps = fixtureSize({ ...partner, facing: pf });
            const reach = (pf == null ? (partner.bbox[3] - partner.bbox[1]) / 2 : ps.depth / 2) + depth / 2 - (kind === "sofa" || kind === "armchair" ? -700 : 120);
            x = partner.center[0] + pv[0] * reach; y = partner.center[1] + pv[1] * reach;
          }
          // nowhere given: the first clear spot, backed up to a wall when it stands that way
          if ((x == null || y == null) && !partner) {
            const spot = clearSpot(facing, spec?.face === "any");
            x = spot.at[0]; y = spot.at[1];
            if (facing == null) facing = spot.facing;
            if (spot.crowded) where = "no clear floor left in the room, so it overlaps something: tell the person and ask where it should go";
          }
          x ??= (ex0 + ex1) / 2; y ??= (ey0 + ey1) / 2;
          if (facing == null && partner) facing = toward({ center: [x, y] }, partner);
          if (facing == null) facing = naturalFacing(f, here, addedFixture("probe", { floor_id: f.id, room_id: r.id, kind, name, center: [x, y], width, depth, facing: null }));
          const { hx, hy } = dims(facing);
          x = fit(x!, ex0 + hx, ex1 - hx); y = fit(y!, ey0 + hy, ey1 - hy);
          // backed up to its wall when it's close: 20 mm off, the way it would really stand
          if (facing != null && spec?.face === "room") {
            if (facing === 90 && y - hy - ey0 < 300) y = ey0 + hy + 20;
            if (facing === -90 && ey1 - (y + hy) < 300) y = ey1 - hy - 20;
            if (facing === 0 && x - hx - ex0 < 300) x = ex0 + hx + 20;
            if (facing === 180 && ex1 - (x + hx) < 300) x = ex1 - hx - 20;
          }
          if (partner) where = `facing ${partner.name} (${partner.id})`;
        }
        x ??= (ex0 + ex1) / 2; y ??= (ey0 + ey1) / 2;
        while (taken.has(`${f.id}-N${String(n).padStart(2, "0")}`)) n++;
        const id = `${f.id}-N${String(n).padStart(2, "0")}`;
        taken.add(id);
        const obj = {
          floor_id: f.id, room_id: r.id, kind, name, center: [Math.round(x), Math.round(y)] as [number, number], width: Math.round(width), depth: Math.round(depth), facing,
          height_mm: Math.round(height), elevation_mm: Math.round(elevation), weight_kg: num(o.weight_kg) || null,
          ...(on ? { on: on.id, on_at: on.at } : {}), ...(parts.length ? { parts } : {}),
        };
        await b.saveEdit(d.job.id, id, { added: obj });
        here.push(addedFixture(id, obj));
        fresh.push(id);
        const kg = obj.weight_kg ?? spec?.kg ?? null;
        added.push({ id, what: name, kind, size: `${inches(obj.width)} wide x ${inches(obj.depth)} deep x ${inches(obj.height_mm)} high`, ...(kg ? { weight_kg: kg } : {}), faces: facingWord(facing) ?? "no particular way", ...(where ? { where } : {}) });
        changed.marks = [...(changed.marks ?? []), { floor_id: f.id, x: obj.center[0], y: obj.center[1], z: obj.elevation_mm + obj.height_mm, label: name, color: MARK_COLORS[5][1], id }];
      } catch (e) {
        // one that can't go in doesn't stop the rest
        if (list.length === 1) throw e;
        skipped.push({ what: str(o.name) || str(o.kind), problem: e instanceof Error ? e.message : String(e) });
      }
      if (!fresh.length) throw new Error(skipped.map((q) => q.problem).join(" "));
      changed.any = true;
      changed.focus = fresh.length === 1 ? fresh[0] : r.id;
      return { added, ...(skipped.length ? { not_added: skipped } : {}), room: `${r.name} (${r.id}), ${partOf(f, labelPoint(r.polygon))}` };
    }
    case "change_object": {
      const d = await resolveJob(b, ctx, input.job);
      const id = itemId(d.plan, str(input.element_id), str(input.room));
      const fl = d.plan?.floors.find((q) => q.fixtures.some((x) => x.id === id));
      const hit = fl?.fixtures.find((x) => x.id === id);
      if (!fl || !hit) throw new Error(`No object ${id} in this plan. Use find_in_plan or room_layout.`);
      const no = itemNumbers(fl.fixtures, (x) => x.room_id).get(hit);
      // a cabinet fits its run: a new width that runs into the next one or past the wall isn't made, the person picks
      const fit = hit.cab && num(input.width_mm) > 0 ? runRoom(fl, hit, itemNumbers(fl.fixtures, (x) => x.room_id)) : null;
      let shiftAlong = 0, gapNote: string | null = null;
      if (fit) {
        const want = Math.round(num(input.width_mm)), free = fit.hi - fit.lo;
        if (want > free + 2) {
          const stock = Math.floor(free / 76.2) * 76.2;
          return {
            not_changed: `${no ? `Cabinet #${no}` : hit.name} (${id}) can't be ${inches(want)} wide: there's ${inches(free)} for it between ${fit.left} and ${fit.right}.`,
            choices: [
              ...(free - fit.w > 6 ? [`Make it ${inches(free)} wide, made to order (fits exactly)`] : []),
              ...fit.next.filter((y) => y.w - (want - free) >= 228).map((y) => `Make ${y.name} ${inches(want - free)} narrower (${inches(y.w - (want - free))}) to make room`),
              ...(stock >= 228 && free - stock > 6 ? [`A stock ${inches(stock)} cabinet and a ${inches(free - stock)} filler`] : []),
              "Leave it as it is",
            ],
            ask: "Ask the person which they want, then call change_object again with that width.",
          };
        }
        // centred where it is when that fits, else slid to stay inside its run
        const c = fit.c, lo = Math.max(fit.lo, Math.min(c - want / 2, fit.hi - want));
        shiftAlong = Math.round(lo + want / 2 - c);
        const gap = Math.round(free - want);
        if (want < fit.w - 2 && gap > 6) gapNote = `leaves ${inches(gap)} open in the run: offer a filler, or to slide the cabinets next to it over`;
      }
      if (shiftAlong) {
        const ax = widthAxis(hit);
        input = { ...input, [ax === "x" ? "move_east_mm" : "move_south_mm"]: num(input[ax === "x" ? "move_east_mm" : "move_south_mm"]) + shiftAlong };
      }
      if (hit.cab && num(input.height_mm) > 0 && bottomOf(hit) + num(input.height_mm) > (fl.height_mm || RULES.ceiling)) {
        return { not_changed: `${no ? `Cabinet #${no}` : hit.name} can't be ${inches(num(input.height_mm))} tall: it would go through the ceiling (${inches((fl.height_mm || RULES.ceiling) - bottomOf(hit))} above its bottom).` };
      }
      const find = (ref: string) => fl.fixtures.find((x) => x.id === ref) ?? null;
      const prev = d.edits?.[id] ?? {};
      const next: ElementEdit = { ...prev };
      let dx = num(input.move_east_mm), dy = num(input.move_south_mm);
      if (input.to_x != null) dx = num(input.to_x) - hit.center[0];
      if (input.to_y != null) dy = num(input.to_y) - hit.center[1];
      let facing: number | null = str(input.facing) in FACING ? FACING[str(input.facing)] : null;
      const sup = str(input.on) ? find(str(input.on)) : null;
      if (str(input.on) && !sup) throw new Error(`No ${str(input.on)} to put it on. Use room_layout for ids.`);
      if (sup) { dx = sup.center[0] - hit.center[0]; dy = sup.center[1] - hit.center[1]; if (facing == null) facing = sup.facing ?? naturalFacing(fl, fl.fixtures, sup); }
      if (str(input.face_toward)) {
        const t = find(str(input.face_toward));
        if (!t) throw new Error(`No ${str(input.face_toward)} to face. Use room_layout for ids.`);
        facing = toward({ center: [hit.center[0] + dx, hit.center[1] + dy] }, t);
      }
      const lift = sup ? topOf(sup) : num(input.height_above_floor_mm) || null;
      if (prev.added) {
        // an object added in the app: change it where it was made, so it keeps sitting on what it sits on
        const a = { ...prev.added };
        a.center = [Math.round(a.center[0] + dx), Math.round(a.center[1] + dy)];
        if (facing != null) a.facing = facing;
        if (sup) { a.on = sup.id; a.on_at = sup.center; }
        if (lift != null) { a.elevation_mm = lift; if (!sup) { a.on = null; a.on_at = null; } }
        if (num(input.width_mm) > 0) a.width = Math.round(num(input.width_mm));
        if (num(input.depth_mm) > 0) a.depth = Math.round(num(input.depth_mm));
        if (num(input.height_mm) > 0) a.height_mm = Math.round(num(input.height_mm));
        if (num(input.weight_kg) > 0) a.weight_kg = num(input.weight_kg);
        if (str(input.name)) a.name = str(input.name);
        next.added = a;
      } else {
        if (dx || dy) { next.dx = Math.round((prev.dx ?? 0) + dx); next.dy = Math.round((prev.dy ?? 0) + dy); }
        if (facing != null) next.facing = facing;
        if (lift != null) next.dz = Math.round((prev.dz ?? 0) + lift - bottomOf(hit));
        if (num(input.width_mm) > 0) next.width = Math.round(num(input.width_mm));
        if (num(input.depth_mm) > 0) next.depth = Math.round(num(input.depth_mm));
        if (num(input.height_mm) > 0) next.height_mm = Math.round(num(input.height_mm));
        if (str(input.name)) next.name = str(input.name);
      }
      await b.saveEdit(d.job.id, id, next);
      changed.any = true;
      changed.marks = [{ floor_id: fl.id, x: Math.round(hit.center[0] + dx), y: Math.round(hit.center[1] + dy), z: Math.round(lift ?? bottomOf(hit)) + Math.round(topOf(hit) - bottomOf(hit)), label: hit.name, color: MARK_COLORS[5][1], id }];
      changed.focus = id;
      return { changed: `${no ? `#${no} ` : ""}${hit.name} (${id})`, ...(num(input.width_mm) > 0 || num(input.depth_mm) > 0 || num(input.height_mm) > 0 ? { size: [num(input.width_mm) > 0 && `${inches(num(input.width_mm))} wide`, num(input.depth_mm) > 0 && `${inches(num(input.depth_mm))} deep`, num(input.height_mm) > 0 && `${inches(num(input.height_mm))} tall`].filter(Boolean).join(", ") } : {}), ...(gapNote ? { note: gapNote } : {}), ...(dx || dy ? { moved_east_mm: Math.round(dx), moved_south_mm: Math.round(dy) } : {}), ...(facing != null ? { faces: facingWord(facing) } : {}), ...(sup ? { now_on: `${sup.name} (${sup.id})` } : {}), ...(lift != null ? { bottom_above_floor_mm: Math.round(lift) } : {}) };
    }
    case "remove_objects": {
      const d = await resolveJob(b, ctx, input.job);
      const ids = Array.isArray(input.element_ids) ? input.element_ids.map(str).filter(Boolean) : [];
      const all = d.plan?.floors.flatMap((fl) => fl.fixtures) ?? [];
      const gone: string[] = [], missing: string[] = [];
      // what sits on a piece goes with it (the computer with its desk)
      const riding = all.filter((q) => q.on && ids.includes(q.on) && !ids.includes(q.id)).map((q) => q.id);
      for (const id of [...ids.slice(0, 60), ...riding]) {
        const x = all.find((q) => q.id === id);
        if (!x) { missing.push(id); continue; }
        const prev = d.edits?.[id];
        await b.saveEdit(d.job.id, id, prev?.added ? null : { ...prev, removed: true });
        gone.push(`${x.name} (${id})`);
      }
      if (gone.length) changed.any = true;
      return { removed: gone, ...(missing.length ? { not_found: missing } : {}) };
    }
    case "point_at": {
      const d = await resolveJob(b, ctx, input.job);
      if (!d.plan) return "This job has no plan yet.";
      const places = Array.isArray(input.places) ? (input.places as Record<string, unknown>[]).slice(0, 6) : [];
      const marks: Mark[] = [], out: unknown[] = [], missing: string[] = [];
      places.forEach((q, i) => {
        const id = str(q.id);
        const [cname, color] = MARK_COLORS[i % MARK_COLORS.length];
        const e = findElement(d.plan!, id);
        const m = e ? markFor(d.plan!, id, str(q.label) || elementLabel(e), color) : null;
        if (!m || !e) { missing.push(id); return; }
        marks.push(m);
        out.push({ id, what: elementLabel(e), dot: cname, floor: e.floor.name, where: partOf(e.floor, [m.x, m.y]) });
      });
      if (!marks.length) throw new Error(`None of ${missing.join(", ")} are in this plan. Use find_in_plan for ids.`);
      changed.marks = marks;
      changed.focus = str(input.open) || (marks.length === 1 ? marks[0].id : null);
      return { shown: out, ...(missing.length ? { not_found: missing } : {}), say: "Name each place by its dot colour." };
    }
    case "rename_room": {
      const d = await resolveJob(b, ctx, input.job);
      const { r } = findRoom(d.plan, input.room);
      const next: ElementEdit = { ...(d.edits?.[r.id] ?? {}) };
      if (str(input.name)) next.name = str(input.name);
      if (str(input.type)) next.type = str(input.type);
      await b.saveEdit(d.job.id, r.id, next);
      changed.any = true;
      return { room: r.id, name: next.name ?? r.name, type: next.type ?? r.type };
    }
    case "team": {
      const ms = await b.members();
      return ms.map((m) => ({ name: m.full_name, title: m.title, role: m.is_owner ? "owner" : m.role, ...(admin ? { email: m.email, phone: m.phone } : {}) }));
    }
    default:
      throw new Error(`Unknown tool ${name}.`);
  }
}
