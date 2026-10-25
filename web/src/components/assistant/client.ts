// The app's assistant goes through the server: it checks who's asking and what they may touch.
import type { AssistantSend } from "./Assistant";

export const askServer: AssistantSend = async (turns, context, signal) => {
  const res = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ turns, context }), signal });
  const body = (await res.json().catch(() => null)) as { text?: string; changed?: boolean; error?: string } | null;
  if (!res.ok || !body?.text) throw new Error(body?.error ?? "Couldn't reach the assistant.");
  return { text: body.text, changed: !!body.changed };
};
