import { AppShell } from "@/components/ui/AppShell";
import { getRepo, isDemo, requireCompany } from "@/lib/data";
import { TemplateEditor } from "./TemplateEditor";

export const dynamic = "force-dynamic";

export default async function StagesPage() {
  const s = await requireCompany();
  const templates = await getRepo().listTemplates(s.company.id);
  return (
    <AppShell session={s} demo={isDemo()} active="settings">
      <div className="px-4 sm:px-6 py-8 max-w-3xl w-full mx-auto">
        <p className="eyebrow">Company</p>
        <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em]">Stage templates</h1>
        <p className="text-muted mb-6">Each new job copies the stages from the template you pick. Changing a template does not change jobs that already exist.</p>
        {s.role === "admin" ? <TemplateEditor templates={templates} /> : (
          <div className="space-y-3">
            <p className="chip">Only admins can change templates</p>
            {templates.map((t) => (
              <div key={t.id} className="card p-4">
                <h2 className="font-display text-[20px] font-bold uppercase">{t.name}</h2>
                <ol className="mt-2 text-[14px] text-muted list-decimal pl-5 space-y-0.5">{t.stages.map((st, i) => <li key={i}>{st.name}</li>)}</ol>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
