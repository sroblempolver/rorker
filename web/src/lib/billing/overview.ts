// Money across every job: what's owed, what's late, what came in, and what needs a nudge today.
// Pure functions over each job's Billing, cents in, cents out.
import type { Billing } from "./types";
import { amountDue, invoiceStatus, invoiceTotals, jobMoney, quoteTotals } from "./money";

export interface JobMoneyRow { jobId: string; jobName: string; clientName: string | null; address: string | null; billing: Billing }

export type AttentionKind = "overdue" | "quote_viewed" | "quote_unviewed" | "draft_invoice";
export interface AttentionItem {
  id: string; kind: AttentionKind; jobId: string; jobName: string; clientName: string | null;
  /** "INV-1004 · Final payment" */
  title: string;
  /** "12 days late" */
  detail: string;
  /** cents */
  amount: number;
  /** days late, days since viewed or sent; 0 for drafts */
  days: number;
  /** the one-tap action label */
  action: string;
}

export type JobMoneyStatus = "paid" | "overdue" | "on_track" | "quote_out" | "not_started";
export interface JobMoneySummary {
  row: JobMoneyRow;
  approved: number; invoiced: number; collected: number; outstanding: number; overdue: number;
  /** 0..1 of the approved total collected */
  paidShare: number;
  status: JobMoneyStatus;
}

export interface AgingBuckets { current: number; d1_30: number; d31_60: number; d61: number }
export interface MonthCollected { key: string; label: string; amount: number }

export interface CompanyMoney {
  totals: {
    approved: number; invoiced: number; collected: number; outstanding: number;
    overdue: number; overdueCount: number; collectedThisMonth: number;
    quotesWaiting: number; quotesWaitingValue: number; draftQuotes: number;
  };
  aging: AgingBuckets;
  attention: AttentionItem[];
  monthly: MonthCollected[];
  jobs: JobMoneySummary[];
}

const DAY = 864e5;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
/** whole days from a to b (dates or timestamps; only the day part counts) */
const daysFrom = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const RANK: Record<AttentionKind, number> = { overdue: 0, quote_viewed: 1, quote_unviewed: 2, draft_invoice: 3 };

export function companyMoney(rows: JobMoneyRow[], today = isoDay(new Date())): CompanyMoney {
  const month = today.slice(0, 7);
  const t: CompanyMoney["totals"] = {
    approved: 0, invoiced: 0, collected: 0, outstanding: 0, overdue: 0, overdueCount: 0,
    collectedThisMonth: 0, quotesWaiting: 0, quotesWaitingValue: 0, draftQuotes: 0,
  };
  const aging: AgingBuckets = { current: 0, d1_30: 0, d31_60: 0, d61: 0 };
  const attention: AttentionItem[] = [];
  const jobs: JobMoneySummary[] = [];

  // the last 6 months, oldest first
  const [y, m] = today.split("-").map(Number);
  const monthly: MonthCollected[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (5 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: MONTHS[d.getUTCMonth()], amount: 0 };
  });

  for (const row of rows) {
    const b = row.billing;
    const base = { jobId: row.jobId, jobName: row.jobName, clientName: row.clientName };
    const jm = jobMoney({ ...b, change_orders: b.change_orders ?? [] });
    t.approved += jm.approved; t.invoiced += jm.invoiced; t.collected += jm.collected; t.outstanding += jm.outstanding;

    for (const p of b.payments) {
      if (p.status !== "succeeded") continue;
      const k = p.paid_at.slice(0, 7);
      if (k === month) t.collectedThisMonth += p.amount;
      const slot = monthly.find((x) => x.key === k);
      if (slot) slot.amount += p.amount;
    }

    let jobOverdue = 0;
    for (const inv of b.invoices) {
      const status = invoiceStatus(inv, b.payments, today);
      const label = `${inv.number} · ${inv.title || "Invoice"}`;
      if (status === "draft") {
        const total = invoiceTotals(inv).total;
        if (total > 0) attention.push({ ...base, id: inv.id, kind: "draft_invoice", title: label, detail: "Ready to send", amount: total, days: 0, action: "Send it" });
        continue;
      }
      if (status === "void" || status === "paid") continue;
      const due = amountDue(inv, b.payments);
      if (!due) continue;
      const late = inv.due_date ? daysFrom(inv.due_date, today) : 0;
      if (late <= 0) aging.current += due;
      else if (late <= 30) aging.d1_30 += due;
      else if (late <= 60) aging.d31_60 += due;
      else aging.d61 += due;
      if (late > 0) {
        jobOverdue += due; t.overdue += due; t.overdueCount += 1;
        attention.push({ ...base, id: inv.id, kind: "overdue", title: label, detail: `${plural(late, "day")} late`, amount: due, days: late, action: "Send a reminder" });
      }
    }

    let waiting = false;
    for (const q of b.quotes) {
      if (q.status === "draft") { t.draftQuotes += 1; continue; }
      if (q.status !== "sent" && q.status !== "viewed") continue;
      waiting = true;
      const total = quoteTotals(q).total;
      t.quotesWaiting += 1; t.quotesWaitingValue += total;
      const label = `${q.number} · ${q.title || "Quote"}`;
      if (q.viewed_at) {
        const d = daysFrom(q.viewed_at, today);
        if (d >= 5) attention.push({ ...base, id: q.id, kind: "quote_viewed", title: label, detail: `Viewed ${plural(d, "day")} ago, no answer`, amount: total, days: d, action: "Follow up" });
      } else if (q.sent_at) {
        const d = daysFrom(q.sent_at, today);
        if (d >= 3) attention.push({ ...base, id: q.id, kind: "quote_unviewed", title: label, detail: `Sent ${plural(d, "day")} ago, not opened`, amount: total, days: d, action: "Follow up" });
      }
    }

    const paidShare = jm.approved ? Math.min(1, jm.collected / jm.approved) : 0;
    const status: JobMoneyStatus = jobOverdue > 0 ? "overdue"
      : jm.approved > 0 && jm.collected >= jm.approved && jm.outstanding === 0 ? "paid"
      : jm.approved > 0 ? "on_track"
      : waiting ? "quote_out" : "not_started";
    jobs.push({ row, approved: jm.approved, invoiced: jm.invoiced, collected: jm.collected, outstanding: jm.outstanding, overdue: jobOverdue, paidShare, status });
  }

  attention.sort((a, b) => RANK[a.kind] - RANK[b.kind] || b.days - a.days || b.amount - a.amount);
  const order: Record<JobMoneyStatus, number> = { overdue: 0, on_track: 1, quote_out: 2, not_started: 3, paid: 4 };
  jobs.sort((a, b) => order[a.status] - order[b.status] || b.outstanding - a.outstanding || b.approved - a.approved);

  return { totals: t, aging, attention, monthly, jobs };
}
