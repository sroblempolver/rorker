import Link from "next/link";
import { CompanyForm } from "@/components/CompanyForm";
import { AvatarStack } from "@/components/team/Avatar";
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
        {s.role !== "admin" && <p className="text-[13px] text-amber">You&apos;re an employee, so company details are read-only. An admin can change them.</p>}
        <div className={s.role === "admin" ? "card p-5" : "card p-5 pointer-events-none opacity-70"}><CompanyForm action={updateCompany} company={s.company} submitLabel="Save" /></div>
        <Link href="/settings/team" className="card p-5 flex items-center gap-4 hover:border-chalk">
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-2">Team</p>
            <AvatarStack members={members} size={28} />
          </div>
          <span className="text-[14px] text-muted">{members.length} {members.length === 1 ? "person" : "people"} · {members.filter((m) => m.role === "admin").length} admin ›</span>
        </Link>
      </div>
    </AppShell>
  );
}
