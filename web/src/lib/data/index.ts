import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseEnabled, supabaseServer } from "@/lib/supabase/server";
import { DemoRepo, demoCompanyFor } from "./demo-repo";
import { companyFromRow, SupabaseRepo } from "./supabase-repo";
import type { MemberRole, Repo, Session } from "./types";

export const DEMO_COOKIE = "rorker_demo_user";

export function getRepo(): Repo {
  return supabaseEnabled() ? new SupabaseRepo() : new DemoRepo();
}

export const isDemo = () => !supabaseEnabled();

export async function getSession(): Promise<Session | null> {
  if (!supabaseEnabled()) {
    const store = await cookies();
    const raw = store.get(DEMO_COOKIE)?.value;
    if (!raw) return null;
    const { id, email, name } = JSON.parse(decodeURIComponent(raw)) as { id: string; email: string; name: string | null };
    const c = demoCompanyFor(id, email);
    return { userId: id, email, name, company: c?.company ?? null, role: c?.role ?? null, memberId: c?.memberId ?? null };
  }
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const find = () => sb.from("company_members").select("id, role, companies(*)").eq("user_id", data.user.id).limit(1).maybeSingle();
  let m = await find();
  // added to a team before they had an account: link this login to that row, then look again
  if (!m.data && (await sb.rpc("claim_invites")).data) m = await find();
  const row = m.data as { id: string; role: MemberRole; companies: Record<string, unknown> } | null;
  return {
    userId: data.user.id, email: data.user.email ?? null, name: (data.user.user_metadata?.full_name as string) ?? null,
    company: row?.companies ? companyFromRow(row.companies) : null, role: row?.role ?? null, memberId: row?.id ?? null,
  };
}

/** For pages that need a signed-in user with a company. */
export async function requireCompany() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.company) redirect("/onboarding");
  return s as Session & { company: NonNullable<Session["company"]> };
}

/** For changes only an admin may make: the company, the team, stage templates. */
export async function requireAdmin() {
  const s = await requireCompany();
  if (s.role !== "admin") throw new Error("Only an admin can do that. Ask the owner to change your role.");
  return s;
}

/** Throws unless the job belongs to the caller's company (RLS does this too on Supabase). */
export async function requireJob(jobId: string) {
  const s = await requireCompany();
  const job = await getRepo().getJob(jobId);
  if (!job || job.company_id !== s.company.id) redirect("/jobs");
  return { session: s, job };
}
