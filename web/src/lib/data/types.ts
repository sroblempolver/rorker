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

/** A change made in the app to one plan element, applied on top of the plan as read. */
export interface ElementEdit {
  dx?: number; dy?: number; dz?: number; name?: string; kind?: string; type?: string; width?: number; depth?: number;
  height_mm?: number; spec?: string; product_name?: string; product_url?: string; notes?: string;
}

export type ItemKind = "outlet" | "switch" | "light" | "data" | "plumbing" | "vent" | "thermostat" | "mount" | "other";
/** A small thing placed on a wall (outlet, switch, light ...): dragged and edited in the wall view.
 *  x is mm along the wall side from its left end as seen from inside; y is mm above the floor. */
export interface JobItem { id: string; job_id: string; kind: ItemKind; label: string | null; floor_id: string; side: string; x: number; y: number; note: string | null; created_at: string }
export interface ItemInput { kind: ItemKind; label?: string | null; floor_id: string; side: string; x: number; y: number; note?: string | null }

export type PinKind = "task" | "issue" | "note" | "material";
/** A pin placed outside the floor plans: on the site, the front elevation, one wall seen from inside, or
 *  a point on the 3D building (roof, outside walls): `point` has x, y on the plan and z mm above the ground. */
export interface PinAnchor { view: "site" | "exterior" | "wall" | "point"; side?: string; x: number; y: number; z?: number }
export type PinStatus = "open" | "in_progress" | "done";
export interface Pin {
  id: string; job_id: string; number: number; element_id: string | null; floor_id: string | null;
  x: number | null; y: number | null; anchor?: PinAnchor | null; kind: PinKind; title: string; body: string | null; status: PinStatus;
  priority: number; due_date: string | null; tagged: string[]; close_requirement: "confirm" | "photo";
  stage_id: string | null; links: { title: string; url: string }[]; created_by: string | null; created_at: string;
  closed_at: string | null; comment_count?: number;
}
export interface PinInput {
  element_id?: string | null; floor_id?: string | null; x?: number | null; y?: number | null; anchor?: PinAnchor | null; kind: PinKind;
  title: string; body?: string | null; priority?: number; due_date?: string | null; close_requirement?: "confirm" | "photo";
  stage_id?: string | null; links?: { title: string; url: string }[]; tagged?: string[];
}
export interface PinComment { id: string; pin_id: string; author_id: string | null; author_name?: string | null; body: string | null; photos: string[]; created_at: string }

export interface ElementState { element_id: string; status: ElementStatus }

/** Admin: everything, including the company, the team and stage templates. Employee: jobs, pins and
 *  stages only ("editor"). The owner is an admin who can't be removed or demoted. */
export type MemberRole = "admin" | "employee";
export interface Member {
  id: string; user_id: string | null; full_name: string; email: string | null; phone: string | null;
  title: string | null; role: MemberRole; is_owner: boolean;
}
export interface MemberInput { full_name: string; email?: string | null; phone?: string | null; title?: string | null; role: MemberRole }

/** A no-sign-in link to one job for a team member or a one-time sub. It shows the plan and only the
 *  pins that are theirs: the ones tagged to `member_id` (now and later), plus any listed in `pin_ids`. */
export interface ShareLink {
  id: string; job_id: string; token: string; label: string; member_id: string | null; pin_ids: string[];
  expires_at: string | null; revoked_at: string | null; created_at: string;
}
export interface ShareLinkInput { label: string; member_id?: string | null; pin_ids?: string[]; expires_at?: string | null }
/** What a shared link shows. Built by shareView(), never straight from the database. */
export interface SharedView {
  label: string; expires_at: string | null;
  company: { name: string; logo_url: string | null; brand_color: string; phone: string | null };
  job: { id: string; name: string; address: string | null };
  plan: Plan | null; edits: Record<string, ElementEdit>; items: JobItem[];
  pins: Pin[]; stages: { name: string; status: StageStatus }[];
  /** names only, for the people tagged on these pins */
  people: { id: string; full_name: string; title: string | null }[];
}

export interface Session { userId: string; email: string | null; name: string | null; company: Company | null; role: MemberRole | null; memberId: string | null }

export interface Repo {
  mode: "supabase" | "demo";
  // company
  createCompany(userId: string, input: CompanyInput, fullName?: string): Promise<string>;
  updateCompany(companyId: string, input: CompanyInput): Promise<void>;
  uploadLogo(companyId: string, file: File): Promise<void>;
  listMembers(companyId: string): Promise<Member[]>;
  addMember(companyId: string, input: MemberInput): Promise<string>;
  updateMember(memberId: string, input: Partial<MemberInput>): Promise<void>;
  removeMember(memberId: string): Promise<void>;
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
  listElementEdits(jobId: string): Promise<Record<string, ElementEdit>>;
  saveElementEdit(jobId: string, userId: string, elementId: string, data: ElementEdit | null): Promise<void>;
  // wall items
  listItems(jobId: string): Promise<JobItem[]>;
  createItem(jobId: string, userId: string, input: ItemInput): Promise<JobItem>;
  updateItem(itemId: string, input: Partial<ItemInput>): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
  // pins
  listPins(jobId: string): Promise<Pin[]>;
  createPin(jobId: string, userId: string, input: PinInput): Promise<string>;
  updatePin(pinId: string, input: Partial<PinInput> & { status?: PinStatus }): Promise<void>;
  deletePin(pinId: string): Promise<void>;
  listComments(pinId: string): Promise<PinComment[]>;
  addComment(pinId: string, userId: string, body: string, photos: File[]): Promise<void>;
  photoUrl(path: string): Promise<string>;

  listShareLinks(jobId: string): Promise<ShareLink[]>;
  createShareLink(jobId: string, userId: string, input: ShareLinkInput): Promise<ShareLink>;
  revokeShareLink(linkId: string): Promise<void>;
  /** No sign-in: the token is the key. Null when unknown, revoked or expired. */
  getSharedView(token: string): Promise<SharedView | null>;
}
