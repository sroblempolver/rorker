"use client";
// The Rorker assistant panel: type, or tap the mic and talk. It can look up any job you can see and
// make changes for you (add a pin, tag someone, close a task, move a stage along, put an outlet on
// a wall). Text by default; tap the mic and it answers out loud too, in the browser's own free voice.
import { useEffect, useRef, useState } from "react";
import type { AssistantContext } from "@/lib/assistant/core";
import { MicButton, speak, stopSpeaking, useDictation, VoiceNote } from "@/components/voice/speech";

export type Turn = { role: "user" | "assistant"; content: string };
/** Ask the assistant. `changed` says it changed something, so the screen should refresh. */
export type AssistantSend = (turns: Turn[], context: AssistantContext, signal: AbortSignal) => Promise<{ text: string; changed: boolean }>;

const HELLO = "Hi. Ask me about any job, or tell me what to do: \"add a task to fix the kitchen outlet, tag Marco\", \"what's open on Hadley Road?\", \"mark framing done\".";

export function Assistant({ send, context, onChanged, open, setOpen, wide }: { send: AssistantSend; context: AssistantContext; onChanged?: () => void; open: boolean; setOpen: (o: boolean) => void; /** no side panel on this screen */ wide?: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const ctxRef = useRef(context);
  ctxRef.current = context;

  const ask = async (msg: string, byVoice = false) => {
    const m = msg.trim();
    if (!m || busy) return;
    const next = [...turns, { role: "user" as const, content: m }];
    setTurns(next);
    setText("");
    setErr(null);
    setBusy(true);
    ctl.current = new AbortController();
    try {
      const r = await send(next, ctxRef.current, ctl.current.signal);
      setTurns((t) => [...t, { role: "assistant", content: r.text }]);
      if (r.changed) onChanged?.();
      if (byVoice || voiceReplies) speak(r.text);
    } catch (e) {
      const message = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Couldn't reach the assistant.";
      if (!(e && typeof e === "object" && "code" in e && (e as { code: string }).code === "cancelled")) setErr(message);
    } finally {
      setBusy(false);
      ctl.current = null;
    }
  };

  // one tap: talk, it sends when you stop, and the answer is read out
  const dict = useDictation((said) => { setVoiceReplies(true); void ask(said, true); });

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [turns, busy]);
  useEffect(() => { if (!open) { stopSpeaking(); ctl.current?.abort(); } }, [open]);

  const side = wide ? "" : "lg:right-[470px]";
  if (!open) return (
    <button onClick={() => setOpen(true)} aria-label="Open the assistant"
      className={`fixed z-40 right-4 bottom-4 ${side} h-12 pl-3 pr-4 rounded-full bg-accent text-accent-ink shadow-lg inline-flex items-center gap-2 font-display font-extrabold tracking-[0.08em] uppercase text-[14px] hover:brightness-110`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 5h16v11H9l-5 4z" /><path d="M8 10h8M8 13h5" /></svg>
      Ask
    </button>
  );

  return (
    <section role="dialog" aria-label="Rorker assistant" className={`fixed z-40 inset-x-2 bottom-2 sm:inset-x-auto sm:right-4 sm:bottom-4 ${side} sm:w-[380px] h-[min(560px,calc(100vh-90px))] flex flex-col bg-panel border border-line border-t-[3px] border-t-accent rounded-[6px] shadow-2xl`}>
      <header className="flex items-center gap-2 px-3 h-12 border-b border-line shrink-0">
        <span className="w-2 h-2 rounded-full bg-accent" />
        <h2 className="font-display font-extrabold uppercase tracking-[0.08em] text-[15px]">Rorker assistant</h2>
        <button onClick={() => { const on = !voiceReplies; setVoiceReplies(on); if (!on) stopSpeaking(); }} aria-pressed={voiceReplies}
          title={voiceReplies ? "Replies are read out loud" : "Read replies out loud"} className={`ml-auto chip !h-7 ${voiceReplies ? "!text-accent !border-accent" : ""}`}>
          {voiceReplies ? "🔊 Voice on" : "🔈 Voice off"}
        </button>
        <button onClick={() => setOpen(false)} aria-label="Close" className="w-8 h-8 grid place-items-center text-muted hover:text-text">✕</button>
      </header>
      <div ref={list} className="flex-1 overflow-y-auto scroll-thin px-3 py-3 space-y-2.5" aria-live="polite">
        {!turns.length && <p className="text-[13.5px] text-muted leading-relaxed">{HELLO}</p>}
        {turns.map((t, i) => (
          <div key={i} className={`max-w-[88%] px-3 py-2 rounded-[6px] text-[14px] leading-relaxed whitespace-pre-wrap ${t.role === "user" ? "ml-auto bg-panel-3" : "bg-panel-2 border border-line"}`}>{t.content}</div>
        ))}
        {busy && <div className="bg-panel-2 border border-line max-w-[60%] px-3 py-2 rounded-[6px] text-[14px] text-muted inline-flex items-center gap-2"><span className="dot bg-accent animate-pulse" />Working on it…<button className="text-[12px] underline ml-1" onClick={() => ctl.current?.abort()}>Stop</button></div>}
        {err && <p className="text-[13px] text-red">{err}</p>}
      </div>
      <form className="border-t border-line p-2.5 space-y-1.5 shrink-0" onSubmit={(e) => { e.preventDefault(); void ask(text); }}>
        <div className="flex items-end gap-2">
          <MicButton dictation={dict} size="lg" label="Talk to the assistant" />
          <textarea className="input !h-12 py-2.5 resize-none flex-1" placeholder={dict.listening ? "Listening…" : "Type or tap the mic"} value={dict.listening ? dict.interim : text} rows={1}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(text); } }} disabled={busy && !text} aria-label="Message" />
          <button className="btn btn-primary !h-12 !px-4" disabled={busy || !text.trim()} aria-label="Send">➤</button>
        </div>
        <VoiceNote dictation={dict} />
      </form>
    </section>
  );
}
