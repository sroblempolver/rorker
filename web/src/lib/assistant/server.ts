import "server-only";
// The assistant's backend in the app: every call goes through the signed-in person's own access,
// the same checks the screens use (company membership here, row-level security on Supabase).
import { getRepo } from "@/lib/data";
import type { Session } from "@/lib/data/types";
import type { AssistantBackend, JobBundle } from "./core";

export function serverBackend(s: Session & { company: NonNullable<Session["company"]> }): AssistantBackend {
  const repo = getRepo();
  const cache = new Map<string, JobBundle | null>();
  const load = async (jobId: string): Promise<JobBundle | null> => {
    if (cache.has(jobId)) return cache.get(jobId)!;
    const job = await repo.getJob(jobId);
    if (!job || job.company_id !== s.company.id) { cache.set(jobId, null); return null; }
    const [plan, pins, stages, items, states, edits] = await Promise.all([
      job.current_plan_id ? repo.getPlan(job.current_plan_id) : Promise.resolve(null),
      repo.listPins(jobId), repo.listStages(jobId), repo.listItems(jobId), repo.listElementStates(jobId), repo.listElementEdits(jobId),
    ]);
    const b: JobBundle = { job, plan: plan?.data ?? null, edits, pins, stages, items, states };
    cache.set(jobId, b);
    return b;
  };
  const own = async (jobId: string) => { if (!(await load(jobId))) throw new Error("You can't open that job."); cache.delete(jobId); };
  return {
    me: { name: s.name, role: s.role ?? "employee", memberId: s.memberId, company: s.company.name },
    listJobs: async () => repo.listJobs(s.company.id),
    loadJob: load,
    members: () => repo.listMembers(s.company.id),
    async createPin(jobId, input) {
      await own(jobId);
      const id = await repo.createPin(jobId, s.userId, input);
      return (await repo.listPins(jobId)).find((p) => p.id === id)!;
    },
    async updatePin(jobId, pinId, input) {
      const d = await load(jobId);
      const pin = d?.pins.find((p) => p.id === pinId);
      if (!pin) throw new Error("That pin isn't on this job.");
      if (input.status === "done" && pin.close_requirement === "photo" && !(await repo.listComments(pinId)).some((c) => c.photos.length)) throw new Error("This pin needs a photo before it can be closed. Ask them to add one in the app.");
      cache.delete(jobId);
      await repo.updatePin(pinId, input);
    },
    async setStageStatus(jobId, stageId, status) {
      const d = await load(jobId);
      if (!d?.stages.some((x) => x.id === stageId)) throw new Error("That stage isn't on this job.");
      cache.delete(jobId);
      await repo.setStageStatus(stageId, status);
    },
    async setElementState(jobId, elementId, status) { await own(jobId); await repo.setElementState(jobId, s.userId, elementId, status); },
    async createItem(jobId, input) { await own(jobId); return repo.createItem(jobId, s.userId, input); },
    async saveEdit(jobId, elementId, data) { await own(jobId); await repo.saveElementEdit(jobId, s.userId, elementId, data); },
  };
}
