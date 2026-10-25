import { redirect } from "next/navigation";
import { AuthShell } from "@/components/ui/AuthShell";
import { getSession } from "@/lib/data";
import { CompanyForm } from "@/components/CompanyForm";
import { createCompany } from "../auth-actions";

export default async function Onboarding() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.company) redirect("/jobs");
  return (
    <AuthShell title="Set up your company" sub="Step 2 of 2. Your logo and details appear on everything your clients see.">
      <CompanyForm action={createCompany} submitLabel="Create company" />
    </AuthShell>
  );
}
