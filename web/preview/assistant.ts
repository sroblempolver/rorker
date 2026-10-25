// The assistant in the standalone preview: the same tools and instructions as the app, run on the
// sample job in memory, with the answer written by the page's built-in model access. Outside a page
// that has it (opened as a plain file), the Ask panel explains that the assistant runs in the full app.
import type { AssistantSend } from "@/components/assistant/Assistant";
import type { WorkspaceApi, WorkspaceData } from "@/components/workspace/api";
import { instructions, runTool, TOOLS, type AssistantBackend } from "@/lib/assistant/core";

type SampleFn = (input: { role: "user" | "assistant"; content: string }[], opts: Record<string, unknown>) => Promise<{ text: string }>;
type Host = { use(name: string): Promise<unknown> };

function backend(d: WorkspaceData, api: WorkspaceApi): AssistantBackend {
  const mine = (id: string) => id === d.job.id;
  return {
    me: { name: "Company owner", role: "admin", memberId: d.me, company: "Demo Builders" },
    async listJobs() { return [d.job]; },
    async loadJob(id) { return mine(id) ? { job: d.job, plan: d.plan?.data ?? null, pins: d.pins, stages: d.stages, items: d.items, states: d.states } : null; },
    async members() { return d.members; },
    async createPin(id, input) { if (!mine(id)) throw new Error("Job not found."); return api.createPin(input); },
    async updatePin(id, pin, input) { if (!mine(id)) throw new Error("Job not found."); await api.updatePin(pin, input); },
    async setStageStatus(id, stage, status) { if (!mine(id)) throw new Error("Job not found."); await api.setStageStatus(stage, status); },
    async setElementState(id, el, status) { if (!mine(id)) throw new Error("Job not found."); await api.setElementState(el, status); },
    async createItem(id, input) { if (!mine(id)) throw new Error("Job not found."); return api.createItem(input); },
  };
}

export function previewAsk(d: WorkspaceData, api: WorkspaceApi): AssistantSend {
  const b = backend(d, api);
  return async (turns, context, signal) => {
    const host = (window as unknown as { claude?: Host }).claude;
    const sample = (host ? await host.use("sample") : null) as SampleFn | null;
    if (!sample) throw new Error("The assistant isn't available in this copy of the preview. It works in the full app and on the published preview page.");
    const changed = { any: false };
    const tools = TOOLS.map((t) => ({
      name: t.name, description: t.description, inputSchema: t.input_schema,
      execute: async (input: Record<string, unknown>) => runTool(b, context, t.name, input ?? {}, changed),
    }));
    const lead = `${instructions(b.me, context)}\nDon't write anything before or between tool calls; reply once, at the end.\n\nThe person says:\n${turns[0].content}`;
    try {
      const r = await sample([{ role: "user", content: lead }, ...turns.slice(1)], { tools, cache: false, signal });
      return { text: r.text.trim(), changed: changed.any };
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
      if (code === "cancelled") throw e;
      if (code === "not_granted") throw new Error("The assistant needs your OK to answer. Allow it when asked, or use the artifact's Permissions menu.");
      if (code === "rate_limited") throw new Error("Too many questions at once. Give it a minute.");
      if (changed.any) return { text: "Done, but I couldn't finish the reply.", changed: true };
      throw new Error("The assistant couldn't answer just now. Try again in a moment.");
    }
  };
}
