// Where contractors order from: the big boxes, trade supply houses by trade, lumber yards and online.
// The "Order from" box suggests these as they type, plus the company's own stores and the store used
// last time for the same item. Names only; nothing here is connected to a supplier.
import type { SuggestGroup } from "./suggest";

export type StoreKind = "Big box" | "Plumbing & HVAC" | "Electrical" | "Lumber & building" | "Roofing & siding" | "Tile & flooring" | "Paint" | "Online";

export const STORES: { name: string; kind: StoreKind }[] = [
  ...["Home Depot", "Lowe's", "Menards", "Ace Hardware", "True Value", "Harbor Freight"].map((name) => ({ name, kind: "Big box" as const })),
  ...["Ferguson", "Winsupply", "Hajoca", "Johnstone Supply", "Watsco", "SupplyHouse.com", "Consolidated Supply"].map((name) => ({ name, kind: "Plumbing & HVAC" as const })),
  ...["CED", "Graybar", "Rexel", "Platt Electric", "Crescent Electric", "Mayer", "Border States"].map((name) => ({ name, kind: "Electrical" as const })),
  ...["84 Lumber", "Builders FirstSource", "BMC", "L&W Supply", "Foundation Building Materials", "US LBM", "local lumber yard"].map((name) => ({ name, kind: "Lumber & building" as const })),
  ...["ABC Supply", "SRS Distribution", "QXO (Beacon)", "Allied Building Products"].map((name) => ({ name, kind: "Roofing & siding" as const })),
  ...["Floor & Decor", "The Tile Shop", "MSI", "Daltile", "LL Flooring"].map((name) => ({ name, kind: "Tile & flooring" as const })),
  ...["Sherwin-Williams", "Benjamin Moore dealer", "PPG Paints", "Behr (Home Depot)"].map((name) => ({ name, kind: "Paint" as const })),
  ...["Amazon", "Build.com", "Wayfair Professional", "Grainger", "Zoro"].map((name) => ({ name, kind: "Online" as const })),
];

/** Which supply houses fit a trade, for "Suggested for this". */
const FOR_GROUP: Partial<Record<SuggestGroup, StoreKind>> = {
  Plumbing: "Plumbing & HVAC", Electrical: "Electrical", "Framing & drywall": "Lumber & building", Finishes: "Tile & flooring",
};

/** The company's own stores, kept on this device in the preview. */
const KEY = "rorker.stores";
export function ownStores(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]; } catch { return []; }
}
export function saveStore(name: string) {
  const n = name.trim();
  if (!n || STORES.some((s) => s.name.toLowerCase() === n.toLowerCase())) return;
  try { localStorage.setItem(KEY, JSON.stringify([n, ...ownStores().filter((x) => x.toLowerCase() !== n.toLowerCase())].slice(0, 30))); } catch { /* private window */ }
}

export interface StoreOption { name: string; note: string }

/** What to offer for the typed text: last time for this item, your stores, then the full list. */
export function storeOptions(typed: string, opts: { used: string[]; lastFor?: string | null; group?: SuggestGroup | null; isPaint?: boolean }): StoreOption[] {
  const q = typed.trim().toLowerCase();
  const out: StoreOption[] = [];
  const add = (name: string, note: string) => { if (!out.some((o) => o.name.toLowerCase() === name.toLowerCase()) && (!q || name.toLowerCase().includes(q))) out.push({ name, note }); };
  if (opts.lastFor) add(opts.lastFor, "last time for this");
  for (const s of opts.used) add(s, "your store");
  for (const s of ownStores()) add(s, "your store");
  const kind = opts.isPaint ? "Paint" : opts.group ? FOR_GROUP[opts.group] : null;
  if (kind) for (const s of STORES.filter((x) => x.kind === kind)) add(s.name, `${kind.toLowerCase()} supply`);
  for (const s of STORES) add(s.name, s.kind);
  return out;
}
