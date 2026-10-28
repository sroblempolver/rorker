"use client";
// The Rorker assistant: a mic button, not a chat window. Hold it and talk, let go to send; what you said and the answer
// show in a small bubble above it, and the answer is read out. A keyboard button next to it opens a
// line to type instead. It can look up any job you can see and make changes for you (add a pin, tag
// someone, close a task, move a stage along, put an outlet on a wall), in the browser's own free voice.
import { useEffect, useRef, useState } from "react";
import type { AssistantContext } from "@/lib/assistant/core";
import { speak, stopSpeaking, useDictation } from "@/components/voice/speech";

export type Turn = { role: "user" | "assistant"; content: string };
/** Ask the assistant. `changed` says it changed something, so the screen should refresh. */
export type AssistantSend = (turns: Turn[], context: AssistantContext, signal: AbortSignal) => Promise<{ text: string; changed: boolean }>;

const HINT = "Try: \"add a task to fix the kitchen outlet, tag Marco\" or \"mark framing done\".";

const MicIcon = ({ on }: { on?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" fill={on ? "currentColor" : "none"} /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
);
const KeysIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></svg>
);

export function Assistant({ send, context, onChanged, open, setOpen, wide }: { send: AssistantSend; context: AssistantContext; onChanged?: () => void; /** the reply bubble is showing */ open: boolean; setOpen: (o: boolean) => void; /** no side panel on this screen */ wide?: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
    setOpen(true);
    ctl.current = new AbortController();
    try {
      const r = await send(next.slice(-12), ctxRef.current, ctl.current.signal);
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
  const [blockedNote, setBlockedNote] = useState(false);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [turns, busy, dict.interim]);
  useEffect(() => { if (typing) input.current?.focus(); }, [typing]);
  useEffect(() => { if (dict.error) setOpen(true); }, [dict.error, setOpen]);

  const close = () => { setOpen(false); setTyping(false); stopSpeaking(); ctl.current?.abort(); dict.stop(); };
  // the mic stays the main button, held to talk; where the page can't have the microphone it says why and opens typing
  const tapMain = () => { setBlockedNote(dict.supported); setTyping(true); setOpen(true); };
  const press = voice ? dict.hold(() => { setOpen(true); }) : { onClick: tapMain };

  const side = wide ? "" : "lg:right-[470px]";
  const shown = turns.slice(-4);
  const showBubble = open && (shown.length > 0 || busy || dict.listening || !!err || !!dict.error || typing);

  return (
    <div className={`fixed z-40 right-4 bottom-4 ${side} flex flex-col items-end gap-2 pointer-events-none`}>
      {showBubble && (
        <section role="dialog" aria-label="Rorker assistant" className="pointer-events-auto w-[min(340px,calc(100vw-32px))] bg-panel/95 backdrop-blur-sm border border-line border-l-[3px] border-l-accent rounded-[6px] shadow-2xl">
          <div className="flex items-center px-3 pt-2">
            <span className="eyebrow !text-[10.5px]">Rorker assistant</span>
            <button onClick={close} aria-label="Close" className="ml-auto w-6 h-6 grid place-items-center text-muted hover:text-text text-[13px]">✕</button>
          </div>
          <div ref={list} className="max-h-[260px] overflow-y-auto scroll-thin px-3 pb-2.5 pt-1 space-y-1.5" aria-live="polite">
            {!shown.length && !busy && !dict.listening && <p className="text-[12.5px] text-muted leading-relaxed">{HINT}</p>}
            {shown.map((t, i) => (
              <p key={turns.length - shown.length + i} className={`text-[13.5px] leading-snug whitespace-pre-wrap ${t.role === "user" ? "text-muted" : "text-text"}`}>
                {t.role === "user" ? <span>“{t.content}”</span> : t.content}
              </p>
            ))}
            {dict.listening && <p className="text-[13.5px] text-accent">Listening, let go when done… {dict.interim && <span className="text-text">“{dict.interim}”</span>}</p>}
            {busy && <p className="text-[13px] text-muted inline-flex items-center gap-2"><span className="dot bg-accent animate-pulse" />Working on it… <button className="underline" onClick={() => ctl.current?.abort()}>Stop</button></p>}
            {(err || dict.error) && <p className="text-[12.5px] text-amber">{err ?? dict.error}</p>}
            {blockedNote && !dict.error && <p className="text-[12.5px] text-amber">The mic is blocked here because this preview runs inside a frame on the page; the browser won&apos;t give it the microphone, whatever your settings say. Open the preview at build.rorker.com to talk, or type below.</p>}
          </div>
          {typing && (
            <form className="border-t border-line p-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(text); }}>
              <input ref={input} className="input !h-9 flex-1 text-[14px]" placeholder="Type what you need" value={text} onChange={(e) => setText(e.target.value)} aria-label="Message" />
              <button className="btn btn-primary !h-9 !px-3" disabled={busy || !text.trim()} aria-label="Send">➤</button>
            </form>
          )}
        </section>
      )}
      <div className="pointer-events-auto flex items-center gap-2">
        {dict.supported && (
          <button onClick={() => { setTyping(!typing); setOpen(true); }} aria-pressed={typing} aria-label="Type instead" title="Type instead"
            className={`w-10 h-10 rounded-full grid place-items-center border shadow-lg ${typing ? "bg-panel-3 border-accent text-accent" : "bg-panel-2 border-line text-text hover:border-accent"}`}>
            <KeysIcon />
          </button>
        )}
        <button {...press} aria-pressed={dict.listening} aria-label={!dict.supported ? "Open the assistant" : !voice ? "Talk to the assistant (mic blocked here)" : "Hold to talk to the assistant"}
          title={!dict.supported ? "Ask the assistant" : dict.blocked ? "The mic is blocked in this preview window" : dict.listening ? "Listening… let go when you're done" : "Hold and talk, let go to send"}
          className={`w-14 h-14 rounded-full grid place-items-center shadow-xl transition-colors ${dict.listening ? "bg-red text-white animate-pulse" : "bg-accent text-accent-ink hover:brightness-110"}`}>
          {dict.supported ? <MicIcon on={dict.listening} /> : <KeysIcon />}
        </button>
      </div>
    </div>
  );
}
