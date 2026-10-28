import Link from "next/link";
import { AllJobsMap } from "@/components/AllJobsMap";
import { JobCards } from "@/components/JobCards";
import { AppShell } from "@/components/ui/AppShell";
import { AssistantDock } from "@/components/assistant/AssistantDock";
import { getRepo, isDemo, requireCompany } from "@/lib/data";

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
          <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em]">{jobs.length ? `${active} active job${active === 1 ? "" : "s"}` : "No jobs yet"}</h1>
          {jobs.length > 0 && <p className="text-muted text-sm">{openPins} open task{openPins === 1 ? "" : "s"} and issues across every building</p>}
        </div>
        <Link href="/jobs/new" className="btn btn-primary ml-auto">New job</Link>
      </div>
      {jobs.length ? (
        <>
          <div className="px-4 sm:px-6"><AllJobsMap jobs={jobs} /></div>
          <div className="px-4 sm:px-6 py-6"><JobCards jobs={jobs} /></div>
        </>
      ) : (
        <div className="px-4 sm:px-6"><div className="card p-10 text-center">
          <p className="font-display text-lg mb-2">Add your first job</p>
          <p className="text-muted mb-5">Create a job, upload the AutoCAD file, a PDF or photos, and the plan is built for you.</p>
          <Link href="/jobs/new" className="btn btn-primary">New job</Link>
        </div></div>
      )}
      <AssistantDock />
    </AppShell>
  );
}
