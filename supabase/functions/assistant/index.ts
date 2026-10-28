// The Rorker assistant for the hosted preview. The page runs the tools itself on its sample job and
// sends each round here; this function adds the assistant's own instructions and tool list (the same
// ones the app uses, from core.js) and asks the model what to do next. The API key is a Supabase
// secret (ANTHROPIC_API_KEY, or ANTHROPIC_API_KEY_rorker) and never reaches the page. Only Rorker's own instructions and tools are
// ever sent, so it can't be used as a general chatbot.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { instructions, TOOLS } from "./core.js";

const API_KEY = () => Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY_rorker");
const MODEL = Deno.env.get("RORKER_ASSISTANT_MODEL") || "claude-haiku-5-5";
const MAX_BODY = 400_000;
// it may look up what an unfamiliar object looks like and how big it is (off with RORKER_WEB_SEARCH=off)
const WEB_SEARCH = { type: "web_search_20250305", name: "web_search", max_uses: 2 };
let webSearch = Deno.env.get("RORKER_WEB_SEARCH") !== "off";
const MAX_MESSAGES = 40;
const LIMIT = 40; // requests per address per 10 minutes, per running copy of the function
const WINDOW = 10 * 60_000;

const ORIGINS = [/^https:\/\/([a-z0-9-]+\.)?rorker\.com$/, /^https:\/\/[a-z0-9-]+\.github\.io$/, /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/, /^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];
const extra = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const allowed = (o: string | null) => !!o && (extra.includes(o) || ORIGINS.some((r) => r.test(o)));

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  list.push(now);
  hits.set(ip, list);
  return list.length > LIMIT;
}

const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": allowed(origin) ? origin! : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Not found." }, 404);
  if (!allowed(origin)) return json({ error: "Not allowed from this page." }, 403);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return json({ error: "Too many questions at once. Give it a minute." }, 429);
  if (!API_KEY()) return json({ error: "The assistant isn't switched on yet." }, 503);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "That's too much at once. Start a new question." }, 413);
  let body: { me?: Record<string, unknown>; context?: Record<string, unknown>; messages?: Anthropic.MessageParam[] };
  try { body = JSON.parse(raw); } catch { return json({ error: "Bad request." }, 400); }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  // the last turn is the person's (or tool results), or the model's own when a web search paused it
  if (!messages.length || messages[0].role !== "user" || !messages.every((m) => m && (m.role === "user" || m.role === "assistant"))) return json({ error: "Say something first." }, 400);

  const me = { name: str(body.me?.name, 80), role: body.me?.role === "employee" ? "employee" as const : "admin" as const, memberId: str(body.me?.memberId, 80), company: str(body.me?.company, 80) ?? "your company" };
  const c = body.context ?? {};
  const ctx = { jobId: str(c.jobId, 80), jobName: str(c.jobName, 120), where: str(c.where, 200), selected: str(c.selected, 200) };

  try {
    // the instructions are the same every time except the last two lines (today, where they are), so
    // the tools and the fixed part are cached; the conversation so far is cached as it grows
    const lines = instructions(me, ctx).split("\n");
    const params = {
      model: MODEL, max_tokens: 12000, thinking: { type: "adaptive" },
      system: [
        { type: "text", text: lines.slice(0, -2).join("\n"), cache_control: { type: "ephemeral" } },
        { type: "text", text: lines.slice(-2).join("\n") },
      ],
      tools: [...TOOLS, ...(webSearch ? [WEB_SEARCH] : [])] as Anthropic.Tool[], messages, cache_control: { type: "ephemeral" },
    };
    const client = new Anthropic({ apiKey: API_KEY() });
    let res;
    try { res = await client.messages.create(params as unknown as Anthropic.MessageCreateParamsNonStreaming); } catch (e) {
      // web search not available on this account: carry on without it
      if (!(webSearch && e instanceof Anthropic.APIError && e.status === 400 && /web.?search/i.test(e.message))) throw e;
      webSearch = false;
      res = await client.messages.create({ ...params, tools: TOOLS } as unknown as Anthropic.MessageCreateParamsNonStreaming);
    }
    return json({ content: res.content, stop_reason: res.stop_reason, usage: res.usage });
  } catch (e) {
    console.error("assistant", e instanceof Error ? e.message : e);
    const status = e instanceof Anthropic.APIError && e.status === 429 ? 429 : 502;
    return json({ error: status === 429 ? "Too many questions at once. Give it a minute." : "The assistant couldn't answer just now. Try again in a moment." }, status);
  }
});
