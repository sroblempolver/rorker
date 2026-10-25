// The Rorker assistant: what it can do (tools), how it talks (instructions), and the code that runs
// each tool. The same tools run on the server (on the signed-in person's own permissions) and in the
// standalone preview (on the sample job), behind the AssistantBackend interface.
//
// Privacy is enforced here and in the backend, not left to the model: every lookup goes through the
// caller's own access (the backend only returns jobs this person can open), and the results are cut
// down to what their role may see. Employees never get client contact details or team phone numbers
// and emails. Nothing is fetched that the person couldn't see in the app themselves.
import type { ElementStatus, Plan } from "@/lib/plan/types";
import type { ItemInput, ItemKind, Job, JobItem, JobStage, Member, MemberRole, Pin, PinInput, PinKind, PinStatus, StageStatus } from "@/lib/data/types";
import { elementLabel, findElement, roomOf, roomSides } from "@/lib/plan/geometry";
import { today } from "@/lib/dates";

export interface JobBundle { job: Job; plan: Plan | null; pins: Pin[]; stages: JobStage[]; items: JobItem[]; states: { element_id: string; status: ElementStatus }[] }

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
}

/** Where the person is in the app when they ask, so "this job" and "here" mean something. */
export interface AssistantContext { jobId?: string | null; jobName?: string | null; where?: string | null; selected?: string | null }

export interface ToolSpec { name: string; description: string; input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] } }

const JOB = { type: "string", description: "The job: its id, or its name as the person says it (\"Hadley Road\"). Leave out for the job they're looking at." };
const PIN_KINDS = ["task", "issue", "note", "material"];
const ITEM_KINDS = ["outlet", "switch", "light", "data", "plumbing", "vent", "thermostat", "mount", "other"];

export const TOOLS: ToolSpec[] = [
  { name: "list_jobs", description: "List the jobs this person can see: id, name, address, status, open pins and current stage.", input_schema: { type: "object", properties: {} } },
  { name: "job_overview", description: "One job at a glance: stages, floors and rooms (with ids), open pins (number, kind, title, status, due date, who is tagged, where).", input_schema: { type: "object", properties: { job: JOB } } },
  { name: "find_in_plan", description: "Find rooms, walls, doors, windows and objects in a job's plan by name, kind, room or id (\"kitchen sink\", \"master bedroom\", \"G-F46\"). Returns ids to use with other tools.", input_schema: { type: "object", properties: { job: JOB, query: { type: "string" } }, required: ["query"] } },
  {
    name: "add_pin", description: "Add a pin (task, issue, note or material) to a job, on a room or object when given its id. Due date defaults to today. Tag people by name.",
    input_schema: { type: "object", properties: {
      job: JOB, kind: { type: "string", enum: PIN_KINDS }, title: { type: "string" }, details: { type: "string" },
      element_id: { type: "string", description: "Room, wall, door, window or object id from find_in_plan or job_overview" },
      due_date: { type: "string", description: "YYYY-MM-DD" }, tag: { type: "array", items: { type: "string" }, description: "Team members' names" }, high_priority: { type: "boolean" },
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
    `Today is ${today()}.`,
    ctx.jobId ? `They are looking at the job "${ctx.jobName ?? ctx.jobId}" (id ${ctx.jobId})${ctx.where ? `, at ${ctx.where}` : ""}${ctx.selected ? `, with ${ctx.selected} selected` : ""}. "This job", "here" and "this" refer to that.` : "They are on the jobs list.",
  ].join("\n");
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
  return bundle;
}

function where(plan: Plan | null, p: Pin): string {
  if (!plan) return "";
  if (p.anchor?.view === "site") return "on the site";
  if (p.anchor?.view === "exterior") return "outside the building";
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

const date = (v: unknown) => { const s = str(v); if (!s) return undefined; if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Dates are YYYY-MM-DD."); return s; };

/** Run one tool for the assistant. Returns small plain data; throws a message the model can act on. */
export async function runTool(b: AssistantBackend, ctx: AssistantContext, name: string, input: Record<string, unknown>, changed: { any: boolean }): Promise<unknown> {
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
        floors: d.plan?.floors.map((f) => ({ id: f.id, name: f.name, rooms: f.rooms.map((r) => ({ id: r.id, name: r.name, type: r.type, m2: Math.round(r.area_m2 * 10) / 10 })) })) ?? [],
        open_pins: d.pins.filter((p) => p.status !== "done").map((p) => ({ number: p.number, kind: p.kind, title: p.title, status: p.status, due: p.due_date, tagged: names(p.tagged), where: where(d.plan, p) })),
        done_pins: d.pins.filter((p) => p.status === "done").length,
      };
    }
    case "find_in_plan": {
      const d = await resolveJob(b, ctx, input.job);
      if (!d.plan) return "This job has no plan yet.";
      const q = norm(str(input.query));
      const words = q.split(" ").filter(Boolean);
      const out: { id: string; what: string; room: string | null; floor: string; score: number }[] = [];
      for (const f of d.plan.floors) {
        const roomName = (id: string | null) => (id ? f.rooms.find((r) => r.id === id)?.name ?? null : null);
        const consider = (id: string, label: string, kind: string, room: string | null) => {
          const hay = norm(`${label} ${kind} ${room ?? ""} ${id} ${f.name}`);
          const score = id.toLowerCase() === q ? 100 : words.filter((w) => hay.includes(w)).length;
          if (score > 0 && score >= Math.min(words.length, 2)) out.push({ id, what: `${label}${kind && !norm(label).includes(norm(kind)) ? ` (${kind.replace(/_/g, " ")})` : ""}`, room, floor: f.name, score });
        };
        for (const r of f.rooms) consider(r.id, r.name, `room ${r.type}`, null);
        for (const x of f.fixtures) if (x.kind !== "door_leaf" && x.kind !== "part") consider(x.id, x.name, x.kind, roomName(x.room_id));
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
        due_date: date(input.due_date) ?? today(), tagged: ids, priority: input.high_priority ? 2 : 1,
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
    case "team": {
      const ms = await b.members();
      return ms.map((m) => ({ name: m.full_name, title: m.title, role: m.is_owner ? "owner" : m.role, ...(admin ? { email: m.email, phone: m.phone } : {}) }));
    }
    default:
      throw new Error(`Unknown tool ${name}.`);
  }
}
