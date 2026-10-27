// Turning an approved quote's payment plan into invoices. The deposit is billed on approval; each
// progress draw is suggested when its stage is marked done; the final draw closes out the quote.
import { newId, nextNumber, quoteTotals } from "./money";
import type { Draw, Invoice, InvoiceKind, LineItem, Quote } from "./types";

const DAY = 864e5;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export const KIND_LABEL: Record<InvoiceKind, string> = { deposit: "Deposit", progress: "Progress", final: "Final", standard: "Invoice" };

/** Each draw's share of the quote total in cents. The last draw takes the rounding remainder. */
export function drawAmounts(quote: Quote): Record<string, number> {
  const total = quoteTotals(quote).total;
  const out: Record<string, number> = {};
  let used = 0;
  quote.schedule.forEach((d, i) => {
    const last = i === quote.schedule.length - 1;
    out[d.id] = last ? total - used : Math.round(total * d.pct);
    used += out[d.id];
  });
  return out;
}

function drawKind(quote: Quote, draw: Draw): InvoiceKind {
  const i = quote.schedule.findIndex((d) => d.id === draw.id);
  if (draw.stage_name === null && i === 0) return "deposit";
  if (i === quote.schedule.length - 1) return "final";
  return "progress";
}

/** One invoice for one draw. Tax is already in the quote total, so the line is not taxed again. */
export function invoiceForDraw(quote: Quote, draw: Draw, existingNumbers: string[], opts: { issue?: boolean } = {}): Invoice {
  const now = new Date();
  const kind = drawKind(quote, draw);
  const id = newId();
  const line: LineItem = {
    id: newId(), group: "Payment plan", description: `${draw.label}: ${Math.round(draw.pct * 100)}% of ${quote.number}`,
    qty: 1, unit: "lot", unit_price: drawAmounts(quote)[draw.id] ?? 0, room_id: null, element_ids: [], taxable: false,
  };
  return {
    id, job_id: quote.job_id, quote_id: quote.id, draw_id: draw.id, number: nextNumber("INV", existingNumbers),
    title: kind === "deposit" ? "Deposit" : draw.label, kind, stage_name: draw.stage_name,
    status: opts.issue ? "sent" : "draft", lines: [line], tax_rate: 0, discount: 0,
    issued_at: opts.issue ? now.toISOString() : null,
    due_date: opts.issue ? isoDate(new Date(now.getTime() + 14 * DAY)) : null,
    notes: null, created_at: now.toISOString(),
  };
}

/** On approval: bill the deposit draws (the ones not tied to a stage) right away. */
export function invoicesOnApproval(quote: Quote, existingNumbers: string[]): { quote: Quote; invoices: Invoice[] } {
  const numbers = [...existingNumbers];
  const invoices: Invoice[] = [];
  const schedule = quote.schedule.map((d) => {
    if (d.stage_name !== null || d.invoice_id) return d;
    const inv = invoiceForDraw(quote, d, numbers, { issue: true });
    numbers.push(inv.number);
    invoices.push(inv);
    return { ...d, invoice_id: inv.id };
  });
  return { quote: { ...quote, schedule }, invoices };
}

/** Draws waiting on this stage that have no invoice yet. */
export const drawsDueForStage = (quote: Quote, stageName: string): Draw[] =>
  quote.schedule.filter((d) => d.stage_name === stageName && !d.invoice_id);

/** A one-off invoice, not from a quote (extra work, a change order). */
export function blankInvoice(jobId: string, existingNumbers: string[]): Invoice {
  const now = new Date().toISOString();
  return {
    id: newId(), job_id: jobId, quote_id: null, draw_id: null, number: nextNumber("INV", existingNumbers),
    title: "", kind: "standard", stage_name: null, status: "draft",
    lines: [{ id: newId(), group: "", description: "", qty: 1, unit: "ea", unit_price: 0, room_id: null, element_ids: [] }],
    tax_rate: 0, discount: 0, issued_at: null, due_date: null, notes: null, created_at: now,
  };
}

/** "2026-10-27" or an ISO time -> "Oct 27, 2026" */
export const fmtDate = (s: string | null) =>
  s ? new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
