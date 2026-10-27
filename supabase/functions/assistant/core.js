// Generated from web/src/lib/assistant/core.ts by web/preview/build-function.mjs. Do not edit.

// src/lib/plan/catalog.ts
var WOOD = "#a07850";
var DARK = "#8a6a48";
var CAB = "#5b5750";
var WHITE = "#f4efe6";
var STEEL = "#b9bec4";
var BLACK = "#232426";
var FABRIC = "#6f7486";
var DESKS = ["desk", "table", "dining_table", "sideboard", "dresser", "nightstand"];
var COUNTERS = ["base_cabinet", "island", "kitchen_sink", "sideboard", "table"];
var CATALOG = {
  // kitchen
  base_cabinet: { label: "Base cabinet", w: 600, d: 600, h: 900, kg: 35, mount: "floor", face: "room", fill: CAB },
  wall_cabinet: { label: "Wall cabinet", w: 600, d: 350, h: 700, kg: 18, mount: "wall", at: 1450, face: "room", fill: CAB },
  tall_cabinet: { label: "Tall cabinet", w: 600, d: 600, h: 2200, kg: 70, mount: "floor", face: "room", words: ["pantry"], fill: "#d9d2c4" },
  kitchen_sink: { label: "Kitchen sink", w: 800, d: 600, h: 900, kg: 45, mount: "floor", face: "room", fill: CAB },
  dishwasher: { label: "Dishwasher", w: 600, d: 600, h: 850, kg: 45, mount: "floor", face: "room", fill: CAB },
  range: { label: "Range", w: 600, d: 600, h: 900, kg: 60, mount: "floor", face: "room", words: ["stove", "cooker"], fill: BLACK },
  cooktop: { label: "Cooktop", w: 600, d: 520, h: 900, kg: 10, mount: "floor", face: "room", words: ["hob"], fill: BLACK },
  oven: { label: "Oven", w: 600, d: 600, h: 900, kg: 35, mount: "floor", face: "room", fill: BLACK },
  range_hood: { label: "Range hood", w: 600, d: 500, h: 600, kg: 12, mount: "wall", at: 1600, face: "room", words: ["extractor", "hood"], fill: STEEL },
  fridge: { label: "Fridge", w: 700, d: 700, h: 1850, kg: 80, mount: "floor", face: "room", words: ["refrigerator", "freezer"], fill: STEEL },
  island: { label: "Kitchen island", w: 1800, d: 900, h: 900, kg: 150, mount: "floor", face: "any", fill: CAB },
  microwave: { label: "Microwave", w: 500, d: 380, h: 300, kg: 14, mount: "surface", on: COUNTERS, back: true, face: "with", fill: BLACK },
  coffee_machine: { label: "Coffee machine", w: 280, d: 400, h: 380, kg: 9, mount: "surface", on: COUNTERS, back: true, face: "with", words: ["espresso"], fill: BLACK },
  kettle: { label: "Kettle", w: 220, d: 160, h: 250, kg: 1.2, mount: "surface", on: COUNTERS, back: true, face: "with", fill: STEEL },
  toaster: { label: "Toaster", w: 300, d: 180, h: 200, kg: 2, mount: "surface", on: COUNTERS, back: true, face: "with", fill: STEEL },
  bar_stool: { label: "Bar stool", w: 400, d: 400, h: 1e3, kg: 6, mount: "floor", face: "to", to: ["island", "base_cabinet", "kitchen_sink", "bar_counter"], words: ["counter stool", "stool"], fill: WOOD },
  // bathroom
  toilet: { label: "Toilet", w: 400, d: 650, h: 800, kg: 30, mount: "floor", face: "room", words: ["wc"], fill: WHITE },
  washbasin: { label: "Washbasin", w: 600, d: 450, h: 900, kg: 18, mount: "floor", face: "room", words: ["basin", "sink"], fill: WHITE },
  vanity: { label: "Vanity", w: 800, d: 480, h: 900, kg: 45, mount: "floor", face: "room", fill: WOOD },
  bathtub: { label: "Bathtub", w: 1700, d: 700, h: 580, kg: 50, mount: "floor", face: "room", words: ["bath", "tub"], fill: WHITE },
  shower: { label: "Shower", w: 900, d: 900, h: 2050, kg: 60, mount: "floor", face: "room", fill: "#cfe6ee" },
  mirror: { label: "Mirror", w: 600, d: 30, h: 800, kg: 8, mount: "wall", at: 1100, face: "room", fill: "#8fd3f0" },
  towel_radiator: { label: "Towel radiator", w: 500, d: 100, h: 1200, kg: 12, mount: "wall", at: 300, face: "room", fill: WHITE },
  // bedroom
  bed: { label: "Bed", w: 1600, d: 2e3, h: 1050, kg: 70, mount: "floor", face: "room", fill: "#e9e3d6" },
  nightstand: { label: "Nightstand", w: 450, d: 400, h: 550, kg: 12, mount: "floor", face: "room", words: ["bedside table"], fill: DARK },
  wardrobe: { label: "Wardrobe", w: 1200, d: 600, h: 2200, kg: 90, mount: "floor", face: "room", words: ["closet", "armoire"], fill: DARK },
  dresser: { label: "Dresser", w: 1e3, d: 480, h: 800, kg: 45, mount: "floor", face: "room", words: ["chest of drawers", "drawers"], fill: DARK },
  crib: { label: "Crib", w: 700, d: 1300, h: 900, kg: 25, mount: "floor", face: "room", words: ["cot"], fill: WHITE },
  // living and dining
  sofa: { label: "Sofa", w: 2100, d: 900, h: 850, kg: 60, mount: "floor", face: "to", to: ["tv", "fireplace", "coffee_table"], words: ["couch"], fill: FABRIC },
  armchair: { label: "Armchair", w: 850, d: 850, h: 850, kg: 25, mount: "floor", face: "to", to: ["coffee_table", "tv", "fireplace", "sofa"], fill: FABRIC },
  coffee_table: { label: "Coffee table", w: 1100, d: 600, h: 420, kg: 20, mount: "floor", face: "any", fill: WOOD },
  table: { label: "Table", w: 1200, d: 800, h: 750, kg: 30, mount: "floor", face: "any", fill: WOOD },
  dining_table: { label: "Dining table", w: 1600, d: 900, h: 750, kg: 45, mount: "floor", face: "any", fill: WOOD },
  chair: { label: "Chair", w: 450, d: 450, h: 900, kg: 5, mount: "floor", face: "to", to: ["dining_table", "table", "desk"], fill: WOOD },
  sideboard: { label: "Sideboard", w: 1600, d: 450, h: 750, kg: 55, mount: "floor", face: "room", words: ["tv unit", "tv stand", "credenza", "buffet"], fill: DARK },
  tv: { label: "TV", w: 1230, d: 80, h: 720, kg: 15, mount: "surface", on: ["sideboard", "dresser", "tv_stand"], at: 1100, face: "with", back: true, words: ["television", "screen"], fill: "#151618" },
  bookshelf: { label: "Bookshelf", w: 800, d: 300, h: 2e3, kg: 40, mount: "floor", face: "room", words: ["bookcase", "shelving"], fill: DARK },
  wall_shelf: { label: "Wall shelf", w: 800, d: 250, h: 40, kg: 4, mount: "wall", at: 1500, face: "room", words: ["floating shelf"], fill: WOOD },
  picture: { label: "Picture", w: 700, d: 30, h: 500, kg: 3, mount: "wall", at: 1350, face: "room", words: ["painting", "art", "frame", "poster"], fill: "#c9a46a" },
  rug: { label: "Rug", w: 2e3, d: 1400, h: 10, kg: 8, mount: "floor", face: "any", words: ["carpet"], fill: "#7a5a4a" },
  fireplace: { label: "Fireplace", w: 1200, d: 400, h: 1150, kg: 200, mount: "floor", face: "room", fill: "#8d8a83" },
  piano: { label: "Upright piano", w: 1500, d: 600, h: 1250, kg: 230, mount: "floor", face: "room", users: ["chair", "bar_stool"], fill: "#151618" },
  lamp: { label: "Floor lamp", w: 400, d: 400, h: 1600, kg: 5, mount: "floor", face: "any", words: ["floor lamp", "standing lamp"], fill: "#f3c56b" },
  table_lamp: { label: "Table lamp", w: 280, d: 280, h: 450, kg: 2, mount: "surface", on: ["nightstand", "desk", "sideboard", "dresser", "table"], face: "any", words: ["desk lamp", "bedside lamp"], fill: "#f3c56b" },
  plant: { label: "Plant", w: 400, d: 400, h: 1200, kg: 10, mount: "floor", face: "any", fill: "#3f7a4a" },
  ceiling_fan: { label: "Ceiling fan", w: 1300, d: 1300, h: 400, kg: 7, mount: "ceiling", at: 2250, face: "any", fill: "#d9d2c4" },
  pendant_light: { label: "Pendant light", w: 400, d: 400, h: 400, kg: 2, mount: "ceiling", at: 1900, face: "any", words: ["chandelier", "ceiling light"], fill: "#f3c56b" },
  // office
  desk: { label: "Desk", w: 1200, d: 600, h: 750, kg: 30, mount: "floor", face: "room", users: ["office_chair", "chair"], fill: WOOD },
  office_chair: { label: "Office chair", w: 600, d: 600, h: 1100, kg: 14, mount: "floor", face: "to", to: ["desk", "table"], words: ["desk chair", "swivel chair"], fill: "#2b2c30" },
  computer: { label: "Computer", w: 900, d: 450, h: 460, kg: 12, mount: "surface", on: DESKS, back: true, face: "with", words: ["pc", "desktop", "desktop computer", "workstation", "imac"], fill: BLACK },
  monitor: { label: "Monitor", w: 620, d: 200, h: 460, kg: 5, mount: "surface", on: DESKS, back: true, face: "with", words: ["screen", "display"], fill: BLACK },
  laptop: { label: "Laptop", w: 340, d: 240, h: 230, kg: 1.6, mount: "surface", on: DESKS, face: "with", words: ["notebook", "macbook"], fill: "#9da3aa" },
  printer: { label: "Printer", w: 450, d: 400, h: 250, kg: 10, mount: "surface", on: ["desk", "sideboard", "filing_cabinet", "table"], face: "with", fill: "#e6e1d6" },
  filing_cabinet: { label: "Filing cabinet", w: 400, d: 600, h: 720, kg: 30, mount: "floor", face: "room", words: ["drawer unit", "pedestal"], fill: "#7d8187" },
  // laundry, services, outside
  washing_machine: { label: "Washing machine", w: 600, d: 600, h: 850, kg: 70, mount: "floor", face: "room", words: ["washer"], fill: WHITE },
  dryer: { label: "Dryer", w: 600, d: 600, h: 850, kg: 40, mount: "floor", face: "room", fill: WHITE },
  water_heater: { label: "Water heater", w: 560, d: 560, h: 1500, kg: 60, mount: "floor", face: "room", words: ["boiler", "geyser"], fill: "#e6e1d6" },
  treadmill: { label: "Treadmill", w: 800, d: 1900, h: 1400, kg: 90, mount: "floor", face: "room", fill: "#2b2c30" },
  car: { label: "Car", w: 1800, d: 4500, h: 1500, kg: 1400, mount: "floor", face: "any", fill: "#55606b" }
};
var OBJECT_KINDS = [...Object.keys(CATALOG), "other"];

// src/lib/dates.ts
function today(d = /* @__PURE__ */ new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// src/lib/assistant/core.ts
var JOB = { type: "string", description: `The job: its id, or its name as the person says it ("Hadley Road"). Leave out for the job they're looking at.` };
var PIN_KINDS = ["task", "issue", "note", "material"];
var ITEM_KINDS = ["outlet", "switch", "light", "data", "plumbing", "vent", "thermostat", "mount", "other"];
var SIDE = { type: "string", enum: ["north", "south", "east", "west"] };
var PART = { type: "object", properties: {
  shape: { type: "string", enum: ["box", "cylinder", "sphere"] },
  x: { type: "number", description: "Centre, mm right of the object's middle as seen from its front" },
  z: { type: "number", description: "Centre, mm toward its front from its middle" },
  y: { type: "number", description: "Bottom of this part, mm above the object's bottom" },
  w: { type: "number", description: "Width, mm (left to right)" },
  d: { type: "number", description: "Depth, mm (front to back)" },
  h: { type: "number", description: "Height, mm" },
  color: { type: "string", description: "#rrggbb, its real colour" }
}, required: ["shape", "x", "y", "z", "w", "d", "h"] };
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
      high_priority: { type: "boolean" },
      photo_request: { type: "boolean", description: 'Asking the tagged person for a photo of this spot ("get Marco to send a photo of the sink"): a task they close with a photo, sent from their link' }
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
    description: 'Add furniture, appliances, electronics or fixtures to a room. Each goes in at its real size, height and weight (the catalogue\'s usual values unless you give them), at the right height: things that sit on something (a computer, monitor, microwave, table lamp, TV) go on top of it, on the desk or counter you name with `on` or the nearest suitable one in the room; wall things (mirror, picture, wall cabinet, shelf) hang at their usual height against the nearest wall. When you leave out `facing` it faces the natural way: chairs to their desk or table, stools to the counter, sofas to the TV, beds, cabinets and desks with their backs to the wall. Pieces are kept inside the room. Something not in the kind list: kind "other", its real name, and `parts`.',
    input_schema: { type: "object", properties: { job: JOB, room: { type: "string", description: "Room id (best) or name" }, objects: { type: "array", maxItems: 30, items: { type: "object", properties: {
      kind: { type: "string", enum: OBJECT_KINDS },
      name: { type: "string", description: 'What it is, e.g. "Queen bed", "Desktop computer", "Espresso machine"' },
      x: { type: "number", description: "Centre, plan mm. Can be left out for things put on something or next to their partner (a chair at its desk)" },
      y: { type: "number" },
      width_mm: { type: "number", description: "Across its front; leave out for the usual size" },
      depth_mm: { type: "number", description: "Front to back" },
      height_mm: { type: "number" },
      weight_kg: { type: "number" },
      facing: { ...SIDE, description: "The way its front faces (the foot of a bed, the seat of a chair, a screen's face). Leave out for the natural way." },
      face_toward: { type: "string", description: "Id of something it should face (a chair facing desk G-F41)" },
      on: { type: "string", description: 'Id of what it sits on (the desk, counter or sideboard), from room_layout or earlier in this call ("new:0" is the first object of this call)' },
      height_above_floor_mm: { type: "number", description: "Its bottom above the floor, for something hung at an unusual height" },
      parts: { type: "array", maxItems: 40, items: PART, description: "For kind other: the object built from simple shapes at real sizes, as it really looks (a rowing machine: rail, seat, flywheel, footrests). Its overall width, depth and height must contain the parts." }
    }, required: ["kind"] } } }, required: ["room", "objects"] }
  },
  {
    name: "change_object",
    description: "Move, turn, resize, rename or re-seat one object. Move by mm east/south (negative for west/north), or to a new centre; turn it to face a side or another object; put it on something (`on`), or set its height above the floor.",
    input_schema: { type: "object", properties: {
      job: JOB,
      element_id: { type: "string" },
      move_east_mm: { type: "number" },
      move_south_mm: { type: "number" },
      to_x: { type: "number" },
      to_y: { type: "number" },
      facing: SIDE,
      face_toward: { type: "string", description: "Id of what it should face" },
      on: { type: "string", description: "Id of what it should sit on" },
      height_above_floor_mm: { type: "number" },
      width_mm: { type: "number" },
      depth_mm: { type: "number" },
      height_mm: { type: "number" },
      weight_kg: { type: "number" },
      name: { type: "string" }
    }, required: ["element_id"] }
  },
  {
    name: "point_at",
    description: `Put a blinking coloured dot on the plan (2D and 3D) on each place you're talking about, so the person sees which is which. Use it whenever you name places they must tell apart or find: before asking "the bedroom with the blue dot or the green one?", and to show where something is. With one place it also opens that room or object in the side panel. Returns each place's dot colour; say the colours in your reply.`,
    input_schema: { type: "object", properties: { job: JOB, places: { type: "array", minItems: 1, maxItems: 6, items: { type: "object", properties: {
      id: { type: "string", description: "Room, object, door, window or wall id" },
      label: { type: "string", description: 'What you call it, e.g. "south bedroom"' }
    }, required: ["id"] } }, open: { type: "string", description: "Id to open in the side panel (defaults to the place when there is just one)" } }, required: ["places"] }
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
    "Real things, real sizes: every object has a real width, depth, height, weight and mounting height, and drawings never show furniture heights, so add_objects fills in the usual ones for each kind. Pick the kind that is the actual thing (a computer is kind computer, never a box or other). A computer, monitor, laptop, printer, table lamp, microwave, coffee machine or TV sits on a desk, counter or sideboard, never on the floor: put it `on` that piece (add the desk first if the room has none, or ask). Chairs go at their desk or table facing it, bar stools at the counter or island facing it, sofas and armchairs face the TV, fireplace or coffee table, beds, cabinets, wardrobes and desks stand with their backs to a wall facing into the room, wall cabinets, mirrors, pictures and shelves hang on a wall at their usual height. Leave facing out and it is worked out that way; give it only when the person asks for something else.",
    "Something not in the kind list (a rowing machine, a pool table, a kayak rack): don't settle for a box. Work out from what you know (or look it up with web search when you can) what it really looks like, its real size and weight, then add it as kind other with its name and parts: simple boxes, cylinders and spheres at real sizes and colours that together look like the real thing. Only when you truly can't tell what it is, ask what it looks like.",
    "Placing: the usual layouts (width x depth, mm): double bed 1400x2000, queen 1600x2000, king 1800x2000, single 900x2000 with a nightstand each side of a double; dining table 1600x900 for 6 or 1200x800 for 4 with a chair at each place; desk 1200x600 with an office chair; sofa facing the TV on a sideboard. Place things the way a designer would: keep about 900 mm of walking space and never block a door or doorway. Only add what fits; leave other things as they are unless asked.",
    'Showing places: whenever you mention a room or spot the person has to pick between or find ("which bedroom?"), call point_at first so a coloured dot blinks on each one, then name them by where they are and by colour ("the bedroom on the south side, blue dot, or the east one, green dot?"). Rooms often share a name, so tell them apart by their side of the floor (find_in_plan says where each one is). After adding or moving something it is pointed at for you.',
    // keep these two last: they change per request, and everything above them is cached
    `Today is ${today()}.`,
    ctx.jobId ? `They are looking at the job "${ctx.jobName ?? ctx.jobId}" (id ${ctx.jobId})${ctx.where ? `, at ${ctx.where}` : ""}${ctx.selected ? `, with ${ctx.selected} selected` : ""}. "This job", "here" and "this" refer to that.` : "They are on the jobs list."
  ].join("\n");
}
export {
  TOOLS,
  instructions
};
