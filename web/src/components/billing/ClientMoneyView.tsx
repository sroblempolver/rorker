"use client";
// The client's page, from a no-sign-in link like the crew links: their quotes to approve, their invoices
// to pay, and receipts. Approving a quote issues the deposit invoice on the spot, so they can pay it next.
import { useState } from "react";
import type { Billing, Brand, DocJob, Payment } from "@/lib/billing/types";
import { amountDue, fmt, invoiceStatus, invoiceTotals, quoteTotals } from "@/lib/billing/money";
import { BrandHeader, Paper, PoweredBy } from "./Brand";
import { ClientCheckout } from "./ClientCheckout";
import { InvoiceDocument } from "./InvoiceDocument";
import { PaymentReceipt } from "./PaymentReceipt";
import { QuoteDocument } from "./QuoteDocument";
import { approveQuote, logged, type ClientStart } from "./MoneyPanel";
import { approveChangeOrder, contractTotal, signedFmt } from "@/lib/billing/changeOrders";
import { changeOrderTotals } from "@/lib/billing/money";
import { ChangeOrderDocument } from "./ChangeOrderDocument";

type Screen = { kind: "home" } | { kind: "quote" | "invoice" | "pay" | "change"; id: string } | { kind: "receipt"; payment: Payment };

export function ClientMoneyView({ billing, brand, job, start, onChange, onBack }: {
  billing: Billing; brand: Brand; job: DocJob; start: ClientStart; onChange(b: Billing): void; onBack?(): void;
}) {
  const [b, setB] = useState(billing);
  const [screen, setScreen] = useState<Screen>(start ?? { kind: "home" });
  const update = (next: Billing) => { setB(next); onChange(next); };
  const go = (s: Screen) => { setScreen(s); window.scrollTo?.(0, 0); };
  // the client only sees what was sent to them
  const quotes = b.quotes.filter((q) => q.status !== "draft");
  const invoices = b.invoices.filter((i) => i.status !== "draft");
  const changes = (b.change_orders ?? []).filter((c) => c.status !== "draft");
  const back = <button className="text-[14px] text-neutral-300 hover:text-white mb-3" onClick={() => go({ kind: "home" })}>‹ Everything for this job</button>;

  let body: React.ReactNode;
  if (screen.kind === "quote") {
    const q = b.quotes.find((x) => x.id === screen.id)!;
    body = <>{back}<QuoteDocument quote={q} brand={brand} job={job} mode="client"
      onPick={(id) => update({ ...b, quotes: b.quotes.map((x) => (x.id === q.id ? { ...x, picked_option: id } : x)) })}
      onChoose={(lineId, on) => update({ ...b, quotes: b.quotes.map((x) => (x.id === q.id ? { ...x, chosen: on ? [...x.chosen, lineId] : x.chosen.filter((c) => c !== lineId) } : x)) })}
      onDecline={() => update({ ...b, quotes: b.quotes.map((x) => (x.id === q.id ? logged({ ...x, status: "declined", declined_at: new Date().toISOString() }, "Declined") : x)) })}
      onApprove={(name) => { const r = approveQuote(b, q.id, name); update(r.billing); if (r.deposit) go({ kind: "invoice", id: r.deposit.id }); }} /></>;
  } else if (screen.kind === "change") {
    const c = (b.change_orders ?? []).find((x) => x.id === screen.id)!;
    const q = b.quotes.find((x) => x.id === c.quote_id)!;
    body = <>{back}<ChangeOrderDocument co={c} quote={q} brand={brand} job={job} contract={contractTotal(b, q.id)} mode="client"
      onApprove={(name) => { const next = approveChangeOrder(b, c.id, name); update(next); const inv = next.change_orders?.find((x) => x.id === c.id)?.invoice_id; if (inv) go({ kind: "invoice", id: inv }); }}
      onDecline={() => update({ ...b, change_orders: (b.change_orders ?? []).map((x) => (x.id === c.id ? logged({ ...x, status: "declined" }, "Declined") : x)) })} /></>;
  } else if (screen.kind === "invoice") {
    const i = b.invoices.find((x) => x.id === screen.id)!;
    body = <>{back}
      {i.kind === "deposit" && i.status === "sent" && !b.payments.some((p) => p.invoice_id === i.id) && (
        <p className="mb-3 rounded-[6px] bg-green-50 text-green-800 text-[14px] px-4 py-3">Thanks, the quote is approved. Here is the deposit to get your job on the schedule.</p>
      )}
      <InvoiceDocument invoice={i} quote={b.quotes.find((q) => q.id === i.quote_id) ?? null} brand={brand} job={job} payments={b.payments} mode="client" onPay={() => go({ kind: "pay", id: i.id })} /></>;
  } else if (screen.kind === "pay") {
    const i = b.invoices.find((x) => x.id === screen.id)!;
    body = <ClientCheckout invoice={i} brand={brand} job={job} amountDue={amountDue(i, b.payments)} onCancel={() => go({ kind: "invoice", id: i.id })}
      onPaid={(p) => { update({ ...b, payments: [p, ...b.payments] }); go({ kind: "receipt", payment: p }); }} />;
  } else if (screen.kind === "receipt") {
    const i = b.invoices.find((x) => x.id === screen.payment.invoice_id)!;
    body = <PaymentReceipt payment={screen.payment} invoice={i} brand={brand} job={job} remaining={amountDue(i, b.payments)} onDone={() => go({ kind: "home" })} />;
  } else {
    const owed = invoices.filter((i) => i.status !== "void").reduce((s, i) => s + amountDue(i, b.payments), 0);
    const row = (key: string, title: string, sub: string, right: string, chip: [string, string], onClick: () => void) => (
      <button key={key} onClick={onClick} className="w-full text-left flex items-center gap-3 py-3 border-t border-neutral-200 first:border-t-0">
        <div className="flex-1 min-w-0"><p className="font-medium text-neutral-900 truncate">{title}</p><p className="text-[13px] text-neutral-500">{sub}</p></div>
        <div className="text-right shrink-0"><p className="font-semibold tabular-nums">{right}</p><span className={`text-[11.5px] font-semibold uppercase tracking-wide ${chip[1]}`}>{chip[0]}</span></div>
      </button>
    );
    body = (
      <Paper>
        <BrandHeader brand={brand} />
        <div className="mt-6 mb-5">
          <p className="text-[13px] uppercase tracking-wide text-neutral-500">Your job</p>
          <h1 className="text-[22px] font-semibold text-neutral-900 leading-tight">{job.name}</h1>
          <p className="text-neutral-500">{[job.address, job.client_name].filter(Boolean).join(" · ")}</p>
        </div>
        {owed > 0 && <div className="rounded-[6px] p-4 mb-5 text-white" style={{ background: brand.brand_color }}><p className="text-[13px] opacity-90">To pay now</p><p className="text-[28px] font-semibold tabular-nums">{fmt(owed)}</p></div>}
        {quotes.length > 0 && <><p className="text-[13px] uppercase tracking-wide text-neutral-500 mt-2">Quotes</p>
          {quotes.map((q) => row(q.id, `${q.title}`, q.number, fmt(quoteTotals(q).total),
            q.status === "approved" ? ["Approved", "text-green-700"] : q.status === "declined" ? ["Declined", "text-neutral-400"] : ["Waiting for you", "text-amber-600"], () => go({ kind: "quote", id: q.id })))}</>}
        {changes.length > 0 && <><p className="text-[13px] uppercase tracking-wide text-neutral-500 mt-5">Changes to the work</p>
          {changes.map((c) => row(c.id, c.title, c.number, signedFmt(changeOrderTotals(c).total, fmt),
            c.status === "approved" ? ["Approved", "text-green-700"] : c.status === "declined" ? ["Declined", "text-neutral-400"] : ["Waiting for you", "text-amber-600"], () => go({ kind: "change", id: c.id })))}</>}
        {invoices.length > 0 && <><p className="text-[13px] uppercase tracking-wide text-neutral-500 mt-5">Invoices</p>
          {invoices.map((i) => { const st = invoiceStatus(i, b.payments); return row(i.id, i.title, `${i.number}${i.due_date ? ` · due ${new Date(i.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`, fmt(invoiceTotals(i).total),
            st === "paid" ? ["Paid", "text-green-700"] : st === "void" ? ["Void", "text-neutral-400"] : st === "overdue" ? ["Overdue", "text-red-600"] : st === "partial" ? ["Part paid", "text-amber-600"] : ["To pay", "text-amber-600"], () => go({ kind: "invoice", id: i.id })); })}</>}
        {!quotes.length && !invoices.length && <p className="text-neutral-500">Nothing here yet. Quotes and invoices from {brand.name} will show up here.</p>}
        <PoweredBy brand={brand} />
      </Paper>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto bg-[#2a2b2f]">
      <div className="max-w-[720px] mx-auto px-3 sm:px-6 py-5">
        {onBack && <div className="flex items-center gap-2 mb-3"><span className="chip">Preview of the client&apos;s link · no sign-in</span><button className="btn btn-sm ml-auto" onClick={onBack}>Back to the job</button></div>}
        {body}
      </div>
    </div>
  );
}
