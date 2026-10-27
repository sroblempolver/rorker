"use client";
// Company money defaults: deposit, payment terms, reminders, late fees and how clients can pay.
// Plain controlled inputs; the caller keeps the value.
import type { ReactNode } from "react";

export type MoneySettingsValue = {
  defaultDepositPct: number;
  paymentTermsDays: number;
  reminders: { beforeDue: boolean; onDue: boolean; afterDays: number[] };
  lateFeePct: number;
  passCardFee: boolean;
  acceptCard: boolean;
  acceptBank: boolean;
  financing: boolean;
  quoteFollowUpDays: number;
};

export const DEFAULT_MONEY_SETTINGS: MoneySettingsValue = {
  defaultDepositPct: 30,
  paymentTermsDays: 14,
  reminders: { beforeDue: true, onDue: true, afterDays: [3, 7] },
  lateFeePct: 0,
  passCardFee: false,
  acceptCard: true,
  acceptBank: true,
  financing: false,
  quoteFollowUpDays: 5,
};

const TERMS: [number, string][] = [[0, "Due on receipt"], [7, "7 days"], [14, "14 days"], [30, "30 days"]];
const AFTER = [3, 7, 14];

function Toggle({ on, onChange, label }: { on: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative shrink-0 w-10 h-6 rounded-full border transition-colors ${on ? "bg-accent border-accent" : "bg-panel-3 border-line"}`}>
      <span className={`absolute top-[3px] w-4 h-4 rounded-full transition-all ${on ? "left-[20px] bg-accent-ink" : "left-[3px] bg-muted"}`} />
    </button>
  );
}

function Row({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3 border-b border-line last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-[14px]">{title}</p>
        {note && <p className="text-[12px] text-muted mt-0.5">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function Num({ value, onChange, suffix, max, label }: { value: number; onChange(v: number): void; suffix: string; max: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5 shrink-0">
      <input type="number" inputMode="decimal" min={0} max={max} value={value} aria-label={label}
        onChange={(e) => { const n = parseFloat(e.target.value); onChange(Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0); }}
        className="input !h-9 !w-[72px] text-right tabular-nums" />
      <span className="text-[13px] text-muted w-8">{suffix}</span>
    </span>
  );
}

export function MoneySettings({ value, onChange }: { value: MoneySettingsValue; onChange(v: MoneySettingsValue): void }) {
  const set = <K extends keyof MoneySettingsValue>(k: K, v: MoneySettingsValue[K]) => onChange({ ...value, [k]: v });
  const rem = (patch: Partial<MoneySettingsValue["reminders"]>) => set("reminders", { ...value.reminders, ...patch });
  const toggleAfter = (d: number) => {
    const has = value.reminders.afterDays.includes(d);
    rem({ afterDays: has ? value.reminders.afterDays.filter((x) => x !== d) : [...value.reminders.afterDays, d].sort((a, b) => a - b) });
  };

  return (
    <div className="space-y-4">
      <section>
        <p className="eyebrow mb-1.5">Quotes and invoices</p>
        <div className="card !rounded-[3px]">
          <Row title="Default deposit" note="Asked for when the client signs a quote.">
            <Num value={value.defaultDepositPct} onChange={(v) => set("defaultDepositPct", v)} suffix="%" max={100} label="Default deposit percent" />
          </Row>
          <div className="px-3 py-3 border-b border-line">
            <p className="text-[14px] mb-2">Payment terms</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="radiogroup" aria-label="Payment terms">
              {TERMS.map(([d, l]) => (
                <button key={d} type="button" role="radio" aria-checked={value.paymentTermsDays === d} onClick={() => set("paymentTermsDays", d)}
                  className={`btn btn-sm ${value.paymentTermsDays === d ? "!border-accent !text-accent" : ""}`}>{l}</button>
              ))}
            </div>
          </div>
          <Row title="Follow up on unanswered quotes" note="Auto-nudge the client if they haven't answered.">
            <Num value={value.quoteFollowUpDays} onChange={(v) => set("quoteFollowUpDays", Math.round(v))} suffix="days" max={60} label="Follow up after days" />
          </Row>
          <Row title="Offer monthly payments on quotes" note='Shows "as low as $X a month" on the quote.'>
            <Toggle on={value.financing} onChange={(v) => set("financing", v)} label="Offer monthly payments on quotes" />
          </Row>
        </div>
      </section>

      <section>
        <p className="eyebrow mb-1.5">Automatic reminders</p>
        <div className="card !rounded-[3px]">
          <Row title="3 days before it's due">
            <Toggle on={value.reminders.beforeDue} onChange={(v) => rem({ beforeDue: v })} label="Remind 3 days before due" />
          </Row>
          <Row title="On the due day">
            <Toggle on={value.reminders.onDue} onChange={(v) => rem({ onDue: v })} label="Remind on the due day" />
          </Row>
          {AFTER.map((d) => (
            <Row key={d} title={`${d} days late`}>
              <Toggle on={value.reminders.afterDays.includes(d)} onChange={() => toggleAfter(d)} label={`Remind ${d} days late`} />
            </Row>
          ))}
          <Row title="Late fee" note="Added to the balance once an invoice is past due. 0 for none.">
            <Num value={value.lateFeePct} onChange={(v) => set("lateFeePct", v)} suffix="%" max={25} label="Late fee percent" />
          </Row>
        </div>
      </section>

      <section>
        <p className="eyebrow mb-1.5">How clients pay</p>
        <div className="card !rounded-[3px]">
          <Row title="Card" note="Visa, Mastercard, Amex. 2.9% + 30¢ per payment.">
            <Toggle on={value.acceptCard} onChange={(v) => onChange({ ...value, acceptCard: v, passCardFee: v ? value.passCardFee : false })} label="Accept card" />
          </Row>
          <Row title="Bank transfer" note="0.8%, max $5. Best for big payments.">
            <Toggle on={value.acceptBank} onChange={(v) => set("acceptBank", v)} label="Accept bank transfer" />
          </Row>
          <Row title="Pass the card fee to the client" note="Card surcharges are limited in some states. Check before turning this on.">
            <Toggle on={value.passCardFee && value.acceptCard} onChange={(v) => set("passCardFee", v && value.acceptCard)} label="Pass the card fee to the client" />
          </Row>
        </div>
        {!value.acceptCard && !value.acceptBank && <p className="mt-1.5 text-[12px] text-amber">Clients can only pay by check or cash with both off.</p>}
      </section>
    </div>
  );
}
