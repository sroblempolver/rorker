"use client";
import { useActionState } from "react";
import { signUp } from "../auth-actions";

export function SignupForm({ demo }: { demo: boolean }) {
  const [state, action, pending] = useActionState(signUp, undefined);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="name">Your name</label><input id="name" name="name" className="input" autoComplete="name" /></div>
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" autoComplete="email" /></div>
      {!demo && <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></div>}
      {state?.error && <p className="text-red text-sm">{state.error}</p>}
      {state?.message && <p className="text-green text-sm">{state.message}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Creating…" : "Continue"}</button>
    </form>
  );
}
