// Payments for the preview. Nothing leaves the browser: card and bank payments are simulated here and
// will run on each contractor's own payout account later. Amounts in cents.
import type { Invoice, Payment, PaymentMethod } from "./types";
import { newId } from "./money";

/** What the processor keeps: card 2.9% + 30¢, bank 0.8% capped at $5, nothing for check or cash. */
export function processingFee(amount: number, method: PaymentMethod): number {
  if (method === "card") return Math.round(amount * 0.029) + 30;
  if (method === "ach") return Math.min(500, Math.round(amount * 0.008));
  return 0;
}

const base = (invoice: Invoice) => ({ id: newId(), job_id: invoice.job_id, invoice_id: invoice.id });

/** A client paying online. Always succeeds in the preview (bank payments too, to keep the demo simple). */
/** cardBrand is optional ("Visa" if left out). */
export function simulatePayment(input: { invoice: Invoice; amount: number; method: "card" | "ach"; payerName: string; last4: string; bankName?: string; cardBrand?: string }): Payment {
  const { invoice, amount, method, payerName, last4, bankName } = input;
  const reference = `${method === "card" ? input.cardBrand ?? "Visa" : bankName ?? "Bank"} •••• ${last4.slice(-4)}`;
  return { ...base(invoice), amount, method, status: "succeeded", reference, payer_name: payerName.trim() || null, fee: processingFee(amount, method), paid_at: new Date().toISOString() };
}

/** A check, cash or other payment the contractor records by hand. */
export function manualPayment(input: { invoice: Invoice; amount: number; method: "check" | "cash" | "other"; reference?: string; payerName?: string; date?: string }): Payment {
  const { invoice, amount, method, reference, payerName, date } = input;
  const ref = reference?.trim() ? (method === "check" && /^\d+$/.test(reference.trim()) ? `Check #${reference.trim()}` : reference.trim()) : method === "cash" ? "Cash" : method === "check" ? "Check" : null;
  const paid_at = date ? new Date(`${date}T12:00:00`).toISOString() : new Date().toISOString();
  return { ...base(invoice), amount, method, status: "succeeded", reference: ref, payer_name: payerName?.trim() || null, fee: 0, paid_at };
}

/** "Visa" from the first digit of a card number. */
export function cardBrand(num: string): string {
  const d = num.replace(/\D/g, "")[0];
  return d === "4" ? "Visa" : d === "5" ? "Mastercard" : d === "3" ? "Amex" : "Card";
}

/** How a payment method reads in a list or on a receipt. */
export const METHOD_LABEL: Record<PaymentMethod, string> = { card: "Card", ach: "Bank transfer", check: "Check", cash: "Cash", other: "Other" };

/** The date n business days after d (skips weekends). */
export function addBusinessDays(d: Date, n: number) {
  const x = new Date(d);
  while (n > 0) { x.setDate(x.getDate() + 1); if (x.getDay() !== 0 && x.getDay() !== 6) n--; }
  return x;
}

/** "Oct 27, 2026" */
export const shortDate = (iso: string | Date) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
