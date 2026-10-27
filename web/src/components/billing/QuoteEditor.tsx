"use client";
// Build a quote in the job's side panel: lines by room, add-ons, tax, the payment plan. Once it has gone
// to the client it locks, and the contractor can only preview it.
import { useState } from "react";
import type { Draw, LineItem, Quote, Unit } from "@/lib/billing/types";
import type { Plan, Room } from "@/lib/plan/types";
import { fmt, lineTotal, newId, quoteTotals } from "@/lib/billing/money";
import { QuoteStatusChip } from "./QuoteList";
import { drawAmounts, groupLines, niceDate, pctLabel } from "./QuoteDocument";

const UNITS: Unit[] = ["ea", "sqft", "lf", "hr", "day", "lot"];
const WHOLE = "Whole house";

/** A number box that keeps what you type ("12.", "") and reports the parsed value. */
function NumInput({ value, onChange, className = "", step, disabled, prefix, suffix }: {
  value: number; onChange(n: number): void; className?: string; step?: string; disabled?: boolean; prefix?: string; suffix?: string;
}) {
  const [text, setText] = useState(String(value));
  const shown = parseFloat(text) === value || (text === "" && value === 0) ? text : String(value);
  return (
    <div className={`relative ${className}`}>
      {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-[13px] pointer-events-none">{prefix}</span>}
      <input className={`input !h-9 !text-[14px] tabular-nums ${prefix ? "!pl-6" : ""} ${suffix ? "!pr-7" : ""}`} inputMode="decimal" type="text" step={step} disabled={disabled}
        value={shown} onChange={(e) => { setText(e.target.value); onChange(parseFloat(e.target.value.replace(/[^0-9.\-]/g, "")) || 0); }} />
      {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted text-[13px] pointer-events-none">{suffix}</span>}
    </div>
  );
}

function Tags({ ids, max = 6 }: { ids: string[]; max?: number }) {
  if (!ids.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {ids.slice(0, max).map((id) => <span key={id} className="tag !h-5 !text-[11px]">{id}</span>)}
      {ids.length > max && <span className="text-[12px] text-muted self-center">+{ids.length - max} more</span>}
    </div>
  );
}

function Toggle({ on, label, onChange, disabled }: { on: boolean; label: string; onChange(v: boolean): void; disabled?: boolean }) {
  return (
    <label className={`inline-flex items-center gap-2 text-[13px] ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function QuoteEditor({ quote: q, plan, stageNames, onChange, onSend, onBack, onDelete, onPreview }: {
  quote: Quote; plan: Plan | null; stageNames: string[];
  onChange(q: Quote): void; onSend(): void; onBack(): void; onDelete(): void; onPreview(): void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const locked = q.status !== "draft";
  const rooms: Room[] = plan ? plan.floors.flatMap((f) => f.rooms.filter((r) => !r.outdoor)) : [];
  const t = quoteTotals(q);
  const amts = drawAmounts(q.schedule, t.total);
  const pctSum = q.schedule.reduce((s, d) => s + d.pct, 0);

  const set = (patch: Partial<Quote>) => onChange({ ...q, ...patch });
  // editing the lines makes it the contractor's quote, so the assistant badge goes
  const setLines = (lines: LineItem[], chosen = q.chosen) => set({ lines, chosen: chosen.filter((id) => lines.some((l) => l.id === id)), ai_drafted: false });
  const setLine = (id: string, patch: Partial<LineItem>) => setLines(q.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = (group = WHOLE, room_id: string | null = null) => {
    const l: LineItem = { id: newId(), group, room_id, description: "", qty: 1, unit: "ea", unit_price: 0, element_ids: [] };
    setLines([...q.lines, l]);
    setOpen(l.id);
  };
  const setDraw = (id: string, patch: Partial<Draw>) => set({ schedule: q.schedule.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const pickRoom = (l: LineItem, roomId: string) => {
    const r = rooms.find((x) => x.id === roomId);
    setLine(l.id, r ? { room_id: r.id, group: r.name, element_ids: l.room_id === r.id ? l.element_ids : [] } : { room_id: null, group: WHOLE, element_ids: [] });
  };

  const banner = q.status === "approved" ? `Approved by ${q.signed_by ?? "the client"}${q.approved_at ? ` on ${niceDate(q.approved_at, false)}` : ""}`
    : q.status === "declined" ? `Declined by the client${q.declined_at ? ` on ${niceDate(q.declined_at, false)}` : ""}`
    : q.status === "viewed" ? `The client opened it${q.viewed_at ? ` on ${niceDate(q.viewed_at, false)}` : ""}. Waiting on their answer.`
    : q.status === "sent" ? `Sent${q.sent_at ? ` on ${niceDate(q.sent_at, false)}` : ""}. Waiting on the client.` : null;

  return (
    <div className="flex flex-col min-h-full">
      <div className="p-4 space-y-4 flex-1">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm !px-2 -ml-2" onClick={onBack}>← Quotes</button>
          <span className="font-mono text-[12px] text-muted">{q.number}</span>
          <span className="ml-auto"><QuoteStatusChip status={q.status} /></span>
        </div>

        {q.ai_drafted && !locked && (
          <p className="chip !text-accent !border-accent/40">✦ Drafted by the assistant. Check prices before sending.</p>
        )}
        {banner && (
          <div className={`card !rounded-[3px] px-3 py-2.5 text-[13.5px] ${q.status === "approved" ? "!border-green/50 text-green" : q.status === "declined" ? "!border-red/50 text-red" : "!border-amber/50 text-amber"}`}>
            {banner}
            <span className="block text-muted text-[12.5px] mt-0.5">This quote is locked. Make a new one for changes.</span>
          </div>
        )}

        {locked ? (
          <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">{q.title || "Untitled quote"}</h2>
        ) : (
          <div>
            <label className="label">Title</label>
            <input className="input" value={q.title} placeholder="Kitchen renovation" onChange={(e) => set({ title: e.target.value })} />
          </div>
        )}

        {/* lines, by room */}
        <div className="space-y-3">
          <p className="eyebrow">Lines</p>
          {q.lines.length === 0 && <p className="text-[13.5px] text-muted">No lines yet. Add what you will do, room by room.</p>}
          {groupLines(q.lines).map((g) => (
            <section key={g.key} className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold">{g.group}</h3>
                {g.room_id && <span className="tag !h-5 !text-[11px]">{g.room_id}</span>}
                <span className="ml-auto text-[12.5px] text-muted tabular-nums">{fmt(g.lines.reduce((s, l) => s + (l.optional ? 0 : lineTotal(l)), 0))}</span>
              </div>
              {g.lines.map((l) => open === l.id && !locked ? (
                <div key={l.id} className="card !rounded-[3px] p-3 space-y-2.5 !border-accent/50">
                  <div className="flex gap-2">
                    <textarea className="input !text-[14px]" rows={2} autoFocus placeholder="What you will do" value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} />
                    <button className="w-8 h-8 shrink-0 rounded-[2px] text-muted hover:bg-panel-3 hover:text-red" title="Remove line"
                      onClick={() => setLines(q.lines.filter((x) => x.id !== l.id))}>×</button>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
                    <div><span className="label !mb-1 !text-[12px]">Qty</span><NumInput value={l.qty} onChange={(n) => setLine(l.id, { qty: n })} /></div>
                    <div>
                      <span className="label !mb-1 !text-[12px]">Unit</span>
                      <select className="input !h-9 !text-[14px]" value={l.unit} onChange={(e) => setLine(l.id, { unit: e.target.value as Unit })}>
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div><span className="label !mb-1 !text-[12px]">Unit price</span><NumInput prefix="$" value={l.unit_price / 100} onChange={(n) => setLine(l.id, { unit_price: Math.round(n * 100) })} /></div>
                  </div>
                  <div>
                    <span className="label !mb-1 !text-[12px]">Room</span>
                    <select className="input !h-9 !text-[14px]" value={l.room_id ?? ""} onChange={(e) => pickRoom(l, e.target.value)}>
                      <option value="">{WHOLE}</option>
                      {rooms.map((r) => <option key={r.id} value={r.id}>{`${r.name} · ${r.id}`}</option>)}
                    </select>
                  </div>
                  <Tags ids={l.element_ids} />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Toggle label="Optional add-on" on={!!l.optional} onChange={(v) => setLine(l.id, { optional: v || undefined })} />
                    <Toggle label="Taxable" on={l.taxable !== false} onChange={(v) => setLine(l.id, { taxable: v ? undefined : false })} />
                    <span className="ml-auto text-[14px] font-semibold tabular-nums">{fmt(lineTotal(l))}</span>
                  </div>
                  <button className="btn btn-sm w-full" onClick={() => setOpen(null)}>Done</button>
                </div>
              ) : (
                <button key={l.id} disabled={locked} onClick={() => setOpen(l.id)}
                  className="card !rounded-[3px] w-full px-3 py-2 text-left flex gap-3 enabled:hover:bg-panel-2 disabled:cursor-default">
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13.5px] leading-snug ${l.description ? "" : "text-muted italic"}`}>{l.description || "Untitled line"}</p>
                    <p className="text-[12px] text-muted mt-0.5">
                      {l.qty} {l.unit} × {fmt(l.unit_price)}
                      {l.optional && <span className="text-accent"> · optional{q.chosen.includes(l.id) ? ", chosen" : ""}</span>}
                      {l.taxable === false && " · no tax"}
                    </p>
                    {l.element_ids.length > 0 && <div className="mt-1"><Tags ids={l.element_ids} max={4} /></div>}
                  </div>
                  <span className={`shrink-0 text-[13.5px] tabular-nums ${l.optional && !q.chosen.includes(l.id) ? "text-muted" : ""}`}>{fmt(lineTotal(l))}</span>
                </button>
              ))}
              {!locked && <button className="text-[12.5px] text-muted hover:text-text px-1" onClick={() => addLine(g.group, g.room_id)}>+ Add to {g.group}</button>}
            </section>
          ))}
          {!locked && <button className="btn btn-sm w-full border-dashed" onClick={() => addLine()}>+ Add line</button>}
        </div>

        {/* tax, discount, totals */}
        <div className="card !rounded-[3px] p-3 space-y-2">
          {!locked && (
            <div className="grid grid-cols-2 gap-2 pb-1">
              <div><span className="label !mb-1 !text-[12px]">Tax rate</span><NumInput suffix="%" value={Math.round(q.tax_rate * 10000) / 100} onChange={(n) => set({ tax_rate: n / 100 })} /></div>
              <div><span className="label !mb-1 !text-[12px]">Discount</span><NumInput prefix="$" value={q.discount / 100} onChange={(n) => set({ discount: Math.max(0, Math.round(n * 100)) })} /></div>
            </div>
          )}
          <Sum k="Subtotal" v={fmt(t.subtotal)} />
          {t.discount > 0 && <Sum k="Discount" v={`−${fmt(t.discount)}`} />}
          <Sum k={`Tax (${pctLabel(q.tax_rate)})`} v={fmt(t.tax)} />
          <div className="flex justify-between border-t border-line pt-2 text-[16px] font-semibold"><span>Total</span><span className="tabular-nums">{fmt(t.total)}</span></div>
          {q.lines.some((l) => l.optional) && <p className="text-[12px] text-muted">Add-ons count once the client ticks them.</p>}
        </div>

        {/* payment plan */}
        <div className="space-y-2">
          <p className="eyebrow">Payment plan</p>
          {q.schedule.map((d, i) => locked ? (
            <div key={d.id} className="flex items-center gap-3 text-[13.5px] px-1">
              <span className="w-12 font-mono text-[12.5px] text-muted">{pctLabel(d.pct)}</span>
              <span className="flex-1 min-w-0 truncate">{d.label}<span className="text-muted"> · {d.stage_name ?? "At signing"}</span></span>
              <span className="tabular-nums">{fmt(amts[i])}</span>
            </div>
          ) : (
            <div key={d.id} className="card !rounded-[3px] p-2.5 space-y-2">
              <div className="flex gap-2">
                <input className="input !h-9 !text-[14px]" value={d.label} placeholder="Payment name" onChange={(e) => setDraw(d.id, { label: e.target.value })} />
                <button className="w-8 h-9 shrink-0 rounded-[2px] text-muted hover:bg-panel-3 hover:text-red" title="Remove payment"
                  onClick={() => set({ schedule: q.schedule.filter((x) => x.id !== d.id) })}>×</button>
              </div>
              <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                <NumInput suffix="%" value={Math.round(d.pct * 1000) / 10} onChange={(n) => setDraw(d.id, { pct: n / 100 })} />
                <select className="input !h-9 !text-[14px]" value={d.stage_name ?? ""} onChange={(e) => setDraw(d.id, { stage_name: e.target.value || null })}>
                  <option value="">At signing</option>
                  {stageNames.map((s) => <option key={s} value={s}>{`When ${s} is done`}</option>)}
                </select>
                <span className="text-[13.5px] tabular-nums w-[84px] text-right">{fmt(amts[i])}</span>
              </div>
            </div>
          ))}
          {Math.abs(pctSum - 1) > 0.0001 && q.schedule.length > 0 && (
            <p className="text-[12.5px] text-amber">The payments add up to {pctLabel(pctSum)}. They should add up to 100%.</p>
          )}
          {!locked && (
            <button className="text-[12.5px] text-muted hover:text-text px-1"
              onClick={() => set({ schedule: [...q.schedule, { id: newId(), label: "", pct: Math.max(0, Math.round((1 - pctSum) * 100) / 100), stage_name: stageNames[0] ?? null, invoice_id: null }] })}>
              + Add payment
            </button>
          )}
        </div>

        {/* notes, terms, valid until */}
        {locked ? (
          <div className="space-y-2 text-[13px] text-muted">
            {q.notes && <p><span className="text-text">Notes. </span>{q.notes}</p>}
            {q.terms && <p><span className="text-text">Terms. </span>{q.terms}</p>}
            {q.valid_until && <p>Valid until {niceDate(q.valid_until)}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div><label className="label">Notes for the client</label>
              <textarea className="input !text-[14px]" rows={2} value={q.notes ?? ""} placeholder="What is included, allowances, finishes" onChange={(e) => set({ notes: e.target.value || null })} /></div>
            <div><label className="label">Terms</label>
              <textarea className="input !text-[14px]" rows={2} value={q.terms ?? ""} placeholder="Start date, change orders, warranty" onChange={(e) => set({ terms: e.target.value || null })} /></div>
            <div><label className="label">Valid until</label>
              <input type="date" className="input !h-9 !text-[14px] [color-scheme:dark]" value={q.valid_until ?? ""} onChange={(e) => set({ valid_until: e.target.value || null })} /></div>
            <button className="text-[12.5px] text-muted hover:text-red" onClick={() => { if (confirm(`Delete ${q.number}? This can't be undone.`)) onDelete(); }}>Delete this draft</button>
          </div>
        )}
      </div>

      {/* always in reach: total and the next step */}
      <div className="sticky bottom-0 border-t border-line bg-panel p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="mr-auto min-w-0">
            <p className="text-[11.5px] text-muted leading-none">Total</p>
            <p className="text-[17px] font-semibold tabular-nums leading-tight">{fmt(t.total)}</p>
          </div>
          <button className="btn btn-sm" onClick={onPreview}>Preview</button>
          {!locked && <button className="btn btn-primary btn-sm" disabled={!q.lines.length} onClick={onSend}>Send to client</button>}
        </div>
        {!locked && !q.lines.length && <p className="text-[12px] text-muted text-right">Add a line before sending.</p>}
      </div>
    </div>
  );
}

function Sum({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-[13.5px] text-muted"><span>{k}</span><span className="tabular-nums text-text">{v}</span></div>;
}
