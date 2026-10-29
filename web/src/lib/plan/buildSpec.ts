// How the house is built: the few questions the assistant asks once the plan is done (siding, house
// wrap, sheathing, framing, insulation, vapor barrier, drywall, foundation, roof), one at a time, and
// what the answers turn into: the job's stages in the order the work goes, and the colour each outside
// wall layer shows in 3D while its stage is picked. Answers come by tapping, typing or voice; a typed or
// spoken answer is matched to an option by its words. Saved on the job under "@job" as `build`.
import type { BuildLook } from "./build";

export type QuestionId = "framing" | "foundation" | "sheathing" | "wrap" | "siding" | "insulation" | "vapor" | "drywall" | "roof";
/** The answers, by question: an option id, or the contractor's own words when nothing fits. */
export type BuildSpec = Partial<Record<QuestionId, string>>;

/** A surface in 3D: its colour and the pattern drawn on it. */
export type Pattern = "lap" | "cementlap" | "woodlap" | "plain" | "brick" | "stucco" | "stone" | "block" | "batt" | "mineral" | "spray" | "cellulose"
  | "studs" | "drywall" | "osb" | "plywood" | "zip" | "foamboard" | "wrap" | "felt" | "poly" | "kraft" | "shingle" | "tile" | "metal" | "membrane";
export interface Surface { color: string; pattern: Pattern; /** see-through, for a plastic sheet */ opacity?: number }

export interface Option { id: string; label: string; hint?: string; /** words that pick it when typed or said */ words: RegExp; surface?: Surface }
export interface Question {
  id: QuestionId; ask: string; why: string; options: Option[];
  /** asked only when this holds for the answers so far */
  when?: (s: BuildSpec) => boolean;
}

const wood = (s: BuildSpec) => s.framing !== "block";

export const QUESTIONS: Question[] = [
  {
    id: "siding", ask: "Let's start on the outside, the fun part. What's the house wearing?", why: "The siding is the colour you'll see on the walls in 3D.",
    options: [
      { id: "vinyl", label: "Vinyl", hint: "Lap siding", words: /vinyl/i, surface: { color: "#e6e3da", pattern: "lap" } },
      { id: "fiber_cement", label: "Fiber cement", hint: "HardiePlank", words: /fib(er|re)|cement|hardie|hardy/i, surface: { color: "#8e9aa1", pattern: "cementlap" } },
      { id: "wood", label: "Wood", hint: "Cedar or pine", words: /wood|cedar|pine|board/i, surface: { color: "#a8743f", pattern: "woodlap" } },
      { id: "stucco", label: "Stucco", hint: "Three coats on lath", words: /stucco|plaster|eifs/i, surface: { color: "#dccaa6", pattern: "stucco" } },
      { id: "brick", label: "Brick veneer", hint: "1\" air gap behind it", words: /brick|veneer/i, surface: { color: "#9c4a32", pattern: "brick" } },
      { id: "stone", label: "Stone", hint: "Natural or cultured", words: /stone|rock/i, surface: { color: "#8d8577", pattern: "stone" } },
    ],
  },
  {
    id: "framing", ask: "Now what's behind all that? What are the outside walls built from?", why: "Wood studs or block changes every stage after the foundation.",
    options: [
      { id: "2x4", label: "2x4 wood studs", hint: "3½\" wall cavity", words: /2\s*(x|by)\s*4|two by four|four inch/i , surface: { color: "#c9a46a", pattern: "studs" } },
      { id: "2x6", label: "2x6 wood studs", hint: "5½\" cavity, more insulation", words: /2\s*(x|by)\s*6|two by six|six inch/i , surface: { color: "#c9a46a", pattern: "studs" } },
      { id: "steel", label: "Steel studs", hint: "Light-gauge metal framing", words: /steel|metal/i , surface: { color: "#a3abb0", pattern: "studs" } },
      { id: "block", label: "Concrete block", hint: "CMU or poured walls", words: /block|cmu|cinder|concrete|masonry|icf/i , surface: { color: "#a7a59f", pattern: "block" } },
    ],
  },
  {
    id: "wrap", ask: "And the weather barrier: house wrap or felt?", why: "It keeps rain out behind the siding.", when: wood,
    options: [
      { id: "tyvek", label: "House wrap", hint: "Tyvek or similar", words: /tyvek|wrap|typar|house ?wrap/i, surface: { color: "#eef1f3", pattern: "wrap" } },
      { id: "felt", label: "Felt paper", hint: "Tar paper", words: /felt|tar|paper/i, surface: { color: "#3a3835", pattern: "felt" } },
      { id: "none", label: "None", words: /none|no |nothing|skip/i },
    ],
  },
  {
    id: "sheathing", ask: "What goes over the studs on the outside?", why: "Sheathing stiffens the walls.", when: wood,
    options: [
      { id: "osb", label: "OSB", hint: "½\" oriented strand board", words: /osb|strand|wafer/i, surface: { color: "#c9a46a", pattern: "osb" } },
      { id: "plywood", label: "Plywood", hint: "½\" CDX", words: /ply|cdx/i, surface: { color: "#d2b07a", pattern: "plywood" } },
      { id: "zip", label: "ZIP System", hint: "Green panels, taped seams", words: /zip|huber|green/i, surface: { color: "#5f8f4e", pattern: "zip" } },
      { id: "foam", label: "Foam board", hint: "Rigid insulation outside", words: /foam|rigid|xps|eps|polyiso/i, surface: { color: "#9cc2de", pattern: "foamboard" } },
    ],
  },
  {
    id: "insulation", ask: "What fills the walls?", why: "Insulation goes in after the rough-ins are checked.",
    options: [
      { id: "fiberglass", label: "Fiberglass batts", hint: "The pink or yellow kind", words: /fib(er|re)glass|batt|pink|yellow/i, surface: { color: "#f0a3b4", pattern: "batt" } },
      { id: "mineral", label: "Mineral wool", hint: "Rockwool", words: /mineral|rock ?wool|roxul/i, surface: { color: "#c9a072", pattern: "mineral" } },
      { id: "spray", label: "Spray foam", hint: "Open or closed cell", words: /spray|foam/i, surface: { color: "#efe0a2", pattern: "spray" } },
      { id: "cellulose", label: "Blown cellulose", hint: "Dense-pack", words: /cellulose|blown|dense/i, surface: { color: "#b9b2a4", pattern: "cellulose" } },
      { id: "rigid", label: "Rigid foam", hint: "On block walls", words: /rigid|xps|board/i, surface: { color: "#9cc2de", pattern: "foamboard" } },
    ],
  },
  {
    id: "vapor", ask: "Cold winters there? Is there a vapor retarder on the inside?", why: "In cold climates it keeps damp air out of the walls.",
    options: [
      { id: "plastic", label: "Plastic sheet", hint: "6 mil poly", words: /plastic|poly|sheet|visqueen/i, surface: { color: "#dfe8ee", pattern: "poly", opacity: 0.7 } },
      { id: "kraft", label: "Kraft facing", hint: "On the batts", words: /kraft|facing|faced|paper/i, surface: { color: "#b98d57", pattern: "kraft" } },
      { id: "none", label: "None needed", hint: "Warm climate", words: /none|no|warm|hot|florida|texas|skip/i },
    ],
  },
  {
    id: "drywall", ask: "Last wall layer: what drywall goes up?", why: "Taped, mudded, primed and painted.",
    options: [
      { id: "half", label: "½\" regular", hint: "Most walls", words: /half|1\/2|regular|standard|normal/i , surface: { color: "#e9e7e2", pattern: "drywall" } },
      { id: "five_eighths", label: "⅝\" fire-rated", hint: "Type X, garages and ceilings", words: /5\/8|five ?eighths|fire|type ?x/i , surface: { color: "#dcdad4", pattern: "drywall" } },
      { id: "moisture", label: "Moisture resistant", hint: "Green or purple board for baths", words: /moisture|green|purple|mold/i , surface: { color: "#8fb07c", pattern: "drywall" } },
      { id: "plaster", label: "Plaster", hint: "Veneer plaster on blue board", words: /plaster|blue/i , surface: { color: "#9fb4c9", pattern: "drywall" } },
    ],
  },
  {
    id: "foundation", ask: "What's it all sitting on?", why: "The first stage on site.",
    options: [
      { id: "slab", label: "Slab on grade", hint: "Concrete slab", words: /slab|grade|monolithic/i , surface: { color: "#9a9790", pattern: "membrane" } },
      { id: "crawl", label: "Crawl space", hint: "Stem walls and piers", words: /crawl|stem|pier/i , surface: { color: "#8d8a84", pattern: "block" } },
      { id: "basement", label: "Basement", hint: "Full foundation walls", words: /basement|cellar/i , surface: { color: "#8d8a84", pattern: "block" } },
    ],
  },
  {
    id: "roof", ask: "And to top it off, what's on the roof?", why: "The roof goes on right after framing, so the house gets dried in.",
    options: [
      { id: "shingles", label: "Asphalt shingles", words: /shingle|asphalt|architectural/i, surface: { color: "#3d3f43", pattern: "shingle" } },
      { id: "metal", label: "Metal", hint: "Standing seam", words: /metal|steel|tin|standing/i, surface: { color: "#59656c", pattern: "metal" } },
      { id: "tile", label: "Tile", hint: "Clay or concrete", words: /tile|clay|spanish|barrel/i, surface: { color: "#a2553a", pattern: "tile" } },
      { id: "flat", label: "Flat membrane", hint: "TPO or EPDM", words: /flat|tpo|epdm|membrane|rubber/i, surface: { color: "#c9c9c4", pattern: "membrane" } },
    ],
  },
];

const byId = new Map(QUESTIONS.map((q) => [q.id, q]));
export const question = (id: QuestionId) => byId.get(id)!;

/** The questions to ask for these answers, in order (a block house skips studs, sheathing and wrap). */
export const questionsFor = (s: BuildSpec) => QUESTIONS.filter((q) => !q.when || q.when(s));
/** The next question still to answer, or null when they're all done. */
export const nextQuestion = (s: BuildSpec) => questionsFor(s).find((q) => !(q.id in s)) ?? null;

/** A typed or spoken answer as the option it names, or the words themselves when none fits. */
export function matchAnswer(q: Question, said: string): string {
  const t = said.trim();
  const hit = q.options.find((o) => o.label.toLowerCase() === t.toLowerCase()) ?? q.options.find((o) => o.words.test(t));
  return hit ? hit.id : t;
}
export const optionOf = (id: QuestionId, v: string | undefined) => (v == null ? null : question(id).options.find((o) => o.id === v) ?? null);
/** An answer as words: the option's label, or what was typed. */
export const answerLabel = (id: QuestionId, v: string | undefined) => (v == null ? "" : optionOf(id, v)?.label ?? v);

/** Answers that drop out of the questions once an earlier one changes (block walls have no studs). */
export function tidy(s: BuildSpec): BuildSpec {
  const keep = new Set(questionsFor(s).map((q) => q.id));
  return Object.fromEntries(Object.entries(s).filter(([k]) => keep.has(k as QuestionId))) as BuildSpec;
}

/** A short friendly line back after an answer, before the next question. */
export function cheer(id: QuestionId, v: string): string {
  const o = optionOf(id, v);
  const l = o?.label ?? v;
  const lines: Partial<Record<QuestionId, string>> = {
    framing: v === "block" ? "Block walls, solid. I'll skip the wrap and sheathing." : v === "2x6" ? "2x6, nice and warm." : v === "2x4" ? "2x4, classic." : `${l}, got it.`,
    siding: v === "brick" ? "Brick it is. I'll leave the 1\" air gap behind it." : `${l}, good choice.`,
    vapor: v === "none" ? "No vapor retarder, warm climate." : `${l} on the warm side.`,
  };
  return lines[id] ?? `${l}, noted.`;
}

/** The outside of the house for the finished look: the siding and roof chosen, or null for the usual. */
export function finishOf(s: BuildSpec | undefined): { siding: Surface | null; roof: Surface | null } {
  return { siding: optionOf("siding", s?.siding)?.surface ?? (s?.framing === "block" && !s.siding ? { color: "#dccaa6", pattern: "stucco" } : null), roof: optionOf("roof", s?.roof)?.surface ?? null };
}

/** One stage of the work worked out from the answers. `layer` is what the outside walls show in 3D. */
export interface SpecStage { key: string; name: string; description: string; look: BuildLook; layer?: QuestionId }

/** The job's stages from how it's built, in the order the work goes on site. */
export function stagesFromSpec(answers: BuildSpec): SpecStage[] {
  // a skipped question adds nothing
  const s = Object.fromEntries(Object.entries(answers).filter(([, v]) => v && v !== "none")) as BuildSpec;
  const L = (id: QuestionId) => answerLabel(id, s[id]);
  // "Vinyl" reads "vinyl" after a colon; "OSB" and "ZIP System" stay as they are
  const low = (x: string) => (/^[A-Z][a-z]/.test(x) ? x[0].toLowerCase() + x.slice(1) : x);
  const block = s.framing === "block";
  const out: SpecStage[] = [
    { key: "site", name: "Permits and site work", description: "Permits, survey, clearing and layout.", look: "slab" },
    { key: "foundation", name: `Foundation: ${low(L("foundation")) || "footings and slab"}`, description: s.foundation === "basement" ? "Footings, basement walls, waterproofing and the slab." : s.foundation === "crawl" ? "Footings, stem walls, piers and the vapor barrier on the ground." : "Footings and the concrete slab, plumbing under it first.", look: "slab" },
    block
      ? { key: "framing", name: "Block walls", description: "Concrete block walls, filled and reinforced where needed, with a bond beam on top.", look: "framing" }
      : { key: "framing", name: `Framing: ${s.framing === "steel" ? "steel studs" : low(L("framing")) || "wood studs"}`, description: "Floors, walls and roof framing. Studs 16\" apart, headers over the openings.", look: "framing" },
  ];
  if (!block && s.sheathing) out.push({ key: "sheathing", name: `Sheathing: ${low(L("sheathing"))}`, description: s.sheathing === "zip" ? "ZIP panels on the walls and roof, seams taped." : "Panels nailed over the studs to stiffen the walls.", look: "framing", layer: "sheathing" });
  out.push({ key: "roof", name: `Roof: ${low(L("roof")) || "roofing"}`, description: "Roof deck, underlayment and the roofing, so the house is dried in.", look: "framing" });
  if (!block && s.wrap && s.wrap !== "none") out.push({ key: "wrap", name: `Weather barrier: ${low(L("wrap"))}`, description: "Lapped and taped over the sheathing, flashed at every window and door.", look: "framing", layer: "wrap" });
  out.push({ key: "openings", name: "Windows and doors", description: "Set, flashed and sealed in their openings.", look: "framing" });
  if (s.siding) out.push({ key: "siding", name: `Siding: ${low(L("siding"))}`, description: s.siding === "brick" ? "Brick veneer with a 1\" air gap and ties back to the wall." : s.siding === "stucco" ? "Lath and three coats of stucco." : "Siding, trim and caulking all round.", look: "finished", layer: "siding" });
  out.push({ key: "rough", name: "Rough-in: plumbing, electrical, HVAC", description: "Pipes, wires and ducts through the walls, then the rough-in inspection.", look: "framing" });
  if (s.insulation) out.push({ key: "insulation", name: `Insulation: ${low(L("insulation"))}`, description: block ? "On the inside of the block walls, with furring strips." : "Between the studs and in the attic.", look: "framing", layer: "insulation" });
  if (s.vapor && s.vapor !== "none") out.push({ key: "vapor", name: `Vapor retarder: ${low(L("vapor"))}`, description: "On the warm side of the insulation, seams lapped.", look: "framing", layer: "vapor" });
  out.push(
    { key: "drywall", name: `Drywall: ${low(L("drywall")) || "hang and finish"}`, description: "Hung, taped, mudded and primed.", look: "drywall", layer: "drywall" },
    { key: "finishes", name: "Interior finishes: paint, trim, flooring", description: "Paint, doors, trim and floors.", look: "drywall" },
    { key: "fixtures", name: "Cabinets and fixtures", description: "Cabinets, counters, plumbing fixtures, lights and appliances.", look: "finished" },
    { key: "final", name: "Final inspection and handover", description: "Punch list, final inspection and the keys.", look: "finished" },
  );
  return out;
}

/** What the outside walls show for a stage, from its name (any stage, renamed or not), or null. */
export function layerForStage(name: string, s: BuildSpec | undefined): Surface | null {
  if (!s) return null;
  const n = name.toLowerCase();
  const pick = (id: QuestionId) => optionOf(id, s[id])?.surface ?? null;
  if (/vapou?r/.test(n)) return pick("vapor");
  if (/insulat/.test(n)) return pick("insulation");
  if (/sheath|osb|plywood|zip/.test(n)) return pick("sheathing");
  if (/weather|wrap|tyvek|felt/.test(n)) return pick("wrap");
  if (/siding|cladding|stucco|brick|veneer|stone|exterior finish/.test(n)) return pick("siding") ?? finishOf(s).siding;
  if (/block wall/.test(n)) return { color: "#a7a59f", pattern: "block" };
  return null;
}

/** The 3D outside at a stage: siding and roofing as chosen, the layer that stage puts on the outside
 *  walls, and the roof on once its stage is reached. `names` are the job's stages in order. */
export function outsideAt(s: BuildSpec | undefined, names: string[], i: number): { siding: Surface | null; roof: Surface | null; layer: Surface | null; roofOn: boolean } | undefined {
  if (!s) return undefined;
  const roofAt = names.findIndex((n) => /^roof|roofing/i.test(n));
  // the outside walls show the last layer put on so far: the sheathing stays on through the roof, the
  // wrap through the windows, the siding from its stage to the end
  let layer: Surface | null = null;
  for (let k = 0; k <= i && k < names.length; k++) {
    if (/insulat|vapou?r|drywall/i.test(names[k])) continue;
    layer = layerForStage(names[k], s) ?? layer;
  }
  if (i >= 0 && /insulat|vapou?r/i.test(names[i] ?? "")) layer = layerForStage(names[i], s) ?? layer;
  return { ...finishOf(s), layer: i >= 0 ? layer : null, roofOn: roofAt >= 0 && i >= roofAt };
}

/** The answers as one line, for the review and the job summary. */
export const specSummary = (s: BuildSpec) => questionsFor(s).filter((q) => s[q.id] && s[q.id] !== "none").map((q) => answerLabel(q.id, s[q.id])).join(" · ");
