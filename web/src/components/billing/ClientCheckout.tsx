"use client";
// The page a client opens from the invoice link to pay, on their phone, no sign-in. It looks like the
// contractor (their color, their name). Preview only: nothing is charged, simulatePayment fakes it.
import { useState } from "react";
import type { Brand, DocJob, Invoice, Payment } from "@/lib/billing/types";
import { fmt, toCents } from "@/lib/billing/money";
import { cardBrand, simulatePayment } from "@/lib/billing/payments";
import { BrandHeader, Paper, PoweredBy } from "./Brand";

const BANKS = ["Chase", "Bank of America", "Wells Fargo", "Other"];
const DECLINE = "4000000000000002";
const field = "w-full h-12 px-3.5 rounded-[8px] bg-white border border-neutral-300 text-[16px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200";
const lab = "block text-[13px] font-medium text-neutral-600 mb-1.5";

/** "4242424242424242" -> "4242 4242 4242 4242" (Amex: 4-6-5). */
function spaced(digits: string) {
  if (digits[0] === "3") return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(" ");
  return digits.match(/.{1,4}/g)?.join(" ") ?? "";
}

function Spinner() {
  return <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />;
}

function Lock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

export function ClientCheckout({ invoice, brand, job, amountDue, onPaid, onCancel }: {
  invoice: Invoice; brand: Brand; job: DocJob; amountDue: number; onPaid(p: Payment): void; onCancel(): void;
}) {
  const color = brand.brand_color;
  const [method, setMethod] = useState<"card" | "ach">("card");
  const [full, setFull] = useState(true);
  const [other, setOther] = useState("");
  const [hint, setHint] = useState(true);
  // card
  const [name, setName] = useState(job.client_name ?? "");
  const [num, setNum] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [zip, setZip] = useState("");
  // bank
  const [bank, setBank] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [holder, setHolder] = useState(job.client_name ?? "");
  const [ok, setOk] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const amount = full ? amountDue : toCents(other);
  const digits = num.replace(/\D/g, "");
  const amex = digits[0] === "3";
  const brandName = cardBrand(digits);

  const expOk = (() => {
    const m = exp.match(/^(\d{2}) \/ (\d{2})$/);
    if (!m) return false;
    const mm = +m[1], yy = 2000 + +m[2], now = new Date();
    return mm >= 1 && mm <= 12 && (yy > now.getFullYear() || (yy === now.getFullYear() && mm >= now.getMonth() + 1));
  })();
  const amountOk = amount >= 100 && amount <= amountDue;
  const cardOk = name.trim().length > 1 && digits.length === (amex ? 15 : 16) && expOk && cvc.length === (amex ? 4 : 3) && zip.length === 5;
  const bankOk = !!bank && holder.trim().length > 1 && ok;
  const ready = amountOk && (method === "card" ? cardOk : bankOk) && !busy;

  const onExp = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    setExp(d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d);
  };

  const pickBank = (b: string) => {
    setLinking(b);
    setTimeout(() => { setBank(b === "Other" ? "Your bank" : b); setLinking(null); }, 900);
  };

  const pay = () => {
    if (!ready) return;
    setErr(null);
    setBusy(true);
    setTimeout(() => {
      if (method === "card" && digits === DECLINE) { setBusy(false); setErr("Your card was declined. Try another card."); return; }
      onPaid(method === "card"
        ? simulatePayment({ invoice, amount, method, payerName: name, last4: digits.slice(-4), cardBrand: brandName })
        : simulatePayment({ invoice, amount, method, payerName: holder, last4: "6789", bankName: bank ?? undefined }));
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-800">
      <div className="h-1.5" style={{ background: color }} />
      <div className="mx-auto w-full max-w-[480px] px-4 pt-4 pb-10 space-y-4">
        <button onClick={onCancel} className="text-[14px] text-neutral-500 hover:text-neutral-800">← Back</button>

        <Paper className="!p-5 space-y-5">
          <BrandHeader brand={brand} />
          <div className="rounded-[10px] bg-neutral-50 border border-neutral-200 p-4">
            <p className="text-[13px] text-neutral-500">{invoice.number} · {invoice.title}</p>
            {job.address && <p className="text-[13px] text-neutral-500">{job.address}</p>}
            <p className="mt-2 text-[13px] text-neutral-500">Amount due</p>
            <p className="text-[32px] leading-tight font-semibold text-neutral-900 tabular-nums">{fmt(amountDue)}</p>
          </div>

          {/* how much */}
          <fieldset className="space-y-2">
            <legend className={lab}>How much would you like to pay?</legend>
            {[[true, `Full amount, ${fmt(amountDue)}`], [false, "A different amount"]].map(([v, l]) => (
              <label key={String(v)} className="flex items-center gap-3 h-12 px-3.5 rounded-[8px] border cursor-pointer"
                style={full === v ? { borderColor: color, boxShadow: `0 0 0 1px ${color}` } : { borderColor: "#d4d4d4" }}>
                <input type="radio" name="amt" checked={full === v} onChange={() => setFull(v as boolean)} style={{ accentColor: color }} className="w-4 h-4" />
                <span className="text-[15px]">{l}</span>
              </label>
            ))}
            {!full && (
              <div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                  <input className={`${field} pl-7`} inputMode="decimal" placeholder="0.00" value={other} onChange={(e) => setOther(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Amount to pay" autoFocus />
                </div>
                {other && !amountOk && <p className="mt-1 text-[13px] text-red-600">{amount > amountDue ? `That's more than the ${fmt(amountDue)} due.` : "Enter at least $1.00."}</p>}
              </div>
            )}
          </fieldset>

          {/* card or bank */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-[10px] bg-neutral-100" role="tablist">
            {(["card", "ach"] as const).map((m) => (
              <button key={m} role="tab" aria-selected={method === m} onClick={() => { setMethod(m); setErr(null); }}
                className={`h-10 rounded-[8px] text-[14.5px] font-medium ${method === m ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500"}`}>
                {m === "card" ? "Card" : "Bank account"}
              </button>
            ))}
          </div>

          {method === "card" ? (
            <div className="space-y-3">
              {hint && (
                <div className="flex items-start gap-2 rounded-[8px] bg-amber-50 border border-amber-200 px-3 py-2 text-[13px] text-amber-900">
                  <span className="flex-1">Preview: use 4242 4242 4242 4242, any future date, any CVC.</span>
                  <button onClick={() => setHint(false)} aria-label="Hide" className="text-amber-700 hover:text-amber-900">✕</button>
                </div>
              )}
              <div>
                <label className={lab} htmlFor="co-name">Name on card</label>
                <input id="co-name" className={field} autoComplete="cc-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className={lab} htmlFor="co-num">Card number</label>
                <div className="relative">
                  <input id="co-num" className={`${field} pr-24 tabular-nums`} inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234"
                    value={num} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setNum(spaced(d.slice(0, d[0] === "3" ? 15 : 16))); setErr(null); }} />
                  {digits && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-neutral-300 text-neutral-600">{brandName}</span>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={lab} htmlFor="co-exp">Expiry</label>
                  <input id="co-exp" className={`${field} tabular-nums`} inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" value={exp} onChange={(e) => onExp(e.target.value)} />
                </div>
                <div>
                  <label className={lab} htmlFor="co-cvc">CVC</label>
                  <input id="co-cvc" className={`${field} tabular-nums`} inputMode="numeric" autoComplete="cc-csc" placeholder={amex ? "1234" : "123"} value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, amex ? 4 : 3))} />
                </div>
                <div>
                  <label className={lab} htmlFor="co-zip">ZIP</label>
                  <input id="co-zip" className={`${field} tabular-nums`} inputMode="numeric" autoComplete="postal-code" placeholder="12345" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))} />
                </div>
              </div>
              {exp.length === 7 && !expOk && <p className="text-[13px] text-red-600">Check the expiry date.</p>}
            </div>
          ) : !bank ? (
            <div className="space-y-2">
              <p className="text-[14px] text-neutral-600">Connect your bank to pay straight from your account. Lower cost for {brand.name}, same security.</p>
              <div className="grid grid-cols-2 gap-2">
                {BANKS.map((b) => (
                  <button key={b} onClick={() => pickBank(b)} disabled={!!linking}
                    className="h-14 rounded-[8px] border border-neutral-300 bg-white text-[14.5px] font-medium hover:border-neutral-500 disabled:opacity-60 flex items-center justify-center gap-2">
                    {linking === b ? <><span className="w-4 h-4 rounded-full border-2 border-neutral-300 border-t-neutral-700 animate-spin" />Connecting…</> : b}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-[8px] border border-neutral-300 px-3.5 py-3">
                <span className="w-9 h-9 rounded-full grid place-items-center text-white font-semibold shrink-0" style={{ background: color }}>{bank[0]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-neutral-900">{bank}</p>
                  <p className="text-[13px] text-neutral-500">Checking •••• 6789</p>
                </div>
                <button onClick={() => { setBank(null); setOk(false); }} className="text-[13px] text-neutral-500 underline">Change</button>
              </div>
              <div>
                <label className={lab} htmlFor="co-holder">Account holder name</label>
                <input id="co-holder" className={field} value={holder} onChange={(e) => setHolder(e.target.value)} />
              </div>
              <label className="flex items-start gap-3 text-[13.5px] text-neutral-600 cursor-pointer">
                <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 w-4 h-4" style={{ accentColor: color }} />
                <span>I authorize {brand.name} to take {amountOk ? fmt(amount) : "this payment"} from my {bank} account ending 6789, one time.</span>
              </label>
              <p className="text-[13px] text-neutral-500">Bank transfers usually clear in 1 to 3 business days.</p>
            </div>
          )}

          {err && <p className="rounded-[8px] bg-red-50 border border-red-200 px-3 py-2 text-[14px] text-red-700" role="alert">{err}</p>}

          <button onClick={pay} disabled={!ready}
            className="w-full h-[52px] rounded-[10px] text-white text-[16.5px] font-semibold flex items-center justify-center gap-2 shadow-sm transition hover:brightness-95 active:translate-y-px disabled:opacity-45 disabled:cursor-default"
            style={{ background: color }}>
            {busy ? <><Spinner />Processing…</> : <><Lock />Pay {amountOk ? fmt(amount) : ""}</>}
          </button>

          <p className="flex items-center justify-center gap-1.5 text-[12.5px] text-neutral-500 text-center">
            <Lock className="shrink-0" />Payments are encrypted and go straight to {brand.name}.
          </p>
        </Paper>

        <PoweredBy brand={brand} />
      </div>
    </div>
  );
}
