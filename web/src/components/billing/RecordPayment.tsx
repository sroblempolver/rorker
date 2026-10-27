"use client";
// Record a payment that didn't come through the link: a check, cash, or anything else.
import { useEffect, useState } from "react";
import type { Invoice, Payment } from "@/lib/billing/types";
import { fmt, toCents } from "@/lib/billing/money";
import { manualPayment } from "@/lib/billing/payments";

const METHODS = [["check", "Check"], ["cash", "Cash"], ["other", "Other"]] as const;

export function RecordPayment({ invoice, amountDue, onSave, onClose }: { invoice: Invoice; amountDue: number; onSave(p: Payment): void; onClose(): void }) {
  const [amt, setAmt] = useState((amountDue / 100).toFixed(2));
  const [method, setMethod] = useState<"check" | "cash" | "other">("check");
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [payer, setPayer] = useState("");

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const amount = toCents(amt);
  const over = amount > amountDue;
  const ok = amount > 0 && !over && !!date;
  const save = () => { if (ok) onSave(manualPayment({ invoice, amount, method, reference: ref, payerName: payer, date })); };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-label="Record a payment" className="w-full max-w-[440px] max-h-[calc(100vh-24px)] flex flex-col bg-panel border border-line border-t-[3px] border-t-accent rounded-[6px] shadow-2xl">
        <header className="flex items-center gap-2 px-4 h-12 border-b border-line shrink-0">
          <h2 className="font-display font-extrabold uppercase tracking-[0.08em] text-[15px]">Record a payment</h2>
          <button onClick={onClose} aria-label="Close" className="ml-auto w-8 h-8 grid place-items-center text-muted hover:text-text">✕</button>
        </header>
        <form className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4 space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <p className="text-[13.5px] text-muted">{invoice.number} · {invoice.title}. {fmt(amountDue)} still due.</p>

          <div>
            <label className="label" htmlFor="rp-amt">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
              <input id="rp-amt" className="input !pl-7 tabular-nums" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} autoFocus />
            </div>
            {over && <p className="mt-1 text-[12.5px] text-red">That&apos;s more than the {fmt(amountDue)} due.</p>}
          </div>

          <div>
            <span className="label">How they paid</span>
            <div className="flex gap-2">
              {METHODS.map(([m, l]) => (
                <button key={m} type="button" onClick={() => setMethod(m)} className={`chip !h-9 flex-1 justify-center !text-[13.5px] ${method === m ? "!text-accent !border-accent" : ""}`}>{l}</button>
              ))}
            </div>
          </div>

          {method !== "cash" && (
            <div>
              <label className="label" htmlFor="rp-ref">{method === "check" ? "Check number" : "Reference"}</label>
              <input id="rp-ref" className="input" placeholder={method === "check" ? "1043" : "e.g. Zelle, wire"} value={ref} onChange={(e) => setRef(e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="rp-date">Date received</label>
              <input id="rp-date" type="date" className="input [color-scheme:dark]" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="rp-payer">Paid by</label>
              <input id="rp-payer" className="input" placeholder="Optional" value={payer} onChange={(e) => setPayer(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary flex-[2]" disabled={!ok}>Record {amount > 0 ? fmt(amount) : "payment"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
