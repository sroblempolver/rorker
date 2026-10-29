// A job's Photos: every photo on the job in one place, each tagged with the room it's in (and the thing
// in the room, the stage, who added it and when), so they're easy to find later. Three kinds go in:
// photos added straight to Photos (by the contractor, crew from their link, or the client), photos posted
// on pins, and photos in the client thread. Pin and message photos are tagged from where they were
// posted. No React here: the `build` function uses it too, to show a client their job's photos.
import type { JobMessage, JobPhoto, JobPhotoInput, JobStage, Pin, PinComment, PhotoBy } from "@/lib/data/types";
import type { Plan, Pt } from "@/lib/plan/types";

// the few plan lookups needed here, kept off geometry.ts so the `build` function stays small (that file
// brings the house standards, and React with them)
type Found = { kind: "room" | "wall" | "opening" | "fixture" | "stair"; floor: Plan["floors"][number]; id: string; room: string | null; name: string | null };
function findElement(plan: Plan, id: string): Found | null {
  for (const floor of plan.floors) {
    const r = floor.rooms.find((x) => x.id === id); if (r) return { kind: "room", floor, id, room: r.id, name: r.name };
    const w = floor.walls.find((x) => x.id === id); if (w) return { kind: "wall", floor, id, room: w.room_ids[0] ?? null, name: w.exterior ? "Exterior wall" : "Wall" };
    const o = floor.openings.find((x) => x.id === id); if (o) return { kind: "opening", floor, id, room: o.room_ids[0] ?? null, name: o.name };
    const f = floor.fixtures.find((x) => x.id === id); if (f) return { kind: "fixture", floor, id, room: f.room_id, name: f.name.replace(/\s*\((likely|probably|maybe)\)\s*$/i, "") };
    const s = floor.stairs.find((x) => x.id === id); if (s) return { kind: "stair", floor, id, room: s.room_id, name: "Stairs" };
  }
  return null;
}
function pointInPoly(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export type PhotoSource = "upload" | "pin" | "message";

/** One photo as Photos shows it, wherever it came from. */
export interface PhotoItem {
  /** unique across sources: upload:<id>, pin:<comment id>:<n>, message:<id>:<n> */
  key: string;
  src: string;
  source: PhotoSource;
  by: PhotoBy;
  created_at: string;
  room_id: string | null;
  element_id: string | null;
  floor_id: string | null;
  stage_id: string | null;
  caption: string | null;
  /** the client sees it on their page */
  client: boolean;
  /** an upload: its id, to retag or remove it */
  photo_id?: string;
  /** on a pin: which one */
  pin?: { id: string; number: number; title: string };
}

export interface RoomOption { id: string; label: string; floor_id: string; floor: string }

/** Every room by the name people use ("Bedroom 2" when there are two bedrooms), in plan order. */
export function roomOptions(plan: Plan | null): RoomOption[] {
  if (!plan) return [];
  const rooms = plan.floors.flatMap((f) => f.rooms.map((r) => ({ r, f })));
  const count = new Map<string, number>();
  for (const { r } of rooms) count.set(r.name || "Room", (count.get(r.name || "Room") ?? 0) + 1);
  const seen = new Map<string, number>();
  return rooms.map(({ r, f }) => {
    const n = r.name || "Room";
    const i = (seen.get(n) ?? 0) + 1;
    seen.set(n, i);
    return { id: r.id, label: count.get(n)! > 1 ? `${n} ${i}` : n, floor_id: f.id, floor: f.name };
  });
}

/** Where something on the map is: its room, the thing itself (when it isn't the room), and the floor. */
export function placeOf(plan: Plan | null, at: { element_id?: string | null; floor_id?: string | null; x?: number | null; y?: number | null; side?: string | null }):
  { room_id: string | null; element_id: string | null; floor_id: string | null } {
  if (!plan) return { room_id: null, element_id: at.element_id ?? null, floor_id: at.floor_id ?? null };
  const e = at.element_id ? findElement(plan, at.element_id) : null;
  if (e) {
    return { room_id: e.room, element_id: e.kind === "room" ? null : e.id, floor_id: e.floor.id };
  }
  // a wall view's side is "<room id>:<n>"
  const sideRoom = at.side?.split(":")[0];
  if (sideRoom) {
    const f = plan.floors.find((x) => x.rooms.some((r) => r.id === sideRoom));
    if (f) return { room_id: sideRoom, element_id: null, floor_id: f.id };
  }
  const f = at.floor_id ? plan.floors.find((x) => x.id === at.floor_id) : null;
  if (f && at.x != null && at.y != null) {
    const r = f.rooms.find((x) => pointInPoly([at.x!, at.y!], x.polygon));
    return { room_id: r?.id ?? null, element_id: null, floor_id: f.id };
  }
  return { room_id: null, element_id: null, floor_id: f?.id ?? null };
}

/** A pin's place: what it's on, or the spot it was dropped on. */
export function pinPlace(plan: Plan | null, p: Pin) {
  return placeOf(plan, { element_id: p.element_id, floor_id: p.floor_id, x: p.anchor?.view === "wall" ? null : p.x, y: p.anchor?.view === "wall" ? null : p.y, side: p.anchor?.view === "wall" ? p.anchor.side : null });
}

export interface PhotoSources {
  plan: Plan | null;
  pins: Pin[];
  /** the job's pin threads */
  comments: PinComment[];
  /** the job's thread with its client */
  messages: JobMessage[];
  uploads: JobPhoto[];
  /** who's on the job's client, to know a pin is theirs to see */
  clientId: string;
  /** team members by id, for names on pin photos posted from the app */
  names?: Map<string, string>;
}

/** Every photo on the job, newest first. */
export function gatherPhotos(s: PhotoSources): PhotoItem[] {
  const out: PhotoItem[] = [];
  for (const u of s.uploads) out.push({ key: `upload:${u.id}`, src: u.src, source: "upload", by: u.by, created_at: u.created_at, room_id: u.room_id, element_id: u.element_id,
    floor_id: u.floor_id, stage_id: u.stage_id, caption: u.caption, client: u.client, photo_id: u.id });
  const pins = new Map(s.pins.map((p) => [p.id, p]));
  for (const c of s.comments) {
    const p = pins.get(c.pin_id);
    if (!p || !c.photos.length) continue;
    const at = pinPlace(s.plan, p);
    // a comment with no team member on it came in from a crew link ("Photo from Marco")
    const by: PhotoBy = c.author_id ? { kind: "team", name: s.names?.get(c.author_id) ?? c.author_name ?? "Team", member_id: c.author_id } : { kind: "crew", name: c.author_name ?? "Crew" };
    const caption = c.body && !/^Photo from /.test(c.body) ? c.body : null;
    c.photos.forEach((src, i) => out.push({ key: `pin:${c.id}:${i}`, src, source: "pin", by, created_at: c.created_at, ...at, stage_id: p.stage_id, caption,
      client: p.tagged.includes(s.clientId), pin: { id: p.id, number: p.number, title: p.title } }));
  }
  for (const m of s.messages) {
    if (!m.photos.length) continue;
    const tag = m.places?.[0];
    const at = tag ? placeOf(s.plan, { element_id: tag.id }) : { room_id: null, element_id: null, floor_id: null };
    m.photos.forEach((src, i) => out.push({ key: `message:${m.id}:${i}`, src, source: "message", by: { kind: m.from === "client" ? "client" : "team", name: m.author_name }, created_at: m.created_at,
      ...at, stage_id: null, caption: m.body?.replace(/@(?=\S)/g, "") ?? null, client: true }));
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.key.localeCompare(b.key));
}

export interface PhotoFilter { room?: string | null; stage?: string | null; who?: string | null; source?: PhotoSource | null }
/** "who" is a person's name, or "crew" / "client" / "team" for everyone of that kind */
export const whoKey = (b: PhotoBy) => `${b.kind}:${b.name}`;

export function filterPhotos(list: PhotoItem[], f: PhotoFilter): PhotoItem[] {
  return list.filter((p) => (!f.room || (f.room === "none" ? !p.room_id : p.room_id === f.room))
    && (!f.stage || (f.stage === "none" ? !p.stage_id : p.stage_id === f.stage))
    && (!f.who || whoKey(p.by) === f.who || p.by.kind === f.who)
    && (!f.source || p.source === f.source));
}

/** Days, newest first, each with its photos: "Today", "Yesterday", or the date. */
export function byDay(list: PhotoItem[], now = new Date()): { day: string; label: string; photos: PhotoItem[] }[] {
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = key(now), yest = key(new Date(now.getTime() - 86_400_000));
  const groups = new Map<string, PhotoItem[]>();
  for (const p of list) { const k = key(new Date(p.created_at)); groups.set(k, [...(groups.get(k) ?? []), p]); }
  return [...groups].map(([day, photos]) => ({ day, photos,
    label: day === today ? "Today" : day === yest ? "Yesterday" : new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) }));
}

/** A photo's tags from a page or a link, checked against the job: unknown rooms, things and stages are
 *  dropped, the floor is the room's own, and the caption is trimmed. */
export function cleanPhotoInput(plan: Plan | null, stages: Pick<JobStage, "id">[], i: Partial<JobPhotoInput> | null | undefined): Omit<JobPhotoInput, "client"> {
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const el = str(i?.element_id, 80);
  const fromEl = el ? placeOf(plan, { element_id: el }) : null;
  const room = str(i?.room_id, 80);
  const roomOk = room && plan?.floors.some((f) => f.rooms.some((r) => r.id === room)) ? room : null;
  const room_id = fromEl?.room_id ?? roomOk;
  const floor_id = fromEl?.floor_id ?? (room_id ? plan!.floors.find((f) => f.rooms.some((r) => r.id === room_id))!.id : null);
  const stage = str(i?.stage_id, 80);
  return { room_id, element_id: fromEl?.element_id ?? null, floor_id, stage_id: stage && stages.some((s) => s.id === stage) ? stage : null, caption: str(i?.caption, 500) };
}

/** What a sentence says about where a photo is: "Kitchen › Sink · Framing". */
export function photoWhere(p: Pick<PhotoItem, "room_id" | "element_id">, plan: Plan | null, rooms: RoomOption[]): string | null {
  const room = rooms.find((r) => r.id === p.room_id)?.label ?? null;
  const e = p.element_id && plan ? findElement(plan, p.element_id) : null;
  const thing = e && e.kind !== "room" ? e.name : null;
  return [room, thing].filter(Boolean).join(" › ") || null;
}
