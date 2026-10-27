"use client";
// The job's materials list (the "Buy" tab) and the ways into it: one-tap suggestions on whatever is
// picked on the plan, and the add sheet that can split one add across several jobs. Every line knows
// where it goes on the plan, who gets it and who uses it.
import { useMemo, useRef, useState } from "react";
import type { JobStage, Member, PinAnchor } from "@/lib/data/types";
import type { Plan } from "@/lib/plan/types";
import { today } from "@/lib/dates";
import { Avatar } from "@/components/team/Avatar";
import { useTeam } from "@/components/team/context";
import { where } from "@/components/workspace/PinsPanel";
import { elementLabel, findElement, roomOf } from "@/lib/plan/geometry";
import { parseQty, type Suggestion } from "@/lib/materials/suggest";
import {
  FULFIL_LABEL, NEXT_STATUS, STATUS_COLOR, STATUS_LABEL, UNITS, lineTotal, money, qtyText,
  type BuyStatus, type Fulfil, type MaterialInput, type MaterialLine, type MaterialsJob, type Unit,
} from "@/lib/materials/types";

/** Tied to a spot on the plan? */
export const placed = (l: Pick<MaterialLine, "element_id" | "anchor" | "x">) => !!(l.element_id || l.anchor || l.x != null);

/** A spot on the plan to buy for, with what's likely needed there. */
export interface BuyTarget { element_id: string | null; floor_id: string | null; x?: number | null; y?: number | null; anchor: PinAnchor | null; where: string; suggestions: Suggestion[] }
/** Defaults for a new line: last person picked to get things, and the current job. */
export interface BuyDefaults { jobId: string; buyer: string | null }

export function blankLine(jobId: string, t: Partial<BuyTarget> | null, s: Partial<Suggestion> & { name: string }, buyer: string | null): MaterialInput {
  return {
    job_id: jobId, group_id: null, name: s.name, qty: s.qty ?? 1, unit: s.unit ?? "ea", unit_cost: s.unit_cost || null, store: null, link: s.link ?? null, sku: null,
    status: "to_buy", fulfil: "pickup", deliver_to: null, buyer, installer: null, needed_by: null, stage_id: null, note: s.why ?? null,
    element_id: t?.element_id ?? null, floor_id: t?.floor_id ?? null, x: t?.x ?? null, y: t?.y ?? null, anchor: t?.anchor ?? null,
  };
}

function StatusChip({ s }: { s: BuyStatus }) {
  return <span className="chip !h-[22px] !px-1.5 !text-[11.5px] !text-text shrink-0"><span className="w-2 h-2 rounded-[1px]" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</span>;
}

/** Pick one person (or nobody). */
export function PersonPick({ value, onChange, none = "Anyone" }: { value: string | null; onChange: (id: string | null) => void; none?: string }) {
  const { members, me } = useTeam();
  return (
    <div className="flex flex-wrap gap-1">
      <button type="button" onClick={() => onChange(null)} aria-pressed={!value}
        className={`h-7 px-2 rounded-[3px] border text-[12px] ${!value ? "border-chalk bg-chalk/15" : "border-line bg-panel-2 text-muted hover:text-text"}`}>{none}</button>
      {members.map((m) => (
        <button type="button" key={m.id} onClick={() => onChange(m.id)} aria-pressed={value === m.id} title={[m.full_name, m.title].filter(Boolean).join(" · ")}
          className={`h-7 pl-0.5 pr-2 rounded-[3px] border text-[12px] inline-flex items-center gap-1.5 ${value === m.id ? "border-chalk bg-chalk/15" : "border-line bg-panel-2 text-muted hover:text-text"}`}>
          <Avatar m={m} size={22} />{m.id === me ? "Me" : m.full_name.split(" ")[0]}
        </button>
      ))}
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, l]) => (
        <button type="button" key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          className={`h-8 rounded-[3px] border text-[12.5px] ${value === v ? "border-transparent bg-accent text-accent-ink font-semibold" : "border-line bg-panel-2 hover:bg-panel-3"}`}>{l}</button>
      ))}
    </div>
  );
}

/** On the Details panel of anything picked on the plan: tap a chip and it's on the list. */
export function BuyHere({ target, lines, members, onQuick, onMore, onOpen }: {
  target: BuyTarget; lines: MaterialLine[]; members: Member[];
  onQuick: (s: Suggestion) => void; onMore: () => void; onOpen: (id: string) => void;
}) {
  const [added, setAdded] = useState<string[]>([]);
  return (
    <div>
      <p className="eyebrow mb-2">Buy for this</p>
      {target.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {target.suggestions.map((s) => {
            const done = added.includes(s.name);
            return (
              <button key={s.name} onClick={() => { onQuick(s); setAdded((a) => [...a, s.name]); }} title={s.why ? `${s.why}. Tap to add.` : "Tap to add"}
                className={`h-8 pl-2 pr-2.5 rounded-[3px] border text-[12.5px] inline-flex items-center gap-1.5 ${done ? "border-green text-green" : "border-line bg-panel-2 hover:border-accent"}`}>
                <span className={`font-bold ${done ? "" : "text-accent"}`}>{done ? "✓" : "+"}</span>
                <span className="font-mono text-[11.5px]">{qtyText(s.qty, s.unit)}</span>{s.name}
              </button>
            );
          })}
        </div>
      )}
      <button className="btn btn-sm w-full mt-2" onClick={onMore}>Something else, or for more than one job…</button>
      {lines.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-[12px] text-muted">On the list for here ({lines.length})</p>
          {lines.map((l) => {
            const b = members.find((m) => m.id === l.buyer);
            return (
              <button key={l.id} onClick={() => onOpen(l.id)} className="w-full text-left card !rounded-[3px] px-2.5 py-1.5 flex items-center gap-2 hover:border-chalk text-[13px]">
                <span className="font-mono text-[11.5px] text-muted shrink-0">{qtyText(l.qty, l.unit)}</span>
                <span className="truncate flex-1">{l.name}</span>
                {b && <Avatar m={b} size={18} />}
                <StatusChip s={l.status} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The full add: name, quantity, and the same thing for other jobs in one go. */
export function AddMaterial({ target, preset, jobs, defaults, stages, existing, onCancel, onAdd }: {
  target: BuyTarget | null; preset?: Partial<Suggestion> & { name?: string }; jobs: MaterialsJob[]; defaults: BuyDefaults; stages: JobStage[];
  existing: MaterialLine[]; onCancel: () => void; onAdd: (lines: MaterialInput[]) => Promise<void>;
}) {
  const [name, setName] = useState(preset?.name ?? "");
  const [unit, setUnit] = useState<Unit>(preset?.unit ?? "ea");
  const [cost, setCost] = useState(preset?.unit_cost ? String(preset.unit_cost) : "");
  const [store, setStore] = useState("");
  const [link, setLink] = useState(preset?.link ?? "");
  const [split, setSplit] = useState<{ job: string; qty: string }[]>([{ job: defaults.jobId, qty: String(preset?.qty ?? 1) }]);
  const [buyer, setBuyer] = useState<string | null>(defaults.buyer);
  const [installer, setInstaller] = useState<string | null>(null);
  const [fulfil, setFulfil] = useState<Fulfil>("pickup");
  const [deliverTo, setDeliverTo] = useState("");
  const [needed, setNeeded] = useState("");
  const [stage, setStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const stores = useMemo(() => [...new Set(existing.map((l) => l.store).filter(Boolean) as string[])], [existing]);
  const dupes = name.trim() ? existing.filter((l) => l.status !== "installed" && l.status !== "returned" && l.name.toLowerCase() === name.trim().toLowerCase() && split.some((s) => s.job === l.job_id)) : [];
  const jobName = (id: string) => jobs.find((j) => j.id === id)?.name ?? "Job";
  const free = jobs.filter((j) => !split.some((s) => s.job === j.id));
  const total = split.reduce((a, s) => a + (Number(s.qty) || 0), 0);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const parsed = parseQty(name);
    const nm = parsed.name;
    if (!nm) return setErr("What is it?");
    const rows = split.filter((s) => Number(s.qty) > 0);
    if (!rows.length) return setErr("Add a quantity.");
    if (parsed.qty !== 1 && rows.length === 1 && rows[0].qty === "1") rows[0] = { ...rows[0], qty: String(parsed.qty) };
    const group = rows.length > 1 ? `g${Date.now().toString(36)}` : null;
    setBusy(true);
    try {
      await onAdd(rows.map((s) => ({
        ...blankLine(s.job, s.job === defaults.jobId ? target : null, { name: nm, qty: Number(s.qty), unit, unit_cost: Number(cost) || 0, link: link || null }, buyer),
        group_id: group, store: store || null, installer, fulfil, deliver_to: fulfil === "delivery" ? deliverTo || null : null,
        needed_by: needed || null, stage_id: s.job === defaults.jobId ? stage || null : null, note: preset?.why ?? null,
      })));
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Could not add it.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="p-4 space-y-4">
      <div>
        <p className="eyebrow">Add to the list</p>
        <h2 className="font-display text-[23px] font-extrabold uppercase leading-tight">{target?.where ?? "Not tied to a spot"}</h2>
        {!target && <p className="text-[12.5px] text-muted">Tip: pick the spot on the plan first and it shows on the map.</p>}
      </div>
      {target && target.suggestions.length > 0 && !name && (
        <div className="flex flex-wrap gap-1.5">
          {target.suggestions.map((s) => (
            <button type="button" key={s.name} className="chip hover:text-text hover:border-accent" onClick={() => { setName(s.name); setUnit(s.unit); setCost(s.unit_cost ? String(s.unit_cost) : ""); setSplit((x) => [{ ...x[0], qty: String(s.qty) }, ...x.slice(1)]); }}>
              <span className="font-mono">{qtyText(s.qty, s.unit)}</span>{s.name}
            </button>
          ))}
        </div>
      )}
      <div>
        <label className="label">What</label>
        <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2 outlets, Drywall 4×8, Kitchen faucet" />
        {dupes.length > 0 && <p className="text-[12.5px] text-amber mt-1">Already on the list: {dupes.map((d) => `${qtyText(d.qty, d.unit)} for ${jobName(d.job_id)} (${STATUS_LABEL[d.status].toLowerCase()})`).join(", ")}.</p>}
      </div>

      <div>
        <label className="label">How many, and for which job</label>
        <div className="space-y-1.5">
          {split.map((s, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              {i === 0 ? <span className="flex-1 min-w-0 truncate text-[14px]">{jobName(s.job)}</span> : (
                <select className="input !h-9 flex-1 min-w-0" value={s.job} onChange={(e) => setSplit((x) => x.map((r, j) => (j === i ? { ...r, job: e.target.value } : r)))}>
                  {[jobs.find((j) => j.id === s.job)!, ...free].filter(Boolean).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              )}
              <input className="input !h-9 !w-[72px] text-right font-mono" inputMode="decimal" value={s.qty} onChange={(e) => setSplit((x) => x.map((r, j) => (j === i ? { ...r, qty: e.target.value } : r)))} aria-label={`Quantity for ${jobName(s.job)}`} />
              {i === 0 ? (
                <select className="input !h-9 !w-[84px]" value={unit} onChange={(e) => setUnit(e.target.value as Unit)} aria-label="Unit">{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm !w-[84px]" onClick={() => setSplit((x) => x.filter((_, j) => j !== i))}>Remove</button>
              )}
            </div>
          ))}
        </div>
        {free.length > 0 && <button type="button" className="text-[13px] text-chalk hover:underline mt-1.5" onClick={() => setSplit((x) => [...x, { job: free[0].id, qty: "1" }])}>+ Also for another job</button>}
        {split.length > 1 && <p className="text-[12px] text-muted mt-1">{qtyText(total, unit)} in all, bought together, kept apart per job.</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Price each ($)</label><input className="input !h-9 font-mono" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="optional" /></div>
        <div><label className="label">Store</label><input className="input !h-9" list="rk-stores" value={store} onChange={(e) => setStore(e.target.value)} placeholder="Home Depot…" /><datalist id="rk-stores">{stores.map((s) => <option key={s} value={s} />)}</datalist></div>
      </div>
      <div><label className="label">Product link</label><input className="input !h-9" value={link} onChange={(e) => setLink(e.target.value)} placeholder="optional" /></div>

      <div><label className="label">Who gets it</label><PersonPick value={buyer} onChange={setBuyer} /></div>
      <div><label className="label">Who it&apos;s for (installs it)</label><PersonPick value={installer} onChange={setInstaller} none="Not set" /></div>
      <div>
        <label className="label">How it gets there</label>
        <Seg value={fulfil} onChange={setFulfil} options={[["pickup", "Pick up"], ["delivery", "Delivery"], ["stock", "From stock"]]} />
        {fulfil === "delivery" && <input className="input !h-9 mt-1.5" value={deliverTo} onChange={(e) => setDeliverTo(e.target.value)} placeholder={`Deliver to ${jobs.find((j) => j.id === defaults.jobId)?.address ?? "the job"} (or type another address)`} />}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Needed by</label><input type="date" className="input !h-9" min={today()} value={needed} onChange={(e) => setNeeded(e.target.value)} /></div>
        <div><label className="label">For stage</label>
          <select className="input !h-9" value={stage} onChange={(e) => setStage(e.target.value)}><option value="">Any</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
      </div>
      {err && <p className="text-red text-sm">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" disabled={busy}>{busy ? "Adding…" : split.length > 1 ? `Add for ${split.length} jobs` : "Add to list"}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/** One line, opened: everything about it, changed in place. */
function LineDetail({ line, plan, jobs, stages, onUpdate, onRemove, onShow, onSplit }: {
  line: MaterialLine; plan: Plan | null; jobs: MaterialsJob[]; stages: JobStage[];
  onUpdate: (patch: Partial<MaterialInput>) => void; onRemove: () => void; onShow?: () => void; onSplit: (jobId: string, qty: number) => void;
}) {
  const [other, setOther] = useState<{ job: string; qty: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const others = jobs.filter((j) => j.id !== line.job_id);
  const num = (v: string) => (v.trim() === "" ? null : Number(v) || 0);
  return (
    <div className="border-t border-line mt-2 pt-2.5 space-y-2.5 text-[13px]" onClick={(e) => e.stopPropagation()}>
      <div>
        <p className="text-[12px] text-muted mb-1">Status</p>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(STATUS_LABEL) as BuyStatus[]).map((s) => (
            <button key={s} type="button" onClick={() => onUpdate({ status: s })} aria-pressed={line.status === s}
              className={`h-7 px-2 rounded-[3px] border text-[12px] inline-flex items-center gap-1.5 ${line.status === s ? "border-chalk bg-chalk/15" : "border-line bg-panel-2 text-muted hover:text-text"}`}>
              <span className="w-2 h-2 rounded-[1px]" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_72px_84px] gap-1.5">
        <input className="input !h-8 !text-[13px]" defaultValue={line.name} onBlur={(e) => e.target.value.trim() && e.target.value !== line.name && onUpdate({ name: e.target.value.trim() })} aria-label="Name" />
        <input className="input !h-8 !text-[13px] text-right font-mono" inputMode="decimal" defaultValue={line.qty} onBlur={(e) => Number(e.target.value) > 0 && Number(e.target.value) !== line.qty && onUpdate({ qty: Number(e.target.value) })} aria-label="Quantity" />
        <select className="input !h-8 !text-[13px]" value={line.unit} onChange={(e) => onUpdate({ unit: e.target.value as Unit })} aria-label="Unit">{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <input className="input !h-8 !text-[13px] font-mono" inputMode="decimal" defaultValue={line.unit_cost ?? ""} placeholder="$ each" onBlur={(e) => onUpdate({ unit_cost: num(e.target.value) })} aria-label="Price each" />
        <input className="input !h-8 !text-[13px]" defaultValue={line.store ?? ""} placeholder="Store" onBlur={(e) => onUpdate({ store: e.target.value.trim() || null })} aria-label="Store" />
      </div>
      <input className="input !h-8 !text-[13px]" defaultValue={line.link ?? ""} placeholder="Product link" onBlur={(e) => onUpdate({ link: e.target.value.trim() || null })} aria-label="Product link" />
      <div><p className="text-[12px] text-muted mb-1">Who gets it</p><PersonPick value={line.buyer} onChange={(id) => onUpdate({ buyer: id })} /></div>
      <div><p className="text-[12px] text-muted mb-1">Who it&apos;s for</p><PersonPick value={line.installer} onChange={(id) => onUpdate({ installer: id })} none="Not set" /></div>
      <Seg value={line.fulfil} onChange={(f) => onUpdate({ fulfil: f })} options={[["pickup", "Pick up"], ["delivery", "Delivery"], ["stock", "From stock"]]} />
      {line.fulfil === "delivery" && <input className="input !h-8 !text-[13px]" defaultValue={line.deliver_to ?? ""} placeholder={jobs.find((j) => j.id === line.job_id)?.address ?? "Delivery address"} onBlur={(e) => onUpdate({ deliver_to: e.target.value.trim() || null })} aria-label="Delivery address" />}
      <div className="grid grid-cols-2 gap-1.5">
        <input type="date" className="input !h-8 !text-[13px]" value={line.needed_by ?? ""} onChange={(e) => onUpdate({ needed_by: e.target.value || null })} aria-label="Needed by" />
        <select className="input !h-8 !text-[13px]" value={line.stage_id ?? ""} onChange={(e) => onUpdate({ stage_id: e.target.value || null })} aria-label="For stage"><option value="">Any stage</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
      {plan && (
        <select className="input !h-8 !text-[13px]" value={line.element_id ?? ""} aria-label="Where it goes"
          onChange={(e) => { const r = plan.floors.flatMap((f) => f.rooms.map((x) => ({ x, f }))).find((y) => y.x.id === e.target.value); onUpdate({ element_id: r?.x.id ?? null, floor_id: r?.f.id ?? null, x: null, y: null, anchor: null }); }}>
          <option value="">{placed(line) ? where(plan, line) : "Where it goes: not set"}</option>
          {plan.floors.flatMap((f) => f.rooms.map((r) => <option key={r.id} value={r.id}>{r.name} · {f.name}</option>))}
        </select>
      )}
      <textarea className="input !text-[13px]" rows={2} defaultValue={line.note ?? ""} placeholder="Note (colour, size, model…)" onBlur={(e) => onUpdate({ note: e.target.value.trim() || null })} aria-label="Note" />
      {line.receipts.length > 0 && <div className="flex gap-1.5 flex-wrap">{line.receipts.map((r) => <a key={r} href={r} target="_blank" rel="noreferrer"><img src={r} alt="Receipt" className="w-14 h-14 object-cover rounded-[3px] border border-line" /></a>)}</div>}
      {other ? (
        <div className="flex gap-1.5 items-center">
          <select className="input !h-8 !text-[13px] flex-1 min-w-0" value={other.job} onChange={(e) => setOther({ ...other, job: e.target.value })}>{others.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}</select>
          <input className="input !h-8 !text-[13px] !w-[60px] text-right font-mono" inputMode="decimal" value={other.qty} onChange={(e) => setOther({ ...other, qty: e.target.value })} aria-label="Quantity" />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { if (Number(other.qty) > 0) onSplit(other.job, Number(other.qty)); setOther(null); }}>Add</button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {onShow && <button type="button" className="btn btn-sm" onClick={onShow}>Show on map</button>}
        {others.length > 0 && !other && <button type="button" className="btn btn-sm" onClick={() => setOther({ job: others[0].id, qty: String(line.qty) })}>Also for another job</button>}
        <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>Receipt photo</button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpdate({ receipts: [...line.receipts, URL.createObjectURL(f)] }); e.target.value = ""; }} />
        <button type="button" className="btn btn-ghost btn-sm text-red ml-auto" onClick={onRemove}>Delete</button>
      </div>
    </div>
  );
}

export function LineRow({ line, plan, jobs, open, onToggle, onTick, sub, children }: {
  line: MaterialLine; plan: Plan | null; jobs?: MaterialsJob[]; open?: boolean; onToggle: () => void; onTick: () => void; sub?: string; children?: React.ReactNode;
}) {
  const { members } = useTeam();
  const buyer = members.find((m) => m.id === line.buyer);
  const done = line.status === "installed" || line.status === "returned";
  const late = line.needed_by && line.needed_by < today() && (line.status === "to_buy" || line.status === "ordered");
  const otherJob = jobs && jobs.length > 1 ? jobs.find((j) => j.id === line.job_id)?.name : null;
  return (
    <div className={`card !rounded-[3px] px-2.5 py-2 ${open ? "border-chalk" : "hover:border-chalk"} cursor-pointer`} onClick={onToggle}>
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={(e) => { e.stopPropagation(); onTick(); }} disabled={done} title={done ? STATUS_LABEL[line.status] : `Mark ${STATUS_LABEL[NEXT_STATUS[line.status]].toLowerCase()}`}
          className="w-6 h-6 shrink-0 rounded-[3px] border-2 grid place-items-center text-[13px] font-bold" style={{ borderColor: STATUS_COLOR[line.status], background: line.status === "to_buy" || line.status === "ordered" ? "transparent" : STATUS_COLOR[line.status], color: "#141310" }}>
          {line.status === "got" ? "✓" : line.status === "installed" ? "✓✓" : line.status === "returned" ? "↩" : ""}
        </button>
        <span className="min-w-0 flex-1">
          <span className={`block text-[14px] truncate ${done ? "line-through text-muted" : ""}`}><span className="font-mono text-[12.5px] text-muted mr-1.5">{qtyText(line.qty, line.unit)}</span>{line.name}</span>
          <span className="block text-[12px] text-muted truncate">
            {sub ?? ([otherJob, placed(line) ? where(plan, line) : null, line.store, line.fulfil !== "pickup" ? FULFIL_LABEL[line.fulfil] : null].filter(Boolean).join(" · ") || "No spot or store yet")}
            {line.status !== "to_buy" && <span style={{ color: STATUS_COLOR[line.status] }}> · {STATUS_LABEL[line.status]}</span>}
            {late && <span className="text-red"> · late</span>}
          </span>
        </span>
        {line.unit_cost ? <span className="font-mono text-[12px] text-muted shrink-0">{money(lineTotal(line))}</span> : null}
        {buyer ? <Avatar m={buyer} size={22} /> : <span className="w-[22px] h-[22px] rounded-[3px] border border-dashed border-line shrink-0" title="Nobody's getting it yet" />}
      </div>
      {open && children}
    </div>
  );
}

type Group = "where" | "who" | "store" | "status";

/** The Buy tab: this job's list, grouped by where it goes, who gets it, the store or the status. */
export function MaterialsPanel({ jobId, lines, jobs, plan, stages, focus, onAdd, onUpdate, onRemove, onShow, onSplit, onShoppingRun }: {
  jobId: string; lines: MaterialLine[]; jobs: MaterialsJob[]; plan: Plan | null; stages: JobStage[]; focus: string | null;
  onAdd: () => void; onUpdate: (id: string, patch: Partial<MaterialInput>) => void; onRemove: (id: string) => void;
  onShow: (l: MaterialLine) => void; onSplit: (l: MaterialLine, jobId: string, qty: number) => void; onShoppingRun?: () => void;
}) {
  const { members, me } = useTeam();
  const [group, setGroup] = useState<Group>("where");
  const [filter, setFilter] = useState<"open" | "mine" | "all">("open");
  const [open, setOpen] = useState<string | null>(focus);
  const [copied, setCopied] = useState(false);
  const mine = lines.filter((l) => l.job_id === jobId);
  const isOpen = (l: MaterialLine) => l.status === "to_buy" || l.status === "ordered" || l.status === "got";
  const shown = mine.filter((l) => (filter === "all" ? true : filter === "mine" ? isOpen(l) && l.buyer === me : isOpen(l)));
  const est = mine.filter((l) => l.status !== "returned").reduce((a, l) => a + lineTotal(l), 0);
  const spent = mine.filter((l) => l.status === "got" || l.status === "installed").reduce((a, l) => a + lineTotal(l), 0);
  const toBuy = mine.filter((l) => l.status === "to_buy").length;

  const key = (l: MaterialLine): string => {
    if (group === "who") return members.find((m) => m.id === l.buyer)?.full_name ?? "Nobody yet";
    if (group === "store") return l.fulfil === "stock" ? "From stock" : l.store ?? "No store yet";
    if (group === "status") return STATUS_LABEL[l.status];
    if (!plan || !placed(l)) return "No spot yet";
    // by room: the room an element sits in, or the room of the wall side it's on
    const e = l.element_id ? findElement(plan, l.element_id) : null;
    const roomId = e ? roomOf(e) : l.anchor?.side?.split(":")[0] ?? null;
    const room = roomId ? findElement(plan, roomId) : null;
    return room ? `${elementLabel(room)} · ${room.floor.name}` : e ? `${e.floor.name}` : where(plan, l);
  };
  const groups = new Map<string, MaterialLine[]>();
  for (const l of [...shown].sort((a, b) => (a.status === "installed" ? 1 : 0) - (b.status === "installed" ? 1 : 0) || a.name.localeCompare(b.name))) {
    const k = key(l);
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }

  const copy = async () => {
    const text = [...groups].map(([k, ls]) => `${k}\n${ls.map((l) => `- ${qtyText(l.qty, l.unit)} ${l.name}${l.note ? ` (${l.note})` : ""}`).join("\n")}`).join("\n\n");
    try { await navigator.clipboard.writeText(`${jobs.find((j) => j.id === jobId)?.name ?? "Job"}: materials\n\n${text}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the embedded preview may not copy */ }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">Materials</h2>
        <button className="btn btn-primary btn-sm ml-auto" onClick={onAdd}>+ Add</button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[["To buy", String(toBuy)], ["Estimate", money(est)], ["Bought", money(spent)]].map(([k, v]) => (
          <div key={k} className="bg-panel-2 border border-line rounded-[3px] px-2.5 py-1.5"><p className="text-[11.5px] text-muted">{k}</p><p className="font-mono text-[15px] font-semibold">{v}</p></div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {(["open", "mine", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? "!text-accent-ink !bg-accent !border-accent" : "hover:text-text"}`}>{f === "open" ? "Still to get" : f === "mine" ? "I'm getting" : "All"}</button>
        ))}
        <select className="input !h-7 !w-auto !text-[12.5px] !py-0 ml-auto" value={group} onChange={(e) => setGroup(e.target.value as Group)} aria-label="Group by">
          <option value="where">By where it goes</option><option value="who">By who gets it</option><option value="store">By store</option><option value="status">By status</option>
        </select>
      </div>
      {shown.length ? [...groups].map(([k, ls]) => (
        <div key={k}>
          <p className="eyebrow !text-[12px] mb-1.5 flex items-center gap-2"><span className="truncate">{k}</span><span className="font-mono text-[11px] ml-auto">{money(ls.reduce((a, l) => a + lineTotal(l), 0))}</span></p>
          <div className="space-y-1.5">
            {ls.map((l) => (
              <LineRow key={l.id} line={l} plan={plan} open={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} onTick={() => onUpdate(l.id, { status: NEXT_STATUS[l.status] })}
                sub={group === "where" ? [l.store, members.find((m) => m.id === l.installer) ? `for ${members.find((m) => m.id === l.installer)!.full_name.split(" ")[0]}` : null, l.fulfil !== "pickup" ? FULFIL_LABEL[l.fulfil] : null, l.needed_by ? `by ${l.needed_by.slice(5)}` : null].filter(Boolean).join(" · ") || undefined : undefined}>
                <LineDetail line={l} plan={plan} jobs={jobs} stages={stages} onUpdate={(p) => onUpdate(l.id, p)} onRemove={() => onRemove(l.id)}
                  onShow={placed(l) ? () => onShow(l) : undefined} onSplit={(j, q) => onSplit(l, j, q)} />
              </LineRow>
            ))}
          </div>
        </div>
      )) : <p className="text-muted text-sm py-6 text-center">{mine.length ? "Nothing here." : "Nothing on the list yet. Pick anything on the plan (a room, a wall, a door, the sink) and tap what it needs, or press and hold a spot and choose Material."}</p>}
      <div className="flex gap-1.5 pt-1">
        <button className="btn btn-sm flex-1" onClick={copy}>{copied ? "Copied" : "Copy list"}</button>
        {onShoppingRun && <button className="btn btn-sm flex-1" onClick={onShoppingRun}>Shopping run, all jobs ›</button>}
      </div>
    </div>
  );
}
