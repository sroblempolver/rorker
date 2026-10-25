"use client";
import { useActionState } from "react";
import { signIn } from "../auth-actions";

export function LoginForm({ demo }: { demo: boolean }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" defaultValue={demo ? "demo@rorker.app" : ""} autoComplete="email" /></div>
      {!demo && <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required className="input" autoComplete="current-password" /></div>}
      {state?.error && <p className="text-red text-sm">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : demo ? "Open the demo" : "Sign in"}</button>
    </form>
  );
}
