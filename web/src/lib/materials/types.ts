// The materials and purchasing list. Each line is one thing to get, for one job, ideally tied to the
// spot on the plan where it goes and to the people who get it and use it. One add can make several
// lines (the same thing for other jobs); they share a group id so the shopping run can show the split.
import type { PinAnchor, PinStatus } from "@/lib/data/types";
import type { SuggestGroup } from "./suggest";

/** to buy → ordered → picked up / delivered → installed. "Returned" covers extras taken back. */
export type BuyStatus = "to_buy" | "ordered" | "got" | "installed" | "returned";
/** how it gets there: picked up at the store, delivered, or taken from the van or the shop */
export type Fulfil = "pickup" | "delivery" | "stock";
export type Unit = "ea" | "box" | "gal" | "sqft" | "lf" | "sheet" | "bag" | "tube" | "roll" | "set";

export interface MaterialLine {
  id: string; job_id: string; group_id: string | null;
  name: string; qty: number; unit: Unit;
  /** dollars per unit, an estimate until there's a receipt */
  unit_cost: number | null;
  store: string | null; link: string | null; sku: string | null;
  status: BuyStatus; fulfil: Fulfil;
  /** delivery only; empty means the job's address */
  deliver_to: string | null;
  /** team member who gets it (buys, picks up, takes from stock) */
  buyer: string | null;
  /** team member who uses or installs it */
  installer: string | null;
  needed_by: string | null; stage_id: string | null; note: string | null;
  /** days the store takes to get it (special order); with needed_by it gives the order-by date */
  lead_days: number | null;
  /** which trade it's for (electrical, plumbing …), for grouping and supplier suggestions */
  trade: SuggestGroup | null;
  /** where it goes: an element of the plan, or a spot on a wall or outside */
  element_id: string | null; floor_id: string | null; x: number | null; y: number | null; anchor: PinAnchor | null;
  /** the material pin that shows it on the map */
  pin_id: string | null;
  /** receipt photos (object URLs in the preview) */
  receipts: string[];
  created_at: string;
}
export type MaterialInput = Omit<MaterialLine, "id" | "created_at" | "receipts" | "pin_id"> & { receipts?: string[]; pin_id?: string | null };

export interface MaterialsJob { id: string; name: string; address: string | null }

/** What the list needs from the outside world (memory in the preview; a table later). */
export interface MaterialsApi {
  list(): Promise<MaterialLine[]>;
  create(input: MaterialInput[]): Promise<MaterialLine[]>;
  update(id: string, patch: Partial<MaterialInput>): Promise<MaterialLine>;
  remove(id: string): Promise<void>;
}

export const STATUS_LABEL: Record<BuyStatus, string> = { to_buy: "To buy", ordered: "Ordered", got: "Got it", installed: "Installed", returned: "Returned" };
export const STATUS_COLOR: Record<BuyStatus, string> = { to_buy: "#e8432e", ordered: "#f3c530", got: "#55b2ff", installed: "#3fb46a", returned: "#9c978d" };
export const FULFIL_LABEL: Record<Fulfil, string> = { pickup: "Pick up", delivery: "Delivery", stock: "From stock" };
export const UNITS: Unit[] = ["ea", "box", "gal", "sqft", "lf", "sheet", "bag", "tube", "roll", "set"];
/** the next step when a line's box is ticked */
export const NEXT_STATUS: Record<BuyStatus, BuyStatus> = { to_buy: "got", ordered: "got", got: "installed", installed: "installed", returned: "returned" };

export const lineTotal = (l: Pick<MaterialLine, "qty" | "unit_cost">) => (l.unit_cost ?? 0) * l.qty;
export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n >= 100 || Number.isInteger(n) ? 0 : 2, maximumFractionDigits: n >= 100 ? 0 : 2 });
export const qtyText = (qty: number, unit: Unit) => `${+qty.toFixed(2)}${unit === "ea" ? "" : ` ${unit}`}`;

const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
/** The last day to order so it arrives by the needed-by date; null without both. */
export const orderBy = (l: Pick<MaterialLine, "needed_by" | "lead_days">) => (l.needed_by && l.lead_days ? addDays(l.needed_by, l.lead_days) : null);
/** Still to buy and the order-by date is today or past (or within `soon` days). */
export const orderNow = (l: MaterialLine, today: string, soon = 0) => {
  const by = orderBy(l);
  return l.status === "to_buy" && !!by && by <= addDays(today, -soon);
};

/** What a material pin on the map says: one line, or every line added together at one spot.
 *  Open while anything is still to get, in progress once it's all here, done when it's all in. */
export function pinSummary(ls: Pick<MaterialLine, "qty" | "unit" | "name" | "buyer" | "installer" | "needed_by" | "status">[]) {
  const title = ls.length === 1 ? `Buy ${qtyText(ls[0].qty, ls[0].unit)} ${ls[0].name}` : `Buy ${ls.length} items: ${ls.slice(0, 2).map((l) => l.name).join(", ")}${ls.length > 2 ? "…" : ""}`;
  const status: PinStatus = ls.some((l) => l.status === "to_buy" || l.status === "ordered") ? "open" : ls.some((l) => l.status === "got") ? "in_progress" : "done";
  const due = ls.map((l) => l.needed_by).filter(Boolean).sort()[0] ?? null;
  return { title, status, due_date: due, tagged: [...new Set(ls.flatMap((l) => [l.buyer, l.installer]).filter(Boolean) as string[])] };
}
