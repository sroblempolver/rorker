import Link from "next/link";
import { AuthShell } from "@/components/ui/AuthShell";
import { isDemo } from "@/lib/data";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <AuthShell title="Create your account" sub="Step 1 of 2. Next you set up your company." demo={isDemo()}>
      <SignupForm demo={isDemo()} />
      <p className="text-sm text-muted mt-5">Already have an account? <Link href="/login" className="text-accent">Sign in</Link></p>
    </AuthShell>
  );
}
