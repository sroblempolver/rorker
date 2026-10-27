// The Rorker assistant, on the server: the model plans, the tools run here as the signed-in person.
// Text in and out (voice is done free in the browser). The API key lives in the hosting settings.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/data";
import { instructions, runTool, TOOLS, type AssistantContext, type Changes } from "@/lib/assistant/core";
import { serverBackend } from "@/lib/assistant/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.RORKER_ASSISTANT_MODEL || "claude-haiku-5-5";
const MAX_ROUNDS = 8;
// it may look up what an unfamiliar object looks like and how big it is (off with RORKER_WEB_SEARCH=off)
const WEB_SEARCH = { type: "web_search_20250305", name: "web_search", max_uses: 2 };
let webSearch = process.env.RORKER_WEB_SEARCH !== "off";

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const s = await getSession();
  if (!s?.company) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)) return NextResponse.json({ error: "The assistant isn't switched on for this account yet." }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { turns?: Turn[]; context?: AssistantContext } | null;
  const turns = (body?.turns ?? []).filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim()).slice(-20);
  if (!turns.length || turns[turns.length - 1].role !== "user") return NextResponse.json({ error: "Say something first." }, { status: 400 });
  const ctx = body?.context ?? {};
  const backend = serverBackend(s as Parameters<typeof serverBackend>[0]);
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = turns.map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));
  const changed: Changes = { any: false };
  const done: string[] = [];
  // the instructions are fixed except the last two lines (today, where they are): cache the fixed part
  // with the tools; the conversation is cached as it grows, round by round
  const lines = instructions(backend.me, ctx).split("\n");
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: lines.slice(0, -2).join("\n"), cache_control: { type: "ephemeral" } },
    { type: "text", text: lines.slice(-2).join("\n") },
  ];
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const ask = () => client.messages.create({
        model: MODEL, max_tokens: 12000, thinking: { type: "adaptive" },
        system, tools: [...TOOLS, ...(webSearch ? [WEB_SEARCH] : [])] as Anthropic.Tool[], messages, cache_control: { type: "ephemeral" },
      } as unknown as Anthropic.MessageCreateParamsNonStreaming);
      let res: Anthropic.Message;
      try { res = await ask(); } catch (e) {
        // web search not available on this account: carry on without it
        if (!(webSearch && e instanceof Anthropic.APIError && e.status === 400 && /web.?search/i.test(e.message))) throw e;
        webSearch = false;
        res = await ask();
      }
      // a long web search pauses the turn: send it back as it is and it carries on
      if (res.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: res.content }); continue; }
      if (res.stop_reason !== "tool_use") {
        const text = res.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text).join("\n").trim();
        return NextResponse.json({ text: text || "Done.", changed: changed.any, marks: changed.marks ?? [], focus: changed.focus ?? null, actions: done });
      }
      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        try {
          const out = await runTool(backend, ctx, block.name, (block.input ?? {}) as Record<string, unknown>, changed);
          done.push(block.name);
          results.push({ type: "tool_result", tool_use_id: block.id, content: typeof out === "string" ? out : JSON.stringify(out).slice(0, 30000) });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: e instanceof Error ? e.message : "That didn't work." });
        }
      }
      messages.push({ role: "user", content: results });
    }
    return NextResponse.json({ text: "That took too many steps. Try asking for one thing at a time.", changed: changed.any, actions: done });
  } catch (e) {
    console.error("assistant", e);
    return NextResponse.json({ error: "The assistant couldn't answer just now. Try again in a moment.", changed: changed.any }, { status: 502 });
  }
}
