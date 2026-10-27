"use client";
// The job's invoices in the side panel: what was billed, what is still owed, and where each one stands.
import { amountDue, fmt, invoiceStatus, invoiceTotals } from "@/lib/billing/money";
import type { Invoice, InvoiceStatus, Payment } from "@/lib/billing/types";

const STATUS: Record<InvoiceStatus, { label: string; cls: string; dot: string }> = {
  draft: { label: "Draft", cls: "", dot: "bg-muted" },
  sent: { label: "Sent", cls: "!text-amber", dot: "bg-amber" },
  viewed: { label: "Viewed", cls: "!text-amber", dot: "bg-amber" },
  partial: { label: "Part paid", cls: "!text-amber", dot: "bg-amber" },
  overdue: { label: "Overdue", cls: "!text-red !border-red/50", dot: "bg-red" },
  paid: { label: "Paid", cls: "!text-green !border-green/50", dot: "bg-green" },
  void: { label: "Void", cls: "line-through", dot: "bg-muted" },
};

export function InvoiceStatusChip({ status }: { status: InvoiceStatus }) {
  const s = STATUS[status];
  return <span className={`chip ${s.cls}`}><span className={`dot ${s.dot}`} />{s.label}</span>;
}

export function InvoiceList({ invoices, payments, onOpen, onNew }: {
  invoices: Invoice[]; payments: Payment[]; onOpen(id: string): void; onNew(): void;
}) {
  const owed = invoices.filter((i) => i.status !== "draft" && i.status !== "void").reduce((s, i) => s + amountDue(i, payments), 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">Invoices</h2>
          {invoices.length > 0 && <p className="text-muted text-sm mt-1">{owed ? `${fmt(owed)} still owed` : "Nothing owed right now"}</p>}
        </div>
        <button className="btn btn-sm btn-primary shrink-0" onClick={onNew}>+ New invoice</button>
      </div>

      {invoices.length === 0 ? (
        <div className="card px-4 py-6 text-center">
          <p className="text-[14px]">No invoices yet</p>
          <p className="text-[12.5px] text-muted mt-1">The deposit invoice lands here when a quote is signed. Bill extra work any time.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {invoices.map((inv) => {
            const status = invoiceStatus(inv, payments);
            const total = invoiceTotals(inv).total, due = amountDue(inv, payments);
            const off = status === "void";
            return (
              <li key={inv.id}>
                <button onClick={() => onOpen(inv.id)} className={`card !rounded-[3px] w-full text-left px-3 py-2.5 hover:bg-panel-2 ${status === "overdue" ? "overdue-edge !border-red/50" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-muted shrink-0">{inv.number}</span>
                    <span className={`flex-1 min-w-0 truncate text-[14px] ${off ? "text-muted line-through" : ""}`}>{inv.title || "Untitled invoice"}</span>
                    <InvoiceStatusChip status={status} />
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[12.5px] text-muted">
                    <span className="flex-1 min-w-0 truncate">{inv.kind === "progress" && inv.stage_name ? `When ${inv.stage_name} is done` : inv.kind === "standard" ? "Extra work" : inv.kind === "final" ? "Final payment" : "Deposit"}</span>
                    <span className={off ? "line-through" : ""}>{fmt(total)}</span>
                    {!off && status !== "draft" && due > 0 && due < total && <span className="text-text">{fmt(due)} due</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
