"use client";
// What the client sees right after paying: a clear "it worked" and a receipt they can save or print.
import type { Brand, DocJob, Invoice, Payment } from "@/lib/billing/types";
import { fmt } from "@/lib/billing/money";
import { METHOD_LABEL, shortDate } from "@/lib/billing/payments";
import { BrandHeader, Paper, PoweredBy } from "./Brand";

export function PaymentReceipt({ payment, invoice, brand, job, remaining, onDone }: {
  payment: Payment; invoice: Invoice; brand: Brand; job: DocJob; remaining: number; onDone(): void;
}) {
  const color = brand.brand_color;
  const rows: [string, string][] = [
    ["Invoice", `${invoice.number} · ${invoice.title}`],
    ...(job.address ? [["Job", job.address] as [string, string]] : []),
    ["Paid with", [payment.reference, payment.method === "ach" ? null : METHOD_LABEL[payment.method]].filter(Boolean).join(" · ") || METHOD_LABEL[payment.method]],
    ...(payment.payer_name ? [["Paid by", payment.payer_name] as [string, string]] : []),
    ["Date", shortDate(payment.paid_at)],
    ["Receipt number", `R-${payment.id.slice(0, 8).toUpperCase()}`],
  ];

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-800 print:bg-white">
      <div className="h-1.5 print:hidden" style={{ background: color }} />
      <div className="mx-auto w-full max-w-[480px] px-4 pt-6 pb-10 space-y-4">
        <Paper className="!p-5 space-y-5 print:shadow-none">
          <BrandHeader brand={brand} />

          <div className="text-center pt-2">
            <span className="mx-auto w-16 h-16 rounded-full grid place-items-center" style={{ background: `${color}1f` }}>
              <svg viewBox="0 0 24 24" className="w-9 h-9" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
            <h1 className="mt-3 text-[24px] font-semibold text-neutral-900">Paid {fmt(payment.amount)} to {brand.name}</h1>
            <p className="text-[14px] text-neutral-500">Thanks{payment.payer_name ? `, ${payment.payer_name.split(" ")[0]}` : ""}. A copy of this receipt is yours to keep.</p>
          </div>

          {payment.method === "ach" && (
            <p className="rounded-[8px] bg-neutral-50 border border-neutral-200 px-3 py-2 text-[13.5px] text-neutral-600">Bank transfer, usually clears in 1 to 3 business days.</p>
          )}

          <dl className="divide-y divide-neutral-200 border-y border-neutral-200 text-[14px]">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-neutral-500 shrink-0">{k}</dt>
                <dd className="text-right text-neutral-900 min-w-0">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-neutral-500">Balance left</dt>
              <dd className="text-right font-semibold" style={remaining > 0 ? undefined : { color }}>{remaining > 0 ? fmt(remaining) : "Paid in full"}</dd>
            </div>
          </dl>

          <div className="grid gap-2 print:hidden">
            <button onClick={() => window.print()} className="h-12 rounded-[10px] border border-neutral-300 bg-white text-[15px] font-medium text-neutral-800 hover:border-neutral-500">Download receipt</button>
            <button onClick={onDone} className="h-12 rounded-[10px] text-white text-[15px] font-semibold hover:brightness-95" style={{ background: color }}>Back to your job</button>
          </div>
        </Paper>
        <PoweredBy brand={brand} />
      </div>
    </div>
  );
}
