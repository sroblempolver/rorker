// Talks to the New project assistant: sends the uploads and the conversation so far, gets back either
// questions or the finished project. The conversation is kept here, in the page.
import type { Sketch } from "@/lib/plan/sketch";
import type { IntakePart } from "./files";

export interface IntakeQuestion { id: string; text: string; options?: string[] }
export interface IntakeProject {
  summary: string;
  client?: { name?: string; email?: string; phone?: string };
  job: { name: string; address?: string; job_type: string; start_date?: string; scope?: string };
  sketch?: Sketch;
}
export type IntakeStep =
  | { kind: "questions"; message?: string; questions: IntakeQuestion[]; toolId: string }
  | { kind: "message"; text: string }
  | { kind: "project"; project: IntakeProject; toolId: string };

type Block = { type: string; id?: string; name?: string; input?: unknown; text?: string };
type Msg = { role: "user" | "assistant"; content: unknown };

export const INTAKE_URL = "https://uofdydjfwdsvaribvsfy.supabase.co/functions/v1/new-project";

export class IntakeChat {
  private history: Msg[] = [];
  private pending: IntakeStep | null = null;
  private drawn: Sketch | null = null;
  /** `plan`: the company's plan; paying plans get the best plan reader, the free plan a cheaper one. */
  constructor(private description: string, private parts: IntakePart[], private url = INTAKE_URL, private plan: "paid" | "free" = "paid") {}

  /** The contractor redrew the plan by hand: the next turn tells the assistant, so it keeps their fixes. */
  handDrawn(sketch: Sketch) { this.drawn = sketch; }

  /** Send the next turn: nothing for the first one, answers to the questions, a reply to a message, or what to change in the design. */
  async next(reply?: { answers?: Record<string, string>; text?: string }, signal?: AbortSignal): Promise<IntakeStep> {
    const p = this.pending;
    if (p?.kind === "questions") {
      const lines = p.questions.map((q) => `${q.text} -> ${reply?.answers?.[q.id]?.trim() || "(skipped: guess)"}`).join("\n");
      this.history.push({ role: "user", content: [{ type: "tool_result", tool_use_id: p.toolId, content: lines }] });
    } else if (p?.kind === "project") {
      // the contractor looked over the design: their corrections, or their OK
      const drawn = this.drawn ? `The contractor fixed the plan by hand with the drawing tools. This is the sketch now; start from it and keep their changes:\n${JSON.stringify(this.drawn)}\n\n` : "";
      this.drawn = null;
      this.history.push({ role: "user", content: [{ type: "tool_result", tool_use_id: p.toolId, content: `${drawn}The contractor reviewed the design and says: ${reply?.text?.trim() || "(no changes)"}` }] });
    } else if (p?.kind === "message") {
      this.history.push({ role: "user", content: reply?.text?.trim() || "Go ahead and make it with what you have." });
    }
    const r = await fetch(this.url, {
      method: "POST", headers: { "content-type": "application/json" }, signal,
      body: JSON.stringify({ description: this.description, parts: this.parts, history: this.history, today: new Date().toISOString().slice(0, 10), plan: this.plan }),
    }).catch(() => { throw new Error("Couldn't reach the assistant. Check your connection, or open the preview at build.rorker.com."); });
    const raw = await r.text();
    let res: { content?: Block[]; error?: string } | null = null;
    try { res = JSON.parse(raw.trim()); } catch { /* handled below */ }
    if (!r.ok || !res?.content) throw new Error(res?.error ?? "The assistant couldn't read that just now. Try again in a moment.");
    this.history.push({ role: "assistant", content: res.content });
    const tool = res.content.find((b) => b.type === "tool_use");
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    let step: IntakeStep;
    if (tool?.name === "ask_questions") {
      const inp = tool.input as { message?: string; questions?: IntakeQuestion[] };
      step = { kind: "questions", message: inp.message || text || undefined, questions: (inp.questions ?? []).slice(0, 4), toolId: tool.id! };
    } else if (tool?.name === "create_project") {
      step = { kind: "project", project: tool.input as IntakeProject, toolId: tool.id! };
    } else step = { kind: "message", text: text || "Tell me a bit more about the job." };
    this.pending = step;
    return step;
  }
}
