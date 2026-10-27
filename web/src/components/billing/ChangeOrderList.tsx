"use client";
// The job's change orders in the side panel: the contract total at the top (original quote plus approved
// changes), then each change order with its amount and where it stands.
import type { ChangeOrder, ChangeOrderStatus } from "@/lib/billing/types";
import { changeOrderTotals, fmt } from "@/lib/billing/money";
import { signedFmt, type ContractTotal } from "@/lib/billing/changeOrders";

export const CO_STATUS: Record<ChangeOrderStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "text-muted" },
  sent: { label: "Waiting", color: "text-amber" },
  approved: { label: "Approved", color: "text-green" },
  declined: { label: "Declined", color: "text-red" },
};

export function ChangeOrderStatusChip({ status }: { status: ChangeOrderStatus }) {
  const s = CO_STATUS[status];
  return <span className={`chip ${s.color}`}><span className="dot bg-current" />{s.label}</span>;
}

export function ChangeOrderList({ changeOrders, contract, onOpen, onNew }: {
  changeOrders: ChangeOrder[]; contract: ContractTotal | null; onOpen(id: string): void; onNew(): void;
}) {
  const waiting = changeOrders.filter((c) => c.status === "sent");
  const pending = waiting.reduce((s, c) => s + changeOrderTotals(c).total, 0);
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">Change orders</h2>
        {changeOrders.length > 0 && <span className="text-muted text-sm">{changeOrders.length}</span>}
      </div>

      {contract && (
        <div className="card !rounded-[3px] p-3 space-y-1.5 text-[13.5px]">
          <div className="flex justify-between text-muted"><span>Original quote</span><span className="tabular-nums text-text">{fmt(contract.original)}</span></div>
          <div className="flex justify-between text-muted">
            <span>Change orders</span>
            <span className={`tabular-nums ${contract.changes < 0 ? "text-red" : contract.changes > 0 ? "text-green" : "text-text"}`}>{signedFmt(contract.changes, fmt)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-[16px] font-semibold"><span>New contract total</span><span className="tabular-nums">{fmt(contract.total)}</span></div>
          {waiting.length > 0 && (
            <p className="text-[12.5px] text-amber">{waiting.length} waiting on the client ({signedFmt(pending, fmt)}). Not counted until approved.</p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <button className="btn btn-primary btn-sm" disabled={!contract} onClick={onNew}>+ New change order</button>
        {!contract && <p className="text-[12.5px] text-muted">Change orders need an approved quote first.</p>}
      </div>

      {changeOrders.length === 0 ? (
        <div className="card border-dashed p-4 text-[14px] text-muted space-y-1">
          <p className="text-text">No change orders yet.</p>
          <p>When the client asks for more, or you find something on site, write it up here. The client approves it before you do the work.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {changeOrders.map((c) => {
            const total = changeOrderTotals(c).total;
            return (
              <li key={c.id}>
                <button onClick={() => onOpen(c.id)} className="card !rounded-[3px] w-full px-3 py-2.5 text-left hover:bg-panel-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[12px] text-muted shrink-0">{c.number}</span>
                      <span className="text-[14px] truncate">{c.title || "Untitled change"}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[13px] min-w-0">
                      <span className={`font-semibold tabular-nums ${total < 0 ? "text-red" : ""}`}>{signedFmt(total, fmt)}</span>
                      {c.days_added !== 0 && <span className="text-muted shrink-0">· {c.days_added > 0 ? "+" : ""}{c.days_added} {Math.abs(c.days_added) === 1 ? "day" : "days"}</span>}
                      {c.reason && <span className="text-muted truncate">· {c.reason}</span>}
                    </div>
                  </div>
                  <ChangeOrderStatusChip status={c.status} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
