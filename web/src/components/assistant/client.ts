// The app's assistant goes through the server: it checks who's asking and what they may touch.
import type { AssistantSend } from "./Assistant";
import { showMarks, type Mark } from "@/lib/plan/marks";

export const askServer: AssistantSend = async (turns, context, signal) => {
  const res = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ turns, context }), signal });
  const body = (await res.json().catch(() => null)) as { text?: string; changed?: boolean; error?: string; marks?: Mark[]; focus?: string | null } | null;
  if (!res.ok || !body?.text) throw new Error(body?.error ?? "Couldn't reach the assistant.");
  // the places it talked about blink on the plan
  showMarks(body.marks ?? [], body.focus ?? null);
  return { text: body.text, changed: !!body.changed };
};
