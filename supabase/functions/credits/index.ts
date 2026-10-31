// Credits and plans for the build site (build.rorker.com), for a signed-in account's admins:
//   credits the account's plan, credit balance and history (due credits are added first: a homeowner's
//           welcome credits, a plan's monthly credits, last month's unused ones running out, and a
//           homeowner's referral bonus once a contractor who took on their project is on a paid plan)
//   spend   use credits on an action (a new plan, an assistant question, placing furniture), after the
//           tier's limits on plans, floors and square feet; says why not, kindly, when it can't
//   buy     buy a credit pack. No payment provider yet: only while testPayments is on (see
//           web/src/lib/credits/config.ts), and every such line says it was a test
//   tier    a business account changes its plan tier (test payments only, like buy)
//   kind    an account says what it's for: a homeowner's own home, or a company
// The prices and rules are the page's own (web/src/lib/credits/), copied into core.js by
// web/preview/build-links.mjs. Lines are only ever added, through credit_add (supabase/build/).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { balanceOf, checkSpend, CREDITS, dueGrants, isPaid, tierOf } from "./core.js";

const ORIGINS = [/^https:\/\/([a-z0-9-]+\.)?rorker\.com$/, /^https:\/\/[a-z0-9-]+\.github\.io$/, /^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];
const extra = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const allowed = (o: string | null) => !!o && (extra.includes(o) || ORIGINS.some((r) => r.test(o)));

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs = 10 * 60_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}
const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

async function signedIn(req: Request) {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (jwt.split(".").length !== 3) return null;
  const { data, error } = await db.auth.getUser(jwt);
  return error || !data.user ? null : data.user;
}

type CreditPlan = { kind: "consumer" | "business"; tier: string; period_start: string };
type Line = { delta: number; reason: string; action?: string | null; ref?: string | null; note?: string | null; created_at: string };

/** The account a signed-in person runs (they're an admin of it). */
async function adminAccount(userId: string) {
  const { data } = await db.from("account_users").select("account_id").eq("user_id", userId).eq("role", "admin").order("created_at").limit(1).maybeSingle();
  return (data?.account_id as string | undefined) ?? null;
}
async function addLine(account: string, l: Omit<Line, "created_at">, mustCover = false): Promise<number | null> {
  const { data, error } = await db.rpc("credit_add", { a: account, d: l.delta, why: l.reason, what: l.action ?? null, r: l.ref ?? null, words: l.note ?? null, must_cover: mustCover });
  if (error) throw error;
  return data as number | null;
}
async function planOf(account: string): Promise<CreditPlan> {
  const { data } = await db.from("credit_plans").select("kind, tier, period_start").eq("account_id", account).maybeSingle();
  if (data) return data as CreditPlan;
  // a company name at sign-up means a business; left blank, it's someone's own home
  const { data: acct } = await db.from("accounts").select("created_by, created_at").eq("id", account).single();
  const { data: owner } = await db.auth.admin.getUserById(acct!.created_by as string);
  const company = String(owner?.user?.user_metadata?.company ?? "").trim();
  const plan = { account_id: account, kind: company ? "business" : "consumer", tier: "free", period_start: acct!.created_at as string };
  await db.from("credit_plans").upsert(plan, { onConflict: "account_id", ignoreDuplicates: true });
  const { data: again } = await db.from("credit_plans").select("kind, tier, period_start").eq("account_id", account).single();
  return again as CreditPlan;
}
const lines = async (account: string) => {
  const { data, error } = await db.from("credit_ledger").select("delta, reason, action, ref, note, created_at").eq("account_id", account).order("created_at").order("id").limit(5000);
  if (error) throw error;
  return (data ?? []) as Line[];
};
/** The plan, balance and history, after adding whatever credits are due. */
async function creditState(account: string) {
  const plan = await planOf(account);
  if (plan.kind === "business") await referralBonus(account).catch((e) => console.error(e));
  let ledger = await lines(account);
  const due = dueGrants(plan, ledger, new Date().toISOString());
  for (const g of due) await addLine(account, g);
  if (due.length) ledger = await lines(account);
  const { data: plans } = await db.from("records").select("job_id").eq("account_id", account).eq("kind", "plan").limit(5000);
  return {
    plan, balance: balanceOf(ledger), plans: new Set((plans ?? []).map((r) => r.job_id)).size, testPayments: CREDITS.testPayments,
    ledger: ledger.filter((l) => l.delta !== 0).slice(-100).reverse(),
  };
}
/** A contractor on a paid plan who took on a homeowner's project: the homeowner gets their bonus, once. */
async function referralBonus(contractor: string) {
  if (!isPaid(await planOf(contractor)) || CREDITS.referralBonus <= 0) return;
  const { data: refs } = await db.from("records").select("data").eq("account_id", contractor).eq("kind", "referral").limit(200);
  const { data: acct } = await db.from("accounts").select("name").eq("id", contractor).single();
  for (const by of new Set((refs ?? []).map((r) => (r.data as { by_account: string }).by_account).filter(Boolean)))
    await addLine(by, { delta: CREDITS.referralBonus, reason: "referral", ref: `referral:${contractor}`, note: `${acct?.name ?? "Your contractor"} joined Rorker from your project` });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": allowed(origin) ? origin! : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Not found." }, 404);
  if (!allowed(origin)) return json({ error: "Not allowed from this page." }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const action = str(body.action, 20);
  if (!["credits", "spend", "buy", "tier", "kind"].includes(action)) return json({ error: "Not found." }, 404);

  try {
    const user = await signedIn(req);
    if (!user) return json({ error: "Sign in first." }, 401);
    const acct = await adminAccount(user.id);
    if (!acct) return json({ error: "Open your Rorker account first." }, 409);
    if (limited(`credits:${user.id}`, 200)) return json({ error: "That's a lot at once. Give it a minute." }, 429);
    if (action === "credits") return json(await creditState(acct));
    if (action === "spend") {
      const what = str(body.what, 32);
      const a = CREDITS.actions.find((x: { id: string; soon?: boolean }) => x.id === what && !x.soon);
      if (!a) return json({ error: "That isn't something credits pay for." }, 400);
      const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : undefined);
      const size = body.size as { floors?: unknown; sqft?: unknown } | undefined;
      const floors = num(size?.floors, 500), sqft = num(size?.sqft, 10_000_000);
      const opts = { count: num(body.count, 10_000) ?? 1, size: floors !== undefined && sqft !== undefined ? { floors, sqft } : undefined, newPlan: body.newPlan === true };
      const st = await creditState(acct);
      const c = checkSpend(st, what, opts);
      if (!c.ok) return json({ ok: false, block: c.block, state: st });
      if (c.cost > 0) {
        const ref = /^[A-Za-z0-9_-]{8,64}$/.test(str(body.ref, 64)) ? `spend:${str(body.ref, 64)}` : `spend:${uid()}`;
        const bal = await addLine(acct, { delta: -c.cost, reason: "spend", action: what, ref, note: str(body.note, 120) || null }, true);
        if (bal === null) { const again = await creditState(acct); return json({ ok: false, block: (checkSpend(again, what, opts) as { block: unknown }).block, state: again }); }
      }
      return json({ ok: true, cost: c.cost, state: await creditState(acct) });
    }
    if ((action === "buy" || action === "tier") && !CREDITS.testPayments) return json({ error: "Payments aren't set up yet." }, 501);
    if (action === "buy") {
      const pack = CREDITS.packs.find((p: { id: string }) => p.id === str(body.pack, 20));
      if (!pack) return json({ error: "Pick a pack." }, 400);
      if (limited(`buy:${user.id}`, 20)) return json({ error: "That's a lot at once. Give it a minute." }, 429);
      await addLine(acct, { delta: pack.credits, reason: "purchase", ref: `test:${uid()}`, note: `${pack.credits} credits, test purchase (no payment)` });
      return json(await creditState(acct));
    }
    if (action === "tier") {
      const plan = await planOf(acct);
      if (plan.kind !== "business") return json({ error: "Homeowner accounts pay with credits only." }, 400);
      const id = str(body.tier, 24);
      if (tierOf(id).id !== id) return json({ error: "Pick a plan." }, 400);
      const { error } = await db.from("credit_plans").update({ tier: id, updated_at: new Date().toISOString() }).eq("account_id", acct);
      if (error) throw error;
      await referralBonus(acct);
      return json(await creditState(acct));
    }
    const kind = str(body.kind, 20);
    if (kind !== "consumer" && kind !== "business") return json({ error: "Pick one." }, 400);
    await planOf(acct);
    const { error } = await db.from("credit_plans").update({ kind, updated_at: new Date().toISOString() }).eq("account_id", acct);
    if (error) throw error;
    return json(await creditState(acct));
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong on our side. Try again in a moment." }, 500);
  }
});
