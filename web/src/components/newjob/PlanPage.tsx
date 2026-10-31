"use client";
// The Plan page (top bar): a job's plan open in the drawing tool, the same one New project uses, so the
// contractor can change everything (walls, doors and windows, stairs, furniture, cabinets) after the job
// is made. A plan drawn by hand or read from a file keeps the drawing it came from (Plan.sketch); an
// older plan without one is turned back into a drawing first. Saving builds the plan again from it.
import { useMemo, useState } from "react";
import type { Plan } from "@/lib/plan/types";
import { planFromSketch, type Sketch } from "@/lib/plan/sketch";
import { sketchFromPlan } from "@/lib/bench/score";
import { stagesFromSpec, type BuildSpec, type SpecStage } from "@/lib/plan/buildSpec";
import { SketchEditor } from "./SketchEditor";

export interface PlanPageJob { id: string; name: string; address: string | null; plan: Plan | null; build?: BuildSpec }

export function PlanPage({ jobs, jobId, onPick, onSave, onBuild, onOpenJob, onNew }: {
  jobs: PlanPageJob[]; jobId: string | null; onPick: (id: string) => void;
  /** the new plan for the job, built from the drawing */
  /** false: not saved (out of credits, or past the account's plan limits; it says why itself) */
  onSave: (id: string, plan: Plan) => void | Promise<boolean | void>;
  /** how it's built (the build questions), and the job's new stages when the contractor says to replace them */
  onBuild?: (id: string, spec: BuildSpec, stages?: SpecStage[]) => void;
  onOpenJob: (id: string) => void; onNew: () => void;
}) {
  const job = jobs.find((j) => j.id === jobId) ?? jobs.find((j) => j.plan) ?? jobs[0] ?? null;
  // a fresh editor for each job, and again after a save or "Start over"
  const [round, setRound] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // the answers as they're given; the stages are only replaced on Save, after a confirm
  const [spec, setSpec] = useState<{ id: string; s: BuildSpec; changed: boolean } | null>(null);
  const initial = useMemo<Sketch | null>(() => {
    const p = job?.plan;
    if (!p) return null;
    if (p.sketch?.floors?.length) return p.sketch;
    try { return sketchFromPlan(p); } catch { return null; }
  }, [job?.id, job?.plan]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!job) return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl w-full mx-auto">
      <p className="eyebrow">Plan</p>
      <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em] mb-3">No jobs yet</h1>
      <p className="text-muted mb-4">Start a job from a drawing, a PDF, an AutoCAD file or a photo, or draw it yourself. Its plan opens here to change any time.</p>
      <button className="btn btn-primary" onClick={onNew}>New project</button>
    </div>
  );

  const build = spec?.id === job.id ? spec.s : job.build ?? {};
  const answer = (s: BuildSpec) => { setSpec({ id: job.id, s, changed: true }); onBuild?.(job.id, s); };

  const save = async (sk: Sketch) => {
    if (spec?.id === job.id && spec.changed) {
      const stages = stagesFromSpec(spec.s);
      if (stages.length && confirm("Make this job's stages from how it's built? This replaces its current stages.")) onBuild?.(job.id, spec.s, stages);
      setSpec({ ...spec, changed: false });
    }
    try {
      const { plan } = planFromSketch(sk, job.plan?.source ?? { kind: "sketch", filename: "Drawn by hand" });
      if ((await onSave(job.id, plan)) === false) { setErr("Not saved yet. See the note about your credits or plan, then save again."); return; }
      setErr(null);
      setSaved(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      setRound((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That drawing couldn't be made into a plan.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 sm:px-6 py-6 w-full max-w-[1500px] mx-auto space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-0">
            <p className="eyebrow">Plan</p>
            <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em] truncate">{job.name}</h1>
            <p className="text-muted text-sm">
              {job.plan ? "Change anything: walls, doors and windows, stairs, furniture and cabinets. Save to update the job." : "This job has no plan yet. Draw it here, or start a New project from its drawings."}
              {saved && <span className="text-green"> Saved at {saved}.</span>}
            </p>
            {err && <p className="text-[13px] text-red">{err}</p>}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Job
            <select className="input !h-9 !w-auto max-w-[260px]" value={job.id} onChange={(e) => { setSaved(null); setErr(null); onPick(e.target.value); }} aria-label="Which job's plan">
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}{j.plan ? "" : " (no plan yet)"}</option>)}
            </select>
          </label>
          <button className="btn btn-sm" onClick={() => onOpenJob(job.id)}>Back to the job</button>
        </div>
        <SketchEditor key={`${job.id}-${round}`} initial={initial} pictures={[]} doneLabel="Save plan"
          build={onBuild ? build : undefined} onBuild={onBuild ? answer : undefined}
          onDone={(sk) => save(sk)} onCancel={() => { setSaved(null); setRound((n) => n + 1); }} />
      </div>
    </div>
  );
}
