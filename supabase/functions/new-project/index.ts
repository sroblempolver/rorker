// The New project assistant for the hosted preview. The page sends what the contractor uploaded (photos,
// PDFs, DXF drawings already drawn as pictures with their scale) and what they said about the job; the
// model either asks a few follow-up questions or hands back the new client, the job and a room sketch
// that the page turns into the 2D/3D plan. The API key is a Supabase secret and never reaches the page.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";

const API_KEY = () => Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY_rorker");
// reading plans: the best model for paying plans, a cheaper one for the free plan
const MODELS = {
  paid: Deno.env.get("RORKER_INTAKE_MODEL") || "claude-opus-5-5",
  free: Deno.env.get("RORKER_INTAKE_MODEL_FREE") || "claude-sonnet-5-5",
};
const MAX_BODY = 14 * 1024 * 1024;
const LIMIT = 20; // requests per address per 10 minutes, per running copy of the function
const WINDOW = 10 * 60_000;

const ORIGINS = [/^https:\/\/[a-z0-9-]+\.github\.io$/, /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/, /^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];
const extra = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const allowed = (o: string | null) => !!o && (extra.includes(o) || ORIGINS.some((r) => r.test(o)));
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  list.push(now);
  hits.set(ip, list);
  return list.length > LIMIT;
}

const PT = { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2, description: "[x, y] in mm" };
const SIDE = { type: "string", enum: ["north", "south", "east", "west"] };
const FIXTURE_KINDS = ["base_cabinet", "wall_cabinet", "tall_cabinet", "kitchen_sink", "dishwasher", "range", "cooktop", "oven", "range_hood", "fridge", "island", "toilet", "washbasin", "vanity", "bathtub", "shower", "bed", "sofa", "armchair", "chair", "table", "dining_table", "desk", "nightstand", "sideboard", "wardrobe", "bookshelf", "washing_machine", "dryer", "water_heater", "fireplace", "tv", "lamp", "plant", "car", "other"];

const TOOLS: Anthropic.Tool[] = [
  {
    name: "ask_questions",
    description: "Ask the contractor a few short follow-up questions, only for things you can't sensibly guess and that matter for the job or the plan. Every question can be skipped.",
    input_schema: { type: "object", properties: {
      message: { type: "string", description: "One short friendly line before the questions" },
      questions: { type: "array", maxItems: 4, items: { type: "object", properties: {
        id: { type: "string" }, text: { type: "string" }, options: { type: "array", items: { type: "string" }, maxItems: 5, description: "Quick answers to tap, when there are obvious ones" },
      }, required: ["id", "text"] } },
    }, required: ["questions"] },
  },
  {
    name: "create_project",
    description: "Create the new client and job, with the plan sketch when there was a drawing or photo to read.",
    input_schema: { type: "object", properties: {
      summary: { type: "string", description: "Two or three plain sentences for the contractor: what you made and anything you guessed" },
      client: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" } } },
      job: { type: "object", properties: {
        name: { type: "string", description: "Short job name, e.g. \"Okafor kitchen\" or the street address" },
        address: { type: "string" },
        job_type: { type: "string", enum: ["renovation", "kitchen", "bathroom", "new_build", "restoration"] },
        start_date: { type: "string", description: "YYYY-MM-DD if they said" },
        scope: { type: "string", description: "What the work is, in a sentence" },
      }, required: ["name", "job_type"] },
      sketch: { type: "object", description: "The plan, when there was something to read. Leave out when there wasn't.", properties: {
        building_name: { type: "string" },
        storey_height_mm: { type: "number" },
        roof: { type: "string", enum: ["gable", "hip", "flat", "unknown"] },
        scale: { type: "string", description: "How you got from the drawing to millimetres, in a few words (\"written dimensions\", \"1:100 scale bar\", \"from door widths and the stair, about 9.5 mm per overview pixel\")" },
        units: { type: "array", description: "Only when the drawing has several homes (townhouses, semi-detached, duplex, flats): every unit, in order along the drawing. Draw a unit in full (its rooms carry its name in unit), or, when it is the same as another unit or its mirror image, give copy_of instead and the app copies that unit's rooms, doors, windows and fixtures.", items: { type: "object", properties: {
          name: { type: "string", description: "\"Unit 1\", \"Unit 2\" … or the names on the drawing" },
          copy_of: { type: "string", description: "The unit this one repeats" },
          mirror: { type: "boolean", description: "True when it is that unit flipped left to right (handed)" },
          offset_mm: { ...PT, description: "How far this unit's left edge sits from copy_of's left edge, [dx, dy] in mm" },
        }, required: ["name"] } },
        floors: { type: "array", items: { type: "object", properties: {
          name: { type: "string" }, level: { type: "integer", description: "0 ground, 1 first floor up, -1 basement" },
          rooms: { type: "array", items: { type: "object", properties: {
            name: { type: "string" },
            type: { type: "string", enum: ["kitchen", "bathroom", "wc", "bedroom", "living", "dining", "family", "study", "office", "hallway", "foyer", "stair_hall", "laundry", "utility", "closet", "garage", "storage", "balcony", "porch", "terrace", "other"] },
            polygon: { type: "array", items: PT, minItems: 3, description: "Corners in order, mm, on the wall centre lines" },
            unit: { type: "string", description: "When the drawing has several homes: the unit this room belongs to, exactly as named in units" },
          }, required: ["name", "type", "polygon"] } },
          doors: { type: "array", items: { type: "object", properties: {
            rooms: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2, description: "The two room names it joins; \"outside\" for an outside door" },
            kind: { type: "string", enum: ["door", "double_door", "sliding_door", "garage_door", "opening"] }, width_mm: { type: "number" },
            at: { type: "number", description: "Where along the shared wall, 0 to 1 (0.5 middle)" },
            side: { ...SIDE, description: "For an outside door: which side of the house it's on" },
          }, required: ["rooms"] } },
          windows: { type: "array", items: { type: "object", properties: { room: { type: "string" }, side: SIDE, width_mm: { type: "number" }, count: { type: "integer" } }, required: ["room", "side"] } },
          fixtures: { type: "array", items: { type: "object", properties: {
            kind: { type: "string", enum: FIXTURE_KINDS }, name: { type: "string" }, room: { type: "string" }, center: PT,
            width_mm: { type: "number" }, depth_mm: { type: "number" }, facing: { ...SIDE, description: "The way its front faces (towards the room)" },
          }, required: ["kind", "center"] } },
        }, required: ["level", "rooms"] } },
        questions: { type: "array", maxItems: 6, description: "Things about the plan worth checking later, shown on the job", items: { type: "object", properties: { text: { type: "string" }, options: { type: "array", items: { type: "string" } }, rooms: { type: "array", items: { type: "string" } } }, required: ["text"] } },
      }, required: ["floors"] },
    }, required: ["summary", "job"] },
  },
];

const SYSTEM = `You set up new projects in Rorker, a job app for contractors. A contractor gives you whatever they have (AutoCAD drawings, PDFs of plans, photos or sketches) and tells you about the job. Nothing is required: work with what you get.

Each turn, call exactly one tool:
- ask_questions, only when something important is missing or unclear and you can't sensibly guess it (the client's name if they mentioned a client but no name, which drawing is which floor, a room you can't read). At most 4 short questions, and at most two rounds of questions in total. If they skipped a question, guess sensibly and move on. Don't ask for things that are only nice to have (email, phone, dates).
- create_project, as soon as you have enough. Job name: the client's surname plus the work ("Okafor kitchen"), else the street address, else a short description.

The sketch (only when there's a drawing, plan, sketch or photo of a layout):
- Coordinates are millimetres, x to the right, y down, north up the page unless the drawing says otherwise. For a DXF picture, use the scale and frame given with it and the text labels' positions. For other pictures, measure from the dimensions written on the drawing; if there are none, use typical room sizes.
- Rooms are polygons on the wall centre lines, almost always rectangles or L-shapes with straight walls at right angles. Neighbouring rooms must share their edges exactly (same coordinates), and together the rooms should cover the whole floor, hallways and stair halls included. Use the room names written on the drawing, cleaned up ("DINING ROM" -> "Dining room").
- Each floor is its own entry, even when several floors are drawn side by side in one picture; give each floor's coordinates in its own place in the picture (the app lines floors up).
- PDFs come as an overview picture of the drawing area plus close-up tiles; each says where it sits in the overview. Read the details from the close-ups and place everything in one frame per page (the overview's).
- Scale: first look for written dimensions, then a scale bar or ratio, then the grid. If there are none, measure from things of known size: door leaves 800 to 900 mm, a straight stair about 900 to 1000 mm wide with 250 mm treads, a dining table for 6 about 1600 x 900, a double bed 1400 to 1600 x 2000, a car 1800 x 4500, a WC about 400 x 700. Use several of them, settle on one mm-per-pixel, and say how in scale. When the scale is a guess, ask in the sketch's questions to confirm one main size (a unit's width or the house's length).
- Several homes in one drawing (a terrace of townhouses, semi-detached houses, a duplex, flats): count the homes before anything else. A home is a separate dwelling (its own household or tenant): look across the whole drawing for unit labels ("Unit A", "Lot 3", "Apt 2", "Townhouse 1"), party or demising walls (thick walls running the full depth with no door through them), separate front entrances, a kitchen in each, separate meters or services, and the same layout repeated or mirrored. Rooms joined by an internal door are one home; a second kitchen behind the same front door is still one home unless the drawing calls it a unit. List each one in units and make every one of them; never squeeze them into one house. Start each room's name with its unit ("Unit 2 living room") so names stay unique, and set its unit. Doors between a unit and outside are outside doors. Neighbouring units share the party wall line exactly. Draw the first unit in full; a unit that is the same or the mirror image of one already drawn is a copy_of entry (mirror for handed pairs, offset_mm from that unit's left edge to its own). Draw a unit in full when it differs (end units with an extra window, a different layout). Say how many units you found in the summary. Name the building after the drawing ("Townhouses 1-6") when it has no name.
- Doors: every door between two rooms and every outside door, by the two room names (and the side of the house for an outside door). Windows: by room and the side of the house they're on. Open passages are kind "opening".
- Fixtures: the main things drawn (kitchen run as base cabinets with the sink, range and fridge; toilets, basins, tubs, showers; beds, sofas, dining table; a car in a garage). Centre in mm, real size, and which way the front faces.
- Put the things you weren't sure about in the sketch's questions (at most 5, each with quick answers when there are obvious ones). The contractor sees them next to the design.

After create_project the contractor looks over the design and tells you what's wrong or what to change, by voice or typing ("the garage door is on the south side", "add a powder room under the stairs", "the kitchen is bigger, about 4 by 5 metres", or answers to your questions).
- When they ask for changes, call create_project again with the WHOLE project updated: every floor, room, door, window and fixture, not just what changed. Keep everything they didn't mention exactly as it was. Start the summary with what you changed, in one short sentence, then ask in a few words if anything else needs fixing.
- When they ask you to add furniture or furnish rooms ("furnish the living room", "add a bed in Bedroom 2", "furnish the whole house"), add those pieces to the fixtures of that floor, with the room's name. Use standard sizes (width x depth, mm): double bed 1400x2000, queen 1600x2000, king 1800x2000, single 900x2000, nightstand 450x400, wardrobe 1200x600, 3-seat sofa 2100x900, 2-seat sofa 1600x900, armchair 850x850, coffee table ("table") 1100x600, TV unit ("sideboard") 1600x450 with a "tv" on it, dining table 1600x900 for 6 (1200x800 for 4) with a "chair" (450x450) at each place, desk 1200x600 with a chair, bookshelf 800x300, lamp 400x400, plant 400x400. Place them the way a designer would: beds with the headboard against a solid wall (not under a window if there's a choice), facing into the room, with a nightstand on each side of a double; sofas facing the TV or the fireplace; tables centred with chairs around them; pieces against walls sit 20 mm off the wall face; keep about 900 mm of walking space and never block a door swing or a doorway. "facing" is the way the front of the piece points (the foot of a bed, the seat side of a sofa). Only add what fits in the room; if it doesn't fit, use a smaller size and say so. Leave existing fixtures as they are unless asked. When they ask to move, turn, swap or remove a piece, do just that.
- When something they said is unclear, ask one short question with ask_questions.
- When they say it's right or have nothing to change, reply in plain text in one short sentence (no tool), e.g. "Great, press Create the project when you're ready."

Keep every text you write short and plain. Never say which AI model or company powers you; you are the Rorker assistant.`;

type Part = { kind: "image"; name?: string; media_type: string; data: string; note?: string } | { kind: "pdf"; name?: string; data: string };

function firstTurn(description: string, parts: Part[], today: string): Anthropic.ContentBlockParam[] {
  const out: Anthropic.ContentBlockParam[] = [];
  for (const p of parts.slice(0, 24)) {
    if (p.kind === "pdf" && typeof p.data === "string") {
      out.push({ type: "text", text: `File: ${String(p.name ?? "plans.pdf").slice(0, 120)}` });
      out.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: p.data } });
    } else if (p.kind === "image" && typeof p.data === "string" && (p.media_type === "image/jpeg" || p.media_type === "image/png")) {
      out.push({ type: "text", text: `File: ${String(p.name ?? "image").slice(0, 120)}${p.note ? `\n${String(p.note).slice(0, 20000)}` : ""}` });
      out.push({ type: "image", source: { type: "base64", media_type: p.media_type, data: p.data } });
    }
  }
  out.push({ type: "text", text: `Today is ${today}.\nWhat the contractor says about the job:\n${description.trim().slice(0, 4000) || "(nothing; work from the files)"}${out.length ? "" : "\n(No files were uploaded.)"}` });
  return out;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": allowed(origin) ? origin! : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Not found." }, 404);
  if (!allowed(origin)) return json({ error: "Not allowed from this page." }, 403);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return json({ error: "That's a lot of new projects at once. Give it a few minutes." }, 429);
  if (!API_KEY()) return json({ error: "The assistant isn't switched on yet." }, 503);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "Those files are too big to send at once. Try fewer pages or smaller photos." }, 413);
  let body: { description?: string; parts?: Part[]; history?: Anthropic.MessageParam[]; today?: string; test_url?: string; plan?: string };
  try { body = JSON.parse(raw); } catch { return json({ error: "Bad request." }, 400); }

  // for checking the function itself: a picture from the preview's own site
  let parts = Array.isArray(body.parts) ? body.parts : [];
  if (body.test_url && /^https:\/\/sroblempolver\.github\.io\/rorker\/[\w./-]+\.(png|jpg)$/.test(body.test_url)) {
    const r = await fetch(body.test_url);
    if (r.ok) {
      const bytes = new Uint8Array(await r.arrayBuffer());
      let s = "";
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const note = await fetch(body.test_url.replace(/\.(png|jpg)$/, ".txt")).then((x) => (x.ok ? x.text() : "")).catch(() => "");
      parts = [{ kind: "image", name: body.test_url.split("/").pop(), media_type: body.test_url.endsWith(".png") ? "image/png" : "image/jpeg", data: btoa(s), note }];
    }
  }
  const history = (Array.isArray(body.history) ? body.history : []).slice(0, 24);
  if (history.length % 2 === 1 || !history.every((m, i) => m && m.role === (i % 2 === 0 ? "assistant" : "user"))) return json({ error: "Bad request." }, 400);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: firstTurn(String(body.description ?? ""), parts, String(body.today ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10)) }, ...history];

  // asking for the free plan's model only ever makes it cheaper; anything else gets the paid one
  const MODEL = body.plan === "free" ? MODELS.free : MODELS.paid;

  // the reply can take a while: keep the connection alive with spaces, then send the answer
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      const beat = setInterval(() => ctl.enqueue(enc.encode(" ")), 4000);
      try {
        // the instructions and the drawing (the first turn) are cached, so each "check it with me"
        // round pays for them at the cheap cached rate
        const params = {
          // Sonnet 5.5 thinks at "high" unless told; "medium" keeps a read inside the function's time limit
          model: MODEL, max_tokens: 64000, thinking: { type: "adaptive" }, output_config: { effort: "medium" },
          system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }], tools: TOOLS, messages,
          cache_control: { type: "ephemeral" },
        };
        const s = new Anthropic({ apiKey: API_KEY() }).messages.stream(params as unknown as Anthropic.MessageStreamParams);
        const res = await s.finalMessage();
        if (res.stop_reason === "max_tokens") throw new Error("too long");
        ctl.enqueue(enc.encode(JSON.stringify({ content: res.content, stop_reason: res.stop_reason, usage: res.usage })));
      } catch (e) {
        console.error("new-project", e instanceof Error ? e.message : e);
        ctl.enqueue(enc.encode(JSON.stringify({ error: e instanceof Anthropic.APIError && e.status === 429 ? "Too many at once. Give it a minute." : "I couldn't read that just now. Try again in a moment." })));
      } finally {
        clearInterval(beat);
        ctl.close();
      }
    },
  });
  return new Response(stream, { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
});
