"use server";
// Server actions for jobs and the job workspace. Every action checks the job belongs to the caller's
// company first; on Supabase, row-level security checks again.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRepo, requireCompany, requireJob } from "@/lib/data";
import { attempt } from "@/lib/result";
import type { ElementState, JobStage, Pin, PinComment, PinInput, PinStatus, PlanRow, PlanRun, StageStatus } from "@/lib/data/types";

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
