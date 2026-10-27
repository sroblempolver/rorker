"use client";
// The job's money in the side panel: what's approved, billed and in the bank, every payment, and
// whether clients can pay online. Fees show here only, never to the client.
import type { Billing, Payment, PaymentStatus } from "@/lib/billing/types";
import { fmt, jobMoney } from "@/lib/billing/money";
import { METHOD_LABEL, addBusinessDays, shortDate } from "@/lib/billing/payments";

const STATUS: Record<PaymentStatus, [string, string]> = {
  succeeded: ["Paid", "bg-green"], processing: ["Clearing", "bg-amber"], failed: ["Failed", "bg-red"], refunded: ["Refunded", "bg-muted"],
};
const DAY = 864e5;

/** Online payments from the last 2 days, less fees, land in the bank 2 business days after the newest one. */
function nextPayout(payments: Payment[]) {
  const recent = payments.filter((p) => (p.method === "card" || p.method === "ach") && p.status === "succeeded" && Date.now() - +new Date(p.paid_at) < 2 * DAY);
  if (!recent.length) return null;
  const latest = Math.max(...recent.map((p) => +new Date(p.paid_at)));
  return { amount: recent.reduce((s, p) => s + p.amount - p.fee, 0), date: addBusinessDays(new Date(latest), 2) };
}

export function PaymentsPanel({ billing, onOpenInvoice, onConnect, connected }: { billing: Billing; onOpenInvoice(id: string): void; onConnect(): void; connected: boolean }) {
  const m = jobMoney(billing);
  const pct = m.approved ? Math.min(100, (m.collected / m.approved) * 100) : 0;
  const payments = [...billing.payments].sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  const number = (id: string) => billing.invoices.find((i) => i.id === id)?.number ?? "Invoice";
  const payout = nextPayout(billing.payments);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">Payments</h2>
        <span className="text-muted text-sm">{payments.length} received</span>
      </div>

      {connected ? (
        <div className="card !rounded-[3px] p-3 space-y-1.5">
          <span className="chip !text-green"><span className="dot bg-green" />Payouts on · test mode</span>
          <p className="text-[13.5px]">
            {payout ? <>Next payout: <b className="tabular-nums">{fmt(payout.amount)}</b> on {shortDate(payout.date)}</> : "No payout waiting. Card and bank payments land in your bank 2 business days after they come in."}
          </p>
        </div>
      ) : (
        <div className="card !rounded-[3px] border-l-[3px] !border-l-accent p-3 space-y-2.5">
          <div>
            <p className="text-[14.5px] font-semibold">Get paid online</p>
            <p className="text-[13px] text-muted">Connect your payout account so clients can pay by card or bank. Money goes straight to your bank.</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={onConnect}>Connect payouts</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {([["Approved", m.approved, ""], ["Invoiced", m.invoiced, ""], ["Collected", m.collected, "text-green"], ["Outstanding", m.outstanding, m.outstanding ? "text-amber" : ""]] as const).map(([l, v, c]) => (
          <div key={l} className="card !rounded-[3px] px-3 py-2">
            <p className="eyebrow !text-[11px]">{l}</p>
            <p className={`font-mono text-[16px] font-semibold tabular-nums ${c}`}>{fmt(v)}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="h-1.5 rounded-[1px] bg-panel-3 overflow-hidden"><div className="h-full bg-green" style={{ width: `${pct}%` }} /></div>
        <p className="mt-1 text-[12px] text-muted">{m.approved ? `${Math.round(pct)}% of the approved quote collected` : "No approved quote yet"}</p>
      </div>

      {payments.length ? (
        <ul className="space-y-1.5">
          {payments.map((p) => {
            const [label, dot] = STATUS[p.status];
            return (
              <li key={p.id}>
                <button onClick={() => onOpenInvoice(p.invoice_id)} className="card !rounded-[3px] w-full text-left px-3 py-2.5 flex items-center gap-3 hover:!border-chalk">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] truncate">{number(p.invoice_id)} · {p.reference ?? METHOD_LABEL[p.method]}</span>
                    <span className="block text-[11.5px] text-muted truncate">{shortDate(p.paid_at)}{p.payer_name ? ` · ${p.payer_name}` : ""}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block font-mono text-[14px] font-semibold tabular-nums">{fmt(p.amount)}</span>
                    <span className="block text-[11.5px] text-muted tabular-nums">{p.fee ? `${fmt(p.fee)} fee` : "No fee"}</span>
                  </span>
                  <span className="chip shrink-0"><span className={`dot ${dot}`} />{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">No payments yet. When a client pays an invoice, or you record a check, it shows here.</p>
      )}
    </div>
  );
}
