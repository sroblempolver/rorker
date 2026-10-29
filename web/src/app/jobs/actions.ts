"use server";
// Server actions for jobs and the job workspace. Every action checks the job belongs to the caller's
// company first; on Supabase, row-level security checks again.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRepo, requireCompany, requireJob } from "@/lib/data";
import { attempt } from "@/lib/result";
import type { ElementEdit, ElementState, ItemInput, JobItem, JobStage, Pin, PinComment, PinInput, PinStatus, PlanRow, PlanRun, ShareLink, ShareLinkInput, StageStatus } from "@/lib/data/types";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

export async function createJob(_prev: { error?: string } | null, form: FormData): Promise<{ error?: string }> {
  const s = await requireCompany();
  const name = str(form, "name");
  if (!name) return { error: "Give the job a name." };
  const repo = getRepo();
  let id: string;
  try {
    id = await repo.createJob(s.company.id, s.userId, {
      name, address: str(form, "address"), job_type: str(form, "job_type") ?? "renovation", template_id: str(form, "template_id"),
      client_name: str(form, "client_name"), client_email: str(form, "client_email"), client_phone: str(form, "client_phone"),
      start_date: str(form, "start_date"),
    });
    const file = form.get("plan");
    if (file instanceof File && file.size > 0) await repo.startRead(id, s.userId, file);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the job." };
  }
  revalidatePath("/jobs");
  redirect(`/jobs/${id}`);
}

export async function updateJobStatus(jobId: string, status: "lead" | "active" | "on_hold" | "done") {
  await requireJob(jobId);
  await getRepo().updateJob(jobId, { status });
  revalidatePath("/jobs");
}

// ---------------------------------------------------------------- element status

export async function setElementState(jobId: string, elementId: string, status: ElementState["status"] | null) {
  const { session } = await requireJob(jobId);
  await getRepo().setElementState(jobId, session.userId, elementId, status);
}

const EDIT_NUM = ["dx", "dy", "dz", "width", "depth", "height_mm", "facing", "sill_mm", "slide"] as const;
// whole objects kept as they come (an added object, a door or window added or a wall moved in Build
// mode, a room cut in two, the furnishing), as long as they're plain data of a sensible size
const EDIT_OBJ = ["added", "opening", "move", "split", "cut", "furnish", "stage_looks", "build"] as const;
const EDIT_STR = ["name", "kind", "type", "spec", "product_name", "product_url", "notes"] as const;

/** Save the whole set of app-side changes for one element (null clears them). */
export async function saveElementEdit(jobId: string, elementId: string, data: ElementEdit | null) {
  return attempt(async () => {
    const { session } = await requireJob(jobId);
    let clean: ElementEdit | null = null;
    if (data) {
      clean = {};
      for (const k of EDIT_NUM) {
        const v = data[k];
        if (v == null) continue;
        if (!Number.isFinite(v) || Math.abs(v) > 100000) throw new Error("That size or position looks wrong.");
        clean[k] = Math.round(v);
      }
      for (const k of EDIT_STR) {
        const v = data[k];
        if (typeof v === "string" && v.trim()) clean[k] = v.trim().slice(0, 500);
      }
      if (data.removed === true) clean.removed = true;
      for (const k of EDIT_OBJ) {
        const v = data[k];
        if (v == null) continue;
        if (JSON.stringify(v).length > 20000) throw new Error("That change is too big to save.");
        (clean as Record<string, unknown>)[k] = JSON.parse(JSON.stringify(v));
      }
      if (clean.product_url && !/^https?:\/\//.test(clean.product_url)) throw new Error("Product links need to start with http:// or https://");
      if (clean.width != null && clean.width < 20 || clean.depth != null && clean.depth < 20) throw new Error("That is too small.");
    }
    await getRepo().saveElementEdit(jobId, session.userId, elementId, clean);
  });
}

// ---------------------------------------------------------------- wall items

const ITEM_KINDS = ["outlet", "switch", "light", "data", "plumbing", "vent", "thermostat", "mount", "other"];
function cleanItem<T extends Partial<ItemInput>>(input: T): T {
  if (input.kind && !ITEM_KINDS.includes(input.kind)) throw new Error("Unknown item type.");
  for (const k of ["x", "y"] as const) if (input[k] != null && !Number.isFinite(input[k])) throw new Error("Bad position.");
  const out = { ...input };
  if (out.x != null) out.x = Math.round(Math.max(0, out.x));
  if (out.y != null) out.y = Math.round(Math.max(0, Math.min(6000, out.y)));
  if (out.label !== undefined) out.label = out.label?.trim() || null;
  if (out.note !== undefined) out.note = out.note?.trim() || null;
  return out;
}

export async function createItem(jobId: string, input: ItemInput) {
  return attempt(async (): Promise<JobItem> => {
    const { session } = await requireJob(jobId);
    return getRepo().createItem(jobId, session.userId, cleanItem(input));
  });
}

export async function updateItem(jobId: string, itemId: string, input: Partial<ItemInput>) {
  return attempt(async () => {
    await requireJob(jobId);
    if (!(await getRepo().listItems(jobId)).some((i) => i.id === itemId)) throw new Error("That item is gone.");
    await getRepo().updateItem(itemId, cleanItem(input));
  });
}

export async function deleteItem(jobId: string, itemId: string) {
  return attempt(async () => {
    await requireJob(jobId);
    if (!(await getRepo().listItems(jobId)).some((i) => i.id === itemId)) return;
    await getRepo().deleteItem(itemId);
  });
}

// ---------------------------------------------------------------- pins

export async function createPin(jobId: string, input: PinInput): Promise<Pin> {
  const { session } = await requireJob(jobId);
  if (!input.title?.trim()) throw new Error("A pin needs a title.");
  const repo = getRepo();
  const id = await repo.createPin(jobId, session.userId, { ...input, title: input.title.trim() });
  const pin = (await repo.listPins(jobId)).find((p) => p.id === id)!;
  revalidatePath("/jobs");
  return pin;
}

export async function updatePin(jobId: string, pinId: string, input: Partial<PinInput> & { status?: PinStatus }) {
  return attempt(async () => {
    await requireJob(jobId);
    const repo = getRepo();
    if (input.status === "done") {
      const pin = (await repo.listPins(jobId)).find((p) => p.id === pinId);
      if (pin?.close_requirement === "photo") {
        const comments = await repo.listComments(pinId);
        if (!comments.some((c) => c.photos.length)) throw new Error("This one needs a photo before it can be closed.");
      }
    }
    await repo.updatePin(pinId, input);
    revalidatePath("/jobs");
  });
}

export async function deletePin(jobId: string, pinId: string) {
  await requireJob(jobId);
  await getRepo().deletePin(pinId);
  revalidatePath("/jobs");
}

// ---------------------------------------------------------------- shared links (admins only)

async function requireJobAdmin(jobId: string) {
  const r = await requireJob(jobId);
  if (r.session.role !== "admin") throw new Error("Only an admin can share a job. Ask the owner.");
  return r;
}

export async function listShareLinks(jobId: string) {
  return attempt(async (): Promise<ShareLink[]> => {
    await requireJobAdmin(jobId);
    return getRepo().listShareLinks(jobId);
  });
}

export async function createShareLink(jobId: string, input: ShareLinkInput) {
  return attempt(async (): Promise<ShareLink> => {
    const { session } = await requireJobAdmin(jobId);
    const repo = getRepo();
    const label = input.label?.trim();
    if (!label) throw new Error("Say who the link is for.");
    const members = input.member_id ? await repo.listMembers(session.company.id) : [];
    if (input.member_id && !members.some((m) => m.id === input.member_id)) throw new Error("That person isn't on your team.");
    const pins = new Set((await repo.listPins(jobId)).map((p) => p.id));
    const pin_ids = (input.pin_ids ?? []).filter((id) => pins.has(id));
    if (!input.member_id && !pin_ids.length) throw new Error("Pick the tasks they should see.");
    return repo.createShareLink(jobId, session.userId, { label: label.slice(0, 80), member_id: input.member_id ?? null, pin_ids, expires_at: input.expires_at ?? null });
  });
}

export async function revokeShareLink(jobId: string, linkId: string) {
  return attempt(async () => {
    await requireJobAdmin(jobId);
    if (!(await getRepo().listShareLinks(jobId)).some((l) => l.id === linkId)) return;
    await getRepo().revokeShareLink(linkId);
  });
}

/** A tagged person's own link (all their tasks for this company), made the first time it's asked for. */
export async function personLink(jobId: string, memberId: string) {
  return attempt(async (): Promise<ShareLink> => {
    const { session } = await requireJobAdmin(jobId);
    return getRepo().personLink(session.company.id, session.userId, memberId);
  });
}

async function commentsWithUrls(pinId: string): Promise<PinComment[]> {
  const repo = getRepo();
  const list = await repo.listComments(pinId);
  return Promise.all(list.map(async (c) => ({ ...c, photos: await Promise.all(c.photos.map((p) => repo.photoUrl(p))) })));
}

export async function listComments(jobId: string, pinId: string): Promise<PinComment[]> {
  await requireJob(jobId);
  return commentsWithUrls(pinId);
}

export async function addComment(jobId: string, form: FormData): Promise<PinComment[]> {
  const { session } = await requireJob(jobId);
  const pinId = str(form, "pin_id")!;
  const body = str(form, "body") ?? "";
  const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (!body && !photos.length) return commentsWithUrls(pinId);
  await getRepo().addComment(pinId, session.userId, body, photos);
  return commentsWithUrls(pinId);
}

// ---------------------------------------------------------------- stages

async function stagesAfter(jobId: string, fn: () => Promise<void>): Promise<JobStage[]> {
  await requireJob(jobId);
  await fn();
  revalidatePath("/jobs");
  return getRepo().listStages(jobId);
}

export async function setStageStatus(jobId: string, stageId: string, status: StageStatus) {
  return stagesAfter(jobId, () => getRepo().setStageStatus(stageId, status));
}
export async function addStage(jobId: string, name: string) {
  return stagesAfter(jobId, () => getRepo().addStage(jobId, name.trim() || "New stage"));
}
export async function renameStage(jobId: string, stageId: string, name: string) {
  return stagesAfter(jobId, () => getRepo().renameStage(stageId, name.trim() || "Stage"));
}
export async function deleteStage(jobId: string, stageId: string) {
  return stagesAfter(jobId, () => getRepo().deleteStage(stageId));
}
export async function moveStage(jobId: string, stageId: string, dir: -1 | 1) {
  return stagesAfter(jobId, () => getRepo().moveStage(stageId, dir));
}

// ---------------------------------------------------------------- plan

export async function uploadPlan(jobId: string, form: FormData) {
  const { session } = await requireJob(jobId);
  const file = form.get("plan");
  if (!(file instanceof File) || !file.size) throw new Error("Choose a file first.");
  await getRepo().startRead(jobId, session.userId, file);
}

export async function answerQuestions(jobId: string, planId: string, answers: Record<string, string>) {
  const { session } = await requireJob(jobId);
  await getRepo().startAnswers(jobId, session.userId, planId, answers);
}

export async function refreshPlan(jobId: string): Promise<{ runs: PlanRun[]; plan: PlanRow | null }> {
  const { job } = await requireJob(jobId);
  const repo = getRepo();
  const runs = await repo.listRuns(jobId);
  const fresh = await repo.getJob(job.id);
  const plan = fresh?.current_plan_id ? await repo.getPlan(fresh.current_plan_id) : null;
  return { runs, plan };
}
