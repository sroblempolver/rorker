"use client";
// Inline editing on the details card: press Edit, change what's wrong, press ✓. Changes are saved as
// edits on top of the plan as read, so "Reset" always gets back to what the drawing said.
import { useState } from "react";
import type { ElementEdit, ItemInput, ItemKind, JobItem } from "@/lib/data/types";
import { fixtureSize } from "@/lib/plan/edits";
import type { Fixture, Room, RoomType } from "@/lib/plan/types";
import { fixtureBottom, fixtureHeight } from "@/components/plan/fixtures";
import { ITEM_KINDS, ITEM_LABEL, mmIn } from "@/components/plan/items";

const FIXTURE_KINDS = [
  "base_cabinet", "wall_cabinet", "tall_cabinet", "filler", "kitchen_sink", "dishwasher", "range", "cooktop", "oven", "range_hood", "fridge", "island",
  "toilet", "washbasin", "vanity", "bathtub", "shower", "towel_radiator", "washing_machine", "dryer", "water_heater",
  "bed", "nightstand", "wardrobe", "sofa", "armchair", "chair", "table", "dining_table", "desk", "bookshelf", "sideboard", "tv", "lamp", "plant", "fireplace", "car", "other",
];
const ROOM_TYPES: RoomType[] = ["kitchen", "bathroom", "wc", "bedroom", "living", "dining", "family", "study", "office", "hallway", "foyer", "stair_hall", "laundry", "utility", "closet", "garage", "storage", "balcony", "porch", "terrace", "other"];
const nice = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-dashed border-line last:border-0">
      <span className="text-muted text-[13px] w-28 shrink-0">{k}</span>
      <span className="text-[14px] min-w-0 break-words">{v}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

function EditBar({ editing, busy, onEdit, onCancel, onSave, onReset, changed }: { editing: boolean; busy: boolean; onEdit: () => void; onCancel: () => void; onSave: () => void; onReset?: () => void; changed?: boolean }) {
  if (!editing) return (
    <div className="flex items-center gap-2">
      {changed && onReset && <button className="text-[12.5px] text-muted hover:text-text" onClick={onReset} title="Put it back the way the drawing had it">Reset to drawing</button>}
      <button className="btn btn-sm ml-auto" onClick={onEdit} aria-label="Edit">✎ Edit</button>
    </div>
  );
  return (
    <div className="flex items-center gap-2 justify-end">
      <button className="btn btn-sm" onClick={onCancel} disabled={busy} aria-label="Cancel">✕</button>
      <button className="btn btn-sm btn-primary" onClick={onSave} disabled={busy} aria-label="Confirm">{busy ? "…" : "✓ Save"}</button>
    </div>
  );
}

const num = (s: string) => (s.trim() === "" ? undefined : Math.round(Number(s)));
const url = (s: string) => { const t = s.trim(); return !t ? undefined : /^https?:\/\//i.test(t) ? t : `https://${t}`; };

/** What an object is and how big, with Edit → ✓. `focus` opens it straight on the product fields. */
export function FixtureCard({ f, edit, room, onSave, focus }: { f: Fixture; edit: ElementEdit | undefined; room: string; onSave: (patch: ElementEdit | null) => Promise<void>; focus?: "product" | null }) {
  const size = fixtureSize(f);
  const h = f.height_mm ?? fixtureHeight(f.kind);
  const bottom = fixtureBottom(f);
  const [editing, setEditing] = useState(!!focus);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const init = () => ({
    name: f.name, kind: f.kind, width: String(Math.round(size.width)), depth: String(Math.round(size.depth)), height: String(Math.round(h)),
    bottom: String(Math.round(bottom)), spec: f.spec ?? "", product_name: f.product_name ?? "", product_url: f.product_url ?? "", notes: f.notes ?? "",
  });
  const [v, setV] = useState(init);
  const set = (k: keyof ReturnType<typeof init>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const save = async () => {
    const w = num(v.width), d = num(v.depth), hh = num(v.height), b = num(v.bottom);
    for (const [label, x] of [["Width", w], ["Depth", d], ["Height", hh]] as const) if (x != null && (!(x > 0) || x > 20000)) return setErr(`${label} looks wrong.`);
    if (b != null && (b < 0 || b > 4000)) return setErr("Mount height looks wrong.");
    const patch: ElementEdit = {
      // unchanged fields keep whatever was edited before (f already shows those edits)
      name: v.name.trim() && v.name.trim() !== f.name ? v.name.trim() : edit?.name,
      kind: v.kind !== f.kind ? v.kind : edit?.kind,
      width: w != null && Math.abs(w - size.width) >= 1 ? w : undefined,
      depth: d != null && Math.abs(d - size.depth) >= 1 ? d : undefined,
      height_mm: hh != null && Math.abs(hh - h) >= 1 ? hh : edit?.height_mm,
      dz: b != null && Math.abs(b - bottom) >= 1 ? (edit?.dz ?? 0) + (b - bottom) : edit?.dz,
      spec: v.spec.trim() || undefined, product_name: v.product_name.trim() || undefined, product_url: url(v.product_url), notes: v.notes.trim() || undefined,
    };
    // keep earlier size edits unless changed now
    if (patch.width == null && edit?.width) patch.width = edit.width;
    if (patch.depth == null && edit?.depth) patch.depth = edit.depth;
    setBusy(true);
    setErr(null);
    try { await onSave(patch); setEditing(false); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save."); } finally { setBusy(false); }
  };

  if (!editing) return (
    <div>
      <Row k="Kind" v={f.kind === "other" ? "Not identified yet" : nice(f.kind)} />
      <Row k="Room" v={room} />
      <Row k="Size" v={`${Math.round(size.width)} wide × ${Math.round(size.depth)} deep × ${Math.round(h)} high mm`} />
      {bottom > 0 && <Row k="Mounted at" v={mmIn(bottom)} />}
      {f.spec && <Row k="Spec" v={f.spec} />}
      {(f.product_name || f.product_url) && <Row k="Product" v={f.product_url ? <a className="text-chalk hover:underline" href={f.product_url} target="_blank" rel="noreferrer">{f.product_name || f.product_url} ↗</a> : f.product_name} />}
      {f.notes && <Row k="Notes" v={f.notes} />}
      {f.source_ref && <Row k="Drawing" v={<span className="font-mono text-[12px]">{f.source_ref}</span>} />}
      <div className="mt-2"><EditBar editing={false} busy={busy} changed={!!edit && Object.keys(edit).length > 0} onEdit={() => { setV(init()); setEditing(true); }} onCancel={() => setEditing(false)} onSave={save} onReset={() => onSave(null)} /></div>
    </div>
  );
  return (
    <div className="space-y-2.5 card !rounded-[3px] p-3">
      {focus !== "product" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name"><input className="input" value={v.name} onChange={set("name")} /></Field>
            <Field label="Kind"><select className="input" value={v.kind} onChange={set("kind")}>{[...new Set([f.kind, ...FIXTURE_KINDS])].map((k) => <option key={k} value={k}>{nice(k)}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Width mm"><input className="input" inputMode="numeric" value={v.width} onChange={set("width")} /></Field>
            <Field label="Depth mm"><input className="input" inputMode="numeric" value={v.depth} onChange={set("depth")} /></Field>
            <Field label="Height mm"><input className="input" inputMode="numeric" value={v.height} onChange={set("height")} /></Field>
          </div>
          <Field label="Bottom above floor, mm (0 stands on the floor)"><input className="input" inputMode="numeric" value={v.bottom} onChange={set("bottom")} /></Field>
          <Field label="Spec / size code"><input className="input" value={v.spec} onChange={set("spec")} placeholder="e.g. SB36, Base 600" /></Field>
        </>
      )}
      <div className="grid grid-cols-1 gap-2">
        <Field label="Product name"><input className="input" value={v.product_name} onChange={set("product_name")} placeholder="Brand and model" autoFocus={focus === "product"} /></Field>
        <Field label="Product link"><input className="input" type="url" value={v.product_url} onChange={set("product_url")} placeholder="https://…" /></Field>
      </div>
      <Field label="Notes"><textarea className="input !h-16 py-2" value={v.notes} onChange={set("notes")} /></Field>
      {err && <p className="text-red text-[13px]">{err}</p>}
      <EditBar editing busy={busy} onEdit={() => {}} onCancel={() => setEditing(false)} onSave={save} />
    </div>
  );
}

/** A room's name and type with Edit → ✓. */
export function RoomEdit({ r, onSave }: { r: Room; onSave: (patch: ElementEdit) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.name);
  const [type, setType] = useState<RoomType>(r.type);
  const [busy, setBusy] = useState(false);
  if (!editing) return <button className="btn btn-sm" onClick={() => { setName(r.name); setType(r.type); setEditing(true); }} aria-label="Edit room">✎ Edit</button>;
  return (
    <div className="card !rounded-[3px] p-3 space-y-2 w-full">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Type"><select className="input" value={type} onChange={(e) => setType(e.target.value as RoomType)}>{ROOM_TYPES.map((t) => <option key={t} value={t}>{nice(t)}</option>)}</select></Field>
      </div>
      <EditBar editing busy={busy} onEdit={() => {}} onCancel={() => setEditing(false)} onSave={async () => {
        setBusy(true);
        try { await onSave({ name: name.trim() && name.trim() !== r.name ? name.trim() : undefined, type: type !== r.type ? type : undefined }); setEditing(false); } finally { setBusy(false); }
      }} />
    </div>
  );
}

/** The card for an outlet, switch or other wall item: what it is, exactly where, and a note. */
export function ItemPanel({ item, wallLabel, wallLength, onUpdate, onDelete, onPin, onShow }: {
  item: JobItem; wallLabel: string; wallLength: number | null;
  onUpdate: (input: Partial<ItemInput>) => Promise<void>; onDelete: () => Promise<void>; onPin: () => void; onShow: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState({ kind: item.kind, label: item.label ?? "", x: String(item.x), y: String(item.y), note: item.note ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const title = item.label || ITEM_LABEL[item.kind];
  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="eyebrow">{ITEM_LABEL[item.kind]} · on the wall</p>
        <h2 className="font-display text-[25px] font-extrabold uppercase tracking-[0.02em] leading-none mt-0.5">{title}</h2>
        <button onClick={onShow} className="text-[13px] text-chalk hover:underline mt-1">{wallLabel} ›</button>
      </div>
      {!editing ? (
        <div>
          <Row k="Height" v={`${mmIn(item.y)} to the centre, from the floor`} />
          <Row k="From the left" v={`${mmIn(item.x)}${wallLength ? `, ${mmIn(Math.max(0, wallLength - item.x))} from the right` : ""}`} />
          {item.note && <Row k="Note" v={item.note} />}
          <p className="text-[12px] text-muted mt-2">Drag it on the wall to move it. Measurements update as you go.</p>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-sm" onClick={onPin}>Pin a task here</button>
            <button className="btn btn-sm ml-auto" onClick={() => { setV({ kind: item.kind, label: item.label ?? "", x: String(item.x), y: String(item.y), note: item.note ?? "" }); setEditing(true); }} aria-label="Edit">✎ Edit</button>
          </div>
        </div>
      ) : (
        <div className="card !rounded-[3px] p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Field label="What"><select className="input" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as ItemKind })}>{ITEM_KINDS.map((k) => <option key={k} value={k}>{ITEM_LABEL[k]}</option>)}</select></Field>
            <Field label="Label"><input className="input" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} placeholder="e.g. GFCI 20A" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Height mm"><input className="input" inputMode="numeric" value={v.y} onChange={(e) => setV({ ...v, y: e.target.value })} /></Field>
            <Field label="From the left mm"><input className="input" inputMode="numeric" value={v.x} onChange={(e) => setV({ ...v, x: e.target.value })} /></Field>
          </div>
          <Field label="Note"><textarea className="input !h-16 py-2" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
          {err && <p className="text-red text-[13px]">{err}</p>}
          <EditBar editing busy={busy} onEdit={() => {}} onCancel={() => setEditing(false)} onSave={async () => {
            const x = num(v.x), y = num(v.y);
            if (x == null || y == null || x < 0 || y < 0 || y > 6000 || (wallLength && x > wallLength)) return setErr("Check the measurements.");
            setBusy(true);
            try { await onUpdate({ kind: v.kind, label: v.label, x, y, note: v.note }); setEditing(false); } finally { setBusy(false); }
          }} />
        </div>
      )}
      <button className="text-[13px] text-muted hover:text-red" disabled={busy} onClick={async () => { setBusy(true); try { await onDelete(); } finally { setBusy(false); } }}>Remove this {ITEM_LABEL[item.kind].toLowerCase()}</button>
    </div>
  );
}
