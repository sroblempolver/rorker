// Local demo mode: everything in one JSON file under .data/, used until the Supabase project exists.
// Plan reading runs the Python agent on this machine (python3 -m rorker_agent read ...).
import "server-only";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import housePlan from "@/demo/house-plan.json";
import type { Plan } from "@/lib/plan/types";
import type {
  Company, CompanyInput, ElementState, Job, JobInput, JobStage, JobSummary, Member, Pin, PinComment, PinInput,
  PlanRow, PlanRun, Repo, StageStatus, StageTemplate,
} from "./types";
import { DEFAULT_TEMPLATES } from "./templates";
import { samplePins, sampleStates } from "@/demo/sample";

const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "demo.json");
const FILES = path.join(DIR, "files");
const AGENT_DIR = process.env.RORKER_AGENT_DIR || path.join(process.cwd(), "..", "agent");
const PYTHON = process.env.RORKER_PYTHON || "python3";

interface Db {
  companies: (Company & { owner: string })[];
  members: { company_id: string; user_id: string; role: string; full_name: string | null }[];
  templates: (StageTemplate & { company_id: string })[];
  jobs: Job[];
  stages: JobStage[];
  runs: (PlanRun & { file_path: string | null; input: Record<string, unknown> })[];
  plans: PlanRow[];
  states: (ElementState & { job_id: string })[];
  pins: Pin[];
  comments: PinComment[];
}

function empty(): Db {
  return { companies: [], members: [], templates: [], jobs: [], stages: [], runs: [], plans: [], states: [], pins: [], comments: [] };
}

function load(): Db {
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return empty();
  }
}

function save(db: Db) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}

function tx<T>(fn: (db: Db) => T): T {
  const db = load();
  const out = fn(db);
  save(db);
  return out;
}

const now = () => new Date().toISOString();

export function demoCompanyFor(userId: string): { company: Company; role: string } | null {
  const db = load();
  const m = db.members.find((x) => x.user_id === userId);
  if (!m) return null;
  const c = db.companies.find((x) => x.id === m.company_id);
  return c ? { company: c, role: m.role } : null;
}

/** First visit in demo mode: a sample company with the house.dwg job already read. */
export async function seedDemo(userId: string, name: string | null) {
  if (demoCompanyFor(userId)) return;
  const repo = new DemoRepo();
  tx((db) => {
    const id = randomUUID();
    db.companies.push({ id, owner: userId, name: "Demo Builders", logo_url: null, brand_color: "#ff6a1f", phone: "(555) 010-2030", email: "office@demobuilders.test", license_no: "GC-104882", website: null, address: null });
    db.members.push({ company_id: id, user_id: userId, role: "owner", full_name: name });
    for (const t of DEFAULT_TEMPLATES) db.templates.push({ id: randomUUID(), company_id: id, is_default: true, ...t });
  });
  const company = demoCompanyFor(userId)!.company;
  const tpl = load().templates.find((t) => t.company_id === company.id && t.job_type === "renovation");
  await repo.createJob(company.id, userId, { name: "Hadley Road house", address: "14 Hadley Road", job_type: "renovation", template_id: tpl?.id, client_name: "Sam and Priya Okafor", client_email: "okafor@example.com" }).then((jobId) => {
    tx((db) => {
      const runId = randomUUID();
      const planId = randomUUID();
      db.runs.push({ id: runId, job_id: jobId, kind: "read", file_name: "house.dwg", status: "needs_answers", error: null, plan_id: planId, created_at: now(), finished_at: now(), metrics: {}, file_path: null, input: {} });
      db.plans.push({ id: planId, job_id: jobId, version: 1, data: housePlan as unknown as Plan, created_at: now() });
      const job = db.jobs.find((j) => j.id === jobId)!;
      job.current_plan_id = planId;
      const st = db.stages.filter((s) => s.job_id === jobId).sort((a, b) => a.position - b.position);
      st.slice(0, 2).forEach((s) => (s.status = "done"));
      if (st[2]) st[2].status = "active";
      const plan = housePlan as unknown as Plan;
      for (const st of sampleStates(plan)) db.states.push({ job_id: jobId, ...st });
      const pins = samplePins(plan);
      pins.forEach((p, i) => db.pins.push({ id: randomUUID(), job_id: jobId, number: i + 1, element_id: null, floor_id: null, x: null, y: null, kind: "task", title: "", body: null, status: "open", priority: 2, due_date: null, assignee_id: null, close_requirement: "confirm", stage_id: null, links: [], created_by: userId, created_at: now(), closed_at: null, ...p } as Pin));
    });
  });
}

export class DemoRepo implements Repo {
  mode = "demo" as const;

  async createCompany(userId: string, input: CompanyInput, fullName?: string) {
    return tx((db) => {
      const id = randomUUID();
      db.companies.push({ id, owner: userId, name: input.name, logo_url: null, brand_color: input.brand_color || "#ff6a1f", phone: input.phone ?? null, email: input.email ?? null, license_no: input.license_no ?? null, website: input.website ?? null, address: input.address ?? null });
      db.members.push({ company_id: id, user_id: userId, role: "owner", full_name: fullName ?? null });
      for (const t of DEFAULT_TEMPLATES) db.templates.push({ id: randomUUID(), company_id: id, is_default: true, ...t });
      return id;
    });
  }
  async updateCompany(companyId: string, input: CompanyInput) {
    tx((db) => Object.assign(db.companies.find((c) => c.id === companyId)!, input));
  }
  async uploadLogo(companyId: string, file: File) {
    const p = await this.saveFile(`${companyId}/logo-${Date.now()}${path.extname(file.name) || ".png"}`, file);
    tx((db) => (db.companies.find((c) => c.id === companyId)!.logo_url = `/api/demo-files/${p}`));
  }
  async listMembers(companyId: string): Promise<Member[]> {
    return load().members.filter((m) => m.company_id === companyId).map((m) => ({ user_id: m.user_id, full_name: m.full_name, role: m.role }));
  }

  async listJobs(companyId: string): Promise<JobSummary[]> {
    const db = load();
    return db.jobs.filter((j) => j.company_id === companyId).map((j) => {
      const plan = db.plans.find((p) => p.id === j.current_plan_id)?.data;
      const stages = db.stages.filter((s) => s.job_id === j.id).sort((a, b) => a.position - b.position);
      const run = db.runs.filter((r) => r.job_id === j.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return {
        ...j,
        open_pins: db.pins.filter((p) => p.job_id === j.id && p.status !== "done").length,
        stages_done: stages.filter((s) => s.status === "done").length,
        stages_total: stages.length,
        current_stage: stages.find((s) => s.status === "active")?.name ?? null,
        footprint: plan ? [...plan.floors].sort((a, b) => a.level - b.level)[0]?.footprint ?? null : null,
        floors: plan?.floors.length ?? 0,
        size_mm: plan?.building.size_mm ?? null,
        run_status: run?.status ?? null,
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async getJob(jobId: string) {
    return load().jobs.find((j) => j.id === jobId) ?? null;
  }
  async createJob(companyId: string, userId: string, input: JobInput) {
    return tx((db) => {
      const id = randomUUID();
      db.jobs.push({ id, company_id: companyId, name: input.name, address: input.address ?? null, client_name: input.client_name ?? null, client_email: input.client_email ?? null, client_phone: input.client_phone ?? null, job_type: input.job_type, status: "active", start_date: input.start_date ?? null, current_plan_id: null, created_at: now() });
      const t = db.templates.find((x) => x.id === input.template_id && x.company_id === companyId);
      t?.stages.forEach((s, i) => db.stages.push({ id: randomUUID(), job_id: id, position: i + 1, name: s.name, description: s.description ?? null, status: "not_started", started_at: null, completed_at: null }));
      return id;
    });
  }
  async updateJob(jobId: string, input: Partial<JobInput> & { status?: Job["status"] }) {
    tx((db) => {
      const j = db.jobs.find((x) => x.id === jobId)!;
      const { template_id: _t, ...rest } = input;
      void _t;
      Object.assign(j, rest);
    });
  }

  async listTemplates(companyId: string) {
    return load().templates.filter((t) => t.company_id === companyId).map(({ company_id: _c, ...t }) => { void _c; return t; });
  }
  async saveTemplate(companyId: string, t: Omit<StageTemplate, "id" | "is_default"> & { id?: string }) {
    tx((db) => {
      const ex = t.id ? db.templates.find((x) => x.id === t.id && x.company_id === companyId) : null;
      if (ex) Object.assign(ex, { name: t.name, job_type: t.job_type, stages: t.stages });
      else db.templates.push({ id: randomUUID(), company_id: companyId, is_default: false, name: t.name, job_type: t.job_type, stages: t.stages });
    });
  }
  async deleteTemplate(companyId: string, id: string) {
    tx((db) => (db.templates = db.templates.filter((t) => !(t.id === id && t.company_id === companyId))));
  }
  async listStages(jobId: string) {
    return load().stages.filter((s) => s.job_id === jobId).sort((a, b) => a.position - b.position);
  }
  async setStageStatus(stageId: string, status: StageStatus) {
    tx((db) => {
      const s = db.stages.find((x) => x.id === stageId)!;
      s.status = status;
      if (status === "active" && !s.started_at) s.started_at = now();
      s.completed_at = status === "done" ? now() : null;
    });
  }
  async addStage(jobId: string, name: string) {
    tx((db) => {
      const max = Math.max(0, ...db.stages.filter((s) => s.job_id === jobId).map((s) => s.position));
      db.stages.push({ id: randomUUID(), job_id: jobId, position: max + 1, name, description: null, status: "not_started", started_at: null, completed_at: null });
    });
  }
  async renameStage(stageId: string, name: string) {
    tx((db) => (db.stages.find((x) => x.id === stageId)!.name = name));
  }
  async deleteStage(stageId: string) {
    tx((db) => (db.stages = db.stages.filter((s) => s.id !== stageId)));
  }
  async moveStage(stageId: string, dir: -1 | 1) {
    tx((db) => {
      const s = db.stages.find((x) => x.id === stageId)!;
      const list = db.stages.filter((x) => x.job_id === s.job_id).sort((a, b) => a.position - b.position);
      const i = list.indexOf(s), j = i + dir;
      if (j < 0 || j >= list.length) return;
      [list[i].position, list[j].position] = [list[j].position, list[i].position];
    });
  }

  async getPlan(planId: string) {
    return load().plans.find((p) => p.id === planId) ?? null;
  }
  async listRuns(jobId: string): Promise<PlanRun[]> {
    return load().runs.filter((r) => r.job_id === jobId).sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ file_path: _f, input: _i, ...r }) => { void _f; void _i; return r; });
  }
  async startRead(jobId: string, _userId: string, file: File) {
    const job = (await this.getJob(jobId))!;
    const rel = await this.saveFile(`${job.company_id}/${jobId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`, file);
    const id = randomUUID();
    tx((db) => db.runs.push({ id, job_id: jobId, kind: "read", file_name: file.name, status: "running", error: null, plan_id: null, created_at: now(), finished_at: null, metrics: {}, file_path: rel, input: {} }));
    const out = path.join(DIR, "runs", id);
    this.runAgent(id, jobId, ["-m", "rorker_agent", "read", path.join(FILES, rel), "--out", out, "--name", file.name], out);
    return id;
  }
  async startAnswers(jobId: string, _userId: string, planId: string, answers: Record<string, string>) {
    const plan = (await this.getPlan(planId))!;
    const id = randomUUID();
    const out = path.join(DIR, "runs", id);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "plan.json"), JSON.stringify(plan.data));
    tx((db) => db.runs.push({ id, job_id: jobId, kind: "answers", file_name: null, status: "running", error: null, plan_id: null, created_at: now(), finished_at: null, metrics: {}, file_path: null, input: { plan_id: planId, answers } }));
    // with the plan reader key the answers go to the AI; without it the agent applies them by rules
    this.runAgent(id, jobId, ["-m", "rorker_agent", "answer", path.join(out, "plan.json"), ...Object.entries(answers).map(([k, v]) => `${k}=${v}`)], out);
    return id;
  }
  private runAgent(runId: string, jobId: string, args: string[], out: string) {
    const child = spawn(PYTHON, args, { cwd: AGENT_DIR, env: process.env });
    let err = "";
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => this.failRun(runId, `Could not start the plan reader: ${e.message}`));
    child.on("close", (code) => {
      if (code !== 0) return this.failRun(runId, err.trim().split("\n").slice(-3).join(" ") || `exit ${code}`);
      try {
        const data = JSON.parse(fs.readFileSync(path.join(out, "plan.json"), "utf8")) as Plan;
        this.finishRun(runId, jobId, data);
      } catch (e) {
        this.failRun(runId, String(e));
      }
    });
  }
  private finishRun(runId: string, jobId: string, data: Plan) {
    tx((db) => {
      const version = Math.max(0, ...db.plans.filter((p) => p.job_id === jobId).map((p) => p.version)) + 1;
      const planId = randomUUID();
      db.plans.push({ id: planId, job_id: jobId, version, data, created_at: now() });
      db.jobs.find((j) => j.id === jobId)!.current_plan_id = planId;
      const r = db.runs.find((x) => x.id === runId)!;
      r.status = data.questions.some((q) => !q.answer) ? "needs_answers" : "done";
      r.plan_id = planId;
      r.finished_at = now();
      r.metrics = { stats: data.stats };
    });
  }
  private failRun(runId: string, error: string) {
    tx((db) => Object.assign(db.runs.find((x) => x.id === runId)!, { status: "failed", error, finished_at: now() }));
  }
  async listElementStates(jobId: string) {
    return load().states.filter((s) => s.job_id === jobId).map(({ element_id, status }) => ({ element_id, status }));
  }
  async setElementState(jobId: string, _userId: string, elementId: string, status: ElementState["status"] | null) {
    tx((db) => {
      db.states = db.states.filter((s) => !(s.job_id === jobId && s.element_id === elementId));
      if (status) db.states.push({ job_id: jobId, element_id: elementId, status });
    });
  }

  async listPins(jobId: string) {
    const db = load();
    return db.pins.filter((p) => p.job_id === jobId).map((p) => ({ ...p, comment_count: db.comments.filter((c) => c.pin_id === p.id).length })).sort((a, b) => b.number - a.number);
  }
  async createPin(jobId: string, userId: string, input: PinInput) {
    return tx((db) => {
      const id = randomUUID();
      const number = Math.max(0, ...db.pins.filter((p) => p.job_id === jobId).map((p) => p.number)) + 1;
      db.pins.push({ id, job_id: jobId, number, element_id: input.element_id ?? null, floor_id: input.floor_id ?? null, x: input.x ?? null, y: input.y ?? null, anchor: input.anchor ?? null, kind: input.kind, title: input.title, body: input.body ?? null, status: "open", priority: input.priority ?? 2, due_date: input.due_date ?? null, assignee_id: null, close_requirement: input.close_requirement ?? "confirm", stage_id: input.stage_id ?? null, links: input.links ?? [], created_by: userId, created_at: now(), closed_at: null });
      return id;
    });
  }
  async updatePin(pinId: string, input: Partial<PinInput> & { status?: Pin["status"] }) {
    tx((db) => {
      const p = db.pins.find((x) => x.id === pinId)!;
      Object.assign(p, input);
      if (input.status) p.closed_at = input.status === "done" ? now() : null;
    });
  }
  async deletePin(pinId: string) {
    tx((db) => {
      db.pins = db.pins.filter((p) => p.id !== pinId);
      db.comments = db.comments.filter((c) => c.pin_id !== pinId);
    });
  }
  async listComments(pinId: string) {
    const db = load();
    return db.comments.filter((c) => c.pin_id === pinId).sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({ ...c, author_name: db.members.find((m) => m.user_id === c.author_id)?.full_name ?? "You" }));
  }
  async addComment(pinId: string, userId: string, body: string, photos: File[]) {
    const pin = load().pins.find((p) => p.id === pinId)!;
    const job = (await this.getJob(pin.job_id))!;
    const paths: string[] = [];
    for (const f of photos) paths.push(await this.saveFile(`${job.company_id}/pins/${pinId}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`, f));
    tx((db) => db.comments.push({ id: randomUUID(), pin_id: pinId, author_id: userId, body: body || null, photos: paths, created_at: now() }));
  }
  async photoUrl(p: string) {
    return `/api/demo-files/${p}`;
  }

  private async saveFile(rel: string, file: File) {
    const full = path.join(FILES, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, Buffer.from(await file.arrayBuffer()));
    return rel;
  }
}

export function demoFilePath(rel: string) {
  const full = path.normalize(path.join(FILES, rel));
  if (!full.startsWith(FILES)) throw new Error("bad path");
  return full;
}
