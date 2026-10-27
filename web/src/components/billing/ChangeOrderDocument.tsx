"use client";
// The change order as the client sees it: the contractor's paper, what changed and why, the cost by room,
// days added, how it's billed and what the contract comes to with it. The client signs it like a quote.
import { useState } from "react";
import type { Brand, ChangeOrder, DocJob, Quote } from "@/lib/billing/types";
import { changeOrderTotals, fmt, lineTotal } from "@/lib/billing/money";
import { fmtDate } from "@/lib/billing/invoices";
import { CO_BILL_LABEL, signedFmt, type ContractTotal } from "@/lib/billing/changeOrders";
import { BrandHeader, Paper, PoweredBy } from "./Brand";
import { coGroups } from "./ChangeOrderEditor";

const pct = (r: number) => `${Math.round(r * 10000) / 100}%`;

export function ChangeOrderDocument({ co, quote, brand, job, contract, mode, onApprove, onDecline }: {
  co: ChangeOrder; quote: Quote; brand: Brand; job: DocJob; contract: ContractTotal; mode: "contractor" | "client";
  onApprove?(signedBy: string): void; onDecline?(): void;
}) {
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [declining, setDeclining] = useState(false);
  const t = changeOrderTotals(co);
  const color = brand.brand_color;
  const closed = co.status === "approved" || co.status === "declined";
  // the contract total counts approved change orders; show this one on its own line either way
  const before = contract.changes - (co.status === "approved" ? t.total : 0);
  const after = contract.original + before + (co.status === "declined" ? 0 : t.total);
  const days = co.days_added === 0 ? "No change to the schedule"
    : `${co.days_added > 0 ? "Adds" : "Saves"} ${Math.abs(co.days_added)} ${Math.abs(co.days_added) === 1 ? "day" : "days"}`;
  const billed = co.bill === "now" ? "Billed on its own invoice when approved, due in 14 days." : "Added to the final payment on the quote.";

  return (
    <Paper className="max-w-[760px] mx-auto text-[14px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <BrandHeader brand={brand} />
        <div className="sm:text-right">
          <p className="text-[22px] font-bold tracking-[0.14em]" style={{ color }}>CHANGE ORDER</p>
          <p className="font-mono text-[13px] text-neutral-700">{co.number}</p>
          <p className="text-[12.5px] text-neutral-500">For quote {quote.number}</p>
          <p className="text-[12.5px] text-neutral-500">Date {fmtDate(co.sent_at ?? co.created_at)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 border-t border-neutral-200 pt-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Prepared for</p>
          <p className="font-semibold text-neutral-900">{job.client_name || "Client"}</p>
          {[job.address, job.client_email, job.client_phone].filter(Boolean).map((x) => <p key={x} className="text-neutral-600 text-[13px]">{x}</p>)}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">The change</p>
          <p className="font-semibold text-neutral-900">{co.title || "Change order"}</p>
          {co.reason && <p className="text-neutral-600 text-[13px]">Why: {co.reason}</p>}
          <p className="text-neutral-600 text-[13px]">{job.name}</p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {co.lines.length === 0 && <p className="text-neutral-400 italic">No lines yet.</p>}
        {coGroups(co.lines).map((g) => (
          <section key={g.key}>
            <div className="flex items-center gap-2 border-b-2 pb-1 mb-1" style={{ borderColor: color }}>
              <h3 className="font-semibold text-neutral-900">{g.group}</h3>
              {g.room_id && <span className="tag !h-5 !text-[11px]">{g.room_id}</span>}
            </div>
            <ul className="divide-y divide-neutral-100">
              {g.lines.map((l) => (
                <li key={l.id} className="flex gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-800">{l.description || "Untitled line"}</p>
                    <p className="text-[12px] text-neutral-500">
                      {l.qty} {l.unit} × {fmt(l.unit_price)}
                      {l.unit_price < 0 && <span className="ml-2 rounded-[3px] px-1.5 py-px text-[11px] font-semibold bg-green-100 text-green-700">Credit</span>}
                    </p>
                  </div>
                  <p className={`shrink-0 tabular-nums font-medium ${lineTotal(l) < 0 ? "text-green-700" : "text-neutral-900"}`}>{fmt(lineTotal(l))}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-5 ml-auto max-w-[300px] space-y-1 text-[13.5px]">
        <Row k="Subtotal" v={fmt(t.subtotal)} />
        <Row k={`Tax (${pct(co.tax_rate)})`} v={fmt(t.tax)} />
        <div className="flex justify-between border-t-2 pt-2 mt-2 text-[17px] font-bold text-neutral-900" style={{ borderColor: color }}>
          <span>This change</span><span className="tabular-nums">{signedFmt(t.total, fmt)}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 text-[13px]">
        <div className="rounded-[6px] border border-neutral-200 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Schedule</p>
          <p className="font-semibold text-neutral-900">{days}</p>
        </div>
        <div className="rounded-[6px] border border-neutral-200 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">{"How it's billed"}</p>
          <p className="font-semibold text-neutral-900">{CO_BILL_LABEL[co.bill]}</p>
          <p className="text-neutral-600">{billed}</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">Contract total</p>
        <div className="border-y border-neutral-200 divide-y divide-neutral-100 text-[13.5px]">
          <TRow k={`Original quote ${quote.number}`} v={fmt(contract.original)} />
          <TRow k="Approved changes so far" v={signedFmt(before, fmt)} />
          <TRow k={`This change ${co.number}${co.status === "declined" ? " (declined)" : ""}`} v={signedFmt(t.total, fmt)} strike={co.status === "declined"} />
          <div className="flex justify-between py-2 font-bold text-neutral-900 text-[15px]"><span>New contract total</span><span className="tabular-nums">{fmt(after)}</span></div>
        </div>
      </div>

      {co.status === "approved" && (
        <div className="mt-6 rounded-[6px] border-2 border-green-600 text-green-700 px-4 py-3 text-center">
          <p className="font-bold tracking-wider uppercase text-[13px]">Approved</p>
          <p className="text-[13px]">Signed by <span className="font-semibold italic">{co.signed_by}</span>{co.approved_at && ` on ${fmtDate(co.approved_at)}`}</p>
        </div>
      )}
      {co.status === "declined" && (
        <div className="mt-6 rounded-[6px] border-2 border-red-500 text-red-600 px-4 py-3 text-center text-[13px]">
          <p className="font-bold tracking-wider uppercase">Declined</p>
          <p>This work will not go ahead.</p>
        </div>
      )}

      {mode === "client" && !closed && (
        <div className="mt-6 rounded-[6px] bg-neutral-50 border border-neutral-200 p-4 space-y-3">
          <p className="font-semibold text-neutral-900">Approve this change</p>
          <p className="text-[13px] text-neutral-600">Type your full name to sign. {co.bill === "now" ? `An invoice for ${fmt(t.total)} follows.` : "It is added to your final payment."}</p>
          <input className="w-full h-11 rounded-[4px] border border-neutral-300 bg-white px-3 text-[16px] text-neutral-900 italic placeholder:not-italic placeholder:text-neutral-400 focus:outline-none focus:border-neutral-500"
            placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <label className="flex items-start gap-2 text-[13px] text-neutral-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4" style={{ accentColor: color }} checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I agree to this change, its cost and the new contract total.
          </label>
          <button className="w-full h-11 rounded-[4px] text-white font-semibold disabled:opacity-40" style={{ background: color }}
            disabled={!name.trim() || !agree} onClick={() => onApprove?.(name.trim())}>
            Approve change · {signedFmt(t.total, fmt)}
          </button>
          <div className="text-center text-[12.5px] text-neutral-500">
            {declining ? (
              <span>Decline this change? <button className="underline text-red-600" onClick={() => onDecline?.()}>Yes, decline</button> · <button className="underline" onClick={() => setDeclining(false)}>Cancel</button></span>
            ) : (
              <button className="underline" onClick={() => setDeclining(true)}>Decline</button>
            )}
          </div>
        </div>
      )}

      <PoweredBy brand={brand} />
    </Paper>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-neutral-600"><span>{k}</span><span className="tabular-nums text-neutral-800">{v}</span></div>;
}

function TRow({ k, v, strike }: { k: string; v: string; strike?: boolean }) {
  return (
    <div className="flex justify-between py-2 text-neutral-600">
      <span>{k}</span><span className={`tabular-nums text-neutral-800 ${strike ? "line-through text-neutral-400" : ""}`}>{v}</span>
    </div>
  );
}
