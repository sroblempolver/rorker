"use client";
// The quote as the client sees it: the contractor's letterhead on white paper, lines by room, the
// payment plan and, for the client, a place to pick a package and add-ons, see monthly payments and sign.
import { useState } from "react";
import type { Brand, DocJob, Draw, LineItem, Quote } from "@/lib/billing/types";
import { fmt, lineTotal, optionTotals, quoteLines, quoteTotals } from "@/lib/billing/money";
import { BrandHeader, Paper, PoweredBy } from "./Brand";

/** "2026-10-09" or an ISO time -> "Oct 9, 2026" (or "Oct 9" with year false). */
export function niceDate(s: string | null, year = true) {
  if (!s) return "";
  const d = new Date(s.length === 10 ? `${s}T12:00:00` : s);
  return d.toLocaleDateString("en-US", year ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
}

/** Lines under their heading, one section per room (two "Bathroom"s stay apart), in first-seen order. */
export function groupLines(lines: LineItem[]) {
  const out: { key: string; group: string; room_id: string | null; lines: LineItem[] }[] = [];
  for (const l of lines) {
    const key = `${l.group || "Other"}|${l.room_id ?? ""}`;
    let g = out.find((x) => x.key === key);
    if (!g) out.push(g = { key, group: l.group || "Other", room_id: l.room_id, lines: [] });
    g.lines.push(l);
  }
  return out;
}

/** Each draw's dollars from the total; the last one takes the rounding so they add up exactly. */
export function drawAmounts(schedule: Draw[], total: number) {
  const amts = schedule.map((d) => Math.round(total * d.pct));
  const sum = schedule.reduce((s, d) => s + d.pct, 0);
  if (amts.length && Math.abs(sum - 1) < 0.0001) amts[amts.length - 1] = total - amts.slice(0, -1).reduce((s, a) => s + a, 0);
  return amts;
}

export const pctLabel = (p: number) => `${Math.round(p * 1000) / 10}%`;

/** Each package with what it would total, plus the cheapest and dearest; null for a plain quote. */
export function packageTotals(q: Quote) {
  const opts = q.options ?? [];
  if (!opts.length) return null;
  const list = opts.map((o) => ({ ...o, total: optionTotals(q, o.id).total }));
  const ts = list.map((o) => o.total);
  return { list, min: Math.min(...ts), max: Math.max(...ts) };
}

/** Sample financing shown to clients: 9.99% APR. */
export const SAMPLE_APR = 0.0999;
export const FINANCE_TERMS = [12, 36, 60];
/** Monthly payment in cents for a loan of `cents` over `months` (standard amortization). */
export function monthlyPayment(cents: number, months: number, apr = SAMPLE_APR) {
  const r = apr / 12;
  return r ? Math.round((cents * r) / (1 - Math.pow(1 + r, -months))) : Math.round(cents / months);
}

const ALLOWANCE_NOTE = "Allowances are budgets. If your pick costs more or less, the difference is added or credited with a change order.";
const qtyLabel = (l: LineItem) => `${l.qty} ${l.unit} × ${fmt(l.unit_price)}`;

export function QuoteDocument({ quote, brand, job, mode, onApprove, onDecline, onChoose, onPick }: {
  quote: Quote; brand: Brand; job: DocJob; mode: "contractor" | "client";
  onApprove?(signedBy: string): void; onDecline?(): void; onChoose?(lineId: string, on: boolean): void;
  /** the client picked a package (good / better / best) */
  onPick?(optionId: string): void;
}) {
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [localPick, setLocalPick] = useState<string | null>(null);
  const [showFinance, setShowFinance] = useState(false);
  const closed = quote.status === "approved" || quote.status === "declined";
  const pkgs = packageTotals(quote);
  // until the parent stores the pick, keep it here so the page still answers the tap
  const picked = quote.picked_option ?? (mode === "client" ? localPick : null);
  const q: Quote = pkgs && picked ? { ...quote, picked_option: picked } : quote;
  const t = quoteTotals(q);
  const shown = quoteLines(q);
  const canChoose = mode === "client" && !closed && !!onChoose;
  const canPick = mode === "client" && !closed;
  const needsPick = !!pkgs && !picked;
  const amts = drawAmounts(q.schedule, t.total);
  const color = brand.brand_color;
  const pick = (id: string) => { setLocalPick(id); onPick?.(id); };
  const optName = (id: string | null | undefined) => quote.options?.find((o) => o.id === id)?.name;
  const viewing = optName(q.picked_option ?? quote.options?.[0]?.id);

  return (
    <Paper className="max-w-[760px] mx-auto text-[14px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <BrandHeader brand={brand} />
        <div className="sm:text-right">
          <p className="text-[22px] font-bold tracking-[0.14em]" style={{ color }}>QUOTE</p>
          <p className="font-mono text-[13px] text-neutral-700">{q.number}</p>
          <p className="text-[12.5px] text-neutral-500">Date {niceDate(q.sent_at ?? q.created_at)}</p>
          {q.valid_until && <p className="text-[12.5px] text-neutral-500">Valid until {niceDate(q.valid_until)}</p>}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 border-t border-neutral-200 pt-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Prepared for</p>
          <p className="font-semibold text-neutral-900">{job.client_name || "Client"}</p>
          {[job.address, job.client_email, job.client_phone].filter(Boolean).map((x) => <p key={x} className="text-neutral-600 text-[13px]">{x}</p>)}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Project</p>
          <p className="font-semibold text-neutral-900">{q.title || "Quote"}</p>
          <p className="text-neutral-600 text-[13px]">{job.name}</p>
        </div>
      </div>

      {pkgs && (
        <div className="mt-6 @container">
          <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">
            {canPick ? "Pick your package" : mode === "contractor" ? "Packages" : "Package"}
          </p>
          {canPick && needsPick && <p className="text-[13px] text-neutral-600 mb-2">Each package covers the same job. They differ in finishes. Tap one to see what is in it.</p>}
          <div className="grid gap-3 @lg:grid-cols-3 pt-2">
            {pkgs.list.map((o, i) => {
              const on = o.id === picked;
              const popular = pkgs.list.length === 3 && i === 1;
              const body = (
                <>
                  {popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white" style={{ background: color }}>Most picked</span>
                  )}
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900 text-[15px]">{o.name || `Package ${i + 1}`}</span>
                    {on && <span className="ml-auto grid h-5 w-5 place-items-center rounded-full text-white text-[12px]" style={{ background: color }} aria-hidden>✓</span>}
                  </span>
                  {o.blurb && <span className="block text-[12.5px] text-neutral-500 leading-snug mt-0.5">{o.blurb}</span>}
                  <span className="block mt-2 text-[18px] font-bold tabular-nums text-neutral-900">{fmt(o.total)}</span>
                  {on && <span className="block text-[11.5px] font-semibold mt-0.5" style={{ color }}>{mode === "client" ? "Your pick" : "Client's pick"}</span>}
                </>
              );
              const cls = "relative block w-full text-left rounded-[6px] border-2 px-3.5 pt-3.5 pb-3 transition-colors";
              const style = on ? { borderColor: color, background: `${color}12` } : undefined;
              return canPick ? (
                <button key={o.id} type="button" className={`${cls} ${on ? "" : "border-neutral-200 hover:border-neutral-400"}`} style={style} aria-pressed={on} onClick={() => pick(o.id)}>{body}</button>
              ) : (
                <div key={o.id} className={`${cls} ${on ? "" : "border-neutral-200"}`} style={style}>{body}</div>
              );
            })}
          </div>
          {mode === "contractor" && !picked && <p className="text-[12px] text-neutral-500 mt-2">Not picked yet. Lines and totals below show {viewing}.</p>}
          {mode === "client" && needsPick && <p className="text-[12px] text-neutral-500 mt-2">Showing {viewing} below until you pick.</p>}
        </div>
      )}

      <div className="mt-6 space-y-5">
        {shown.length === 0 && <p className="text-neutral-400 italic">No lines yet.</p>}
        {groupLines(shown).map((g) => (
          <section key={g.key}>
            <div className="flex items-center gap-2 border-b-2 pb-1 mb-1" style={{ borderColor: color }}>
              <h3 className="font-semibold text-neutral-900">{g.group}</h3>
              {g.room_id && <span className="tag !h-5 !text-[11px]">{g.room_id}</span>}
            </div>
            <ul className="divide-y divide-neutral-100">
              {g.lines.map((l) => {
                const on = !l.optional || q.chosen.includes(l.id);
                return (
                  <li key={l.id} className={`flex gap-3 py-2 ${on ? "" : "text-neutral-400"}`}>
                    {l.optional && (
                      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" style={{ accentColor: color }} checked={on}
                        disabled={!canChoose} onChange={(e) => onChoose?.(l.id, e.target.checked)} aria-label={`Add ${l.description}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={on ? "text-neutral-800" : ""}>{l.description || "Untitled line"}</p>
                      <p className="text-[12px] text-neutral-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {qtyLabel(l)}
                        {l.option_id && <span className="rounded-[3px] px-1.5 py-px text-[11px] font-semibold border border-neutral-300 text-neutral-600">{optName(l.option_id)}</span>}
                        {l.allowance && <span className="rounded-[3px] px-1.5 py-px text-[11px] font-semibold bg-amber-100 text-amber-800">Allowance</span>}
                        {l.optional && <span className="rounded-[3px] px-1.5 py-px text-[11px] font-semibold" style={{ background: `${color}1f`, color }}>Optional add-on</span>}
                      </p>
                    </div>
                    <p className={`shrink-0 tabular-nums ${on ? "text-neutral-900 font-medium" : "line-through"}`}>{fmt(lineTotal(l))}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-5 ml-auto max-w-[300px] space-y-1 text-[13.5px]">
        <Row k="Subtotal" v={fmt(t.subtotal)} />
        {t.discount > 0 && <Row k="Discount" v={`−${fmt(t.discount)}`} />}
        <Row k={`Tax (${pctLabel(q.tax_rate)})`} v={fmt(t.tax)} />
        <div className="flex justify-between border-t-2 pt-2 mt-2 text-[17px] font-bold text-neutral-900" style={{ borderColor: color }}>
          <span>Total</span><span className="tabular-nums">{fmt(t.total)}</span>
        </div>
        {pkgs && viewing && <p className="text-[11.5px] text-neutral-500 text-right">{viewing} package{picked ? "" : ", until one is picked"}</p>}
        {shown.some((l) => l.optional) && <p className="text-[11.5px] text-neutral-500 text-right">Includes the add-ons ticked above.</p>}
        {q.financing && t.total > 0 && (
          <div className="pt-2 text-right">
            <p className="text-[13.5px] text-neutral-800">
              Or as low as <span className="font-semibold tabular-nums">{fmt(monthlyPayment(t.total, 60))}/month</span>
              <button type="button" className="ml-2 text-[12.5px] underline" style={{ color }} onClick={() => setShowFinance((v) => !v)} aria-expanded={showFinance}>
                {showFinance ? "Hide" : "See options"}
              </button>
            </p>
            {showFinance && (
              <div className="mt-2 text-left">
                <table className="w-full text-[13px]">
                  <thead><tr className="text-[11px] uppercase tracking-wider text-neutral-400"><th className="text-left font-semibold py-1">Term</th><th className="text-right font-semibold">APR</th><th className="text-right font-semibold">Monthly</th></tr></thead>
                  <tbody className="divide-y divide-neutral-100 border-y border-neutral-200">
                    {FINANCE_TERMS.map((m) => (
                      <tr key={m}><td className="py-1.5">{m} months</td><td className="text-right tabular-nums">{pctLabel(SAMPLE_APR)}</td><td className="text-right tabular-nums font-medium text-neutral-900">{fmt(monthlyPayment(t.total, m))}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11.5px] text-neutral-500 mt-1.5">Example only. Financing is subject to approval.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {shown.some((l) => l.allowance) && <p className="mt-4 text-[12px] text-neutral-500"><span className="font-semibold text-amber-800">Allowance. </span>{ALLOWANCE_NOTE}</p>}

      {q.schedule.length > 0 && (
        <div className="mt-6">
          <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">Payment plan</p>
          <ul className="divide-y divide-neutral-100 border-y border-neutral-200">
            {q.schedule.map((d, i) => (
              <li key={d.id} className="flex items-center gap-3 py-2">
                <span className="w-12 shrink-0 font-mono text-[12.5px] text-neutral-500">{pctLabel(d.pct)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-neutral-800">{d.label || "Payment"}</p>
                  <p className="text-[12px] text-neutral-500">{d.stage_name ? `When ${d.stage_name} is done` : "At signing"}</p>
                </div>
                <span className="shrink-0 tabular-nums font-medium text-neutral-900">{fmt(amts[i])}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(q.notes || q.terms) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 text-[13px] text-neutral-600">
          {q.notes && <div><p className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">Notes</p><p className="whitespace-pre-line">{q.notes}</p></div>}
          {q.terms && <div><p className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">Terms</p><p className="whitespace-pre-line">{q.terms}</p></div>}
        </div>
      )}

      {q.status === "approved" && (
        <div className="mt-6 rounded-[6px] border-2 border-green-600 text-green-700 px-4 py-3 text-center">
          <p className="font-bold tracking-wider uppercase text-[13px]">Approved</p>
          <p className="text-[13px]">Signed by <span className="font-semibold italic">{q.signed_by}</span>{q.approved_at && ` on ${niceDate(q.approved_at)}`}</p>
        </div>
      )}
      {q.status === "declined" && (
        <div className="mt-6 rounded-[6px] border-2 border-red-500 text-red-600 px-4 py-3 text-center text-[13px]">
          <p className="font-bold tracking-wider uppercase">Declined</p>
          {q.declined_at && <p>on {niceDate(q.declined_at)}</p>}
        </div>
      )}

      {mode === "client" && !closed && (
        <div className="mt-6 rounded-[6px] bg-neutral-50 border border-neutral-200 p-4 space-y-3">
          <p className="font-semibold text-neutral-900">Approve this quote</p>
          {pkgs && (needsPick
            ? <p className="text-[13px] font-medium text-amber-700">Pick a package above first.</p>
            : <p className="text-[13px] text-neutral-600">Package: <span className="font-semibold text-neutral-900">{viewing}</span></p>)}
          <p className="text-[13px] text-neutral-600">Type your full name to sign. The deposit of {fmt(amts[0] ?? 0)} is due at signing.</p>
          <input className="w-full h-11 rounded-[4px] border border-neutral-300 bg-white px-3 text-[16px] text-neutral-900 italic placeholder:not-italic placeholder:text-neutral-400 focus:outline-none focus:border-neutral-500"
            placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <label className="flex items-start gap-2 text-[13px] text-neutral-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4" style={{ accentColor: color }} checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I agree to the terms and the payment plan above.
          </label>
          <button className="w-full h-11 rounded-[4px] text-white font-semibold disabled:opacity-40" style={{ background: color }}
            disabled={!name.trim() || !agree || needsPick} onClick={() => onApprove?.(name.trim())}>
            Approve quote · {fmt(t.total)}
          </button>
          <div className="text-center text-[12.5px] text-neutral-500">
            {declining ? (
              <span>Decline this quote? <button className="underline text-red-600" onClick={() => onDecline?.()}>Yes, decline</button> · <button className="underline" onClick={() => setDeclining(false)}>Cancel</button></span>
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
