"use client";
// New project, guided: drop in whatever you have (AutoCAD, a PDF of the plans, photos), say what the job
// is, and the Rorker assistant asks only what it needs, then builds the plan and sets up the client and
// job for you to check. Nothing is required, and every question can be skipped.
import { useMemo, useRef, useState } from "react";
import { prepareFiles, type Prepared } from "@/lib/intake/files";
import { IntakeChat, type IntakeProject, type IntakeQuestion, type IntakeStep } from "@/lib/intake/client";
import { planFromSketch } from "@/lib/plan/sketch";
import type { Plan } from "@/lib/plan/types";
import { JOB_TYPES } from "@/lib/data/templates";
import { PlanViewer, type Level } from "@/components/plan/PlanViewer";
import type { ColorMode } from "@/components/plan/FloorCanvas";
import { MicButton, useDictation } from "@/components/voice/speech";

export interface NewProjectResult {
  job: { name: string; address: string | null; job_type: string; start_date: string | null; client_name: string | null; client_email: string | null; client_phone: string | null };
  plan: Plan | null;
  summary: string;
}

const READING = ["Reading your files…", "Finding the rooms…", "Measuring walls…", "Placing doors and windows…", "Working out the kitchen and baths…", "Almost there…"];
const nothing = () => {};

export function NewProject({ onCreate, onCancel, intakeUrl }: { onCreate: (r: NewProjectResult) => void; onCancel: () => void; intakeUrl?: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<"start" | "working" | "questions" | "message" | "review">("start");
  const [err, setErr] = useState<string | null>(null);
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [step, setStep] = useState<IntakeStep | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reply, setReply] = useState("");
  const [tick, setTick] = useState(0);
  const chat = useRef<IntakeChat | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const drop = useRef<HTMLInputElement>(null);
  const dict = useDictation((said) => setText((t) => (t ? `${t} ${said}` : said)));

  const run = async (go: (c: IntakeChat, s: AbortSignal) => Promise<IntakeStep>) => {
    setErr(null);
    setStage("working");
    setTick(0);
    const timer = setInterval(() => setTick((n) => n + 1), 6000);
    ctl.current = new AbortController();
    try {
      const s = await go(chat.current!, ctl.current.signal);
      setStep(s);
      setAnswers({});
      setReply("");
      setStage(s.kind === "questions" ? "questions" : s.kind === "message" ? "message" : "review");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setErr(e instanceof Error ? e.message : "Something went wrong.");
      setStage(step ? (step.kind === "project" ? "review" : step.kind === "questions" ? "questions" : "message") : "start");
    } finally {
      clearInterval(timer);
    }
  };

  const start = async () => {
    if (!files.length && !text.trim()) { setErr("Add a drawing or a few words about the job first."); return; }
    setErr(null);
    setStage("working");
    const p = await prepareFiles(files);
    setPrep(p);
    if (!p.parts.length && !text.trim()) { setErr(p.notes.join(" ") || "I couldn't read those files."); setStage("start"); return; }
    chat.current = new IntakeChat(text, p.parts, intakeUrl);
    await run((c, s) => c.next(undefined, s));
  };

  // copy the list now: the input is cleared right after, which empties it
  const addFiles = (list: FileList | null) => { const got = list ? Array.from(list) : []; if (got.length) setFiles((f) => [...f, ...got].slice(0, 8)); };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className={`px-4 sm:px-6 py-8 w-full mx-auto space-y-5 ${stage === "review" ? "max-w-6xl" : "max-w-3xl"}`}>
        <div>
          <p className="eyebrow">New project</p>
          <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em] mb-1">Set up a job</h1>
          <p className="text-muted">Drop in what you have and tell me about the job. I&apos;ll ask if I need anything, then build the plan and set up the client.</p>
        </div>

        {stage === "start" && (
          <section className="card p-5 space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("!border-accent"); }}
              onDragLeave={(e) => e.currentTarget.classList.remove("!border-accent")}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("!border-accent"); addFiles(e.dataTransfer.files); }}
              onClick={() => drop.current?.click()}
              className="border-2 border-dashed border-line rounded-[6px] p-6 text-center cursor-pointer hover:border-chalk">
              <p className="font-display font-bold uppercase tracking-[0.08em] text-[15px]">Drop drawings or photos here</p>
              <p className="text-[13px] text-muted mt-1">AutoCAD (DXF), PDF plans, photos or a sketch. Optional.</p>
              <input ref={drop} type="file" multiple hidden accept=".dxf,.dwg,.pdf,image/*" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} aria-label="Add files" />
            </div>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-[13.5px] px-3 py-1.5 border border-line rounded-[3px]">
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-muted text-[12px]">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="text-muted hover:text-text">✕</button>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label htmlFor="about" className="label !mb-0">Tell me about the job</label>
                <span className="ml-auto"><MicButton dictation={dict} label="Say it" /></span>
              </div>
              <textarea id="about" className="input !h-auto min-h-[110px] py-2" value={text} onChange={(e) => setText(e.target.value)}
                placeholder={"e.g. Kitchen and two bathrooms for Sam and Priya Okafor at 14 Hadley Road, starting next month."} />
              {dict.listening && <p className="text-[12.5px] text-accent mt-1">Listening… {dict.interim}</p>}
            </div>
            {err && <p className="text-[13px] text-red">{err}</p>}
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={start}>Start</button>
              <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            </div>
          </section>
        )}

        {stage === "working" && (
          <section className="card p-6 space-y-4 text-center" aria-live="polite">
            <span className="dot bg-accent animate-pulse inline-block" />
            <p className="font-display font-bold uppercase tracking-[0.08em]">{chat.current ? READING[Math.min(tick, READING.length - 1)] : "Getting your files ready…"}</p>
            <p className="text-[13px] text-muted">A big drawing can take a minute or two.</p>
            {prep && prep.previews.length > 0 && <div className="flex gap-2 justify-center flex-wrap">{prep.previews.slice(0, 3).map((p) => <img key={p.name} src={p.url} alt={p.name} className="h-28 w-auto rounded-[3px] border border-line bg-white" />)}</div>}
            <button className="text-[13px] underline text-muted" onClick={() => ctl.current?.abort()}>Stop</button>
          </section>
        )}

        {prep && prep.notes.length > 0 && stage !== "start" && <div className="card p-3 text-[13px] text-amber space-y-1">{prep.notes.map((n) => <p key={n}>{n}</p>)}</div>}

        {stage === "questions" && step?.kind === "questions" && (
          <Questions step={step} answers={answers} setAnswers={setAnswers} err={err}
            onSend={() => run((c, s) => c.next({ answers }, s))} onSkip={() => run((c, s) => c.next({ answers: {} }, s))} />
        )}

        {stage === "message" && step?.kind === "message" && (
          <section className="card p-5 space-y-3">
            <p className="text-[15px] whitespace-pre-wrap">{step.text}</p>
            <textarea className="input !h-auto min-h-[70px] py-2" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Your answer (optional)" aria-label="Your answer" />
            {err && <p className="text-[13px] text-red">{err}</p>}
            <button className="btn btn-primary w-full" onClick={() => run((c, s) => c.next({ text: reply }, s))}>Continue</button>
          </section>
        )}

        {stage === "review" && step?.kind === "project" && <Review project={step.project} source={prep?.source} onCreate={onCreate} onRestart={() => { setStage("start"); setStep(null); setErr(null); }} />}
      </div>
    </div>
  );
}

function Questions({ step, answers, setAnswers, onSend, onSkip, err }: { step: Extract<IntakeStep, { kind: "questions" }>; answers: Record<string, string>; setAnswers: (f: (a: Record<string, string>) => Record<string, string>) => void; onSend: () => void; onSkip: () => void; err: string | null }) {
  const set = (q: IntakeQuestion, v: string) => setAnswers((a) => ({ ...a, [q.id]: v }));
  return (
    <section className="card p-5 space-y-4">
      <p className="text-[15px]">{step.message || "A couple of quick questions. Skip any you like."}</p>
      {step.questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <p className="text-[14.5px] font-medium">{q.text}</p>
          {!!q.options?.length && <div className="flex flex-wrap gap-1.5">{q.options.map((o) => <button key={o} type="button" onClick={() => set(q, o)} className={`chip !h-8 ${answers[q.id] === o ? "!text-accent !border-accent" : ""}`}>{o}</button>)}</div>}
          <input className="input !h-9" value={answers[q.id] ?? ""} onChange={(e) => set(q, e.target.value)} placeholder="Type an answer, or leave it" aria-label={q.text} />
        </div>
      ))}
      {err && <p className="text-[13px] text-red">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" onClick={onSend}>Continue</button>
        <button className="btn btn-ghost" onClick={onSkip}>Skip these</button>
      </div>
    </section>
  );
}

function Review({ project, source, onCreate, onRestart }: { project: IntakeProject; source?: { kind: string; filename: string }; onCreate: (r: NewProjectResult) => void; onRestart: () => void }) {
  const built = useMemo(() => {
    if (!project.sketch?.floors?.length) return null;
    try { return planFromSketch(project.sketch, source?.filename ? source : { kind: "notes", filename: "notes" }); } catch { return null; }
  }, [project, source]);
  const [job, setJob] = useState({
    name: project.job?.name ?? "New job", address: project.job?.address ?? "", job_type: project.job?.job_type ?? "renovation", start_date: project.job?.start_date ?? "",
    client_name: project.client?.name ?? "", client_email: project.client?.email ?? "", client_phone: project.client?.phone ?? "",
  });
  const [level, setLevel] = useState<Level>(() => (built?.plan.floors[0] ? { kind: "floor", floorId: built.plan.floors[0].id } : { kind: "site" }));
  const [colorMode, setColorMode] = useState<ColorMode>("type");
  const [view3d, setView3d] = useState(false);
  const states = useMemo(() => new Map(), []);
  const field = (k: keyof typeof job, label: string, type = "text") => (
    <div><label className="label" htmlFor={`np-${k}`}>{label}</label><input id={`np-${k}`} type={type} className="input" value={job[k]} onChange={(e) => setJob({ ...job, [k]: e.target.value })} /></div>
  );
  const plan = built?.plan ?? null;
  const rooms = plan?.floors.reduce((n, f) => n + f.rooms.length, 0) ?? 0;
  return (
    <>
      <section className="card p-5 space-y-2 border-l-[3px] !border-l-accent">
        <p className="eyebrow">Here&apos;s what I made</p>
        <p className="text-[15px] leading-relaxed">{project.summary}</p>
        {plan && <p className="text-[13px] text-muted">{plan.floors.length} floor{plan.floors.length === 1 ? "" : "s"}, {rooms} rooms. You can fix anything later in the job.</p>}
      </section>
      {plan && (
        <section className="card overflow-hidden">
          <div className="relative h-[560px]">
            <PlanViewer plan={plan} level={level} setLevel={setLevel} selected={null} onSelect={nothing} selectedPin={null} onSelectPin={nothing}
              states={states} pins={[]} colorMode={colorMode} setColorMode={setColorMode} pinMode={false} setPinMode={nothing} onPlacePin={nothing} draft={null}
              flyTo={null} onAllJobs={nothing} jobName={job.name} items={[]} selectedItem={null} onSelectItem={nothing} onMoveItem={nothing}
              onMovePin={nothing} onMoveFixture={nothing} view3d={view3d} setView3d={setView3d} can3d readOnly />
          </div>
        </section>
      )}
      <section className="card p-5 space-y-3">
        <p className="eyebrow">Job</p>
        {field("name", "Job name")}
        {field("address", "Address")}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="np-type">Type of job</label>
            <select id="np-type" className="input" value={job.job_type} onChange={(e) => setJob({ ...job, job_type: e.target.value })}>{JOB_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          </div>
          {field("start_date", "Start date", "date")}
        </div>
        <p className="eyebrow pt-2">Client</p>
        {field("client_name", "Name")}
        <div className="grid sm:grid-cols-2 gap-3">{field("client_phone", "Phone", "tel")}{field("client_email", "Email", "email")}</div>
      </section>
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" onClick={() => onCreate({
          job: { name: job.name.trim() || "New job", address: job.address.trim() || null, job_type: job.job_type, start_date: job.start_date || null, client_name: job.client_name.trim() || null, client_email: job.client_email.trim() || null, client_phone: job.client_phone.trim() || null },
          plan, summary: project.summary,
        })}>Create the project</button>
        <button className="btn btn-ghost" onClick={onRestart}>Start over</button>
      </div>
    </>
  );
}
