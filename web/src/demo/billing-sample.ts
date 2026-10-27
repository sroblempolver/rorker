// Sample money for the Hadley Road house in the preview: an approved quote (kitchen, both upstairs
// bathrooms, the lavatory), its payment plan, a paid deposit and a progress invoice waiting on the client.
// Marking "Rough-in" done in Stages brings up the next draw to bill.
import type { Billing, Brand, Draw, LineItem } from "@/lib/billing/types";

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

/** The approved quote total is $42,306.42 with the backsplash chosen and 8.25% tax. */
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
  return {
    quotes: [quote],
    invoices: [inv1, inv2],
    payments: [{ id: "pay1", job_id: jobId, invoice_id: "inv1", amount: inv1.lines[0].unit_price, method: "ach", status: "succeeded", reference: "Chase •••• 6789", payer_name: "Priya Okafor", fee: 500, paid_at: day(-17) }],
  };
}
