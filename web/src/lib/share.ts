// Shared links: what a team member or one-time sub sees when they open a job link without signing in.
// One function decides it for every backend, so the rule lives in one place: the plan, and only the
// pins that are theirs. No client details, no other pins, no comments, no team contact details.
import type { Company, ElementEdit, Job, JobItem, JobStage, Member, Pin, ShareLink, SharedView, SharedWork } from "@/lib/data/types";
import type { Plan } from "@/lib/plan/types";

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

export type ShareJobData = { company: Company; job: Job; plan: Plan | null; edits: Record<string, ElementEdit>; items: JobItem[]; pins: Pin[]; stages: JobStage[]; members: Member[]; photos?: Record<string, string[]> };

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
  };
}

/** What a link opens. A person's own link shows only the jobs with something for them, the ones with
 *  open tasks first. */
export function shareWork(l: ShareLink, company: Company, jobs: ShareJobData[]): SharedWork | null {
  if (!linkLive(l)) return null;
  const views = jobs.map((d) => shareView(l, d)).filter((v): v is SharedView => !!v);
  const open = (v: SharedView) => v.pins.filter((p) => p.status !== "done").length;
  const shown = l.job_id ? views : views.filter((v) => v.pins.length).sort((a, b) => open(b) - open(a));
  return {
    label: l.label, expires_at: l.expires_at,
    company: { name: company.name, logo_url: company.logo_url, brand_color: company.brand_color, phone: company.phone },
    jobs: shown,
  };
}
