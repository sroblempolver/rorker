"use client";
// A job opened from a shared link: no sign-in, nothing to download. The plan (look around, step
// inside, see their flags) and a list of only their tasks, with the photos posted on them. The one thing
// they can do from here is send a photo onto one of their tasks (a photo the contractor asked for, or
// their work), and mark one done. Under the tasks, the materials for their work: what it's for and who's
// getting it. An employee's link also lists the rest of the crew's open tasks on the job, to look at only.
// A person's own link covers every job they have tasks on, with a row of jobs to
// switch between, and a link copied from one task opens on that task.
import { useMemo, useRef, useState, type ReactNode } from "react";
import { TeamInbox, type TeamInboxApi } from "@/components/team/TeamBoard";
import type { Member, SharedMaterial, SharedView, SharedWork } from "@/lib/data/types";
import { STATUS_COLOR, STATUS_LABEL, qtyText, type Unit } from "@/lib/materials/types";
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
/** Mark one of their own tasks done. */
export type MarkDone = (pinId: string) => Promise<void>;

export function SharedWorkView({ work, pin, token, send: sendProp, done, onBack, inbox }: { work: SharedWork; /** open on this task (from a link copied off it) */ pin?: string | null;
  /** the link's token, for sending photos; or `send` to handle them another way (the preview) */ token?: string; send?: SendPhoto; done?: MarkDone; onBack?: () => void;
  /** the team board, on a person's own link: messages from the office, and their answers */
  inbox?: TeamInboxApi }) {
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
  return <SharedJob key={view.job.id} view={view} pin={view.job.id === start?.job.id ? pin : null} switcher={switcher} send={send} done={done} onBack={onBack} inbox={inbox} />;
}

export function SharedJob({ view: given, pin: firstPin, switcher, send, done: markDone, onBack, inbox }: { view: SharedView; pin?: string | null; switcher?: ReactNode; send?: SendPhoto; done?: MarkDone; /** the preview's way back to the full app */ onBack?: () => void; inbox?: TeamInboxApi }) {
  const [side, setSide] = useState<"work" | "messages">("work");
  const [photos, setPhotos] = useState(given.photos);
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const [closing, setClosing] = useState(false);
  const [closeErr, setCloseErr] = useState<string | null>(null);
  const view = useMemo(() => ({ ...given, pins: given.pins.map((p) => (closed.has(p.id) ? { ...p, status: "done" as const } : p)) }), [given, closed]);
  const crewPins = useMemo(() => given.crew_pins ?? [], [given]);
  const mapPins = useMemo(() => [...view.pins, ...crewPins], [view.pins, crewPins]);
  const plan = useMemo(() => (given.plan ? applyEdits(given.plan, given.edits) : null), [given]);
  const startPin = view.pins.find((p) => p.id === firstPin) ?? null;
  const [level, setLevel] = useState<Level>(() => (startPin && plan ? pinLevel(plan, startPin) : null) ?? { kind: "site" });
  const [pinId, setPinId] = useState<string | null>(startPin?.id ?? null);
  const [colorMode, setColorMode] = useState<ColorMode>("type");
  const [view3d, setView3d] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const states = useMemo(() => new Map<string, ElementStatus>(), []);
  const team = useMemo(() => ({ me: null, members: view.people.map((p): Member => ({ ...p, user_id: null, email: null, phone: null, role: "employee", is_owner: false })) }), [view.people]);
  const pin = mapPins.find((p) => p.id === pinId) ?? null;
  const mine = !!pin && view.pins.some((p) => p.id === pin.id);
  // material pins show in the materials list below, so the task list is only tasks, issues and notes
  const work = view.materials?.length ? view.pins.filter((p) => p.kind !== "material") : view.pins;
  const open = work.filter((p) => p.status !== "done").sort((a, b) => (a.due_date ?? "9").localeCompare(b.due_date ?? "9") || a.number - b.number);
  const done = work.filter((p) => p.status === "done");
  const stage = view.stages.find((s) => s.status === "active")?.name;
  const mats = (view.materials ?? []).filter((m) => m.status !== "installed").sort((a, b) => Number(b.you_get) - Number(a.you_get) || (a.needed_by ?? "9").localeCompare(b.needed_by ?? "9"));

  const show = (id: string) => {
    setPinId(id);
    setCloseErr(null);
    const p = mapPins.find((x) => x.id === id);
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
                states={states} pins={mapPins} colorMode={colorMode} setColorMode={setColorMode} pinMode={false} setPinMode={nothing} onPlacePin={nothing} draft={null}
                flyTo={null} onAllJobs={nothing} jobName={view.job.name} items={view.items} selectedItem={null} onSelectItem={nothing} onMoveItem={nothing}
                onMovePin={nothing} onMoveFixture={nothing} view3d={view3d} setView3d={setView3d} can3d readOnly
                furnish={jobSettings(view.edits).furnish ?? "all"} />
            ) : <div className="h-full grid place-items-center text-muted p-6 text-center">The plan for this job isn&apos;t ready yet.</div>}
          </div>
          <aside className="lg:w-[380px] shrink-0 flex flex-col min-h-0 bg-panel">
            {inbox && (
              <div className="shrink-0 flex border-b border-line" role="tablist" aria-label="Your link">
                {(["work", "messages"] as const).map((k) => (
                  <button key={k} role="tab" aria-selected={side === k} onClick={() => setSide(k)}
                    className={`flex-1 h-11 text-[13px] font-display font-bold tracking-[0.08em] uppercase border-b-2 ${side === k ? "border-accent text-text" : "border-transparent text-muted hover:text-text"}`}>
                    {k === "work" ? "Your tasks" : "Messages"}
                  </button>
                ))}
              </div>
            )}
            {inbox && side === "messages" ? (
              <div className="flex-1 min-h-[420px] lg:min-h-0 p-3"><TeamInbox api={inbox} company={view.company.name} /></div>
            ) : (
            <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4 space-y-3">
              {pin ? (
                <div className="space-y-3">
                  <button onClick={() => setPinId(null)} className="text-[13px] text-muted hover:text-text">← All your tasks</button>
                  {!mine && <p className="chip">Crew task: not yours, shown so you know who&apos;s where</p>}
                  <div className="flex items-start gap-3">
                    <PinBadge pin={pin} size={30} />
                    <div className="min-w-0">
                      <h2 className="text-[17px] font-semibold leading-snug">{pin.title}</h2>
                      <p className="text-[13px] text-muted">{PIN_LABEL[pin.kind]} · {PIN_STATUS_LABEL[pin.status]}{pin.due_date ? ` · due ${pin.due_date}` : ""}</p>
                    </div>
                  </div>
                  <p className="text-[13.5px]"><span className="eyebrow !text-[11px] block">Where</span>{where(plan, pin)}</p>
                  {pin.body && <p className="text-[14px] whitespace-pre-wrap leading-relaxed">{pin.body}</p>}
                  {mine && pin.close_requirement === "photo" && !photos[pin.id]?.length && <p className="chip !text-amber !border-amber">Photo requested: take one of this spot</p>}
                  {mine && send && <PhotoButton key={pin.id} requested={pin.close_requirement === "photo" && !photos[pin.id]?.length} send={(f) => send(pin.id, f).then((ph) => setPhotos((m) => ({ ...m, [pin.id]: ph })))} />}
                  {mine && markDone && pin.status !== "done" && (
                    <div className="space-y-1">
                      <button className="btn w-full" disabled={closing} onClick={async () => {
                        setCloseErr(null);
                        setClosing(true);
                        try { await markDone(pin.id); setClosed((s) => new Set(s).add(pin.id)); } catch (x) { setCloseErr(x instanceof Error ? x.message : "Couldn't mark it done."); } finally { setClosing(false); }
                      }}>{closing ? "Saving…" : "Mark done"}</button>
                      {closeErr && <p className="text-red text-[13px]">{closeErr}</p>}
                    </div>
                  )}
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
                  {mats.some((m) => m.task_id === pin.id) && <Materials title="Materials for this task" list={mats.filter((m) => m.task_id === pin.id)} />}
                </div>
              ) : (
                <>
                  <div>
                    <p className="eyebrow">Your work here</p>
                    <p className="text-[13px] text-muted">{open.length ? `${open.length} open` : "Nothing open right now"}{stage ? ` · job stage: ${stage}` : ""}. Tap one to see where it is.</p>
                  </div>
                  <div className="space-y-1.5">{open.map((p) => <PinRow key={p.id} pin={p} plan={plan} onClick={() => show(p.id)} />)}</div>
                  {mats.length > 0 && <Materials title="Materials for your work" list={mats} showTask />}
                  {crewPins.length > 0 && (
                    <>
                      <div>
                        <p className="eyebrow">Rest of the crew</p>
                        <p className="text-[13px] text-muted">{crewPins.length} open on this job for others. To look at only.</p>
                      </div>
                      <div className="space-y-1.5 opacity-80">{crewPins.map((p) => <PinRow key={p.id} pin={p} plan={plan} onClick={() => show(p.id)} />)}</div>
                    </>
                  )}
                  {done.length > 0 && (
                    <>
                      <button onClick={() => setShowDone(!showDone)} className="text-[13px] text-muted hover:text-text">{showDone ? "Hide" : "Show"} {done.length} done</button>
                      {showDone && <div className="space-y-1.5">{done.map((p) => <PinRow key={p.id} pin={p} plan={plan} onClick={() => show(p.id)} />)}</div>}
                    </>
                  )}
                </>
              )}
            </div>
            )}
            <p className="shrink-0 border-t border-line px-4 py-2 text-[11.5px] text-muted">Shared by {view.company.name} with Rorker. This link shows only what&apos;s yours{view.expires_at ? ` and works until ${view.expires_at.slice(0, 10)}` : ""}.</p>
          </aside>
        </div>
      </div>
    </TeamContext.Provider>
  );
}

/** Materials on a link: what it is, the task it's for, and who's getting it (or that it's theirs to get). */
function Materials({ title, list, showTask }: { title: string; list: SharedMaterial[]; showTask?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="eyebrow">{title}</p>
      {list.map((m) => (
        <div key={m.id} className="card !rounded-[3px] px-2.5 py-2 flex items-center gap-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] truncate"><span className="font-mono text-[13px] font-semibold mr-1.5">{qtyText(m.qty, m.unit as Unit)}</span>{m.name}</span>
            <span className="block text-[12px] text-muted truncate">
              {[showTask && m.task, m.you_get ? `You get it${m.store ? ` at ${m.store}` : ""}` : m.buyer ? `${m.buyer} is getting it` : "Nobody is getting it yet", m.needed_by && `needed ${m.needed_by.slice(5)}`, m.note].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className="chip !h-[22px] !px-1.5 !text-[11.5px] !text-text shrink-0"><span className="w-2 h-2 rounded-[1px]" style={{ background: STATUS_COLOR[m.status] }} />{STATUS_LABEL[m.status]}</span>
        </div>
      ))}
    </div>
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
