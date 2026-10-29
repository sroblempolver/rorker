// A room or object tagged in a message, and the small rules for tags that the `build` function shares
// with the page (no plan geometry here, so the function stays small). See places.ts.

/** A tagged place: the room or object id in the plan, and the words shown for it. */
export interface PlaceTag { id: string; label: string }

/** Tags as they arrive from a page: well formed, a few at most. */
export function cleanPlaces(v: unknown): PlaceTag[] {
  if (!Array.isArray(v)) return [];
  const out: PlaceTag[] = [];
  for (const t of v.slice(0, 8)) {
    const o = t as Record<string, unknown>;
    if (typeof o?.id !== "string" || typeof o.label !== "string" || !/^[\w:.-]{1,80}$/.test(o.id)) continue;
    const label = o.label.trim().slice(0, 80);
    if (label && !out.some((x) => x.id === o.id)) out.push({ id: o.id, label });
  }
  return out;
}

/** Message words split around their tags, so each "@label" can be drawn as a button. */
export function withTags(body: string, places: PlaceTag[]): (string | PlaceTag)[] {
  const tags = [...places].sort((a, b) => b.label.length - a.label.length);
  const out: (string | PlaceTag)[] = [];
  let rest = body;
  while (rest) {
    let best: { i: number; t: PlaceTag } | null = null;
    for (const t of tags) { const i = rest.indexOf(`@${t.label}`); if (i >= 0 && (!best || i < best.i)) best = { i, t }; }
    if (!best) { out.push(rest); break; }
    if (best.i) out.push(rest.slice(0, best.i));
    out.push(best.t);
    rest = rest.slice(best.i + best.t.label.length + 1);
  }
  return out;
}

const NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const VAGUE = new Set(["base", "space", "wall", "drawer", "built-in", "door", "leaf", "unidentified", "item", "bridge", "floor", "dining", "tall", "corner", "end", "side", "top", "upper", "lower", "small", "large", "big"]);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A name as people say it: any case, "1" or "one", a plural on the last word ("cabinets"). */
function said(name: string): string {
  const words = name.trim().split(/\s+/).map((w) => {
    const n = /^\d+$/.test(w) ? Number(w) : -1;
    return n >= 0 && n < NUMBERS.length ? `(?:${w}|${NUMBERS[n]})` : esc(w);
  });
  if (!words.length) return "(?!)";
  words[words.length - 1] += "(?:s|es)?";
  return `(?<![\\w@])${words.join("[\\s-]+")}(?!\\w)`;
}

/** Spoken words with the rooms and objects they name turned into tags, as if each had been picked
 *  from the @ menu: "the bed in bedroom one is broken" → "the @Bedroom 1 › Bed is broken". An
 *  object counts when its name is said and either it's the only one by that name or its room is said
 *  too (and then "in bedroom one" folds into the tag). A room said on its own is tagged as the room. */
export function spokenTags(text: string, places: PlaceTag[]): { text: string; tags: PlaceTag[] } {
  const rooms = places.filter((p) => !p.label.includes(" › "));
  const things = places.filter((p) => p.label.includes(" › ")).map((p) => {
    const [room, ...rest] = p.label.split(" › ");
    return { p, room, name: rest.join(" › ") };
  });
  // what people call an object: its full name, then without sizes ("Range 600" is "range"), then
  // the main word of it ("Sink base 580" is "sink", "Floor lamp" is "lamp")
  const calls: { say: string; tier: number; x: (typeof things)[number] }[] = [];
  for (const x of things) {
    const plain = x.name.replace(/\s+\d{3,}\b/g, "").trim();
    const words = plain.split(/\s+/).filter((w) => !/^\d+$/.test(w));
    const alts = [[x.name, 0], [plain, 1], ...(words.length > 1 ? [words[0], words[words.length - 1]].filter((w) => !VAGUE.has(w.toLowerCase())).map((w) => [w, 2]) : [])] as [string, number][];
    const seen = new Set<string>();
    for (const [say, tier] of alts) if (say && !seen.has(say.toLowerCase())) { seen.add(say.toLowerCase()); calls.push({ say, tier, x }); }
  }
  type Hit = { a: number; b: number; t: PlaceTag };
  const all = (src: string) => { const re = new RegExp(src, "gi"), out: { a: number; b: number }[] = []; let m; while ((m = re.exec(text))) out.push({ a: m.index, b: m.index + m[0].length }); return out; };
  // where each room is said, longest names first so "Bedroom 1" isn't read as "Bedroom"
  const roomSaid = new Map<string, { a: number; b: number }[]>();
  for (const r of [...rooms].sort((x, y) => y.label.length - x.label.length)) {
    const spans = all(said(r.label)).filter((s) => ![...roomSaid.values()].flat().some((o) => s.a < o.b && o.a < s.b));
    if (spans.length) roomSaid.set(r.label, spans);
  }
  const hits: Hit[] = [];
  const free = (a: number, b: number) => !hits.some((h) => a < h.b && h.a < b);
  const used = new Set<{ a: number; b: number }>();
  for (const name of [...new Set(calls.map((c) => c.say.toLowerCase()))].sort((x, y) => y.length - x.length)) {
    const named = calls.filter((c) => c.say.toLowerCase() === name);
    const best = Math.min(...named.map((c) => c.tier));
    const same = named.filter((c) => c.tier === best).map((c) => c.x);
    for (const s of all(said(name))) {
      if (!free(s.a, s.b)) continue;
      const inRoom = same.filter((x) => roomSaid.has(x.room));
      const pick = inRoom.length === 1 ? inRoom[0] : same.length === 1 ? same[0] : null;
      if (!pick) continue;
      let { a, b } = s;
      // fold the room into the tag when it's said right next to the object
      for (const r of roomSaid.get(pick.room) ?? []) {
        if (used.has(r)) continue;
        const after = text.slice(b, r.a), before = text.slice(r.b, a);
        if (r.a >= b && /^\s+(?:in|of|at|on|from|by)\s+(?:the\s+|my\s+|our\s+)?$/i.test(after)) { b = r.b; used.add(r); break; }
        if (r.b <= a && /^(?:'s)?\s+$/i.test(before)) { a = r.a; used.add(r); break; }
      }
      if (free(a, b)) hits.push({ a, b, t: pick.p });
    }
  }
  for (const [label, spans] of roomSaid) {
    const t = rooms.find((r) => r.label === label)!;
    for (const s of spans) if (!used.has(s) && free(s.a, s.b)) hits.push({ ...s, t });
  }
  hits.sort((x, y) => x.a - y.a);
  let out = "", at = 0;
  const tags: PlaceTag[] = [];
  for (const h of hits) {
    out += text.slice(at, h.a) + `@${h.t.label}`;
    at = h.b;
    if (!tags.some((t) => t.id === h.t.id)) tags.push(h.t);
  }
  return { text: out + text.slice(at), tags: tags.slice(0, 8) };
}
