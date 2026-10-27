// Four more jobs with money on them, so the Money page has something real to show: a kitchen with a
// late final invoice, a basement quote the client opened and never answered, an insurance roof job paid
// in full, and a new build billed in draws. Dates are relative to today. Amounts in cents.
import type { Billing, ChangeOrder, Draw, Invoice, LineItem, Payment, Quote } from "@/lib/billing/types";
import { quoteTotals, changeOrderTotals } from "@/lib/billing/money";
import type { JobMoneyRow } from "@/lib/billing/overview";

const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString();
const date = (offset: number) => day(offset).slice(0, 10);

const L = (id: string, group: string, room_id: string | null, description: string, qty: number, unit: LineItem["unit"], dollars: number, extra: Partial<LineItem> = {}): LineItem =>
  ({ id, group, room_id, description, qty, unit, unit_price: Math.round(dollars * 100), element_ids: [], ...extra });

function quote(p: {
  id: string; job_id: string; number: string; title: string; status: Quote["status"]; lines: LineItem[]; chosen?: string[];
  schedule?: Draw[]; created: number; sent?: number | null; viewed?: number | null; approved?: number | null; signed_by?: string | null; tax?: number;
}): Quote {
  return {
    id: p.id, job_id: p.job_id, number: p.number, title: p.title, status: p.status, lines: p.lines, chosen: p.chosen ?? [],
    tax_rate: p.tax ?? 0.0825, discount: 0, schedule: p.schedule ?? [], notes: null,
    terms: "Changes are quoted as change orders before work.", valid_until: date(p.created + 30),
    ai_drafted: false, created_at: day(p.created),
    sent_at: p.sent != null ? day(p.sent) : null, viewed_at: p.viewed != null ? day(p.viewed) : null,
    approved_at: p.approved != null ? day(p.approved) : null, signed_by: p.signed_by ?? null, declined_at: null,
  };
}

/** One invoice for a share of a quote (a draw), as a single untaxed line carrying the money. */
function drawInvoice(p: {
  id: string; job_id: string; quote: Quote; draw: Draw; number: string; kind: Invoice["kind"]; status: Invoice["status"];
  issued: number | null; terms?: number; created?: number;
}): Invoice {
  const amount = Math.round(quoteTotals(p.quote).total * p.draw.pct);
  p.draw.invoice_id = p.id;
  return {
    id: p.id, job_id: p.job_id, quote_id: p.quote.id, draw_id: p.draw.id, number: p.number, title: p.draw.label, kind: p.kind,
    stage_name: p.draw.stage_name, status: p.status,
    lines: [L(`${p.id}-1`, "Payment plan", null, `${p.draw.label}: ${Math.round(p.draw.pct * 100)}% of ${p.quote.number}`, 1, "lot", amount / 100, { taxable: false })],
    tax_rate: 0, discount: 0, issued_at: p.issued != null ? day(p.issued) : null,
    due_date: p.issued != null ? date(p.issued + (p.terms ?? 14)) : null, notes: null, created_at: day(p.created ?? p.issued ?? -1),
  };
}

const pay = (id: string, inv: Invoice, amount: number, method: Payment["method"], reference: string, payer: string, at: number): Payment => ({
  id, job_id: inv.job_id, invoice_id: inv.id, amount, method, status: "succeeded", reference, payer_name: payer,
  fee: method === "card" ? Math.round(amount * 0.029) + 30 : method === "ach" ? Math.min(500, Math.round(amount * 0.008)) : 0,
  paid_at: day(at),
});
const full = (inv: Invoice) => inv.lines.reduce((s, l) => s + Math.round(l.qty * l.unit_price), 0);

function maple(): Billing {
  const job = "job-maple";
  const schedule: Draw[] = [
    { id: "m-d1", label: "Deposit at signing", pct: 0.3, stage_name: null, invoice_id: null },
    { id: "m-d2", label: "Cabinets installed", pct: 0.4, stage_name: "Cabinets", invoice_id: null },
    { id: "m-d3", label: "Final, at handover", pct: 0.3, stage_name: "Handover", invoice_id: null },
  ];
  const q = quote({
    id: "m-q1", job_id: job, number: "Q-1012", title: "Kitchen remodel", status: "approved", schedule, chosen: ["m-l6"],
    created: -128, sent: -127, viewed: -126, approved: -124, signed_by: "Linh Nguyen",
    lines: [
      L("m-l1", "Kitchen", "G-R02", "Demolition and haul-away", 1, "lot", 2200),
      L("m-l2", "Kitchen", "G-R02", "Semi-custom cabinets, supply and install", 26, "lf", 450),
      L("m-l3", "Kitchen", "G-R02", "Quartz countertops", 54, "sqft", 88),
      L("m-l4", "Kitchen", "G-R02", "Plumbing: sink, dishwasher and gas range hookup", 1, "lot", 2600),
      L("m-l5", "Kitchen", "G-R02", "LVP flooring", 210, "sqft", 9),
      L("m-l6", "Kitchen", "G-R02", "Tile backsplash", 36, "sqft", 30, { optional: true }),
      L("m-l7", "Dining", "G-R03", "Open up wall to dining, new header", 1, "lot", 4800),
      L("m-l8", "Whole house", null, "Permits and inspections", 1, "lot", 950, { taxable: false }),
    ],
  });
  const draft = quote({
    id: "m-q2", job_id: job, number: "Q-1019", title: "Pantry built-ins", status: "draft", created: -2,
    lines: [L("m-p1", "Pantry", "G-R05", "Built-in pantry shelving and pull-outs", 1, "lot", 3400)],
  });
  const co: ChangeOrder = {
    id: "m-co1", job_id: job, quote_id: q.id, number: "CO-1", title: "Rotted subfloor under sink", reason: "Found on site", status: "approved",
    lines: [L("m-c1", "Kitchen", "G-R02", "Replace subfloor, 40 sqft", 40, "sqft", 18)], tax_rate: 0.0825, days_added: 1, bill: "final",
    invoice_id: null, created_at: day(-70), sent_at: day(-70), approved_at: day(-69), signed_by: "Linh Nguyen",
  };
  const i1 = drawInvoice({ id: "m-i1", job_id: job, quote: q, draw: schedule[0], number: "INV-1031", kind: "deposit", status: "paid", issued: -124 });
  const i2 = drawInvoice({ id: "m-i2", job_id: job, quote: q, draw: schedule[1], number: "INV-1038", kind: "progress", status: "paid", issued: -62 });
  const i3 = drawInvoice({ id: "m-i3", job_id: job, quote: q, draw: schedule[2], number: "INV-1047", kind: "final", status: "viewed", issued: -26 });
  i3.lines.push(L("m-i3-2", "Change orders", "G-R02", "CO-1: Rotted subfloor under sink", 1, "lot", changeOrderTotals(co).total / 100, { taxable: false }));
  co.invoice_id = i3.id;
  return {
    quotes: [q, draft], change_orders: [co], invoices: [i1, i2, i3],
    payments: [
      pay("m-p1", i1, full(i1), "ach", "Chase •••• 2210", "Linh Nguyen", -122),
      pay("m-p2", i2, full(i2), "card", "Visa •••• 8841", "Linh Nguyen", -55),
    ],
  };
}

function brook(): Billing {
  const job = "job-brook";
  const schedule: Draw[] = [
    { id: "b-d1", label: "Deposit at signing", pct: 0.35, stage_name: null, invoice_id: null },
    { id: "b-d2", label: "Framing and drywall done", pct: 0.4, stage_name: "Drywall", invoice_id: null },
    { id: "b-d3", label: "Final, at handover", pct: 0.25, stage_name: "Handover", invoice_id: null },
  ];
  const q = quote({
    id: "b-q1", job_id: job, number: "Q-1016", title: "Basement finish", status: "viewed", schedule,
    created: -9, sent: -8, viewed: -6,
    lines: [
      L("b-l1", "Family room", "B-R01", "Frame, insulate and drywall exterior walls", 620, "sqft", 14),
      L("b-l2", "Family room", "B-R01", "Carpet and pad", 480, "sqft", 6.5),
      L("b-l3", "Bedroom", "B-R02", "Egress window, cut and well", 1, "ea", 4200),
      L("b-l4", "Bedroom", "B-R02", "Frame, drywall, door and closet", 1, "lot", 5600),
      L("b-l5", "Bathroom", "B-R03", "Full bath: rough-in, tile shower, vanity, toilet", 1, "lot", 14800),
      L("b-l6", "Whole house", null, "Electrical: recessed lights and outlets throughout", 1, "lot", 5200),
      L("b-l7", "Whole house", null, "Permits and inspections", 1, "lot", 1100, { taxable: false }),
    ],
  });
  return { quotes: [q], invoices: [], payments: [] };
}

function elm(): Billing {
  const job = "job-elm";
  const schedule: Draw[] = [
    { id: "e-d1", label: "Deposit at signing", pct: 0.5, stage_name: null, invoice_id: null },
    { id: "e-d2", label: "Final, after the roof passes inspection", pct: 0.5, stage_name: "Inspection", invoice_id: null },
  ];
  const q = quote({
    id: "e-q1", job_id: job, number: "Q-1009", title: "Roof leak repair (insurance claim)", status: "approved", schedule, tax: 0,
    created: -150, sent: -149, viewed: -149, approved: -146, signed_by: "Mark Carter",
    lines: [
      L("e-l1", "Roof", null, "Tear off and replace 9 squares of shingles over the leak", 9, "ea", 640),
      L("e-l2", "Roof", null, "Replace step flashing and chimney counter-flashing", 1, "lot", 1450),
      L("e-l3", "Bedroom", "1-R02", "Replace stained ceiling drywall, prime and paint", 1, "lot", 1350),
      L("e-l4", "Whole house", null, "Dumpster and clean-up", 1, "lot", 600),
    ],
  });
  const i1 = drawInvoice({ id: "e-i1", job_id: job, quote: q, draw: schedule[0], number: "INV-1022", kind: "deposit", status: "paid", issued: -146 });
  const i2 = drawInvoice({ id: "e-i2", job_id: job, quote: q, draw: schedule[1], number: "INV-1029", kind: "final", status: "paid", issued: -118, terms: 30 });
  return {
    quotes: [q], invoices: [i1, i2],
    payments: [
      pay("e-p1", i1, full(i1), "check", "Check #2281", "Mark Carter", -143),
      pay("e-p2", i2, full(i2), "check", "Insurer check #88412", "Carter household", -75),
    ],
  };
}

function pine(): Billing {
  const job = "job-pine";
  const schedule: Draw[] = [
    { id: "p-d1", label: "Deposit at signing", pct: 0.1, stage_name: null, invoice_id: null },
    { id: "p-d2", label: "Foundation done", pct: 0.15, stage_name: "Foundation", invoice_id: null },
    { id: "p-d3", label: "Framing done", pct: 0.2, stage_name: "Framing", invoice_id: null },
    { id: "p-d4", label: "Dried in", pct: 0.15, stage_name: "Roof and windows", invoice_id: null },
    { id: "p-d5", label: "Rough-in done", pct: 0.15, stage_name: "Rough-in", invoice_id: null },
    { id: "p-d6", label: "Drywall done", pct: 0.15, stage_name: "Drywall", invoice_id: null },
    { id: "p-d7", label: "Final, at handover", pct: 0.1, stage_name: "Handover", invoice_id: null },
  ];
  const q = quote({
    id: "p-q1", job_id: job, number: "Q-1004", title: "New build, lot 14", status: "approved", schedule, tax: 0,
    created: -185, sent: -184, viewed: -183, approved: -178, signed_by: "Erik Halvorsen",
    lines: [
      L("p-l1", "Whole house", null, "Site work, excavation and foundation", 1, "lot", 58000),
      L("p-l2", "Whole house", null, "Framing, sheathing and trusses", 1, "lot", 96000),
      L("p-l3", "Whole house", null, "Roofing, windows and exterior doors", 1, "lot", 61000),
      L("p-l4", "Whole house", null, "Plumbing, electrical and HVAC", 1, "lot", 88000),
      L("p-l5", "Kitchen", "G-R02", "Cabinets, counters and appliances", 1, "lot", 42000),
      L("p-l6", "Bathroom", "1-R03", "Primary bath finishes", 1, "lot", 18500),
      L("p-l7", "Bathroom", "1-R05", "Hall bath finishes", 1, "lot", 9800),
      L("p-l8", "Whole house", null, "Drywall, trim, paint and flooring", 1, "lot", 64000),
    ],
  });
  const garage = quote({
    id: "p-q2", job_id: job, number: "Q-1018", title: "Detached garage add-on", status: "sent", tax: 0,
    created: -5, sent: -4,
    lines: [L("p-g1", "Garage", null, "24 x 24 detached garage, slab, framing, roof and door", 1, "lot", 46500)],
  });
  const inv = (i: number, number: string, kind: Invoice["kind"], status: Invoice["status"], issued: number | null, created?: number) =>
    drawInvoice({ id: `p-i${i + 1}`, job_id: job, quote: q, draw: schedule[i], number, kind, status, issued, created });
  const i1 = inv(0, "INV-1015", "deposit", "paid", -178);
  const i2 = inv(1, "INV-1024", "progress", "paid", -140);
  const i3 = inv(2, "INV-1033", "progress", "paid", -98);
  const i4 = inv(3, "INV-1040", "progress", "paid", -60);
  const i5 = inv(4, "INV-1045", "progress", "sent", -9);
  const i6 = inv(5, "INV-1050", "progress", "draft", null, -1);
  return {
    quotes: [q, garage], invoices: [i1, i2, i3, i4, i5, i6],
    payments: [
      pay("p-p1", i1, full(i1), "ach", "US Bank •••• 4410", "Halvorsen Homes", -176),
      pay("p-p2", i2, full(i2), "ach", "US Bank •••• 4410", "Halvorsen Homes", -132),
      pay("p-p3", i3, full(i3), "ach", "US Bank •••• 4410", "Halvorsen Homes", -90),
      pay("p-p4", i4, Math.round(full(i4) * 0.5), "ach", "US Bank •••• 4410", "Halvorsen Homes", -52),
      pay("p-p5", i4, full(i4) - Math.round(full(i4) * 0.5), "ach", "US Bank •••• 4410", "Halvorsen Homes", -12),
    ],
  };
}

export function sampleOtherJobs(): JobMoneyRow[] {
  return [
    { jobId: "job-maple", jobName: "Maple Ave kitchen", clientName: "Linh and Tuan Nguyen", address: "418 Maple Ave, Springfield", billing: maple() },
    { jobId: "job-brook", jobName: "Brook St basement", clientName: "Dana Reyes", address: "72 Brook St, Springfield", billing: brook() },
    { jobId: "job-elm", jobName: "Elm Court roof leak (insurance)", clientName: "Mark and Jen Carter", address: "9 Elm Court, Shelbyville", billing: elm() },
    { jobId: "job-pine", jobName: "Pine Ridge new build", clientName: "Halvorsen Homes", address: "Lot 14, Pine Ridge Rd", billing: pine() },
  ];
}
