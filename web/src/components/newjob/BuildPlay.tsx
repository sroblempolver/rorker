"use client";
// "Build it" in the live 3D: plays the house going up in the order it's built (lib/plan/buildPlay.ts),
// about ten seconds end to end, with the step's name and a scrubber to drag through the steps. A preview
// of the work order: pause it, drag it back, close it. When the job has crew days per stage, pass them
// in `days` and the scrubber shows the day each step starts.
import { useEffect, useMemo, useRef, useState } from "react";
import { buildSteps, dayOf, planAtStep, stepAt, type BuildStep, type StageId } from "@/lib/plan/buildPlay";
import type { Plan } from "@/lib/plan/types";
import type { BuildSpec } from "@/lib/plan/buildSpec";

/** End to end, ms */
const LENGTH = 10000;

export interface Playing { plan: Plan; step: BuildStep }

/** Playing the build: where it is (0 to 1), the steps, and the plan as built at the step on show. */
export function useBuildPlay(plan: Plan | null, days?: Partial<Record<StageId, number>>, spec?: BuildSpec) {
  const [t, setT] = useState<number | null>(null);
  const [run, setRun] = useState(false);
  const steps = useMemo(() => (plan ? buildSteps(plan, days, spec) : []), [plan, days, spec]);
  const i = t == null ? -1 : stepAt(steps, t);
  const shown = useMemo<Playing | null>(() => (plan && i >= 0 && steps[i] ? { plan: planAtStep(plan, steps[i]), step: steps[i] } : null), [plan, steps, i]);
  const now = useRef(0);
  now.current = t ?? 0;
  useEffect(() => {
    if (!run) return;
    let id = 0, last = performance.now();
    const tick = (at: number) => {
      // a slow frame (the model being built again) never jumps past a step
      const n = Math.min(1, now.current + Math.min(at - last, 120) / LENGTH);
      last = at;
      now.current = n;
      setT(n);
      if (n >= 1) setRun(false); else id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [run]);
  return {
    on: t != null, run, t: t ?? 0, steps, i, shown,
    start: () => { const v = t == null || t >= 1 ? 0 : t; now.current = v; setT(v); setRun(true); },
    pause: () => setRun(false),
    seek: (v: number) => { setRun(false); setT(Math.max(0, Math.min(1, v))); },
    stop: () => { setRun(false); setT(null); },
  };
}
export type BuildPlayState = ReturnType<typeof useBuildPlay>;

const glass = "bg-[#17181b]/90 backdrop-blur-sm border border-line";

/** The bar along the bottom of the 3D while it plays: the step, play or pause, the scrubber. */
export function BuildPlayBar({ p }: { p: BuildPlayState }) {
  if (!p.on || !p.shown) return null;
  const day = dayOf(p.steps, p.i);
  const end = p.t >= 1;
  return (
    <div className={`absolute left-2 right-2 bottom-2 rounded-[4px] px-3 py-2 ${glass}`} role="group" aria-label="Build it">
      <div className="flex items-center gap-2">
        <button onClick={p.run ? p.pause : p.start} className="h-8 w-8 shrink-0 rounded-[4px] border border-line hover:bg-panel-3" aria-label={p.run ? "Pause" : end ? "Play again" : "Play"} title={p.run ? "Pause" : end ? "Play again" : "Play"}>
          {p.run ? "❚❚" : end ? "↺" : "▶"}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-display font-bold tracking-[0.06em] uppercase truncate" aria-live="polite">{end ? "Built" : p.shown.step.label}</p>
          <p className="text-[12px] text-muted">{day != null ? `Day ${day} · ` : ""}Step {p.i + 1} of {p.steps.length}</p>
        </div>
        <button onClick={p.stop} className="h-8 px-2 shrink-0 rounded-[4px] text-[12px] font-display font-bold tracking-[0.08em] uppercase hover:bg-panel-3" title="Back to the drawing">Close</button>
      </div>
      <input type="range" min={0} max={1} step={0.001} value={p.t} onChange={(e) => p.seek(+e.target.value)} className="w-full mt-1.5 accent-[#ff6a1f]" aria-label="Drag through the steps"
        aria-valuetext={`${p.shown.step.label}, step ${p.i + 1} of ${p.steps.length}`} />
      <div className="flex gap-0.5" aria-hidden>
        {p.steps.map((s, k) => <button key={k} tabIndex={-1} title={s.label} onClick={() => p.seek((k + 0.5) / p.steps.length)}
          className={`h-1.5 flex-1 rounded-full ${k < p.i || end ? "bg-accent/60" : k === p.i ? "bg-accent" : "bg-line"}`} />)}
      </div>
    </div>
  );
}
