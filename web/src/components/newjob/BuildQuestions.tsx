"use client";
// "How's it built?": once the plan is done, the assistant asks a few questions about the house, one at a
// time, from the outside of the wall in (siding, house wrap, sheathing, studs, insulation, vapor
// barrier, drywall), then the foundation and roof. Tap an answer, type it or hold the mic and say it.
// Only what's needed is asked (block walls skip the stud questions). Every question can be skipped,
// and any answer tapped again to change it. The answers become the job's stages (lib/plan/buildSpec.ts).
import { useEffect, useRef, useState } from "react";
import { answerLabel, cheer, matchAnswer, nextQuestion, question, questionsFor, tidy, type BuildSpec, type QuestionId } from "@/lib/plan/buildSpec";
import { surfaceSwatch } from "@/components/plan/exterior3d";
import type { Surface } from "@/lib/plan/buildSpec";
import { MicButton, VoiceNote, canSpeak, speak, stopSpeaking, useDictation } from "@/components/voice/speech";

/** "Skipped" is kept as an answer so the question isn't asked again; it adds nothing to the stages. */
const SKIP = "none";

export function BuildQuestions({ spec, onSpec, onDone, intro }: {
  spec: BuildSpec; onSpec: (s: BuildSpec) => void;
  /** the opening line, before anything is answered */
  intro?: string;
  /** every question answered or skipped */
  onDone?: () => void;
}) {
  const [text, setText] = useState("");
  // read the questions out loud: on by itself once the contractor answers by voice
  const [aloud, setAloud] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const q = nextQuestion(spec);
  const all = questionsFor(spec);
  const asked = all.filter((x) => x.id in spec);

  const answer = (id: QuestionId, v: string, byVoice = false) => {
    const next = tidy({ ...spec, [id]: v });
    onSpec(next);
    setText("");
    const line = v === SKIP && !question(id).options.some((o) => o.id === SKIP) ? "No problem, skipping that one." : cheer(id, v);
    setSaid(line);
    const after = nextQuestion(next);
    if (byVoice || aloud) { setAloud(true); speak(after ? `${line} ${after.ask}` : `${line} That's everything. Here are your stages.`); }
    if (!after) onDone?.();
  };
  const dict = useDictation((words) => { if (q) answer(q.id, matchAnswer(q, words), true); });
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [spec]);
  useEffect(() => () => stopSpeaking(), []);

  return (
    <section className="card p-4 space-y-3 border-l-[3px] !border-l-accent" aria-label="How the house is built">
      <div className="flex items-center gap-2">
        <p className="eyebrow !mb-0">How&apos;s it built?</p>
        <span className="text-[12px] text-muted">{q ? `Question ${asked.length + 1} of ${all.length}` : `${asked.length} answers`}</span>
        {canSpeak() && (
          <button onClick={() => { if (aloud) stopSpeaking(); else if (q) speak(q.ask); setAloud(!aloud); }} aria-pressed={aloud} title={aloud ? "Stop reading the questions out loud" : "Read the questions out loud"}
            className={`ml-auto h-7 px-2 rounded-[3px] border text-[12px] ${aloud ? "border-accent text-accent" : "border-line text-muted hover:text-text"}`}>{aloud ? "🔊 On" : "🔈 Read aloud"}</button>
        )}
      </div>
      <div className="flex gap-1" aria-hidden>
        {all.map((x) => <span key={x.id} className={`h-1.5 flex-1 rounded-full ${x.id in spec ? "bg-accent/70" : x === q ? "bg-accent" : "bg-line"}`} />)}
      </div>
      <div ref={list} className="max-h-[260px] overflow-y-auto scroll-thin space-y-1.5">
        {asked.length === 0 && <p className="text-[14px] leading-snug">{intro ?? "A few quick ones about how the house goes together, from the outside of the wall in. That's how I lay out your stages and color the walls in 3D."}</p>}
        {asked.map((x) => (
          <div key={x.id} className="flex items-baseline gap-2 text-[13px]">
            <span className="text-muted flex-1 min-w-0 truncate">{x.ask}</span>
            <button onClick={() => { const { [x.id]: _, ...rest } = spec; void _; onSpec(rest); setSaid(null); }} title="Change this answer"
              className="shrink-0 px-2 py-0.5 rounded-[3px] border border-line hover:border-accent text-text">{spec[x.id] === SKIP && !x.options.some((o) => o.id === SKIP) ? "Skipped" : answerLabel(x.id, spec[x.id])} ✎</button>
          </div>
        ))}
      </div>
      {q ? (
        <div className="space-y-2" key={q.id}>
          {said && <p className="text-[13px] text-accent">{said}</p>}
          <p className="text-[16px] font-medium leading-snug">{q.ask}</p>
          <p className="text-[12.5px] text-muted">{q.why}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {q.options.map((o) => (
              <button key={o.id} onClick={() => answer(q.id, o.id)} className="text-left px-2.5 py-2 rounded-[4px] border border-line hover:border-accent hover:bg-panel-2 flex items-start gap-2">
                {o.surface && <Swatch s={o.surface} />}
                <span className="min-w-0"><span className="block text-[14px] leading-tight">{o.label}</span>{o.hint && <span className="block text-[11.5px] text-muted leading-tight mt-0.5">{o.hint}</span>}</span>
              </button>
            ))}
          </div>
          <form className="flex gap-2 items-center" onSubmit={(e) => { e.preventDefault(); if (text.trim()) answer(q.id, matchAnswer(q, text)); }}>
            <input className="input !h-9 flex-1 text-[14px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type it, e.g. “Hardie board”" aria-label={q.ask} />
            <MicButton dictation={dict} label="Say it" />
            <button className="btn btn-sm" disabled={!text.trim()}>Answer</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => answer(q.id, SKIP)} title="Don't know yet? Skip it">Skip</button>
          </form>
          <VoiceNote dictation={dict} />
        </div>
      ) : (
        <p className="text-[14px]">{said ? `${said} ` : ""}That&apos;s everything. Your stages are made from these answers; tap one to see the house at that stage.</p>
      )}
    </section>
  );
}

/** Stepping through the stages on a timer ("Build it"), about a second and a half each. */
export function useStagePlay(n: number) {
  const [i, setI] = useState(-1);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => { if (i + 1 >= n) setPlaying(false); else setI(i + 1); }, i < 0 ? 0 : 1500);
    return () => clearTimeout(t);
  }, [playing, i, n]);
  return { i, playing, pick: (k: number) => { setPlaying(false); setI(k === i ? -1 : k); }, play: () => { setI(i + 1 >= n ? -1 : i); setPlaying(true); }, stop: () => setPlaying(false) };
}
export type StagePlay = ReturnType<typeof useStagePlay>;

/** The stages worked out from the answers, in order: tap one to see the house as it stands then. */
export function SpecStageList({ names, hints, play }: { names: string[]; hints?: string[]; play: StagePlay }) {
  return (
    <section className="card p-4 space-y-2" aria-label="Stages">
      <div className="flex items-center gap-2">
        <p className="eyebrow !mb-0">Your stages</p>
        <span className="text-[12px] text-muted">{names.length} stages</span>
        <button onClick={play.playing ? play.stop : play.play} className="ml-auto h-8 px-2.5 rounded-[4px] border border-line text-[12px] font-display font-bold tracking-[0.08em] uppercase hover:border-accent"
          title="Watch the house go up stage by stage in 3D">{play.playing ? "❚❚ Pause" : "▶ Build it"}</button>
      </div>
      <ol className="space-y-1">
        {names.map((n, k) => (
          <li key={k}>
            <button onClick={() => play.pick(k)} aria-pressed={play.i === k}
              className={`w-full text-left px-2.5 py-1.5 rounded-[3px] border flex items-start gap-2.5 ${play.i === k ? "border-accent bg-panel-3" : k < play.i ? "border-line opacity-70" : "border-line hover:bg-panel-2"}`}>
              <span className={`w-6 h-6 shrink-0 rounded-[2px] border-2 grid place-items-center text-[11px] font-mono font-bold ${play.i >= k && play.i >= 0 ? "border-accent text-accent" : "border-muted text-muted"}`}>{k < play.i ? "✓" : k + 1}</span>
              <span className="min-w-0"><span className="block text-[14px] leading-tight">{n}</span>{hints?.[k] && <span className="block text-[12px] text-muted leading-tight mt-0.5">{hints[k]}</span>}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The look of an answer: its pattern in its colour (drawn in the browser, once). */
function Swatch({ s }: { s: Surface }) {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(surfaceSwatch(s)), [s]);
  return <span className="w-9 h-9 rounded-[3px] shrink-0 border border-black/30" style={{ background: url ? `url(${url}) center/cover` : s.color, opacity: s.opacity ?? 1 }} aria-hidden />;
}
