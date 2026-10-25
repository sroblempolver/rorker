// The assistant in the standalone preview: the same tools and instructions as the app, run on the
// sample job in memory. Inside a published artifact the page's built-in model access writes the answer;
// on its own web address (where the microphone works) it asks the Rorker assistant function on
// Supabase, which holds the API key, and runs the tools here, round by round.
import type { AssistantSend, Turn } from "@/components/assistant/Assistant";
import type { WorkspaceApi, WorkspaceData } from "@/components/workspace/api";
import { instructions, runTool, TOOLS, type AssistantBackend, type AssistantContext } from "@/lib/assistant/core";

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

const FUNCTION_URL = "https://uofdydjfwdsvaribvsfy.supabase.co/functions/v1/assistant";
const ROUNDS = 8;

type Block = { type: string; id?: string; name?: string; input?: Record<string, unknown>; text?: string };
type Msg = { role: "user" | "assistant"; content: string | unknown[] };

async function viaFunction(b: AssistantBackend, turns: Turn[], context: AssistantContext, signal: AbortSignal) {
  const messages: Msg[] = turns.map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));
  const changed = { any: false };
  for (let round = 0; round < ROUNDS; round++) {
    const r = await fetch(FUNCTION_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ me: b.me, context, messages }), signal });
    const res = (await r.json().catch(() => null)) as { content?: Block[]; stop_reason?: string; error?: string } | null;
    if (!r.ok || !res?.content) throw new Error(res?.error ?? "The assistant couldn't answer just now. Try again in a moment.");
    if (res.stop_reason !== "tool_use") {
      const text = res.content.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
      return { text: text || "Done.", changed: changed.any };
    }
    messages.push({ role: "assistant", content: res.content });
    const results: unknown[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      try {
        const out = await runTool(b, context, block.name!, block.input ?? {}, changed);
        results.push({ type: "tool_result", tool_use_id: block.id, content: typeof out === "string" ? out : JSON.stringify(out).slice(0, 30000) });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: e instanceof Error ? e.message : "That didn't work." });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { text: "That took too many steps. Try asking for one thing at a time.", changed: changed.any };
}

export function previewAsk(d: WorkspaceData, api: WorkspaceApi): AssistantSend {
  const b = backend(d, api);
  return async (turns, context, signal) => {
    const host = (window as unknown as { claude?: Host }).claude;
    if (!host) return viaFunction(b, turns, context, signal);
    const sample = (await host.use("sample")) as SampleFn | null;
    if (!sample) throw new Error("The assistant isn't available in this copy of the preview. Open the preview's own web address, where the mic works too.");
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
