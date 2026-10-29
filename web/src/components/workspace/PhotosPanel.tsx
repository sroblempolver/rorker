"use client";
// The job's Photos: every photo on the job in one place, newest first, grouped by day. Each one says
// which room it's in (and the thing in the room), the stage, who added it and when, and whether the
// client sees it. Filter by room, stage, person or where it came from (added here, on a pin, in the
// client thread). New photos are tagged with where you are on the map and the stage the job is on, so
// most need no typing. Tap one to see it big, and "Show on the map" takes the map to its spot.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Job, JobPhoto, JobPhotoInput, JobStage, Member, Pin } from "@/lib/data/types";
import { clientMemberId } from "@/lib/data/types";
import type { Plan } from "@/lib/plan/types";
import { byDay, filterPhotos, gatherPhotos, photoWhere, roomOptions, whoKey, type PhotoFilter, type PhotoItem, type PhotoSource } from "@/lib/photos";
import { Avatar } from "@/components/team/Avatar";
import type { PhotosApi } from "./api";

/** where you are on the map: the room you're in or the thing you picked */
export interface PhotoHere { room_id: string | null; element_id: string | null; floor_id: string | null; label: string | null }

const SOURCE: Record<PhotoSource, string> = { upload: "Added here", pin: "On a pin", message: "Client thread" };
const KIND: Record<PhotoItem["by"]["kind"], string> = { team: "Team", crew: "Crew", client: "Client" };
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function PhotosPanel({ api, job, plan, pins, stages, members, here, activeStage, onShowSpot, onShowPin, say }: {
  api: PhotosApi; job: Job; plan: Plan | null; pins: Pin[]; stages: JobStage[]; members: Member[];
  here: PhotoHere | null; activeStage: string | null;
  /** take the map to where the photo is */ onShowSpot: (p: PhotoItem) => void;
  onShowPin: (id: string) => void; say: (m: string) => void;
}) {
  const [data, setData] = useState<Awaited<ReturnType<PhotosApi["list"]>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<PhotoFilter>({});
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<File[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(() => api.list().then(setData, (e) => setErr(e instanceof Error ? e.message : "Couldn't load the photos.")), [api]);
  useEffect(() => { void load(); }, [load]);

  const rooms = useMemo(() => roomOptions(plan), [plan]);
  const names = useMemo(() => new Map(members.map((m) => [m.id, m.full_name])), [members]);
  const all = useMemo(() => (data ? gatherPhotos({ plan, pins, comments: data.comments, messages: data.messages, uploads: data.uploads, clientId: clientMemberId(job.id), names }) : []), [data, plan, pins, job.id, names]);
  const shown = useMemo(() => filterPhotos(all, filter), [all, filter]);
  const item = all.find((p) => p.key === open) ?? null;

  // the filters only offer what's there
  const roomCounts = useMemo(() => { const c = new Map<string, number>(); for (const p of all) c.set(p.room_id ?? "none", (c.get(p.room_id ?? "none") ?? 0) + 1); return c; }, [all]);
  const people = useMemo(() => [...new Map(all.map((p) => [whoKey(p.by), p.by])).entries()], [all]);
  const usedStages = stages.filter((s) => all.some((p) => p.stage_id === s.id));
  const hereRoom = here?.room_id && roomCounts.has(here.room_id) ? rooms.find((r) => r.id === here.room_id) : null;
  const filtered = !!(filter.room || filter.stage || filter.who || filter.source);

  if (adding) return <AddPhotos files={adding} rooms={rooms} stages={stages} here={here} activeStage={activeStage} clientName={job.client_name}
    onCancel={() => setAdding(null)}
    onSave={async (input) => {
      for (const f of adding) await api.add(f, input);
      setAdding(null);
      say(`${adding.length === 1 ? "Photo" : `${adding.length} photos`} added${input.room_id ? ` to ${rooms.find((r) => r.id === input.room_id)?.label}` : ""}`);
      await load();
    }} />;

  if (item) return <PhotoDetail p={item} plan={plan} rooms={rooms} stages={stages} clientName={job.client_name} onBack={() => setOpen(null)} onShowSpot={() => onShowSpot(item)} onShowPin={onShowPin}
    onUpdate={async (patch) => { await api.update(item.photo_id!, patch); await load(); }}
    onRemove={async () => { await api.remove(item.photo_id!); setOpen(null); say("Photo removed"); await load(); }} />;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="eyebrow">Photos</p>
          <p className="text-[13px] text-muted">{data ? `${all.length} on this job${filtered ? `, ${shown.length} shown` : ""}.` : "Loading…"} From you, the crew and {job.client_name || "the client"}, tagged by room.</p>
        </div>
        <button className="btn btn-primary btn-sm shrink-0" onClick={() => fileRef.current?.click()}>+ Add photos</button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" aria-label="Add photos"
          onChange={(e) => { const l = [...(e.target.files ?? [])]; e.target.value = ""; if (l.length) setAdding(l); }} />
      </div>
      {err && <p className="text-red text-[13px]">{err}</p>}

      {all.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1" role="group" aria-label="Room">
            <Chip on={!filter.room} onClick={() => setFilter({ ...filter, room: null })}>All rooms</Chip>
            {hereRoom && <Chip on={filter.room === hereRoom.id} onClick={() => setFilter({ ...filter, room: filter.room === hereRoom.id ? null : hereRoom.id })}>Here: {hereRoom.label}</Chip>}
            {rooms.filter((r) => roomCounts.has(r.id) && r.id !== hereRoom?.id).map((r) => (
              <Chip key={r.id} on={filter.room === r.id} onClick={() => setFilter({ ...filter, room: filter.room === r.id ? null : r.id })}>{r.label}<span className="font-mono text-[11px] opacity-70">{roomCounts.get(r.id)}</span></Chip>
            ))}
            {roomCounts.has("none") && <Chip on={filter.room === "none"} onClick={() => setFilter({ ...filter, room: filter.room === "none" ? null : "none" })}>No room<span className="font-mono text-[11px] opacity-70">{roomCounts.get("none")}</span></Chip>}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <select className="input !h-9 !text-[13px]" aria-label="Stage" value={filter.stage ?? ""} onChange={(e) => setFilter({ ...filter, stage: e.target.value || null })}>
              <option value="">Any stage</option>
              {usedStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              {all.some((p) => !p.stage_id) && <option value="none">No stage</option>}
            </select>
            <select className="input !h-9 !text-[13px]" aria-label="Who" value={filter.who ?? ""} onChange={(e) => setFilter({ ...filter, who: e.target.value || null })}>
              <option value="">Anyone</option>
              {(["team", "crew", "client"] as const).filter((k) => all.some((p) => p.by.kind === k)).map((k) => <option key={k} value={k}>All {KIND[k].toLowerCase()}</option>)}
              {people.map(([k, b]) => <option key={k} value={k}>{b.name}</option>)}
            </select>
            <select className="input !h-9 !text-[13px]" aria-label="From" value={filter.source ?? ""} onChange={(e) => setFilter({ ...filter, source: (e.target.value || null) as PhotoSource | null })}>
              <option value="">From anywhere</option>
              {(Object.keys(SOURCE) as PhotoSource[]).filter((s) => all.some((p) => p.source === s)).map((s) => <option key={s} value={s}>{SOURCE[s]}</option>)}
            </select>
          </div>
          {filtered && <button className="text-[12.5px] text-muted hover:text-text underline" onClick={() => setFilter({})}>Clear filters</button>}
        </div>
      )}

      {data && !all.length && (
        <div className="card !rounded-[3px] p-4 text-[13.5px] text-muted space-y-1">
          <p className="text-text font-semibold">No photos yet</p>
          <p>Add progress photos here. Pick a room on the map first and they&apos;re tagged with it. Photos the crew posts on their tasks and {job.client_name || "the client"} sends in messages show up here too.</p>
        </div>
      )}
      {data && all.length > 0 && !shown.length && <p className="text-[13px] text-muted">No photos match. <button className="underline" onClick={() => setFilter({})}>Show all</button></p>}

      {byDay(shown).map((g) => (
        <section key={g.day} className="space-y-1.5">
          <p className="eyebrow !text-[11px]">{g.label} <span className="text-muted font-mono">{g.photos.length}</span></p>
          <div className="grid grid-cols-3 gap-1.5">
            {g.photos.map((p) => {
              const at = photoWhere(p, plan, rooms);
              return (
                <button key={p.key} onClick={() => setOpen(p.key)} className="relative group text-left" title={[at, p.by.name, when(p.created_at)].filter(Boolean).join(" · ")}>
                  <img src={p.src} alt={at ? `Photo in ${at}` : "Photo"} loading="lazy" className="w-full aspect-square object-cover rounded-[3px] border border-line bg-ink group-hover:border-accent" />
                  <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 rounded-b-[3px] bg-gradient-to-t from-black/80 to-transparent text-[11px] leading-tight text-white truncate">{at ?? "No room"}</span>
                  {p.client && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent ring-2 ring-black/40" title={`${job.client_name || "The client"} sees this`} />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} aria-pressed={on} className={`chip !h-7 shrink-0 ${on ? "!text-accent !border-accent" : ""}`}>{children}</button>;
}

type Rooms = ReturnType<typeof roomOptions>;

/** Tags for new photos: the room you're in on the map and the job's stage, already picked. */
function AddPhotos({ files, rooms, stages, here, activeStage, clientName, onSave, onCancel }: {
  files: File[]; rooms: Rooms; stages: JobStage[]; here: PhotoHere | null; activeStage: string | null; clientName: string | null;
  onSave: (input: JobPhotoInput) => Promise<void>; onCancel: () => void;
}) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const [room, setRoom] = useState(here?.room_id ?? "");
  const [onThing, setOnThing] = useState(!!here?.element_id);
  const [stage, setStage] = useState(activeStage ?? "");
  const [caption, setCaption] = useState("");
  const [client, setClient] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const thing = here?.element_id && here.room_id === room ? here.label : null;
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await onSave({ room_id: room || null, element_id: thing && onThing ? here!.element_id : null, floor_id: rooms.find((r) => r.id === room)?.floor_id ?? null, stage_id: stage || null, caption: caption.trim() || null, client });
    } catch (x) { setErr(x instanceof Error ? x.message : "Couldn't add the photos."); setBusy(false); }
  };
  return (
    <div className="p-4 space-y-3">
      <p className="eyebrow">Add {files.length === 1 ? "a photo" : `${files.length} photos`}</p>
      <div className="grid grid-cols-4 gap-1.5">{urls.map((u) => <img key={u} src={u} alt="" className="w-full aspect-square object-cover rounded-[3px] border border-line" />)}</div>
      <div>
        <label className="label" htmlFor="ph-room">Room</label>
        <select id="ph-room" className="input" value={room} onChange={(e) => setRoom(e.target.value)}>
          <option value="">No room (the whole job, outside)</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}{rooms.some((x) => x.floor_id !== r.floor_id) ? ` · ${r.floor}` : ""}</option>)}
        </select>
        {here?.room_id && room === here.room_id && <p className="text-[12px] text-muted mt-1">From where you are on the map.</p>}
        {!here?.room_id && rooms.length > 0 && <p className="text-[12px] text-muted mt-1">Tip: pick a room or a thing on the map first and new photos are tagged with it.</p>}
      </div>
      {thing && (
        <label className="flex items-center gap-2 text-[13.5px] cursor-pointer">
          <input type="checkbox" checked={onThing} onChange={(e) => setOnThing(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
          Of the {thing}
        </label>
      )}
      <div>
        <label className="label" htmlFor="ph-stage">Stage</label>
        <select id="ph-stage" className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">No stage</option>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name}{s.id === activeStage ? " (now)" : ""}</option>)}
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
function PhotoDetail({ p, plan, rooms, stages, clientName, onBack, onShowSpot, onShowPin, onUpdate, onRemove }: {
  p: PhotoItem; plan: Plan | null; rooms: Rooms; stages: JobStage[]; clientName: string | null;
  onBack: () => void; onShowSpot: () => void; onShowPin: (id: string) => void;
  onUpdate: (patch: Partial<JobPhoto>) => Promise<void>; onRemove: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const at = photoWhere(p, plan, rooms);
  const stage = stages.find((s) => s.id === p.stage_id)?.name;
  const canMap = !!(plan && (p.room_id || p.element_id || p.pin));
  const run = async (f: () => Promise<void>) => { setBusy(true); setErr(null); try { await f(); } catch (x) { setErr(x instanceof Error ? x.message : "That didn't save."); } finally { setBusy(false); } };
  const own = p.source === "upload";
  return (
    <div className="p-4 space-y-3">
      <button onClick={onBack} className="text-[13px] text-muted hover:text-text">← All photos</button>
      <a href={p.src} target="_blank" rel="noreferrer noopener" title="Open full size"><img src={p.src} alt={at ? `Photo in ${at}` : "Photo"} className="w-full max-h-[52vh] object-contain rounded-[3px] border border-line bg-ink" /></a>
      {p.caption && <p className="text-[14px] whitespace-pre-wrap">{p.caption}</p>}
      <div className="flex items-center gap-2.5">
        <Avatar m={{ full_name: p.by.name }} size={28} />
        <p className="text-[13.5px] min-w-0"><span className="font-semibold">{p.by.name}</span> <span className="text-muted">· {KIND[p.by.kind]} · {when(p.created_at)}</span></p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13.5px]">
        <dt className="text-muted">Where</dt><dd>{at ?? "No room"}</dd>
        <dt className="text-muted">Stage</dt><dd>{stage ?? "None"}</dd>
        <dt className="text-muted">From</dt><dd>{p.pin ? <button className="underline text-left" onClick={() => onShowPin(p.pin!.id)}>Pin #{p.pin.number}: {p.pin.title}</button> : SOURCE[p.source]}</dd>
        {clientName && <><dt className="text-muted">Client</dt><dd>{p.client ? `${clientName} sees it` : "Team only"}</dd></>}
      </dl>
      <div className="flex flex-wrap gap-2">
        {canMap && <button className="btn btn-primary btn-sm" onClick={onShowSpot}>Show on the map</button>}
        {p.pin && <button className="btn btn-sm" onClick={() => onShowPin(p.pin!.id)}>Open pin #{p.pin.number}</button>}
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
  );
}
