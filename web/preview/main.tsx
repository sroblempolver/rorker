// Standalone, clickable preview of the Rorker app on the house.dwg sample. Same screens as the real app;
// data lives in memory, so nothing is saved and plan uploads are switched off.
import { StrictMode, useEffect, useMemo, useState } from "react";
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
import type { Plan } from "@/lib/plan/types";
import { previewAsk } from "./assistant";
import { SharedJob } from "@/components/share/SharedJob";
import { newToken, shareView } from "@/lib/share";

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
  const pins = samplePins(plan, members).map((p, i) => ({
    id: `p${i + 1}`, job_id: jobId, number: i + 1, element_id: null, floor_id: null, x: null, y: null, kind: "task", title: "", body: null,
    status: "open", priority: 1, due_date: null, tagged: [], close_requirement: "confirm", stage_id: null, links: [], created_by: null,
    created_at: now(), closed_at: null, comment_count: 0, ...p,
  })) as Pin[];
  // the viewer (the owner) is on the issue too, so "Tagged to me" has something in it
  const issue = pins.find((p) => p.kind === "issue");
  if (issue) issue.tagged = ["m0", ...issue.tagged];
  const planRow: PlanRow = { id: "plan1", job_id: jobId, version: 1, data: plan, created_at: now() };
  return {
    job: { id: jobId, company_id: "demo", name: "Hadley Road house", address: "14 Hadley Road", client_name: "Sam and Priya Okafor", client_email: null, client_phone: null, job_type: "renovation", status: "active", start_date: null, current_plan_id: "plan1", created_at: now() },
    plan: planRow, stages, pins, states: sampleStates(plan), edits: {}, can3d: true,
    items: sampleItems(plan).map((it, i) => ({ id: `i${i + 1}`, job_id: jobId, label: null, note: null, created_at: now(), ...it }) as JobItem),
    runs: [{ id: "r1", job_id: jobId, kind: "read", file_name: "house.dwg", status: "needs_answers", error: null, plan_id: "plan1", created_at: now(), finished_at: now(), metrics: {} }],
    members, me: "m0", aiAvailable: false, canShare: true,
  };
}

const COMPANY: Company = { id: "demo", name: "Demo Builders", logo_url: null, brand_color: "#ff6a1f", phone: "(555) 010-2030", email: null, license_no: null, website: null, address: null };
const shares: ShareLink[] = [];
function sharedView(d: WorkspaceData, token: string) {
  const l = shares.find((x) => x.token === token);
  return l ? shareView(l, { company: COMPANY, job: d.job, plan: d.plan?.data ?? null, edits: d.edits, items: d.items, pins: d.pins, stages: d.stages, members: d.members }) : null;
}

function memoryApi(d: WorkspaceData): WorkspaceApi {
  const comments = new Map<string, PinComment[]>();
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
    async uploadPlan() { throw new Error("This preview runs on the sample house. Uploading a drawing works in the full app."); },
    async answer(_id, answers) {
      const p = d.plan!;
      const data = structuredClone(p.data);
      data.questions.forEach((q) => { if (answers[q.id]) q.answer = answers[q.id]; });
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
    shareUrl: (token) => `https://app.rorker.com/s/${token}`,
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
  const g = d.plan!.data.floors.find((f) => f.level === 0)!;
  return {
    ...d.job, open_pins: d.pins.filter((p) => p.status !== "done").length, stages_done: d.stages.filter((s) => s.status === "done").length,
    stages_total: d.stages.length, current_stage: d.stages.find((s) => s.status === "active")?.name ?? null,
    footprint: g.footprint, floors: d.plan!.data.floors.length, size_mm: d.plan!.data.building.size_mm, run_status: "needs_answers",
  };
}

function App() {
  const [page, setPage] = useState<"jobs" | "job" | "team" | "shared">("job");
  const [shareToken, setShareToken] = useState<string | null>(null);
  const data = useMemo(seed, []);
  // the assistant changes the job behind the screen's back: hand the workspace a fresh copy after
  const [current, setCurrent] = useState(data);
  const api = useMemo(() => { const a = memoryApi(data); return { ...a, ask: previewAsk(data, a), afterAssistant: () => setCurrent({ ...data }), openShare: (t: string) => { setShareToken(t); setPage("shared"); } }; }, [data]);
  const team = useMemo(() => teamApi(data), [data]);
  const [, bump] = useState(0);
  useEffect(() => {
    const go = (e: Event) => { const href = (e as CustomEvent<string>).detail; setPage(href.startsWith("/jobs/") && href !== "/jobs/new" ? "job" : "jobs"); bump((n) => n + 1); };
    window.addEventListener("preview-nav", go);
    return () => window.removeEventListener("preview-nav", go);
  }, []);
  return (
    <div className="h-full flex flex-col">
      <header className="h-14 shrink-0 border-b border-line bg-panel flex items-center gap-4 px-4">
        <button onClick={() => setPage("jobs")} aria-label="All jobs"><Logo size={20} /></button>
        <nav className="flex items-center gap-1 ml-2">
          <button onClick={() => setPage("jobs")} className={`px-3 h-9 rounded-[3px] font-display text-[15px] font-bold tracking-[0.1em] uppercase ${page === "jobs" ? "text-accent bg-panel-2" : "text-muted hover:text-text"}`}>Jobs</button>
          <button onClick={() => setPage("team")} className={`px-3 h-9 rounded-[3px] font-display text-[15px] font-bold tracking-[0.1em] uppercase ${page === "team" ? "text-accent bg-panel-2" : "text-muted hover:text-text"}`}>Team</button>
        </nav>
        <span className="chip ml-auto"><span className="sm:hidden">Preview</span><span className="hidden sm:inline">Preview · sample data, nothing is saved</span></span>
      </header>
      {page === "shared" && shareToken ? (
        <div className="flex-1 min-h-0 flex flex-col lg:overflow-hidden overflow-y-auto">
          {(() => { const v = sharedView(data, shareToken); return v ? <SharedJob view={v} onBack={() => setPage("job")} /> : <p className="p-6 text-muted">This link was turned off. <button className="underline" onClick={() => setPage("job")}>Back</button></p>; })()}
        </div>
      ) : page === "team" ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 py-8 max-w-3xl w-full mx-auto">
            <p className="eyebrow">Demo Builders</p>
            <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em] mb-1">Team</h1>
            <p className="text-muted mb-6">Everyone who works your jobs. Tag them on any pin so they know where to go and what to do.</p>
            <TeamManager initial={data.members} canManage meId="m0" api={team} />
          </div>
        </div>
      ) : page === "jobs" ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 pt-6 pb-4">
            <p className="eyebrow">All jobs</p>
            <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em]">1 active job</h1>
            <p className="text-muted text-sm">Click the building to go inside. In the full app every job you run shows up here.</p>
          </div>
          <div className="px-4 sm:px-6 pb-8"><AllJobsMap jobs={[summary(data)]} /></div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col lg:overflow-hidden overflow-y-auto">
          <JobWorkspace data={current} api={api} onAllJobs={() => setPage("jobs")} />
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
