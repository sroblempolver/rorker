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
        <h1 className="font-display text-[26px] font-bold">Stage templates</h1>
        <p className="text-muted mb-6">Each new job copies the stages from the template you pick. Changing a template does not change jobs that already exist.</p>
        <TemplateEditor templates={templates} />
      </div>
    </AppShell>
  );
}
