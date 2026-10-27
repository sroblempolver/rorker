"use client";
// Pins: tasks, issues, notes and materials stuck to any element of the plan. A pin can need a photo
// before it closes, carry links (spec sheets, product pages) and a comment thread with photos.
import { useEffect, useRef, useState } from "react";
import { today } from "@/lib/dates";
import type { JobStage, Pin, PinComment, PinInput, PinKind, PinStatus } from "@/lib/data/types";
import { elementLabel, findElement, roomSides } from "@/lib/plan/geometry";
import type { Plan } from "@/lib/plan/types";
import { PIN_COLOR, PIN_LABEL, PIN_STATUS_LABEL } from "@/components/plan/style";
import type { PinTarget } from "@/components/plan/target";
import { AvatarStack, StaffPicker } from "@/components/team/Avatar";
import { useTeam } from "@/components/team/context";

const KINDS: PinKind[] = ["task", "issue", "note", "material"];

/** Wall side key "G-R04:2" -> "North wall, Kitchen". */
export function sideName(plan: Plan, key: string) {
  const roomId = key.split(":")[0];
  for (const f of plan.floors) {
    const r = f.rooms.find((x) => x.id === roomId);
    if (!r) continue;
    const s = roomSides(f, r).find((x) => x.key === key);
    return s ? `${s.label}, ${r.name}` : r.name;
  }
  return "A wall";
}

export function where(plan: Plan | null, t: { element_id?: string | null; elementId?: string | null; anchor?: Pin["anchor"] }) {
  const id = t.element_id ?? t.elementId ?? null;
  if (t.anchor?.view === "site") return "On the site";
  if (t.anchor?.view === "exterior") return "Outside, on the front";
  const e = plan && id ? findElement(plan, id) : null;
  if (t.anchor?.view === "point") return e ? `Outside · ${elementLabel(e)}` : "On the roof or outside";
  if (t.anchor?.view === "wall" && plan && t.anchor.side) return `${sideName(plan, t.anchor.side)}${e && e.kind === "fixture" ? ` · ${e.el.name}` : ""}`;
  if (!plan || !id) return "On the plan";
  return e ? `${elementLabel(e)} · ${e.floor.name}` : id;
}

/** The pin's survey flag as a little badge: kind colour, number, notched tail. */
export function PinBadge({ pin, size = 26 }: { pin: Pin; size?: number }) {
  const color = pin.status === "done" ? "#3fb46a" : PIN_COLOR[pin.kind];
  return (
    <span className="shrink-0 grid place-items-center font-mono font-bold text-[#120c06]"
      style={{ width: size * 1.15, height: size * 0.85, background: color, fontSize: size * 0.44, clipPath: "polygon(0 0, 100% 0, 84% 50%, 100% 100%, 0 100%)", paddingRight: size * 0.12 }}>
      {pin.status === "done" ? "✓" : pin.number}
    </span>
  );
}

export function PinRow({ pin, plan, onClick }: { pin: Pin; plan: Plan | null; onClick: () => void }) {
  const { members } = useTeam();
  const tagged = members.filter((m) => pin.tagged.includes(m.id));
  return (
    <button onClick={onClick} className="w-full text-left card !rounded-[3px] px-3 py-2 flex items-center gap-3 hover:border-chalk">
      <PinBadge pin={pin} />
      <span className="min-w-0 flex-1">
        <span className={`block text-[14px] truncate ${pin.status === "done" ? "line-through text-muted" : ""}`}>{pin.title}</span>
        <span className="block text-[12px] text-muted truncate">{PIN_LABEL[pin.kind]} · {where(plan, pin)}</span>
      </span>
      {pin.status === "in_progress" && <span className="chip text-amber shrink-0">In progress</span>}
      {(pin.comment_count ?? 0) > 0 && <span className="font-mono text-[11.5px] text-muted shrink-0">{pin.comment_count} upd</span>}
      <AvatarStack members={tagged} />
    </button>
  );
}

export function PinsList({ pins, plan, onSelect, onNew, initialFilter = "open" }: { pins: Pin[]; plan: Plan | null; onSelect: (id: string) => void; onNew: () => void; initialFilter?: "open" | PinKind }) {
  const { me } = useTeam();
  const [filter, setFilter] = useState<"open" | "mine" | "all" | PinKind>(initialFilter);
  const shown = pins
    .filter((p) => (filter === "open" ? p.status !== "done" : filter === "mine" ? p.status !== "done" && !!me && p.tagged.includes(me) : filter === "all" ? true : p.kind === filter))
    .sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0) || b.priority - a.priority || b.number - a.number);
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">Pins</h2>
        <span className="text-muted text-sm">{pins.filter((p) => p.status !== "done").length} open</span>
        <button className="btn btn-primary btn-sm ml-auto" onClick={onNew} disabled={!plan}>Drop a pin</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["open", ...(me ? ["mine" as const] : []), "all", ...KINDS] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? "!text-accent-ink !bg-accent !border-accent" : "hover:text-text"}`}>
            {f === "open" ? "Open" : f === "mine" ? "Tagged to me" : f === "all" ? "All" : PIN_LABEL[f] + "s"}
          </button>
        ))}
      </div>
      {shown.length ? <div className="space-y-1.5">{shown.map((p) => <PinRow key={p.id} pin={p} plan={plan} onClick={() => onSelect(p.id)} />)}</div>
        : <p className="text-muted text-sm py-6 text-center">{pins.length ? "Nothing here." : "No pins yet. Drop one anywhere: a room, a wall, a fixture, the site. Right-click or press and hold works too."}</p>}
    </div>
  );
}

export function PinForm({ plan, draft, preset, stages, onCancel, onCreate }: {
  plan: Plan | null; draft: PinTarget; preset?: { kind: PinKind; title: string; body?: string; tagged?: string[]; photo?: boolean }; stages: JobStage[];
  onCancel: () => void; onCreate: (input: PinInput) => Promise<void>;
}) {
  const [kind, setKind] = useState<PinKind>(preset?.kind ?? "task");
  const [title, setTitle] = useState(preset?.title ?? "");
  const [body, setBody] = useState(preset?.body ?? "");
  const [due, setDue] = useState(today); // one date it has to be done by, today unless changed
  const { members } = useTeam();
  const [tagged, setTagged] = useState<string[]>(preset?.tagged ?? []);
  const [photo, setPhoto] = useState(!!preset?.photo);
  const [stage, setStage] = useState(stages.find((s) => s.status === "active")?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titleRef.current?.focus(); titleRef.current?.select(); }, []);
  const e = plan && draft.elementId ? findElement(plan, draft.elementId) : null;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!title.trim()) return setErr("Give it a short title.");
    setBusy(true);
    try {
      await onCreate({
        kind, title, body: body || null, due_date: due || null, close_requirement: photo ? "photo" : "confirm", stage_id: stage || null, tagged,
        element_id: draft.elementId, floor_id: draft.floorId, x: draft.x, y: draft.y, anchor: draft.anchor, priority: kind === "issue" ? 2 : 1,
      });
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Could not save.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="p-4 space-y-4">
      <div>
        <p className="eyebrow">New pin</p>
        <h2 className="font-display text-[23px] font-extrabold uppercase leading-tight">{where(plan, draft)}</h2>
        {e && <p className="mt-1"><span className="tag">{e.el.id}</span></p>}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {KINDS.map((k) => (
          <button type="button" key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
            className={`h-9 rounded-[3px] border text-[13px] ${kind === k ? "border-transparent text-[#111] font-semibold" : "border-line bg-panel-2 hover:bg-panel-3"}`}
            style={kind === k ? { background: PIN_COLOR[k] } : undefined}>{PIN_LABEL[k]}</button>
        ))}
      </div>
      <div>
        <label className="label" htmlFor="pin-title">Title</label>
        <input id="pin-title" ref={titleRef} className="input" value={title} onChange={(x) => setTitle(x.target.value)} placeholder={kind === "issue" ? "Crack above the window" : kind === "material" ? "Tile: 60×60 matte grey" : "Install outlet, 450 mm up"} />
      </div>
      <div>
        <label className="label" htmlFor="pin-body">Details</label>
        <textarea id="pin-body" className="input" rows={3} value={body} onChange={(x) => setBody(x.target.value)} placeholder="Optional" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="pin-due">Due</label>
          <input id="pin-due" type="date" className="input" value={due} onChange={(x) => setDue(x.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pin-stage">Stage</label>
          <select id="pin-stage" className="input" value={stage} onChange={(x) => setStage(x.target.value)}>
            <option value="">None</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p className="label">Tag staff</p>
        <StaffPicker members={members} value={tagged} onChange={setTagged} />
      </div>
      <label className="flex items-center gap-2.5 text-[14px] cursor-pointer">
        <input type="checkbox" checked={photo} onChange={(x) => setPhoto(x.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
        Needs a photo before it can be closed (asks whoever is tagged for one)
      </label>
      {err && <p className="text-red text-sm">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" disabled={busy}>{busy ? "Saving…" : "Save pin"}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function PinDetail({ pin, plan, stages, onBack, onUpdate, onDelete, loadComments, addComment, onShow, linkFor, openLinkFor }: {
  pin: Pin; plan: Plan | null; stages: JobStage[]; onBack: () => void;
  onUpdate: (input: Partial<PinInput> & { status?: PinStatus }) => Promise<void>; onDelete: () => Promise<void>;
  loadComments: () => Promise<PinComment[]>; addComment: (body: string, photos: File[]) => Promise<PinComment[]>; onShow: () => void;
  /** a tagged person's own link (all their tasks, opening on this one), for admins */
  linkFor?: (memberId: string) => Promise<string>;
  /** the preview: open that link here, to see what they see */
  openLinkFor?: (memberId: string) => void;
}) {
  const [comments, setComments] = useState<PinComment[] | null>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { members } = useTeam();
  const [tagging, setTagging] = useState(false);
  const tagged = members.filter((m) => pin.tagged.includes(m.id));

  useEffect(() => {
    let live = true;
    setComments(null);
    loadComments().then((c) => live && setComments(c)).catch(() => live && setComments([]));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin.id]);

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    setBusy(true);
    try { await fn(); } catch (x) { setErr(x instanceof Error ? x.message : "Something went wrong."); }
    setBusy(false);
  };

  const stage = stages.find((s) => s.id === pin.stage_id);
  return (
    <div className="p-4 space-y-4">
      <button onClick={onBack} className="text-[13px] text-muted hover:text-text">‹ All pins</button>
      <div className="flex items-start gap-3">
        <PinBadge pin={pin} size={34} />
        <div className="min-w-0">
          <p className="eyebrow">{PIN_LABEL[pin.kind]} #{pin.number}</p>
          <h2 className="font-display text-[23px] font-extrabold leading-tight">{pin.title}</h2>
          <button onClick={onShow} className="text-[13px] text-chalk hover:underline">{where(plan, pin)} ›</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {(["open", "in_progress", "done"] as PinStatus[]).map((s) => (
          <button key={s} disabled={busy} onClick={() => run(() => onUpdate({ status: s }))} aria-pressed={pin.status === s}
            className={`h-9 rounded-[3px] border text-[13px] ${pin.status === s ? (s === "done" ? "bg-green text-[#0c1a12] border-transparent font-semibold" : s === "in_progress" ? "bg-amber text-[#1a1206] border-transparent font-semibold" : "bg-panel-3 border-muted") : "border-line bg-panel-2 hover:bg-panel-3"}`}>
            {PIN_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {pin.close_requirement === "photo" && pin.status !== "done" && <p className="text-[12.5px] text-amber">Needs a photo in the thread before it can be marked done.</p>}
      {err && <p className="text-red text-sm">{err}</p>}
      {pin.body && <p className="text-[14px] whitespace-pre-wrap leading-relaxed">{pin.body}</p>}
      <div className="flex flex-wrap gap-1.5">
        <label className="chip !pr-1 cursor-pointer" title="The date it has to be done by">Due
          <input type="date" aria-label="Due date" className="bg-transparent text-text text-[12.5px] outline-none [color-scheme:dark]" value={pin.due_date ?? ""}
            onChange={(ev) => run(() => onUpdate({ due_date: ev.target.value || null }))} />
        </label>
        {stage && <span className="chip">{stage.name}</span>}
        {pin.priority > 1 && <span className="chip text-red">High priority</span>}
      </div>

      <div>
        <div className="flex items-center mb-2">
          <p className="eyebrow">Tagged</p>
          <button className="ml-auto text-[13px] text-chalk hover:underline" onClick={() => setTagging(!tagging)}>{tagging ? "Done" : tagged.length ? "Change" : "Tag staff"}</button>
        </div>
        {tagging ? <StaffPicker members={members} value={pin.tagged} onChange={(ids) => run(() => onUpdate({ tagged: ids }))} />
          : tagged.length ? (
            <div className="space-y-1.5">
              {tagged.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="chip !pl-0.5 !h-7 min-w-0"><AvatarStack members={[m]} size={22} /><span className="text-text truncate">{m.full_name}</span>{m.title && <span className="truncate">· {m.title}</span>}</span>
                  {linkFor && <PersonLink key={m.id} name={m.full_name} get={() => linkFor(m.id)} open={openLinkFor && (() => openLinkFor(m.id))} />}
                </div>
              ))}
            </div>
          )
          : <p className="text-muted text-sm">Nobody tagged.</p>}
      </div>

      <div>
        <p className="eyebrow mb-2">Links</p>
        <div className="space-y-1">
          {pin.links.map((l, i) => (
            <div key={i} className="flex items-center gap-2 text-[14px]">
              <a href={l.url} target="_blank" rel="noreferrer" className="text-chalk hover:underline truncate">{l.title || l.url}</a>
              <button className="text-muted hover:text-red text-[12px] ml-auto" onClick={() => run(() => onUpdate({ links: pin.links.filter((_, j) => j !== i) }))}>Remove</button>
            </div>
          ))}
        </div>
        <form className="flex gap-1.5 mt-2" onSubmit={(ev) => {
          ev.preventDefault();
          if (!/^https?:\/\//.test(linkUrl)) return setErr("Links need to start with http:// or https://");
          run(async () => { await onUpdate({ links: [...pin.links, { title: linkTitle.trim(), url: linkUrl.trim() }] }); setLinkTitle(""); setLinkUrl(""); });
        }}>
          <input className="input !h-8 !text-[13px]" placeholder="Name" value={linkTitle} onChange={(x) => setLinkTitle(x.target.value)} />
          <input className="input !h-8 !text-[13px]" placeholder="https://" value={linkUrl} onChange={(x) => setLinkUrl(x.target.value)} />
          <button className="btn btn-sm" disabled={!linkUrl}>Add</button>
        </form>
      </div>

      <div>
        <p className="eyebrow mb-2">Thread</p>
        {comments === null ? <p className="text-muted text-sm">Loading…</p> : (
          <div className="space-y-2.5">
            {comments.map((c) => (
              <div key={c.id} className="card !rounded-[3px] p-3 border-l-2 !border-l-chalk">
                <p className="text-[12px] text-muted mb-1">{c.author_name ?? "Team"} · {new Date(c.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                {c.body && <p className="text-[14px] whitespace-pre-wrap">{c.body}</p>}
                {c.photos.length > 0 && <div className="grid grid-cols-3 gap-1.5 mt-2">{c.photos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="w-full aspect-square object-cover rounded-[2px] bg-ink" /></a>)}</div>}
              </div>
            ))}
            {!comments.length && <p className="text-muted text-sm">No updates yet.</p>}
          </div>
        )}
        <form className="mt-3 space-y-2" onSubmit={(ev) => {
          ev.preventDefault();
          run(async () => { setComments(await addComment(body, files)); setBody(""); setFiles([]); if (fileRef.current) fileRef.current.value = ""; });
        }}>
          <textarea className="input" rows={2} placeholder="Add an update" value={body} onChange={(x) => setBody(x.target.value)} />
          <div className="flex items-center gap-2">
            <label className="btn btn-sm cursor-pointer">
              {files.length ? `${files.length} photo${files.length > 1 ? "s" : ""}` : "Photo"}
              <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(x) => setFiles(Array.from(x.target.files ?? []))} />
            </label>
            <button className="btn btn-primary btn-sm ml-auto" disabled={busy || (!body.trim() && !files.length)}>Post</button>
          </div>
        </form>
      </div>

      <button className="text-[13px] text-muted hover:text-red" onClick={() => run(onDelete)} title="You can undo this for a few seconds">Delete pin</button>
    </div>
  );
}

/** The quick card that opens right where you dropped a pin: pick a kind, type a line, save. "More"
 *  moves to the full form in the side panel with what you typed. */
export function QuickPin({ plan, target, left, top, onSave, onMore, onCancel }: {
  plan: Plan | null; target: PinTarget; left: number; top: number;
  onSave: (kind: PinKind, title: string, tagged: string[], photo: boolean) => Promise<void>; onMore: (kind: PinKind, title: string, tagged: string[], photo: boolean) => void; onCancel: () => void;
}) {
  const { members } = useTeam();
  const [tagged, setTagged] = useState<string[]>([]);
  // "Photo" asks someone for a photo of this spot: a task that needs a photo to close
  const [choice, setChoice] = useState<PinKind | "photo">("note");
  const photo = choice === "photo";
  const kind: PinKind = photo ? "task" : choice;
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [needWho, setNeedWho] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const t = title.trim() || (photo ? "Photo of this spot" : "");
    if (!t) return onMore(kind, "", tagged, photo);
    if (photo && !tagged.length) return setNeedWho(true);
    setBusy(true);
    try { await onSave(kind, t, tagged, photo); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} onKeyDown={(e) => e.key === "Escape" && onCancel()} style={{ left, top }}
      className="absolute z-20 w-[290px] bg-panel border border-line border-t-[3px] border-t-accent rounded-[4px] shadow-[0_12px_40px_rgb(0_0_0/0.55)] p-3 space-y-2.5"
      onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <span className="eyebrow !text-[12px] truncate">{where(plan, target)}</span>
        <button type="button" onClick={onCancel} className="ml-auto text-muted hover:text-text text-lg leading-none" aria-label="Cancel">×</button>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {KINDS.map((k) => (
          <button type="button" key={k} onClick={() => setChoice(k)} aria-pressed={choice === k}
            className={`h-7 rounded-[3px] border text-[12px] ${choice === k ? "border-transparent text-[#111] font-semibold" : "border-line bg-panel-2 hover:bg-panel-3"}`}
            style={choice === k ? { background: PIN_COLOR[k] } : undefined}>{PIN_LABEL[k]}</button>
        ))}
        <button type="button" onClick={() => setChoice("photo")} aria-pressed={photo} title="Ask someone for a photo of this spot"
          className={`h-7 rounded-[3px] border text-[12px] ${photo ? "border-transparent text-[#111] font-semibold bg-chalk" : "border-line bg-panel-2 hover:bg-panel-3"}`}>Photo</button>
      </div>
      <input ref={ref} className="input !h-9" value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder={photo ? "Photo of this spot (what to show)" : kind === "note" ? "Note for this spot" : kind === "issue" ? "What is wrong here?" : kind === "material" ? "What goes here?" : "What needs doing here?"} />
      {members.length > 0 && (
        <div>
          <p className={`text-[11.5px] mb-1 ${needWho && !tagged.length ? "text-amber" : "text-muted"}`}>{photo ? "Who takes it?" : "Tag staff"}</p>
          <div className="max-h-[96px] overflow-y-auto scroll-thin"><StaffPicker compact members={members} value={tagged} onChange={setTagged} /></div>
        </div>
      )}
      <div className="flex gap-1.5">
        <button className="btn btn-primary btn-sm flex-1" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <button type="button" className="btn btn-sm" onClick={() => onMore(kind, title, tagged, photo)}>More…</button>
      </div>
    </form>
  );
}

/** Copy a tagged person's own link: every task they have with you, on every job, opening on this one.
 *  It's the same link each time, so it can be copied again from any of their tasks. Where the browser
 *  won't copy (an embedded preview), the link shows to copy by hand. */
function PersonLink({ name, get, open }: { name: string; get: () => Promise<string>; open?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "copied" | "shown">("idle");
  const [err, setErr] = useState<string | null>(null);
  const copy = async () => {
    setErr(null);
    setState("busy");
    try {
      const u = url ?? (await get());
      setUrl(u);
      try { await navigator.clipboard.writeText(u); setState("copied"); setTimeout(() => setState((s) => (s === "copied" ? "idle" : s)), 2500); }
      catch { setState("shown"); }
    } catch (x) { setErr(x instanceof Error ? x.message : "Couldn't make the link."); setState("idle"); }
  };
  return (
    <>
      <button type="button" onClick={copy} disabled={state === "busy"} title={`${name}'s link: all their tasks with you, on every job`}
        className={`ml-auto shrink-0 h-7 px-2.5 rounded-[3px] border text-[12.5px] inline-flex items-center gap-1.5 ${state === "copied" ? "border-green text-green" : "border-line bg-panel-2 hover:border-accent hover:text-accent"}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
        {state === "copied" ? "Copied" : state === "busy" ? "…" : "Copy link"}
      </button>
      {open && <button type="button" onClick={open} className="shrink-0 text-[12.5px] text-muted hover:text-text underline">See it</button>}
      {state === "shown" && url && <input readOnly autoFocus className="input !h-7 basis-full font-mono text-[11.5px]" value={url} onFocus={(e) => e.currentTarget.select()} aria-label={`${name}'s link`} />}
      {err && <p className="basis-full text-[12px] text-red">{err}</p>}
    </>
  );
}
