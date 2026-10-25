import type { ElementStatus, Plan } from "@/lib/plan/types";

export interface Company {
  id: string; name: string; logo_url: string | null; brand_color: string; phone: string | null;
  email: string | null; license_no: string | null; website: string | null; address: string | null;
}
export interface CompanyInput {
  name: string; phone?: string | null; email?: string | null; license_no?: string | null;
  website?: string | null; brand_color?: string | null; address?: string | null;
}

export type JobStatus = "lead" | "active" | "on_hold" | "done";
export interface Job {
  id: string; company_id: string; name: string; address: string | null; client_name: string | null;
  client_email: string | null; client_phone: string | null; job_type: string; status: JobStatus;
  start_date: string | null; current_plan_id: string | null; created_at: string;
}
export interface JobInput {
  name: string; address?: string | null; job_type: string; template_id?: string | null;
  client_name?: string | null; client_email?: string | null; client_phone?: string | null; start_date?: string | null;
}
export interface JobSummary extends Job {
  open_pins: number; stages_done: number; stages_total: number; current_stage: string | null;
  footprint: [number, number][][] | null; floors: number; size_mm: [number, number] | null; run_status: RunStatus | null;
}

export interface StageTemplate { id: string; name: string; job_type: string; stages: { name: string; description?: string }[]; is_default: boolean }
export type StageStatus = "not_started" | "active" | "done";
export interface JobStage { id: string; job_id: string; position: number; name: string; description: string | null; status: StageStatus; started_at: string | null; completed_at: string | null }

export type RunStatus = "queued" | "running" | "needs_answers" | "done" | "failed";
export interface PlanRun {
  id: string; job_id: string; kind: "read" | "answers"; file_name: string | null; status: RunStatus;
  error: string | null; plan_id: string | null; created_at: string; finished_at: string | null; metrics: Record<string, unknown>;
}
export interface PlanRow { id: string; job_id: string; version: number; data: Plan; created_at: string }

export type PinKind = "task" | "issue" | "note" | "material";
/** A pin placed in an upright view: on the outside of the building, or on one wall seen from inside. */
export interface PinAnchor { view: "site" | "exterior" | "wall"; side?: string; x: number; y: number }
export type PinStatus = "open" | "in_progress" | "done";
export interface Pin {
  id: string; job_id: string; number: number; element_id: string | null; floor_id: string | null;
  x: number | null; y: number | null; anchor?: PinAnchor | null; kind: PinKind; title: string; body: string | null; status: PinStatus;
  priority: number; due_date: string | null; assignee_id: string | null; close_requirement: "confirm" | "photo";
  stage_id: string | null; links: { title: string; url: string }[]; created_by: string | null; created_at: string;
  closed_at: string | null; comment_count?: number;
}
export interface PinInput {
  element_id?: string | null; floor_id?: string | null; x?: number | null; y?: number | null; anchor?: PinAnchor | null; kind: PinKind;
  title: string; body?: string | null; priority?: number; due_date?: string | null; close_requirement?: "confirm" | "photo";
  stage_id?: string | null; links?: { title: string; url: string }[];
}
export interface PinComment { id: string; pin_id: string; author_id: string | null; author_name?: string | null; body: string | null; photos: string[]; created_at: string }

export interface ElementState { element_id: string; status: ElementStatus }

export interface Member { user_id: string; full_name: string | null; role: string }

export interface Session { userId: string; email: string | null; name: string | null; company: Company | null; role: string | null }

export interface Repo {
  mode: "supabase" | "demo";
  // company
  createCompany(userId: string, input: CompanyInput, fullName?: string): Promise<string>;
  updateCompany(companyId: string, input: CompanyInput): Promise<void>;
  uploadLogo(companyId: string, file: File): Promise<void>;
  listMembers(companyId: string): Promise<Member[]>;
  // jobs
  listJobs(companyId: string): Promise<JobSummary[]>;
  getJob(jobId: string): Promise<Job | null>;
  createJob(companyId: string, userId: string, input: JobInput): Promise<string>;
  updateJob(jobId: string, input: Partial<JobInput> & { status?: JobStatus }): Promise<void>;
  // templates and stages
  listTemplates(companyId: string): Promise<StageTemplate[]>;
  saveTemplate(companyId: string, t: Omit<StageTemplate, "id" | "is_default"> & { id?: string }): Promise<void>;
  deleteTemplate(companyId: string, id: string): Promise<void>;
  listStages(jobId: string): Promise<JobStage[]>;
  setStageStatus(stageId: string, status: StageStatus): Promise<void>;
  addStage(jobId: string, name: string): Promise<void>;
  renameStage(stageId: string, name: string): Promise<void>;
  deleteStage(stageId: string): Promise<void>;
  moveStage(stageId: string, dir: -1 | 1): Promise<void>;
  // plans
  getPlan(planId: string): Promise<PlanRow | null>;
  listRuns(jobId: string): Promise<PlanRun[]>;
  startRead(jobId: string, userId: string, file: File): Promise<string>;
  startAnswers(jobId: string, userId: string, planId: string, answers: Record<string, string>): Promise<string>;
  listElementStates(jobId: string): Promise<ElementState[]>;
  setElementState(jobId: string, userId: string, elementId: string, status: ElementState["status"] | null): Promise<void>;
  // pins
  listPins(jobId: string): Promise<Pin[]>;
  createPin(jobId: string, userId: string, input: PinInput): Promise<string>;
  updatePin(pinId: string, input: Partial<PinInput> & { status?: PinStatus }): Promise<void>;
  deletePin(pinId: string): Promise<void>;
  listComments(pinId: string): Promise<PinComment[]>;
  addComment(pinId: string, userId: string, body: string, photos: File[]): Promise<void>;
  photoUrl(path: string): Promise<string>;
}
