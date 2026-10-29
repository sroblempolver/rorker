// How the build site saves an account: one row per thing, the thing itself as JSON (see
// supabase/build/). The page turns its jobs into rows to save them and back into jobs when it loads;
// the `build` edge function reads the same rows to open crew and client links.
import type { Billing, Brand } from "@/lib/billing/types";
import type { ElementEdit, ElementState, Job, JobItem, JobMessage, JobStage, Member, Pin, PinComment, PlanRow, PlanRun, ShareLink, ShareAccess, TeamMessage } from "@/lib/data/types";
import type { MaterialLine } from "@/lib/materials/types";

export type RecordKind = "job" | "plan" | "stage" | "pin" | "item" | "edits" | "states" | "run" | "billing" | "material" | "member" | "share" | "comment" | "message" | "note" | "team" | "access" | "settings";
export interface Rec { kind: RecordKind; id: string; job_id: string | null; data: unknown }

/** One job as the page holds it (the parts that are saved). */
export interface SavedJob {
  job: Job; plan: PlanRow | null; stages: JobStage[]; pins: Pin[]; items: JobItem[]; edits: Record<string, ElementEdit>;
  states: ElementState[]; runs: PlanRun[]; billing?: Billing; can3d?: boolean; payoutsConnected?: boolean;
}
/** Account-wide settings: how the company shows on documents and links. */
export interface Settings { brand: Brand; phone: string | null }
export interface SavedAccount {
  jobs: SavedJob[]; members: Member[]; materials: MaterialLine[]; shares: ShareLink[]; settings: Settings | null;
  /** pin threads; photos are stored file paths */
  comments: PinComment[];
  /** contractor and client threads, every job; photos are stored file paths */
  messages: JobMessage[];
  /** the clients' private notes on their map; only their own link shows them */
  notes: Pin[];
  /** the team board (office to crew, crew answers); photos are stored file paths */
  team: TeamMessage[];
  /** who saved which link to their own account (the server writes these) */
  access: ShareAccess[];
}
/** Kinds saved one by one as they're posted (from the page or a link), never by the page's saver. */
export const POSTED: RecordKind[] = ["comment", "message", "note", "team", "access"];
/** What the page's saver writes. */
export type PageSaved = Omit<SavedAccount, "comments" | "messages" | "notes" | "team" | "access">;

/** Rows for everything but what's posted one by one (comments, messages, clients' notes). */
export function toRecords(a: PageSaved): Rec[] {
  const out: Rec[] = [];
  for (const d of a.jobs) {
    const j = d.job.id;
    out.push({ kind: "job", id: j, job_id: j, data: { job: d.job, can3d: d.can3d ?? true, payoutsConnected: d.payoutsConnected ?? false } });
    if (d.plan) out.push({ kind: "plan", id: d.plan.id, job_id: j, data: d.plan });
    for (const s of d.stages) out.push({ kind: "stage", id: s.id, job_id: j, data: s });
    for (const p of d.pins) out.push({ kind: "pin", id: p.id, job_id: j, data: p });
    for (const i of d.items) out.push({ kind: "item", id: i.id, job_id: j, data: i });
    for (const r of d.runs) out.push({ kind: "run", id: r.id, job_id: j, data: r });
    out.push({ kind: "edits", id: j, job_id: j, data: d.edits });
    out.push({ kind: "states", id: j, job_id: j, data: d.states });
    if (d.billing) out.push({ kind: "billing", id: j, job_id: j, data: d.billing });
  }
  for (const m of a.members) out.push({ kind: "member", id: m.id, job_id: null, data: m });
  for (const l of a.materials) out.push({ kind: "material", id: l.id, job_id: l.job_id, data: l });
  for (const l of a.shares) out.push({ kind: "share", id: l.id, job_id: l.job_id, data: l });
  if (a.settings) out.push({ kind: "settings", id: "account", job_id: null, data: a.settings });
  return out;
}

export function fromRecords(rows: Rec[]): SavedAccount {
  const jobs = new Map<string, SavedJob>();
  const of = (kind: RecordKind) => rows.filter((r) => r.kind === kind);
  for (const r of of("job")) {
    const v = r.data as { job: Job; can3d?: boolean; payoutsConnected?: boolean };
    jobs.set(r.id, { job: v.job, can3d: v.can3d, payoutsConnected: v.payoutsConnected, plan: null, stages: [], pins: [], items: [], edits: {}, states: [], runs: [] });
  }
  for (const r of rows) {
    const d = r.job_id ? jobs.get(r.job_id) : undefined;
    if (!d) continue;
    if (r.kind === "plan") { const p = r.data as PlanRow; if (!d.plan || p.id === d.job.current_plan_id) d.plan = p; }
    else if (r.kind === "stage") d.stages.push(r.data as JobStage);
    else if (r.kind === "pin") d.pins.push(r.data as Pin);
    else if (r.kind === "item") d.items.push(r.data as JobItem);
    else if (r.kind === "run") d.runs.push(r.data as PlanRun);
    else if (r.kind === "edits") d.edits = r.data as Record<string, ElementEdit>;
    else if (r.kind === "states") d.states = r.data as ElementState[];
    else if (r.kind === "billing") d.billing = r.data as Billing;
  }
  const comments = of("comment").map((r) => r.data as PinComment).sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const d of jobs.values()) {
    d.stages.sort((a, b) => a.position - b.position);
    d.pins.sort((a, b) => a.number - b.number);
    d.runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
    d.pins = d.pins.map((p) => ({ ...p, comment_count: comments.filter((c) => c.pin_id === p.id).length }));
  }
  const members = of("member").map((r) => r.data as Member)
    .sort((a, b) => Number(b.is_owner) - Number(a.is_owner) || a.full_name.localeCompare(b.full_name));
  return {
    jobs: [...jobs.values()].sort((a, b) => b.job.created_at.localeCompare(a.job.created_at)),
    members, comments,
    notes: of("note").map((r) => r.data as Pin),
    messages: of("message").map((r) => r.data as JobMessage).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    team: of("team").map((r) => r.data as TeamMessage).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    access: of("access").map((r) => r.data as ShareAccess),
    materials: of("material").map((r) => r.data as MaterialLine),
    shares: of("share").map((r) => r.data as ShareLink).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    settings: (of("settings")[0]?.data as Settings | undefined) ?? null,
  };
}

/** A row's key, to tell what changed since the last save. */
export const recKey = (r: Pick<Rec, "kind" | "id">) => `${r.kind}:${r.id}`;
