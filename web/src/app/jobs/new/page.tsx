import { AppShell } from "@/components/ui/AppShell";
import { getRepo, isDemo, requireCompany } from "@/lib/data";
import { NewJobForm } from "./NewJobForm";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const s = await requireCompany();
  const templates = await getRepo().listTemplates(s.company.id);
  const ai = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return (
    <AppShell session={s} demo={isDemo()} active="jobs">
      <div className="px-4 sm:px-6 py-8 max-w-2xl w-full mx-auto">
        <p className="eyebrow">New job</p>
        <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em] mb-6">Add a job</h1>
        <NewJobForm templates={templates.map((t) => ({ id: t.id, name: t.name, job_type: t.job_type, count: t.stages.length }))} ai={ai} />
      </div>
    </AppShell>
  );
}
