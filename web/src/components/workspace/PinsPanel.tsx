"use client";
// Pins: tasks, issues, notes and materials stuck to any element of the plan. A pin can need a photo
// before it closes, carry links (spec sheets, product pages) and a comment thread with photos.
import { useEffect, useRef, useState } from "react";
import type { JobStage, Pin, PinComment, PinInput, PinKind, PinStatus } from "@/lib/data/types";
import { elementLabel, findElement } from "@/lib/plan/geometry";
import type { Plan } from "@/lib/plan/types";
import { PIN_COLOR, PIN_LABEL, PIN_STATUS_LABEL } from "@/components/plan/style";

const KINDS: PinKind[] = ["task", "issue", "note", "material"];

function where(plan: Plan | null, pin: Pin) {
  if (!plan || !pin.element_id) return "On the plan";
  const e = findElement(plan, pin.element_id);
  return e ? `${elementLabel(e)} · ${e.floor.name}` : pin.element_id;
}

export function PinBadge({ pin, size = 26 }: { pin: Pin; size?: number }) {
  const color = pin.status === "done" ? "#4cb782" : PIN_COLOR[pin.kind];
  return (
    <span className="shrink-0 rounded-full grid place-items-center font-bold text-[#14100a]" style={{ width: size, height: size, background: color, fontSize: size * 0.45 }}>
      {pin.status === "done" ? "✓" : pin.number}
    </span>
  );
}

export function PinRow({ pin, plan, onClick }: { pin: Pin; plan: Plan | null; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left card px-3 py-2 flex items-center gap-3 hover:border-[#3a4552]">
      <PinBadge pin={pin} />
      <span className="min-w-0 flex-1">
        <span className={`block text-[14px] truncate ${pin.status === "done" ? "line-through text-muted" : ""}`}>{pin.title}</span>
        <span className="block text-[12px] text-muted truncate">{PIN_LABEL[pin.kind]} · {where(plan, pin)}</span>
      </span>
      {pin.status === "in_progress" && <span className="chip text-amber shrink-0">In progress</span>}
      {(pin.comment_count ?? 0) > 0 && <span className="text-[12px] text-muted shrink-0">💬 {pin.comment_count}</span>}
    </button>
  );
}

export function PinsList({ pins, plan, onSelect, onNew }: { pins: Pin[]; plan: Plan | null; onSelect: (id: string) => void; onNew: () => void }) {
  const [filter, setFilter] = useState<"open" | "all" | PinKind>("open");
  const shown = pins
    .filter((p) => (filter === "open" ? p.status !== "done" : filter === "all" ? true : p.kind === filter))
    .sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0) || b.priority - a.priority || b.number - a.number);
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-[18px] font-bold">Pins</h2>
        <span className="text-muted text-sm">{pins.filter((p) => p.status !== "done").length} open</span>
        <button className="btn btn-primary btn-sm ml-auto" onClick={onNew} disabled={!plan}>Drop a pin</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["open", "all", ...KINDS] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? "!text-accent-ink !bg-accent !border-accent" : "hover:text-text"}`}>
            {f === "open" ? "Open" : f === "all" ? "All" : PIN_LABEL[f] + "s"}
          </button>
        ))}
      </div>
      {shown.length ? <div className="space-y-1.5">{shown.map((p) => <PinRow key={p.id} pin={p} plan={plan} onClick={() => onSelect(p.id)} />)}</div>
        : <p className="text-muted text-sm py-6 text-center">{pins.length ? "Nothing here." : "No pins yet. Drop one on any room, wall, door or item."}</p>}
    </div>
  );
}

export function PinForm({ plan, draft, stages, onCancel, onCreate }: {
  plan: Plan | null; draft: { floorId: string; x: number | null; y: number | null; elementId: string | null }; stages: JobStage[];
  onCancel: () => void; onCreate: (input: PinInput) => Promise<void>;
}) {
  const [kind, setKind] = useState<PinKind>("task");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const [photo, setPhoto] = useState(false);
  const [stage, setStage] = useState(stages.find((s) => s.status === "active")?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => titleRef.current?.focus(), []);
  const e = plan && draft.elementId ? findElement(plan, draft.elementId) : null;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!title.trim()) return setErr("Give it a short title.");
    setBusy(true);
    try {
      await onCreate({
        kind, title, body: body || null, due_date: due || null, close_requirement: photo ? "photo" : "confirm", stage_id: stage || null,
        element_id: draft.elementId, floor_id: draft.floorId, x: draft.x, y: draft.y, priority: kind === "issue" ? 2 : 1,
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
        <h2 className="font-display text-[19px] font-bold">{e ? `On ${elementLabel(e)}` : "On the plan"}</h2>
        {e && <p className="text-muted text-[13px]">{e.floor.name} · <span className="font-mono">{e.el.id}</span></p>}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {KINDS.map((k) => (
          <button type="button" key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
            className={`h-9 rounded-lg border text-[12.5px] ${kind === k ? "border-transparent text-[#111] font-semibold" : "border-line bg-panel-2 hover:bg-panel-3"}`}
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
      <label className="flex items-center gap-2.5 text-[14px] cursor-pointer">
        <input type="checkbox" checked={photo} onChange={(x) => setPhoto(x.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
        Needs a photo before it can be closed
      </label>
      {err && <p className="text-red text-sm">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" disabled={busy}>{busy ? "Saving…" : "Save pin"}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function PinDetail({ pin, plan, stages, onBack, onUpdate, onDelete, loadComments, addComment, onShow }: {
  pin: Pin; plan: Plan | null; stages: JobStage[]; onBack: () => void;
  onUpdate: (input: Partial<PinInput> & { status?: PinStatus }) => Promise<void>; onDelete: () => Promise<void>;
  loadComments: () => Promise<PinComment[]>; addComment: (body: string, photos: File[]) => Promise<PinComment[]>; onShow: () => void;
}) {
  const [comments, setComments] = useState<PinComment[] | null>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
          <h2 className="font-display text-[19px] font-bold leading-snug">{pin.title}</h2>
          <button onClick={onShow} className="text-[13px] text-accent hover:underline">{where(plan, pin)} ›</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {(["open", "in_progress", "done"] as PinStatus[]).map((s) => (
          <button key={s} disabled={busy} onClick={() => run(() => onUpdate({ status: s }))} aria-pressed={pin.status === s}
            className={`h-9 rounded-lg border text-[12.5px] ${pin.status === s ? (s === "done" ? "bg-green text-[#0c1a12] border-transparent font-semibold" : s === "in_progress" ? "bg-amber text-[#1a1206] border-transparent font-semibold" : "bg-panel-3 border-[#3a4552]") : "border-line bg-panel-2 hover:bg-panel-3"}`}>
            {PIN_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {pin.close_requirement === "photo" && pin.status !== "done" && <p className="text-[12.5px] text-muted">📷 Needs a photo in the thread before it can be marked done.</p>}
      {err && <p className="text-red text-sm">{err}</p>}
      {pin.body && <p className="text-[14px] whitespace-pre-wrap leading-relaxed">{pin.body}</p>}
      <div className="flex flex-wrap gap-1.5">
        {pin.due_date && <span className="chip">Due {new Date(pin.due_date + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
        {stage && <span className="chip">{stage.name}</span>}
        {pin.priority > 1 && <span className="chip text-red">High priority</span>}
      </div>

      <div>
        <p className="eyebrow mb-2">Links</p>
        <div className="space-y-1">
          {pin.links.map((l, i) => (
            <div key={i} className="flex items-center gap-2 text-[14px]">
              <a href={l.url} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate">{l.title || l.url}</a>
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
              <div key={c.id} className="card p-3">
                <p className="text-[12px] text-muted mb-1">{c.author_name ?? "Team"} · {new Date(c.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                {c.body && <p className="text-[14px] whitespace-pre-wrap">{c.body}</p>}
                {c.photos.length > 0 && <div className="grid grid-cols-3 gap-1.5 mt-2">{c.photos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="w-full aspect-square object-cover rounded-md bg-ink" /></a>)}</div>}
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
              📷 {files.length ? `${files.length} photo${files.length > 1 ? "s" : ""}` : "Photo"}
              <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(x) => setFiles(Array.from(x.target.files ?? []))} />
            </label>
            <button className="btn btn-primary btn-sm ml-auto" disabled={busy || (!body.trim() && !files.length)}>Post</button>
          </div>
        </form>
      </div>

      <button className="text-[13px] text-muted hover:text-red" onClick={() => { if (confirm("Delete this pin?")) run(onDelete); }}>Delete pin</button>
    </div>
  );
}
