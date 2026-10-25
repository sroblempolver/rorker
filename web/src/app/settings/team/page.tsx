import { AppShell } from "@/components/ui/AppShell";
import { getRepo, isDemo, requireCompany } from "@/lib/data";
import { TeamClient } from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const s = await requireCompany();
  const members = await getRepo().listMembers(s.company.id);
  return (
    <AppShell session={s} demo={isDemo()} active="team">
      <div className="px-4 sm:px-6 py-8 max-w-3xl w-full mx-auto">
        <p className="eyebrow">{s.company.name}</p>
        <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em] mb-1">Team</h1>
        <p className="text-muted mb-6">Everyone who works your jobs. Tag them on any pin so they know where to go and what to do.</p>
        <TeamClient initial={members} canManage={s.role === "admin"} meId={s.memberId} />
      </div>
    </AppShell>
  );
}
