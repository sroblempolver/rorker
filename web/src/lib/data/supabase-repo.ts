import "server-only";
import { supabaseServer, SUPABASE_URL } from "@/lib/supabase/server";
import type { Plan } from "@/lib/plan/types";
import type {
  Company, CompanyInput, ElementState, Job, JobInput, JobStage, JobSummary, Member, Pin, PinComment, PinInput,
  PlanRow, PlanRun, Repo, StageStatus, StageTemplate,
} from "./types";

type Row = Record<string, unknown>;

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function companyFromRow(r: Row): Company {
  return {
    id: r.id as string, name: r.name as string, brand_color: (r.brand_color as string) || "#f0a83a",
    logo_url: r.logo_path ? `${SUPABASE_URL}/storage/v1/object/public/company-assets/${r.logo_path}` : null,
    phone: (r.phone as string) ?? null, email: (r.email as string) ?? null, license_no: (r.license_no as string) ?? null,
    website: (r.website as string) ?? null, address: (r.address as string) ?? null,
  };
}

const safeName = (n: string) => n.replace(/[^\w.\-]+/g, "_");

export class SupabaseRepo implements Repo {
  mode = "supabase" as const;
  private db = supabaseServer;

  async createCompany(_userId: string, input: CompanyInput, fullName?: string) {
    const sb = await this.db();
    return check(await sb.rpc("create_company", {
      p_name: input.name, p_phone: input.phone ?? null, p_email: input.email ?? null, p_license: input.license_no ?? null,
      p_website: input.website ?? null, p_color: input.brand_color ?? null, p_full_name: fullName ?? null,
    })) as string;
  }
  async updateCompany(companyId: string, input: CompanyInput) {
    const sb = await this.db();
    check(await sb.from("companies").update(input).eq("id", companyId));
  }
  async uploadLogo(companyId: string, file: File) {
    const sb = await this.db();
    const path = `${companyId}/logo-${Date.now()}-${safeName(file.name)}`;
    check(await sb.storage.from("company-assets").upload(path, file, { upsert: true, contentType: file.type }));
    check(await sb.from("companies").update({ logo_path: path }).eq("id", companyId));
  }
  async listMembers(companyId: string): Promise<Member[]> {
    const sb = await this.db();
    const rows = check(await sb.from("company_members").select("user_id, role").eq("company_id", companyId)) as Row[];
    const profiles = check(await sb.from("profiles").select("user_id, full_name").in("user_id", rows.map((r) => r.user_id as string))) as Row[];
    return rows.map((r) => ({ user_id: r.user_id as string, role: r.role as string, full_name: (profiles.find((p) => p.user_id === r.user_id)?.full_name as string) ?? null }));
  }

  async listJobs(companyId: string): Promise<JobSummary[]> {
    const sb = await this.db();
    const jobs = check(await sb.from("jobs").select("*").eq("company_id", companyId).order("created_at", { ascending: false })) as Job[];
    if (!jobs.length) return [];
    const ids = jobs.map((j) => j.id);
    const planIds = jobs.map((j) => j.current_plan_id).filter(Boolean) as string[];
    const [pins, stages, runs, plans] = await Promise.all([
      sb.from("pins").select("job_id, status").in("job_id", ids).neq("status", "done"),
      sb.from("job_stages").select("job_id, name, status, position").in("job_id", ids),
      sb.from("plan_runs").select("job_id, status, created_at").in("job_id", ids).order("created_at", { ascending: false }),
      planIds.length
        ? sb.from("plans").select("id, footprint:data->floors->0->footprint, floors:data->floors, size:data->building->size_mm").in("id", planIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const pinRows = check(pins) as Row[], stageRows = check(stages) as Row[], runRows = check(runs) as Row[];
    const planRows = (check(plans as { data: Row[]; error: null }) ?? []) as Row[];
    return jobs.map((j) => {
      const st = stageRows.filter((s) => s.job_id === j.id).sort((a, b) => (a.position as number) - (b.position as number));
      const p = planRows.find((x) => x.id === j.current_plan_id);
      const floors = (p?.floors as { level: number; footprint: [number, number][][] }[] | undefined) ?? [];
      const ground = [...floors].sort((a, b) => a.level - b.level)[0];
      return {
        ...j,
        open_pins: pinRows.filter((x) => x.job_id === j.id).length,
        stages_done: st.filter((s) => s.status === "done").length,
        stages_total: st.length,
        current_stage: (st.find((s) => s.status === "active")?.name as string) ?? null,
        footprint: ground?.footprint ?? null,
        floors: floors.length,
        size_mm: (p?.size as [number, number]) ?? null,
        run_status: (runRows.find((r) => r.job_id === j.id)?.status as JobSummary["run_status"]) ?? null,
      };
    });
  }
  async getJob(jobId: string) {
    const sb = await this.db();
    return (check(await sb.from("jobs").select("*").eq("id", jobId).maybeSingle()) as Job | null) ?? null;
  }
  async createJob(companyId: string, _userId: string, input: JobInput) {
    const sb = await this.db();
    return check(await sb.rpc("create_job", {
      p_company: companyId, p_name: input.name, p_address: input.address ?? null, p_job_type: input.job_type,
      p_template: input.template_id ?? null, p_client_name: input.client_name ?? null,
      p_client_email: input.client_email ?? null, p_client_phone: input.client_phone ?? null, p_start: input.start_date || null,
    })) as string;
  }
  async updateJob(jobId: string, input: Partial<JobInput> & { status?: Job["status"] }) {
    const sb = await this.db();
    const { template_id: _t, ...rest } = input;
    void _t;
    check(await sb.from("jobs").update(rest).eq("id", jobId));
  }

  async listTemplates(companyId: string) {
    const sb = await this.db();
    return check(await sb.from("stage_templates").select("id, name, job_type, stages, is_default").eq("company_id", companyId).order("created_at")) as StageTemplate[];
  }
  async saveTemplate(companyId: string, t: Omit<StageTemplate, "id" | "is_default"> & { id?: string }) {
    const sb = await this.db();
    const row = { company_id: companyId, name: t.name, job_type: t.job_type, stages: t.stages };
    if (t.id) check(await sb.from("stage_templates").update(row).eq("id", t.id));
    else check(await sb.from("stage_templates").insert(row));
  }
  async deleteTemplate(companyId: string, id: string) {
    const sb = await this.db();
    check(await sb.from("stage_templates").delete().eq("id", id).eq("company_id", companyId));
  }
  async listStages(jobId: string) {
    const sb = await this.db();
    return check(await sb.from("job_stages").select("*").eq("job_id", jobId).order("position")) as JobStage[];
  }
  async setStageStatus(stageId: string, status: StageStatus) {
    const sb = await this.db();
    const patch: Row = { status, completed_at: status === "done" ? new Date().toISOString() : null };
    if (status === "active") patch.started_at = new Date().toISOString();
    check(await sb.from("job_stages").update(patch).eq("id", stageId));
  }
  async addStage(jobId: string, name: string) {
    const sb = await this.db();
    const job = (await this.getJob(jobId))!;
    const last = check(await sb.from("job_stages").select("position").eq("job_id", jobId).order("position", { ascending: false }).limit(1)) as Row[];
    check(await sb.from("job_stages").insert({ job_id: jobId, company_id: job.company_id, name, position: ((last[0]?.position as number) ?? 0) + 1 }));
  }
  async renameStage(stageId: string, name: string) {
    const sb = await this.db();
    check(await sb.from("job_stages").update({ name }).eq("id", stageId));
  }
  async deleteStage(stageId: string) {
    const sb = await this.db();
    check(await sb.from("job_stages").delete().eq("id", stageId));
  }
  async moveStage(stageId: string, dir: -1 | 1) {
    const sb = await this.db();
    const s = check(await sb.from("job_stages").select("id, job_id, position").eq("id", stageId).single()) as Row;
    const list = (await this.listStages(s.job_id as string));
    const i = list.findIndex((x) => x.id === stageId), j = i + dir;
    if (j < 0 || j >= list.length) return;
    await Promise.all([
      sb.from("job_stages").update({ position: list[j].position }).eq("id", list[i].id),
      sb.from("job_stages").update({ position: list[i].position }).eq("id", list[j].id),
    ]);
  }

  async getPlan(planId: string) {
    const sb = await this.db();
    const r = check(await sb.from("plans").select("id, job_id, version, data, created_at").eq("id", planId).maybeSingle()) as Row | null;
    return r ? ({ ...r, data: r.data as Plan } as PlanRow) : null;
  }
  async listRuns(jobId: string) {
    const sb = await this.db();
    return check(await sb.from("plan_runs").select("id, job_id, kind, file_name, status, error, plan_id, created_at, finished_at, metrics").eq("job_id", jobId).order("created_at", { ascending: false }).limit(20)) as PlanRun[];
  }
  async startRead(jobId: string, userId: string, file: File) {
    const sb = await this.db();
    const job = (await this.getJob(jobId))!;
    const path = `${job.company_id}/${jobId}/${Date.now()}-${safeName(file.name)}`;
    check(await sb.storage.from("plan-files").upload(path, file, { contentType: file.type || "application/octet-stream" }));
    const r = check(await sb.from("plan_runs").insert({ job_id: jobId, company_id: job.company_id, kind: "read", file_path: path, file_name: file.name, created_by: userId }).select("id").single()) as Row;
    return r.id as string;
  }
  async startAnswers(jobId: string, userId: string, planId: string, answers: Record<string, string>) {
    const sb = await this.db();
    const job = (await this.getJob(jobId))!;
    const r = check(await sb.from("plan_runs").insert({ job_id: jobId, company_id: job.company_id, kind: "answers", input: { plan_id: planId, answers }, created_by: userId }).select("id").single()) as Row;
    return r.id as string;
  }
  async listElementStates(jobId: string) {
    const sb = await this.db();
    return check(await sb.from("element_states").select("element_id, status").eq("job_id", jobId)) as ElementState[];
  }
  async setElementState(jobId: string, userId: string, elementId: string, status: ElementState["status"] | null) {
    const sb = await this.db();
    if (!status) {
      check(await sb.from("element_states").delete().eq("job_id", jobId).eq("element_id", elementId));
      return;
    }
    const job = (await this.getJob(jobId))!;
    check(await sb.from("element_states").upsert({ job_id: jobId, company_id: job.company_id, element_id: elementId, status, updated_by: userId, updated_at: new Date().toISOString() }));
  }

  async listPins(jobId: string) {
    const sb = await this.db();
    const rows = check(await sb.from("pins").select("*, pin_comments(count)").eq("job_id", jobId).order("number", { ascending: false })) as Row[];
    return rows.map(({ pin_comments, ...p }) => ({ ...(p as unknown as Pin), comment_count: ((pin_comments as { count: number }[])?.[0]?.count) ?? 0 }));
  }
  async createPin(jobId: string, userId: string, input: PinInput) {
    const sb = await this.db();
    const job = (await this.getJob(jobId))!;
    const r = check(await sb.from("pins").insert({ ...input, job_id: jobId, company_id: job.company_id, created_by: userId }).select("id").single()) as Row;
    return r.id as string;
  }
  async updatePin(pinId: string, input: Partial<PinInput> & { status?: Pin["status"] }) {
    const sb = await this.db();
    const patch: Row = { ...input };
    if (input.status) patch.closed_at = input.status === "done" ? new Date().toISOString() : null;
    check(await sb.from("pins").update(patch).eq("id", pinId));
  }
  async deletePin(pinId: string) {
    const sb = await this.db();
    check(await sb.from("pins").delete().eq("id", pinId));
  }
  async listComments(pinId: string) {
    const sb = await this.db();
    const rows = check(await sb.from("pin_comments").select("*").eq("pin_id", pinId).order("created_at")) as PinComment[];
    const ids = [...new Set(rows.map((r) => r.author_id).filter(Boolean))] as string[];
    const profiles = ids.length ? (check(await sb.from("profiles").select("user_id, full_name").in("user_id", ids)) as Row[]) : [];
    return rows.map((r) => ({ ...r, author_name: (profiles.find((p) => p.user_id === r.author_id)?.full_name as string) ?? null }));
  }
  async addComment(pinId: string, userId: string, body: string, photos: File[]) {
    const sb = await this.db();
    const pin = check(await sb.from("pins").select("company_id").eq("id", pinId).single()) as Row;
    const paths: string[] = [];
    for (const f of photos) {
      const path = `${pin.company_id}/pins/${pinId}/${Date.now()}-${safeName(f.name)}`;
      check(await sb.storage.from("pin-photos").upload(path, f, { contentType: f.type }));
      paths.push(path);
    }
    check(await sb.from("pin_comments").insert({ pin_id: pinId, company_id: pin.company_id, author_id: userId, body: body || null, photos: paths }));
  }
  async photoUrl(path: string) {
    const sb = await this.db();
    const r = check(await sb.storage.from("pin-photos").createSignedUrl(path, 3600)) as { signedUrl: string };
    return r.signedUrl;
  }
}
