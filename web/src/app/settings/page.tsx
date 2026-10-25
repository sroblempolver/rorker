import Link from "next/link";
import { CompanyForm } from "@/components/CompanyForm";
import { AppShell } from "@/components/ui/AppShell";
import { getRepo, isDemo, requireCompany } from "@/lib/data";
import { updateCompany } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await requireCompany();
  const members = await getRepo().listMembers(s.company.id);
  return (
    <AppShell session={s} demo={isDemo()} active="settings">
      <div className="px-4 sm:px-6 py-8 max-w-2xl w-full mx-auto space-y-6">
        <div className="flex items-end gap-3">
          <div>
            <p className="eyebrow">Company</p>
            <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em]">{s.company.name}</h1>
          </div>
          <Link href="/settings/stages" className="btn ml-auto">Stage templates</Link>
        </div>
        <div className="card p-5"><CompanyForm action={updateCompany} company={s.company} submitLabel="Save" /></div>
        <div className="card p-5">
          <p className="eyebrow mb-3">Team</p>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 text-[14px]">
                <span className="w-8 h-8 rounded-full bg-panel-3 grid place-items-center text-[12px] font-bold">{(m.full_name ?? "?").slice(0, 1)}</span>
                <span>{m.full_name ?? "Team member"}{m.user_id === s.userId && <span className="text-muted"> (you)</span>}</span>
                <span className="chip ml-auto capitalize">{m.role}</span>
              </div>
            ))}
          </div>
          <p className="text-[12.5px] text-muted mt-4">Inviting crew and subcontractors comes in the next phase.</p>
        </div>
      </div>
    </AppShell>
  );
}
