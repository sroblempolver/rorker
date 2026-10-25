import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseEnabled, supabaseServer } from "@/lib/supabase/server";
import { DemoRepo, demoCompanyFor } from "./demo-repo";
import { companyFromRow, SupabaseRepo } from "./supabase-repo";
import type { Repo, Session } from "./types";

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
    const c = demoCompanyFor(id);
    return { userId: id, email, name, company: c?.company ?? null, role: c?.role ?? null };
  }
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const m = await sb.from("company_members").select("role, companies(*)").eq("user_id", data.user.id).limit(1).maybeSingle();
  const row = m.data as { role: string; companies: Record<string, unknown> } | null;
  return {
    userId: data.user.id, email: data.user.email ?? null, name: (data.user.user_metadata?.full_name as string) ?? null,
    company: row?.companies ? companyFromRow(row.companies) : null, role: row?.role ?? null,
  };
}

/** For pages that need a signed-in user with a company. */
export async function requireCompany() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.company) redirect("/onboarding");
  return s as Session & { company: NonNullable<Session["company"]> };
}

/** Throws unless the job belongs to the caller's company (RLS does this too on Supabase). */
export async function requireJob(jobId: string) {
  const s = await requireCompany();
  const job = await getRepo().getJob(jobId);
  if (!job || job.company_id !== s.company.id) redirect("/jobs");
  return { session: s, job };
}
