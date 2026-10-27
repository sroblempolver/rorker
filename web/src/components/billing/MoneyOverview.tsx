"use client";
// Money across all jobs: what's owed, what's late, what came in, and who needs a nudge today.
import { useMemo } from "react";
import { fmt } from "@/lib/billing/money";
import { companyMoney, type AttentionKind, type JobMoneyRow, type JobMoneyStatus } from "@/lib/billing/overview";

/** $12,400 -> "$12.4k", $1.2M -> "$1.2M", small amounts stay whole dollars */
const short = (cents: number) => {
  const d = cents / 100;
  if (d >= 1e6) return `$${(d / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (d >= 1e4) return `$${Math.round(d / 1e3)}k`;
  if (d >= 1e3) return `$${(d / 1e3).toFixed(1).replace(/\.0$/, "")}k`;
  return `$${Math.round(d)}`;
};
const whole = (cents: number) => fmt(cents).replace(/\.\d\d$/, "");

const JOB_STATUS: Record<JobMoneyStatus, { label: string; cls: string; dot: string }> = {
  paid: { label: "Paid in full", cls: "!text-green !border-green/50", dot: "bg-green" },
  overdue: { label: "Overdue", cls: "!text-red !border-red/50", dot: "bg-red" },
  on_track: { label: "On track", cls: "", dot: "bg-chalk" },
  quote_out: { label: "Quote out", cls: "!text-amber", dot: "bg-amber" },
  not_started: { label: "No quote yet", cls: "", dot: "bg-muted" },
};
const ATTN_DOT: Record<AttentionKind, string> = { overdue: "bg-red", quote_viewed: "bg-amber", quote_unviewed: "bg-amber", draft_invoice: "bg-muted" };

export function MoneyOverview({ rows, onOpenJob }: { rows: JobMoneyRow[]; onOpenJob(jobId: string): void }) {
  const m = useMemo(() => companyMoney(rows), [rows]);
  const t = m.totals;
  const maxMonth = Math.max(1, ...m.monthly.map((x) => x.amount));
  const agingTotal = m.aging.current + m.aging.d1_30 + m.aging.d31_60 + m.aging.d61;
  const aging = [
    { label: "Not due yet", v: m.aging.current, c: "bg-green" },
    { label: "1 to 30 days late", v: m.aging.d1_30, c: "bg-amber" },
    { label: "31 to 60 days late", v: m.aging.d31_60, c: "bg-accent" },
    { label: "61+ days late", v: m.aging.d61, c: "bg-red" },
  ];
  const tiles = [
    { l: "Outstanding", v: whole(t.outstanding), sub: "sent and not paid yet", c: t.outstanding ? "text-amber" : "" },
    { l: "Overdue", v: whole(t.overdue), sub: t.overdueCount ? `${t.overdueCount} invoice${t.overdueCount === 1 ? "" : "s"} late` : "Nothing late", c: t.overdue ? "text-red" : "" },
    { l: "Collected this month", v: whole(t.collectedThisMonth), sub: `${whole(t.collected)} all time`, c: "text-green" },
    { l: "Quotes waiting", v: String(t.quotesWaiting), sub: t.quotesWaiting ? `${whole(t.quotesWaitingValue)} on the table` : t.draftQuotes ? `${t.draftQuotes} draft${t.draftQuotes === 1 ? "" : "s"} not sent` : "None out", c: "" },
  ];

  return (
    <div className="px-4 sm:px-6 py-6 max-w-6xl w-full mx-auto space-y-5">
      <div>
        <p className="eyebrow">All jobs</p>
        <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em]">Money</h1>
        <p className="text-muted text-sm mt-1">
          {whole(t.approved)} approved across {rows.length} job{rows.length === 1 ? "" : "s"} · {whole(t.invoiced)} invoiced · {whole(t.collected)} collected
          {t.draftQuotes ? ` · ${t.draftQuotes} draft quote${t.draftQuotes === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {tiles.map((x) => (
          <div key={x.l} className={`card !rounded-[3px] px-3 py-3 ${x.l === "Overdue" && t.overdue ? "!border-red/50" : ""}`}>
            <p className="eyebrow !text-[11px]">{x.l}</p>
            <p className={`font-mono text-[22px] sm:text-[26px] font-semibold tabular-nums leading-tight ${x.c}`}>{x.v}</p>
            <p className="text-[12px] text-muted truncate">{x.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-3">
        <section className="card !rounded-[3px] p-4">
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="font-display text-[19px] font-extrabold uppercase leading-none">Collected</h2>
            <span className="text-muted text-[12.5px]">last 6 months</span>
          </div>
          <div className="flex items-end gap-2 sm:gap-3 h-[170px]" role="img" aria-label={m.monthly.map((x) => `${x.label} ${whole(x.amount)}`).join(", ")}>
            {m.monthly.map((x, i) => {
              const now = i === m.monthly.length - 1;
              return (
                <div key={x.key} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1">
                  <span className={`font-mono text-[11px] sm:text-[12px] tabular-nums ${now ? "text-text" : "text-muted"}`}>{x.amount ? short(x.amount) : "$0"}</span>
                  <div className={`w-full max-w-[56px] rounded-t-[2px] ${now ? "bg-accent" : "bg-panel-3"}`} style={{ height: `${Math.max(x.amount ? 3 : 1, (x.amount / maxMonth) * 120)}px` }} />
                  <span className={`text-[12px] ${now ? "text-text font-semibold" : "text-muted"}`}>{x.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card !rounded-[3px] p-4">
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="font-display text-[19px] font-extrabold uppercase leading-none">Who owes you</h2>
            <span className="text-muted text-[12.5px] tabular-nums">{whole(agingTotal)} unpaid</span>
          </div>
          {agingTotal ? (
            <>
              <div className="h-4 rounded-[2px] overflow-hidden flex bg-panel-3 gap-px">
                {aging.filter((a) => a.v).map((a) => <div key={a.label} className={a.c} style={{ width: `${(a.v / agingTotal) * 100}%` }} title={`${a.label}: ${fmt(a.v)}`} />)}
              </div>
              <ul className="mt-3 space-y-1.5">
                {aging.map((a) => (
                  <li key={a.label} className={`flex items-center gap-2 text-[13px] ${a.v ? "" : "text-muted"}`}>
                    <span className={`dot ${a.c} ${a.v ? "" : "opacity-40"}`} />
                    <span className="flex-1">{a.label}</span>
                    <span className="font-mono tabular-nums">{whole(a.v)}</span>
                    <span className="w-10 text-right text-muted text-[12px] tabular-nums">{Math.round((a.v / agingTotal) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[13px] text-muted">Every sent invoice is paid. Nice.</p>
          )}
        </section>
      </div>

      <section>
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="font-display text-[19px] font-extrabold uppercase leading-none">Needs attention</h2>
          <span className="text-muted text-[12.5px]">{m.attention.length ? `${m.attention.length} to do` : "All caught up"}</span>
        </div>
        {m.attention.length ? (
          <ul className="space-y-1.5">
            {m.attention.map((a) => (
              <li key={`${a.kind}-${a.id}`} className={`card !rounded-[3px] px-3 py-2.5 flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 ${a.kind === "overdue" ? "border-l-[3px] !border-l-red" : ""}`}>
                <span className={`dot ${ATTN_DOT[a.kind]} shrink-0`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] truncate">{a.jobName}<span className="text-muted"> · {a.clientName ?? "No client"}</span></span>
                  <span className="block text-[12.5px] text-muted truncate">{a.title} · <span className={a.kind === "overdue" ? "text-red" : ""}>{a.detail}</span></span>
                </span>
                <span className="font-mono text-[14px] font-semibold tabular-nums shrink-0">{fmt(a.amount)}</span>
                <button className={`btn btn-sm shrink-0 ${a.kind === "overdue" ? "btn-primary" : ""}`} onClick={() => onOpenJob(a.jobId)}>{a.action}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card !rounded-[3px] px-3 py-4 text-[13px] text-muted">Nothing late, nothing waiting. Quotes and invoices that need a nudge show up here.</p>
        )}
      </section>

      <section>
        <h2 className="font-display text-[19px] font-extrabold uppercase leading-none mb-2">Jobs</h2>
        <div className="card !rounded-[3px] overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_110px_110px_110px_130px] gap-3 px-3 py-2 border-b border-line eyebrow !text-[11px]">
            <span>Job</span><span>Client</span><span className="text-right">Contract</span><span className="text-right">Collected</span><span className="text-right">Outstanding</span><span>Status</span>
          </div>
          <ul>
            {m.jobs.map((j) => {
              const s = JOB_STATUS[j.status];
              return (
                <li key={j.row.jobId} className="border-b border-line last:border-b-0">
                  <button onClick={() => onOpenJob(j.row.jobId)} className="w-full text-left px-3 py-2.5 hover:bg-panel-2 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_110px_110px_110px_130px] gap-x-3 gap-y-1 items-center">
                    <span className="min-w-0">
                      <span className="block text-[14px] truncate">{j.row.jobName}</span>
                      <span className="block md:hidden text-[12px] text-muted truncate">{j.row.clientName ?? "No client"}</span>
                      <span className="mt-1 block h-1 rounded-[1px] bg-panel-3 overflow-hidden max-w-[220px]">
                        <span className={`block h-full ${j.status === "overdue" ? "bg-red" : "bg-green"}`} style={{ width: `${j.paidShare * 100}%` }} />
                      </span>
                    </span>
                    <span className="hidden md:block text-[13px] text-muted truncate">{j.row.clientName ?? "No client"}</span>
                    <span className="hidden md:block text-right font-mono text-[13px] tabular-nums">{j.approved ? whole(j.approved) : "-"}</span>
                    <span className="hidden md:block text-right font-mono text-[13px] tabular-nums text-green">{j.collected ? whole(j.collected) : "-"}</span>
                    <span className={`hidden md:block text-right font-mono text-[13px] tabular-nums ${j.overdue ? "text-red" : j.outstanding ? "text-amber" : "text-muted"}`}>{j.outstanding ? whole(j.outstanding) : "-"}</span>
                    <span className="justify-self-end md:justify-self-start"><span className={`chip ${s.cls}`}><span className={`dot ${s.dot}`} />{s.label}</span></span>
                    <span className="md:hidden col-span-2 text-[12px] text-muted tabular-nums">
                      {j.approved ? `${whole(j.collected)} of ${whole(j.approved)} collected` : "No approved quote"}
                      {j.outstanding ? <> · <span className={j.overdue ? "text-red" : "text-amber"}>{whole(j.outstanding)} owed</span></> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
