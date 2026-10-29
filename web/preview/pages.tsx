// The build site's own screens around the app: signing in or making an account, and the pages a crew
// or client link opens. Links show only what the `build` function hands back for that link.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Logo } from "@/components/ui/AuthShell";
import { SharedWorkView } from "@/components/share/SharedJob";
import { ClientPage, type ClientApi } from "@/components/share/ClientPage";
import type { ClientStart } from "@/components/billing/MoneyPanel";
import type { Billing } from "@/lib/billing/types";
import type { JobMessage, Pin, SharedWork } from "@/lib/data/types";
import type { ClientView } from "@/lib/cloud/links";
import type { PhotoItem } from "@/lib/photos";
import * as cloud from "./cloud";

const BG = { background: "radial-gradient(900px 500px at 75% -10%, rgb(255 106 31 / 0.10) 0%, transparent 60%), repeating-linear-gradient(0deg, transparent 0 39px, rgb(255 255 255 / 0.025) 39px 40px), repeating-linear-gradient(90deg, transparent 0 39px, rgb(255 255 255 / 0.025) 39px 40px), var(--ink)" };

export function Loading({ text = "Opening Rorker…" }: { text?: string }) {
  return <div className="h-full grid place-items-center text-muted" style={BG}><p className="flex items-center gap-3"><Logo size={20} /><span>{text}</span></p></div>;
}

export function Problem({ title, body }: { title: string; body: string }) {
  return (
    <div className="h-full grid place-items-center p-6 text-center" style={BG}>
      <div className="card p-8 max-w-sm">
        <p className="font-display text-lg font-bold mb-1">{title}</p>
        <p className="text-muted text-sm">{body}</p>
      </div>
    </div>
  );
}

/** Sign in, make an account, or look around on sample data. */
export function AuthScreen({ error, onSession, onDemo }: { error?: string; onSession(s: Session | null): void; onDemo(): void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [f, setF] = useState({ email: "", password: "", name: "", company: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(error ?? null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const s = mode === "in" ? await cloud.signIn(f.email, f.password) : await cloud.signUp({ email: f.email, password: f.password, name: f.name.trim(), company: f.company.trim() });
      onSession(s);
    } catch (x) { setErr(x instanceof Error ? x.message : "Something went wrong."); setBusy(false); }
  };
  return (
    <main className="h-full overflow-y-auto grid place-items-center px-4 py-10" style={BG}>
      <div className="w-full max-w-[420px]">
        <div className="mb-8"><Logo /></div>
        <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em] mb-1">{mode === "in" ? "Sign in" : "New account"}</h1>
        <p className="text-muted mb-6">{mode === "in" ? "Your jobs, plans and tasks, saved and on every device." : "For the contractor. Your crew and clients don't need an account: you send them a link."}</p>
        <form onSubmit={submit} className="card p-6 border-t-[3px] !border-t-accent space-y-4">
          {mode === "up" && (
            <>
              <div><label className="label" htmlFor="name">Your name</label><input id="name" className="input" value={f.name} onChange={set("name")} required autoComplete="name" /></div>
              <div><label className="label" htmlFor="company">Company</label><input id="company" className="input" value={f.company} onChange={set("company")} required autoComplete="organization" placeholder="Diaz Remodeling" /></div>
            </>
          )}
          <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="input" value={f.email} onChange={set("email")} required autoComplete="email" /></div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" value={f.password} onChange={set("password")} required minLength={mode === "up" ? 8 : undefined} autoComplete={mode === "in" ? "current-password" : "new-password"} />
            {mode === "up" && <p className="text-[12px] text-muted mt-1">At least 8 characters.</p>}
          </div>
          {err && <p className="text-red text-sm">{err}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? (mode === "in" ? "Signing in…" : "Setting up your company…") : mode === "in" ? "Sign in" : "Make my account"}</button>
          <p className="text-[13px] text-muted text-center">
            {mode === "in" ? <>New here? <button type="button" className="text-accent underline" onClick={() => { setMode("up"); setErr(null); }}>Make an account</button></> : <>Have an account? <button type="button" className="text-accent underline" onClick={() => { setMode("in"); setErr(null); }}>Sign in</button></>}
          </p>
        </form>
        <button onClick={onDemo} className="mt-4 w-full text-[13px] text-muted hover:text-text">Or look around on sample data first (nothing is saved)</button>
      </div>
    </main>
  );
}

function useLink<T>(token: string) {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    cloud.call<T>("link", { token }).then((data) => setState({ data }), (e) => setState({ error: e instanceof Error ? e.message : "Couldn't open this link." }));
  }, [token]);
  return state;
}

/** What a crew member (employee or sub) opens from their link. No sign-in. */
export function CrewLinkPage({ token, pin }: { token: string; pin: string | null }) {
  const { data, error } = useLink<{ kind: "crew"; work: SharedWork } | { kind: "client" }>(token);
  useEffect(() => { document.title = data?.kind === "crew" ? `${data.work.label} · ${data.work.company.name}` : "Rorker"; }, [data]);
  if (error) return <Problem title="This link doesn't open" body={error} />;
  if (!data) return <Loading text="Opening your tasks…" />;
  if (data.kind === "client") { location.hash = `#/c/${token}`; return null; }
  return (
    <div className="h-full flex flex-col lg:overflow-hidden overflow-y-auto">
      <SharedWorkView work={data.work} pin={pin}
        send={async (pinId, file) => (await cloud.call<{ photos: string[] }>("photo", { token, pin: pinId, ...(await cloud.photoData(file)) })).photos}
        done={async (pinId) => { await cloud.call("done", { token, pin: pinId }); }}
        addPhoto={async (job, file, input) => { await cloud.call("upload", { token, job, input, ...(await cloud.photoData(file)) }); }} />
    </div>
  );
}

/** What the contractor's client opens: their project, their thread with the contractor, their money. */
export function ClientLinkPage({ token, open, pin }: { token: string; open: string | null; pin: string | null }) {
  const { data, error } = useLink<{ kind: "client"; view: ClientView } | { kind: "crew" }>(token);
  const [err, setErr] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => { if (data?.kind === "client") document.title = `${data.view.job.name} · ${data.view.company.name}`; }, [data]);
  const api = useMemo<ClientApi>(() => ({
    thread: {
      list: async () => (await cloud.call<{ messages: JobMessage[] }>("messages", { token })).messages,
      send: async (body, file, places) => (await cloud.call<{ messages: JobMessage[] }>("message", { token, body, places, ...(file ? await cloud.photoData(file) : {}) })).messages,
    },
    // each change goes out in order; the server takes only what a client may change
    billing: (b: Billing) => {
      setErr(null);
      queue.current = queue.current.then(() => cloud.call("client", { token, billing: b })).catch((e) => setErr(e instanceof Error ? e.message : "That didn't save. Reload and try again."));
    },
    addNote: async (note) => (await cloud.call<{ note: Pin }>("note", { token, note })).note,
    removeNote: async (id) => { await cloud.call("unnote", { token, id }); },
    got: async (id, undo) => { await cloud.call("got", { token, id, undo }); },
    addPhoto: async (file, input) => (await cloud.call<{ photos: PhotoItem[] }>("upload", { token, input, ...(await cloud.photoData(file)) })).photos,
  }), [token]);
  if (error) return <Problem title="This link doesn't open" body={error} />;
  if (!data) return <Loading text="Opening your project…" />;
  if (data.kind === "crew") { location.hash = `#/s/${token}`; return null; }
  const [kind, id] = (open ?? "").split(":");
  const start: ClientStart = id && (kind === "quote" || kind === "invoice" || kind === "change") ? { kind, id } : null;
  return <ClientPage view={data.view} api={api} start={start} pin={pin} error={err} seenKey={`client:${token}`} />;
}
