"use server";
import { revalidatePath } from "next/cache";
import { getRepo, requireAdmin } from "@/lib/data";
import type { MemberInput } from "@/lib/data/types";
import { attempt } from "@/lib/result";

type State = { error?: string; message?: string } | undefined;
const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

export async function updateCompany(_: State, form: FormData): Promise<State> {
  const s = await requireAdmin().catch(() => null);
  if (!s) return { error: "Only an admin can change company details." };
  const name = str(form, "name");
  if (!name) return { error: "The company needs a name." };
  const repo = getRepo();
  await repo.updateCompany(s.company.id, {
    name, phone: str(form, "phone"), email: str(form, "email"), license_no: str(form, "license_no"), website: str(form, "website"), brand_color: str(form, "brand_color"),
  });
  const logo = form.get("logo");
  if (logo instanceof File && logo.size > 0) await repo.uploadLogo(s.company.id, logo);
  revalidatePath("/", "layout");
  return { message: "Saved." };
}

export async function saveTemplate(t: { id?: string; name: string; job_type: string; stages: { name: string }[] }) {
  const s = await requireAdmin();
  const stages = t.stages.map((x) => ({ name: x.name.trim() })).filter((x) => x.name);
  if (!t.name.trim()) throw new Error("Give the template a name.");
  await getRepo().saveTemplate(s.company.id, { id: t.id, name: t.name.trim(), job_type: t.job_type, stages });
  revalidatePath("/settings/stages");
}

export async function deleteTemplate(id: string) {
  const s = await requireAdmin();
  await getRepo().deleteTemplate(s.company.id, id);
  revalidatePath("/settings/stages");
}

// ---------------------------------------------------------------- team

function clean(input: Partial<MemberInput>): Partial<MemberInput> {
  const out = { ...input } as Partial<MemberInput>;
  const o = out as Record<string, unknown>;
  for (const k of ["full_name", "email", "phone", "title"]) if (k in o) o[k] = (o[k] as string | null | undefined)?.trim() || null;
  if (out.role && out.role !== "admin" && out.role !== "employee") throw new Error("Unknown role.");
  if (out.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.email)) throw new Error("That email doesn't look right.");
  return out;
}

export async function addMember(input: MemberInput) {
  return attempt(async () => {
    const s = await requireAdmin();
    const c = clean(input);
    if (!c.full_name) throw new Error("Add their name.");
    const repo = getRepo();
    await repo.addMember(s.company.id, { ...c, full_name: c.full_name, role: c.role ?? "employee" });
    revalidatePath("/settings/team");
    return repo.listMembers(s.company.id);
  });
}

export async function updateMember(memberId: string, input: Partial<MemberInput>) {
  return attempt(async () => {
    const s = await requireAdmin();
    const repo = getRepo();
    const target = (await repo.listMembers(s.company.id)).find((m) => m.id === memberId);
    if (!target) throw new Error("That person isn't on your team.");
    if (target.is_owner && input.role && input.role !== "admin") throw new Error("The owner always stays an admin.");
    const c = clean(input);
    if ("full_name" in c && !c.full_name) throw new Error("Add their name.");
    if (target.is_owner) delete c.role;
    await repo.updateMember(memberId, c);
    revalidatePath("/settings/team");
    return repo.listMembers(s.company.id);
  });
}

export async function removeMember(memberId: string) {
  return attempt(async () => {
    const s = await requireAdmin();
    const repo = getRepo();
    const target = (await repo.listMembers(s.company.id)).find((m) => m.id === memberId);
    if (!target) throw new Error("That person isn't on your team.");
    if (target.is_owner) throw new Error("The owner can't be removed.");
    await repo.removeMember(memberId);
    revalidatePath("/settings/team");
    return repo.listMembers(s.company.id);
  });
}
