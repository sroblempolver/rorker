"use client";
// The shopping run: everything still to get on every job, one list per store. The same thing for
// several jobs shows once with its total and the split ("6: Hadley 4, Baker 2"), so it's bought in
// one go and still lands on the right job. Tick it at the store and every job's line is marked got.
import { useMemo, useState } from "react";
import type { Member } from "@/lib/data/types";
import { today } from "@/lib/dates";
import { Avatar } from "@/components/team/Avatar";
import { FULFIL_LABEL, lineTotal, money, orderNow, qtyText, type MaterialInput, type MaterialLine, type MaterialsJob } from "@/lib/materials/types";

interface Bundle { key: string; name: string; unit: MaterialLine["unit"]; lines: MaterialLine[]; qty: number; cost: number; needed: string | null }

export function ShoppingRun({ lines, jobs, members, me, onUpdate, onOpenJob }: {
  lines: MaterialLine[]; jobs: MaterialsJob[]; members: Member[]; me: string | null;
  onUpdate: (ids: string[], patch: Partial<MaterialInput>) => void; onOpenJob: (jobId: string) => void;
}) {
  const [who, setWho] = useState<string | "all">("all");
  const [show, setShow] = useState<"to_buy" | "ordered">("to_buy");
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const jobName = (id: string) => jobs.find((j) => j.id === id)?.name ?? "Job";
  const short = (id: string) => jobName(id).split(" ")[0];

  const todo = lines.filter((l) => l.status === show && (who === "all" || l.buyer === who));
  const stores = useMemo(() => {
    const by = new Map<string, Map<string, Bundle>>();
    for (const l of todo) {
      const store = l.fulfil === "stock" ? "From stock (van or shop)" : l.store ?? "No store picked";
      const k = `${l.name.toLowerCase()}|${l.unit}`;
      const s = by.get(store) ?? new Map<string, Bundle>();
      const b = s.get(k) ?? { key: `${store}|${k}`, name: l.name, unit: l.unit, lines: [], qty: 0, cost: 0, needed: null };
      b.lines.push(l);
      b.qty += l.qty;
      b.cost += lineTotal(l);
      if (l.needed_by && (!b.needed || l.needed_by < b.needed)) b.needed = l.needed_by;
      s.set(k, b);
      by.set(store, s);
    }
    return [...by].map(([store, m]) => ({ store, bundles: [...m.values()].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => b.bundles.length - a.bundles.length);
  }, [todo]);

  // per job: what's left to get and what's been spent so far
  const perJob = jobs.map((j) => {
    const ls = lines.filter((l) => l.job_id === j.id && l.status !== "returned");
    return { j, toBuy: ls.filter((l) => l.status === "to_buy").length, est: ls.reduce((a, l) => a + lineTotal(l), 0), spent: ls.filter((l) => l.status === "got" || l.status === "installed").reduce((a, l) => a + lineTotal(l), 0) };
  }).filter((x) => x.est || x.toBuy);

  const copyOrder = async (store: string, bundles: Bundle[]) => {
    const text = `Order for ${store}\n\n${bundles.map((b) => `${qtyText(b.qty, b.unit)}  ${b.name}${b.lines[0].sku ? `  #${b.lines[0].sku}` : ""}`).join("\n")}\n\nJobs: ${[...new Set(bundles.flatMap((b) => b.lines.map((l) => jobName(l.job_id))))].join(", ")}`;
    try { await navigator.clipboard.writeText(text); setCopied(store); setTimeout(() => setCopied(null), 2000); } catch { /* the embedded preview may not copy */ }
  };

  return (
    <div className="px-4 sm:px-6 py-6 max-w-3xl w-full mx-auto space-y-5">
      <div>
        <p className="eyebrow">All jobs</p>
        <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em]">Shopping run</h1>
        <p className="text-muted text-sm">Everything to get, store by store. The same thing for several jobs is bought once and kept apart per job.</p>
      </div>

      {perJob.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {perJob.map(({ j, toBuy, est, spent }) => (
            <button key={j.id} onClick={() => onOpenJob(j.id)} className="card !rounded-[3px] px-3 py-2 text-left hover:border-chalk">
              <p className="text-[14px] truncate">{j.name}</p>
              <p className="text-[12px] text-muted font-mono">{toBuy} to buy · {money(spent)} of {money(est)}</p>
              <div className="h-1.5 bg-panel-3 rounded-[1px] mt-1.5 overflow-hidden"><div className="h-full bg-green" style={{ width: `${est ? Math.min(100, (spent / est) * 100) : 0}%` }} /></div>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {(["to_buy", "ordered"] as const).map((s) => (
          <button key={s} onClick={() => setShow(s)} className={`chip ${show === s ? "!text-accent-ink !bg-accent !border-accent" : "hover:text-text"}`}>{s === "to_buy" ? "To buy" : "Ordered, on the way"}</button>
        ))}
        <span className="w-px h-5 bg-line mx-1" />
        <button onClick={() => setWho("all")} className={`chip ${who === "all" ? "!text-text !border-chalk" : "hover:text-text"}`}>Everyone</button>
        {members.filter((m) => lines.some((l) => l.buyer === m.id && (l.status === "to_buy" || l.status === "ordered"))).map((m) => (
          <button key={m.id} onClick={() => setWho(m.id)} className={`chip !pl-0.5 ${who === m.id ? "!text-text !border-chalk" : "hover:text-text"}`}><Avatar m={m} size={20} />{m.id === me ? "Me" : m.full_name.split(" ")[0]}</button>
        ))}
      </div>

      {stores.length ? stores.map(({ store, bundles }) => (
        <section key={store} className="card !rounded-[4px] overflow-hidden">
          <div className="px-3 py-2 bg-panel-2 border-b border-line flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="font-display text-[19px] font-bold uppercase tracking-[0.04em] truncate min-w-0">{store}</h2>
            <span className="font-mono text-[12px] text-muted shrink-0">{bundles.length} item{bundles.length === 1 ? "" : "s"} · {money(bundles.reduce((a, b) => a + b.cost, 0))}</span>
            <button className="btn btn-ghost btn-sm ml-auto" onClick={() => copyOrder(store, bundles)}>{copied === store ? "Copied" : "Copy order"}</button>
            {show === "to_buy" && <button className="btn btn-sm" title="Mark everything here as ordered" onClick={() => onUpdate(bundles.flatMap((b) => b.lines.map((l) => l.id)), { status: "ordered" })}>Ordered</button>}
          </div>
          <div className="divide-y divide-line">
            {bundles.map((b) => {
              const people = [...new Set(b.lines.map((l) => l.buyer).filter(Boolean))].map((id) => members.find((m) => m.id === id)).filter(Boolean) as Member[];
              const jobsHere = [...new Set(b.lines.map((l) => l.job_id))];
              return (
                <div key={b.key}>
                  <div className="px-3 py-2 flex items-center gap-2.5 cursor-pointer hover:bg-panel-2" onClick={() => setOpen(open === b.key ? null : b.key)}>
                    <button onClick={(e) => { e.stopPropagation(); onUpdate(b.lines.map((l) => l.id), { status: "got" }); }} title="Got it: marks it on every job"
                      className="w-7 h-7 shrink-0 rounded-[3px] border-2 border-accent hover:bg-accent/20" aria-label={`Got ${b.name}`} />
                    <span className="font-mono text-[14px] font-semibold w-[62px] shrink-0 leading-tight">{qtyText(b.qty, b.unit)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] truncate">{b.name}</span>
                      <span className="block text-[12px] text-muted truncate">
                        {jobsHere.length > 1 ? b.lines.map((l) => `${short(l.job_id)} ${+l.qty.toFixed(2)}`).join(" · ") : jobName(jobsHere[0])}
                        {b.needed && <> · by {b.needed.slice(5)}</>}
                        {b.lines.some((l) => l.fulfil === "delivery") && <> · {FULFIL_LABEL.delivery}</>}
                        {b.lines.some((l) => orderNow(l, today(), 2)) && <span className="text-red"> · order today</span>}
                      </span>
                    </span>
                    {b.cost > 0 && <span className="font-mono text-[12px] text-muted shrink-0">{money(b.cost)}</span>}
                    <span className="inline-flex -space-x-1">{people.map((m) => <Avatar key={m.id} m={m} size={20} ring />)}</span>
                  </div>
                  {open === b.key && (
                    <div className="px-3 pb-2.5 pl-[52px] space-y-1">
                      {b.lines.map((l) => (
                        <div key={l.id} className="flex items-center gap-2 text-[13px]">
                          <span className="font-mono text-muted w-[54px] shrink-0">{qtyText(l.qty, l.unit)}</span>
                          <button className="truncate text-left hover:underline" onClick={() => onOpenJob(l.job_id)}>{jobName(l.job_id)}</button>
                          {l.note && <span className="text-muted truncate">· {l.note}</span>}
                          {l.link && <a href={l.link} target="_blank" rel="noreferrer" className="text-chalk hover:underline shrink-0">link</a>}
                          <button className="ml-auto text-[12px] text-muted hover:text-text shrink-0" onClick={() => onUpdate([l.id], { status: "got" })}>Got this one</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )) : <p className="text-muted text-sm py-10 text-center">{show === "to_buy" ? "Nothing left to buy. Nice." : "Nothing on order."}</p>}
    </div>
  );
}
