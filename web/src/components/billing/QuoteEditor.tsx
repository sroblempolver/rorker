"use client";
// Build a quote in the job's side panel: lines by room, good / better / best packages, allowances, add-ons,
// tax, financing and the payment plan. Once it has gone to the client it locks, and the contractor can
// preview it, see what the client did with it and follow up.
import { useState } from "react";
import type { Activity, Draw, LineItem, Quote, QuoteOption, Unit } from "@/lib/billing/types";
import type { Plan, Room } from "@/lib/plan/types";
import { fmt, lineTotal, newId, quoteLines, quoteTotals } from "@/lib/billing/money";
import { priceBookFor, type PriceBookItem } from "@/lib/billing/priceBook";
import { QuoteStatusChip } from "./QuoteList";
import { drawAmounts, groupLines, monthlyPayment, niceDate, packageTotals, pctLabel } from "./QuoteDocument";

const UNITS: Unit[] = ["ea", "sqft", "lf", "hr", "day", "lot"];
const WHOLE = "Whole house";
const PACKAGES: Omit<QuoteOption, "id">[] = [
  { name: "Good", blurb: "Builder-grade finishes" },
  { name: "Better", blurb: "Mid-grade finishes. Most clients pick this." },
  { name: "Best", blurb: "High-end finishes throughout" },
];

/** What happened to the quote, oldest first: the stored activity, or one built from its dates. */
function rawActivity(q: Quote, clientName?: string | null): Activity[] {
  if (q.activity?.length) return [...q.activity].sort((a, b) => a.at.localeCompare(b.at));
  const out: Activity[] = [{ at: q.created_at, what: "Created" }];
  if (q.sent_at) out.push({ at: q.sent_at, what: `Sent to ${clientName || "the client"}` });
  if (q.viewed_at) out.push({ at: q.viewed_at, what: "Viewed" });
  if (q.approved_at) out.push({ at: q.approved_at, what: `Approved, signed by ${q.signed_by ?? "the client"}` });
  if (q.declined_at) out.push({ at: q.declined_at, what: "Declined" });
  return out;
}

/** Timeline lines for display: views fold into one "Viewed 3 times · last Oct 8". */
function timeline(acts: Activity[]) {
  const views = acts.filter((a) => /^(viewed|opened)/i.test(a.what));
  const lastView = views[views.length - 1];
  return acts.filter((a) => !views.includes(a) || a === lastView).map((a) => {
    if (a === lastView && views.length > 1) return { at: a.at, text: `Viewed ${views.length} times · last ${niceDate(a.at, false)}` };
    const who = a.who && !a.what.includes(a.who) ? ` by ${a.who}` : "";
    return { at: a.at, text: `${a.what}${who} · ${niceDate(a.at, false)}` };
  });
}

/** A number box that keeps what you type ("12.", "") and reports the parsed value. */
function NumInput({ value, onChange, className = "", step, disabled, prefix, suffix }: {
  value: number; onChange(n: number): void; className?: string; step?: string; disabled?: boolean; prefix?: string; suffix?: string;
}) {
  const [text, setText] = useState(String(value));
  const shown = parseFloat(text) === value || (text === "" && value === 0) ? text : String(value);
  return (
    <div className={`relative ${className}`}>
      {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-[13px] pointer-events-none">{prefix}</span>}
      <input className={`input !h-9 !text-[14px] tabular-nums ${prefix ? "!pl-6" : ""} ${suffix ? "!pr-7" : ""}`} inputMode="decimal" type="text" step={step} disabled={disabled}
        value={shown} onChange={(e) => { setText(e.target.value); onChange(parseFloat(e.target.value.replace(/[^0-9.\-]/g, "")) || 0); }} />
      {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted text-[13px] pointer-events-none">{suffix}</span>}
    </div>
  );
}

function Tags({ ids, max = 6 }: { ids: string[]; max?: number }) {
  if (!ids.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {ids.slice(0, max).map((id) => <span key={id} className="tag !h-5 !text-[11px]">{id}</span>)}
      {ids.length > max && <span className="text-[12px] text-muted self-center">+{ids.length - max} more</span>}
    </div>
  );
}

function Toggle({ on, label, onChange, disabled }: { on: boolean; label: string; onChange(v: boolean): void; disabled?: boolean }) {
  return (
    <label className={`inline-flex items-center gap-2 text-[13px] ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

type Target = { key: string; group: string; room_id: string | null };

/** Search the price book and drop items into a room. Groups that fit the room come first. */
function PriceBookPicker({ targets, start, options, onAdd, onClose }: {
  targets: Target[]; start: string; options: QuoteOption[];
  onAdd(item: PriceBookItem, target: Target, optionId: string | null): void; onClose(): void;
}) {
  const [query, setQuery] = useState("");
  const [key, setKey] = useState(start);
  const [opt, setOpt] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const target = targets.find((x) => x.key === key) ?? targets[0];
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const groups = priceBookFor(target.group)
    .map((g) => ({ ...g, items: g.items.filter((it) => words.every((w) => `${it.description} ${g.group}`.toLowerCase().includes(w))) }))
    .filter((g) => g.items.length);
  return (
    <div className="card !rounded-[3px] !border-accent/50 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <p className="text-[14px] font-semibold">Price book</p>
        <button className="ml-auto btn btn-ghost btn-sm !px-2" onClick={onClose}>Close</button>
      </div>
      <input className="input !h-9 !text-[14px]" autoFocus placeholder="Search: tile, outlet, vanity" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className={`grid gap-2 ${options.length ? "grid-cols-2" : ""}`}>
        <div>
          <span className="label !mb-1 !text-[12px]">Add to</span>
          <select className="input !h-9 !text-[14px]" value={target.key} onChange={(e) => setKey(e.target.value)}>
            {targets.map((x) => <option key={x.key} value={x.key}>{x.room_id ? `${x.group} · ${x.room_id}` : x.group}</option>)}
          </select>
        </div>
        {options.length > 0 && (
          <div>
            <span className="label !mb-1 !text-[12px]">Package</span>
            <select className="input !h-9 !text-[14px]" value={opt} onChange={(e) => setOpt(e.target.value)}>
              <option value="">All packages</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}
      </div>
      {added && <p className="text-[12.5px] text-green">{added}</p>}
      <div className="max-h-[340px] overflow-y-auto -mx-1 px-1 space-y-3">
        {groups.length === 0 && <p className="text-[13px] text-muted">Nothing matches. Try another word or add it by hand.</p>}
        {groups.map((g) => (
          <section key={g.group}>
            <p className="eyebrow !mb-1">{g.group}{g.fits && !words.length && <span className="text-accent normal-case tracking-normal"> · fits {target.group}</span>}</p>
            <ul className="divide-y divide-line">
              {g.items.map((it) => (
                <li key={it.description}>
                  <button className="w-full flex items-center gap-2 py-1.5 text-left hover:bg-panel-2 rounded-[2px] px-1"
                    onClick={() => { onAdd(it, target, opt || null); setAdded(`Added "${it.description}" to ${target.group}`); }}>
                    <span className="flex-1 min-w-0 text-[13.5px] leading-snug">{it.description}</span>
                    <span className="shrink-0 text-[12.5px] text-muted tabular-nums">{fmt(it.unit_price)}/{it.unit}</span>
                    <span className="shrink-0 text-accent text-[13px] font-semibold">+</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function QuoteEditor({ quote: q, plan, stageNames, onChange, onSend, onBack, onDelete, onPreview, onFollowUp, clientName }: {
  quote: Quote; plan: Plan | null; stageNames: string[];
  onChange(q: Quote): void; onSend(): void; onBack(): void; onDelete(): void; onPreview(): void;
  /** the contractor nudged the client about a sent quote (the editor already adds it to the activity) */
  onFollowUp?(): void;
  /** for the timeline when the quote has no stored activity: "Sent to Priya Okafor" */
  clientName?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [book, setBook] = useState<string | null>(null);
  const [nudged, setNudged] = useState(false);
  const locked = q.status !== "draft";
  const rooms: Room[] = plan ? plan.floors.flatMap((f) => f.rooms.filter((r) => !r.outdoor)) : [];
  const t = quoteTotals(q);
  const pkgs = packageTotals(q);
  const options = q.options ?? [];
  const counted = new Set(quoteLines(q).map((l) => l.id));
  const viewing = options.find((o) => o.id === (q.picked_option ?? options[0]?.id));
  const acts = rawActivity(q, clientName);
  const waiting = q.status === "sent" || q.status === "viewed";
  const amts = drawAmounts(q.schedule, t.total);
  const pctSum = q.schedule.reduce((s, d) => s + d.pct, 0);

  const set = (patch: Partial<Quote>) => onChange({ ...q, ...patch });
  // editing the lines makes it the contractor's quote, so the assistant badge goes
  const setLines = (lines: LineItem[], chosen = q.chosen) => set({ lines, chosen: chosen.filter((id) => lines.some((l) => l.id === id)), ai_drafted: false });
  const setLine = (id: string, patch: Partial<LineItem>) => setLines(q.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = (group = WHOLE, room_id: string | null = null) => {
    const l: LineItem = { id: newId(), group, room_id, description: "", qty: 1, unit: "ea", unit_price: 0, element_ids: [] };
    setLines([...q.lines, l]);
    setOpen(l.id);
  };
  const setDraw = (id: string, patch: Partial<Draw>) => set({ schedule: q.schedule.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const setOption = (id: string, patch: Partial<QuoteOption>) => set({ options: options.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const togglePackages = (on: boolean) => {
    if (on) return set({ options: PACKAGES.map((p) => ({ ...p, id: newId() })), picked_option: null });
    const keep = options[0]?.id;
    const tiered = q.lines.some((l) => l.option_id);
    if (tiered && !confirm(`Turn off packages? Lines only in ${options.slice(1).map((o) => o.name).join(" and ") || "the other packages"} are removed. ${options[0]?.name ?? "First package"} lines stay.`)) return;
    const lines = q.lines.filter((l) => !l.option_id || l.option_id === keep).map((l) => ({ ...l, option_id: undefined }));
    onChange({ ...q, options: [], picked_option: null, lines, chosen: q.chosen.filter((id) => lines.some((l) => l.id === id)), ai_drafted: tiered ? false : q.ai_drafted });
  };
  const addFromBook = (it: PriceBookItem, tg: Target, optionId: string | null) =>
    setLines([...q.lines, { id: newId(), group: tg.group, room_id: tg.room_id, description: it.description, qty: 1, unit: it.unit, unit_price: it.unit_price, element_ids: [], option_id: optionId }]);
  const followUp = () => {
    set({ activity: [...acts, { at: new Date().toISOString(), what: `Follow-up sent to ${clientName || "the client"}` }] });
    setNudged(true);
    onFollowUp?.();
  };
  // rooms to add price book items to: the plan's, any already on the quote, and the whole house
  const targets: Target[] = [];
  const addTarget = (group: string, room_id: string | null) => { const key = `${group}|${room_id ?? ""}`; if (!targets.some((x) => x.key === key)) targets.push({ key, group, room_id }); };
  groupLines(q.lines).forEach((g) => addTarget(g.group, g.room_id));
  rooms.forEach((r) => addTarget(r.name, r.id));
  addTarget(WHOLE, null);
  const pickRoom = (l: LineItem, roomId: string) => {
    const r = rooms.find((x) => x.id === roomId);
    setLine(l.id, r ? { room_id: r.id, group: r.name, element_ids: l.room_id === r.id ? l.element_ids : [] } : { room_id: null, group: WHOLE, element_ids: [] });
  };

  const banner = q.status === "approved" ? `Approved by ${q.signed_by ?? "the client"}${q.approved_at ? ` on ${niceDate(q.approved_at, false)}` : ""}`
    : q.status === "declined" ? `Declined by the client${q.declined_at ? ` on ${niceDate(q.declined_at, false)}` : ""}`
    : q.status === "viewed" ? `The client opened it${q.viewed_at ? ` on ${niceDate(q.viewed_at, false)}` : ""}. Waiting on their answer.`
    : q.status === "sent" ? `Sent${q.sent_at ? ` on ${niceDate(q.sent_at, false)}` : ""}. Waiting on the client.` : null;

  return (
    <div className="flex flex-col min-h-full">
      <div className="p-4 space-y-4 flex-1">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm !px-2 -ml-2" onClick={onBack}>← Quotes</button>
          <span className="font-mono text-[12px] text-muted">{q.number}</span>
          <span className="ml-auto"><QuoteStatusChip status={q.status} /></span>
        </div>

        {q.ai_drafted && !locked && (
          <p className="chip !h-auto !whitespace-normal py-1.5 !text-accent !border-accent/40">Drafted from the plan. Check prices before it goes out.</p>
        )}
        {banner && (
          <div className={`card !rounded-[3px] px-3 py-2.5 text-[13.5px] ${q.status === "approved" ? "!border-green/50 text-green" : q.status === "declined" ? "!border-red/50 text-red" : "!border-amber/50 text-amber"}`}>
            {banner}
            <span className="block text-muted text-[12.5px] mt-0.5">This quote is locked. Make a new one for changes.</span>
          </div>
        )}

        {locked && (
          <div className="space-y-2">
            <p className="eyebrow">Activity</p>
            <ol className="relative border-l border-line ml-1.5 space-y-1.5">
              {timeline(acts).map((a, i, all) => (
                <li key={`${a.at}${i}`} className="pl-3.5 relative text-[13px] leading-snug">
                  <span className={`absolute -left-[4.5px] top-[6px] h-2 w-2 rounded-full ${i === all.length - 1 ? "bg-accent" : "bg-panel-3 border border-line"}`} />
                  <span className={i === all.length - 1 ? "text-text" : "text-muted"}>{a.text}</span>
                </li>
              ))}
            </ol>
            {waiting && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
                <button className="btn btn-sm" onClick={followUp}>{nudged ? "Follow up again" : "Follow up"}</button>
                <p className="text-[12.5px] text-muted flex-1 min-w-[180px]">{nudged ? "Reminder sent. " : ""}Automatic reminder goes out in 3 days if they haven&apos;t answered.</p>
              </div>
            )}
          </div>
        )}

        {locked ? (
          <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">{q.title || "Untitled quote"}</h2>
        ) : (
          <div>
            <label className="label">Title</label>
            <input className="input" value={q.title} placeholder="Kitchen renovation" onChange={(e) => set({ title: e.target.value })} />
          </div>
        )}

        {/* good / better / best */}
        {(!locked || pkgs) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="eyebrow !mb-0">Packages</p>
              {!locked && <span className="ml-auto"><Toggle label="Offer packages" on={!!pkgs} onChange={togglePackages} /></span>}
            </div>
            {!pkgs && <p className="text-[12.5px] text-muted">Three price points, like laminate, quartz or quartzite counters. Most clients pick the middle.</p>}
            {pkgs && (
              <div className="grid gap-2">
                {pkgs.list.map((o, i) => {
                  const on = q.picked_option === o.id;
                  return (
                    <div key={o.id} className={`card !rounded-[3px] p-2.5 ${on ? "!border-green/60" : ""}`}>
                      {locked ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-[14px] font-semibold">{o.name}</span>
                          {on && <span className="text-[12px] text-green">Client&apos;s pick</span>}
                          <span className="ml-auto text-[14px] font-semibold tabular-nums">{fmt(o.total)}</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <input className="input !h-8 !text-[14px] font-semibold !w-auto flex-1 min-w-0" value={o.name} placeholder={`Package ${i + 1}`} onChange={(e) => setOption(o.id, { name: e.target.value })} />
                            <span className="shrink-0 text-[14px] font-semibold tabular-nums">{fmt(o.total)}</span>
                          </div>
                          <input className="input !h-8 !text-[13px]" value={o.blurb ?? ""} placeholder="One line on what makes it different" onChange={(e) => setOption(o.id, { blurb: e.target.value || null })} />
                        </div>
                      )}
                      {locked && o.blurb && <p className="text-[12px] text-muted mt-0.5">{o.blurb}</p>}
                      <p className="text-[11.5px] text-muted mt-1">{q.lines.filter((l) => l.option_id === o.id).length} lines only in this package</p>
                    </div>
                  );
                })}
                {!locked && <p className="text-[12px] text-muted">Lines set to &quot;All packages&quot; are in every one. Open a line to put it in one package.</p>}
              </div>
            )}
          </div>
        )}

        {/* lines, by room */}
        <div className="space-y-3">
          <p className="eyebrow">Lines</p>
          {q.lines.length === 0 && <p className="text-[13.5px] text-muted">No lines yet. Add the work room by room.</p>}
          {groupLines(q.lines).map((g) => (
            <section key={g.key} className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold">{g.group}</h3>
                {g.room_id && <span className="tag !h-5 !text-[11px]">{g.room_id}</span>}
                <span className="ml-auto text-[12.5px] text-muted tabular-nums" title={pkgs ? `With ${viewing?.name ?? "the first package"}` : undefined}>{fmt(g.lines.reduce((s, l) => s + (l.optional || !counted.has(l.id) ? 0 : lineTotal(l)), 0))}</span>
              </div>
              {g.lines.map((l) => open === l.id && !locked ? (
                <div key={l.id} className="card !rounded-[3px] p-3 space-y-2.5 !border-accent/50">
                  <div className="flex gap-2">
                    <textarea className="input !text-[14px]" rows={2} autoFocus placeholder="The work" value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} />
                    <button className="w-8 h-8 shrink-0 rounded-[2px] text-muted hover:bg-panel-3 hover:text-red" title="Remove line"
                      onClick={() => setLines(q.lines.filter((x) => x.id !== l.id))}>×</button>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
                    <div><span className="label !mb-1 !text-[12px]">Qty</span><NumInput value={l.qty} onChange={(n) => setLine(l.id, { qty: n })} /></div>
                    <div>
                      <span className="label !mb-1 !text-[12px]">Unit</span>
                      <select className="input !h-9 !text-[14px]" value={l.unit} onChange={(e) => setLine(l.id, { unit: e.target.value as Unit })}>
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div><span className="label !mb-1 !text-[12px]">Unit price</span><NumInput prefix="$" value={l.unit_price / 100} onChange={(n) => setLine(l.id, { unit_price: Math.round(n * 100) })} /></div>
                  </div>
                  <div>
                    <span className="label !mb-1 !text-[12px]">Room</span>
                    <select className="input !h-9 !text-[14px]" value={l.room_id ?? ""} onChange={(e) => pickRoom(l, e.target.value)}>
                      <option value="">{WHOLE}</option>
                      {rooms.map((r) => <option key={r.id} value={r.id}>{`${r.name} · ${r.id}`}</option>)}
                    </select>
                  </div>
                  {options.length > 0 && (
                    <div>
                      <span className="label !mb-1 !text-[12px]">Package</span>
                      <select className="input !h-9 !text-[14px]" value={l.option_id ?? ""} onChange={(e) => setLine(l.id, { option_id: e.target.value || undefined })}>
                        <option value="">All packages</option>
                        {options.map((o) => <option key={o.id} value={o.id}>{`Only in ${o.name || "package"}`}</option>)}
                      </select>
                    </div>
                  )}
                  <Tags ids={l.element_ids} />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Toggle label="Optional add-on" on={!!l.optional} onChange={(v) => setLine(l.id, { optional: v || undefined })} />
                    <Toggle label="Allowance" on={!!l.allowance} onChange={(v) => setLine(l.id, { allowance: v || undefined })} />
                    <Toggle label="Taxable" on={l.taxable !== false} onChange={(v) => setLine(l.id, { taxable: v ? undefined : false })} />
                    <span className="ml-auto text-[14px] font-semibold tabular-nums">{fmt(lineTotal(l))}</span>
                  </div>
                  {l.allowance && <p className="text-[12px] text-muted">A budget for something the client picks later. If their pick costs more or less, it becomes a change order.</p>}
                  <button className="btn btn-sm w-full" onClick={() => setOpen(null)}>Done</button>
                </div>
              ) : (
                <button key={l.id} disabled={locked} onClick={() => setOpen(l.id)}
                  className="card !rounded-[3px] w-full px-3 py-2 text-left flex gap-3 enabled:hover:bg-panel-2 disabled:cursor-default">
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13.5px] leading-snug ${l.description ? "" : "text-muted italic"}`}>{l.description || "Untitled line"}</p>
                    <p className="text-[12px] text-muted mt-0.5">
                      {l.option_id && <span className="tag !h-[18px] !text-[10.5px] mr-1.5 align-[1px]">{options.find((o) => o.id === l.option_id)?.name ?? "Package"}</span>}
                      {l.qty} {l.unit} × {fmt(l.unit_price)}
                      {l.allowance && <span className="text-amber"> · allowance</span>}
                      {l.optional && <span className="text-accent"> · optional{q.chosen.includes(l.id) ? ", chosen" : ""}</span>}
                      {l.taxable === false && " · no tax"}
                    </p>
                    {l.element_ids.length > 0 && <div className="mt-1"><Tags ids={l.element_ids} max={4} /></div>}
                  </div>
                  <span className={`shrink-0 text-[13.5px] tabular-nums ${(l.optional && !q.chosen.includes(l.id)) || !counted.has(l.id) ? "text-muted" : ""}`}>{fmt(lineTotal(l))}</span>
                </button>
              ))}
              {!locked && (
                <div className="flex flex-wrap gap-x-4 px-1">
                  <button className="text-[12.5px] text-muted hover:text-text" onClick={() => addLine(g.group, g.room_id)}>+ Add to {g.group}</button>
                  <button className="text-[12.5px] text-muted hover:text-text" onClick={() => setBook(g.key)}>+ From price book</button>
                </div>
              )}
            </section>
          ))}
          {!locked && book && <PriceBookPicker targets={targets} start={book} options={options} onAdd={addFromBook} onClose={() => setBook(null)} />}
          {!locked && (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-sm border-dashed" onClick={() => addLine()}>+ Add line</button>
              <button className="btn btn-sm border-dashed" onClick={() => setBook(book ? null : (targets[0]?.key ?? `${WHOLE}|`))}>+ From price book</button>
            </div>
          )}
        </div>

        {/* tax, discount, totals */}
        <div className="card !rounded-[3px] p-3 space-y-2">
          {!locked && (
            <div className="grid grid-cols-2 gap-2 pb-1">
              <div><span className="label !mb-1 !text-[12px]">Tax rate</span><NumInput suffix="%" value={Math.round(q.tax_rate * 10000) / 100} onChange={(n) => set({ tax_rate: n / 100 })} /></div>
              <div><span className="label !mb-1 !text-[12px]">Discount</span><NumInput prefix="$" value={q.discount / 100} onChange={(n) => set({ discount: Math.max(0, Math.round(n * 100)) })} /></div>
            </div>
          )}
          <Sum k="Subtotal" v={fmt(t.subtotal)} />
          {t.discount > 0 && <Sum k="Discount" v={`−${fmt(t.discount)}`} />}
          <Sum k={`Tax (${pctLabel(q.tax_rate)})`} v={fmt(t.tax)} />
          <div className="flex justify-between border-t border-line pt-2 text-[16px] font-semibold"><span>Total{viewing ? ` · ${viewing.name}` : ""}</span><span className="tabular-nums">{fmt(t.total)}</span></div>
          {pkgs && !q.picked_option && <p className="text-[12px] text-muted">Showing the first package. The total follows the client&apos;s pick.</p>}
          {q.lines.some((l) => l.optional) && <p className="text-[12px] text-muted">Add-ons count once the client ticks them.</p>}
          <div className="border-t border-line pt-2">
            <Toggle label="Offer monthly payments" on={!!q.financing} disabled={locked} onChange={(v) => set({ financing: v })} />
            <p className="text-[12px] text-muted mt-1 pl-6">
              {q.financing && t.total > 0 ? `The client sees "as low as ${fmt(monthlyPayment(t.total, 60))}/month" under the total.` : "Shows an \"as low as\" monthly price under the total. Bigger jobs close faster with it."}
            </p>
          </div>
        </div>

        {/* payment plan */}
        <div className="space-y-2">
          <p className="eyebrow">Payment plan</p>
          {q.schedule.map((d, i) => locked ? (
            <div key={d.id} className="flex items-center gap-3 text-[13.5px] px-1">
              <span className="w-12 font-mono text-[12.5px] text-muted">{pctLabel(d.pct)}</span>
              <span className="flex-1 min-w-0 truncate">{d.label}<span className="text-muted"> · {d.stage_name ?? "At signing"}</span></span>
              <span className="tabular-nums">{fmt(amts[i])}</span>
            </div>
          ) : (
            <div key={d.id} className="card !rounded-[3px] p-2.5 space-y-2">
              <div className="flex gap-2">
                <input className="input !h-9 !text-[14px]" value={d.label} placeholder="Payment name" onChange={(e) => setDraw(d.id, { label: e.target.value })} />
                <button className="w-8 h-9 shrink-0 rounded-[2px] text-muted hover:bg-panel-3 hover:text-red" title="Remove payment"
                  onClick={() => set({ schedule: q.schedule.filter((x) => x.id !== d.id) })}>×</button>
              </div>
              <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                <NumInput suffix="%" value={Math.round(d.pct * 1000) / 10} onChange={(n) => setDraw(d.id, { pct: n / 100 })} />
                <select className="input !h-9 !text-[14px]" value={d.stage_name ?? ""} onChange={(e) => setDraw(d.id, { stage_name: e.target.value || null })}>
                  <option value="">At signing</option>
                  {stageNames.map((s) => <option key={s} value={s}>{`When ${s} is done`}</option>)}
                </select>
                <span className="text-[13.5px] tabular-nums w-[84px] text-right">{fmt(amts[i])}</span>
              </div>
            </div>
          ))}
          {Math.abs(pctSum - 1) > 0.0001 && q.schedule.length > 0 && (
            <p className="text-[12.5px] text-amber">The payments add up to {pctLabel(pctSum)}. They should add up to 100%.</p>
          )}
          {!locked && (
            <button className="text-[12.5px] text-muted hover:text-text px-1"
              onClick={() => set({ schedule: [...q.schedule, { id: newId(), label: "", pct: Math.max(0, Math.round((1 - pctSum) * 100) / 100), stage_name: stageNames[0] ?? null, invoice_id: null }] })}>
              + Add payment
            </button>
          )}
        </div>

        {/* notes, terms, valid until */}
        {locked ? (
          <div className="space-y-2 text-[13px] text-muted">
            {q.notes && <p><span className="text-text">Notes. </span>{q.notes}</p>}
            {q.terms && <p><span className="text-text">Terms. </span>{q.terms}</p>}
            {q.valid_until && <p>Valid until {niceDate(q.valid_until)}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div><label className="label">Notes for the client</label>
              <textarea className="input !text-[14px]" rows={2} value={q.notes ?? ""} placeholder="What is included, allowances, finishes" onChange={(e) => set({ notes: e.target.value || null })} /></div>
            <div><label className="label">Terms</label>
              <textarea className="input !text-[14px]" rows={2} value={q.terms ?? ""} placeholder="Start date, change orders, warranty" onChange={(e) => set({ terms: e.target.value || null })} /></div>
            <div><label className="label">Valid until</label>
              <input type="date" className="input !h-9 !text-[14px] [color-scheme:dark]" value={q.valid_until ?? ""} onChange={(e) => set({ valid_until: e.target.value || null })} /></div>
            <button className="text-[12.5px] text-muted hover:text-red" onClick={() => { if (confirm(`Delete ${q.number}? This can't be undone.`)) onDelete(); }}>Delete this draft</button>
          </div>
        )}
      </div>

      {/* always in reach: total and the next step */}
      <div className="sticky bottom-0 border-t border-line bg-panel p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="mr-auto min-w-0">
            <p className="text-[11.5px] text-muted leading-none">{pkgs && !q.picked_option ? "Packages" : viewing ? `Total · ${viewing.name}` : "Total"}</p>
            <p className="text-[17px] font-semibold tabular-nums leading-tight">{pkgs && !q.picked_option && pkgs.min !== pkgs.max ? `${fmt(pkgs.min)} to ${fmt(pkgs.max)}` : fmt(t.total)}</p>
          </div>
          <button className="btn btn-sm" onClick={onPreview}>Preview</button>
          {!locked && <button className="btn btn-primary btn-sm" disabled={!q.lines.length} onClick={onSend}>Send to client</button>}
        </div>
        {!locked && !q.lines.length && <p className="text-[12px] text-muted text-right">Add a line before sending.</p>}
      </div>
    </div>
  );
}

function Sum({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-[13.5px] text-muted"><span>{k}</span><span className="tabular-nums text-text">{v}</span></div>;
}
