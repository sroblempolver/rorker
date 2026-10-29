"use client";
// What the contractor's client (the homeowner) opens from their link. No sign-in, no task list, no costs.
// Three tabs: their project (how far along it is, the 3D/2D plan with what the contractor wants them to
// look at, their shopping list, their own notes and the photos from the job), one message thread with
// the contractor, and their money page (quotes, change orders, invoices). Notes they drop on the map are
// theirs alone, unless the contractor lets them share notes, then they can tick "share".
import { useMemo, useRef, useState } from "react";
import type { Billing } from "@/lib/billing/types";
import type { ClientView } from "@/lib/cloud/links";
import { clientMemberId, type ClientNoteInput, type JobPhotoInput, type Member, type Pin, type SharedMaterial } from "@/lib/data/types";
import { byDay, filterPhotos, photoWhere, roomOptions, type PhotoItem, type RoomOption } from "@/lib/photos";
import type { Plan } from "@/lib/plan/types";
import { STATUS_COLOR, STATUS_LABEL, qtyText, type Unit } from "@/lib/materials/types";
import type { ElementStatus } from "@/lib/plan/types";
import { applyEdits } from "@/lib/plan/edits";
import { jobSettings } from "@/lib/plan/build";
import { PlanViewer, type Level } from "@/components/plan/PlanViewer";
import type { ColorMode } from "@/components/plan/FloorCanvas";
import type { PinTarget } from "@/components/plan/target";
import { pinLevel } from "@/components/plan/pinLevel";
import { PIN_LABEL } from "@/components/plan/style";
import { TeamContext } from "@/components/team/context";
import { PinBadge, PinRow, where } from "@/components/workspace/PinsPanel";
import { ClientThread, type ThreadApi } from "@/components/workspace/ClientThread";
import { markFor, placeOptions, type PlaceTag } from "@/lib/plan/places";
import { MARK_COLORS, showMarks } from "@/lib/plan/marks";
import { markSeen, unread } from "@/lib/seen";
import { useFollowMarks } from "@/components/workspace/useFollowMarks";
import { ClientMoneyView } from "@/components/billing/ClientMoneyView";
import type { ClientStart } from "@/components/billing/MoneyPanel";

const nothing = () => {};

export interface ClientApi {
  thread: ThreadApi;
  /** a change on the money page (sign, decline, pick, pay); the server takes only what a client may change */
  billing(b: Billing): void;
  /** a note on the map; shared ones the contractor sees (only when the job allows it) */
  addNote(n: ClientNoteInput): Promise<Pin>;
  removeNote(id: string): Promise<void>;
  /** tick a line on their shopping list (undo puts it back) */
  got(id: string, undo: boolean): Promise<void>;
  /** add a photo to the job's Photos, tagged with a room; returns the photos they see now */
  addPhoto?(file: File, input: Partial<JobPhotoInput>): Promise<PhotoItem[]>;
}

type Tab = "job" | "messages" | "money";

export function ClientPage({ view: v, api, start, pin: firstPin, error, onBack, seenKey }: {
  view: ClientView; api: ClientApi; /** open the money page on this */ start?: ClientStart; /** open on this pin */ pin?: string | null;
  error?: string | null; onBack?: () => void;
  /** remembers what they've read, for the "new from your contractor" notice */ seenKey: string;
}) {
  const [tab, setTab] = useState<Tab>(start ? "money" : "job");
  const plan = useMemo(() => (v.view?.plan ? applyEdits(v.view.plan, v.view.edits) : null), [v.view]);
  const places = useMemo(() => (plan ? placeOptions(plan) : []), [plan]);
  const [fresh, setFresh] = useState(() => unread(v.messages, "client", seenKey));
  /** a tag in a message: back to the plan, which goes to that floor, and the spot blinks */
  const showPlace = (t: PlaceTag) => {
    const m = plan ? markFor(plan, t.id, t.label, MARK_COLORS[0][1]) : null;
    if (!m) return;
    setTab("job");
    setTimeout(() => showMarks([m], null, true), 50);
  };
  const done = v.stages.filter((s) => s.status === "done").length;
  const now = v.stages.find((s) => s.status === "active");
  const color = v.company.brand_color;
  const tabBtn = (t: Tab, label: string) => (
    <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
      className={`px-3 h-11 font-display text-[13.5px] font-bold tracking-[0.08em] uppercase border-b-[3px] ${tab === t ? "text-text" : "border-transparent text-muted hover:text-text"}`}
      style={tab === t ? { borderColor: color } : undefined}>{label}</button>
  );
  return (
    <div className="h-full flex flex-col min-h-0">
      <header className="shrink-0 border-b border-line bg-panel px-4 pt-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {v.company.logo_url ? <img src={v.company.logo_url} alt="" className="h-8 w-auto max-w-[120px] object-contain" /> : <span className="w-8 h-8 rounded-[3px] grid place-items-center font-display font-extrabold text-accent-ink" style={{ background: color }}>{v.company.name.slice(0, 1)}</span>}
          <div className="min-w-0 flex-1">
            <h1 className="font-stencil text-[20px] font-extrabold uppercase leading-none truncate">{v.job.name}</h1>
            <p className="text-[12.5px] text-muted truncate">{[v.job.address, `with ${v.company.name}`].filter(Boolean).join(" · ")}</p>
          </div>
          {v.company.phone && <a href={`tel:${v.company.phone}`} className="btn btn-ghost btn-sm">Call {v.company.phone}</a>}
          {onBack && <button onClick={onBack} className="btn btn-ghost btn-sm">Back to the app</button>}
        </div>
        {v.stages.length > 0 && (
          <div className="mt-2">
            <p className="text-[13.5px]">{now ? `Now: ${now.name}` : done === v.stages.length ? "Finished" : "Not started yet"} <span className="text-muted">· {done} of {v.stages.length} stages done</span></p>
            <div className="mt-1.5 flex gap-1" aria-hidden>{v.stages.map((s, i) => <span key={i} title={s.name} className="h-1.5 flex-1 rounded-full" style={{ background: s.status === "done" ? color : s.status === "active" ? `${color}88` : "rgb(255 255 255 / 0.12)" }} />)}</div>
          </div>
        )}
        <nav className="flex gap-1 mt-1" role="tablist">{tabBtn("job", "Your project")}{tabBtn("messages", fresh.length ? `Messages (${fresh.length})` : "Messages")}{tabBtn("money", "Money")}</nav>
      </header>
      {error && <p className="shrink-0 px-4 py-2 text-[14px] text-red border-b border-line">{error}</p>}
      {fresh.length > 0 && tab !== "messages" && (() => {
        const m = fresh[fresh.length - 1];
        const t = m.places?.[0];
        return (
          <div role="status" className="shrink-0 border-b border-line bg-panel-2 px-4 py-2.5 flex items-start gap-3">
            <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
            <p className="flex-1 min-w-0 text-[13.5px]">
              <span className="font-semibold">{fresh.length > 1 ? `${fresh.length} new messages from ${v.company.name}` : `New from ${v.company.name}`}</span>
              {t ? <> · about <span className="font-semibold">{t.label}</span></> : null}
              <span className="block text-muted truncate">{m.body?.replace(/@(?=\S)/g, "") ?? "A photo"}</span>
            </p>
            {t && <button className="btn btn-sm shrink-0" onClick={() => showPlace(t)}>Show me</button>}
            <button className="btn btn-sm btn-primary shrink-0" onClick={() => setTab("messages")}>Read</button>
          </div>
        );
      })()}
      <div className="flex-1 min-h-0 flex flex-col">
        {tab === "job" ? <ClientJob v={v} api={api} firstPin={firstPin ?? null} onMessages={() => setTab("messages")} />
          : tab === "messages" ? (
            <div className="flex-1 min-h-0 w-full max-w-[760px] mx-auto p-4 flex flex-col">
              <ClientThread api={api.thread} initial={v.messages} side="client" tone="app" other={v.company.name} color={color} places={places} onPlace={showPlace}
                onSeen={(l) => { markSeen(seenKey, l); setFresh([]); }} />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto bg-neutral-100">
              <ClientMoneyView billing={v.billing} brand={v.brand} job={v.job} start={start ?? null} onChange={api.billing} />
            </div>
          )}
      </div>
    </div>
  );
}

function ClientJob({ v, api, firstPin, onMessages }: { v: ClientView; api: ClientApi; firstPin: string | null; onMessages: () => void }) {
  const given = v.view;
  const me = clientMemberId(v.job.id);
  const [shared, setShared] = useState<Pin[]>(given?.pins ?? []);
  const [notes, setNotes] = useState<Pin[]>(v.notes);
  const [mats, setMats] = useState<SharedMaterial[]>(given?.materials ?? []);
  const plan = useMemo(() => (given?.plan ? applyEdits(given.plan, given.edits) : null), [given]);
  const pins = useMemo(() => [...shared, ...notes], [shared, notes]);
  const startPin = pins.find((p) => p.id === firstPin) ?? null;
  const [level, setLevel] = useState<Level>(() => (startPin && plan ? pinLevel(plan, startPin) : null) ?? { kind: "site" });
  const [pinId, setPinId] = useState<string | null>(startPin?.id ?? null);
  // a tag tapped in their messages: go to the floor it's on (the dot blinks there)
  useFollowMarks(plan, level, setLevel, nothing);
  const [colorMode, setColorMode] = useState<ColorMode>("type");
  const [view3d, setView3d] = useState(true);
  const [pinMode, setPinMode] = useState(false);
  const [draft, setDraft] = useState<PinTarget | null>(null);
  const [form, setForm] = useState({ title: "", body: "", shared: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const states = useMemo(() => new Map<string, ElementStatus>(), []);
  const team = useMemo(() => ({ me, members: [
    ...(given?.people ?? []).map((p): Member => ({ ...p, user_id: null, email: null, phone: null, role: "employee", is_owner: false })),
    { id: me, full_name: "You", title: null, user_id: null, email: null, phone: null, role: "employee" as const, is_owner: false, client: true },
  ] }), [given, me]);

  const lookAt = shared.filter((p) => p.created_by !== "client").sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.number - b.number);
  const mine = [...notes, ...shared.filter((p) => p.created_by === "client")];
  const toBuy = mats.filter((m) => m.you_get);
  const photos = [...Object.values(given?.photos ?? {}).flat(), ...v.messages.flatMap((m) => m.photos)];
  const [jobPhotos, setJobPhotos] = useState(v.photos);
  /** a photo's spot: its pin, or a blinking dot on its room or thing */
  const showPhoto = (p: PhotoItem) => {
    if (p.pin && pins.some((x) => x.id === p.pin!.id)) return show(p.pin.id);
    const id = p.element_id ?? p.room_id;
    const m = id && plan ? markFor(plan, id, photoWhere(p, plan, roomOptions(plan)) ?? "Here", MARK_COLORS[0][1]) : null;
    if (m) { setPinId(null); showMarks([m], null, true); }
  };
  const pin = pins.find((p) => p.id === pinId) ?? null;
  const ownNote = !!pin && pin.created_by === "client";
  const isPrivate = !!pin && notes.some((n) => n.id === pin.id);

  const show = (id: string) => {
    setPinId(id);
    setDraft(null);
    const p = pins.find((x) => x.id === id);
    const to = p && plan ? pinLevel(plan, p) : null;
    if (to) setLevel(to);
  };
  const place = (t: PinTarget) => { setPinMode(false); setPinId(null); setDraft(t); setForm({ title: "", body: "", shared: false }); setErr(null); };
  const save = async () => {
    if (!draft || !form.title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const n = await api.addNote({ title: form.title.trim(), body: form.body.trim() || null, floor_id: draft.floorId, x: draft.x, y: draft.y, element_id: draft.elementId, anchor: draft.anchor, shared: form.shared && v.can_add });
      if (form.shared && v.can_add) setShared((l) => [...l, n]); else setNotes((l) => [...l, n]);
      setDraft(null);
      setPinId(n.id);
    } catch (x) { setErr(x instanceof Error ? x.message : "That note didn't save."); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setErr(null);
    try { await api.removeNote(id); setNotes((l) => l.filter((n) => n.id !== id)); setShared((l) => l.filter((n) => n.id !== id)); setPinId(null); } catch (x) { setErr(x instanceof Error ? x.message : "Couldn't remove it."); }
  };
  const tick = async (m: SharedMaterial) => {
    const undo = m.status === "got";
    setMats((l) => l.map((x) => (x.id === m.id ? { ...x, status: undo ? "to_buy" : "got" } : x)));
    try { await api.got(m.id, undo); } catch (x) { setMats((l) => l.map((y) => (y.id === m.id ? m : y))); setErr(x instanceof Error ? x.message : "That didn't save."); }
  };

  return (
    <TeamContext.Provider value={team}>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        <div className="relative h-[52vh] shrink-0 lg:shrink lg:h-auto lg:flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-line">
          {plan ? (
            <>
              <PlanViewer plan={plan} level={level} setLevel={setLevel} selected={null} onSelect={nothing} selectedPin={pinId} onSelectPin={show}
                states={states} pins={pins} colorMode={colorMode} setColorMode={setColorMode} pinMode={pinMode} setPinMode={setPinMode} onPlacePin={place} draft={draft}
                flyTo={null} onAllJobs={nothing} jobName={v.job.name} items={given?.items ?? []} selectedItem={null} onSelectItem={nothing} onMoveItem={nothing}
                onMovePin={nothing} onMoveFixture={nothing} view3d={view3d} setView3d={setView3d} can3d readOnly
                furnish={jobSettings(given?.edits ?? {}).furnish ?? "all"} />
              <button onClick={() => { setPinMode(!pinMode); setDraft(null); }} aria-pressed={pinMode}
                className={`absolute right-3 bottom-3 z-10 h-10 px-3 rounded-[4px] border font-display font-bold tracking-[0.08em] uppercase text-[13px] ${pinMode ? "bg-accent border-accent text-accent-ink" : "bg-panel/90 border-line text-text"}`}>
                {pinMode ? "Cancel" : "+ Add a note"}
              </button>
            </>
          ) : <div className="h-full grid place-items-center text-muted p-6 text-center">The plan for your project isn&apos;t ready yet. Your messages and money are in the tabs above.</div>}
        </div>
        <aside className="lg:w-[380px] shrink-0 flex flex-col min-h-0 bg-panel">
          <div className="flex-1 min-h-0 lg:overflow-y-auto scroll-thin p-4 space-y-4">
            {err && <p className="text-red text-[13px]">{err}</p>}
            {pinMode && <p className="chip !text-accent !border-accent">Tap the spot on the plan for your note</p>}
            {draft ? (
              <div className="space-y-2.5">
                <p className="eyebrow">New note</p>
                <input className="input" autoFocus placeholder="What is it? (e.g. Outlet here, not there)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <textarea className="input !h-auto min-h-[80px] py-2" placeholder="More detail (optional)" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                {v.can_add ? (
                  <label className="flex items-start gap-2 text-[13.5px] cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })} />
                    <span>Share with {v.company.name} <span className="text-muted">(left off, only you see it)</span></span>
                  </label>
                ) : <p className="text-[12.5px] text-muted">Only you see your notes. To tell {v.company.name} something, <button className="underline" onClick={onMessages}>send a message</button>.</p>}
                <div className="flex gap-2">
                  <button className="btn btn-primary flex-1" disabled={busy || !form.title.trim()} onClick={() => void save()}>{busy ? "Saving…" : "Save note"}</button>
                  <button className="btn" onClick={() => setDraft(null)}>Cancel</button>
                </div>
              </div>
            ) : pin ? (
              <div className="space-y-3">
                <button onClick={() => setPinId(null)} className="text-[13px] text-muted hover:text-text">← Back</button>
                <div className="flex items-start gap-3">
                  <PinBadge pin={pin} size={30} />
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold leading-snug">{pin.title}</h2>
                    <p className="text-[13px] text-muted">{ownNote ? (isPrivate ? "Your note · only you see it" : `Your note · shared with ${v.company.name}`) : `${PIN_LABEL[pin.kind]} from ${v.company.name}${pin.status === "done" ? " · done" : ""}`}</p>
                  </div>
                </div>
                <p className="text-[13.5px]"><span className="eyebrow !text-[11px] block">Where</span>{where(plan, pin)}</p>
                {pin.body && <p className="text-[14px] whitespace-pre-wrap leading-relaxed">{pin.body}</p>}
                {pin.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="block text-[14px] text-accent underline truncate">{l.title || l.url}</a>)}
                {!!given?.photos[pin.id]?.length && <Photos list={given.photos[pin.id]} />}
                {mats.some((m) => m.task_id === pin.id) && <Shopping title="Goes with this" list={mats.filter((m) => m.task_id === pin.id)} tick={tick} />}
                {ownNote ? <button className="btn btn-sm" onClick={() => void remove(pin.id)}>Remove my note</button>
                  : <button className="btn btn-sm" onClick={onMessages}>Ask {v.company.name} about this</button>}
              </div>
            ) : (
              <>
                <section className="space-y-1.5">
                  <p className="eyebrow">For you to look at</p>
                  {lookAt.length ? lookAt.map((p) => <PinRow key={p.id} pin={p} plan={plan} onClick={() => show(p.id)} />)
                    : <p className="text-[13px] text-muted">Nothing right now. When {v.company.name} wants you to see or decide something, it shows up here and on the plan.</p>}
                </section>
                {toBuy.length > 0 && <Shopping title="Your shopping list" list={toBuy} tick={tick} />}
                <section className="space-y-1.5">
                  <p className="eyebrow">Your notes</p>
                  {mine.length ? mine.map((p) => <PinRow key={p.id} pin={p} plan={plan} onClick={() => show(p.id)} />)
                    : <p className="text-[13px] text-muted">{plan ? "Tap + Add a note on the plan to keep your own notes on the house" : "Notes on the plan open up once the plan is ready"}{v.can_add ? `, and share the ones ${v.company.name} should see.` : ". Only you see them."}</p>}
                </section>
                {jobPhotos ? <ClientPhotos list={jobPhotos} plan={plan} add={api.addPhoto && (async (f, input) => setJobPhotos(await api.addPhoto!(f, input)))} onShow={showPhoto} />
                  : photos.length > 0 && <section className="space-y-1.5"><p className="eyebrow">Photos from the job</p><Photos list={photos} /></section>}
              </>
            )}
          </div>
          <p className="shrink-0 border-t border-line px-4 py-2 text-[11.5px] text-muted">Shared by {v.company.name} with Rorker. Only you have this link.</p>
        </aside>
      </div>
    </TeamContext.Provider>
  );
}

/** The job's photos the client sees, by room, and a button to add their own (tagged with a room). */
function ClientPhotos({ list, plan, add, onShow }: { list: PhotoItem[]; plan: Plan | null; add?: (f: File, input: Partial<JobPhotoInput>) => Promise<void>; onShow: (p: PhotoItem) => void }) {
  const rooms = useMemo(() => roomOptions(plan), [plan]);
  const [room, setRoom] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [tag, setTag] = useState({ room: "", caption: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const used = rooms.filter((r) => list.some((p) => p.room_id === r.id));
  const shown = filterPhotos(list, { room });
  const item = list.find((p) => p.key === open);
  const send = async () => {
    if (!file || !add) return;
    setBusy(true); setErr(null);
    try { await add(file, { room_id: tag.room || null, caption: tag.caption.trim() || null }); setFile(null); setTag({ room: "", caption: "" }); }
    catch (x) { setErr(x instanceof Error ? x.message : "Couldn't send the photo."); } finally { setBusy(false); }
  };
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="eyebrow flex-1">Photos</p>
        {add && !file && <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>+ Add a photo</button>}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Add a photo" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setFile(f); setErr(null); } }} />
      </div>
      {file && (
        <div className="card !rounded-[3px] p-2.5 space-y-2">
          <p className="text-[13px] truncate">{file.name}</p>
          <select className="input" aria-label="Which room" value={tag.room} onChange={(e) => setTag({ ...tag, room: e.target.value })}>
            <option value="">Which room? (optional)</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <input className="input" placeholder="A note (optional)" value={tag.caption} onChange={(e) => setTag({ ...tag, caption: e.target.value })} />
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm flex-1" disabled={busy} onClick={() => void send()}>{busy ? "Sending…" : "Send photo"}</button>
            <button className="btn btn-sm" disabled={busy} onClick={() => setFile(null)}>Cancel</button>
          </div>
        </div>
      )}
      {err && <p className="text-red text-[13px]">{err}</p>}
      {item ? (
        <div className="space-y-2">
          <button onClick={() => setOpen(null)} className="text-[13px] text-muted hover:text-text">← All photos</button>
          <a href={item.src} target="_blank" rel="noreferrer noopener"><img src={item.src} alt="" className="w-full max-h-[50vh] object-contain rounded-[3px] border border-line bg-ink" /></a>
          {item.caption && <p className="text-[14px] whitespace-pre-wrap">{item.caption}</p>}
          <p className="text-[13px] text-muted">{[photoWhere(item, plan, rooms) ?? "No room", item.by.name, new Date(item.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })].join(" · ")}</p>
          {plan && (item.room_id || item.element_id || item.pin) && <button className="btn btn-sm" onClick={() => onShow(item)}>Show on the plan</button>}
        </div>
      ) : (
        <>
          {used.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1">
              <button className={`chip !h-7 shrink-0 ${!room ? "!text-accent !border-accent" : ""}`} onClick={() => setRoom(null)}>All</button>
              {used.map((r: RoomOption) => <button key={r.id} className={`chip !h-7 shrink-0 ${room === r.id ? "!text-accent !border-accent" : ""}`} onClick={() => setRoom(room === r.id ? null : r.id)}>{r.label}</button>)}
            </div>
          )}
          {!list.length && <p className="text-[13px] text-muted">No photos yet.{add ? " Add one of anything you want them to see, and pick the room." : ""}</p>}
          {byDay(shown).map((g) => (
            <div key={g.day} className="space-y-1">
              <p className="text-[11.5px] text-muted">{g.label}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {g.photos.map((p) => (
                  <button key={p.key} onClick={() => setOpen(p.key)} className="relative text-left">
                    <img src={p.src} alt="" loading="lazy" className="w-full aspect-square object-cover rounded-[3px] border border-line" />
                    <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 rounded-b-[3px] bg-gradient-to-t from-black/80 to-transparent text-[11px] text-white truncate">{photoWhere(p, plan, rooms) ?? ""}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function Photos({ list }: { list: string[] }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {list.map((src) => <a key={src} href={src} target="_blank" rel="noreferrer noopener"><img src={src} alt="" className="w-full aspect-square object-cover rounded-[3px] border border-line" /></a>)}
    </div>
  );
}

/** Their shopping list: what to get, and a tick when they have it. */
function Shopping({ title, list, tick }: { title: string; list: SharedMaterial[]; tick: (m: SharedMaterial) => void }) {
  return (
    <section className="space-y-1.5">
      <p className="eyebrow">{title}</p>
      {list.map((m) => (
        <div key={m.id} className="card !rounded-[3px] px-2.5 py-2 flex items-center gap-2.5">
          <span className="min-w-0 flex-1">
            <span className={`block text-[14px] truncate ${m.status === "got" ? "line-through text-muted" : ""}`}><span className="font-mono text-[13px] font-semibold mr-1.5">{qtyText(m.qty, m.unit as Unit)}</span>{m.name}</span>
            <span className="block text-[12px] text-muted truncate">{[m.task, m.store && `at ${m.store}`, m.needed_by && `needed ${m.needed_by.slice(5)}`, m.note].filter(Boolean).join(" · ") || (m.you_get ? "For you to get" : m.buyer ? `${m.buyer} is getting it` : "")}</span>
          </span>
          {m.you_get && (m.status === "to_buy" || m.status === "got") ? (
            <button className={`btn btn-sm shrink-0 ${m.status === "got" ? "" : "btn-primary"}`} onClick={() => tick(m)}>{m.status === "got" ? "Undo" : "Got it"}</button>
          ) : <span className="chip !h-[22px] !px-1.5 !text-[11.5px] !text-text shrink-0"><span className="w-2 h-2 rounded-[1px]" style={{ background: STATUS_COLOR[m.status] }} />{STATUS_LABEL[m.status]}</span>}
        </div>
      ))}
    </section>
  );
}
