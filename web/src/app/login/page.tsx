import Link from "next/link";
import { AuthShell } from "@/components/ui/AuthShell";
import { isDemo } from "@/lib/data";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" sub="Your jobs, rooms and tasks in one place." demo={isDemo()}>
      <LoginForm demo={isDemo()} />
      <p className="text-sm text-muted mt-5">New here? <Link href="/signup" className="text-accent">Create your company account</Link></p>
    </AuthShell>
  );
}
