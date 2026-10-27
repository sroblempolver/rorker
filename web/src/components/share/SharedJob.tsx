"use client";
// A job opened from a shared link: no sign-in, nothing to download. The plan (look around, step
// inside, see their flags) and a list of only their tasks, with the photos posted on them. The one thing
// they can do from here is send a photo onto one of their tasks (a photo the contractor asked for, or
// their work). A person's own link covers every job they have tasks on, with a row of jobs to
// switch between, and a link copied from one task opens on that task.
import { useMemo, useRef, useState, type ReactNode } from "react";
import type { Member, SharedView, SharedWork } from "@/lib/data/types";
import type { ElementStatus } from "@/lib/plan/types";
import { applyEdits } from "@/lib/plan/edits";
import { jobSettings } from "@/lib/plan/build";
import { PlanViewer, type Level } from "@/components/plan/PlanViewer";
import type { ColorMode } from "@/components/plan/FloorCanvas";
import { pinLevel } from "@/components/plan/pinLevel";
import { PIN_LABEL, PIN_STATUS_LABEL } from "@/components/plan/style";
import { TeamContext } from "@/components/team/context";
import { PinBadge, PinRow, where } from "@/components/workspace/PinsPanel";

const nothing = () => {};

/** Send a photo onto a pin: returns that pin's photos. The real app posts to the link's own address. */
export type SendPhoto = (pinId: string, file: File) => Promise<string[]>;
export const postPhoto = (token: string): SendPhoto => async (pinId, file) => {
  const f = new FormData();
  f.set("pin", pinId);
  f.set("photo", file);
  const r = await fetch(`/s/${encodeURIComponent(token)}/photo`, { method: "POST", body: f }).catch(() => null);
  const j = r ? ((await r.json().catch(() => null)) as { photos?: string[]; error?: string } | null) : null;
  if (!r?.ok || !j?.photos) throw new Error(j?.error ?? "Couldn't send the photo. Check your connection and try again.");
  return j.photos;
};

/** Everything a link opens: one job, or the person's jobs with a row to switch between them. */
export function SharedWorkView({ work, pin, token, send: sendProp, onBack }: { work: SharedWork; /** open on this task (from a link copied off it) */ pin?: string | null;
  /** the link's token, for sending photos; or `send` to handle them another way (the preview) */ token?: string; send?: SendPhoto; onBack?: () => void }) {
  const send = sendProp ?? (token ? postPhoto(token) : undefined);
  const start = work.jobs.find((v) => v.pins.some((p) => p.id === pin)) ?? work.jobs[0];
  const [jobId, setJobId] = useState(start?.job.id ?? null);
  const view = work.jobs.find((v) => v.job.id === jobId) ?? start;
  if (!view) return (
    <div className="h-full grid place-items-center p-6 text-center">
      <div className="card p-8 max-w-sm">
        <p className="font-display text-lg font-bold mb-1">Nothing for you right now</p>
        <p className="text-muted text-sm">When {work.company.name} tags you on a task, it shows up here. Keep this link.</p>
      </div>
    </div>
  );
  const open = (v: SharedView) => v.pins.filter((p) => p.status !== "done").length;
  const switcher = work.jobs.length > 1 ? (
    <nav className="shrink-0 border-b border-line bg-panel-2 px-4 py-1.5 flex gap-1.5 overflow-x-auto scroll-thin" aria-label="Your jobs">
      <span className="eyebrow !text-[11px] self-center shrink-0 mr-1">Your jobs</span>
      {work.jobs.map((v) => (
        <button key={v.job.id} onClick={() => setJobId(v.job.id)} aria-pressed={v.job.id === view.job.id}
          className={`chip !h-7 shrink-0 ${v.job.id === view.job.id ? "!text-accent !border-accent" : ""}`}>
          {v.job.name}<span className="font-mono text-[11px]">{open(v)}</span>
        </button>
      ))}
    </nav>
  ) : null;
  return <SharedJob key={view.job.id} view={view} pin={view.job.id === start?.job.id ? pin : null} switcher={switcher} send={send} onBack={onBack} />;
}

export function SharedJob({ view, pin: firstPin, switcher, send, onBack }: { view: SharedView; pin?: string | null; switcher?: ReactNode; send?: SendPhoto; /** the preview's way back to the full app */ onBack?: () => void }) {
  const [photos, setPhotos] = useState(view.photos);
  const plan = useMemo(() => (view.plan ? applyEdits(view.plan, view.edits) : null), [view]);
  const startPin = view.pins.find((p) => p.id === firstPin) ?? null;
  const [level, setLevel] = useState<Level>(() => (startPin && plan ? pinLevel(plan, startPin) : null) ?? { kind: "site" });
  const [pinId, setPinId] = useState<string | null>(startPin?.id ?? null);
  const [colorMode, setColorMode] = useState<ColorMode>("type");
  const [view3d, setView3d] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const states = useMemo(() => new Map<string, ElementStatus>(), []);
  const team = useMemo(() => ({ me: null, members: view.people.map((p): Member => ({ ...p, user_id: null, email: null, phone: null, role: "employee", is_owner: false })) }), [view.people]);
  const pin = view.pins.find((p) => p.id === pinId) ?? null;
  const open = view.pins.filter((p) => p.status !== "done").sort((a, b) => (a.due_date ?? "9").localeCompare(b.due_date ?? "9") || a.number - b.number);
  const done = view.pins.filter((p) => p.status === "done");
  const stage = view.stages.find((s) => s.status === "active")?.name;

  const show = (id: string) => {
    setPinId(id);
    const p = view.pins.find((x) => x.id === id);
    const to = p && plan ? pinLevel(plan, p) : null;
    if (to) setLevel(to);
  };

  return (
    <TeamContext.Provider value={team}>
      <div className="h-full flex flex-col min-h-0">
        <header className="shrink-0 border-b border-line bg-panel px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          {view.company.logo_url ? <img src={view.company.logo_url} alt="" className="h-8 w-auto max-w-[120px] object-contain" /> : <span className="w-8 h-8 rounded-[3px] grid place-items-center font-display font-extrabold text-accent-ink" style={{ background: view.company.brand_color }}>{view.company.name.slice(0, 1)}</span>}
          <div className="min-w-0 flex-1">
            <h1 className="font-stencil text-[20px] font-extrabold uppercase leading-none truncate">{view.job.name}</h1>
            <p className="text-[12.5px] text-muted truncate">{[view.job.address, `from ${view.company.name}`].filter(Boolean).join(" · ")}</p>
          </div>
          <span className="chip !text-text">For {view.label}</span>
          {view.company.phone && <a href={`tel:${view.company.phone}`} className="btn btn-ghost btn-sm">Call {view.company.phone}</a>}
          {onBack && <button onClick={onBack} className="btn btn-ghost btn-sm">Back to the app</button>}
        </header>
        {switcher}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <div className="relative h-[58vh] shrink-0 lg:shrink lg:h-auto lg:flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-line">
            {plan ? (
              <PlanViewer plan={plan} level={level} setLevel={setLevel} selected={null} onSelect={nothing} selectedPin={pinId} onSelectPin={show}
                states={states} pins={view.pins} colorMode={colorMode} setColorMode={setColorMode} pinMode={false} setPinMode={nothing} onPlacePin={nothing} draft={null}
                flyTo={null} onAllJobs={nothing} jobName={view.job.name} items={view.items} selectedItem={null} onSelectItem={nothing} onMoveItem={nothing}
                onMovePin={nothing} onMoveFixture={nothing} view3d={view3d} setView3d={setView3d} can3d readOnly
                furnish={jobSettings(view.edits).furnish ?? "all"} />
            ) : <div className="h-full grid place-items-center text-muted p-6 text-center">The plan for this job isn&apos;t ready yet.</div>}
          </div>
          <aside className="lg:w-[380px] shrink-0 flex flex-col min-h-0 bg-panel">
            <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4 space-y-3">
              {pin ? (
                <div className="space-y-3">
                  <button onClick={() => setPinId(null)} className="text-[13px] text-muted hover:text-text">← All your tasks</button>
                  <div className="flex items-start gap-3">
                    <PinBadge pin={pin} size={30} />
                    <div className="min-w-0">
                      <h2 className="text-[17px] font-semibold leading-snug">{pin.title}</h2>
                      <p className="text-[13px] text-muted">{PIN_LABEL[pin.kind]} · {PIN_STATUS_LABEL[pin.status]}{pin.due_date ? ` · due ${pin.due_date}` : ""}</p>
                    </div>
                  </div>
                  <p className="text-[13.5px]"><span className="eyebrow !text-[11px] block">Where</span>{where(plan, pin)}</p>
                  {pin.body && <p className="text-[14px] whitespace-pre-wrap leading-relaxed">{pin.body}</p>}
                  {pin.close_requirement === "photo" && !photos[pin.id]?.length && <p className="chip !text-amber !border-amber">Photo requested: take one of this spot</p>}
                  {send && <PhotoButton key={pin.id} requested={pin.close_requirement === "photo" && !photos[pin.id]?.length} send={(f) => send(pin.id, f).then((ph) => setPhotos((m) => ({ ...m, [pin.id]: ph })))} />}
                  {pin.links.length > 0 && (
                    <div className="space-y-1">
                      <span className="eyebrow !text-[11px] block">Links</span>
                      {pin.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="block text-[14px] text-accent underline truncate">{l.title || l.url}</a>)}
                    </div>
                  )}
                  {!!photos[pin.id]?.length && (
                    <div className="space-y-1">
                      <span className="eyebrow !text-[11px] block">Photos</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {photos[pin.id].map((src) => <a key={src} href={src} target="_blank" rel="noreferrer noopener"><img src={src} alt="" className="w-full aspect-square object-cover rounded-[3px] border border-line" /></a>)}
                      </div>
                    </div>
                  )}
                  {pin.tagged.length > 0 && <p className="text-[13px] text-muted">With {team.members.filter((m) => pin.tagged.includes(m.id)).map((m) => m.full_name).join(", ")}</p>}
                </div>
              ) : (
                <>
                  <div>
                    <p className="eyebrow">Your work here</p>
                    <p className="text-[13px] text-muted">{open.length ? `${open.length} open` : "Nothing open right now"}{stage ? ` · job stage: ${stage}` : ""}. Tap one to see where it is.</p>
                  </div>
                  <div className="space-y-1.5">{open.map((p) => <PinRow key={p.id} pin={p} plan={plan} onClick={() => show(p.id)} />)}</div>
                  {done.length > 0 && (
                    <>
                      <button onClick={() => setShowDone(!showDone)} className="text-[13px] text-muted hover:text-text">{showDone ? "Hide" : "Show"} {done.length} done</button>
                      {showDone && <div className="space-y-1.5">{done.map((p) => <PinRow key={p.id} pin={p} plan={plan} onClick={() => show(p.id)} />)}</div>}
                    </>
                  )}
                </>
              )}
            </div>
            <p className="shrink-0 border-t border-line px-4 py-2 text-[11.5px] text-muted">Shared by {view.company.name} with Rorker. This link shows only what&apos;s yours{view.expires_at ? ` and works until ${view.expires_at.slice(0, 10)}` : ""}.</p>
          </aside>
        </div>
      </div>
    </TeamContext.Provider>
  );
}

/** Take or pick a photo and send it onto the task. On a phone it opens the camera. */
function PhotoButton({ requested, send }: { requested: boolean; send: (f: File) => Promise<void> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [err, setErr] = useState<string | null>(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    setState("busy");
    try { await send(f); setState("sent"); } catch (x) { setErr(x instanceof Error ? x.message : "Couldn't send the photo."); setState("idle"); }
    if (ref.current) ref.current.value = "";
  };
  return (
    <div className="space-y-1">
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} aria-label="Photo" />
      <button type="button" onClick={() => ref.current?.click()} disabled={state === "busy"} className={`btn w-full ${requested ? "btn-primary" : ""}`}>
        {state === "busy" ? "Sending…" : state === "sent" ? "Sent. Add another photo" : requested ? "Take the photo" : "Add a photo"}
      </button>
      {err && <p className="text-[12.5px] text-red">{err}</p>}
    </div>
  );
}
