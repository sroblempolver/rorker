import Link from "next/link";
import { AllJobsMap } from "@/components/AllJobsMap";
import { AppShell } from "@/components/ui/AppShell";
import { getRepo, isDemo, requireCompany } from "@/lib/data";
import { JOB_TYPES } from "@/lib/data/templates";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const s = await requireCompany();
  const jobs = await getRepo().listJobs(s.company.id);
  const active = jobs.filter((j) => j.status === "active").length;
  const openPins = jobs.reduce((n, j) => n + j.open_pins, 0);
  return (
    <AppShell session={s} demo={isDemo()} active="jobs">
      <div className="px-4 sm:px-6 pt-6 pb-4 flex flex-wrap items-end gap-4">
        <div>
          <p className="eyebrow">All jobs</p>
          <h1 className="font-display text-[26px] font-bold">{jobs.length ? `${active} active job${active === 1 ? "" : "s"}` : "No jobs yet"}</h1>
          {jobs.length > 0 && <p className="text-muted text-sm">{openPins} open task{openPins === 1 ? "" : "s"} and issues across every building</p>}
        </div>
        <Link href="/jobs/new" className="btn btn-primary ml-auto">New job</Link>
      </div>
      {jobs.length ? (
        <>
          <div className="px-4 sm:px-6"><AllJobsMap jobs={jobs} /></div>
          <div className="px-4 sm:px-6 py-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {jobs.map((j) => {
              const pct = j.stages_total ? Math.round((100 * j.stages_done) / j.stages_total) : 0;
              return (
                <Link key={j.id} href={`/jobs/${j.id}`} className="card p-4 hover:border-[#3a4552] transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-semibold text-[16px] truncate">{j.name}</p>
                      <p className="text-sm text-muted truncate">{j.address || "No address"}{j.client_name ? ` · ${j.client_name}` : ""}</p>
                    </div>
                    <span className="chip">{JOB_TYPES.find((t) => t.value === j.job_type)?.label ?? j.job_type}</span>
                  </div>
                  <div className="mt-4 h-1.5 rounded-full bg-panel-3 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div>
                  <div className="mt-2 flex items-center gap-3 text-[13px] text-muted">
                    <span className="truncate">{j.current_stage ?? (j.stages_total ? (pct === 100 ? "All stages done" : "Not started") : "No stages")}</span>
                    <span className="ml-auto shrink-0">{j.open_pins} open</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <div className="px-4 sm:px-6"><div className="card p-10 text-center">
          <p className="font-display text-lg mb-2">Add your first job</p>
          <p className="text-muted mb-5">Create a job, upload the AutoCAD file, a PDF or photos, and the plan is built for you.</p>
          <Link href="/jobs/new" className="btn btn-primary">New job</Link>
        </div></div>
      )}
    </AppShell>
  );
}
