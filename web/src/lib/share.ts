// Shared links: what a team member or one-time sub sees when they open a job link without signing in.
// One function decides it for every backend, so the rule lives in one place: the plan, and only the
// pins that are theirs, plus the materials for their work. No client details, no other pins, no
// comments, no prices, no team contact details.
import type { Company, ElementEdit, Job, JobItem, JobStage, Member, Pin, ShareLink, SharedMaterial, SharedView, SharedWork } from "@/lib/data/types";
import type { Plan } from "@/lib/plan/types";
import type { MaterialLine } from "@/lib/materials/types";

/** A link's token: 24 random bytes, URL-safe. Long enough that it can't be guessed. */
export function newToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function linkLive(l: Pick<ShareLink, "revoked_at" | "expires_at">, now = new Date()): boolean {
  return !l.revoked_at && (!l.expires_at || new Date(l.expires_at) > now);
}

export function linkPins(l: Pick<ShareLink, "member_id" | "pin_ids">, pins: Pin[]): Pin[] {
  return pins.filter((p) => (l.member_id && p.tagged.includes(l.member_id)) || l.pin_ids.includes(p.id));
}

export type ShareJobData = { company: Company; job: Job; plan: Plan | null; edits: Record<string, ElementEdit>; items: JobItem[]; pins: Pin[]; stages: JobStage[]; members: Member[]; photos?: Record<string, string[]>; materials?: MaterialLine[] };

/** The materials a link shows: what the person installs or is picking up, and what's for their tasks. */
export function linkMaterials(l: Pick<ShareLink, "member_id">, d: Pick<ShareJobData, "pins" | "stages" | "members" | "materials">, pinIds: Set<string>): SharedMaterial[] {
  return (d.materials ?? [])
    .filter((m) => m.status !== "returned" && ((l.member_id && (m.installer === l.member_id || m.buyer === l.member_id)) || (m.task_id && pinIds.has(m.task_id))))
    .map((m) => ({
      id: m.id, name: m.name, qty: m.qty, unit: m.unit, status: m.status, task_id: m.task_id,
      task: (m.task_id && d.pins.find((p) => p.id === m.task_id)?.title) || (m.stage_id && d.stages.find((s) => s.id === m.stage_id)?.name) || null,
      needed_by: m.needed_by, store: m.fulfil === "stock" ? "from stock" : m.store, note: m.note,
      buyer: d.members.find((x) => x.id === m.buyer)?.full_name.split(" ")[0] ?? null, you_get: !!l.member_id && m.buyer === l.member_id,
    }));
}

export function shareView(l: ShareLink, d: ShareJobData): SharedView | null {
  if (!linkLive(l) || (l.job_id !== null && l.job_id !== d.job.id)) return null;
  const pins = linkPins(l, d.pins).map((p) => ({ ...p, created_by: null, comment_count: 0 }));
  const tagged = new Set(pins.flatMap((p) => p.tagged));
  return {
    label: l.label, expires_at: l.expires_at,
    company: { name: d.company.name, logo_url: d.company.logo_url, brand_color: d.company.brand_color, phone: d.company.phone },
    job: { id: d.job.id, name: d.job.name, address: d.job.address },
    plan: d.plan, edits: d.edits, items: d.items, pins,
    stages: [...d.stages].sort((a, b) => a.position - b.position).map((s) => ({ name: s.name, status: s.status })),
    people: d.members.filter((m) => tagged.has(m.id)).map((m) => ({ id: m.id, full_name: m.full_name, title: m.title })),
    photos: Object.fromEntries(pins.map((p) => [p.id, d.photos?.[p.id] ?? []]).filter(([, ph]) => ph.length)),
    materials: linkMaterials(l, d, new Set(pins.map((p) => p.id))),
  };
}

/** What a link opens. A person's own link shows only the jobs with something for them, the ones with
 *  open tasks first. */
export function shareWork(l: ShareLink, company: Company, jobs: ShareJobData[]): SharedWork | null {
  if (!linkLive(l)) return null;
  const views = jobs.map((d) => shareView(l, d)).filter((v): v is SharedView => !!v);
  const open = (v: SharedView) => v.pins.filter((p) => p.status !== "done").length;
  const shown = l.job_id ? views : views.filter((v) => v.pins.length || v.materials?.length).sort((a, b) => open(b) - open(a));
  return {
    label: l.label, expires_at: l.expires_at,
    company: { name: company.name, logo_url: company.logo_url, brand_color: company.brand_color, phone: company.phone },
    jobs: shown,
  };
}
