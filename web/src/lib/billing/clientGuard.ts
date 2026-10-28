// What a client may change on their money page: sign or decline a quote or change order (picking the
// package and add-ons first), and pay. Nothing else. Their page sends back the whole money record; this
// takes only those changes from it, so prices, lines and terms always stay the contractor's.
import type { Billing, ChangeOrder, Invoice, Payment, Quote } from "./types";

type Obj = Record<string, unknown>;
const without = (o: Obj, keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const sameExcept = (a: object, b: object, keys: string[]) => JSON.stringify(without(a as Obj, keys)) === JSON.stringify(without(b as Obj, keys));
const byId = <T extends { id: string }>(xs: T[] = []) => new Map(xs.map((x) => [x.id, x]));

const QUOTE_FREE = ["status", "chosen", "picked_option", "viewed_at", "approved_at", "signed_by", "declined_at", "activity", "schedule"];
const CO_FREE = ["status", "approved_at", "signed_by", "invoice_id", "activity"];
const INVOICE_FREE = ["status", "activity"];
const open = (s: string) => s === "sent" || s === "viewed";

/** The money record with the client's allowed changes on it, or why it was refused. */
export function clientBilling(full: Billing, sent: Billing): { billing: Billing } | { error: string } {
  // drafts never reach the client, so they're checked against what they were shown and put back after
  const server = shown(full);
  const no = (why: string) => ({ error: `That change can't be made from this page (${why}).` });
  const sq = byId(server.quotes), sc = byId(server.change_orders), si = byId(server.invoices), sp = byId(server.payments);
  if (sent.quotes.length !== server.quotes.length || (sent.change_orders ?? []).length !== (server.change_orders ?? []).length) return no("quotes");

  const signed = new Set<string>();
  const quotes: Quote[] = [];
  for (const q of sent.quotes) {
    const was = sq.get(q.id);
    if (!was || !sameExcept(was, q, QUOTE_FREE)) return no("quote");
    if (JSON.stringify(was.schedule.map((d) => ({ ...d, invoice_id: null }))) !== JSON.stringify(q.schedule.map((d) => ({ ...d, invoice_id: null })))) return no("payment plan");
    if (was.status === q.status) { quotes.push(open(was.status) ? { ...was, chosen: q.chosen, picked_option: q.picked_option, viewed_at: q.viewed_at ?? was.viewed_at } : was); continue; }
    if (!open(was.status) || !["viewed", "approved", "declined"].includes(q.status)) return no("quote status");
    if (q.status === "approved") signed.add(q.id);
    quotes.push(q);
  }

  const change_orders: ChangeOrder[] = [];
  for (const c of sent.change_orders ?? []) {
    const was = sc.get(c.id);
    if (!was || !sameExcept(was, c, CO_FREE)) return no("change order");
    if (was.status === c.status) { change_orders.push(was); continue; }
    if (was.status !== "sent" || (c.status !== "approved" && c.status !== "declined")) return no("change order status");
    if (c.status === "approved") signed.add(c.id);
    change_orders.push(c);
  }

  const invoices: Invoice[] = [];
  for (const inv of sent.invoices) {
    const was = si.get(inv.id);
    if (was) {
      if (!sameExcept(was, inv, INVOICE_FREE)) return no("invoice");
      invoices.push({ ...was, status: inv.status, activity: inv.activity });
    } else {
      // only the invoice a signature just made (the deposit, or a change order billed now)
      const from = inv.change_order_id ? signed.has(inv.change_order_id) : !!inv.quote_id && signed.has(inv.quote_id);
      if (!from) return no("new invoice");
      invoices.push(inv);
    }
  }
  if (server.invoices.some((i) => !invoices.some((x) => x.id === i.id))) return no("invoice removed");

  const payments: Payment[] = [];
  for (const p of sent.payments) {
    const was = sp.get(p.id);
    if (was) { payments.push(was); continue; }
    if (!invoices.some((i) => i.id === p.invoice_id) || !(p.amount > 0) || !Number.isInteger(p.amount)) return no("payment");
    payments.push(p);
  }
  if (server.payments.some((p) => !payments.some((x) => x.id === p.id))) return no("payment removed");

  const draft = <T extends { status: string }>(xs: T[] = []) => xs.filter((x) => x.status === "draft");
  return { billing: {
    ...full, quotes: [...quotes, ...draft(full.quotes)], invoices: [...invoices, ...draft(full.invoices)], payments,
    change_orders: full.change_orders ? [...change_orders, ...draft(full.change_orders)] : undefined,
  } };
}

const shown = (b: Billing): Billing => ({
  ...b, quotes: b.quotes.filter((q) => q.status !== "draft"), invoices: b.invoices.filter((i) => i.status !== "draft"),
  ...(b.change_orders ? { change_orders: b.change_orders.filter((c) => c.status !== "draft") } : {}),
});

/** The money record as the client's page gets it: no drafts, and no processing fees (those are the contractor's). */
export function forClient(b: Billing): Billing {
  const s = shown(b);
  return { ...s, payments: s.payments.map((p) => ({ ...p, fee: 0 })) };
}
