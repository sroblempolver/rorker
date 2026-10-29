"use client";
// Where the plan comes from: upload a drawing, watch the reader work, answer its few questions.
import { useState } from "react";
import { MicButton, useDictation, VoiceNote } from "@/components/voice/speech";
import type { PlanRow, PlanRun } from "@/lib/data/types";

const RUN_LABEL: Record<PlanRun["status"], string> = { queued: "Waiting", running: "Reading…", needs_answers: "Has questions", done: "Done", failed: "Failed" };
const KIND: Record<string, string> = { dwg: "AutoCAD drawing", dxf: "AutoCAD drawing", pdf: "PDF", image: "Photo or image" };

export function UploadBox({ onUpload, compact }: { onUpload: (f: File) => Promise<void>; compact?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  return (
    <form
      className={`rounded-[4px] border-2 border-dashed ${over ? "border-accent bg-accent/5" : "border-line"} ${compact ? "p-3" : "p-5"} text-center`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        setBusy(true); setErr(null);
        try { await onUpload(file); setFile(null); } catch (x) { setErr(x instanceof Error ? x.message : "Upload failed."); }
        setBusy(false);
      }}
    >
      <p className="text-[14px] mb-1">{file ? file.name : "Drop the AutoCAD file, a PDF or a photo"}</p>
      <p className="text-[12px] text-muted mb-3">DWG, DXF, PDF, JPG or PNG. Photos of a paper plan or a hand sketch work too.</p>
      <div className="flex gap-2 justify-center">
        <label className="btn btn-sm cursor-pointer">Choose file<input type="file" className="hidden" accept=".dwg,.dxf,.pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <button className="btn btn-primary btn-sm" disabled={!file || busy}>{busy ? "Uploading…" : "Read plan"}</button>
      </div>
      {err && <p className="text-red text-sm mt-2">{err}</p>}
    </form>
  );
}

const OTHER = "Something else";

/** One question: tap an option, or type or say the answer in your own words. Your words win. */
function QuestionField({ q, value, text, onPick, onText, onShow }: {
  q: PlanRow["data"]["questions"][number]; value: string; text: string; onPick: (o: string) => void; onText: (t: string) => void; onShow: () => void;
}) {
  const dict = useDictation((said) => onText(text ? `${text} ${said}` : said));
  return (
    <fieldset>
      <legend className="text-[14px] mb-2">{q.text} <button type="button" onClick={onShow} className="text-chalk text-[13px] hover:underline whitespace-nowrap">Show on plan</button></legend>
      <div className="flex flex-wrap gap-1.5">
        {q.options.filter((o) => o !== OTHER).map((o) => (
          <button type="button" key={o} onClick={() => { onPick(o); onText(""); }} aria-pressed={!text && value === o}
            className={`chip !h-8 !text-[13px] ${!text && value === o ? "!bg-accent !text-accent-ink !border-accent" : "hover:text-text"}`}>{o}</button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input className={`input ${text ? "!border-accent" : ""}`} placeholder={q.options.length ? "Or say it in your own words…" : "Your answer…"} value={text} aria-label={`Your own answer: ${q.text}`}
          onChange={(e) => onText(e.target.value)} />
        <MicButton dictation={dict} label="Answer by voice" />
      </div>
      <div className="mt-1"><VoiceNote dictation={dict} /></div>
    </fieldset>
  );
}

type Q = PlanRow["data"]["questions"][number];
export function QuestionsCard({ plan, onAnswer, onShow }: { plan: PlanRow; onAnswer: (answers: Record<string, string>) => Promise<void>; onShow: (ids: string[], q?: Q) => void }) {
  const open = plan.data.questions.filter((q) => !q.answer);
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(open.map((q) => [q.id, q.default ?? q.options[0] ?? ""])));
  const [own, setOwn] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (!open.length) return null;
  // free text (typed or spoken) goes to the plan reader as is; it works out what to change
  const final = () => Object.fromEntries(open.map((q) => [q.id, own[q.id]?.trim() || (answers[q.id] === OTHER ? "" : answers[q.id])]).filter(([, v]) => v));
  return (
    <div className="card !rounded-[4px] overflow-hidden"><div className="hazard h-2" /><div className="p-4 space-y-4">
      <div>
        <p className="eyebrow text-accent">{open.length} quick question{open.length > 1 ? "s" : ""}</p>
        <p className="text-[13px] text-muted">The plan reader wasn&apos;t sure about these. Tap an answer or just tell it, and it fixes the plan.</p>
      </div>
      {open.map((q) => (
        <QuestionField key={q.id} q={q} value={answers[q.id] ?? ""} text={own[q.id] ?? ""} onShow={() => onShow(q.element_ids, q)}
          onPick={(o) => setAnswers((a) => ({ ...a, [q.id]: o }))} onText={(t) => setOwn((x) => ({ ...x, [q.id]: t }))} />
      ))}
      <button className="btn btn-primary w-full" disabled={busy} onClick={async () => { setBusy(true); try { await onAnswer(final()); } finally { setBusy(false); } }}>
        {busy ? "Sending…" : "Send answers"}
      </button>
    </div></div>
  );
}

export function PlanPanel({ plan, runs, aiAvailable, onUpload, onAnswer, onShow, title = "Plan" }: {
  plan: PlanRow | null; runs: PlanRun[]; aiAvailable: boolean; onUpload: (f: File) => Promise<void>; onAnswer: (a: Record<string, string>) => Promise<void>; onShow: (ids: string[], q?: Q) => void;
  title?: string;
}) {
  const s = plan?.data.source;
  const unidentified = plan ? plan.data.floors.reduce((n, f) => n + ((plan.data.stats[f.id] as { unidentified?: number } | undefined)?.unidentified ?? 0), 0) : 0;
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">{title}</h2>
      {plan && <QuestionsCard key={plan.id} plan={plan} onAnswer={onAnswer} onShow={onShow} />}
      {plan && s && (
        <div className="card p-4 space-y-1 text-[14px]">
          <p><span className="text-muted">From</span> {s.filename} <span className="text-muted">({KIND[s.kind] ?? s.kind})</span></p>
          <p><span className="text-muted">Version</span> {plan.version} · {new Date(plan.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
          <p><span className="text-muted">Read with</span> {s.ai_used ? "the full plan reader" : "drawing geometry only"}</p>
          {unidentified ? <p className="text-muted text-[13px]">{unidentified} drawn items are not identified yet. They still show on the plan and can be pinned.</p> : null}
        </div>
      )}
      {!aiAvailable && <p className="text-[12.5px] text-muted">Running without the plan reader key: AutoCAD files are read from their geometry, and PDFs and photos wait until the key is set.</p>}
      <div>
        <p className="eyebrow mb-2">{plan ? "Replace with a new drawing" : "Upload the plan"}</p>
        <UploadBox onUpload={onUpload} compact={!!plan} />
      </div>
      {runs.length > 0 && (
        <div>
          <p className="eyebrow mb-2">History</p>
          <div className="space-y-1.5">
            {runs.slice(0, 8).map((r) => (
              <div key={r.id} className="card px-3 py-2 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className={`dot ${r.status === "running" || r.status === "queued" ? "animate-pulse" : ""}`} style={{ background: r.status === "failed" ? "var(--red)" : r.status === "done" ? "var(--green)" : "var(--accent)" }} />
                  <span className="truncate">{r.kind === "answers" ? "Applying your answers" : r.file_name ?? "Plan"}</span>
                  <span className="ml-auto text-muted shrink-0">{RUN_LABEL[r.status]}</span>
                </div>
                {r.error && <p className="text-red mt-1">{r.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
