"use client";
// Every job as a card under the map: where it stands, what's late and what's next, so the morning check
// is one look instead of opening each job. The one you were in last is marked, to jump straight back.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { JobSummary } from "@/lib/data/types";
import { JOB_TYPES } from "@/lib/data/templates";
import { recall } from "@/lib/remember";

export interface JobCard extends JobSummary {
  /** open things past their date */
  late?: number;
  /** everything still open (tasks, issues, materials still to get), when known */
  open?: number;
  /** the next dated thing on the job */
  next_up?: { title: string; when: string } | null;
}

export function JobCards({ jobs, onEditPlan }: { jobs: JobCard[]; /** open a job's plan in the drawing tool */ onEditPlan?: (id: string) => void }) {
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => setLast(recall<string>("jobs.last")), []);
  // the last one opened first, then the ones with something late
  const sorted = [...jobs].sort((a, b) => Number(b.id === last) - Number(a.id === last) || (b.late ?? 0) - (a.late ?? 0));
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((j, i) => {
        const pct = j.stages_total ? Math.round((100 * j.stages_done) / j.stages_total) : 0;
        const noPlan = !j.footprint?.length && j.run_status !== "running" && j.run_status !== "queued";
        return (
          <Link key={j.id} href={`/jobs/${j.id}`} style={{ animationDelay: `${i * 30}ms` }}
            className={`rise-in [animation-fill-mode:backwards] card !rounded-[3px] border-l-[3px] p-4 hover:border-chalk hover:-translate-y-px transition-[transform,border-color] ${j.late ? "!border-l-red" : "!border-l-accent"}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-stencil font-extrabold uppercase text-[19px] leading-tight truncate">{j.name}</p>
                <p className="text-sm text-muted truncate">{j.address || "No address"}{j.client_name ? ` · ${j.client_name}` : ""}</p>
              </div>
              {j.id === last ? <span className="chip !text-accent !border-accent shrink-0">Last opened</span>
                : <span className="chip shrink-0">{JOB_TYPES.find((t) => t.value === j.job_type)?.label ?? j.job_type}</span>}
            </div>
            {onEditPlan && (
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditPlan(j.id); }}
                className="btn btn-sm mt-3 !h-8" title="Change the walls, doors and windows, stairs, cabinets and everything in the house">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3zM3 12h9M12 3v13M16 12h5" /></svg>
                {noPlan ? "Draw the plan" : "Edit plan"}
              </button>
            )}
            <div className="mt-4 h-1.5 rounded-[1px] bg-panel-3 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div>
            <div className="mt-2 flex items-center gap-3 text-[13px] text-muted">
              <span className="truncate">{j.current_stage ?? (j.stages_total ? (pct === 100 ? "All stages done" : "Not started") : "No stages")}</span>
              <span className="ml-auto shrink-0 font-mono text-[12px]">{j.stages_done}/{j.stages_total}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-line flex items-center gap-3 text-[13px] min-h-[24px]">
              {noPlan ? <span className="text-accent">Add the drawing to get the plan</span>
                : j.next_up ? <span className="min-w-0 truncate"><span className="eyebrow !text-[11px] mr-1.5">Next</span>{j.next_up.title}<span className="text-muted"> · {j.next_up.when}</span></span>
                : <span className="text-muted">Nothing dated coming up</span>}
              <span className="ml-auto shrink-0 flex items-center gap-2 font-mono text-[12px]">
                {!!j.late && <span className="text-red">{j.late} late</span>}
                <span className="text-accent">{j.open ?? j.open_pins} open</span>
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
