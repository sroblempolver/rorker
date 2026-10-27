// The materials and purchasing list. Each line is one thing to get, for one job, ideally tied to the
// spot on the plan where it goes and to the people who get it and use it. One add can make several
// lines (the same thing for other jobs); they share a group id so the shopping run can show the split.
import type { PinAnchor } from "@/lib/data/types";

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
