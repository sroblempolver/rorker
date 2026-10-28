// The job's feed: what's happening now and what's coming up, by who it's on. Built from the open pins
// (tasks, issues, notes, materials), the materials still to get that aren't on the map, and the stages.
import { addDays, daysBetween } from "@/lib/dates";
import type { JobStage, Member, Pin } from "@/lib/data/types";
import { orderBy, qtyText, type MaterialLine } from "@/lib/materials/types";

/** When something is, as a bucket: late, going on now, today, the next 7 days, after that, no date. */
export type When = "now" | "late" | "today" | "week" | "later" | "undated";
export const WHEN_LABEL: Record<When, string> = { now: "Happening now", late: "Late", today: "Today", week: "Next 7 days", later: "Later", undated: "No date" };
const WHEN_ORDER: When[] = ["late", "now", "today", "week", "later", "undated"];

export interface FeedItem {
  key: string;
  /** what to open on a click */
  ref: { pin: string } | { line: string };
  kind: Pin["kind"];
  title: string;
  /** the date it's due (or the order-by date for something still to buy with a lead time) */
  date: string | null;
  when: When;
  /** a word on what the date is: "Due", "Order by", "Needed" */
  dateWord: string;
  inProgress: boolean;
  priority: number;
  /** member ids it's on */
  people: string[];
  element_id: string | null; anchor?: Pin["anchor"];
}

export interface FeedGroup { id: string; title: string; member: Member | null; items: FeedItem[] }

function bucket(date: string | null, inProgress: boolean, today: string): When {
  if (date && date < today) return "late";
  if (inProgress) return "now";
  if (!date) return "undated";
  if (date === today) return "today";
  return date <= addDays(today, 7) ? "week" : "later";
}

const rank = (i: FeedItem) => WHEN_ORDER.indexOf(i.when);
const byWhen = (a: FeedItem, b: FeedItem) => rank(a) - rank(b) || (a.date ?? "9").localeCompare(b.date ?? "9") || b.priority - a.priority;

/** Everything still to do on the job, soonest first. Notes only count when they're on someone or dated. */
export function feedItems(pins: Pin[], lines: MaterialLine[], today: string): FeedItem[] {
  const out: FeedItem[] = [];
  for (const p of pins) {
    if (p.status === "done" || (p.kind === "note" && !p.tagged.length && !p.due_date)) continue;
    const inProgress = p.status === "in_progress";
    out.push({ key: `p${p.id}`, ref: { pin: p.id }, kind: p.kind, title: p.title, date: p.due_date, when: bucket(p.due_date, inProgress, today),
      dateWord: p.kind === "material" ? "Needed" : "Due", inProgress, priority: p.priority, people: p.tagged, element_id: p.element_id, anchor: p.anchor });
  }
  // lines with a pin already show through it
  for (const l of lines) {
    if (l.pin_id || (l.status !== "to_buy" && l.status !== "ordered")) continue;
    const by = l.status === "to_buy" ? orderBy(l) : null;
    const date = by ?? l.needed_by;
    out.push({ key: `l${l.id}`, ref: { line: l.id }, kind: "material", title: `${l.status === "ordered" ? "Get" : "Buy"} ${qtyText(l.qty, l.unit)} ${l.name}`, date,
      when: bucket(date, l.status === "ordered", today), dateWord: by ? "Order by" : "Needed", inProgress: l.status === "ordered", priority: 1,
      people: [...new Set([l.buyer, l.installer].filter(Boolean) as string[])], element_id: l.element_id, anchor: l.anchor ?? undefined });
  }
  return out.sort(byWhen);
}

/** One group per person, the most pressing person first; whatever's on nobody comes last. */
export function byPerson(items: FeedItem[], members: Member[]): FeedGroup[] {
  const groups = members.map((m) => ({ id: m.id, title: m.full_name, member: m, items: items.filter((i) => i.people.includes(m.id)) })).filter((g) => g.items.length);
  groups.sort((a, b) => byWhen(a.items[0], b.items[0]) || b.items.length - a.items.length);
  const known = new Set(members.map((m) => m.id));
  const nobody = items.filter((i) => !i.people.some((p) => known.has(p)));
  return [...groups, ...(nobody.length ? [{ id: "nobody", title: "Not on anyone yet", member: null, items: nobody }] : [])];
}

/** One group per bucket, in time order. */
export function byWhenGroups(items: FeedItem[]): FeedGroup[] {
  return WHEN_ORDER.map((w) => ({ id: w, title: WHEN_LABEL[w], member: null, items: items.filter((i) => i.when === w) })).filter((g) => g.items.length);
}

/** "Today", "Tomorrow", "Wed", "Nov 4", "2 days late". */
export function dayText(date: string, today: string): string {
  const n = daysBetween(today, date);
  if (n < 0) return n === -1 ? "1 day late" : `${-n} days late`;
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  const d = new Date(`${date}T12:00:00`);
  return n < 7 ? d.toLocaleDateString("en-US", { weekday: "short" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The stage going on now and the one after it. */
export function stageNowNext(stages: JobStage[]) {
  const sorted = [...stages].sort((a, b) => a.position - b.position);
  const now = sorted.find((s) => s.status === "active") ?? null;
  const next = sorted.find((s) => s.status === "not_started" && (!now || s.position > now.position)) ?? null;
  return { now, next };
}
