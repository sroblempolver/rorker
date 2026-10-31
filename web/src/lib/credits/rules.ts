// The credit rules: what an action costs, whether a plan fits the account's tier, and which credits are
// due (a homeowner's welcome credits, a plan's monthly credits, unused monthly credits running out).
// The page uses these to show prices and prompts; the `credits` edge function runs the very same code
// (copied in by web/preview/build-links.mjs) and is the one that keeps the balance.
import type { Plan } from "@/lib/plan/types";
import { CREDITS, type AccountKind, type ActionId, type Tier, type TierId } from "./config";

export type Reason = "welcome" | "allowance" | "expired" | "purchase" | "spend" | "referral" | "refund";

/** One line in an account's credit history. Credits only ever change by adding a line. */
export interface LedgerRow {
  delta: number;
  reason: Reason;
  action?: string | null;
  ref?: string | null;
  note?: string | null;
  created_at: string;
}

/** Which kind of account this is and its plan (a homeowner's account has no paid tier). */
export interface CreditPlan {
  kind: AccountKind;
  tier: TierId;
  /** when the plan's months count from */
  period_start: string;
}

/** Everything the Credits page and the prompts need. */
export interface CreditState {
  plan: CreditPlan;
  balance: number;
  ledger: LedgerRow[];
  /** plans (jobs with a drawing) the account has now */
  plans: number;
  testPayments: boolean;
}

export interface Size { floors: number; sqft: number }

/** Why something can't go ahead, said kindly, with the tier that would allow it. */
export interface Block {
  reason: "credits" | "plans" | "floors" | "sqft";
  title: string;
  message: string;
  /** the smallest tier that fits (business accounts only) */
  upgrade: Tier | null;
  need?: number;
  have?: number;
}

const DAY = 86_400_000;
const fmt = (x: number) => x.toLocaleString("en-US");

export const tierOf = (id: TierId): Tier => CREDITS.tiers.find((t) => t.id === id) ?? CREDITS.tiers[0];
export const actionOf = (id: ActionId) => CREDITS.actions.find((a) => a.id === id);
export const isPaid = (p: CreditPlan) => p.kind === "business" && tierOf(p.tier).price > 0;

/** The limits on one account: its tier's, or a homeowner's. */
export function limitsOf(p: CreditPlan): Pick<Tier, "maxPlans" | "maxFloors" | "maxSqft"> {
  return p.kind === "consumer" ? CREDITS.consumerLimits : tierOf(p.tier);
}

/** Credits one use of an action costs this account (times how many). */
export function costOf(kind: AccountKind, action: ActionId, count = 1): number {
  const a = actionOf(action);
  return a ? a.cost[kind] * Math.max(0, Math.floor(count)) : 0;
}

export const balanceOf = (ledger: LedgerRow[]) => ledger.reduce((s, r) => s + r.delta, 0);

/** How big a plan is: its floors, and its rooms' floor area added up, in square feet. */
export function planSize(plan: Pick<Plan, "floors"> | null | undefined): Size {
  if (!plan) return { floors: 0, sqft: 0 };
  const m2 = plan.floors.reduce((s, f) => s + f.rooms.reduce((r, x) => r + (x.area_m2 || 0), 0), 0);
  return { floors: plan.floors.length, sqft: Math.round(m2 * 10.7639) };
}

/** Things (furniture, fixtures) on a plan, to charge for the ones placed since last time. */
export const itemCount = (plan: Pick<Plan, "floors"> | null | undefined) => (plan ? plan.floors.reduce((s, f) => s + f.fixtures.length, 0) : 0);

/** The smallest tier that allows this many plans and this size. */
export function tierFor(need: Partial<Size> & { plans?: number }, from: TierId): Tier | null {
  const start = CREDITS.tiers.findIndex((t) => t.id === from);
  const ok = (lim: number | null, v: number | undefined) => lim === null || v === undefined || v <= lim;
  return CREDITS.tiers.slice(start + 1).find((t) => ok(t.maxPlans, need.plans) && ok(t.maxFloors, need.floors) && ok(t.maxSqft, need.sqft)) ?? null;
}

/** Whether a plan this size (and this many plans in all) fits the account. */
export function checkLimits(p: CreditPlan, need: Partial<Size> & { plans?: number }): Block | null {
  const lim = limitsOf(p);
  const biz = p.kind === "business";
  const tier = tierOf(p.tier);
  const up = biz ? tierFor(need, p.tier) : null;
  const where = biz ? `Your ${tier.name} plan` : "A homeowner plan";
  const then = (what: string) => (up ? ` ${up.name} allows ${what}.` : biz ? " Talk to us about a bigger plan." : " Ask your contractor to build it on their Rorker account.");
  if (lim.maxPlans !== null && need.plans !== undefined && need.plans > lim.maxPlans)
    return { reason: "plans", title: "You've used all your plans", message: `${where} covers ${fmt(lim.maxPlans)} plan${lim.maxPlans === 1 ? "" : "s"}.${then(up?.maxPlans === null ? "as many as you like" : `${fmt(up?.maxPlans ?? 0)}`)}`, upgrade: up };
  if (lim.maxFloors !== null && need.floors !== undefined && need.floors > lim.maxFloors)
    return { reason: "floors", title: `This plan has ${need.floors} floors`, message: `${where} covers up to ${fmt(lim.maxFloors)} floor${lim.maxFloors === 1 ? "" : "s"} in a plan.${then(up?.maxFloors === null ? "any number of floors" : `up to ${fmt(up?.maxFloors ?? 0)}`)}`, upgrade: up };
  if (lim.maxSqft !== null && need.sqft !== undefined && need.sqft > lim.maxSqft)
    return { reason: "sqft", title: `This plan is ${fmt(need.sqft)} sq ft`, message: `${where} covers up to ${fmt(lim.maxSqft)} sq ft in a plan.${then(up?.maxSqft === null ? "any size" : `up to ${fmt(up?.maxSqft ?? 0)} sq ft`)}`, upgrade: up };
  return null;
}

/** Whether the account can do this now: its limits first, then its credits. */
export function checkSpend(s: Pick<CreditState, "plan" | "balance" | "plans">, action: ActionId, opts: { count?: number; size?: Size; newPlan?: boolean } = {}): { ok: true; cost: number } | { ok: false; block: Block } {
  const need = { ...(opts.size ?? {}), ...(opts.newPlan ? { plans: s.plans + 1 } : {}) };
  const limit = checkLimits(s.plan, need);
  if (limit) return { ok: false, block: limit };
  const cost = costOf(s.plan.kind, action, opts.count ?? 1);
  if (cost > s.balance) {
    const a = actionOf(action);
    return { ok: false, block: { reason: "credits", title: "Not enough credits", message: `${a?.name ?? "This"} needs ${fmt(cost)} credit${cost === 1 ? "" : "s"} and you have ${fmt(Math.max(0, s.balance))}.`, upgrade: s.plan.kind === "business" ? tierFor({}, s.plan.tier) : null, need: cost, have: s.balance } };
  }
  return { ok: true, cost };
}

/** Which plan month it is (0 is the first). */
export const periodOf = (start: string, at: string) => Math.max(0, Math.floor((Date.parse(at) - Date.parse(start)) / (CREDITS.periodDays * DAY)));
export const periodEnds = (start: string, at: string) => new Date(Date.parse(start) + (periodOf(start, at) + 1) * CREDITS.periodDays * DAY).toISOString();

/** Credit lines that are due now: welcome credits, this month's plan credits (or the top-up after an
 *  upgrade), and last month's unused plan credits running out. Each has a ref, so it's added once. */
export function dueGrants(p: CreditPlan, ledger: LedgerRow[], at: string): LedgerRow[] {
  const out: LedgerRow[] = [];
  const has = (ref: string) => ledger.some((r) => r.ref === ref) || out.some((r) => r.ref === ref);
  if (p.kind === "consumer") {
    if (CREDITS.consumerWelcome > 0 && !has("welcome")) out.push({ delta: CREDITS.consumerWelcome, reason: "welcome", ref: "welcome", note: "Welcome credits", created_at: at });
    return out;
  }
  const now = periodOf(p.period_start, at);
  const startOf = (i: number) => Date.parse(p.period_start) + i * CREDITS.periodDays * DAY;
  const grantedIn = (i: number) => [...ledger, ...out].filter((r) => r.reason === "allowance" && (r.ref ?? "").split(":")[1] === String(i)).reduce((s, r) => s + r.delta, 0);
  // unused plan credits from months gone by run out (spending uses plan credits first)
  if (!CREDITS.rolloverMonthly) {
    let bal = balanceOf(ledger);
    const months = [...new Set(ledger.filter((r) => r.reason === "allowance").map((r) => Number((r.ref ?? "").split(":")[1])))].filter((i) => i < now).sort((a, b) => a - b);
    for (const i of months) {
      const ref = `expired:${i}`;
      if (has(ref)) continue;
      const spent = -ledger.filter((r) => r.reason === "spend" && Date.parse(r.created_at) >= startOf(i) && Date.parse(r.created_at) < startOf(i + 1)).reduce((s, r) => s + r.delta, 0);
      const gone = Math.min(Math.max(0, bal), Math.max(0, grantedIn(i) - spent));
      if (gone > 0) { out.push({ delta: -gone, reason: "expired", ref, note: "Last month's unused plan credits", created_at: at }); bal -= gone; }
      else out.push({ delta: 0, reason: "expired", ref, note: "Last month's plan credits were all used", created_at: at });
    }
  }
  const tier = tierOf(p.tier);
  const top = tier.monthlyCredits - grantedIn(now);
  const ref = `allowance:${now}:${tier.id}`;
  if (top > 0 && !has(ref)) out.push({ delta: top, reason: "allowance", ref, note: `${tier.name} plan credits`, created_at: at });
  return out;
}

/** How a history line reads. */
export function lineText(r: LedgerRow): string {
  if (r.note) return r.note;
  if (r.reason === "spend") return actionOf(r.action as ActionId)?.name ?? "Used";
  return { welcome: "Welcome credits", allowance: "Plan credits", expired: "Unused plan credits", purchase: "Bought credits", spend: "Used", referral: "Referral bonus", refund: "Given back" }[r.reason];
}
