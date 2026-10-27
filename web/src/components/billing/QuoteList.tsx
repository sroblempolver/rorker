"use client";
// The job's quotes in the side panel: number, title, total and where each one stands.
import type { Quote, QuoteStatus } from "@/lib/billing/types";
import { fmt, quoteTotals } from "@/lib/billing/money";

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "text-muted" },
  sent: { label: "Sent", color: "text-amber" },
  viewed: { label: "Viewed", color: "text-amber" },
  approved: { label: "Approved", color: "text-green" },
  declined: { label: "Declined", color: "text-red" },
};

export function QuoteStatusChip({ status }: { status: QuoteStatus }) {
  const s = QUOTE_STATUS[status];
  return <span className={`chip ${s.color}`}><span className="dot bg-current" />{s.label}</span>;
}

export function QuoteList({ quotes, onOpen, onNew, onDraft }: { quotes: Quote[]; onOpen(id: string): void; onNew(): void; onDraft(): void }) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">Quotes</h2>
        {quotes.length > 0 && <span className="text-muted text-sm">{quotes.length}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" onClick={onNew}>+ New quote</button>
        <button className="btn btn-sm" onClick={onDraft} title="The assistant builds a quote from the rooms in the plan">Draft from the plan</button>
      </div>
      {quotes.length === 0 ? (
        <div className="card border-dashed p-4 text-[14px] text-muted space-y-1">
          <p className="text-text">No quotes yet.</p>
          <p>Start one from scratch, or let the assistant draft it from the rooms in the plan. You can edit everything before it goes out.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {quotes.map((q) => (
            <li key={q.id}>
              <button onClick={() => onOpen(q.id)} className="card !rounded-[3px] w-full px-3 py-2.5 text-left hover:bg-panel-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[12px] text-muted shrink-0">{q.number}</span>
                    <span className="text-[14px] truncate">{q.title || "Untitled quote"}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[13px]">
                    <span className="font-semibold tabular-nums">{fmt(quoteTotals(q).total)}</span>
                    <span className="text-muted">· {q.lines.length} {q.lines.length === 1 ? "line" : "lines"}</span>
                  </div>
                </div>
                <QuoteStatusChip status={q.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
