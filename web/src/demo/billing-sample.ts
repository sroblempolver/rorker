// Sample money for the Hadley Road house in the preview: an approved quote (kitchen, both upstairs
// bathrooms, the lavatory), its payment plan, a paid deposit and a progress invoice waiting on the client.
// Two change orders: CO-1 approved and billed now on INV-1003 (waiting on payment), CO-2 sent and waiting
// on the client, to be added to the final payment. Marking "Rough-in" done in Stages brings up the next
// draw to bill (INV-1004).
import type { Billing, Brand, ChangeOrder, Draw, Invoice, LineItem } from "@/lib/billing/types";

const L = (id: string, group: string, room_id: string | null, description: string, qty: number, unit: LineItem["unit"], dollars: number, element_ids: string[] = [], extra: Partial<LineItem> = {}): LineItem =>
  ({ id, group, room_id, description, qty, unit, unit_price: Math.round(dollars * 100), element_ids, ...extra });

export const SAMPLE_BRAND: Brand = {
  name: "Demo Builders", logo_url: null, brand_color: "#ff6a1f", phone: "(555) 010-2030", email: "office@demobuilders.test",
  address: "220 Mill Street, Springfield", license_no: "CSLB 1048832", tier: "standard",
};

const lines: LineItem[] = [
  L("l1", "Kitchen", "G-R04", "Demolition and haul-away of existing cabinets and counters", 1, "lot", 2400),
  L("l2", "Kitchen", "G-R04", "Shaker cabinets, supply and install", 22, "lf", 410),
  L("l3", "Kitchen", "G-R04", "Quartz countertops with undermount sink cut-out", 48, "sqft", 85),
  L("l4", "Kitchen", "G-R04", "Electrical: 4 new outlets, under-cabinet lighting", 1, "lot", 1850),
  L("l5", "Kitchen", "G-R04", "Tile backsplash", 32, "sqft", 28, [], { optional: true }),
  L("l6", "Lavatory", "G-R07", "New toilet and vanity basin, rough-in reuse", 1, "lot", 1650, ["G-F22", "G-F23"]),
  L("l7", "Bathroom", "1-R04", "Strip to studs, waterproof, tile floor and walls", 1, "lot", 7800, ["1-F20", "1-F21"]),
  L("l8", "Bathroom", "1-R07", "Remove tub, curbless shower with glass screen", 1, "lot", 9400, ["1-F28", "1-F31"]),
  L("l9", "Bathroom", "1-R07", "Heated floor", 45, "sqft", 22, [], { optional: true }),
  L("l10", "Whole house", null, "Permits and inspections", 1, "lot", 1200, [], { taxable: false }),
  L("l11", "Whole house", null, "Site protection and daily clean-up", 1, "lot", 950, [], { taxable: false }),
];

const schedule: Draw[] = [
  { id: "d1", label: "Deposit at signing", pct: 0.3, stage_name: null, invoice_id: "inv1" },
  { id: "d2", label: "Demolition done", pct: 0.2, stage_name: "Demolition", invoice_id: "inv2" },
  { id: "d3", label: "Rough-in done", pct: 0.3, stage_name: "Rough-in: plumbing, electrical, HVAC", invoice_id: null },
  { id: "d4", label: "Final, at handover", pct: 0.2, stage_name: "Handover", invoice_id: null },
];

const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString();

/** The approved quote total is $42,306.42 with the backsplash chosen and 8.25% tax. With CO-1 ($768.58)
 *  the contract is $43,075.00; CO-2 ($1,238.38) is waiting on the client. */
export function sampleBilling(jobId: string): Billing {
  const quote = {
    id: "q1", job_id: jobId, number: "Q-1001", title: "Kitchen and bathrooms renovation", status: "approved" as const, lines, chosen: ["l5"],
    tax_rate: 0.0825, discount: 0, schedule, notes: "Fixtures and finishes as chosen in the showroom visit. Allowances are listed per room.",
    terms: "Work starts within 2 weeks of the deposit. Changes are quoted as change orders before work.", valid_until: day(30).slice(0, 10),
    ai_drafted: false, created_at: day(-21), sent_at: day(-20), viewed_at: day(-19), approved_at: day(-18), signed_by: "Priya Okafor", declined_at: null,
  };
  const bill = (id: string, number: string, title: string, kind: "deposit" | "progress", draw: Draw, status: "sent" | "paid", issued: number) => ({
    id, job_id: jobId, quote_id: "q1", draw_id: draw.id, number, title, kind, stage_name: draw.stage_name, status,
    lines: [L(`${id}-1`, "Payment plan", null, `${draw.label}: ${Math.round(draw.pct * 100)}% of ${quote.number}`, 1, "lot", 0, [], { taxable: false })],
    tax_rate: 0, discount: 0, issued_at: day(issued), due_date: day(issued + 14).slice(0, 10), notes: null, created_at: day(issued),
  });
  // the quote total (with tax) split by the draw, so the invoice lines carry the money
  const total = 4230642;
  const inv1 = bill("inv1", "INV-1001", "Deposit", "deposit", schedule[0], "paid", -18);
  inv1.lines[0].unit_price = Math.round(total * 0.3);
  const inv2 = bill("inv2", "INV-1002", "Demolition done", "progress", schedule[1], "sent", -2);
  inv2.lines[0].unit_price = Math.round(total * 0.2);
  const co1Lines = [
    L("co1-1", "Kitchen", "G-R04", "Move outlet from the window wall to the island side", 1, "lot", 380),
    L("co1-2", "Kitchen", "G-R04", "LED pot lights over the sink and island, supply and install", 2, "ea", 165),
  ];
  const co1: ChangeOrder = {
    id: "co1", job_id: jobId, quote_id: "q1", number: "CO-1", title: "Move kitchen outlet and add two pot lights", reason: "Client asked for it",
    status: "approved", lines: co1Lines, tax_rate: 0.0825, days_added: 1, bill: "now", invoice_id: "inv3",
    created_at: day(-6), sent_at: day(-6), approved_at: day(-5), signed_by: "Priya Okafor",
    activity: [
      { at: day(-6), what: "Sent to the client" }, { at: day(-6), what: "Opened by the client" },
      { at: day(-5), what: "Approved", who: "Priya Okafor" }, { at: day(-5), what: "Invoice INV-1003 sent" },
    ],
  };
  const inv3: Invoice = {
    id: "inv3", job_id: jobId, quote_id: "q1", draw_id: null, number: "INV-1003", title: `Change order CO-1: ${co1.title}`, kind: "standard",
    stage_name: null, status: "sent", lines: co1Lines.map((l) => ({ ...l, id: `inv3-${l.id}` })), tax_rate: 0.0825, discount: 0,
    issued_at: day(-5), due_date: day(9).slice(0, 10), notes: null, created_at: day(-5), change_order_id: "co1",
    activity: [{ at: day(-5), what: "Sent with CO-1" }],
  };
  const co2: ChangeOrder = {
    id: "co2", job_id: jobId, quote_id: "q1", number: "CO-2", title: "Tile upgrade over allowance", reason: "Allowance difference",
    status: "sent",
    lines: [L("co2-1", "Bathroom", "1-R04", "Large-format porcelain chosen at $14/sqft over the $6/sqft allowance", 143, "sqft", 8, ["1-F20", "1-F21"], { allowance: true })],
    tax_rate: 0.0825, days_added: 0, bill: "final", invoice_id: null,
    created_at: day(-2), sent_at: day(-1), approved_at: null, signed_by: null,
    activity: [{ at: day(-1), what: "Sent to the client" }],
  };
  return {
    quotes: [quote],
    invoices: [inv1, inv2, inv3],
    change_orders: [co1, co2],
    payments: [{ id: "pay1", job_id: jobId, invoice_id: "inv1", amount: inv1.lines[0].unit_price, method: "ach", status: "succeeded", reference: "Chase •••• 6789", payer_name: "Priya Okafor", fee: 500, paid_at: day(-17) }],
  };
}
