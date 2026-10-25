// Generated from web/src/lib/assistant/core.ts by web/preview/build-function.mjs. Do not edit.

// src/lib/dates.ts
function today(d = /* @__PURE__ */ new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// src/lib/assistant/core.ts
var JOB = { type: "string", description: `The job: its id, or its name as the person says it ("Hadley Road"). Leave out for the job they're looking at.` };
var PIN_KINDS = ["task", "issue", "note", "material"];
var ITEM_KINDS = ["outlet", "switch", "light", "data", "plumbing", "vent", "thermostat", "mount", "other"];
var TOOLS = [
  { name: "list_jobs", description: "List the jobs this person can see: id, name, address, status, open pins and current stage.", input_schema: { type: "object", properties: {} } },
  { name: "job_overview", description: "One job at a glance: stages, floors and rooms (with ids), open pins (number, kind, title, status, due date, who is tagged, where).", input_schema: { type: "object", properties: { job: JOB } } },
  { name: "find_in_plan", description: `Find rooms, walls, doors, windows and objects in a job's plan by name, kind, room or id ("kitchen sink", "master bedroom", "G-F46"). Returns ids to use with other tools.`, input_schema: { type: "object", properties: { job: JOB, query: { type: "string" } }, required: ["query"] } },
  {
    name: "add_pin",
    description: "Add a pin (task, issue, note or material) to a job, on a room or object when given its id. Due date defaults to today. Tag people by name.",
    input_schema: { type: "object", properties: {
      job: JOB,
      kind: { type: "string", enum: PIN_KINDS },
      title: { type: "string" },
      details: { type: "string" },
      element_id: { type: "string", description: "Room, wall, door, window or object id from find_in_plan or job_overview" },
      due_date: { type: "string", description: "YYYY-MM-DD" },
      tag: { type: "array", items: { type: "string" }, description: "Team members' names" },
      high_priority: { type: "boolean" }
    }, required: ["kind", "title"] }
  },
  {
    name: "update_pin",
    description: "Change a pin by its number: status (open, in_progress, done), title, details, due date, or who is tagged.",
    input_schema: { type: "object", properties: {
      job: JOB,
      pin_number: { type: "integer" },
      status: { type: "string", enum: ["open", "in_progress", "done"] },
      title: { type: "string" },
      details: { type: "string" },
      due_date: { type: "string", description: "YYYY-MM-DD" },
      tag: { type: "array", items: { type: "string" }, description: "Replaces who is tagged" }
    }, required: ["pin_number"] }
  },
  { name: "set_stage", description: "Set a job stage's status by its name: not_started, active or done.", input_schema: { type: "object", properties: { job: JOB, stage: { type: "string" }, status: { type: "string", enum: ["not_started", "active", "done"] } }, required: ["stage", "status"] } },
  { name: "set_build_status", description: "Mark a room, wall, door, window or object's build status: not_built, in_progress, done, existing or demolish (or clear).", input_schema: { type: "object", properties: { job: JOB, element_id: { type: "string" }, status: { type: "string", enum: ["not_built", "in_progress", "done", "existing", "demolish", "clear"] } }, required: ["element_id", "status"] } },
  {
    name: "add_wall_item",
    description: "Put an outlet, switch, light, plumbing point or other wall item on a wall of a room, at a height in mm (typical heights used when left out).",
    input_schema: { type: "object", properties: {
      job: JOB,
      room: { type: "string", description: "Room id or name" },
      wall: { type: "string", description: 'Which wall, e.g. "north wall" or "east wall B"' },
      kind: { type: "string", enum: ITEM_KINDS },
      height_mm: { type: "number" },
      from_left_mm: { type: "number", description: "From the wall's left end seen from inside the room; middle when left out" },
      label: { type: "string" }
    }, required: ["room", "wall", "kind"] }
  },
  {
    name: "whats_around",
    description: 'What is next to an object or door/window: the things on its left and right (as seen standing in front of it, facing it, the way someone uses it), in front of it and behind it, with distances. Use it for "the cabinet right of the stove" or "the outlet left of the sink". Returns ids.',
    input_schema: { type: "object", properties: { job: JOB, element_id: { type: "string", description: "The reference object's id, from find_in_plan" } }, required: ["element_id"] }
  },
  { name: "team", description: "The team: names, titles and roles (and contact details for admins).", input_schema: { type: "object", properties: {} } }
];
function instructions(me, ctx) {
  return [
    `You are the Rorker assistant inside Rorker, a job app for contractors, working for ${me.name ?? "the signed-in person"} at ${me.company} (role: ${me.role === "admin" ? "owner/admin" : "employee"}).`,
    "You act as them: you can look up their jobs and make changes with the tools, on their permissions. Do what they ask without asking for confirmation, unless the request is unclear; then ask one short question.",
    'Look things up with the tools rather than guessing. Use ids you got from a tool. When you change something, say in one short sentence what you did ("Added task #7 on the kitchen sink, due today, tagged Marco.").',
    "Keep replies short and plain: they are often read aloud to someone on a job site. No tables, no headings, no long lists; at most a few short sentences.",
    "Never give out information beyond what the tools return for this person. Don't reveal anything about other companies, and don't repeat personal contact details unless this person is an admin and asked for them.",
    "Never say which AI model or company powers you; you are the Rorker assistant.",
    `Where things are: left and right of an object always mean as seen standing in front of it, facing it (the way you'd use a stove, a sink or a cabinet), not as seen on the plan. "The cabinet right of the stove" is the one at your right hand when you face the stove. Use whats_around to find it. Above and below mean height on the wall. North, south, east and west follow the plan (north is up). If two things still fit, ask one short question naming them by where they are.`,
    `Today is ${today()}.`,
    ctx.jobId ? `They are looking at the job "${ctx.jobName ?? ctx.jobId}" (id ${ctx.jobId})${ctx.where ? `, at ${ctx.where}` : ""}${ctx.selected ? `, with ${ctx.selected} selected` : ""}. "This job", "here" and "this" refer to that.` : "They are on the jobs list."
  ].join("\n");
}
export {
  TOOLS,
  instructions
};
