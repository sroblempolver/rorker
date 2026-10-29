// The build site's own screens around the app: signing in or making an account, and the pages a crew
// or client link opens. Links show only what the `build` function hands back for that link.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Logo } from "@/components/ui/AuthShell";
import { SharedWorkView } from "@/components/share/SharedJob";
import { ClientPage, type ClientApi } from "@/components/share/ClientPage";
import type { ClientStart } from "@/components/billing/MoneyPanel";
import type { Billing } from "@/lib/billing/types";
import type { JobMessage, Pin, SharedWork, TeamMessage } from "@/lib/data/types";
import type { TeamInboxApi } from "@/components/team/TeamBoard";
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
export function AuthScreen({ error, onSession, onDemo, saving }: { error?: string; onSession(s: Session | null): void; onDemo(): void; saving?: "save" | "adopt" }) {
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
        <p className="text-muted mb-6">{saving === "adopt" ? "Sign in or make your free contractor account, and the homeowner's project goes straight into it." : saving ? "Sign in or make a free account, and the job you were sent goes into it, with every other job shared with you." : mode === "in" ? "Your jobs, plans and tasks, saved and on every device." : "For contractors, subs, employees and clients. Jobs people share with you show up in it. Anyone without an account can still open a link you send."}</p>
        <form onSubmit={submit} className="card p-6 border-t-[3px] !border-t-accent space-y-4">
          {mode === "up" && (
            <>
              <div><label className="label" htmlFor="name">Your name</label><input id="name" className="input" value={f.name} onChange={set("name")} required autoComplete="name" /></div>
              <div><label className="label" htmlFor="company">Company</label><input id="company" className="input" value={f.company} onChange={set("company")} required={saving === "adopt"} autoComplete="organization" placeholder={saving === "adopt" ? "Diaz Remodeling" : "Diaz Remodeling, or leave blank for your own home"} /></div>
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
        {!saving && <button onClick={onDemo} className="mt-4 w-full text-[13px] text-muted hover:text-text">Or look around on sample data first (nothing is saved)</button>}
      </div>
    </main>
  );
}

/** Where a signed-in person's own account is: the accounts page on build.rorker.com, else this page. */
export const accountsHref = (hash = "#/jobs") => (location.hostname === "build.rorker.com" ? `/accounts/${hash}` : `${location.pathname.replace(/link\/(index\.html)?$/, "")}${hash}`);
interface Mine { signedIn?: boolean; saved?: boolean }

/** On a link: keep it in your own Rorker account, so it's with every other job shared with you. */
function SaveBar({ token, kind, mine }: { token: string; kind: "s" | "c"; mine: Mine }) {
  const [saved, setSaved] = useState(!!mine.saved);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try { await cloud.saveLink(token); setSaved(true); } catch (e) { setErr(e instanceof Error ? e.message : "That didn't save. Try again."); }
    setBusy(false);
  };
  return (
    <div className="shrink-0 px-4 py-1.5 text-[12.5px] bg-panel-2 border-b border-line text-muted flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center" role="region" aria-label="Your account">
      {saved ? (
        <span>In your Rorker account. <a className="underline text-text" href={accountsHref()}>See everything shared with you</a></span>
      ) : mine.signedIn ? (
        <>
          <span>Keep this with your other jobs.</span>
          <button className="underline text-accent font-semibold" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save to my account"}</button>
        </>
      ) : (
        <>
          <span>Have a Rorker account? Keep this with your other jobs.</span>
          <a className="underline text-accent font-semibold" href={accountsHref(`#/save/${kind}/${token}`)}>Save to my account</a>
        </>
      )}
      {err && <span className="text-red">{err}</span>}
    </div>
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
  const { data, error } = useLink<({ kind: "crew"; work: SharedWork; person?: boolean } | { kind: "client" } | { kind: "handoff" }) & Mine>(token);
  useEffect(() => { document.title = data?.kind === "crew" ? `${data.work.label} · ${data.work.company.name}` : "Rorker"; }, [data]);
  // the team board, on a person's own link
  const inbox = useMemo<TeamInboxApi>(() => ({
    list: async () => (await cloud.call<{ messages: TeamMessage[] }>("team", { token })).messages,
    send: async (body, file) => (await cloud.call<{ messages: TeamMessage[] }>("teammsg", { token, body, ...(file ? await cloud.photoData(file) : {}) })).messages,
  }), [token]);
  if (error) return <Problem title="This link doesn't open" body={error} />;
  if (!data) return <Loading text="Opening your tasks…" />;
  if (data.kind === "client") { location.hash = `#/c/${token}`; return null; }
  if (data.kind === "handoff") { location.hash = `#/h/${token}`; return null; }
  return (
    <div className="h-full flex flex-col lg:overflow-hidden overflow-y-auto">
      <SaveBar token={token} kind="s" mine={data} />
      <SharedWorkView work={data.work} pin={pin}
        send={async (pinId, file) => (await cloud.call<{ photos: string[] }>("photo", { token, pin: pinId, ...(await cloud.photoData(file)) })).photos}
        done={async (pinId) => { await cloud.call("done", { token, pin: pinId }); }} inbox={data.person ? inbox : undefined}
        addPhoto={async (job, file, input) => { await cloud.call("upload", { token, job, input, ...(await cloud.photoData(file)) }); }} />
    </div>
  );
}

/** What the contractor's client opens: their project, their thread with the contractor, their money. */
export function ClientLinkPage({ token, open, pin }: { token: string; open: string | null; pin: string | null }) {
  const { data, error } = useLink<({ kind: "client"; view: ClientView } | { kind: "crew" } | { kind: "handoff" }) & Mine>(token);
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
  if (data.kind === "handoff") { location.hash = `#/h/${token}`; return null; }
  const [kind, id] = (open ?? "").split(":");
  const start: ClientStart = id && (kind === "quote" || kind === "invoice" || kind === "change") ? { kind, id } : null;
  return (
    <div className="h-full flex flex-col">
      <SaveBar token={token} kind="c" mine={data} />
      <div className="flex-1 min-h-0"><ClientPage view={data.view} api={api} start={start} pin={pin} error={err} seenKey={`client:${token}`} /></div>
    </div>
  );
}

/** The jobs other people shared with you and you saved to your account: a sub's jobs from every
 *  contractor they work for, a client's own project. Each opens the same page its link does. */
export function SharedWithYou({ note }: { note?: string | null }) {
  const [list, setList] = useState<cloud.SharedItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { cloud.sharedWithMe().then(setList, (e) => setErr(e instanceof Error ? e.message : "Couldn't load what's shared with you.")); }, []);
  const remove = async (id: string) => {
    setList((l) => (l ?? []).filter((x) => x.id !== id));
    try { await cloud.unsaveLink(id); } catch { /* it's back on the next load */ }
  };
  if (!list?.length && !note && !err) return null;
  return (
    <section className="px-4 sm:px-6 pb-4" aria-label="Shared with you">
      <p className="eyebrow mb-2">Shared with you</p>
      {note && <p className="text-[13px] mb-2">{note}</p>}
      {err && <p className="text-red text-[13px] mb-2">{err}</p>}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(list ?? []).map((x) => (
          <div key={x.id} className={`card p-3 flex items-start gap-3 ${x.live ? "" : "opacity-60"}`}>
            <a href={x.live ? `#/${x.kind}/${x.token}` : undefined} className="flex-1 min-w-0" aria-disabled={!x.live}>
              <span className="block text-[11.5px] text-muted truncate">{x.company} · {x.kind === "c" ? "your project" : "your tasks"}</span>
              <span className="block font-semibold truncate">{x.job?.name ?? "Every job you're on"}</span>
              <span className="block text-[12px] text-muted truncate">{x.live ? x.job?.address ?? `As ${x.label}` : "Turned off by the contractor"}</span>
            </a>
            <button className="text-muted hover:text-text text-[12px] shrink-0" onClick={() => void remove(x.id)} aria-label={`Take ${x.job?.name ?? x.label} off your list`}>Remove</button>
          </div>
        ))}
      </div>
    </section>
  );
}

interface Handoff { kind: "handoff"; from: string; job: { name: string; address: string | null }; rooms: number; tasks: number; signedIn: boolean }

/** What a contractor opens from a homeowner's "send to my contractor" link: the project, and taking it
 *  on into their own account (where they get the full job, and the homeowner keeps the client page). */
export function HandoffPage({ token }: { token: string }) {
  const { data, error } = useLink<Handoff | { kind: "crew" } | { kind: "client" }>(token);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (data?.kind === "handoff") document.title = `${data.job.name} · from ${data.from}`; }, [data]);
  if (error) return <Problem title="This link doesn't open" body={error} />;
  if (!data) return <Loading text="Opening the project…" />;
  if (data.kind !== "handoff") { location.hash = `#/${data.kind === "client" ? "c" : "s"}/${token}`; return null; }
  const take = async () => {
    setBusy(true); setErr(null);
    try { const r = await cloud.adoptLink(token); location.href = accountsHref(`#/job/${r.job}`); }
    catch (e) { setErr(e instanceof Error ? e.message : "That didn't work. Try again."); setBusy(false); }
  };
  return (
    <main className="h-full overflow-y-auto grid place-items-center px-4 py-10" style={BG}>
      <div className="w-full max-w-[460px]">
        <div className="mb-8"><Logo /></div>
        <p className="eyebrow">From {data.from}</p>
        <h1 className="font-display text-[30px] font-extrabold uppercase leading-none tracking-[0.01em] mb-1">{data.job.name}</h1>
        {data.job.address && <p className="text-muted mb-4">{data.job.address}</p>}
        <div className="card p-5 border-t-[3px] !border-t-accent space-y-3">
          <p className="text-[14px]">{data.from} planned this project on Rorker and wants you to take it on{data.rooms ? `: ${data.rooms} room${data.rooms === 1 ? "" : "s"} drawn` : ""}{data.tasks ? `, ${data.tasks} task${data.tasks === 1 ? "" : "s"} and notes` : ""}.</p>
          <p className="text-[13px] text-muted">It goes into your Rorker account as a job, with {data.from} as the client. You get the plan, the 3D house and everything they added. They keep their client page: progress, messages and their bills from you.</p>
          {err && <p className="text-red text-sm">{err}</p>}
          {data.signedIn
            ? <button className="btn btn-primary w-full" onClick={take} disabled={busy}>{busy ? "Bringing it over…" : "Take on this project"}</button>
            : <a className="btn btn-primary w-full text-center" href={accountsHref(`#/adopt/${token}`)}>Take on this project</a>}
          {!data.signedIn && <p className="text-[12px] text-muted text-center">You&apos;ll sign in, or make a free contractor account, first.</p>}
        </div>
      </div>
    </main>
  );
}
