// The build site (build.rorker.com): the Rorker app as one page. Same screens as the real app. Signed in,
// everything is saved to the contractor's account (cloud.ts) and crew and client links open for real;
// "Try it without an account" runs the same screens on sample data in memory, nothing saved.
// New project reads a drawing with the Rorker assistant.
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import housePlan from "@/demo/house-plan.json";
import { DEMO_CREW, sampleItems, samplePins, sampleStates } from "@/demo/sample";
import { AllJobsMap } from "@/components/AllJobsMap";
import { Logo } from "@/components/ui/AuthShell";
import { JobWorkspace } from "@/components/workspace/JobWorkspace";
import { TeamManager, type TeamApi } from "@/components/team/TeamManager";
import type { WorkspaceApi, WorkspaceData } from "@/components/workspace/api";
import { DEFAULT_TEMPLATES } from "@/lib/data/templates";
import { clientMemberId, type Company, type JobItem, type JobMessage, type JobStage, type JobSummary, type Member, type MemberInput, type Pin, type PinComment, type PlanRow, type ShareLink } from "@/lib/data/types";
import { JOB_KEY } from "@/lib/plan/build";
import type { Plan } from "@/lib/plan/types";
import { previewAsk } from "./assistant";
import { SharedWorkView } from "@/components/share/SharedJob";
import { newToken, shareWork } from "@/lib/share";
import { NewProject, type NewProjectResult } from "@/components/newjob/NewProject";
import { PlanBench } from "@/components/bench/PlanBench";
import { ClientMoneyView } from "@/components/billing/ClientMoneyView";
import { ClientPage, type ClientApi } from "@/components/share/ClientPage";
import { clientNote, clientView } from "@/lib/cloud/links";
import type { PlaceTag } from "@/lib/plan/places";
import { unread } from "@/lib/seen";
import type { SavedAccount } from "@/lib/cloud/records";
import type { ClientStart } from "@/components/billing/MoneyPanel";
import type { Brand } from "@/lib/billing/types";
import { SAMPLE_BRAND, sampleBilling } from "@/demo/billing-sample";
import { MoneyOverview } from "@/components/billing/MoneyOverview";
import { sampleOtherJobs } from "@/demo/money-jobs-sample";
import { ShoppingRun } from "@/components/materials/ShoppingRun";
import { PlanPage } from "@/components/newjob/PlanPage";
import { EXTRA_JOBS, sampleMaterials, sampleTasks } from "@/demo/materials-sample";
import { pinSummary, qtyText, type MaterialLine, type MaterialsApi, type MaterialsJob } from "@/lib/materials/types";
import { TeamContext } from "@/components/team/context";
import { FeedbackProvider } from "@/components/ui/feedback";
import { GoToButton, GoToHost, useGoTo, type GoItem } from "@/components/ui/GoTo";
import { JobCards } from "@/components/JobCards";
import { jobGlance } from "@/lib/feed";
import { today } from "@/lib/dates";
import type { Session } from "@supabase/supabase-js";
import * as cloud from "./cloud";
import { AuthScreen, ClientLinkPage, CrewLinkPage, Loading } from "./pages";

/** when this preview was built, so an out-of-date copy in the browser cache is easy to spot */
declare const __BUILD__: string;

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const plan = housePlan as unknown as Plan;

const toMember = (m: MemberInput, id: string, owner: string | false = false): Member => ({
  id, user_id: owner || null, full_name: m.full_name, email: m.email || null, phone: m.phone || null, title: m.title || null, role: owner ? "admin" : m.role, is_owner: !!owner,
  ...(m.role === "employee" && !owner ? { crew: m.crew ?? "employee" } : {}),
});

/** Who the sample job's owner is: the demo's "Company owner", or the person who just made an account. */
type Owner = { name: string; email: string | null; userId: string };

function seed(owner: Owner = { name: "Company owner", email: "owner@demobuilders.test", userId: "you" }): WorkspaceData {
  const jobId = "hadley";
  const members = [toMember({ full_name: owner.name, title: "Owner", email: owner.email, role: "admin" }, "m0", owner.userId), ...DEMO_CREW.map((m, i) => toMember(m, `m${i + 1}`))];
  const stages: JobStage[] = DEFAULT_TEMPLATES[0].stages.map((s, i) => ({
    id: `s${i}`, job_id: jobId, position: i + 1, name: s.name, description: null,
    status: i < 2 ? "done" : i === 2 ? "active" : "not_started", started_at: null, completed_at: null,
  }));
  const pins = samplePins(plan, members).filter((p) => p.kind !== "material").map((p, i) => ({
    id: `p${i + 1}`, job_id: jobId, number: i + 1, element_id: null, floor_id: null, x: null, y: null, kind: "task", title: "", body: null,
    status: "open", priority: 1, due_date: null, tagged: [], close_requirement: "confirm", links: [], created_by: null,
    created_at: now(), closed_at: null, comment_count: 0, ...p,
    // spread over a few stages so the Stages tab has layers to show; the rest are on the whole house
    stage_id: ["s2", "s3", "s6", null][i % 4],
  })) as Pin[];
  // the viewer (the owner) is on the issue too, so "Tagged to me" has something in it
  const issue = pins.find((p) => p.kind === "issue");
  if (issue) issue.tagged = ["m0", ...issue.tagged];
  // tasks the sample materials are for ("for Marco · Kitchen electrical rough-in")
  for (const t of sampleTasks(plan, members)) pins.push({ job_id: jobId, number: pins.length + 1, element_id: null, floor_id: null, x: null, y: null, kind: "task", body: null,
    status: "open", priority: 1, due_date: null, tagged: [], close_requirement: "confirm", stage_id: "s2", links: [], created_by: null, created_at: now(), closed_at: null, comment_count: 0, ...t } as Pin);
  // the sample materials list; lines placed on the house get their teal pin on the map
  const PIN_STATUS = { to_buy: "open", ordered: "open", got: "in_progress", installed: "done", returned: "done" } as const;
  materials.lines = sampleMaterials(plan, jobId, members).map((m, i) => {
    let pin_id: string | null = null;
    if (m.job_id === jobId && m.element_id) {
      pin_id = `pm${i}`;
      pins.push({ id: pin_id, job_id: jobId, number: pins.length + 1, element_id: m.element_id, floor_id: m.floor_id, x: null, y: null, kind: "material", title: `Buy ${qtyText(m.qty, m.unit)} ${m.name}`,
        body: null, status: PIN_STATUS[m.status], priority: 1, due_date: m.needed_by, tagged: [...new Set([m.buyer, m.installer].filter(Boolean) as string[])], close_requirement: "confirm",
        stage_id: m.stage_id, links: [], created_by: null, created_at: now(), closed_at: null, comment_count: 0 });
    }
    return { ...m, id: `ml${i}`, pin_id, receipts: [], created_at: now() };
  });
  // the clients have something to look at on their link, and something to buy
  const client = clientMemberId(jobId);
  pins.push({ id: "pc1", job_id: jobId, number: pins.length + 1, element_id: "G-R04", floor_id: "G", x: null, y: null, kind: "note", title: "Pick your backsplash tile",
    body: "Three samples are on the counter. Tell us which one by Friday so we can order it.", status: "open", priority: 1, due_date: null, tagged: [client], close_requirement: "confirm",
    stage_id: null, links: [], created_by: null, created_at: now(), closed_at: null, comment_count: 0 });
  if (materials.lines[0]) materials.lines.push({ ...materials.lines[0], id: "mlc", job_id: jobId, name: "Cabinet pulls (your pick)", qty: 22, unit: "ea", unit_cost: null, store: null, link: null, sku: null,
    status: "to_buy", buyer: client, installer: null, task_id: null, pin_id: null, note: "128 mm centers", receipts: [], created_at: now() });
  messages.set(jobId, [
    { id: "msg1", job_id: jobId, from: "contractor", author_name: owner.name, body: "Framing passed inspection today. Drywall starts Monday.", photos: [], created_at: new Date(Date.now() - 3_600_000).toISOString() },
    { id: "msg2", job_id: jobId, from: "client", author_name: "Sam and Priya Okafor", body: "@Bedroom 1 › Bed needs to be replaced, the frame is cracked. Can you take it out with the old carpet?", photos: [], created_at: now(),
      places: [{ id: "1-F12", label: "Bedroom 1 › Bed" }] },
  ]);
  const planRow: PlanRow = { id: "plan1", job_id: jobId, version: 1, data: plan, created_at: now() };
  return {
    job: { id: jobId, company_id: "demo", name: "Hadley Road house", address: "14 Hadley Road", client_name: "Sam and Priya Okafor", client_email: null, client_phone: null, job_type: "renovation", status: "active", start_date: null, current_plan_id: "plan1", created_at: now() },
    plan: planRow, stages, pins, states: sampleStates(plan), edits: { [JOB_KEY]: { furnish: "all" } }, can3d: true,
    items: sampleItems(plan).map((it, i) => ({ id: `i${i + 1}`, job_id: jobId, label: null, note: null, created_at: now(), ...it }) as JobItem),
    runs: [{ id: "r1", job_id: jobId, kind: "read", file_name: "house.dwg", status: "needs_answers", error: null, plan_id: "plan1", created_at: now(), finished_at: now(), metrics: {} }],
    members, me: "m0", aiAvailable: false, canShare: true,
    billing: sampleBilling(jobId), brand: BRAND, payoutsConnected: false,
  };
}

/** The materials list across every job in the preview. */
const materials: { lines: MaterialLine[] } = { lines: [] };
function materialsApi(all: () => WorkspaceData[]): MaterialsApi {
  return {
    async list() { return [...materials.lines]; },
    async create(input) {
      const made = input.map((i) => ({ receipts: [], pin_id: null, ...i, id: uid(), created_at: now() }) as MaterialLine);
      materials.lines = [...materials.lines, ...made];
      return made;
    },
    async update(id, patch) {
      materials.lines = materials.lines.map((l) => (l.id === id ? { ...l, ...patch } as MaterialLine : l));
      const l = materials.lines.find((x) => x.id === id)!;
      // keep the line's pin in step, also when it's ticked off from the shopping run
      const d = all().find((j) => j.job.id === l.job_id);
      if (d && l.pin_id) d.pins = d.pins.map((p) => (p.id === l.pin_id ? { ...p, ...pinSummary(materials.lines.filter((x) => x.pin_id === l.pin_id)) } : p));
      return l;
    },
    async remove(id) { materials.lines = materials.lines.filter((l) => l.id !== id); },
  };
}

/** how the company shows on documents and links; the account's own once signed in */
let BRAND: Brand = SAMPLE_BRAND;
let COMPANY: Company = { id: "demo", name: "Demo Builders", logo_url: null, brand_color: "#ff6a1f", phone: "(555) 010-2030", email: null, license_no: null, website: null, address: null };
const shares: ShareLink[] = [];
/** money on the other jobs in the overview (they have no plan in the preview) */
const otherJobs = sampleOtherJobs();
/** What a link opens, across every job in the preview (a person's own link covers them all). */
function sharedWork(jobs: WorkspaceData[], token: string, photos: Map<string, string[]>) {
  const l = shares.find((x) => x.token === token);
  return l ? shareWork(l, COMPANY, jobs.map((d) => ({ company: COMPANY, job: d.job, plan: d.plan?.data ?? null, edits: d.edits, items: d.items, pins: d.pins, stages: d.stages, members: d.members, photos: Object.fromEntries(d.pins.map((p) => [p.id, photos.get(p.id) ?? []])), materials: materials.lines.filter((m) => m.job_id === d.job.id) }))) : null;
}
/** photos posted on pins in the preview, by pin id, so a shared link can show them */
const pinPhotos = new Map<string, string[]>();

/** pin threads in the preview, by pin id */
const comments = new Map<string, PinComment[]>();
/** each job's thread with its client, by job id */
const messages = new Map<string, JobMessage[]>();
/** a message on a job's thread in the preview */
function post(d: WorkspaceData, from: JobMessage["from"], body: string, f: File | null, places: PlaceTag[]) {
  const author = from === "client" ? d.job.client_name || "Client" : team.members.find((m) => m.is_owner)?.full_name ?? "You";
  const list = [...(messages.get(d.job.id) ?? []), { id: uid(), job_id: d.job.id, from, author_name: author, body: body || null, photos: f ? [URL.createObjectURL(f)] : [], created_at: now(), ...(places.length ? { places } : {}) }];
  messages.set(d.job.id, list);
  window.dispatchEvent(new Event("rorker-seen"));
  return list;
}
/** What your clients wrote since you last looked, on the jobs page: who, which job, the place they
 *  tagged; "Show me" opens the job's thread and takes the map there. */
function ClientNews({ jobs, onOpen }: { jobs: WorkspaceData[]; onOpen: (jobId: string, place: PlaceTag | null) => void }) {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); window.addEventListener("rorker-seen", f); return () => window.removeEventListener("rorker-seen", f); }, []);
  const news = jobs.flatMap((d) => {
    const l = unread(messages.get(d.job.id) ?? [], "contractor", `contractor:${d.job.id}`);
    return l.length ? [{ d, l, m: l[l.length - 1] }] : [];
  });
  if (!news.length) return null;
  return (
    <div className="px-4 sm:px-6 pb-4 space-y-1.5" role="status">
      <p className="eyebrow">New from your clients</p>
      {news.map(({ d, l, m }) => {
        const t = m.places?.[0] ?? null;
        return (
          <div key={d.job.id} className="card !rounded-[3px] px-3 py-2.5 flex items-center gap-3">
            <span className="dot bg-accent shrink-0" />
            <p className="flex-1 min-w-0 text-[14px]">
              <span className="font-semibold">{m.author_name}</span> <span className="text-muted">· {d.job.name}{l.length > 1 ? ` · ${l.length} new` : ""}</span>
              {t && <span className="text-muted"> · tagged <span className="text-text font-semibold">{t.label}</span></span>}
              <span className="block text-muted truncate">{m.body?.replace(/@(?=\S)/g, "") ?? "A photo"}</span>
            </p>
            <button className="btn btn-sm btn-primary shrink-0" onClick={() => onOpen(d.job.id, t)}>{t ? "Show me" : "Read"}</button>
          </div>
        );
      })}
    </div>
  );
}
/** the clients' private notes in the preview */
let clientNotes: Pin[] = [];
/** the job's client link: the same one every time */
function clientLink(d: WorkspaceData): ShareLink {
  let l = shares.find((x) => x.audience === "client" && x.job_id === d.job.id && !x.revoked_at);
  if (!l) {
    l = { id: uid(), job_id: d.job.id, token: newToken(), label: d.job.client_name || "Client", member_id: null, pin_ids: [], expires_at: null, revoked_at: null, created_at: now(), audience: "client" };
    shares.unshift(l);
  }
  return l;
}
/** the preview's jobs as an account's saved rows would load, so a client link is built the real way */
function savedAccount(jobs: WorkspaceData[]): SavedAccount {
  return {
    jobs: jobs.map((d) => ({ job: d.job, plan: d.plan, stages: d.stages, pins: d.pins, items: d.items, edits: d.edits, states: d.states, runs: d.runs, billing: d.billing })),
    members: team.members, materials: materials.lines, shares, settings: { brand: BRAND, phone: COMPANY.phone }, comments: [], messages: [...messages.values()].flat(), notes: clientNotes,
  };
}
/** what the client's link shows and does, on the preview's own data */
function demoClient(jobs: () => WorkspaceData[], d: WorkspaceData): { view: ReturnType<typeof clientView>; api: ClientApi } {
  const l = clientLink(d);
  return {
    view: clientView(l, COMPANY, savedAccount(jobs()), Object.fromEntries(d.pins.map((p) => [p.id, pinPhotos.get(p.id) ?? []])), messages.get(d.job.id) ?? []),
    api: {
      thread: { list: async () => messages.get(d.job.id) ?? [], send: async (body, f, places) => post(d, "client", body, f, places) },
      billing: (b) => { d.billing = b; },
      async addNote(n) {
        const pin = clientNote(l, savedAccount(jobs()), n, uid(), now());
        if (!pin) throw new Error("Give the note a title.");
        if (n.shared) d.pins = [...d.pins, pin]; else clientNotes = [...clientNotes, pin];
        return pin;
      },
      async removeNote(id) { clientNotes = clientNotes.filter((n) => n.id !== id); d.pins = d.pins.filter((p) => p.id !== id || p.created_by !== "client"); },
      async got(id, undo) { materials.lines = materials.lines.map((m) => (m.id === id ? { ...m, status: undo ? "to_buy" : "got" } : m)); },
    },
  };
}
/** a photo sent from a shared link: it lands in the pin's thread, as it would in the app */
async function sendSharedPhoto(label: string, pinId: string, file: File) {
  const list = [...(comments.get(pinId) ?? []), { id: uid(), pin_id: pinId, author_id: null, author_name: label, body: `Photo from ${label}`, photos: [URL.createObjectURL(file)], created_at: now() }];
  comments.set(pinId, list);
  pinPhotos.set(pinId, list.flatMap((c) => c.photos));
  return pinPhotos.get(pinId)!;
}

function memoryApi(d: WorkspaceData): WorkspaceApi {
  const renumber = () => { d.stages = d.stages.map((s, i) => ({ ...s, position: i + 1 })); return d.stages; };
  return {
    backHref: "/jobs",
    async setElementState(id, status) { d.states = [...d.states.filter((x) => x.element_id !== id), ...(status ? [{ element_id: id, status }] : [])]; },
    async saveElementEdit(id, data) { if (data) d.edits = { ...d.edits, [id]: data }; else { const { [id]: _, ...rest } = d.edits; void _; d.edits = rest; } },
    async createItem(input) { const it: JobItem = { id: uid(), job_id: d.job.id, label: null, note: null, created_at: now(), ...input }; d.items = [...d.items, it]; return it; },
    async updateItem(id, input) { d.items = d.items.map((i) => (i.id === id ? { ...i, ...input } as JobItem : i)); },
    async deleteItem(id) { d.items = d.items.filter((i) => i.id !== id); },
    async createPin(input) {
      const n = Math.max(0, ...d.pins.map((p) => p.number)) + 1;
      const pin = { id: uid(), job_id: d.job.id, number: n, status: "open", priority: 1, due_date: null, tagged: [], close_requirement: "confirm", stage_id: null, links: [], created_by: null, created_at: now(), closed_at: null, body: null, element_id: null, floor_id: null, x: null, y: null, comment_count: 0, ...input } as Pin;
      d.pins = [...d.pins, pin];
      return pin;
    },
    async updatePin(id, input) {
      const pin = d.pins.find((p) => p.id === id);
      if (input.status === "done" && pin?.close_requirement === "photo" && !(comments.get(id) ?? []).some((c) => c.photos.length)) throw new Error("This one needs a photo before it can be closed.");
      d.pins = d.pins.map((p) => (p.id === id ? { ...p, ...input } as Pin : p));
    },
    async deletePin(id) { d.pins = d.pins.filter((p) => p.id !== id); },
    async listComments(id) { return comments.get(id) ?? []; },
    async addComment(id, body, photos) {
      const list = [...(comments.get(id) ?? []), { id: uid(), pin_id: id, author_id: null, author_name: "You", body: body || null, photos: photos.map((f) => URL.createObjectURL(f)), created_at: now() }];
      pinPhotos.set(id, list.flatMap((c) => c.photos));
      comments.set(id, list);
      return list;
    },
    async setStageStatus(id, status) { d.stages = d.stages.map((s) => (s.id === id ? { ...s, status } : s)); return d.stages; },
    async addStage(name) { d.stages = [...d.stages, { id: uid(), job_id: d.job.id, position: d.stages.length + 1, name: name.trim() || "New stage", description: null, status: "not_started", started_at: null, completed_at: null }]; return d.stages; },
    async renameStage(id, name) { d.stages = d.stages.map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s)); return d.stages; },
    async deleteStage(id) { d.stages = d.stages.filter((s) => s.id !== id); return renumber(); },
    async moveStage(id, dir) {
      const i = d.stages.findIndex((s) => s.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= d.stages.length) return d.stages;
      const next = [...d.stages];
      [next[i], next[j]] = [next[j], next[i]];
      d.stages = next;
      return renumber();
    },
    async uploadPlan() { throw new Error("In the preview, start a New project from your drawing instead."); },
    async answer(_id, answers) {
      const p = d.plan!;
      const data = structuredClone(p.data);
      data.questions.forEach((q) => { if (answers[q.id]) q.answer = answers[q.id]; });
      // the roof answer changes the 3D straight away, as the plan reader's rules would
      const roof = data.questions.find((q) => q.element_ids.includes("roof") && q.answer)?.answer?.toLowerCase().match(/hip|gable|flat/)?.[0];
      if (roof) data.building.exterior.roof = roof;
      d.plan = { ...p, data };
    },
    async refreshPlan() { return { runs: d.runs, plan: d.plan }; },
    async listShareLinks() { return [...shares]; },
    async createShareLink(input) {
      const l: ShareLink = { id: uid(), job_id: d.job.id, token: newToken(), label: input.label, member_id: input.member_id ?? null, pin_ids: input.pin_ids ?? [], expires_at: input.expires_at ?? null, revoked_at: null, created_at: now() };
      if (!l.member_id && !l.pin_ids.length) throw new Error("Pick the tasks they should see.");
      shares.unshift(l);
      return l;
    },
    async revokeShareLink(id) { const l = shares.find((x) => x.id === id); if (l) l.revoked_at = now(); },
    async personLink(memberId) {
      if (memberId === clientMemberId(d.job.id)) return clientLink(d);
      const have = shares.find((l) => !l.job_id && l.member_id === memberId && !l.revoked_at);
      if (have) return have;
      const m = d.members.find((x) => x.id === memberId);
      if (!m) throw new Error("That person isn't on your team.");
      const l: ShareLink = { id: uid(), job_id: null, company_id: COMPANY.id, token: newToken(), label: m.title ? `${m.full_name} (${m.title})` : m.full_name, member_id: memberId, pin_ids: [], expires_at: null, revoked_at: null, created_at: now() };
      shares.unshift(l);
      return l;
    },
    shareUrl: (token) => `https://app.rorker.com/${shares.find((l) => l.token === token)?.audience === "client" ? "c" : "s"}/${token}`,
    client: {
      thread: {
        async list() { return messages.get(d.job.id) ?? []; },
        async send(body, f, places) { return post(d, "contractor", body, f, places); },
      },
      setCanAdd(on) { d.job = { ...d.job, client_can_add: on }; },
      open() {},
    },
    money: {
      save(b) { d.billing = b; },
      async connectPayouts() { await new Promise((r) => setTimeout(r, 600)); d.payoutsConnected = true; },
    },
  };
}

/** The team is the company's: one list, shared by every job. */
const team: { members: Member[] } = { members: [] };
function teamApi(jobs: () => WorkspaceData[], changed: () => void): TeamApi {
  const set = (next: Member[]) => {
    team.members = [...next].sort((a, b) => Number(b.is_owner) - Number(a.is_owner) || a.full_name.localeCompare(b.full_name));
    for (const d of jobs()) d.members = team.members;
    changed();
    return team.members;
  };
  return {
    async add(input) {
      if (!input.full_name.trim()) throw new Error("Add a name.");
      if (input.email && team.members.some((m) => m.email?.toLowerCase() === input.email!.toLowerCase())) throw new Error("Someone on the team already uses that email.");
      return set([...team.members, toMember(input, uid())]);
    },
    async update(id, input) {
      return set(team.members.map((m) => {
        if (m.id !== id) return m;
        const role = m.is_owner ? "admin" : input.role ?? m.role;
        const { crew, ...rest } = { ...m, ...input, role } as Member;
        return (role === "employee" ? { ...rest, crew: crew ?? "employee" } : rest) as Member;
      }));
    },
    async remove(id) {
      if (team.members.find((m) => m.id === id)?.is_owner) throw new Error("The owner stays on the team.");
      for (const d of jobs()) d.pins = d.pins.map((p) => ({ ...p, tagged: p.tagged.filter((x) => x !== id) }));
      return set(team.members.filter((m) => m.id !== id));
    },
  };
}

function summary(d: WorkspaceData): JobSummary {
  const plan = d.plan?.data;
  const g = plan ? plan.floors.find((f) => f.level === 0) ?? plan.floors[0] : null;
  return {
    ...d.job, open_pins: d.pins.filter((p) => p.status !== "done").length, stages_done: d.stages.filter((s) => s.status === "done").length,
    stages_total: d.stages.length, current_stage: d.stages.find((s) => s.status === "active")?.name ?? null,
    footprint: g?.footprint ?? null, floors: plan?.floors.length ?? 0, size_mm: plan?.building.size_mm ?? null, run_status: d.runs[0]?.status ?? null,
  };
}

/** A job made by the New project assistant, on the same team as the sample job. */
function fromAssistant(r: NewProjectResult, team: Member[]): WorkspaceData {
  const jobId = uid();
  const tpl = DEFAULT_TEMPLATES.find((t) => t.job_type === r.job.job_type) ?? DEFAULT_TEMPLATES[0];
  const planRow: PlanRow | null = r.plan ? { id: uid(), job_id: jobId, version: 1, data: r.plan, created_at: now() } : null;
  return {
    job: { id: jobId, company_id: "demo", ...r.job, status: "active", current_plan_id: planRow?.id ?? null, created_at: now() },
    plan: planRow, stages: tpl.stages.map((s, i) => ({ id: uid(), job_id: jobId, position: i + 1, name: s.name, description: null, status: "not_started", started_at: null, completed_at: null })),
    pins: [], states: [], edits: r.furnish !== undefined ? { [JOB_KEY]: { furnish: r.furnish } } : {}, can3d: true, items: [],
    runs: planRow ? [{ id: uid(), job_id: jobId, kind: "read", file_name: r.plan!.source.filename || "Your files", status: r.plan!.questions.length ? "needs_answers" : "done", error: null, plan_id: planRow.id, created_at: now(), finished_at: now(), metrics: {} }] : [],
    members: team, me: "m0", aiAvailable: false, canShare: true,
    billing: { quotes: [], invoices: [], payments: [] }, brand: BRAND, payoutsConnected: false,
  };
}

type Page = "jobs" | "job" | "plan" | "team" | "shared" | "new" | "client" | "money" | "shop" | "bench";

/** A small job with no drawing yet (the materials sample spreads across these too). */
function plainJob(j: (typeof EXTRA_JOBS)[number], team: Member[]): WorkspaceData {
  const tpl = DEFAULT_TEMPLATES.find((t) => t.job_type === j.job_type) ?? DEFAULT_TEMPLATES[0];
  return {
    job: { ...j, company_id: "demo", client_email: null, client_phone: null, status: "active", start_date: null, current_plan_id: null, created_at: now() },
    plan: null, stages: tpl.stages.map((s, i) => ({ id: uid(), job_id: j.id, position: i + 1, name: s.name, description: null, status: i === 0 ? "active" : "not_started", started_at: null, completed_at: null })),
    pins: [], states: [], edits: {}, can3d: true, items: [], runs: [], members: team, me: "m0", aiAvailable: false, canShare: true,
  };
}

/** The sample jobs: the house with its drawing, tasks, money and materials, and three small jobs. */
function sampleJobs(owner?: Owner): WorkspaceData[] {
  const house = seed(owner);
  team.members = house.members;
  return [house, ...EXTRA_JOBS.map((j) => plainJob(j, house.members))];
}

/** Each screen has its own address (#/jobs, #/job/hadley ...) so the browser's back button, a refresh
 * and a copied link all land where you were. */
function fromHash(): { page: Page; id?: string } {
  const [a, b] = location.hash.replace(/^#\/?/, "").split("/");
  if (a === "plan") return { page: "plan", id: b };
  if (a === "jobs" || a === "team" || a === "new" || a === "shared" || a === "money" || a === "shop" || a === "bench") return { page: a };
  return { page: "job", id: a === "job" ? b : undefined };
}
const hashFor = (page: Page, id: string) => (page === "job" ? `#/job/${id}` : page === "plan" && id ? `#/plan/${id}` : `#/${page}`);
const TITLES: Partial<Record<Page, string>> = { jobs: "Jobs", plan: "Plan", team: "Team", new: "New project", shared: "Shared link", money: "Money", shop: "Shopping", client: "Client view", bench: "Plan tests" };

/** Signed in: the account and the saver that writes every change to it. */
interface CloudBoot { account: cloud.Account; saver: cloud.Saver; email: string | null; name: string }

/** Where a link opens: this same page, on the link's own address. */
const linkBase = () => `${location.origin}${location.pathname.replace(/app\.html$/, "")}`;
/** api methods that only read, so they don't need a save after */
const READS = new Set(["listComments", "listShareLinks", "refreshPlan", "shareUrl", "openShare", "ask", "afterAssistant", "openShopping", "list", "openClient", "open"]);
/** Every change through the api is followed by a save. */
function saving<T extends object>(api: T, poke: () => void): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(api)) {
    if (typeof v === "function" && !READS.has(k)) out[k] = (...args: unknown[]) => {
      const r = (v as (...a: unknown[]) => unknown).apply(api, args);
      if (r instanceof Promise) void r.then(poke, () => {}); else poke();
      return r;
    };
    else if (v && typeof v === "object" && !Array.isArray(v) && (k === "money" || k === "materials" || k === "client")) out[k] = saving(v as object, poke);
    else out[k] = v;
  }
  return out as T;
}

/** what the saver writes: everything the page holds for the account */
let liveJobs: () => WorkspaceData[] = () => [];
const snapshot = () => ({
  jobs: liveJobs().map((d) => ({ job: d.job, plan: d.plan, stages: d.stages, pins: d.pins, items: d.items, edits: d.edits, states: d.states, runs: d.runs, billing: d.billing, can3d: d.can3d, payoutsConnected: d.payoutsConnected })),
  members: team.members, materials: materials.lines, shares: [...shares], settings: { brand: BRAND, phone: COMPANY.phone },
});

function App({ initial, signedIn }: { initial: WorkspaceData[]; signedIn?: CloudBoot }) {
  const [page, setPageRaw] = useState<Page>(() => fromHash().page);
  const [share, setShare] = useState<{ token: string; pin?: string } | null>(null);
  const [client, setClient] = useState<ClientStart>(null);
  const [clientPin, setClientPin] = useState<string | null>(null);
  /** open the job on its Client tab, at the place the client tagged (from a "new from your client" notice) */
  const [clientStart, setClientStart] = useState<{ place: PlaceTag | null } | null>(null);
  const [tier, setTier] = useState<Brand["tier"]>("standard");
  const [jobs, setJobs] = useState<WorkspaceData[]>(initial);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  liveJobs = () => jobsRef.current;
  const poke = useMemo(() => () => signedIn?.saver.poke(), [signedIn]);
  const [saveState, setSaveState] = useState<cloud.SaveState>("saved");
  useEffect(() => {
    const on = (e: Event) => setSaveState((e as CustomEvent<cloud.SaveState>).detail);
    window.addEventListener("rorker-save", on);
    return () => window.removeEventListener("rorker-save", on);
  }, []);
  const mapi = useMemo(() => saving(materialsApi(() => jobsRef.current), poke), [poke]);
  const mjobs: MaterialsJob[] = jobs.map((d) => ({ id: d.job.id, name: d.job.name, address: d.job.address,
    tasks: d.pins.filter((p) => p.kind === "task").map((p) => ({ id: p.id, number: p.number, title: p.title, tagged: p.tagged, stage_id: p.stage_id })),
    stages: d.stages.map((x) => ({ id: x.id, name: x.name })) }));
  const [, setMver] = useState(0);
  const [activeId, setActiveIdRaw] = useState(() => fromHash().id ?? initial[0]?.job.id ?? "");
  /** go somewhere: a new history entry first, so the screen that opens builds on it */
  const go = (p: Page, id = activeId) => {
    if (p !== "job") setClientStart(null);
    const h = hashFor(p, id);
    if (location.hash !== h) history.pushState(null, "", h);
    setPageRaw(p);
    setActiveIdRaw(id);
  };
  const setPage = (p: Page) => go(p);
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    if (!location.hash || (page === "job" && !jobs.some((j) => j.job.id === activeId))) history.replaceState(history.state, "", hashFor(page, activeId));
    const pop = () => { const r = fromHash(); setPageRaw(r.page); if (r.id) setActiveIdRaw(r.id); };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (TITLES[page]) document.title = `${TITLES[page]} · Rorker`; }, [page]);
  const active: WorkspaceData | undefined = jobs.find((j) => j.job.id === activeId) ?? jobs[0];
  // the assistant changes the job behind the screen's back: hand the workspace a fresh copy after
  const [ver, setVer] = useState(0);
  const [fromClient, setFromClient] = useState(false);
  const current = useMemo(() => active && ({ ...active, startOnMoney: fromClient, startOnClient: clientStart ?? undefined, materials: { lines: materials.lines, jobs: mjobs } }), [active, ver, fromClient, clientStart, jobs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const api = useMemo(() => {
    if (!active) return null;
    const a = memoryApi(active);
    if (signedIn) {
      const acct = signedIn.account.id;
      const url = (token: string) => `${linkBase()}#/${shares.find((l) => l.token === token)?.audience === "client" ? "c" : "s"}/${token}`;
      Object.assign(a, {
        async listComments(id: string) { return cloud.listComments(acct, id); },
        async addComment(id: string, body: string, files: File[]) {
          await cloud.addComment(acct, active.job.id, { pin_id: id, author_id: "m0", author_name: signedIn.name, body: body || null }, files);
          const list = await cloud.listComments(acct, id);
          active.pins = active.pins.map((p) => (p.id === id ? { ...p, comment_count: list.length } : p));
          return list;
        },
        shareUrl: (token: string) => url(token),
      });
      const base = a.updatePin;
      // a photo sent from a crew link is in the database, not in this page: look before closing
      a.updatePin = async (id, input) => { if (input.status === "done") comments.set(id, await cloud.listComments(acct, id)); return base(id, input); };
      a.openShare = (token, pin) => { window.open(`${url(token)}${pin ? `?pin=${pin}` : ""}`, "_blank", "noopener"); };
      const openClient = (start: ClientStart) => {
        const l = clientLink(active);
        // a new link has to be saved before the client's page can open it
        void signedIn.saver.flush().then(() => window.open(`${url(l.token)}${start ? `?open=${start.kind}:${start.id}` : ""}`, "_blank", "noopener"));
      };
      a.money = a.money && { ...a.money, openClient };
      a.client = a.client && { ...a.client, open: () => openClient(null), thread: {
        list: () => cloud.listMessages(acct, active.job.id).then((l) => { messages.set(active.job.id, l); return l; }),
        async send(body, f, places) { await cloud.addMessage(acct, active.job.id, signedIn.name, body, f, places); return cloud.listMessages(acct, active.job.id); },
      } };
    }
    const saved = saving(a, poke);
    const showClient = (start: ClientStart, pin?: string) => { setClient(start); setClientPin(pin ?? null); goRef.current("client"); };
    return { ...saved, ask: previewAsk(active, saved), afterAssistant: () => { setVer((n) => n + 1); poke(); },
      openShare: signedIn ? a.openShare : (token: string, pin?: string) => {
        if (shares.find((l) => l.token === token)?.audience === "client") return showClient(null, pin);
        setShare({ token, pin }); goRef.current("shared");
      },
      client: saved.client && { ...saved.client, setCanAdd: (on: boolean) => { saved.client!.setCanAdd(on); setVer((n) => n + 1); }, ...(signedIn ? {} : { open: () => showClient(null) }) },
      money: saved.money && { ...saved.money, openClient: signedIn ? a.money!.openClient : (start: ClientStart) => showClient(start) },
      materials: mapi, openShopping: () => goRef.current("shop") };
  }, [active, mapi, poke, signedIn]);
  const teamA = useMemo(() => teamApi(() => jobsRef.current, poke), [poke]);
  const [, bump] = useState(0);
  useEffect(() => {
    const go = (e: Event) => {
      const href = (e as CustomEvent<string>).detail;
      if (href === "/jobs/new") goRef.current("new");
      else if (href.startsWith("/jobs/")) goRef.current("job", href.split("/")[2]);
      else goRef.current("jobs");
      bump((n) => n + 1);
    };
    window.addEventListener("preview-nav", go);
    return () => window.removeEventListener("preview-nav", go);
  }, []);
  const created = (r: NewProjectResult) => {
    const d = fromAssistant(r, team.members);
    setJobs((js) => [d, ...js]);
    go("job", d.job.id);
    poke();
  };
  // the app's own places in the Go to box (Ctrl+K): every job and every screen
  const goItems = useMemo<GoItem[]>(() => [
    ...jobs.map((d) => ({ id: `job:${d.job.id}`, group: "Jobs", label: d.job.name, sub: [d.job.address, d.job.client_name].filter(Boolean).join(" · "), keywords: d.job.client_name ?? "", run: () => { setFromClient(false); go("job", d.job.id); } })),
    { id: "page:jobs", group: "Go to", label: "All jobs", run: () => setPage("jobs") },
    { id: "page:plan", group: "Go to", label: "Plan", sub: "change a job's plan: walls, doors, furniture", run: () => go("plan") },
    { id: "page:money", group: "Go to", label: "Money", sub: "quotes, invoices, who owes what", run: () => setPage("money") },
    { id: "page:shop", group: "Go to", label: "Shopping", sub: "everything to buy, by store", run: () => setPage("shop") },
    { id: "page:team", group: "Go to", label: "Team", run: () => setPage("team") },
    { id: "page:new", group: "Go to", label: "New project", sub: "from a drawing, PDF or photo", run: () => setPage("new") },
    { id: "page:bench", group: "Go to", label: "Plan tests", sub: "how well the plan reader reads real plans", run: () => setPage("bench") },
  ], [jobs]); // eslint-disable-line react-hooks/exhaustive-deps
  useGoTo("app", goItems);
  const tab = (p: Page, label: string) => (
    <button onClick={() => { setFromClient(false); setPage(p); }} className={`shrink-0 px-1.5 sm:px-3 h-9 rounded-[3px] font-display text-[13px] sm:text-[15px] font-bold tracking-[0.06em] sm:tracking-[0.1em] uppercase ${page === p ? "text-accent bg-panel-2" : "text-muted hover:text-text"}`}>{label}</button>
  );
  const shown: Page = page === "job" && !active ? "jobs" : page;
  return (
    <div className="h-full flex flex-col">
      <header className="h-14 shrink-0 border-b border-line bg-panel flex items-center gap-2 sm:gap-4 px-3 sm:px-4">
        <button onClick={() => setPage("jobs")} aria-label="All jobs"><Logo size={20} /></button>
        <nav className="hidden sm:flex items-center gap-1 sm:ml-2 min-w-0 overflow-x-auto">{tab("jobs", "Jobs")}{tab("plan", "Plan")}{tab("money", "Money")}{tab("shop", "Shopping")}{tab("team", "Team")}</nav>
        <GoToButton className="ml-auto" />
        <button onClick={() => setPage("new")} className={`btn btn-sm ${page === "new" ? "btn-ghost" : "btn-primary"}`}>+<span className="hidden sm:inline"> New project</span></button>
        {signedIn ? <AccountChip c={signedIn} state={saveState} /> : (
          <span className="chip hidden md:inline-flex" title={`Build ${__BUILD__}`}><span>Sample data, nothing is saved</span><button className="underline" onClick={() => { if (OPEN_DEMO) { location.href = "/accounts/"; return; } location.hash = ""; location.reload(); }}>Sign in</button></span>
        )}
      </header>
      <GoToHost />
      {/* on a phone the main places sit at the bottom, under the thumb */}
      <nav className="mobile-nav sm:hidden fixed bottom-0 inset-x-0 z-30 h-14 pb-[env(safe-area-inset-bottom)] box-content bg-panel border-t border-line grid grid-cols-5" aria-label="Main">
        {([["jobs", "Jobs", "M3 21V9l9-6 9 6v12M9 21v-7h6v7"], ["plan", "Plan", "M3 3h18v18H3zM3 12h9M12 3v13M16 12h5"], ["money", "Money", "M3 6h18v12H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"], ["shop", "Shopping", "M5 7h14l-1.5 12h-11zM9 7a3 3 0 0 1 6 0"], ["team", "Team", "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6.5 6.5 0 0 1 3.5 6"]] as const).map(([p, label, d]) => {
          const on = page === p || (p === "jobs" && page === "job");
          return (
            <button key={p} onClick={() => { setFromClient(false); setPage(p); }} aria-current={on ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 font-display text-[11.5px] font-bold tracking-[0.08em] uppercase ${on ? "text-accent" : "text-muted"}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
              {label}
            </button>
          );
        })}
      </nav>
      <div key={shown === "job" ? `job-${active!.job.id}` : shown} className="flex-1 min-h-0 flex flex-col fade-in pb-14 sm:pb-0">
      {shown === "new" ? (
        <NewProject onCreate={created} onCancel={() => setPage("jobs")} />
      ) : shown === "plan" ? (
        <PlanPage jobs={jobs.map((d) => ({ id: d.job.id, name: d.job.name, address: d.job.address, plan: d.plan?.data ?? null }))} jobId={activeId || null}
          onPick={(id) => go("plan", id)} onOpenJob={(id) => { setVer((n) => n + 1); go("job", id); }} onNew={() => setPage("new")}
          onSave={(id, plan) => {
            const d = jobsRef.current.find((j) => j.job.id === id);
            if (!d) return;
            d.plan = d.plan ? { ...d.plan, version: d.plan.version + 1, data: plan } : { id: uid(), job_id: id, version: 1, data: plan, created_at: now() };
            d.job = { ...d.job, current_plan_id: d.plan.id };
            setJobs((js) => [...js]);
            setVer((n) => n + 1);
            poke();
          }} />
      ) : shown === "bench" ? (
        <div className="flex-1 overflow-y-auto"><PlanBench /></div>
      ) : shown === "money" ? (
        <div className="flex-1 overflow-y-auto">
          <MoneyOverview rows={[...jobs.filter((j) => j.billing).map((j) => ({ jobId: j.job.id, jobName: j.job.name, clientName: j.job.client_name, address: j.job.address, billing: j.billing! })), ...(signedIn ? [] : otherJobs)]}
            onOpenJob={(id) => { if (jobs.some((j) => j.job.id === id)) { setVer((n) => n + 1); go("job", id); } }} />
        </div>
      ) : shown === "client" && active ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-line bg-panel text-[13px]">
            <span className="text-muted">Branding on client documents:</span>
            {(["standard", "premium"] as const).map((t) => (
              <button key={t} onClick={() => setTier(t)} className={`btn btn-sm ${tier === t ? "btn-primary" : ""}`}>{t === "standard" ? "Standard (Powered by Rorker)" : "Premium (white label)"}</button>
            ))}
          </div>
          {(() => {
            const c = demoClient(() => jobsRef.current, active);
            if (!c.view) return <p className="p-6 text-muted">This job has no client page.</p>;
            return <ClientPage key={`${client?.id ?? "home"}-${clientPin}-${tier}`} view={{ ...c.view, brand: { ...c.view.brand, tier } }} api={c.api} start={client} pin={clientPin} seenKey={`client-demo:${active.job.id}`}
              onBack={() => { setFromClient(!!client); setVer((n) => n + 1); setPage("job"); }} />;
          })()}
        </div>
      ) : shown === "shared" && share ? (
        <div className="flex-1 min-h-0 flex flex-col lg:overflow-hidden overflow-y-auto">
          {(() => { const v = sharedWork(jobs, share.token, pinPhotos); return v ? <SharedWorkView key={share.token + share.pin} work={v} pin={share.pin} send={(pin, f) => sendSharedPhoto(v.label, pin, f)} onBack={() => { setVer((n) => n + 1); setPage("job"); }} /> : <p className="p-6 text-muted">This link was turned off. <button className="underline" onClick={() => setPage("job")}>Back</button></p>; })()}
        </div>
      ) : shown === "shop" ? (
        <div className="flex-1 overflow-y-auto">
          <TeamContext.Provider value={{ members: team.members, me: "m0" }}>
            <ShoppingRun lines={materials.lines} jobs={mjobs} members={team.members} me="m0"
              onUpdate={(ids, patch) => { void Promise.all(ids.map((id) => mapi.update(id, patch))).then(() => { setMver((n) => n + 1); setVer((n) => n + 1); }); }}
              onOpenJob={(id) => { setVer((n) => n + 1); go("job", id); }} />
          </TeamContext.Provider>
        </div>
      ) : shown === "team" ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 py-8 max-w-3xl w-full mx-auto">
            <p className="eyebrow">{COMPANY.name}</p>
            <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em] mb-1">Team</h1>
            <p className="text-muted mb-6">Everyone who works your jobs. Tag them on any pin so they know where to go and what to do. Each person gets one link with all their tasks; copy it from any task they&apos;re tagged on.</p>
            <TeamManager initial={team.members} canManage meId="m0" api={teamA} />
          </div>
        </div>
      ) : shown === "jobs" ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 pt-6 pb-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="eyebrow">All jobs</p>
              <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em]">{jobs.length} active job{jobs.length === 1 ? "" : "s"}</h1>
              <p className="text-muted text-sm">Click a building or a card to go inside. Press <kbd className="kbd !h-5 !text-[10.5px]">/</kbd> to jump straight to any job, room or pin.</p>
            </div>
          </div>
          <ClientNews jobs={jobs} onOpen={(id, place) => { setFromClient(false); go("job", id); setClientStart({ place }); }} />
          {jobs.length ? (
            <>
              <div className="px-4 sm:px-6"><AllJobsMap jobs={jobs.map(summary)} /></div>
              <div className="px-4 sm:px-6 py-6"><JobCards jobs={jobs.map((d) => ({ ...summary(d), ...jobGlance(d.pins, materials.lines.filter((l) => l.job_id === d.job.id), today()) }))} /></div>
            </>
          ) : (
            <div className="px-4 sm:px-6 py-6">
              <div className="card p-6 max-w-lg">
                <p className="font-display text-lg font-bold mb-1">No jobs yet</p>
                <p className="text-muted text-sm mb-4">Start one from a drawing, a PDF or a photo of the plan, or describe it.</p>
                <button className="btn btn-primary" onClick={() => setPage("new")}>New project</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col lg:overflow-hidden overflow-y-auto">
          <JobWorkspace key={active!.job.id} data={current!} api={api!} onAllJobs={() => setPage("jobs")} />
        </div>
      )}
      </div>
    </div>
  );
}

/** Who's signed in, whether the last change is saved, and sign out. */
function AccountChip({ c, state }: { c: CloudBoot; state: cloud.SaveState }) {
  const [open, setOpen] = useState(false);
  const label = state === "saving" ? "Saving…" : state === "error" ? "Not saved" : "Saved";
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={`chip ${state === "error" ? "!text-red !border-red" : ""}`} title={`Build ${__BUILD__}`} aria-expanded={open}>
        <span className={`w-2 h-2 rounded-full ${state === "saved" ? "bg-green" : state === "saving" ? "bg-amber" : "bg-red"}`} />
        <span className="hidden md:inline">{label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 card p-3 w-64 space-y-2 text-[13px] shadow-xl">
          <p className="font-medium truncate">{c.account.name}</p>
          <p className="text-muted truncate">{c.email}</p>
          <p className="text-muted">{state === "error" ? "The last change didn't save. Check your connection." : state === "saving" ? "Saving your last change…" : "Everything is saved to your account."}</p>
          {state === "error" && <button className="btn btn-sm w-full" onClick={() => void c.saver.flush()}>Try again</button>}
          <button className="btn btn-ghost btn-sm w-full" onClick={async () => { await c.saver.flush(); await cloud.signOut(); location.hash = ""; location.reload(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

/** A link's own address: #/s/<token> for crew, #/c/<token> for a client, with ?pin= or ?open= after. */
function linkRoute(): { kind: "s" | "c"; token: string; params: URLSearchParams } | null {
  const m = location.hash.match(/^#\/(s|c)\/([A-Za-z0-9_-]{16,64})(?:\?(.*))?$/);
  return m ? { kind: m[1] as "s" | "c", token: m[2], params: new URLSearchParams(m[3] ?? "") } : null;
}

// build.rorker.com itself stays the open demo (no sign-in); accounts live at build.rorker.com/accounts/
// until they're ready for everyone. Shared crew and client links open anywhere.
const OPEN_DEMO = location.hostname === "build.rorker.com" && !location.pathname.startsWith("/accounts");

type Boot = { kind: "loading" } | { kind: "auth"; error?: string } | { kind: "app"; jobs: WorkspaceData[]; signedIn?: CloudBoot };

/** Open the signed-in person's account; a brand-new account gets the sample jobs to start from. */
async function openAccount(s: Session): Promise<Boot> {
  const { account } = await cloud.myAccount(s);
  const { saved, rows } = await cloud.loadAccount(account.id);
  const name = (s.user.user_metadata?.full_name as string | undefined) || s.user.email?.split("@")[0] || "Owner";
  BRAND = saved.settings?.brand ?? { ...SAMPLE_BRAND, name: account.name, phone: null, email: s.user.email ?? null, address: null, license_no: null };
  COMPANY = { ...COMPANY, id: account.id, name: BRAND.name, phone: BRAND.phone, brand_color: BRAND.brand_color, logo_url: BRAND.logo_url };
  const fresh = !rows.some((r) => r.kind === "member");
  let jobs: WorkspaceData[];
  if (fresh) {
    // the house, its tasks, money and materials, and the crew, to start from (and delete when done)
    jobs = sampleJobs({ name, email: s.user.email ?? null, userId: s.user.id });
  } else {
    team.members = saved.members;
    materials.lines = saved.materials;
    messages.clear();
    for (const m of saved.messages) messages.set(m.job_id, [...(messages.get(m.job_id) ?? []), m]);
    shares.splice(0, shares.length, ...saved.shares);
    jobs = saved.jobs.map((d) => ({ ...d, members: team.members, me: account.memberId, aiAvailable: false, canShare: true, brand: BRAND }));
  }
  const saver = new cloud.Saver(account.id, snapshot, (st) => window.dispatchEvent(new CustomEvent("rorker-save", { detail: st })), rows);
  const signedIn: CloudBoot = { account, saver, email: s.user.email ?? null, name };
  if (fresh) { liveJobs = () => jobs; await saver.flush(); await cloud.putMessages(account.id, [...messages.values()].flat()); }
  return { kind: "app", jobs, signedIn };
}

function Root() {
  const [link, setLink] = useState(linkRoute);
  const [boot, setBoot] = useState<Boot>(() => (OPEN_DEMO ? { kind: "app", jobs: sampleJobs() } : { kind: "loading" }));
  useEffect(() => {
    const on = () => setLink(linkRoute());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const start = async (s: Session | null) => {
    if (!s) { setBoot({ kind: "auth" }); return; }
    setBoot({ kind: "loading" });
    try { setBoot(await openAccount(s)); } catch (e) { setBoot({ kind: "auth", error: e instanceof Error ? e.message : "Couldn't open your account." }); }
  };
  useEffect(() => { if (!link && !OPEN_DEMO) void cloud.currentSession().then(start); }, [!link]); // eslint-disable-line react-hooks/exhaustive-deps
  if (link) return link.kind === "c"
    ? <ClientLinkPage token={link.token} open={link.params.get("open")} pin={link.params.get("pin")} />
    : <CrewLinkPage token={link.token} pin={link.params.get("pin")} />;
  if (boot.kind === "loading") return <Loading />;
  if (boot.kind === "auth") return <AuthScreen error={boot.error} onSession={start} onDemo={() => setBoot({ kind: "app", jobs: sampleJobs() })} />;
  return <App initial={boot.jobs} signedIn={boot.signedIn} />;
}

createRoot(document.getElementById("root")!).render(<StrictMode><FeedbackProvider><Root /></FeedbackProvider></StrictMode>);
