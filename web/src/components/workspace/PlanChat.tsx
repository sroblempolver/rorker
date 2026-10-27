"use client";
// Talk to the plan: in the Plan tab, say what to change ("put a sofa facing the TV in the living room",
// "move the bed 30 cm north", "rename the study to Office") and the assistant changes the plan. The mic
// is the main button; the keyboard button opens a line to type. Quick buttons furnish a room or the
// whole house in one tap.
import { useEffect, useRef, useState } from "react";
import type { AssistantSend, Turn } from "@/components/assistant/Assistant";
import type { AssistantContext } from "@/lib/assistant/core";
import { FURNISH } from "@/lib/plan/furnish";
import { speak, stopSpeaking, useDictation, VoiceNote } from "@/components/voice/speech";

const HINT = "Say what to change: \"put a sofa facing the TV in the living room\", \"move the bed 30 cm north\", \"turn the desk to face the window\", \"rename the study to Office\".";

export function PlanChat({ send, context, rooms, onChanged }: { send: AssistantSend; context: AssistantContext; rooms: string[]; onChanged?: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [where, setWhere] = useState("");
  const ctl = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
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
      const c = ctxRef.current;
      const r = await send(next.slice(-12), { ...c, where: `the Plan tab, changing the plan${c.where ? ` (looking at ${c.where})` : ""}` }, ctl.current.signal);
      setTurns((t) => [...t, { role: "assistant", content: r.text }]);
      if (r.changed) onChanged?.();
      if (byVoice) speak(r.text);
    } catch (e) {
      const cancelled = !!(e && typeof e === "object" && "code" in e && (e as { code: string }).code === "cancelled") || (e instanceof DOMException && e.name === "AbortError");
      if (!cancelled) setErr(e instanceof Error ? e.message : "Couldn't reach the assistant.");
    } finally {
      setBusy(false);
      ctl.current = null;
    }
  };

  const dict = useDictation((said) => { void ask(said, true); });
  const voice = dict.supported && !dict.blocked;
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [turns, busy, dict.interim]);
  useEffect(() => { if (typing) input.current?.focus(); }, [typing]);
  useEffect(() => () => { ctl.current?.abort(); stopSpeaking(); }, []);

  const press = voice ? dict.hold() : { onClick: () => setTyping(true) };
  const shown = turns.slice(-6);

  return (
    <section className="card p-3 space-y-2.5 border-l-[3px] border-l-accent" aria-label="Change the plan">
      <div className="flex items-center gap-3">
        <button {...press} aria-pressed={dict.listening} disabled={busy}
          aria-label={!voice ? "Type what to change" : "Hold to talk and change the plan"}
          title={!voice ? "Type what to change" : dict.listening ? "Listening… let go when you're done" : "Hold and talk, let go to send"}
          className={`shrink-0 w-12 h-12 rounded-full grid place-items-center shadow-lg transition-colors disabled:opacity-60 ${dict.listening ? "bg-red text-white animate-pulse" : "bg-accent text-accent-ink hover:brightness-110"}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" fill={dict.listening ? "currentColor" : "none"} /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Change the plan</p>
          <p className="text-[12.5px] text-muted leading-snug">Hold the mic and talk, or type, and the plan changes.</p>
        </div>
        <button onClick={() => setTyping(!typing)} aria-pressed={typing} aria-label="Type instead" title="Type instead"
          className={`shrink-0 w-9 h-9 rounded-full grid place-items-center border ${typing ? "bg-panel-3 border-accent text-accent" : "bg-panel-2 border-line text-text hover:border-accent"}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></svg>
        </button>
      </div>

      <div ref={list} className="max-h-[220px] overflow-y-auto scroll-thin space-y-1.5" aria-live="polite">
        {!shown.length && !busy && !dict.listening && <p className="text-[12.5px] text-muted leading-relaxed">{HINT}</p>}
        {shown.map((t, i) => (
          <p key={turns.length - shown.length + i} className={`text-[13.5px] leading-snug whitespace-pre-wrap ${t.role === "user" ? "text-muted" : "text-text"}`}>
            {t.role === "user" ? <span>“{t.content}”</span> : t.content}
          </p>
        ))}
        {busy && <p className="text-[13px] text-muted inline-flex items-center gap-2"><span className="dot bg-accent animate-pulse" />Changing the plan… <button className="underline" onClick={() => ctl.current?.abort()}>Stop</button></p>}
        {err && <p className="text-[12.5px] text-amber">{err}</p>}
        <VoiceNote dictation={dict} />
      </div>

      {typing && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(text); }}>
          <input ref={input} className="input !h-9 flex-1 text-[14px]" placeholder="What should change?" value={text} onChange={(e) => setText(e.target.value)} aria-label="What to change" />
          <button className="btn btn-primary !h-9 !px-3" disabled={busy || !text.trim()} aria-label="Send">➤</button>
        </form>
      )}

      <div className="space-y-1.5 pt-1 border-t border-line" role="group" aria-label="Quick changes inside the house">
        <div className="flex items-center gap-2 pt-1.5">
          <p className="text-[12.5px] text-muted">Inside the house, for</p>
          <select className="input !h-7 !w-auto !py-0 text-[13px]" value={where} onChange={(e) => setWhere(e.target.value)} aria-label="Which room">
            <option value="">The whole house</option>
            {[...new Set(rooms)].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FURNISH.map((a) => <button key={a.label} className="chip !h-7" disabled={busy} onClick={() => void ask(a.ask(where ? `the ${where}` : "the whole house").replace("the the ", "the "))}>{a.label}</button>)}
        </div>
      </div>
    </section>
  );
}
