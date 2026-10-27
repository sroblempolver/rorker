"use client";
// Where the money goes, room by room: the approved quote's lines (and approved change orders) summed
// per room, before tax. Tap a room to find it on the plan.
import { fmt, lineTotal, quoteLines } from "@/lib/billing/money";
import type { Billing, LineItem } from "@/lib/billing/types";
import type { Plan } from "@/lib/plan/types";

interface RoomSum { key: string; roomId: string | null; name: string; quote: number; extra: number }
const WHOLE = "__whole";

export function RoomCosts({ billing, plan, onShowRoom }: { billing: Billing; plan: Plan | null; onShowRoom?(roomId: string): void }) {
  const approved = billing.quotes.filter((q) => q.status === "approved");
  const rooms = new Map<string, { name: string; floor: string }>();
  for (const f of plan?.floors ?? []) for (const r of f.rooms) rooms.set(r.id, { name: r.name, floor: f.name });

  const sums = new Map<string, RoomSum>();
  const add = (l: LineItem, field: "quote" | "extra") => {
    const key = l.room_id ?? WHOLE;
    const s = sums.get(key) ?? { key, roomId: l.room_id, name: l.room_id ? rooms.get(l.room_id)?.name ?? l.group ?? l.room_id : "Whole house", quote: 0, extra: 0 };
    s[field] += lineTotal(l);
    sums.set(key, s);
  };
  for (const q of approved) for (const l of quoteLines(q)) if (!l.optional || q.chosen.includes(l.id)) add(l, "quote");
  for (const c of billing.change_orders ?? []) if (c.status === "approved") for (const l of c.lines) if (!l.optional) add(l, "extra");

  const list = [...sums.values()].map((s) => ({ ...s, total: s.quote + s.extra })).filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
  const grand = list.reduce((s, r) => s + r.total, 0);
  const max = Math.max(1, ...list.map((r) => r.total));
  const hasExtra = list.some((r) => r.extra > 0);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">By room</h2>
        {grand > 0 && <span className="text-muted text-sm tabular-nums">{fmt(grand)} before tax</span>}
      </div>

      {!approved.length || !list.length ? (
        <div className="card px-4 py-6 text-center">
          <p className="text-[14px]">No approved quote yet</p>
          <p className="text-[12.5px] text-muted mt-1">Once a quote is signed, you see what each room costs here.</p>
        </div>
      ) : (
        <>
          {hasExtra && (
            <div className="flex items-center gap-3 text-[12px] text-muted">
              <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-[1px] bg-accent" />Quote</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-[1px] bg-amber" />Change orders</span>
            </div>
          )}
          <ul className="space-y-1.5">
            {list.map((r) => {
              const share = Math.round((r.total / grand) * 100);
              const clickable = !!(r.roomId && onShowRoom);
              const floor = r.roomId ? rooms.get(r.roomId)?.floor : null;
              const body = (
                <>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-[14px] truncate">{r.name}</span>
                    {r.roomId && <span className="tag shrink-0">{r.roomId}</span>}
                    <span className="flex-1" />
                    <span className="font-mono text-[13.5px] font-semibold tabular-nums shrink-0">{fmt(r.total)}</span>
                    <span className="w-9 text-right text-[12px] text-muted tabular-nums shrink-0">{share}%</span>
                  </span>
                  <span className="mt-1.5 flex h-2 rounded-[1px] bg-panel-3 overflow-hidden" style={{ width: "100%" }}>
                    <span className="block h-full bg-accent" style={{ width: `${(r.quote / max) * 100}%` }} />
                    {r.extra > 0 && <span className="block h-full bg-amber" style={{ width: `${(r.extra / max) * 100}%` }} />}
                  </span>
                  {(floor || r.extra > 0) && (
                    <span className="mt-1 block text-[11.5px] text-muted truncate">
                      {floor}{floor && r.extra > 0 ? " · " : ""}{r.extra > 0 ? `${fmt(r.extra)} in change orders` : ""}
                    </span>
                  )}
                </>
              );
              return (
                <li key={r.key}>
                  {clickable ? (
                    <button onClick={() => onShowRoom!(r.roomId!)} className="card !rounded-[3px] w-full text-left px-3 py-2.5 block hover:!border-chalk" title="Show on the plan">{body}</button>
                  ) : (
                    <div className="card !rounded-[3px] px-3 py-2.5 block">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-[11.5px] text-muted">Line totals before tax and discount. Unpicked add-ons are left out.</p>
        </>
      )}
    </div>
  );
}
