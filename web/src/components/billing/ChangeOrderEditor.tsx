"use client";
// Write a change order in the side panel: what changed and why, the lines (credits are negative), days
// added and how it gets billed. Once it goes to the client it locks and shows its history.
import { useState } from "react";
import type { ChangeOrder, LineItem, Unit } from "@/lib/billing/types";
import type { Plan, Room } from "@/lib/plan/types";
import { changeOrderTotals, fmt, lineTotal, newId } from "@/lib/billing/money";
import { fmtDate } from "@/lib/billing/invoices";
import { CO_BILL_LABEL, CO_REASONS, signedFmt } from "@/lib/billing/changeOrders";
import { ChangeOrderStatusChip } from "./ChangeOrderList";

const UNITS: Unit[] = ["ea", "sqft", "lf", "hr", "day", "lot"];
const WHOLE = "Whole house";

/** Lines under their room heading, in first-seen order. */
export function coGroups(lines: LineItem[]) {
  const out: { key: string; group: string; room_id: string | null; lines: LineItem[] }[] = [];
  for (const l of lines) {
    const key = `${l.group || WHOLE}|${l.room_id ?? ""}`;
    let g = out.find((x) => x.key === key);
    if (!g) out.push(g = { key, group: l.group || WHOLE, room_id: l.room_id, lines: [] });
    g.lines.push(l);
  }
  return out;
}

const timeLabel = (s: string) => new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** A number box that keeps what you type ("-", "12.", "") and reports the parsed value. */
function Num({ value, onChange, prefix, suffix }: { value: number; onChange(n: number): void; prefix?: string; suffix?: string }) {
  const [text, setText] = useState(String(value));
  const shown = parseFloat(text) === value || ((text === "" || text === "-") && value === 0) ? text : String(value);
  return (
    <div className="relative">
      {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-[13px] pointer-events-none">{prefix}</span>}
      <input className={`input !h-9 !text-[14px] tabular-nums ${prefix ? "!pl-6" : ""} ${suffix ? "!pr-7" : ""}`} inputMode="decimal" type="text"
        value={shown} onChange={(e) => { setText(e.target.value); onChange(parseFloat(e.target.value.replace(/[^0-9.\-]/g, "")) || 0); }} />
      {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted text-[13px] pointer-events-none">{suffix}</span>}
    </div>
  );
}

export function ChangeOrderEditor({ co, plan, onChange, onSend, onBack, onDelete, onPreview, onFollowUp }: {
  co: ChangeOrder; plan: Plan | null;
  onChange(c: ChangeOrder): void; onSend(): void; onBack(): void; onDelete(): void; onPreview(): void; onFollowUp(): void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [otherReason, setOtherReason] = useState(!!co.reason && !(CO_REASONS as readonly string[]).includes(co.reason));
  const locked = co.status !== "draft";
  const rooms: Room[] = plan ? plan.floors.flatMap((f) => f.rooms.filter((r) => !r.outdoor)) : [];
  const t = changeOrderTotals(co);

  const set = (patch: Partial<ChangeOrder>) => onChange({ ...co, ...patch });
  const setLines = (lines: LineItem[]) => set({ lines });
  const setLine = (id: string, patch: Partial<LineItem>) => setLines(co.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = (group = WHOLE, room_id: string | null = null) => {
    const l: LineItem = { id: newId(), group, room_id, description: "", qty: 1, unit: "ea", unit_price: 0, element_ids: [] };
    setLines([...co.lines, l]);
    setOpen(l.id);
  };
  const pickRoom = (l: LineItem, roomId: string) => {
    const r = rooms.find((x) => x.id === roomId);
    setLine(l.id, r ? { room_id: r.id, group: r.name, element_ids: l.room_id === r.id ? l.element_ids : [] } : { room_id: null, group: WHOLE, element_ids: [] });
  };

  const banner = co.status === "approved" ? `Approved by ${co.signed_by ?? "the client"}${co.approved_at ? ` on ${fmtDate(co.approved_at)}` : ""}`
    : co.status === "declined" ? "Declined by the client"
    : co.status === "sent" ? `Sent${co.sent_at ? ` on ${fmtDate(co.sent_at)}` : ""}. Waiting on the client.` : null;
  const canSend = co.lines.length > 0 && !!co.title.trim();

  return (
    <div className="flex flex-col min-h-full">
      <div className="p-4 space-y-4 flex-1">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm !px-2 -ml-2" onClick={onBack}>← Change orders</button>
          <span className="font-mono text-[12px] text-muted">{co.number}</span>
          <span className="ml-auto"><ChangeOrderStatusChip status={co.status} /></span>
        </div>

        {banner && (
          <div className={`card !rounded-[3px] px-3 py-2.5 text-[13.5px] ${co.status === "approved" ? "!border-green/50 text-green" : co.status === "declined" ? "!border-red/50 text-red" : "!border-amber/50 text-amber"}`}>
            {banner}
            {co.status === "sent" && (
              <button className="btn btn-sm mt-2 w-full" onClick={onFollowUp}>Follow up</button>
            )}
          </div>
        )}

        {locked ? (
          <div className="space-y-1">
            <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">{co.title || "Untitled change"}</h2>
            {co.reason && <p className="text-[13px] text-muted">{co.reason}</p>}
          </div>
        ) : (
          <>
            <div>
              <label className="label">What changed</label>
              <input className="input" value={co.title} placeholder="Add two pot lights in the kitchen" onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div>
              <span className="label">Why</span>
              <div className="flex flex-wrap gap-1.5">
                {CO_REASONS.map((r) => {
                  const on = !otherReason && co.reason === r;
                  return (
                    <button key={r} className={`chip !h-8 ${on ? "!text-accent !border-accent" : "hover:text-text"}`}
                      onClick={() => { setOtherReason(false); set({ reason: on ? null : r }); }}>{r}</button>
                  );
                })}
                <button className={`chip !h-8 ${otherReason ? "!text-accent !border-accent" : "hover:text-text"}`}
                  onClick={() => { setOtherReason(!otherReason); set({ reason: null }); }}>Other</button>
              </div>
              {otherReason && (
                <input className="input mt-2 !h-9 !text-[14px]" autoFocus placeholder="Say why in a few words" value={co.reason ?? ""}
                  onChange={(e) => set({ reason: e.target.value || null })} />
              )}
            </div>
          </>
        )}

        {/* lines, by room */}
        <div className="space-y-3">
          <p className="eyebrow">Lines</p>
          {co.lines.length === 0 && <p className="text-[13.5px] text-muted">No lines yet.</p>}
          {coGroups(co.lines).map((g) => (
            <section key={g.key} className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold">{g.group}</h3>
                {g.room_id && <span className="tag !h-5 !text-[11px]">{g.room_id}</span>}
                <span className="ml-auto text-[12.5px] text-muted tabular-nums">{fmt(g.lines.reduce((s, l) => s + lineTotal(l), 0))}</span>
              </div>
              {g.lines.map((l) => open === l.id && !locked ? (
                <div key={l.id} className="card !rounded-[3px] p-3 space-y-2.5 !border-accent/50">
                  <div className="flex gap-2">
                    <textarea className="input !text-[14px]" rows={2} autoFocus placeholder="What you will do" value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} />
                    <button className="w-8 h-8 shrink-0 rounded-[2px] text-muted hover:bg-panel-3 hover:text-red" title="Remove line"
                      onClick={() => setLines(co.lines.filter((x) => x.id !== l.id))}>×</button>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
                    <div><span className="label !mb-1 !text-[12px]">Qty</span><Num value={l.qty} onChange={(n) => setLine(l.id, { qty: n })} /></div>
                    <div>
                      <span className="label !mb-1 !text-[12px]">Unit</span>
                      <select className="input !h-9 !text-[14px]" value={l.unit} onChange={(e) => setLine(l.id, { unit: e.target.value as Unit })}>
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div><span className="label !mb-1 !text-[12px]">Unit price</span><Num prefix="$" value={l.unit_price / 100} onChange={(n) => setLine(l.id, { unit_price: Math.round(n * 100) })} /></div>
                  </div>
                  <p className="text-[12px] text-muted">Use a minus price for a credit, like work you no longer do.</p>
                  <div>
                    <span className="label !mb-1 !text-[12px]">Room</span>
                    <select className="input !h-9 !text-[14px]" value={l.room_id ?? ""} onChange={(e) => pickRoom(l, e.target.value)}>
                      <option value="">{WHOLE}</option>
                      {rooms.map((r) => <option key={r.id} value={r.id}>{`${r.name} · ${r.id}`}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={l.taxable !== false}
                        onChange={(e) => setLine(l.id, { taxable: e.target.checked ? undefined : false })} />
                      Taxable
                    </label>
                    <span className={`ml-auto text-[14px] font-semibold tabular-nums ${lineTotal(l) < 0 ? "text-red" : ""}`}>{fmt(lineTotal(l))}</span>
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
                      {l.allowance && <span className="text-accent"> · allowance</span>}
                      {l.taxable === false && " · no tax"}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[13.5px] tabular-nums ${lineTotal(l) < 0 ? "text-red" : ""}`}>{fmt(lineTotal(l))}</span>
                </button>
              ))}
              {!locked && <button className="text-[12.5px] text-muted hover:text-text px-1" onClick={() => addLine(g.group, g.room_id)}>+ Add to {g.group}</button>}
            </section>
          ))}
          {!locked && <button className="btn btn-sm w-full border-dashed" onClick={() => addLine()}>+ Add line</button>}
        </div>

        {/* tax, schedule, billing */}
        <div className="card !rounded-[3px] p-3 space-y-3">
          {!locked ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="label !mb-1 !text-[12px]">Tax rate</span><Num suffix="%" value={Math.round(co.tax_rate * 10000) / 100} onChange={(n) => set({ tax_rate: n / 100 })} /></div>
                <div><span className="label !mb-1 !text-[12px]">Days added</span><Num value={co.days_added} onChange={(n) => set({ days_added: Math.round(n) })} /></div>
              </div>
              <div>
                <span className="label !mb-1 !text-[12px]">{"How it's billed"}</span>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-[3px] bg-panel-2 border border-line">
                  {(["now", "final"] as const).map((b) => (
                    <button key={b} onClick={() => set({ bill: b })}
                      className={`h-9 rounded-[2px] text-[13px] ${co.bill === b ? "bg-panel-3 text-text font-semibold" : "text-muted hover:text-text"}`}>
                      {CO_BILL_LABEL[b]}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-muted mt-1.5">
                  {co.bill === "now" ? "Its own invoice goes to the client as soon as they approve." : "Added to the last payment on the quote."}
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-1 text-[13.5px] text-muted">
              <p>{co.days_added === 0 ? "No change to the schedule" : `${co.days_added > 0 ? "Adds" : "Saves"} ${Math.abs(co.days_added)} ${Math.abs(co.days_added) === 1 ? "day" : "days"}`}</p>
              <p>{CO_BILL_LABEL[co.bill]}</p>
            </div>
          )}
          <div className="space-y-1 border-t border-line pt-2">
            <div className="flex justify-between text-[13.5px] text-muted"><span>Subtotal</span><span className="tabular-nums text-text">{fmt(t.subtotal)}</span></div>
            <div className="flex justify-between text-[13.5px] text-muted"><span>Tax</span><span className="tabular-nums text-text">{fmt(t.tax)}</span></div>
            <div className="flex justify-between border-t border-line pt-2 text-[16px] font-semibold">
              <span>This change</span><span className={`tabular-nums ${t.total < 0 ? "text-red" : ""}`}>{signedFmt(t.total, fmt)}</span>
            </div>
          </div>
        </div>

        {locked && (co.activity?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <p className="eyebrow">History</p>
            <ol className="space-y-2 border-l border-line ml-1.5 pl-3">
              {[...(co.activity ?? [])].reverse().map((a, i) => (
                <li key={`${a.at}-${i}`} className="text-[13px] relative">
                  <span className="dot bg-line absolute -left-[17px] top-1.5" />
                  <p>{a.what}{a.who ? <span className="text-muted"> · {a.who}</span> : null}</p>
                  <p className="text-[12px] text-muted">{timeLabel(a.at)}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {!locked && (
          <button className="text-[12.5px] text-muted hover:text-red" onClick={() => { if (confirm(`Delete ${co.number}? This can't be undone.`)) onDelete(); }}>Delete this draft</button>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-line bg-panel p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="mr-auto min-w-0">
            <p className="text-[11.5px] text-muted leading-none">This change</p>
            <p className={`text-[17px] font-semibold tabular-nums leading-tight ${t.total < 0 ? "text-red" : ""}`}>{signedFmt(t.total, fmt)}</p>
          </div>
          <button className="btn btn-sm" onClick={onPreview}>Preview</button>
          {!locked && <button className="btn btn-primary btn-sm" disabled={!canSend} onClick={onSend}>Send to client</button>}
        </div>
        {!locked && !canSend && <p className="text-[12px] text-muted text-right">{co.title.trim() ? "Add a line before sending." : "Say what changed before sending."}</p>}
      </div>
    </div>
  );
}
