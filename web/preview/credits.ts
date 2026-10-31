// Credits on the build site. Signed in, the `credits` edge function keeps the account's balance and
// history and says yes or no to each spend; on sample data the same rules run in this page, nothing saved.
// gate() is what the screens call before an action that costs credits or has a tier limit: it answers
// straight away when the action is free and fits, and otherwise asks the server, and when the answer is
// no it opens the upgrade prompt (CreditPrompt) and says false.
import { CREDITS, type AccountKind, type ActionId, type TierId } from "@/lib/credits/config";
import { balanceOf, checkSpend, dueGrants, type Block, type CreditState, type LedgerRow, type Size } from "@/lib/credits/rules";
import { call } from "./cloud";

export interface SpendOpts { count?: number; size?: Size; newPlan?: boolean; note?: string }
type Spent = { ok: true; cost: number; state: CreditState } | { ok: false; block: Block; state: CreditState };

export interface CreditsApi {
  load(): Promise<CreditState>;
  spend(what: ActionId, opts: SpendOpts): Promise<Spent>;
  buy(pack: string): Promise<CreditState>;
  setTier(tier: TierId): Promise<CreditState>;
  setKind(kind: AccountKind): Promise<CreditState>;
}

const ref = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);

/** The signed-in account's credits, through the `build` function. */
export const cloudCredits = (): CreditsApi => ({
  load: () => call<CreditState>("credits", {}, "credits"),
  spend: (what, o) => call<Spent>("spend", { what, count: o.count, size: o.size, newPlan: o.newPlan, note: o.note, ref: ref() }, "credits"),
  buy: (pack) => call<CreditState>("buy", { pack }, "credits"),
  setTier: (tier) => call<CreditState>("tier", { tier }, "credits"),
  setKind: (kind) => call<CreditState>("kind", { kind }, "credits"),
});

/** Sample data: a Pro contractor partway through the month, kept in this page. */
export function memoryCredits(plans: () => number): CreditsApi {
  const start = new Date(Date.now() - 12 * 86_400_000).toISOString();
  const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
  let plan = { kind: "business" as AccountKind, tier: "pro" as TierId, period_start: start };
  let ledger: LedgerRow[] = [
    { delta: 300, reason: "allowance", ref: "allowance:0:pro", note: "Pro plan credits", created_at: start },
    { delta: -10, reason: "spend", action: "plan_create", note: "Hadley Road house", created_at: ago(11) },
    { delta: -14, reason: "spend", action: "assistant_ask", note: "14 questions", created_at: ago(4) },
    { delta: 100, reason: "purchase", ref: "test:sample", note: "100 credits, test purchase (no payment)", created_at: ago(2) },
  ];
  const state = (): CreditState => {
    const due = dueGrants(plan, ledger, new Date().toISOString());
    ledger = [...ledger, ...due];
    return { plan, balance: balanceOf(ledger), ledger: ledger.filter((l) => l.delta !== 0).slice(-100).reverse(), plans: plans(), testPayments: CREDITS.testPayments };
  };
  const at = () => new Date().toISOString();
  return {
    load: async () => state(),
    async spend(what, o) {
      const s = state();
      const c = checkSpend(s, what, o);
      if (!c.ok) return { ok: false, block: c.block, state: s };
      if (c.cost) ledger = [...ledger, { delta: -c.cost, reason: "spend", action: what, note: o.note ?? null, created_at: at() }];
      return { ok: true, cost: c.cost, state: state() };
    },
    async buy(id) {
      const p = CREDITS.packs.find((x) => x.id === id);
      if (!p) throw new Error("Pick a pack.");
      ledger = [...ledger, { delta: p.credits, reason: "purchase", ref: `test:${ref()}`, note: `${p.credits} credits, test purchase (no payment)`, created_at: at() }];
      return state();
    },
    async setTier(tier) { if (plan.kind !== "business") throw new Error("Homeowner accounts pay with credits only."); plan = { ...plan, tier }; return state(); },
    async setKind(kind) { plan = { ...plan, kind }; return state(); },
  };
}

/** The page's one credits store: the latest state, who's watching it, and the prompt that's open. */
type Listener = () => void;
let api: CreditsApi | null = null;
let current: CreditState | null = null;
let prompt: (Block & { action: ActionId }) | null = null;
const listeners = new Set<Listener>();
const tell = () => { for (const f of listeners) f(); };

export const credits = {
  use(a: CreditsApi) { api = a; current = null; prompt = null; void credits.refresh(); },
  subscribe(f: Listener) { listeners.add(f); return () => { listeners.delete(f); }; },
  get state() { return current; },
  get prompt() { return prompt; },
  closePrompt() { prompt = null; tell(); },
  set(s: CreditState) { current = s; tell(); },
  async refresh() {
    if (!api) return null;
    try { credits.set(await api.load()); } catch (e) { console.error(e); }
    return current;
  },
  api: () => api,
  /** May this go ahead? Spends the credits when it costs any. Opens the prompt and says false when not. */
  async gate(what: ActionId, opts: SpendOpts = {}): Promise<boolean> {
    if (!api) return true;
    const s = current ?? (await credits.refresh());
    // free and within the tier: no need to ask the server
    if (s) { const c = checkSpend(s, what, opts); if (c.ok && c.cost === 0) return true; }
    let r: Spent;
    try { r = await api.spend(what, opts); }
    catch (e) { throw e instanceof Error ? e : new Error("Couldn't check your credits. Try again."); }
    credits.set(r.state);
    if (r.ok) return true;
    prompt = { ...r.block, action: what };
    tell();
    return false;
  },
};
