// Standalone, clickable preview of the Rorker app on the house.dwg sample. Same screens as the real app;
// data lives in memory, so nothing is saved. New project reads a drawing with the Rorker assistant.
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
import type { Company, JobItem, JobStage, JobSummary, Member, MemberInput, Pin, PinComment, PlanRow, ShareLink } from "@/lib/data/types";
import { JOB_KEY } from "@/lib/plan/build";
import type { Plan } from "@/lib/plan/types";
import { previewAsk } from "./assistant";
import { SharedWorkView } from "@/components/share/SharedJob";
import { newToken, shareWork } from "@/lib/share";
import { NewProject, type NewProjectResult } from "@/components/newjob/NewProject";
import { ClientMoneyView } from "@/components/billing/ClientMoneyView";
import type { ClientStart } from "@/components/billing/MoneyPanel";
import type { Brand } from "@/lib/billing/types";
import { SAMPLE_BRAND, sampleBilling } from "@/demo/billing-sample";
import { MoneyOverview } from "@/components/billing/MoneyOverview";
import { sampleOtherJobs } from "@/demo/money-jobs-sample";
import { ShoppingRun } from "@/components/materials/ShoppingRun";
import { EXTRA_JOBS, sampleMaterials } from "@/demo/materials-sample";
import { pinSummary, qtyText, type MaterialLine, type MaterialsApi, type MaterialsJob } from "@/lib/materials/types";
import { TeamContext } from "@/components/team/context";
import { FeedbackProvider } from "@/components/ui/feedback";

/** when this preview was built, so an out-of-date copy in the browser cache is easy to spot */
declare const __BUILD__: string;

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const plan = housePlan as unknown as Plan;

const toMember = (m: MemberInput, id: string, owner = false): Member => ({
  id, user_id: owner ? "you" : null, full_name: m.full_name, email: m.email || null, phone: m.phone || null, title: m.title || null, role: owner ? "admin" : m.role, is_owner: owner,
});

function seed(): WorkspaceData {
  const jobId = "hadley";
  const members = [toMember({ full_name: "Company owner", title: "Owner", email: "owner@demobuilders.test", role: "admin" }, "m0", true), ...DEMO_CREW.map((m, i) => toMember(m, `m${i + 1}`))];
  const stages: JobStage[] = DEFAULT_TEMPLATES[0].stages.map((s, i) => ({
    id: `s${i}`, job_id: jobId, position: i + 1, name: s.name, description: null,
    status: i < 2 ? "done" : i === 2 ? "active" : "not_started", started_at: null, completed_at: null,
  }));
  const pins = samplePins(plan, members).filter((p) => p.kind !== "material").map((p, i) => ({
    id: `p${i + 1}`, job_id: jobId, number: i + 1, element_id: null, floor_id: null, x: null, y: null, kind: "task", title: "", body: null,
    status: "open", priority: 1, due_date: null, tagged: [], close_requirement: "confirm", stage_id: null, links: [], created_by: null,
    created_at: now(), closed_at: null, comment_count: 0, ...p,
  })) as Pin[];
  // the viewer (the owner) is on the issue too, so "Tagged to me" has something in it
  const issue = pins.find((p) => p.kind === "issue");
  if (issue) issue.tagged = ["m0", ...issue.tagged];
  // the sample materials list; lines placed on the house get their teal pin on the map
  const PIN_STATUS = { to_buy: "open", ordered: "open", got: "in_progress", installed: "done", returned: "done" } as const;
  materials.lines = sampleMaterials(plan, jobId, members).map((m, i) => {
    let pin_id: string | null = null;
    if (m.job_id === jobId && m.element_id) {
      pin_id = `pm${i}`;
      pins.push({ id: pin_id, job_id: jobId, number: pins.length + 1, element_id: m.element_id, floor_id: m.floor_id, x: null, y: null, kind: "material", title: `Buy ${qtyText(m.qty, m.unit)} ${m.name}`,
        body: null, status: PIN_STATUS[m.status], priority: 1, due_date: m.needed_by, tagged: [...new Set([m.buyer, m.installer].filter(Boolean) as string[])], close_requirement: "confirm",
        stage_id: null, links: [], created_by: null, created_at: now(), closed_at: null, comment_count: 0 });
    }
    return { ...m, id: `ml${i}`, pin_id, receipts: [], created_at: now() };
  });
  const planRow: PlanRow = { id: "plan1", job_id: jobId, version: 1, data: plan, created_at: now() };
  return {
    job: { id: jobId, company_id: "demo", name: "Hadley Road house", address: "14 Hadley Road", client_name: "Sam and Priya Okafor", client_email: null, client_phone: null, job_type: "renovation", status: "active", start_date: null, current_plan_id: "plan1", created_at: now() },
    plan: planRow, stages, pins, states: sampleStates(plan), edits: { [JOB_KEY]: { furnish: "all" } }, can3d: true,
    items: sampleItems(plan).map((it, i) => ({ id: `i${i + 1}`, job_id: jobId, label: null, note: null, created_at: now(), ...it }) as JobItem),
    runs: [{ id: "r1", job_id: jobId, kind: "read", file_name: "house.dwg", status: "needs_answers", error: null, plan_id: "plan1", created_at: now(), finished_at: now(), metrics: {} }],
    members, me: "m0", aiAvailable: false, canShare: true,
    billing: sampleBilling(jobId), brand: SAMPLE_BRAND, payoutsConnected: false,
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

const COMPANY: Company = { id: "demo", name: "Demo Builders", logo_url: null, brand_color: "#ff6a1f", phone: "(555) 010-2030", email: null, license_no: null, website: null, address: null };
const shares: ShareLink[] = [];
/** money on the other jobs in the overview (they have no plan in the preview) */
const otherJobs = sampleOtherJobs();
/** What a link opens, across every job in the preview (a person's own link covers them all). */
function sharedWork(jobs: WorkspaceData[], token: string, photos: Map<string, string[]>) {
  const l = shares.find((x) => x.token === token);
  return l ? shareWork(l, COMPANY, jobs.map((d) => ({ company: COMPANY, job: d.job, plan: d.plan?.data ?? null, edits: d.edits, items: d.items, pins: d.pins, stages: d.stages, members: d.members, photos: Object.fromEntries(d.pins.map((p) => [p.id, photos.get(p.id) ?? []])) }))) : null;
}
/** photos posted on pins in the preview, by pin id, so a shared link can show them */
const pinPhotos = new Map<string, string[]>();

/** pin threads in the preview, by pin id */
const comments = new Map<string, PinComment[]>();
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
      const have = shares.find((l) => !l.job_id && l.member_id === memberId && !l.revoked_at);
      if (have) return have;
      const m = d.members.find((x) => x.id === memberId);
      if (!m) throw new Error("That person isn't on your team.");
      const l: ShareLink = { id: uid(), job_id: null, company_id: COMPANY.id, token: newToken(), label: m.title ? `${m.full_name} (${m.title})` : m.full_name, member_id: memberId, pin_ids: [], expires_at: null, revoked_at: null, created_at: now() };
      shares.unshift(l);
      return l;
    },
    shareUrl: (token) => `https://app.rorker.com/s/${token}`,
    money: {
      save(b) { d.billing = b; },
      async connectPayouts() { await new Promise((r) => setTimeout(r, 600)); d.payoutsConnected = true; },
    },
  };
}

function teamApi(d: WorkspaceData): TeamApi {
  const sorted = () => (d.members = [...d.members].sort((a, b) => Number(b.is_owner) - Number(a.is_owner) || a.full_name.localeCompare(b.full_name)));
  return {
    async add(input) {
      if (!input.full_name.trim()) throw new Error("Add a name.");
      if (input.email && d.members.some((m) => m.email?.toLowerCase() === input.email!.toLowerCase())) throw new Error("Someone on the team already uses that email.");
      d.members = [...d.members, toMember(input, uid())];
      return sorted();
    },
    async update(id, input) {
      d.members = d.members.map((m) => (m.id === id ? { ...m, ...input, role: m.is_owner ? "admin" : input.role ?? m.role } as Member : m));
      return sorted();
    },
    async remove(id) {
      if (d.members.find((m) => m.id === id)?.is_owner) throw new Error("The owner stays on the team.");
      d.members = d.members.filter((m) => m.id !== id);
      d.pins = d.pins.map((p) => ({ ...p, tagged: p.tagged.filter((x) => x !== id) }));
      return sorted();
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
    billing: { quotes: [], invoices: [], payments: [] }, brand: SAMPLE_BRAND, payoutsConnected: false,
  };
}

type Page = "jobs" | "job" | "team" | "shared" | "new" | "client" | "money" | "shop";

/** A small job with no drawing yet (the materials sample spreads across these too). */
function plainJob(j: (typeof EXTRA_JOBS)[number], team: Member[]): WorkspaceData {
  const tpl = DEFAULT_TEMPLATES.find((t) => t.job_type === j.job_type) ?? DEFAULT_TEMPLATES[0];
  return {
    job: { ...j, company_id: "demo", client_email: null, client_phone: null, status: "active", start_date: null, current_plan_id: null, created_at: now() },
    plan: null, stages: tpl.stages.map((s, i) => ({ id: uid(), job_id: j.id, position: i + 1, name: s.name, description: null, status: i === 0 ? "active" : "not_started", started_at: null, completed_at: null })),
    pins: [], states: [], edits: {}, can3d: true, items: [], runs: [], members: team, me: "m0", aiAvailable: false, canShare: true,
  };
}

/** Each screen has its own address (#/jobs, #/job/hadley ...) so the browser's back button, a refresh
 * and a copied link all land where you were. */
function fromHash(): { page: Page; id?: string } {
  const [a, b] = location.hash.replace(/^#\/?/, "").split("/");
  if (a === "jobs" || a === "team" || a === "new" || a === "shared" || a === "money" || a === "shop") return { page: a };
  return { page: "job", id: a === "job" ? b : undefined };
}
const hashFor = (page: Page, id: string) => (page === "job" ? `#/job/${id}` : `#/${page}`);
const TITLES: Partial<Record<Page, string>> = { jobs: "Jobs", team: "Team", new: "New project", shared: "Shared link", money: "Money", shop: "Shopping", client: "Client view" };

function App() {
  const sample = useMemo(seed, []);
  const [page, setPageRaw] = useState<Page>(() => fromHash().page);
  const [share, setShare] = useState<{ token: string; pin?: string } | null>(null);
  const [client, setClient] = useState<ClientStart>(null);
  const [tier, setTier] = useState<Brand["tier"]>("standard");
  const [jobs, setJobs] = useState<WorkspaceData[]>(() => [sample, ...EXTRA_JOBS.map((j) => plainJob(j, sample.members))]);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const mapi = useMemo(() => materialsApi(() => jobsRef.current), []);
  const mjobs: MaterialsJob[] = jobs.map((d) => ({ id: d.job.id, name: d.job.name, address: d.job.address }));
  const [, setMver] = useState(0);
  const [activeId, setActiveIdRaw] = useState(() => fromHash().id ?? sample.job.id);
  /** go somewhere: a new history entry first, so the screen that opens builds on it */
  const go = (p: Page, id = activeId) => {
    const h = hashFor(p, id);
    if (location.hash !== h) history.pushState(null, "", h);
    setPageRaw(p);
    setActiveIdRaw(id);
  };
  const setPage = (p: Page) => go(p);
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    if (!location.hash) history.replaceState(history.state, "", hashFor(page, activeId));
    const pop = () => { const r = fromHash(); setPageRaw(r.page); if (r.id) setActiveIdRaw(r.id); };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (TITLES[page]) document.title = `${TITLES[page]} · Rorker`; }, [page]);
  const active = jobs.find((j) => j.job.id === activeId) ?? jobs[0];
  // the assistant changes the job behind the screen's back: hand the workspace a fresh copy after
  const [ver, setVer] = useState(0);
  const [fromClient, setFromClient] = useState(false);
  const current = useMemo(() => ({ ...active, startOnMoney: fromClient, materials: { lines: materials.lines, jobs: mjobs } }), [active, ver, fromClient, jobs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const api = useMemo(() => {
    const a = memoryApi(active);
    return { ...a, ask: previewAsk(active, a), afterAssistant: () => setVer((n) => n + 1), openShare: (token: string, pin?: string) => { setShare({ token, pin }); goRef.current("shared"); },
      money: a.money && { ...a.money, openClient: (start: ClientStart) => { setClient(start); goRef.current("client"); } },
      materials: mapi, openShopping: () => goRef.current("shop") };
  }, [active, mapi]);
  const team = useMemo(() => teamApi(sample), [sample]);
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
    const d = fromAssistant(r, sample.members);
    setJobs((js) => [d, ...js]);
    go("job", d.job.id);
  };
  const tab = (p: Page, label: string) => (
    <button onClick={() => { setFromClient(false); setPage(p); }} className={`shrink-0 px-1.5 sm:px-3 h-9 rounded-[3px] font-display text-[13px] sm:text-[15px] font-bold tracking-[0.06em] sm:tracking-[0.1em] uppercase ${page === p ? "text-accent bg-panel-2" : "text-muted hover:text-text"}`}>{label}</button>
  );
  return (
    <div className="h-full flex flex-col">
      <header className="h-14 shrink-0 border-b border-line bg-panel flex items-center gap-2 sm:gap-4 px-3 sm:px-4">
        <button onClick={() => setPage("jobs")} aria-label="All jobs"><Logo size={20} /></button>
        <nav className="flex items-center gap-1 sm:ml-2 min-w-0 overflow-x-auto">{tab("jobs", "Jobs")}{tab("money", "Money")}{tab("shop", "Shopping")}{tab("team", "Team")}</nav>
        <button onClick={() => setPage("new")} className={`btn btn-sm ${page === "new" ? "btn-ghost" : "btn-primary"} ml-auto`}>+<span className="hidden sm:inline"> New project</span></button>
        <span className="chip hidden md:inline-flex"><span>Preview · sample data, nothing is saved · build {__BUILD__}</span></span>
      </header>
      {page === "new" ? (
        <NewProject onCreate={created} onCancel={() => setPage("jobs")} />
      ) : page === "money" ? (
        <div className="flex-1 overflow-y-auto">
          <MoneyOverview rows={[...jobs.filter((j) => j.billing).map((j) => ({ jobId: j.job.id, jobName: j.job.name, clientName: j.job.client_name, address: j.job.address, billing: j.billing! })), ...otherJobs]}
            onOpenJob={(id) => { if (jobs.some((j) => j.job.id === id)) { setVer((n) => n + 1); go("job", id); } }} />
        </div>
      ) : page === "client" && active.billing ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-line bg-panel text-[13px]">
            <span className="text-muted">Branding on client documents:</span>
            {(["standard", "premium"] as const).map((t) => (
              <button key={t} onClick={() => setTier(t)} className={`btn btn-sm ${tier === t ? "btn-primary" : ""}`}>{t === "standard" ? "Standard (Powered by Rorker)" : "Premium (white label)"}</button>
            ))}
          </div>
          <ClientMoneyView key={`${client?.id ?? "home"}-${tier}`} billing={active.billing} brand={{ ...(active.brand ?? SAMPLE_BRAND), tier }} start={client}
            job={{ name: active.job.name, address: active.job.address, client_name: active.job.client_name, client_email: active.job.client_email, client_phone: active.job.client_phone }}
            onChange={(b) => { active.billing = b; }} onBack={() => { setFromClient(true); setVer((n) => n + 1); setPage("job"); }} />
        </div>
      ) : page === "shared" && share ? (
        <div className="flex-1 min-h-0 flex flex-col lg:overflow-hidden overflow-y-auto">
          {(() => { const v = sharedWork(jobs, share.token, pinPhotos); return v ? <SharedWorkView key={share.token + share.pin} work={v} pin={share.pin} send={(pin, f) => sendSharedPhoto(v.label, pin, f)} onBack={() => { setVer((n) => n + 1); setPage("job"); }} /> : <p className="p-6 text-muted">This link was turned off. <button className="underline" onClick={() => setPage("job")}>Back</button></p>; })()}
        </div>
      ) : page === "shop" ? (
        <div className="flex-1 overflow-y-auto">
          <TeamContext.Provider value={{ members: sample.members, me: "m0" }}>
            <ShoppingRun lines={materials.lines} jobs={mjobs} members={sample.members} me="m0"
              onUpdate={(ids, patch) => { void Promise.all(ids.map((id) => mapi.update(id, patch))).then(() => { setMver((n) => n + 1); setVer((n) => n + 1); }); }}
              onOpenJob={(id) => { setVer((n) => n + 1); go("job", id); }} />
          </TeamContext.Provider>
        </div>
      ) : page === "team" ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 py-8 max-w-3xl w-full mx-auto">
            <p className="eyebrow">Demo Builders</p>
            <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em] mb-1">Team</h1>
            <p className="text-muted mb-6">Everyone who works your jobs. Tag them on any pin so they know where to go and what to do.</p>
            <TeamManager initial={sample.members} canManage meId="m0" api={team} />
          </div>
        </div>
      ) : page === "jobs" ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 pt-6 pb-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="eyebrow">All jobs</p>
              <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em]">{jobs.length} active job{jobs.length === 1 ? "" : "s"}</h1>
              <p className="text-muted text-sm">Click a building to go inside. Start a new one from your drawings with New project.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setPage("new")}>+ New project</button>
          </div>
          <div className="px-4 sm:px-6 pb-8"><AllJobsMap jobs={jobs.map(summary)} /></div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col lg:overflow-hidden overflow-y-auto">
          <JobWorkspace key={active.job.id} data={current} api={api} onAllJobs={() => setPage("jobs")} />
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><FeedbackProvider><App /></FeedbackProvider></StrictMode>);
