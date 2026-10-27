"use client";
// The invoice as the client sees it: the contractor's branded paper, what it's for, what was paid and
// what is still due, with a pay button on the client's copy. The contractor previews the same page.
import { amountDue, fmt, invoiceStatus, invoiceTotals, lineTotal, paidOn } from "@/lib/billing/money";
import { drawAmounts, fmtDate } from "@/lib/billing/invoices";
import type { Brand, DocJob, Invoice, Payment, PaymentMethod, Quote } from "@/lib/billing/types";
import { BrandHeader, Paper, PoweredBy } from "./Brand";

const METHOD: Record<PaymentMethod, string> = { card: "Card", ach: "Bank transfer", check: "Check", cash: "Cash", other: "Payment" };

/** Pass all of the job's payments, so the payment plan can show which earlier draws are paid. */
export function InvoiceDocument({ invoice, quote, brand, job, payments, mode, onPay }: {
  invoice: Invoice; quote: Quote | null; brand: Brand; job: DocJob; payments: Payment[]; mode: "contractor" | "client"; onPay?(): void;
}) {
  const t = invoiceTotals(invoice);
  const status = invoiceStatus(invoice, payments);
  const due = amountDue(invoice, payments);
  const received = payments.filter((p) => p.invoice_id === invoice.id && p.status === "succeeded").sort((a, b) => a.paid_at.localeCompare(b.paid_at));
  const draw = quote?.schedule.find((d) => d.id === invoice.draw_id);
  const isVoid = status === "void";
  const muted = "text-neutral-500";

  return (
    <Paper className="relative max-w-[720px] mx-auto overflow-hidden">
      {isVoid && <p className="absolute top-6 right-[-44px] rotate-45 bg-neutral-700 text-white text-[12px] font-bold tracking-[0.2em] px-12 py-1">VOID</p>}

      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:justify-between">
        <BrandHeader brand={brand} />
        <div className="sm:text-right text-[12.5px] leading-relaxed">
          <p className="text-[22px] font-bold tracking-[0.12em] text-neutral-900" style={{ color: brand.brand_color }}>INVOICE</p>
          <p className="font-mono text-neutral-900">{invoice.number}</p>
          {invoice.issued_at && <p className={muted}>Issued {fmtDate(invoice.issued_at)}</p>}
          {invoice.due_date && <p className={status === "overdue" ? "text-red-600 font-semibold" : muted}>Due {fmtDate(invoice.due_date)}</p>}
        </div>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-4 text-[13px]">
        <div>
          <p className={`text-[11px] uppercase tracking-wider ${muted}`}>Bill to</p>
          <p className="font-semibold text-neutral-900">{job.client_name || "Client"}</p>
          {job.address && <p>{job.address}</p>}
          {[job.client_email, job.client_phone].filter(Boolean).map((x) => <p key={x} className={muted}>{x}</p>)}
        </div>
        <div className="sm:text-right">
          <p className={`text-[11px] uppercase tracking-wider ${muted}`}>For</p>
          <p className="font-semibold text-neutral-900">{invoice.title || job.name}</p>
          {quote && <p className={muted}>For quote {quote.number}{draw ? ` · ${draw.label}` : ""}</p>}
          {!quote && <p className={muted}>{job.name}</p>}
        </div>
      </div>

      <div className="mt-6 border-t border-neutral-200">
        {invoice.lines.map((l) => {
          const tags = [l.room_id, ...l.element_ids].filter(Boolean) as string[];
          return (
            <div key={l.id} className="flex gap-3 py-3 border-b border-neutral-200 text-[13.5px]">
              <div className="flex-1 min-w-0">
                <p className="text-neutral-900">{l.description || "Item"}</p>
                {(l.qty !== 1 || l.unit !== "lot") && <p className={`text-[12px] ${muted}`}>{l.qty} {l.unit} × {fmt(l.unit_price)}</p>}
                {tags.length > 0 && <div className="flex flex-wrap gap-1 mt-1.5">{tags.map((x) => <span key={x} className="tag">{x}</span>)}</div>}
              </div>
              <p className="shrink-0 text-neutral-900 tabular-nums">{fmt(lineTotal(l))}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 ml-auto w-full sm:w-[280px] text-[13.5px] space-y-1 tabular-nums">
        <Line k="Subtotal" v={fmt(t.subtotal)} />
        {t.discount > 0 && <Line k="Discount" v={`-${fmt(t.discount)}`} />}
        {t.tax > 0 && <Line k={`Tax (${+(invoice.tax_rate * 100).toFixed(3)}%)`} v={fmt(t.tax)} />}
        <div className="flex justify-between pt-1.5 border-t border-neutral-300 font-semibold text-neutral-900 text-[15px]"><span>Total</span><span>{fmt(t.total)}</span></div>
        {received.map((p) => <Line key={p.id} k={`${METHOD[p.method]} ${fmtDate(p.paid_at)}`} v={`-${fmt(p.amount)}`} />)}
      </div>

      {status === "paid" ? (
        <div className="mt-6 flex justify-center">
          <p className="border-[3px] border-green-600 text-green-700 rounded-[6px] px-5 py-2 font-bold uppercase tracking-[0.14em] text-[15px] -rotate-2">
            Paid in full · {fmtDate(received.at(-1)?.paid_at ?? null)}
          </p>
        </div>
      ) : !isVoid && (
        <div className="mt-6 rounded-[6px] p-4 sm:p-5 flex items-center justify-between gap-3" style={{ background: `${brand.brand_color}14`, border: `1px solid ${brand.brand_color}55` }}>
          <div>
            <p className={`text-[12px] uppercase tracking-wider ${muted}`}>Amount due</p>
            {invoice.due_date && <p className={`text-[12.5px] ${status === "overdue" ? "text-red-600" : muted}`}>{status === "overdue" ? "Past due since" : "By"} {fmtDate(invoice.due_date)}</p>}
          </div>
          <p className="text-[28px] sm:text-[34px] font-bold text-neutral-900 tabular-nums leading-none">{fmt(due)}</p>
        </div>
      )}

      {mode === "client" && due > 0 && !isVoid && status !== "draft" && (
        <button onClick={onPay} className="mt-3 w-full h-12 rounded-[6px] text-white font-semibold text-[16px] shadow-[inset_0_-3px_0_rgb(0_0_0/.2)] hover:brightness-105 active:translate-y-px"
          style={{ background: brand.brand_color }}>
          Pay {fmt(due)}
        </button>
      )}

      {quote && quote.schedule.length > 1 && <Plan quote={quote} current={invoice.draw_id} payments={payments} />}

      {invoice.notes && <p className={`mt-6 text-[13px] ${muted} whitespace-pre-line`}>{invoice.notes}</p>}
      {(brand.phone || brand.email) && (
        <p className={`mt-6 text-[12px] ${muted} text-center`}>Questions about this invoice? {[brand.phone, brand.email].filter(Boolean).join(" · ")}</p>
      )}
      <PoweredBy brand={brand} />
    </Paper>
  );
}

/** The quote's payment plan, so the client sees where this bill fits. */
function Plan({ quote, current, payments }: { quote: Quote; current: string | null; payments: Payment[] }) {
  const amounts = drawAmounts(quote);
  return (
    <div className="mt-6">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">Payment plan for {quote.number}</p>
      <ol className="space-y-1.5">
        {quote.schedule.map((d) => {
          const amt = amounts[d.id] ?? 0;
          const state = !d.invoice_id ? "Upcoming" : paidOn(d.invoice_id, payments) >= amt && amt > 0 ? "Paid" : "Invoiced";
          const here = d.id === current;
          return (
            <li key={d.id} className={`flex items-center gap-2 text-[13px] ${here ? "font-semibold text-neutral-900" : "text-neutral-600"}`}>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${state === "Paid" ? "bg-green-600" : state === "Invoiced" ? "bg-amber-400" : "bg-neutral-300"}`} />
              <span className="flex-1 min-w-0 truncate">{d.label}{here ? " (this invoice)" : ""}</span>
              <span className="text-[12px] text-neutral-500 shrink-0">{state}</span>
              <span className="w-[92px] text-right tabular-nums shrink-0">{fmt(amt)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const Line = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between text-neutral-500"><span>{k}</span><span className="text-neutral-800">{v}</span></div>;
