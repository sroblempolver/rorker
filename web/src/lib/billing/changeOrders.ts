// Change orders: extra or changed work after a quote is approved. The client approves each one like a
// quote. "Bill it now" makes its own invoice on approval; "Add to the final payment" rides on the last draw.
import { changeOrderTotals, newId, nextNumber, quoteTotals } from "./money";
import type { Billing, ChangeOrder, Invoice, LineItem, Quote } from "./types";

const DAY = 864e5;

/** The reasons offered as chips; anything else is typed in. */
export const CO_REASONS = ["Client asked for it", "Found on site", "Allowance difference", "Code or inspector"] as const;

export const CO_BILL_LABEL: Record<ChangeOrder["bill"], string> = { now: "Bill it now", final: "Add to the final payment" };

export interface ContractTotal { original: number; changes: number; total: number }

/** A new draft change order on an approved quote. */
export function blankChangeOrder(quote: Quote, existing: ChangeOrder[]): ChangeOrder {
  return {
    id: newId(), job_id: quote.job_id, quote_id: quote.id, number: nextNumber("CO", existing.map((c) => c.number)),
    title: "", reason: null, status: "draft",
    lines: [{ id: newId(), group: "Whole house", description: "", qty: 1, unit: "ea", unit_price: 0, room_id: null, element_ids: [] }],
    tax_rate: quote.tax_rate, days_added: 0, bill: "now", invoice_id: null,
    created_at: new Date().toISOString(), sent_at: null, approved_at: null, signed_by: null, activity: [],
  };
}

/** The client signs. Bill-now change orders get their own invoice, issued and due in 14 days. */
export function approveChangeOrder(b: Billing, coId: string, signedBy: string): Billing {
  const cos = b.change_orders ?? [];
  const co = cos.find((c) => c.id === coId);
  if (!co || co.status === "approved") return b;
  const now = new Date();
  const at = now.toISOString();
  let invoice: Invoice | null = null;
  if (co.bill === "now") {
    invoice = {
      id: newId(), job_id: co.job_id, quote_id: co.quote_id, draw_id: null,
      number: nextNumber("INV", b.invoices.map((i) => i.number)),
      title: `Change order ${co.number}: ${co.title || "Extra work"}`, kind: "standard", stage_name: null, status: "sent",
      lines: co.lines.map((l): LineItem => ({ ...l, id: newId() })), tax_rate: co.tax_rate, discount: 0,
      issued_at: at, due_date: new Date(now.getTime() + 14 * DAY).toISOString().slice(0, 10), notes: null, created_at: at,
      activity: [{ at, what: `Sent with ${co.number}` }], change_order_id: co.id,
    };
  }
  const signed: ChangeOrder = {
    ...co, status: "approved", approved_at: at, signed_by: signedBy, invoice_id: invoice?.id ?? co.invoice_id,
    activity: [...(co.activity ?? []), { at, what: "Approved", who: signedBy }, ...(invoice ? [{ at, what: `Invoice ${invoice.number} sent` }] : [])],
  };
  return {
    ...b,
    change_orders: cos.map((c) => (c.id === coId ? signed : c)),
    invoices: invoice ? [...b.invoices, invoice] : b.invoices,
  };
}

/** Original quote + approved change orders = the contract total now. */
export function contractTotal(b: Billing, quoteId: string): ContractTotal {
  const q = b.quotes.find((x) => x.id === quoteId);
  const original = q ? quoteTotals(q).total : 0;
  const changes = (b.change_orders ?? [])
    .filter((c) => c.quote_id === quoteId && c.status === "approved")
    .reduce((s, c) => s + changeOrderTotals(c).total, 0);
  return { original, changes, total: original + changes };
}

/** The approved quote change orders hang off (the latest one), or null. */
export const contractQuote = (b: Billing): Quote | null =>
  [...b.quotes].reverse().find((q) => q.status === "approved") ?? null;

/** "+$1,240.00" or "-$300.00" */
export const signedFmt = (cents: number, fmt: (c: number) => string) => (cents < 0 ? `-${fmt(-cents)}` : `+${fmt(cents)}`);
