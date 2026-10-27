// Money helpers shared by quotes, invoices and payments. Cents in, cents out.
import type { Billing, ChangeOrder, Invoice, InvoiceStatus, LineItem, Payment, Quote } from "./types";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
/** 123456 -> "$1,234.56" */
export const fmt = (cents: number) => usd.format(Math.round(cents) / 100);
/** "$1,234.56" or "1234.5" -> 123456 */
export const toCents = (s: string) => Math.round((parseFloat(s.replace(/[^0-9.\-]/g, "")) || 0) * 100);

export const lineTotal = (l: Pick<LineItem, "qty" | "unit_price">) => Math.round(l.qty * l.unit_price);

export interface Totals { subtotal: number; discount: number; tax: number; total: number }
/** Optional lines count only when chosen. Tax is on taxable lines (all, unless taxable is false), after the discount share. */
export function totals(lines: LineItem[], taxRate: number, discount = 0, chosen: string[] = []): Totals {
  const counted = lines.filter((l) => !l.optional || chosen.includes(l.id));
  const subtotal = counted.reduce((s, l) => s + lineTotal(l), 0);
  const taxable = counted.filter((l) => l.taxable !== false).reduce((s, l) => s + lineTotal(l), 0);
  const d = Math.min(discount, subtotal);
  const taxBase = subtotal ? taxable - d * (taxable / subtotal) : 0;
  const tax = Math.round(Math.max(0, taxBase) * taxRate);
  return { subtotal, discount: d, tax, total: subtotal - d + tax };
}

/** Lines that count on a quote: shared lines plus the picked package's (the first package until one is picked). */
export const quoteLines = (q: Quote) => {
  const pick = q.picked_option ?? q.options?.[0]?.id ?? null;
  return q.lines.filter((l) => !l.option_id || l.option_id === pick);
};
export const quoteTotals = (q: Quote) => totals(quoteLines(q), q.tax_rate, q.discount, q.chosen);
/** What a package would total if picked. */
export const optionTotals = (q: Quote, optionId: string) => quoteTotals({ ...q, picked_option: optionId });
export const invoiceTotals = (i: Invoice) => totals(i.lines, i.tax_rate, i.discount);

/** What has been paid on an invoice (succeeded payments only). */
export const paidOn = (invoiceId: string, payments: Payment[]) =>
  payments.filter((p) => p.invoice_id === invoiceId && p.status === "succeeded").reduce((s, p) => s + p.amount, 0);
export const amountDue = (i: Invoice, payments: Payment[]) => Math.max(0, invoiceTotals(i).total - paidOn(i.id, payments));

/** The status an invoice should show given its payments and due date (draft and void stay as they are). */
export function invoiceStatus(i: Invoice, payments: Payment[], today = new Date().toISOString().slice(0, 10)): InvoiceStatus {
  if (i.status === "draft" || i.status === "void") return i.status;
  const total = invoiceTotals(i).total, paid = paidOn(i.id, payments);
  if (total > 0 && paid >= total) return "paid";
  if (paid > 0) return "partial";
  if (i.due_date && i.due_date < today) return "overdue";
  return i.status === "viewed" ? "viewed" : "sent";
}

export const changeOrderTotals = (c: ChangeOrder) => totals(c.lines, c.tax_rate);

/** Job money at a glance: quoted (approved), invoiced, collected, still owed. */
export function jobMoney(b: Billing) {
  const approved = b.quotes.filter((q) => q.status === "approved").reduce((s, q) => s + quoteTotals(q).total, 0)
    + (b.change_orders ?? []).filter((c) => c.status === "approved").reduce((s, c) => s + changeOrderTotals(c).total, 0);
  const live = b.invoices.filter((i) => i.status !== "draft" && i.status !== "void");
  const invoiced = live.reduce((s, i) => s + invoiceTotals(i).total, 0);
  const collected = b.payments.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amount, 0);
  return { approved, invoiced, collected, outstanding: Math.max(0, invoiced - collected) };
}

/** "Q-1003" after "Q-1001", "Q-1002". */
export function nextNumber(prefix: "Q" | "INV" | "CO", existing: string[]) {
  const n = Math.max(prefix === "CO" ? 0 : 1000, ...existing.map((x) => parseInt(x.split("-")[1] ?? "", 10)).filter(Number.isFinite));
  return `${prefix}-${n + 1}`;
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
