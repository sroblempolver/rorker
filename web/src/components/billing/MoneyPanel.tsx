"use client";
// The job's Money tab: quotes, invoices and payments in one place, joined up. An approved quote's
// payment plan becomes invoices (the deposit right away, each draw when its stage is done), and every
// payment lands on its invoice. All changes go out through `save`, so the same panel runs on memory now
// and on the server later.
import { useMemo, useState } from "react";
import type { JobStage } from "@/lib/data/types";
import type { Plan } from "@/lib/plan/types";
import type { Billing, Brand, DocJob, Invoice, Payment, Quote } from "@/lib/billing/types";
import { amountDue, fmt, quoteTotals } from "@/lib/billing/money";
import { draftQuote } from "@/lib/billing/draftQuote";
import { blankInvoice, drawsDueForStage, invoiceForDraw, invoicesOnApproval } from "@/lib/billing/invoices";
import { QuoteDocument } from "./QuoteDocument";
import { QuoteEditor } from "./QuoteEditor";
import { QuoteList } from "./QuoteList";
import { InvoiceDocument } from "./InvoiceDocument";
import { InvoiceEditor } from "./InvoiceEditor";
import { InvoiceList } from "./InvoiceList";
import { PaymentsPanel } from "./PaymentsPanel";
import { RecordPayment } from "./RecordPayment";

/** What the client link opens on: one quote or invoice, or everything for them. */
export type ClientStart = { kind: "quote" | "invoice"; id: string } | null;

export interface MoneyApi {
  save(b: Billing): void;
  /** show what the client sees on their link */
  openClient?(start: ClientStart): void;
  say(msg: string): void;
}

type View = "quotes" | "invoices" | "payments";
const now = () => new Date().toISOString();

export function MoneyPanel({ initial, brand, job, jobId, plan, stages, api, connected, onConnect }: {
  initial: Billing; brand: Brand; job: DocJob; jobId: string; plan: Plan | null; stages: JobStage[]; api: MoneyApi; connected: boolean; onConnect(): void;
}) {
  const [b, setB] = useState(initial);
  const [view, setView] = useState<View>("quotes");
  const [open, setOpen] = useState<string | null>(null);
  const [doc, setDoc] = useState<{ kind: "quote" | "invoice"; id: string } | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const update = (next: Billing) => { setB(next); api.save(next); };
  const stageNames = stages.map((s) => s.name);
  const quoteNos = b.quotes.map((q) => q.number), invNos = b.invoices.map((i) => i.number);

  const setQuote = (q: Quote) => update({ ...b, quotes: b.quotes.map((x) => (x.id === q.id ? q : x)) });
  const setInvoice = (i: Invoice) => update({ ...b, invoices: b.invoices.map((x) => (x.id === i.id ? i : x)) });

  // draws whose stage is done but not billed yet: offer to bill them
  const due = useMemo(() => b.quotes.filter((q) => q.status === "approved").flatMap((q) =>
    stages.filter((s) => s.status === "done").flatMap((s) => drawsDueForStage(q, s.name).map((d) => ({ q, d })))), [b.quotes, stages]);
  const billDraw = (q: Quote, drawId: string) => {
    const d = q.schedule.find((x) => x.id === drawId)!;
    const inv = invoiceForDraw(q, d, invNos, { issue: false });
    const quote = { ...q, schedule: q.schedule.map((x) => (x.id === d.id ? { ...x, invoice_id: inv.id } : x)) };
    update({ ...b, quotes: b.quotes.map((x) => (x.id === q.id ? quote : x)), invoices: [inv, ...b.invoices] });
    setView("invoices"); setOpen(inv.id);
    api.say(`${inv.number} is ready to check and send`);
  };

  const quote = view === "quotes" && open ? b.quotes.find((q) => q.id === open) : null;
  const invoice = view === "invoices" && open ? b.invoices.find((i) => i.id === open) : null;
  const tab = (v: View, label: string, n?: number) => (
    <button onClick={() => { setView(v); setOpen(null); }} className={`flex-1 h-9 rounded-[3px] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 ${view === v ? "bg-panel-3 text-text" : "text-muted hover:text-text"}`}>
      {label}{n ? <span className="font-mono text-[11px] bg-accent text-accent-ink rounded-[2px] px-1.5">{n}</span> : null}
    </button>
  );
  const unpaid = b.invoices.filter((i) => i.status !== "draft" && i.status !== "void" && amountDue(i, b.payments) > 0).length;

  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-1 p-1 rounded-[4px] bg-panel-2 border border-line">
        {tab("quotes", "Quotes", b.quotes.filter((q) => q.status === "draft").length)}
        {tab("invoices", "Invoices", unpaid)}
        {tab("payments", "Payments")}
      </div>

      {due.map(({ q, d }) => (
        <div key={d.id} className="card p-3 border-l-[3px] !border-l-accent">
          <p className="text-[14px]"><b>{d.stage_name}</b> is done. Bill the next payment?</p>
          <p className="text-[13px] text-muted mb-2">{d.label}: {Math.round(d.pct * 100)}% of {q.number}, {fmt(Math.round(quoteTotals(q).total * d.pct))}</p>
          <button className="btn btn-primary btn-sm" onClick={() => billDraw(q, d.id)}>Make the invoice</button>
        </div>
      ))}

      {view === "quotes" && (quote ? (
        <QuoteEditor quote={quote} plan={plan} stageNames={stageNames} onChange={setQuote} onBack={() => setOpen(null)}
          onPreview={() => setDoc({ kind: "quote", id: quote.id })}
          onDelete={() => { update({ ...b, quotes: b.quotes.filter((q) => q.id !== quote.id) }); setOpen(null); }}
          onSend={() => { setQuote({ ...quote, status: "sent", sent_at: now() }); api.say(`Sent to ${job.client_name || "the client"}`); api.openClient?.({ kind: "quote", id: quote.id }); }} />
      ) : (
        <QuoteList quotes={b.quotes} onOpen={setOpen}
          onNew={() => {
            const q = { ...draftQuote(plan ?? emptyPlan, jobId, quoteNos, stageNames), title: "New quote", lines: [], chosen: [], ai_drafted: false };
            update({ ...b, quotes: [q, ...b.quotes] }); setOpen(q.id);
          }}
          onDraft={() => {
            if (!plan) { api.say("Add the plan first, then the assistant can price it room by room"); return; }
            const q = draftQuote(plan, jobId, quoteNos, stageNames);
            update({ ...b, quotes: [q, ...b.quotes] }); setOpen(q.id);
            api.say(`Drafted ${q.number} from the plan: ${q.lines.length} lines. Check the prices before sending.`);
          }} />
      ))}

      {view === "invoices" && (invoice ? (
        <InvoiceEditor invoice={invoice} payments={b.payments} onChange={setInvoice} onBack={() => setOpen(null)}
          onPreview={() => setDoc({ kind: "invoice", id: invoice.id })}
          onSend={() => { setInvoice({ ...invoice, status: "sent", issued_at: invoice.issued_at ?? now(), due_date: invoice.due_date ?? new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10) }); api.say(`${invoice.number} sent to ${job.client_name || "the client"}`); api.openClient?.({ kind: "invoice", id: invoice.id }); }}
          onVoid={() => setInvoice({ ...invoice, status: "void" })}
          onRemind={() => api.say(`Reminder sent to ${job.client_name || "the client"} for ${invoice.number}`)}
          onRecordPayment={() => setRecording(invoice.id)} />
      ) : (
        <InvoiceList invoices={b.invoices} payments={b.payments} onOpen={setOpen}
          onNew={() => { const i = blankInvoice(jobId, invNos); update({ ...b, invoices: [i, ...b.invoices] }); setOpen(i.id); }} />
      ))}

      {view === "payments" && (
        <PaymentsPanel billing={b} connected={connected} onConnect={onConnect} onOpenInvoice={(id) => { setView("invoices"); setOpen(id); }} />
      )}

      {api.openClient && (
        <button className="btn btn-ghost btn-sm w-full" onClick={() => api.openClient!(null)}>See the client&apos;s page</button>
      )}

      {recording && (() => {
        const inv = b.invoices.find((i) => i.id === recording)!;
        return <RecordPayment invoice={inv} amountDue={amountDue(inv, b.payments)} onClose={() => setRecording(null)}
          onSave={(p: Payment) => { update({ ...b, payments: [p, ...b.payments] }); setRecording(null); api.say(`${fmt(p.amount)} recorded on ${inv.number}`); }} />;
      })()}

      {doc && (
        <div className="fixed inset-0 z-50 bg-black/70 overflow-y-auto" onClick={() => setDoc(null)}>
          <div className="max-w-3xl mx-auto px-3 py-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center mb-2">
              <span className="chip">What the client sees</span>
              <button className="btn btn-sm ml-auto" onClick={() => setDoc(null)}>Close</button>
            </div>
            {doc.kind === "quote"
              ? <QuoteDocument quote={b.quotes.find((q) => q.id === doc.id)!} brand={brand} job={job} mode="contractor" />
              : (() => { const i = b.invoices.find((x) => x.id === doc.id)!; return <InvoiceDocument invoice={i} quote={b.quotes.find((q) => q.id === i.quote_id) ?? null} brand={brand} job={job} payments={b.payments} mode="contractor" />; })()}
          </div>
        </div>
      )}
    </div>
  );
}

/** Approving a quote on the client's side: sign it, then the deposit invoice is issued. */
export function approveQuote(b: Billing, quoteId: string, signedBy: string): { billing: Billing; deposit: Invoice | null } {
  const q = b.quotes.find((x) => x.id === quoteId)!;
  const signed: Quote = { ...q, status: "approved", approved_at: now(), signed_by: signedBy };
  const { quote, invoices } = invoicesOnApproval(signed, b.invoices.map((i) => i.number));
  return { billing: { ...b, quotes: b.quotes.map((x) => (x.id === q.id ? quote : x)), invoices: [...invoices, ...b.invoices] }, deposit: invoices[0] ?? null };
}

const emptyPlan = { floors: [] } as unknown as Plan;
