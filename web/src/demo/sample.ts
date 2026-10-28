// Sample progress for the demo job, shared by local demo mode and the standalone preview.
import type { ElementState, ItemInput, Member, MemberInput, Pin } from "@/lib/data/types";
import { attachedToSide, roomSides, siteLayout } from "@/lib/plan/geometry";
import type { Plan } from "@/lib/plan/types";
import { addDays, today } from "@/lib/dates";

/** The demo crew, so tagging staff on pins can be tried straight away: Marco is an employee, the
 *  electrician and plumber are subs. */
export const DEMO_CREW: MemberInput[] = [
  { full_name: "Marco Diaz", title: "Site lead", email: "marco@demobuilders.test", phone: "(555) 010-2041", role: "employee" },
  { full_name: "Aisha Khan", title: "Electrician", email: "aisha@demobuilders.test", phone: "(555) 010-2042", role: "employee", crew: "sub" },
  { full_name: "Tom Reilly", title: "Plumber", email: "tom@demobuilders.test", phone: null, role: "employee", crew: "sub" },
  { full_name: "Dana Brooks", title: "Office manager", email: "dana@demobuilders.test", phone: null, role: "admin" },
];

/** Sample pins; with a crew, the site lead, electrician and plumber are tagged where it makes sense.
 *  Due dates are relative to today, so the job's feed always has something late, today and coming up. */
export function samplePins(plan: Plan, crew: Pick<Member, "id" | "title">[] = []): Partial<Pin>[] {
  const who = (t: string) => crew.filter((m) => m.title === t).map((m) => m.id);
  const day = (n: number) => addDays(today(), n);
  const g = plan.floors.find((f) => f.level === 0) ?? plan.floors[0];
  const up = plan.floors.find((f) => f.level === 1);
  const kitchen = g.rooms.find((r) => r.type === "kitchen");
  const living = g.rooms.find((r) => r.type === "living");
  const crackWall = g.walls.find((w) => w.exterior && living && w.room_ids.includes(living.id)) ?? g.walls[0];
  const bath = up?.rooms.find((r) => r.type === "bathroom");
  // a note pinned on the exact spot of a bathroom wall, next to the toilet
  const wallNote = (() => {
    for (const f of plan.floors) for (const r of f.rooms.filter((x) => x.type === "bathroom" || x.type === "wc")) for (const side of roomSides(f, r)) {
      const t = attachedToSide(f, side).find((a) => a.f.kind === "toilet");
      if (t) return { element_id: t.f.id, floor_id: f.id, anchor: { view: "wall" as const, side: side.key, x: Math.round(t.to + 250), y: -1150 }, kind: "note" as const, title: "Move toilet 150 mm left, new soil pipe position", tagged: who("Plumber"), due_date: day(3) };
    }
    return null;
  })();
  const site = siteLayout(plan);
  const skip = site.drive ? site.drive[3] : [site.lot[0] + 2000, site.lot[3] - 2000];
  return [
    { element_id: kitchen?.id ?? null, floor_id: g.id, kind: "task", title: "Remove old base cabinets", status: "in_progress", priority: 1, tagged: who("Site lead"), due_date: day(0) },
    { element_id: kitchen?.id ?? null, floor_id: g.id, kind: "task", title: "Cap off the old sink supply lines", priority: 1, tagged: who("Plumber"), due_date: day(-1) },
    { element_id: kitchen?.id ?? null, floor_id: g.id, kind: "task", title: "Rough-in counter outlets", priority: 1, tagged: who("Electrician"), due_date: day(2) },
    { element_id: crackWall?.id ?? null, floor_id: g.id, kind: "issue", title: "Crack above the window, check lintel", priority: 2, close_requirement: "photo", tagged: [...who("Site lead"), ...who("Electrician")], due_date: day(1) },
    { anchor: { view: "site", x: Math.round(skip[0] - 2600), y: Math.round(skip[1] - 2600) }, kind: "note", title: "Skip bin goes here, keep the drive clear" },
    ...(wallNote ? [wallNote] : []),
    ...(bath ? [{ element_id: bath.id, floor_id: up!.id, kind: "material" as const, title: "Order 12 m² floor tile", due_date: day(9), links: [{ title: "Tile supplier", url: "https://example.com/tile" }] }] : []),
  ];
}

export function sampleStates(plan: Plan): ElementState[] {
  const rooms = plan.floors.flatMap((f) => f.rooms);
  const out: ElementState[] = [];
  const mark = (type: string, status: ElementState["status"]) => rooms.filter((r) => r.type === type).forEach((r) => out.push({ element_id: r.id, status }));
  mark("kitchen", "in_progress");
  mark("garage", "existing");
  mark("dining", "done");
  mark("family", "done");
  mark("bathroom", "not_built");
  return out;
}

const COUNTER = new Set(["base_cabinet", "kitchen_sink", "dishwasher", "range"]);

/** Kitchen outlets laid out the way the electrical code asks (NEC 210.52(C)): every counter stretch
 *  12" or wider gets one, no spot on the counter more than 24" from one (so at most 48" apart), and
 *  the sink, range and fridge split the counter into separate stretches. Mounted about 8" above the
 *  worktop. Plus a light switch beside each door into the room. All of them can be dragged. */
export function sampleItems(plan: Plan): ItemInput[] {
  const out: ItemInput[] = [];
  for (const f of plan.floors) for (const r of f.rooms.filter((x) => x.type === "kitchen")) for (const side of roomSides(f, r)) {
    const att = attachedToSide(f, side).filter((a) => a.gap < 120 && (a.f.elevation_mm ?? 0) < 100);
    const top = Math.max(0, ...att.filter((a) => COUNTER.has(a.f.kind)).map((a) => (a.f.height_mm ?? 900)));
    // counter stretches: runs of plain base cabinets between breaks
    let start: number | null = null, end = 0;
    const flush = () => {
      if (start == null) return;
      const len = end - start;
      if (len >= 305) {
        const n = Math.max(1, Math.ceil((len - 1220) / 1220) + 1);
        for (let i = 0; i < n; i++) out.push({ kind: "outlet", label: "GFCI outlet", floor_id: f.id, side: side.key, x: Math.round(n === 1 ? start + len / 2 : start + 300 + ((len - 600) * i) / (n - 1)), y: Math.round(top + 200), note: "Countertop receptacle" });
      }
      start = null;
    };
    for (const a of att) {
      if (a.f.kind === "base_cabinet" || a.f.kind === "dishwasher") {
        if (start == null || a.from - end > 50) { flush(); start = a.from; }
        end = a.to;
      } else flush();
    }
    flush();
    for (const s of side.segments) {
      if (s.kind !== "opening" || !("leaves" in s.el) || s.el.kind === "window") continue;
      const x = s.to + 150 < side.length - 50 ? s.to + 150 : s.from - 150;
      if (x > 50) out.push({ kind: "switch", label: "Light switch", floor_id: f.id, side: side.key, x: Math.round(x), y: 1200, note: null });
    }
  }
  return out;
}
