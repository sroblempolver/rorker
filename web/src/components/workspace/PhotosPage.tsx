"use client";
// Photos: every photo on every job in one place, newest first, grouped by day. It sits in the top bar
// between Shopping and Team. Each photo says which job and room it's in (and the thing in
// the room), the stage, who added it and when, and whether the client sees it. Filter by job, then by
// room, stage, person or where it came from (added here, on a pin, in the client thread). Tap one to see
// it big; "Show on the map" opens its job at its spot.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Job, JobPhoto, JobPhotoInput, JobStage, Member, Pin } from "@/lib/data/types";
import { clientMemberId } from "@/lib/data/types";
import type { Plan } from "@/lib/plan/types";
import { byDay, filterPhotos, gatherPhotos, photoWhere, roomOptions, whoKey, type PhotoFilter, type PhotoItem, type PhotoSource } from "@/lib/photos";
import { Avatar } from "@/components/team/Avatar";
import { useFeedback } from "@/components/ui/feedback";
import type { PhotosApi } from "./api";

/** one job, as Photos needs it */
export interface PhotoJob { job: Job; plan: Plan | null; pins: Pin[]; stages: JobStage[]; api: PhotosApi }
type Loaded = Awaited<ReturnType<PhotosApi["list"]>>;
/** a photo and the job it's on */
type Item = PhotoItem & { job_id: string };

const SOURCE: Record<PhotoSource, string> = { upload: "Added here", pin: "On a pin", message: "Client thread" };
const KIND: Record<PhotoItem["by"]["kind"], string> = { team: "Team", crew: "Crew", client: "Client" };
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const activeStage = (j: PhotoJob) => j.stages.find((s) => s.status === "active")?.id ?? null;

export function PhotosPage({ jobs, members, jobId, onPickJob, onShowSpot }: {
  jobs: PhotoJob[]; members: Member[];
  /** the job picked, or null for every job */ jobId: string | null; onPickJob: (id: string | null) => void;
  /** open the photo's job, at its spot on the map (or on its pin) */ onShowSpot: (jobId: string, p: PhotoItem) => void;
}) {
  const { toast } = useFeedback();
  const [data, setData] = useState<Map<string, Loaded> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<PhotoFilter>({});
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<File[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try {
      const got = await Promise.all(jobs.map(async (j) => [j.job.id, await j.api.list()] as const));
      setData(new Map(got));
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't load the photos."); }
  }, [jobs]);
  useEffect(() => { void load(); }, [load]);

  const pick = jobs.find((j) => j.job.id === jobId) ?? null;
  const names = useMemo(() => new Map(members.map((m) => [m.id, m.full_name])), [members]);
  const everything = useMemo<Item[]>(() => {
    if (!data) return [];
    return jobs.flatMap((j) => {
      const d = data.get(j.job.id);
      if (!d) return [];
      return gatherPhotos({ plan: j.plan, pins: j.pins, comments: d.comments, messages: d.messages, uploads: d.uploads, clientId: clientMemberId(j.job.id), names })
        .map((p) => ({ ...p, key: `${j.job.id}/${p.key}`, job_id: j.job.id }));
    }).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.key.localeCompare(b.key));
  }, [data, jobs, names]);
  const jobCounts = useMemo(() => { const c = new Map<string, number>(); for (const p of everything) c.set(p.job_id, (c.get(p.job_id) ?? 0) + 1); return c; }, [everything]);
  const all = useMemo(() => (pick ? everything.filter((p) => p.job_id === pick.job.id) : everything), [everything, pick]);
  const shown = useMemo(() => filterPhotos(all, filter) as Item[], [all, filter]);
  const item = everything.find((p) => p.key === open) ?? null;
  const jobOf = (id: string) => jobs.find((j) => j.job.id === id)!;
  const roomsOf = useMemo(() => new Map(jobs.map((j) => [j.job.id, roomOptions(j.plan)])), [jobs]);

  // the filters only offer what's there; rooms and stages belong to one job
  const rooms = pick ? roomsOf.get(pick.job.id)! : [];
  const roomCounts = useMemo(() => { const c = new Map<string, number>(); for (const p of all) c.set(p.room_id ?? "none", (c.get(p.room_id ?? "none") ?? 0) + 1); return c; }, [all]);
  const people = useMemo(() => [...new Map(all.map((p) => [whoKey(p.by), p.by])).entries()], [all]);
  const usedStages = pick ? pick.stages.filter((s) => all.some((p) => p.stage_id === s.id)) : [];
  const filtered = !!(filter.room || filter.stage || filter.who || filter.source);
  const pickJob = (id: string | null) => { setFilter((f) => ({ who: f.who, source: f.source })); onPickJob(id); };

  if (adding) return (
    <Page>
      <AddPhotos files={adding} jobs={jobs} start={pick?.job.id ?? jobs[0]?.job.id ?? ""} roomsOf={roomsOf}
        onCancel={() => setAdding(null)}
        onSave={async (jid, input) => {
          const j = jobOf(jid);
          for (const f of adding) await j.api.add(f, input);
          setAdding(null);
          const room = roomsOf.get(jid)!.find((r) => r.id === input.room_id)?.label;
          toast(`${adding.length === 1 ? "Photo" : `${adding.length} photos`} added to ${j.job.name}${room ? `, ${room}` : ""}`);
          await load();
        }} />
    </Page>
  );

  if (item) {
    const j = jobOf(item.job_id);
    return (
      <Page>
        <PhotoDetail p={item} job={j} rooms={roomsOf.get(j.job.id)!} onBack={() => setOpen(null)} onShowSpot={() => onShowSpot(j.job.id, item)}
          onUpdate={async (patch) => { await j.api.update(item.photo_id!, patch); await load(); }}
          onRemove={async () => { await j.api.remove(item.photo_id!); setOpen(null); toast("Photo removed"); await load(); }} />
      </Page>
    );
  }

  return (
    <Page>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <p className="eyebrow">{pick ? pick.job.name : "Every job"}</p>
          <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em]">Photos</h1>
          <p className="text-muted text-sm">{data ? `${all.length} photo${all.length === 1 ? "" : "s"}${filtered ? `, ${shown.length} shown` : ""}.` : "Loading…"} From you, the crew and your clients, tagged by job and room.</p>
        </div>
        {jobs.length > 0 && <button className="btn btn-primary btn-sm shrink-0" onClick={() => fileRef.current?.click()}>+ Add photos</button>}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" aria-label="Add photos"
          onChange={(e) => { const l = [...(e.target.files ?? [])]; e.target.value = ""; if (l.length) setAdding(l); }} />
      </div>
      {err && <p className="text-red text-[13px] mb-3">{err}</p>}

      {jobs.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1 mb-2" role="group" aria-label="Job">
          <Chip on={!pick} onClick={() => pickJob(null)}>All jobs<span className="font-mono text-[11px] opacity-70">{everything.length}</span></Chip>
          {jobs.map((j) => (
            <Chip key={j.job.id} on={pick?.job.id === j.job.id} onClick={() => pickJob(pick?.job.id === j.job.id ? null : j.job.id)}>{j.job.name}<span className="font-mono text-[11px] opacity-70">{jobCounts.get(j.job.id) ?? 0}</span></Chip>
          ))}
        </div>
      )}

      {all.length > 0 && (
        <div className="space-y-2 mb-4">
          {pick && rooms.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1" role="group" aria-label="Room">
              <Chip on={!filter.room} onClick={() => setFilter({ ...filter, room: null })}>All rooms</Chip>
              {rooms.filter((r) => roomCounts.has(r.id)).map((r) => (
                <Chip key={r.id} on={filter.room === r.id} onClick={() => setFilter({ ...filter, room: filter.room === r.id ? null : r.id })}>{r.label}<span className="font-mono text-[11px] opacity-70">{roomCounts.get(r.id)}</span></Chip>
              ))}
              {roomCounts.has("none") && <Chip on={filter.room === "none"} onClick={() => setFilter({ ...filter, room: filter.room === "none" ? null : "none" })}>No room<span className="font-mono text-[11px] opacity-70">{roomCounts.get("none")}</span></Chip>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {pick && (
              <select className="input !h-9 !text-[13px] !w-auto" aria-label="Stage" value={filter.stage ?? ""} onChange={(e) => setFilter({ ...filter, stage: e.target.value || null })}>
                <option value="">Any stage</option>
                {usedStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                {all.some((p) => !p.stage_id) && <option value="none">No stage</option>}
              </select>
            )}
            <select className="input !h-9 !text-[13px] !w-auto" aria-label="Who" value={filter.who ?? ""} onChange={(e) => setFilter({ ...filter, who: e.target.value || null })}>
              <option value="">Anyone</option>
              {(["team", "crew", "client"] as const).filter((k) => all.some((p) => p.by.kind === k)).map((k) => <option key={k} value={k}>All {KIND[k].toLowerCase()}</option>)}
              {people.map(([k, b]) => <option key={k} value={k}>{b.name}</option>)}
            </select>
            <select className="input !h-9 !text-[13px] !w-auto" aria-label="From" value={filter.source ?? ""} onChange={(e) => setFilter({ ...filter, source: (e.target.value || null) as PhotoSource | null })}>
              <option value="">From anywhere</option>
              {(Object.keys(SOURCE) as PhotoSource[]).filter((s) => all.some((p) => p.source === s)).map((s) => <option key={s} value={s}>{SOURCE[s]}</option>)}
            </select>
            {!pick && jobs.length > 1 && <span className="text-[12.5px] text-muted">Pick a job to filter by room and stage.</span>}
            {filtered && <button className="text-[12.5px] text-muted hover:text-text underline" onClick={() => setFilter({})}>Clear filters</button>}
          </div>
        </div>
      )}

      {data && !all.length && (
        <div className="card !rounded-[3px] p-4 text-[13.5px] text-muted space-y-1 max-w-xl">
          <p className="text-text font-semibold">No photos yet</p>
          <p>Add progress photos here and tag the room. Photos the crew posts on their tasks and clients send in messages show up here too.</p>
        </div>
      )}
      {data && all.length > 0 && !shown.length && <p className="text-[13px] text-muted">No photos match. <button className="underline" onClick={() => setFilter({})}>Show all</button></p>}

      <div className="space-y-4">
        {byDay(shown).map((g) => (
          <section key={g.day} className="space-y-1.5">
            <p className="eyebrow !text-[11px]">{g.label} <span className="text-muted font-mono">{g.photos.length}</span></p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
              {(g.photos as Item[]).map((p) => {
                const j = jobOf(p.job_id);
                const at = photoWhere(p, j.plan, roomsOf.get(j.job.id)!);
                const label = pick ? at ?? "No room" : [j.job.name, at].filter(Boolean).join(" · ");
                return (
                  <button key={p.key} onClick={() => setOpen(p.key)} className="relative group text-left" title={[j.job.name, at, p.by.name, when(p.created_at)].filter(Boolean).join(" · ")}>
                    <img src={p.src} alt={at ? `Photo in ${at}, ${j.job.name}` : `Photo, ${j.job.name}`} loading="lazy" className="w-full aspect-square object-cover rounded-[3px] border border-line bg-ink group-hover:border-accent" />
                    <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 rounded-b-[3px] bg-gradient-to-t from-black/80 to-transparent text-[11px] leading-tight text-white truncate">{label}</span>
                    {p.client && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent ring-2 ring-black/40" title={`${j.job.client_name || "The client"} sees this`} />}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="px-4 sm:px-6 py-6 max-w-6xl w-full mx-auto">{children}</div>;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} aria-pressed={on} className={`chip !h-7 shrink-0 ${on ? "!text-accent !border-accent" : ""}`}>{children}</button>;
}

type Rooms = ReturnType<typeof roomOptions>;

/** Tags for new photos: the job (the one picked, if any), its room, and the stage the job is on. */
function AddPhotos({ files, jobs, start, roomsOf, onSave, onCancel }: {
  files: File[]; jobs: PhotoJob[]; start: string; roomsOf: Map<string, Rooms>;
  onSave: (jobId: string, input: JobPhotoInput) => Promise<void>; onCancel: () => void;
}) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const [jobId, setJobId] = useState(start);
  const j = jobs.find((x) => x.job.id === jobId) ?? jobs[0];
  const rooms = roomsOf.get(j.job.id) ?? [];
  const [room, setRoom] = useState("");
  const [stage, setStage] = useState(activeStage(j) ?? "");
  const [caption, setCaption] = useState("");
  const [client, setClient] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pickJob = (id: string) => { const n = jobs.find((x) => x.job.id === id)!; setJobId(id); setRoom(""); setStage(activeStage(n) ?? ""); setClient(false); };
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await onSave(j.job.id, { room_id: room || null, element_id: null, floor_id: rooms.find((r) => r.id === room)?.floor_id ?? null, stage_id: stage || null, caption: caption.trim() || null, client });
    } catch (x) { setErr(x instanceof Error ? x.message : "Couldn't add the photos."); setBusy(false); }
  };
  const clientName = j.job.client_name;
  return (
    <div className="space-y-3 max-w-xl">
      <p className="eyebrow">Add {files.length === 1 ? "a photo" : `${files.length} photos`}</p>
      <div className="grid grid-cols-4 gap-1.5">{urls.map((u) => <img key={u} src={u} alt="" className="w-full aspect-square object-cover rounded-[3px] border border-line" />)}</div>
      {jobs.length > 1 && (
        <div>
          <label className="label" htmlFor="ph-job">Job</label>
          <select id="ph-job" className="input" value={j.job.id} onChange={(e) => pickJob(e.target.value)}>
            {jobs.map((x) => <option key={x.job.id} value={x.job.id}>{x.job.name}{x.job.address ? ` · ${x.job.address}` : ""}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="ph-room">Room</label>
        <select id="ph-room" className="input" value={room} onChange={(e) => setRoom(e.target.value)} disabled={!rooms.length}>
          <option value="">{rooms.length ? "No room (the whole job, outside)" : "This job has no plan yet"}</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}{rooms.some((x) => x.floor_id !== r.floor_id) ? ` · ${r.floor}` : ""}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ph-stage">Stage</label>
        <select id="ph-stage" className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">No stage</option>
          {j.stages.map((s) => <option key={s.id} value={s.id}>{s.name}{s.id === activeStage(j) ? " (now)" : ""}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ph-caption">Note</label>
        <input id="ph-caption" className="input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Optional, e.g. Before drywall, wiring in the north wall" />
      </div>
      {clientName && (
        <label className="flex items-start gap-2 text-[13.5px] cursor-pointer">
          <input type="checkbox" checked={client} onChange={(e) => setClient(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--accent)]" />
          <span>Show {files.length === 1 ? "it" : "them"} to {clientName} <span className="text-muted">(on their page; left off, only your team sees {files.length === 1 ? "it" : "them"})</span></span>
        </label>
      )}
      {err && <p className="text-red text-[13px]">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" disabled={busy} onClick={() => void save()}>{busy ? "Adding…" : files.length === 1 ? "Add photo" : `Add ${files.length} photos`}</button>
        <button className="btn" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/** One photo, big: where, the stage, who and when, and the way to its spot on the map. Photos added here
 *  can be retagged, shown to the client or removed; the others belong to their pin or message. */
function PhotoDetail({ p, job: j, rooms, onBack, onShowSpot, onUpdate, onRemove }: {
  p: PhotoItem; job: PhotoJob; rooms: Rooms;
  onBack: () => void; onShowSpot: () => void;
  onUpdate: (patch: Partial<JobPhoto>) => Promise<void>; onRemove: () => Promise<void>;
}) {
  const { plan, stages } = j;
  const clientName = j.job.client_name;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const at = photoWhere(p, plan, rooms);
  const stage = stages.find((s) => s.id === p.stage_id)?.name;
  const canMap = !!(plan && (p.room_id || p.element_id || p.pin));
  const run = async (f: () => Promise<void>) => { setBusy(true); setErr(null); try { await f(); } catch (x) { setErr(x instanceof Error ? x.message : "That didn't save."); } finally { setBusy(false); } };
  const own = p.source === "upload";
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-[13px] text-muted hover:text-text">← All photos</button>
      <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
      <a href={p.src} target="_blank" rel="noreferrer noopener" title="Open full size"><img src={p.src} alt={at ? `Photo in ${at}` : "Photo"} className="w-full max-h-[70vh] object-contain rounded-[3px] border border-line bg-ink" /></a>
      <div className="space-y-3 min-w-0">
      {p.caption && <p className="text-[14px] whitespace-pre-wrap">{p.caption}</p>}
      <div className="flex items-center gap-2.5">
        <Avatar m={{ full_name: p.by.name }} size={28} />
        <p className="text-[13.5px] min-w-0"><span className="font-semibold">{p.by.name}</span> <span className="text-muted">· {KIND[p.by.kind]} · {when(p.created_at)}</span></p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13.5px]">
        <dt className="text-muted">Job</dt><dd>{j.job.name}</dd>
        <dt className="text-muted">Where</dt><dd>{at ?? "No room"}</dd>
        <dt className="text-muted">Stage</dt><dd>{stage ?? "None"}</dd>
        <dt className="text-muted">From</dt><dd>{p.pin ? <button className="underline text-left" onClick={onShowSpot}>Pin #{p.pin.number}: {p.pin.title}</button> : SOURCE[p.source]}</dd>
        {clientName && <><dt className="text-muted">Client</dt><dd>{p.client ? `${clientName} sees it` : "Team only"}</dd></>}
      </dl>
      <div className="flex flex-wrap gap-2">
        {canMap ? <button className="btn btn-primary btn-sm" onClick={onShowSpot}>{p.pin ? `Open pin #${p.pin.number} on the map` : "Show on the map"}</button>
          : <button className="btn btn-sm" onClick={onShowSpot}>Open the job</button>}
      </div>
      {own && (
        <div className="border-t border-line pt-3 space-y-2">
          <p className="eyebrow !text-[11px]">Tags</p>
          <div className="grid grid-cols-2 gap-1.5">
            <select className="input !h-9 !text-[13px]" aria-label="Room" disabled={busy} value={p.room_id ?? ""}
              onChange={(e) => void run(() => onUpdate({ room_id: e.target.value || null, element_id: null, floor_id: rooms.find((r) => r.id === e.target.value)?.floor_id ?? null }))}>
              <option value="">No room</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <select className="input !h-9 !text-[13px]" aria-label="Stage" disabled={busy} value={p.stage_id ?? ""} onChange={(e) => void run(() => onUpdate({ stage_id: e.target.value || null }))}>
              <option value="">No stage</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {clientName && p.by.kind !== "client" && (
            <label className="flex items-center gap-2 text-[13.5px] cursor-pointer">
              <input type="checkbox" disabled={busy} checked={p.client} onChange={(e) => void run(() => onUpdate({ client: e.target.checked }))} className="w-4 h-4 accent-[var(--accent)]" />
              Show to {clientName}
            </label>
          )}
          {sure ? (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="flex-1">Remove this photo for everyone?</span>
              <button className="btn btn-sm !text-red" disabled={busy} onClick={() => void run(onRemove)}>Remove</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSure(false)}>Keep</button>
            </div>
          ) : <button className="text-[12.5px] text-muted hover:text-red underline" onClick={() => setSure(true)}>Remove photo</button>}
        </div>
      )}
      {!own && <p className="text-[12px] text-muted">{p.source === "pin" ? "Posted on the pin's thread; it's tagged with the pin's spot." : "Sent in the client thread; it's tagged with the place named in the message."}</p>}
      {err && <p className="text-red text-[13px]">{err}</p>}
      </div>
      </div>
    </div>
  );
}
