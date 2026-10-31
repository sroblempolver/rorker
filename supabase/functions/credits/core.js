// Generated from web/src/lib/credits/ by web/preview/build-links.mjs. Do not edit.

// src/lib/credits/config.ts
var CREDITS = {
  /** while true, "Buy credits" and changing plans work without any payment (no Stripe yet) */
  testPayments: true,
  /** credits a new homeowner account starts with, once */
  consumerWelcome: 50,
  /** credits a homeowner earns when a contractor they sent their project to starts a paid plan */
  referralBonus: 100,
  /** unused monthly plan credits carry over to the next month (credits people bought always do) */
  rolloverMonthly: false,
  /** how long one plan month is */
  periodDays: 30,
  /** what a homeowner's single plan may be (they have no tier; each plan costs credits) */
  consumerLimits: { maxPlans: null, maxFloors: 4, maxSqft: 8e3 },
  tiers: [
    { id: "free", name: "Free", price: 0, monthlyCredits: 50, maxPlans: 2, maxFloors: 2, maxSqft: 2500, blurb: "Try it on a job or two." },
    { id: "pro", name: "Pro", price: 49, monthlyCredits: 300, maxPlans: 10, maxFloors: 3, maxSqft: 5e3, blurb: "For a contractor running a few jobs at once." },
    { id: "team", name: "Team", price: 149, monthlyCredits: 1e3, maxPlans: 40, maxFloors: 4, maxSqft: 1e4, blurb: "For a company with crews on many jobs." },
    { id: "business", name: "Business", price: 399, monthlyCredits: 3e3, maxPlans: null, maxFloors: null, maxSqft: 5e4, blurb: "Builders and property managers with big buildings." }
  ],
  packs: [
    { id: "p100", credits: 100, price: 10 },
    { id: "p300", credits: 300, price: 25, label: "Most picked" },
    { id: "p1000", credits: 1e3, price: 70, label: "Best value" }
  ],
  actions: [
    { id: "plan_create", name: "Make a new plan", per: "per plan", cost: { consumer: 20, business: 10 } },
    { id: "assistant_ask", name: "Ask the assistant", per: "per question", cost: { consumer: 1, business: 1 } },
    { id: "place_item", name: "Place furniture or an object", per: "per item", cost: { consumer: 1, business: 0 } },
    { id: "voice_minute", name: "Realistic voice", per: "per minute", cost: { consumer: 5, business: 5 }, soon: true },
    { id: "render_3d", name: "3D render", per: "per render", cost: { consumer: 10, business: 10 }, soon: true }
  ]
};

// src/lib/credits/rules.ts
var DAY = 864e5;
var fmt = (x) => x.toLocaleString("en-US");
var tierOf = (id) => CREDITS.tiers.find((t) => t.id === id) ?? CREDITS.tiers[0];
var actionOf = (id) => CREDITS.actions.find((a) => a.id === id);
var isPaid = (p) => p.kind === "business" && tierOf(p.tier).price > 0;
function limitsOf(p) {
  return p.kind === "consumer" ? CREDITS.consumerLimits : tierOf(p.tier);
}
function costOf(kind, action, count = 1) {
  const a = actionOf(action);
  return a ? a.cost[kind] * Math.max(0, Math.floor(count)) : 0;
}
var balanceOf = (ledger) => ledger.reduce((s, r) => s + r.delta, 0);
function tierFor(need, from) {
  const start = CREDITS.tiers.findIndex((t) => t.id === from);
  const ok = (lim, v) => lim === null || v === void 0 || v <= lim;
  return CREDITS.tiers.slice(start + 1).find((t) => ok(t.maxPlans, need.plans) && ok(t.maxFloors, need.floors) && ok(t.maxSqft, need.sqft)) ?? null;
}
function checkLimits(p, need) {
  const lim = limitsOf(p);
  const biz = p.kind === "business";
  const tier = tierOf(p.tier);
  const up = biz ? tierFor(need, p.tier) : null;
  const where = biz ? `Your ${tier.name} plan` : "A homeowner plan";
  const then = (what) => up ? ` ${up.name} allows ${what}.` : biz ? " Talk to us about a bigger plan." : " Ask your contractor to build it on their Rorker account.";
  if (lim.maxPlans !== null && need.plans !== void 0 && need.plans > lim.maxPlans)
    return { reason: "plans", title: "You've used all your plans", message: `${where} covers ${fmt(lim.maxPlans)} plan${lim.maxPlans === 1 ? "" : "s"}.${then(up?.maxPlans === null ? "as many as you like" : `${fmt(up?.maxPlans ?? 0)}`)}`, upgrade: up };
  if (lim.maxFloors !== null && need.floors !== void 0 && need.floors > lim.maxFloors)
    return { reason: "floors", title: `This plan has ${need.floors} floors`, message: `${where} covers up to ${fmt(lim.maxFloors)} floor${lim.maxFloors === 1 ? "" : "s"} in a plan.${then(up?.maxFloors === null ? "any number of floors" : `up to ${fmt(up?.maxFloors ?? 0)}`)}`, upgrade: up };
  if (lim.maxSqft !== null && need.sqft !== void 0 && need.sqft > lim.maxSqft)
    return { reason: "sqft", title: `This plan is ${fmt(need.sqft)} sq ft`, message: `${where} covers up to ${fmt(lim.maxSqft)} sq ft in a plan.${then(up?.maxSqft === null ? "any size" : `up to ${fmt(up?.maxSqft ?? 0)} sq ft`)}`, upgrade: up };
  return null;
}
function checkSpend(s, action, opts = {}) {
  const need = { ...opts.size ?? {}, ...opts.newPlan ? { plans: s.plans + 1 } : {} };
  const limit = checkLimits(s.plan, need);
  if (limit) return { ok: false, block: limit };
  const cost = costOf(s.plan.kind, action, opts.count ?? 1);
  if (cost > s.balance) {
    const a = actionOf(action);
    return { ok: false, block: { reason: "credits", title: "Not enough credits", message: `${a?.name ?? "This"} needs ${fmt(cost)} credit${cost === 1 ? "" : "s"} and you have ${fmt(Math.max(0, s.balance))}.`, upgrade: s.plan.kind === "business" ? tierFor({}, s.plan.tier) : null, need: cost, have: s.balance } };
  }
  return { ok: true, cost };
}
var periodOf = (start, at) => Math.max(0, Math.floor((Date.parse(at) - Date.parse(start)) / (CREDITS.periodDays * DAY)));
function dueGrants(p, ledger, at) {
  const out = [];
  const has = (ref2) => ledger.some((r) => r.ref === ref2) || out.some((r) => r.ref === ref2);
  if (p.kind === "consumer") {
    if (CREDITS.consumerWelcome > 0 && !has("welcome")) out.push({ delta: CREDITS.consumerWelcome, reason: "welcome", ref: "welcome", note: "Welcome credits", created_at: at });
    return out;
  }
  const now = periodOf(p.period_start, at);
  const startOf = (i) => Date.parse(p.period_start) + i * CREDITS.periodDays * DAY;
  const grantedIn = (i) => [...ledger, ...out].filter((r) => r.reason === "allowance" && (r.ref ?? "").split(":")[1] === String(i)).reduce((s, r) => s + r.delta, 0);
  if (!CREDITS.rolloverMonthly) {
    let bal = balanceOf(ledger);
    const months = [...new Set(ledger.filter((r) => r.reason === "allowance").map((r) => Number((r.ref ?? "").split(":")[1])))].filter((i) => i < now).sort((a, b) => a - b);
    for (const i of months) {
      const ref2 = `expired:${i}`;
      if (has(ref2)) continue;
      const spent = -ledger.filter((r) => r.reason === "spend" && Date.parse(r.created_at) >= startOf(i) && Date.parse(r.created_at) < startOf(i + 1)).reduce((s, r) => s + r.delta, 0);
      const gone = Math.min(Math.max(0, bal), Math.max(0, grantedIn(i) - spent));
      if (gone > 0) {
        out.push({ delta: -gone, reason: "expired", ref: ref2, note: "Last month's unused plan credits", created_at: at });
        bal -= gone;
      } else out.push({ delta: 0, reason: "expired", ref: ref2, note: "Last month's plan credits were all used", created_at: at });
    }
  }
  const tier = tierOf(p.tier);
  const top = tier.monthlyCredits - grantedIn(now);
  const ref = `allowance:${now}:${tier.id}`;
  if (top > 0 && !has(ref)) out.push({ delta: top, reason: "allowance", ref, note: `${tier.name} plan credits`, created_at: at });
  return out;
}
export {
  CREDITS,
  balanceOf,
  checkSpend,
  dueGrants,
  isPaid,
  tierOf
};
