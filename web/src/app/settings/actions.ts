"use server";
import { revalidatePath } from "next/cache";
import { getRepo, requireCompany } from "@/lib/data";

type State = { error?: string; message?: string } | undefined;
const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

export async function updateCompany(_: State, form: FormData): Promise<State> {
  const s = await requireCompany();
  if (s.role !== "owner" && s.role !== "admin") return { error: "Only the owner or an admin can change company details." };
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
  const s = await requireCompany();
  const stages = t.stages.map((x) => ({ name: x.name.trim() })).filter((x) => x.name);
  if (!t.name.trim()) throw new Error("Give the template a name.");
  await getRepo().saveTemplate(s.company.id, { id: t.id, name: t.name.trim(), job_type: t.job_type, stages });
  revalidatePath("/settings/stages");
}

export async function deleteTemplate(id: string) {
  const s = await requireCompany();
  await getRepo().deleteTemplate(s.company.id, id);
  revalidatePath("/settings/stages");
}
