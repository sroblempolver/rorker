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
var OBJECT_KINDS = ["base_cabinet", "wall_cabinet", "tall_cabinet", "kitchen_sink", "dishwasher", "range", "cooktop", "oven", "range_hood", "fridge", "island", "toilet", "washbasin", "vanity", "bathtub", "shower", "bed", "sofa", "armchair", "chair", "table", "dining_table", "desk", "nightstand", "sideboard", "wardrobe", "bookshelf", "washing_machine", "dryer", "water_heater", "fireplace", "tv", "lamp", "plant", "other"];
var SIDE = { type: "string", enum: ["north", "south", "east", "west"] };
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
  { name: "room_layout", description: "A room's layout for changing what's in it: its inside edges (x grows east, y grows south, in mm), its walls with the doors and windows on them, and every object in it with id, centre, size and the way it faces. Call it before adding or moving things.", input_schema: { type: "object", properties: { job: JOB, room: { type: "string", description: "Room id or name" } }, required: ["room"] } },
  {
    name: "add_objects",
    description: "Add furniture, appliances or fixtures to a room of the plan, each at a centre point in plan mm, at its real size (width across its front, depth front to back), with the way its front faces. Pieces are kept inside the room.",
    input_schema: { type: "object", properties: { job: JOB, room: { type: "string" }, objects: { type: "array", maxItems: 30, items: { type: "object", properties: {
      kind: { type: "string", enum: OBJECT_KINDS },
      name: { type: "string", description: 'e.g. "Queen bed"' },
      x: { type: "number" },
      y: { type: "number" },
      width_mm: { type: "number" },
      depth_mm: { type: "number" },
      facing: { ...SIDE, description: "The way its front faces (the foot of a bed, the seat of a sofa)" },
      height_mm: { type: "number" }
    }, required: ["kind", "x", "y", "width_mm", "depth_mm"] } } }, required: ["room", "objects"] }
  },
  {
    name: "change_object",
    description: "Move, turn, resize or rename one object in the plan. Move by mm east/south (negative for west/north), or to a new centre.",
    input_schema: { type: "object", properties: {
      job: JOB,
      element_id: { type: "string" },
      move_east_mm: { type: "number" },
      move_south_mm: { type: "number" },
      to_x: { type: "number" },
      to_y: { type: "number" },
      facing: SIDE,
      width_mm: { type: "number" },
      depth_mm: { type: "number" },
      height_mm: { type: "number" },
      name: { type: "string" }
    }, required: ["element_id"] }
  },
  { name: "remove_objects", description: "Take objects out of the plan by id (furniture, appliances, fixtures). Ones from the drawing can be brought back with Reset.", input_schema: { type: "object", properties: { job: JOB, element_ids: { type: "array", items: { type: "string" } } }, required: ["element_ids"] } },
  { name: "rename_room", description: "Rename a room or change its type.", input_schema: { type: "object", properties: { job: JOB, room: { type: "string" }, name: { type: "string" }, type: { type: "string", enum: ["kitchen", "bathroom", "wc", "bedroom", "living", "dining", "family", "study", "office", "hallway", "foyer", "stair_hall", "laundry", "utility", "closet", "garage", "storage", "balcony", "porch", "terrace", "other"] } }, required: ["room"] } },
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
    "Changing the plan: you can add, move, turn, resize and remove furniture, appliances and fixtures, and rename rooms (room_layout first, then add_objects, change_object, remove_objects, rename_room). Walls, rooms' shapes, doors and windows can't be changed here yet: say so in one sentence and offer to add a task pin for it.",
    "When adding furniture use standard sizes (width x depth, mm): double bed 1400x2000, queen 1600x2000, king 1800x2000, single 900x2000, nightstand 450x400, wardrobe 1200x600, 3-seat sofa 2100x900, 2-seat sofa 1600x900, armchair 850x850, coffee table (table) 1100x600, TV unit (sideboard) 1600x450 with a tv on it, dining table 1600x900 for 6 or 1200x800 for 4 with a chair (450x450) at each place, desk 1200x600 with a chair, bookshelf 800x300, lamp and plant 400x400; kitchen base cabinets 600 deep, fridge 700x700, range 600x600, dishwasher 600x600; toilet 400x650, basin 600x450, shower 900x900, bathtub 1700x700, washing machine and dryer 600x600. Place things the way a designer would: beds with the headboard against a solid wall, facing into the room, a nightstand each side of a double; sofas facing the TV or fireplace; tables centred with chairs around; pieces against a wall sit 20 mm off its inside edge; keep about 900 mm of walking space and never block a door or doorway. Only add what fits; leave other things as they are unless asked.",
    `Today is ${today()}.`,
    ctx.jobId ? `They are looking at the job "${ctx.jobName ?? ctx.jobId}" (id ${ctx.jobId})${ctx.where ? `, at ${ctx.where}` : ""}${ctx.selected ? `, with ${ctx.selected} selected` : ""}. "This job", "here" and "this" refer to that.` : "They are on the jobs list."
  ].join("\n");
}
export {
  TOOLS,
  instructions
};
