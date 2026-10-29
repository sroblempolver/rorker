// Credits and plan: the balance, the account's plan and its limits, credit packs, what things cost, a
// homeowner's referral bonus and the history. Also the header chip and the prompt that opens when an
// action needs more credits or a bigger plan. There's no payment provider yet: buying and changing plan
// work only in test mode and say so.
import { useState, useSyncExternalStore } from "react";
import { CREDITS, type AccountKind, type Tier } from "@/lib/credits/config";
import { costOf, limitsOf, lineText, periodEnds, tierOf, type CreditState } from "@/lib/credits/rules";
import { Dialog, useFeedback } from "@/components/ui/feedback";
import { credits } from "./credits";

const fmt = (x: number) => x.toLocaleString("en-US");
const money = (x: number) => (x === 0 ? "Free" : `$${fmt(x)}`);
const lim = (v: number | null, unit = "") => (v === null ? `Unlimited${unit}` : `${fmt(v)}${unit}`);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function useCredits() {
  const state = useSyncExternalStore(credits.subscribe, () => credits.state);
  const prompt = useSyncExternalStore(credits.subscribe, () => credits.prompt);
  return { state, prompt };
}

const Coin = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9.5h4.5a2 2 0 0 1 0 4H10a2 2 0 0 0 0 4h4.5" /></svg>
);

/** The balance in the header; opens the Credits page. */
export function CreditChip({ onOpen }: { onOpen: () => void }) {
  const { state } = useCredits();
  if (!state) return null;
  const low = state.balance < 20;
  return (
    <button onClick={onOpen} className={`chip shrink-0 ${low ? "!text-amber !border-amber" : ""}`} title="Credits and plan" aria-label={`${state.balance} credits. Open credits and plan`}>
      <Coin /><span className="font-mono">{fmt(state.balance)}</span><span className="hidden lg:inline">credits</span>
    </button>
  );
}

/** Opens when an action needs more credits than there are, or a bigger plan than the account has. */
export function CreditPrompt({ onOpen }: { onOpen: () => void }) {
  const { prompt, state } = useCredits();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  if (!prompt) return null;
  const close = () => credits.closePrompt();
  const up = prompt.upgrade;
  const move = async (t: Tier) => {
    setBusy(true);
    try { credits.set(await credits.api()!.setTier(t.id)); close(); toast(`You're on ${t.name} now. Try that again.`); }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't go through.", { tone: "error" }); }
    setBusy(false);
  };
  return (
    <Dialog title={prompt.title} onClose={close} narrow>
      <p className="text-muted mb-4">{prompt.message}</p>
      {up && (
        <div className="card !rounded-[3px] p-3 mb-4 text-[14px]">
          <p className="font-semibold">{up.name} · {money(up.price)}{up.price ? " a month" : ""}</p>
          <p className="text-muted">{fmt(up.monthlyCredits)} credits a month · {lim(up.maxPlans)} plans · {lim(up.maxFloors)} floors · {lim(up.maxSqft, " sq ft")} a plan</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 justify-end">
        <button className="btn btn-ghost" onClick={close}>Not now</button>
        <button className={`btn ${up && state?.testPayments ? "" : "btn-primary"}`} onClick={() => { close(); onOpen(); }}>{prompt.reason === "credits" ? "Buy credits" : "See plans"}</button>
        {up && state?.testPayments && <button className="btn btn-primary" disabled={busy} onClick={() => void move(up)}>Move to {up.name}</button>}
      </div>
    </Dialog>
  );
}

export function CreditsPage({ company }: { company: string }) {
  const { state } = useCredits();
  const { toast, confirm } = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  if (!state) return <p className="p-6 text-muted">Loading your credits…</p>;
  const biz = state.plan.kind === "business";
  const tier = tierOf(state.plan.tier);
  const limits = limitsOf(state.plan);
  const run = async (key: string, f: () => Promise<CreditState>, done: string) => {
    setBusy(key);
    try { credits.set(await f()); toast(done); } catch (e) { toast(e instanceof Error ? e.message : "That didn't go through.", { tone: "error" }); }
    setBusy(null);
  };
  const a = credits.api()!;
  const buy = async (id: string) => {
    const p = CREDITS.packs.find((x) => x.id === id)!;
    const ok = await confirm({ title: `Buy ${fmt(p.credits)} credits`, body: state.testPayments ? `${money(p.price)}. Test mode: no card is charged and the credits are added straight away.` : `${money(p.price)}, charged to your card.`, confirm: `Buy for ${money(p.price)}` });
    if (ok) await run(id, () => a.buy(id), `${fmt(p.credits)} credits added.`);
  };
  const pick = async (t: Tier) => {
    const ok = await confirm({ title: `Move to ${t.name}`, body: `${money(t.price)}${t.price ? " a month" : ""}, ${fmt(t.monthlyCredits)} credits a month.${state.testPayments ? " Test mode: no card is charged." : ""}`, confirm: `Move to ${t.name}` });
    if (ok) await run(t.id, () => a.setTier(t.id), `You're on ${t.name}.`);
  };
  const kind = (k: AccountKind) => run(k, () => a.setKind(k), k === "consumer" ? "This account is for your own home now." : "This account is for your company now.");

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl w-full mx-auto space-y-8">
      <div>
        <p className="eyebrow">{company} · Credits and plan</p>
        <h1 className="font-display text-[40px] font-extrabold uppercase leading-none tracking-[0.01em] mb-2 flex items-center gap-3"><Coin size={32} />{fmt(state.balance)} credits</h1>
        <p className="text-muted">{biz
          ? `${tier.name} plan · ${fmt(tier.monthlyCredits)} credits a month, next on ${day(periodEnds(state.plan.period_start, new Date().toISOString()))}. ${CREDITS.rolloverMonthly ? "Unused plan credits carry over." : "Unused plan credits run out at the end of the month; credits you buy never do."}`
          : "You pay only for what you use. Credits you buy never run out."}</p>
        {state.testPayments && <p className="mt-3 inline-block text-[13px] px-3 py-1.5 rounded-[3px] bg-panel-2 border border-line">Test mode: buying credits and changing plan don&apos;t charge anything yet. Prices are placeholders.</p>}
      </div>

      {biz && (
        <section>
          <h2 className="font-display text-[20px] font-bold uppercase tracking-[0.04em] mb-3">Your plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            <Use label="Plans" used={state.plans} max={limits.maxPlans} />
            <Use label="Floors in a plan" max={limits.maxFloors} />
            <Use label="Square feet in a plan" max={limits.maxSqft} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {CREDITS.tiers.map((t) => {
              const on = t.id === state.plan.tier;
              return (
                <div key={t.id} className={`card !rounded-[3px] p-4 flex flex-col ${on ? "!border-accent" : ""}`}>
                  <p className="font-display text-[18px] font-bold uppercase tracking-[0.04em]">{t.name}</p>
                  <p className="text-[22px] font-semibold">{money(t.price)}<span className="text-muted text-[13px] font-normal">{t.price ? " a month" : ""}</span></p>
                  <p className="text-muted text-[13px] mb-2">{t.blurb}</p>
                  <ul className="text-[13px] space-y-0.5 mb-3 flex-1">
                    <li>{fmt(t.monthlyCredits)} credits a month</li>
                    <li>{lim(t.maxPlans)} plans</li>
                    <li>{lim(t.maxFloors)} floors a plan</li>
                    <li>{lim(t.maxSqft, " sq ft")} a plan</li>
                  </ul>
                  {on ? <span className="chip justify-center">Your plan</span>
                    : <button className="btn btn-sm" disabled={!!busy || !state.testPayments} onClick={() => void pick(t)}>{busy === t.id ? "Moving…" : `Move to ${t.name}`}</button>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-[20px] font-bold uppercase tracking-[0.04em] mb-3">Buy credits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {CREDITS.packs.map((p) => (
            <div key={p.id} className="card !rounded-[3px] p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[20px] font-semibold flex items-center gap-2"><Coin size={18} />{fmt(p.credits)}</p>
                <p className="text-muted text-[13px]">{money(p.price)}{p.label ? ` · ${p.label}` : ""}</p>
              </div>
              <button className="btn btn-sm btn-primary" disabled={!!busy || !state.testPayments} onClick={() => void buy(p.id)}>{busy === p.id ? "Adding…" : "Buy"}</button>
            </div>
          ))}
        </div>
      </section>

      {!biz && CREDITS.referralBonus > 0 && (
        <section className="card !rounded-[3px] p-4 border-l-[3px] !border-l-accent">
          <h2 className="font-display text-[18px] font-bold uppercase tracking-[0.04em] mb-1">Earn {fmt(CREDITS.referralBonus)} credits</h2>
          <p className="text-muted text-[14px]">Send your project to your contractor from the job&apos;s Share button. When they take it on and start a paid Rorker plan, {fmt(CREDITS.referralBonus)} credits land here.</p>
        </section>
      )}

      <section>
        <h2 className="font-display text-[20px] font-bold uppercase tracking-[0.04em] mb-3">What things cost</h2>
        <div className="card !rounded-[3px] divide-y divide-line">
          {CREDITS.actions.map((x) => {
            const c = costOf(state.plan.kind, x.id);
            return (
              <div key={x.id} className="flex items-center gap-3 px-4 py-2.5 text-[14px]">
                <span className="flex-1">{x.name}{x.soon && <span className="text-muted"> · coming</span>}</span>
                <span className="font-mono">{c === 0 ? "Free" : `${fmt(c)} ${x.per}`}</span>
              </div>
            );
          })}
          {limits.maxFloors !== null && <p className="px-4 py-2.5 text-[13px] text-muted">{biz ? `On ${tier.name}` : "For a homeowner"}, a plan can have up to {fmt(limits.maxFloors)} floors and {lim(limits.maxSqft, " sq ft")}{biz && limits.maxPlans !== null ? `, and you can have ${fmt(limits.maxPlans)} plans` : ""}.</p>}
        </div>
      </section>

      <section>
        <h2 className="font-display text-[20px] font-bold uppercase tracking-[0.04em] mb-3">History</h2>
        {state.ledger.length ? (
          <div className="card !rounded-[3px] divide-y divide-line">
            {state.ledger.map((r, i) => (
              <div key={`${r.created_at}-${i}`} className="flex items-center gap-3 px-4 py-2 text-[14px]">
                <span className="text-muted w-16 shrink-0">{day(r.created_at)}</span>
                <span className="flex-1 min-w-0 truncate">{r.reason === "spend" && r.note ? `${lineText({ ...r, note: null })}: ${r.note}` : lineText(r)}</span>
                <span className={`font-mono ${r.delta > 0 ? "text-green" : "text-muted"}`}>{r.delta > 0 ? "+" : ""}{fmt(r.delta)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-muted">Nothing yet.</p>}
      </section>

      <section>
        <h2 className="font-display text-[20px] font-bold uppercase tracking-[0.04em] mb-1">This account is for</h2>
        <p className="text-muted text-[14px] mb-3">Homeowners pay only for what they use. Contractors, property managers and builders have a monthly plan with credits.</p>
        <div className="flex flex-wrap gap-2">
          {([["consumer", "My own home"], ["business", "My company"]] as const).map(([k, label]) => (
            <button key={k} className={`btn btn-sm ${state.plan.kind === k ? "btn-primary" : ""}`} disabled={!!busy || state.plan.kind === k} onClick={() => void kind(k)}>{label}</button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Use({ label, used, max }: { label: string; used?: number; max: number | null }) {
  const pct = used !== undefined && max ? Math.min(100, (used / max) * 100) : null;
  return (
    <div className="card !rounded-[3px] p-3">
      <p className="text-muted text-[12.5px]">{label}</p>
      <p className="text-[18px] font-semibold">{used !== undefined ? `${fmt(used)} of ${lim(max)}` : max === null ? "No limit" : `Up to ${fmt(max)}`}</p>
      {pct !== null && <div className="h-1.5 mt-1.5 bg-panel-2 rounded-full overflow-hidden"><div className={`h-full ${pct >= 100 ? "bg-red" : pct >= 80 ? "bg-amber" : "bg-accent"}`} style={{ width: `${pct}%` }} /></div>}
    </div>
  );
}

