"use client";
// Plan tests: the plans the reader has to get right. Add a plan, draw the right answer over it once
// (or fix the reader's attempt into the answer), then run the reader on every plan and see how close it
// gets, plan by plan, and whether the last change made it better or worse.
import { useEffect, useMemo, useRef, useState } from "react";
import { prepareFiles } from "@/lib/intake/files";
import { INTAKE_URL, IntakeChat } from "@/lib/intake/client";
import { scoreSketch, type Score } from "@/lib/bench/score";
import { deleteCase, downloadCases, listCases, readCaseFile, saveCase, sharedCases, type BenchCase, type BenchRun } from "@/lib/bench/store";
import { SketchEditor, picturesFrom } from "@/components/newjob/SketchEditor";
import { useFeedback } from "@/components/ui/feedback";
import type { Sketch } from "@/lib/plan/sketch";

const READERS = [
  { id: "live", label: "Live reader (what contractors get)", url: INTAKE_URL },
  // a test copy of the reader with changes not yet live; listed once it is deployed
  // { id: "next", label: "Next reader (changes being tested)", url: INTAKE_URL.replace(/new-project$/, "new-project-next") },
];
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

/** One reading of a plan, as a contractor's upload would get it: questions are skipped, so it guesses. */
async function readOnce(c: BenchCase, url: string, signal: AbortSignal): Promise<{ sketch: Sketch | null; summary: string }> {
  const chat = new IntakeChat(c.description ?? "", c.parts, url, "paid", false);
  let step = await chat.next(undefined, signal);
  for (let i = 0; i < 3 && step.kind !== "project"; i++) step = await chat.next(step.kind === "questions" ? { answers: {} } : { text: "Go ahead and make it with what you have." }, signal);
  if (step.kind !== "project") throw new Error("The reader didn't make a plan.");
  return { sketch: step.project.sketch ?? null, summary: step.project.summary };
}

const scoreColor = (n: number | null | undefined) => (n == null ? "text-muted" : n >= 85 ? "text-green" : n >= 60 ? "text-amber" : "text-red");

export function PlanBench() {
  const [cases, setCases] = useState<BenchCase[]>([]);
  const [reader, setReader] = useState(READERS[0].id);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const files = useRef<HTMLInputElement>(null);
  const imports = useRef<HTMLInputElement>(null);
  const { confirm } = useFeedback();

  // the browser's own test plans, plus the shared ones it doesn't have its own copy of
  useEffect(() => {
    void (async () => {
      const [mine, shared] = await Promise.all([listCases(), sharedCases()]);
      const have = new Set(mine.map((c) => c.id));
      setCases([...mine, ...shared.filter((c) => !have.has(c.id))].sort((a, b) => a.created.localeCompare(b.created)));
    })();
  }, []);
  const put = async (c: BenchCase) => {
    const mine = { ...c, shared: false };
    setCases((list) => (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? mine : x)) : [...list, mine]));
    await saveCase(mine).catch(() => setErr("Couldn't save in this browser (private window?)."));
  };

  const run = async (c: BenchCase) => {
    const r = READERS.find((x) => x.id === reader)!;
    setBusy((b) => ({ ...b, [c.id]: true }));
    ctl.current = ctl.current ?? new AbortController();
    const t0 = performance.now();
    let entry: BenchRun;
    try {
      const got = await readOnce(c, r.url, ctl.current.signal);
      const s: Score | null = c.answer ? scoreSketch(got.sketch, c.answer) : null;
      entry = { at: new Date().toISOString(), reader: r.id, seconds: Math.round((performance.now() - t0) / 1000), sketch: got.sketch, summary: got.summary, score: s?.total ?? null, misses: s?.misses };
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") { setBusy((b) => ({ ...b, [c.id]: false })); return; }
      entry = { at: new Date().toISOString(), reader: r.id, seconds: Math.round((performance.now() - t0) / 1000), sketch: null, summary: "", score: c.answer ? 0 : null, error: e instanceof Error ? e.message : "Failed" };
    }
    // the latest copy: another run may have finished meanwhile
    setCases((list) => {
      const cur = list.find((x) => x.id === c.id) ?? c;
      const next = { ...cur, shared: false, runs: [...cur.runs, entry].slice(-30) };
      void saveCase(next);
      return list.map((x) => (x.id === c.id ? next : x));
    });
    setBusy((b) => ({ ...b, [c.id]: false }));
  };
  const runAll = async () => {
    const todo = cases.filter((c) => c.answer);
    if (!todo.length) { setErr("Draw the answer for at least one plan first."); return; }
    if (!(await confirm({ title: `Read ${todo.length} plan${todo.length === 1 ? "" : "s"}?`, body: "Each reading uses the plan reader once (roughly the cost of one new project). Two run at a time.", confirm: "Run them" }))) return;
    setErr(null);
    ctl.current = new AbortController();
    const queue = [...todo];
    await Promise.all([0, 1].map(async () => { for (let c = queue.shift(); c; c = queue.shift()) await run(c); }));
    ctl.current = null;
  };
  const stop = () => { ctl.current?.abort(); ctl.current = null; setBusy({}); };

  const addPlans = async (list: FileList | null) => {
    const got = list ? Array.from(list) : [];
    if (!got.length) return;
    setAdding(true);
    setErr(null);
    // each file is its own test plan
    for (const f of got) {
      const p = await prepareFiles([f]);
      if (!p.parts.length) { setErr(p.notes.join(" ") || `${f.name} couldn't be read.`); continue; }
      await put({ id: `${f.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${uid()}`, name: f.name, created: new Date().toISOString(), parts: p.parts, runs: [], answer: null });
    }
    setAdding(false);
  };

  const withAnswer = cases.filter((c) => c.answer);
  // the overall score: the newest run of each plan, against the run before it
  const avg = (pick: (c: BenchCase) => number | null | undefined) => { const xs = withAnswer.map(pick).filter((x): x is number => x != null); return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null; };
  const last = (c: BenchCase) => [...c.runs].reverse().find((r) => r.score != null)?.score;
  const prev = (c: BenchCase) => c.runs.filter((r) => r.score != null).slice(-2, -1)[0]?.score;
  const now = avg(last), before = avg(prev);

  const editingCase = cases.find((c) => c.id === editing) ?? null;
  const pictures = useMemo(() => (editingCase ? picturesFrom(editingCase.parts) : []), [editingCase]);
  if (editingCase) {
    const lastRead = [...editingCase.runs].reverse().find((r) => r.sketch)?.sketch ?? null;
    return (
      <div className="px-4 sm:px-6 py-6 max-w-[1500px] mx-auto space-y-3">
        <p className="eyebrow">The right answer for {editingCase.name}</p>
        <p className="text-muted text-[14px]">Draw what the plan really shows: every room on the wall centre lines, the doors between rooms and to outside, windows, and the main fixtures. {editingCase.answer ? "" : lastRead ? "It starts from the reader's last try, so you only fix what's wrong." : ""}</p>
        <SketchEditor initial={editingCase.answer ?? lastRead} pictures={pictures} initialBackdrops={editingCase.backdrops} doneLabel="Save the answer"
          onCancel={() => setEditing(null)}
          onDone={(sketch, backdrops) => {
            // rescore every earlier reading against the new answer
            const runs = editingCase.runs.map((r) => { if (!r.sketch) return r; const s = scoreSketch(r.sketch, sketch); return { ...r, score: s.total, misses: s.misses }; });
            void put({ ...editingCase, answer: sketch, backdrops, runs });
            setEditing(null);
            setOpen(editingCase.id);
          }} />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl w-full mx-auto space-y-5">
      <div>
        <p className="eyebrow">Plan reader</p>
        <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em] mb-1">Plan tests</h1>
        <p className="text-muted">Real plans with the right answer drawn in. Run the reader on all of them to see how close it gets; every change to the reader is checked the same way, so we know it got better and didn&apos;t break a plan that worked.</p>
      </div>

      <section className="card p-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="eyebrow">Score</p>
          <p className={`font-display text-[40px] font-extrabold leading-none ${scoreColor(now)}`}>{now ?? "–"}<span className="text-[18px] text-muted"> / 100</span></p>
          <p className="text-[13px] text-muted">{withAnswer.length} of {cases.length} plans have an answer{now != null && before != null ? ` · ${now - before >= 0 ? "+" : ""}${now - before} since the run before` : ""}</p>
        </div>
        <select className="input !h-9 !w-auto" value={reader} onChange={(e) => setReader(e.target.value)} aria-label="Which reader">{READERS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        {Object.values(busy).some(Boolean) ? <button className="btn" onClick={stop}>Stop</button> : <button className="btn btn-primary" onClick={() => void runAll()}>Run all</button>}
      </section>

      <section className="card p-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => files.current?.click()} disabled={adding}>{adding ? "Getting them ready…" : "Add plans"}</button>
          <button className="btn btn-ghost" onClick={() => imports.current?.click()}>Load a test file</button>
          <button className="btn btn-ghost" onClick={() => downloadCases(cases, `rorker-plan-tests-${new Date().toISOString().slice(0, 10)}.json`)} disabled={!cases.length}>Save all to a file</button>
        </div>
        <p className="text-[12.5px] text-muted">PDFs, photos of plans, screenshots or DXF, one test per file. Plans live in this browser; save them to a file to send them over or keep a copy.</p>
        <input ref={files} type="file" multiple hidden accept=".dxf,.pdf,image/*" onChange={(e) => { void addPlans(e.target.files); e.target.value = ""; }} />
        <input ref={imports} type="file" multiple hidden accept=".json,application/json" onChange={async (e) => { const fl = Array.from(e.target.files ?? []); e.target.value = ""; for (const f of fl) for (const c of await readCaseFile(f).catch(() => [])) await put(c); }} />
        {err && <p className="text-[13px] text-red">{err}</p>}
      </section>

      <div className="space-y-2">
        {cases.map((c) => {
          const thumb = picturesFrom(c.parts)[0]?.url;
          const l = last(c), p = prev(c);
          const latest = c.runs[c.runs.length - 1];
          const isOpen = open === c.id;
          const detail = latest?.sketch && c.answer ? scoreSketch(latest.sketch, c.answer) : null;
          return (
            <section key={c.id} className="card overflow-hidden">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3">
                {thumb ? <img src={thumb} alt="" className="w-20 h-14 object-contain bg-white rounded-[3px] border border-line shrink-0" /> : <div className="w-20 h-14 bg-panel-2 rounded-[3px]" />}
                <button className="flex-1 min-w-[160px] text-left" onClick={() => setOpen(isOpen ? null : c.id)}>
                  <p className="font-medium truncate">{c.name}{c.shared ? <span className="chip !h-5 ml-2">shared</span> : null}</p>
                  <p className="text-[12.5px] text-muted">{c.answer ? `Answer drawn: ${c.answer.floors.reduce((n, f) => n + f.rooms.length, 0)} rooms` : "Needs the answer drawn"} · {c.runs.length} run{c.runs.length === 1 ? "" : "s"}{latest?.error ? ` · last run failed: ${latest.error}` : ""}</p>
                </button>
                <div className="text-right shrink-0 w-16">
                  <p className={`font-display text-[26px] font-extrabold leading-none ${scoreColor(l)}`}>{busy[c.id] ? "…" : l ?? "–"}</p>
                  {l != null && p != null && <p className={`text-[12px] ${l >= p ? "text-green" : "text-red"}`}>{l - p >= 0 ? "+" : ""}{l - p}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button className="btn btn-sm" onClick={() => setEditing(c.id)}>{c.answer ? "Edit answer" : "Draw answer"}</button>
                  <button className="btn btn-sm btn-primary" onClick={() => void run(c)} disabled={busy[c.id]}>{busy[c.id] ? "Reading…" : "Run"}</button>
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-line p-3 grid md:grid-cols-2 gap-4 text-[13.5px]">
                  <div className="space-y-1">
                    <p className="eyebrow">Last run</p>
                    {!latest && <p className="text-muted">Not run yet.</p>}
                    {latest && <p className="text-muted">{new Date(latest.at).toLocaleString()} · {READERS.find((r) => r.id === latest.reader)?.label.split(" (")[0]} · {latest.seconds}s</p>}
                    {latest?.summary && <p className="leading-snug">{latest.summary}</p>}
                    {detail && <table className="w-full mt-2">
                      <tbody>{detail.lines.map((x) => <tr key={x.key} className="border-t border-line"><td className="py-1">{x.label}</td><td className="text-muted">{x.got}</td><td className="text-right">{x.points}/{x.of}</td></tr>)}</tbody>
                    </table>}
                    {!c.answer && latest?.sketch && <p className="text-amber">No score until the answer is drawn. Draw answer starts from this reading, so you only fix what it got wrong.</p>}
                  </div>
                  <div className="space-y-1">
                    {detail && detail.misses.length > 0 && <><p className="eyebrow">What it got wrong</p><ul className="list-disc pl-4 space-y-0.5 max-h-56 overflow-y-auto scroll-thin">{detail.misses.map((m, i) => <li key={i}>{m}</li>)}</ul></>}
                    <p className="eyebrow pt-2">Scores so far</p>
                    <p className="text-muted">{c.runs.filter((r) => r.score != null).map((r) => r.score).join(" → ") || "none yet"}</p>
                    <div className="flex gap-2 pt-2">
                      <button className="btn btn-sm btn-ghost" onClick={() => downloadCases([c], `${c.id}.json`)}>Save to a file</button>
                      <button className="btn btn-sm btn-ghost text-red" onClick={async () => { if (await confirm({ title: `Remove ${c.name}?`, body: "Its answer and runs go too.", confirm: "Remove", danger: true })) { await deleteCase(c.id); setCases((l) => l.filter((x) => x.id !== c.id)); } }}>Remove</button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })}
        {!cases.length && <p className="text-muted text-center py-8">No test plans yet. Add a few plans to start.</p>}
      </div>
    </div>
  );
}
