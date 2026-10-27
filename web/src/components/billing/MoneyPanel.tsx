"use client";
// The job's Money tab: quotes, invoices and payments in one place, joined up. An approved quote's
// payment plan becomes invoices (the deposit right away, each draw when its stage is done), and every
// payment lands on its invoice. All changes go out through `save`, so the same panel runs on memory now
// and on the server later.
import { useMemo, useState } from "react";
import type { JobStage } from "@/lib/data/types";
import type { Plan } from "@/lib/plan/types";
import type { Activity, Billing, Brand, ChangeOrder, DocJob, Invoice, Payment, Quote } from "@/lib/billing/types";
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
import { blankChangeOrder, contractQuote, contractTotal } from "@/lib/billing/changeOrders";
import { ChangeOrderDocument } from "./ChangeOrderDocument";
import { ChangeOrderEditor } from "./ChangeOrderEditor";
import { ChangeOrderList } from "./ChangeOrderList";
import { RoomCosts } from "./RoomCosts";
import { DEFAULT_MONEY_SETTINGS, MoneySettings, type MoneySettingsValue } from "./MoneySettings";

/** What the client link opens on: one quote or invoice, or everything for them. */
export type ClientStart = { kind: "quote" | "invoice" | "change"; id: string } | null;

export interface MoneyApi {
  save(b: Billing): void;
  /** show what the client sees on their link */
  openClient?(start: ClientStart): void;
  say(msg: string): void;
  /** show a room on the plan */
  showRoom?(roomId: string): void;
}

type View = "quotes" | "changes" | "invoices" | "payments";
const now = () => new Date().toISOString();
/** add a line to a document's timeline */
export const logged = <T extends { activity?: Activity[] }>(d: T, what: string, who?: string | null): T => ({ ...d, activity: [...(d.activity ?? []), { at: now(), what, who: who ?? null }] });

export function MoneyPanel({ initial, brand, job, jobId, plan, stages, api, connected, onConnect }: {
  initial: Billing; brand: Brand; job: DocJob; jobId: string; plan: Plan | null; stages: JobStage[]; api: MoneyApi; connected: boolean; onConnect(): void;
}) {
  const [b, setB] = useState(initial);
  const [view, setView] = useState<View>("quotes");
  const [open, setOpen] = useState<string | null>(null);
  const [doc, setDoc] = useState<{ kind: "quote" | "invoice" | "change"; id: string } | null>(null);
  const [settings, setSettings] = useState<MoneySettingsValue>(DEFAULT_MONEY_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [recording, setRecording] = useState<string | null>(null);
  const update = (next: Billing) => { setB(next); api.save(next); };
  const stageNames = stages.map((s) => s.name);
  const quoteNos = b.quotes.map((q) => q.number), invNos = b.invoices.map((i) => i.number);

  const setQuote = (q: Quote) => update({ ...b, quotes: b.quotes.map((x) => (x.id === q.id ? q : x)) });
  const cos = b.change_orders ?? [];
  const setCo = (c: ChangeOrder) => update({ ...b, change_orders: cos.map((x) => (x.id === c.id ? c : x)) });
  const cq = contractQuote(b);
  const contract = cq ? contractTotal(b, cq.id) : null;
  const client = job.client_name || "the client";
  const setInvoice = (i: Invoice) => update({ ...b, invoices: b.invoices.map((x) => (x.id === i.id ? i : x)) });

  // draws whose stage is done but not billed yet: offer to bill them
  const due = useMemo(() => b.quotes.filter((q) => q.status === "approved").flatMap((q) =>
    stages.filter((s) => s.status === "done").flatMap((s) => drawsDueForStage(q, s.name).map((d) => ({ q, d })))), [b.quotes, stages]);
  const billDraw = (q: Quote, drawId: string) => {
    const d = q.schedule.find((x) => x.id === drawId)!;
    const inv = invoiceForDraw(q, d, invNos, { issue: false }, cos);
    const quote = { ...q, schedule: q.schedule.map((x) => (x.id === d.id ? { ...x, invoice_id: inv.id } : x)) };
    update({ ...b, quotes: b.quotes.map((x) => (x.id === q.id ? quote : x)), invoices: [inv, ...b.invoices] });
    setView("invoices"); setOpen(inv.id);
    api.say(`${inv.number} is ready to check and send`);
  };

  const quote = view === "quotes" && open ? b.quotes.find((q) => q.id === open) : null;
  const invoice = view === "invoices" && open ? b.invoices.find((i) => i.id === open) : null;
  const co = view === "changes" && open ? cos.find((c) => c.id === open) : null;
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
        {tab("changes", "Changes", cos.filter((c) => c.status === "sent").length)}
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
        <QuoteEditor quote={quote} plan={plan} stageNames={stageNames} onChange={setQuote} onBack={() => setOpen(null)} clientName={job.client_name}
          onFollowUp={() => api.say(`Follow-up sent to ${client}`)}
          onPreview={() => setDoc({ kind: "quote", id: quote.id })}
          onDelete={() => { update({ ...b, quotes: b.quotes.filter((q) => q.id !== quote.id) }); setOpen(null); }}
          onSend={() => { setQuote(logged({ ...quote, status: "sent", sent_at: now() }, `Sent to ${client}`)); api.say(`Sent to ${client}`); api.openClient?.({ kind: "quote", id: quote.id }); }} />
      ) : (
        <QuoteList quotes={b.quotes} onOpen={setOpen}
          onNew={() => {
            const q = { ...draftQuote(plan ?? emptyPlan, jobId, quoteNos, stageNames), title: "New quote", lines: [], chosen: [], ai_drafted: false, options: [], picked_option: null, financing: settings.financing, activity: [] };
            update({ ...b, quotes: [q, ...b.quotes] }); setOpen(q.id);
          }}
          onDraft={() => {
            if (!plan) { api.say("Add the plan first, then the assistant can price it room by room"); return; }
            const q = draftQuote(plan, jobId, quoteNos, stageNames);
            update({ ...b, quotes: [q, ...b.quotes] }); setOpen(q.id);
            api.say(`Drafted ${q.number} from the plan: ${q.lines.length} lines. Check the prices before sending.`);
          }} />
      ))}
      {view === "quotes" && !quote && cq && (
        <div className="pt-2">
          <RoomCosts billing={b} plan={plan} onShowRoom={api.showRoom} />
        </div>
      )}

      {view === "changes" && (co ? (
        <ChangeOrderEditor co={co} plan={plan} onChange={setCo} onBack={() => setOpen(null)}
          onPreview={() => setDoc({ kind: "change", id: co.id })}
          onDelete={() => { update({ ...b, change_orders: cos.filter((c) => c.id !== co.id) }); setOpen(null); }}
          onFollowUp={() => { setCo(logged(co, `Follow-up sent to ${client}`)); api.say(`Follow-up sent to ${client}`); }}
          onSend={() => { setCo(logged({ ...co, status: "sent", sent_at: now() }, `Sent to ${client}`)); api.say(`${co.number} sent to ${client}`); api.openClient?.({ kind: "change", id: co.id }); }} />
      ) : (
        <ChangeOrderList changeOrders={cos} contract={contract} onOpen={setOpen}
          onNew={() => { if (!cq) return; const c = blankChangeOrder(cq, cos); update({ ...b, change_orders: [...cos, c] }); setOpen(c.id); }} />
      ))}

      {view === "invoices" && (invoice ? (
        <InvoiceEditor invoice={invoice} payments={b.payments} onChange={setInvoice} onBack={() => setOpen(null)}
          onPreview={() => setDoc({ kind: "invoice", id: invoice.id })}
          onSend={() => { setInvoice({ ...logged(invoice, `Sent to ${client}`), status: "sent", issued_at: invoice.issued_at ?? now(), due_date: invoice.due_date ?? new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10) }); api.say(`${invoice.number} sent to ${job.client_name || "the client"}`); api.openClient?.({ kind: "invoice", id: invoice.id }); }}
          onVoid={() => setInvoice({ ...invoice, status: "void" })}
          onRemind={() => { setInvoice(logged(invoice, `Reminder sent to ${client}`)); api.say(`Reminder sent to ${client} for ${invoice.number}`); }}
          onRecordPayment={() => setRecording(invoice.id)} />
      ) : (
        <InvoiceList invoices={b.invoices} payments={b.payments} onOpen={setOpen}
          onNew={() => { const i = blankInvoice(jobId, invNos); update({ ...b, invoices: [i, ...b.invoices] }); setOpen(i.id); }} />
      ))}

      {view === "payments" && (
        <PaymentsPanel billing={b} connected={connected} onConnect={onConnect} onOpenInvoice={(id) => { setView("invoices"); setOpen(id); }} />
      )}

      <div className="flex gap-2">
        {api.openClient && <button className="btn btn-ghost btn-sm flex-1" onClick={() => api.openClient!(null)}>See the client&apos;s page</button>}
        <button className="btn btn-ghost btn-sm flex-1" onClick={() => setShowSettings(true)}>Payment settings</button>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/70 overflow-y-auto" onClick={() => setShowSettings(false)}>
          <div className="max-w-lg mx-auto px-3 py-6" onClick={(e) => e.stopPropagation()}>
            <div className="card p-4">
              <div className="flex items-center mb-3">
                <h2 className="font-display text-[22px] font-extrabold uppercase">Payment settings</h2>
                <button className="btn btn-sm ml-auto" onClick={() => setShowSettings(false)}>Done</button>
              </div>
              <MoneySettings value={settings} onChange={setSettings} />
            </div>
          </div>
        </div>
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
            {doc.kind === "change"
              ? (() => { const c = cos.find((x) => x.id === doc.id)!; const q = b.quotes.find((x) => x.id === c.quote_id)!; return <ChangeOrderDocument co={c} quote={q} brand={brand} job={job} contract={contractTotal(b, q.id)} mode="contractor" />; })()
              : doc.kind === "quote"
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
  const signed: Quote = logged({ ...q, status: "approved", approved_at: now(), signed_by: signedBy }, `Approved, signed by ${signedBy}`, signedBy);
  const { quote, invoices } = invoicesOnApproval(signed, b.invoices.map((i) => i.number));
  return { billing: { ...b, quotes: b.quotes.map((x) => (x.id === q.id ? quote : x)), invoices: [...invoices, ...b.invoices] }, deposit: invoices[0] ?? null };
}

const emptyPlan = { floors: [] } as unknown as Plan;
