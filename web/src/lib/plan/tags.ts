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
