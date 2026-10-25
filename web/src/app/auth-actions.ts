"use server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, getRepo, getSession, isDemo } from "@/lib/data";
import { seedDemo } from "@/lib/data/demo-repo";
import { supabaseServer } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string } | undefined;

async function demoSignIn(email: string, name: string | null, sample: boolean) {
  const store = await cookies();
  // stable id per email so a returning demo user finds their data
  const id = "demo-" + (Buffer.from(email.toLowerCase()).toString("hex").slice(0, 24) || randomUUID());
  if (sample) await seedDemo(id, name, email);
  store.set(DEMO_COOKIE, encodeURIComponent(JSON.stringify({ id, email, name })), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  if (!email) return { error: "Enter your email." };
  if (isDemo()) {
    await demoSignIn(email, null, true);
    redirect("/jobs");
  }
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/jobs");
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const name = String(form.get("name") || "").trim() || null;
  if (!email) return { error: "Enter your email." };
  if (isDemo()) {
    await demoSignIn(email, name, false);
    redirect("/onboarding");
  }
  if (password.length < 8) return { error: "Use at least 8 characters for the password." };
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name } } });
  if (error) return { error: error.message };
  if (!data.session) return { message: "Check your email to confirm your account, then sign in." };
  redirect("/onboarding");
}

export async function signOut() {
  if (isDemo()) (await cookies()).delete(DEMO_COOKIE);
  else await (await supabaseServer()).auth.signOut();
  redirect("/login");
}

export async function createCompany(_: FormState, form: FormData): Promise<FormState> {
  const s = await getSession();
  if (!s) redirect("/login");
  const name = String(form.get("name") || "").trim();
  if (!name) return { error: "Enter your company name." };
  const repo = getRepo();
  const val = (k: string) => String(form.get(k) || "").trim() || null;
  const id = await repo.createCompany(s.userId, {
    name, phone: val("phone"), email: val("email"), license_no: val("license_no"), website: val("website"),
    brand_color: val("brand_color"),
  }, s.name ?? val("full_name") ?? undefined);
  const logo = form.get("logo");
  if (logo instanceof File && logo.size > 0) await repo.uploadLogo(id, logo);
  redirect("/jobs");
}
