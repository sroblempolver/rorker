// Quotes, invoices and payments. Front end only for now: the preview keeps these in memory. Every
// amount is in cents (USD) so totals never drift. Lines point at plan element IDs and rooms, so a quote
// reads like the building: "Kitchen (G-R04): new cabinets".

/** Standard plans: the contractor's logo on their documents plus "Powered by Rorker". Premium: no Rorker anywhere. */
export type BrandTier = "standard" | "premium";
export interface Brand {
  name: string; logo_url: string | null; brand_color: string; phone: string | null; email: string | null;
  address: string | null; license_no: string | null; tier: BrandTier;
}

export type Unit = "ea" | "sqft" | "lf" | "hr" | "day" | "lot";
export interface LineItem {
  id: string;
  /** a heading the lines are grouped under on the document: usually the room name, or "Whole house" */
  group: string;
  description: string;
  qty: number;
  unit: Unit;
  /** cents */
  unit_price: number;
  /** the room this is for, e.g. "G-R04" */
  room_id: string | null;
  /** walls, fixtures, doors ... this line touches, e.g. ["G-F22", "G-W07"] */
  element_ids: string[];
  /** an add-on the client can tick or untick on the quote; not counted unless chosen */
  optional?: boolean;
  taxable?: boolean;
  /** belongs to one package of a good / better / best quote; counted only when that package is picked */
  option_id?: string | null;
  /** a budget for something the client still chooses (tile, fixtures); the difference becomes a change order */
  allowance?: boolean;
}

/** One package of a good / better / best quote. Lines with no option_id are in every package. */
export interface QuoteOption { id: string; name: string; blurb: string | null }

/** Something that happened to a quote, invoice or change order, shown as a timeline. */
export interface Activity { at: string; what: string; who?: string | null }

/** One payment step agreed on the quote: a deposit, a draw when a stage is done, the final payment. */
export interface Draw {
  id: string; label: string;
  /** share of the quote total, 0..1; all draws add up to 1 */
  pct: number;
  /** the job stage that triggers it (null for the deposit at signing) */
  stage_name: string | null;
  /** the invoice made for it, once there is one */
  invoice_id: string | null;
}

export type QuoteStatus = "draft" | "sent" | "viewed" | "approved" | "declined";
export interface Quote {
  id: string; job_id: string;
  /** "Q-1001" */
  number: string;
  title: string;
  status: QuoteStatus;
  lines: LineItem[];
  /** optional lines the client picked, by line id */
  chosen: string[];
  /** good / better / best packages; empty for a plain quote */
  options?: QuoteOption[];
  /** the package the client (or contractor) picked */
  picked_option?: string | null;
  /** show "as low as $X a month" financing on the client's quote */
  financing?: boolean;
  activity?: Activity[];
  /** e.g. 0.0825 */
  tax_rate: number;
  /** cents off the total */
  discount: number;
  schedule: Draw[];
  notes: string | null;
  terms: string | null;
  valid_until: string | null;
  /** drafted by the assistant from the plan (shown as a small badge until edited) */
  ai_drafted: boolean;
  created_at: string; sent_at: string | null; viewed_at: string | null;
  approved_at: string | null;
  /** the name the client typed to sign */
  signed_by: string | null;
  declined_at: string | null;
}

export type InvoiceKind = "deposit" | "progress" | "final" | "standard";
export type InvoiceStatus = "draft" | "sent" | "viewed" | "partial" | "paid" | "overdue" | "void";
export interface Invoice {
  id: string; job_id: string;
  /** the approved quote it comes from, if any */
  quote_id: string | null;
  /** the draw on that quote it bills, if any */
  draw_id: string | null;
  /** "INV-1001" */
  number: string;
  title: string;
  kind: InvoiceKind;
  /** the stage that triggers it, for progress draws */
  stage_name: string | null;
  status: InvoiceStatus;
  lines: LineItem[];
  tax_rate: number;
  discount: number;
  issued_at: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  activity?: Activity[];
  /** the change order it bills, if any */
  change_order_id?: string | null;
}

/** Extra or changed work after the quote is signed. The client approves it like a quote; then it's billed
 *  on its own invoice right away, or added to the final payment. */
export type ChangeOrderStatus = "draft" | "sent" | "approved" | "declined";
export interface ChangeOrder {
  id: string; job_id: string; quote_id: string;
  /** "CO-1" */
  number: string;
  title: string;
  /** why: "Client asked for", "Found on site", "Allowance difference" */
  reason: string | null;
  status: ChangeOrderStatus;
  lines: LineItem[];
  tax_rate: number;
  /** extra days it adds to the schedule */
  days_added: number;
  bill: "now" | "final";
  invoice_id: string | null;
  created_at: string; sent_at: string | null; approved_at: string | null; signed_by: string | null;
  activity?: Activity[];
}

export type PaymentMethod = "card" | "ach" | "check" | "cash" | "other";
export type PaymentStatus = "succeeded" | "processing" | "failed" | "refunded";
export interface Payment {
  id: string; job_id: string; invoice_id: string;
  /** cents */
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  /** "Visa •••• 4242", "Chase •••• 6789", "Check #1043" */
  reference: string | null;
  payer_name: string | null;
  /** processing fee in cents (card and bank payments) */
  fee: number;
  paid_at: string;
}

/** Everything money for one job. */
export interface Billing { quotes: Quote[]; invoices: Invoice[]; payments: Payment[]; change_orders?: ChangeOrder[] }

/** The job and client as shown on a document. */
export interface DocJob { name: string; address: string | null; client_name: string | null; client_email: string | null; client_phone: string | null }
