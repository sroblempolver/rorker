import { AppShell } from "@/components/ui/AppShell";
import { getRepo, isDemo, requireJob } from "@/lib/data";
import { JobClient } from "./JobClient";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, job } = await requireJob(id);
  const repo = getRepo();
  const [plan, stages, pins, states, runs, members, items, edits] = await Promise.all([
    job.current_plan_id ? repo.getPlan(job.current_plan_id) : Promise.resolve(null),
    repo.listStages(id), repo.listPins(id), repo.listElementStates(id), repo.listRuns(id), repo.listMembers(job.company_id), repo.listItems(id), repo.listElementEdits(id),
  ]);
  const aiAvailable = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return (
    <AppShell session={session} demo={isDemo()} active="jobs" fill>
      <JobClient data={{ job, plan, stages, pins, items, edits, states, runs, members, me: session.memberId, aiAvailable, canShare: session.role === "admin" }} />
    </AppShell>
  );
}
