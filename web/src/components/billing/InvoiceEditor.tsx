"use client";
// One invoice in the side panel. A draft is edited here; once sent it becomes a read-only summary
// with what was paid, what is still owed, and the next things to do (remind, record a check, void).
import { useState } from "react";
import { amountDue, fmt, invoiceStatus, invoiceTotals, lineTotal, newId, paidOn, toCents } from "@/lib/billing/money";
import { fmtDate, KIND_LABEL } from "@/lib/billing/invoices";
import type { Invoice, LineItem, Payment, PaymentMethod, Unit } from "@/lib/billing/types";
import { InvoiceStatusChip } from "./InvoiceList";

const UNITS: Unit[] = ["ea", "sqft", "lf", "hr", "day", "lot"];
const METHOD: Record<PaymentMethod, string> = { card: "Card", ach: "Bank", check: "Check", cash: "Cash", other: "Other" };
const dollars = (c: number) => (c / 100).toFixed(2);

export function InvoiceEditor({ invoice, payments, onChange, onSend, onBack, onVoid, onPreview, onRecordPayment, onRemind }: {
  invoice: Invoice; payments: Payment[];
  onChange(i: Invoice): void; onSend(): void; onBack(): void; onVoid(): void; onPreview(): void; onRecordPayment(): void; onRemind(): void;
}) {
  const status = invoiceStatus(invoice, payments);
  const t = invoiceTotals(invoice);

  return (
    <div className="p-4 space-y-4">
      <div>
        <button className="btn btn-ghost btn-sm -ml-2.5 text-muted" onClick={onBack}>← Invoices</button>
        <div className="flex items-center gap-2 mt-1">
          <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">{invoice.number}</h2>
          <InvoiceStatusChip status={status} />
          <span className="flex-1" />
          <button className="btn btn-sm" onClick={onPreview}>Preview</button>
        </div>
        <p className="text-muted text-sm mt-1">
          {KIND_LABEL[invoice.kind]}{invoice.stage_name && invoice.kind === "progress" ? ` · when ${invoice.stage_name} is done` : ""}
          {invoice.issued_at ? ` · sent ${fmtDate(invoice.issued_at)}` : ""}
        </p>
      </div>
      {invoice.status === "draft"
        ? <DraftForm key={invoice.id} invoice={invoice} total={t.total} onChange={onChange} onSend={onSend} />
        : <Summary invoice={invoice} payments={payments} onVoid={onVoid} onRecordPayment={onRecordPayment} onRemind={onRemind} />}
    </div>
  );
}

function DraftForm({ invoice, total, onChange, onSend }: { invoice: Invoice; total: number; onChange(i: Invoice): void; onSend(): void }) {
  const set = (patch: Partial<Invoice>) => onChange({ ...invoice, ...patch });
  const setLine = (id: string, patch: Partial<LineItem>) => set({ lines: invoice.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const addLine = () => set({ lines: [...invoice.lines, { id: newId(), group: "", description: "", qty: 1, unit: "ea", unit_price: 0, room_id: null, element_ids: [] }] });
  const t = invoiceTotals(invoice);

  return (
    <>
      <div>
        <label className="label" htmlFor="inv-title">Title</label>
        <input id="inv-title" className="input" placeholder="e.g. Extra outlets in the garage" value={invoice.title} onChange={(e) => set({ title: e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <p className="eyebrow">Lines</p>
        {invoice.lines.map((l) => (
          <div key={l.id} className="card !rounded-[3px] p-2.5 space-y-2">
            <input className="input !h-9" placeholder="What you did" value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} />
            {(l.room_id || l.element_ids.length > 0) && (
              <div className="flex flex-wrap gap-1">{[l.room_id, ...l.element_ids].filter(Boolean).map((x) => <span key={x} className="tag">{x}</span>)}</div>
            )}
            <div className="flex items-center gap-1.5">
              <input aria-label="Quantity" className="input !h-9 !w-16 !px-2" inputMode="decimal" defaultValue={l.qty}
                onChange={(e) => setLine(l.id, { qty: parseFloat(e.target.value) || 0 })} />
              <select aria-label="Unit" className="input !h-9 !w-[72px] !px-1.5" value={l.unit} onChange={(e) => setLine(l.id, { unit: e.target.value as Unit })}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <div className="relative flex-1 min-w-0">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                <input aria-label="Price" className="input !h-9 !pl-5 !pr-2" inputMode="decimal" defaultValue={l.unit_price ? dollars(l.unit_price) : ""} placeholder="0.00"
                  onChange={(e) => setLine(l.id, { unit_price: toCents(e.target.value) })} />
              </div>
              <span className="w-[84px] text-right text-[13px] shrink-0">{fmt(lineTotal(l))}</span>
            </div>
            <div className="flex items-center gap-2 text-[12.5px] text-muted">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={l.taxable !== false} onChange={(e) => setLine(l.id, { taxable: e.target.checked })} /> Taxable
              </label>
              <span className="flex-1" />
              {invoice.lines.length > 1 && <button className="hover:text-red" onClick={() => set({ lines: invoice.lines.filter((x) => x.id !== l.id) })}>Remove</button>}
            </div>
          </div>
        ))}
        <button className="btn btn-sm btn-ghost text-muted" onClick={addLine}>+ Add a line</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="inv-tax">Tax %</label>
          <input id="inv-tax" className="input" inputMode="decimal" placeholder="0" defaultValue={invoice.tax_rate ? +(invoice.tax_rate * 100).toFixed(3) : ""}
            onChange={(e) => set({ tax_rate: (parseFloat(e.target.value) || 0) / 100 })} />
        </div>
        <div>
          <label className="label" htmlFor="inv-disc">Discount $</label>
          <input id="inv-disc" className="input" inputMode="decimal" placeholder="0.00" defaultValue={invoice.discount ? dollars(invoice.discount) : ""}
            onChange={(e) => set({ discount: toCents(e.target.value) })} />
        </div>
        <div className="col-span-2">
          <label className="label" htmlFor="inv-due">Due date</label>
          <input id="inv-due" type="date" className="input" value={invoice.due_date ?? ""} onChange={(e) => set({ due_date: e.target.value || null })} />
        </div>
        <div className="col-span-2">
          <label className="label" htmlFor="inv-notes">Notes for the client</label>
          <textarea id="inv-notes" className="input !h-20 py-2 resize-none" placeholder="Thanks for your business!" value={invoice.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value || null })} />
        </div>
      </div>

      <div className="card !rounded-[3px] p-3 text-[13.5px] space-y-1">
        <Row k="Subtotal" v={fmt(t.subtotal)} />
        {t.discount > 0 && <Row k="Discount" v={`-${fmt(t.discount)}`} />}
        {t.tax > 0 && <Row k={`Tax (${+(invoice.tax_rate * 100).toFixed(3)}%)`} v={fmt(t.tax)} />}
        <div className="flex justify-between pt-1 border-t border-line font-semibold text-[15px]"><span>Total</span><span>{fmt(t.total)}</span></div>
      </div>

      <div>
        <button className="btn btn-primary w-full" disabled={total <= 0} onClick={onSend}>Send to client</button>
        {total <= 0 && <p className="text-[12.5px] text-muted mt-1.5 text-center">Add a line with a price to send this.</p>}
      </div>
    </>
  );
}

function Summary({ invoice, payments, onVoid, onRecordPayment, onRemind }: {
  invoice: Invoice; payments: Payment[]; onVoid(): void; onRecordPayment(): void; onRemind(): void;
}) {
  const [confirming, setConfirming] = useState(false);
  const status = invoiceStatus(invoice, payments);
  const total = invoiceTotals(invoice).total, paid = paidOn(invoice.id, payments), due = amountDue(invoice, payments);
  const mine = payments.filter((p) => p.invoice_id === invoice.id).sort((a, b) => a.paid_at.localeCompare(b.paid_at));
  const open = status !== "void" && status !== "paid";

  return (
    <>
      {invoice.title && <p className="text-[15px]">{invoice.title}</p>}
      <div className="grid grid-cols-3 gap-1.5">
        <Stat k="Total" v={fmt(total)} />
        <Stat k="Paid" v={fmt(paid)} tone={paid > 0 ? "text-green" : ""} />
        <Stat k="Due" v={status === "void" ? "-" : fmt(due)} tone={status === "overdue" ? "text-red" : due > 0 ? "text-amber" : ""} />
      </div>
      {invoice.due_date && open && (
        <p className={`text-[12.5px] ${status === "overdue" ? "text-red" : "text-muted"}`}>{status === "overdue" ? "Was due" : "Due"} {fmtDate(invoice.due_date)}</p>
      )}

      <div className="space-y-1.5">
        <p className="eyebrow">Payments</p>
        {mine.length === 0 ? <p className="text-[13px] text-muted">No payments yet.</p> : (
          <ul className="card !rounded-[3px] divide-y divide-line">
            {mine.map((p) => (
              <li key={p.id} className="px-3 py-2 flex items-center gap-2 text-[13px]">
                <div className="flex-1 min-w-0">
                  <p className={p.status === "failed" || p.status === "refunded" ? "line-through text-muted" : ""}>{METHOD[p.method]}{p.reference ? ` · ${p.reference}` : ""}</p>
                  <p className="text-[12px] text-muted">{fmtDate(p.paid_at)}{p.status !== "succeeded" ? ` · ${p.status}` : ""}</p>
                </div>
                <span className={p.status === "succeeded" ? "text-green" : "text-muted"}>{fmt(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && (
        <div className="grid grid-cols-2 gap-1.5">
          <button className="btn btn-primary" onClick={onRemind}>Send a reminder</button>
          <button className="btn" onClick={onRecordPayment}>Record a payment</button>
        </div>
      )}
      {open && <p className="text-[12.5px] text-muted -mt-2">Got cash or a check? Record it so the balance stays right.</p>}

      {open && (confirming ? (
        <div className="card !rounded-[3px] !border-red/50 p-3 space-y-2">
          <p className="text-[13.5px]">Void {invoice.number}? The client can no longer pay it. This can&apos;t be undone.</p>
          <div className="flex gap-1.5">
            <button className="btn btn-sm !bg-red !border-red !text-white" onClick={() => { setConfirming(false); onVoid(); }}>Yes, void it</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setConfirming(false)}>Keep it</button>
          </div>
        </div>
      ) : <button className="btn btn-sm btn-ghost text-muted hover:!text-red" onClick={() => setConfirming(true)}>Void invoice</button>)}

      {invoice.notes && <p className="text-[12.5px] text-muted border-l-2 border-line pl-2">{invoice.notes}</p>}
    </>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between text-muted"><span>{k}</span><span className="text-text">{v}</span></div>;
const Stat = ({ k, v, tone = "" }: { k: string; v: string; tone?: string }) => (
  <div className="card !rounded-[3px] px-2.5 py-2 min-w-0">
    <p className="text-[11.5px] text-muted uppercase tracking-wide">{k}</p>
    <p className={`text-[15px] font-semibold truncate ${tone}`}>{v}</p>
  </div>
);
