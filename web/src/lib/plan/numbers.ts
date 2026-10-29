// Every cabinet and item in a room has its own number (#1, #2 ...), shown on the plan, the wall view and
// in 3D, so the contractor, the client and the assistant can all say "cabinet 3". A number, once given,
// stays with the item (it's saved on it); ones without a number take the next free one in their room, in
// the order they were put in.

/** Kinds that are part of something else, not items of their own. */
const NOT_ITEMS = new Set(["door_leaf", "part"]);

export function isNumbered(kind: string) { return !NOT_ITEMS.has(kind); }

/** Each item's number in its room: the one it has, else the next free one there. */
export function itemNumbers<T extends { kind: string; no?: number | null }>(items: T[], roomOf: (x: T) => string | null): Map<T, number> {
  const out = new Map<T, number>();
  const used = new Map<string, Set<number>>();
  const usedIn = (r: string) => { let s = used.get(r); if (!s) used.set(r, (s = new Set())); return s; };
  for (const x of items) if (isNumbered(x.kind) && x.no && x.no > 0 && !usedIn(roomOf(x) ?? "").has(x.no)) { usedIn(roomOf(x) ?? "").add(x.no); out.set(x, x.no); }
  for (const x of items) {
    if (!isNumbered(x.kind) || out.has(x)) continue;
    const s = usedIn(roomOf(x) ?? "");
    let n = 1;
    while (s.has(n)) n++;
    s.add(n);
    out.set(x, n);
  }
  return out;
}

/** The same list with each item's number saved on it. */
export function stampNumbers<T extends { kind: string; no?: number | null }>(items: T[], roomOf: (x: T) => string | null): T[] {
  const n = itemNumbers(items, roomOf);
  return items.map((x) => (n.has(x) && x.no !== n.get(x) ? { ...x, no: n.get(x) } : x));
}

/** "#3", "cabinet 3", "kitchen 3", "no. 3": the number asked for, when there is one. */
export function numberIn(ref: string): number | null {
  const m = ref.trim().match(/^(?:.*?\b)?(?:#|no\.?\s*|number\s+)?(\d{1,3})$/i);
  return m ? +m[1] : null;
}
