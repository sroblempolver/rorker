"use client";
// The catalogue tray under the plan while placing furniture, as a two-step menu: Kitchen, Bath, Rooms or
// Other, then a section (Base cabinets, Wall cabinets, Vanities, Bedroom...), then a card for every
// stock size with its code and a line drawing. Search looks through all of it. Click a card to pick it
// up, then click the plan to put it down (Shift-click keeps placing). Sections come from lib/plan/tray.ts
// and lib/plan/cabinetTray.ts.
import { useMemo, useState, type ReactNode } from "react";
import { CATALOG } from "@/lib/plan/catalog";
import { famOf, frontsOf, toeOf } from "@/lib/plan/cabinets";
import "@/lib/plan/cabinetTray";
import { itemLabel, sameItem, sectionItems, traySearch, trayTops, type TopId, type TrayItem, type TraySection } from "@/lib/plan/tray";
import { useStandards } from "@/lib/plan/standards";
import { fmtLen, type Units } from "@/lib/plan/units";

// the tray opens where it was left; the Cabinets panel can send it to a section
let last: string | null = null;
/** Open the tray at a top or a section next time it shows: "kitchen", "kitchen/wall". */
export function openTrayAt(path: string) { last = path; }

/** Whether a thing is drawn from the front (cabinets, appliances, bath fixtures) or from above. */
const ELEV = new Set(["range", "fridge", "dishwasher", "range_hood", "toilet", "bathtub", "shower", "kitchen_sink", "washbasin", "wall_oven", "oven", "wine_cooler", "washing_machine", "dryer"]);
const elev = (it: TrayItem) => !!it.cab || ELEV.has(it.kind);
const dims = (it: TrayItem): [number, number] => {
  const s = CATALOG[it.kind], w = it.w ?? s?.w ?? 600;
  return elev(it) ? [w, it.h ?? s?.h ?? 900] : [w, it.d ?? s?.d ?? 600];
};

/** A line drawing of one thing, k px per mm, centred on the bottom of a box bw x bh px. */
function Drawing({ it, k, bw, bh }: { it: TrayItem; k: number; bw: number; bh: number }) {
  const [W, H] = dims(it), w = W * k, h = H * k, x0 = (bw - w) / 2, y0 = elev(it) ? bh - 2 - h : (bh - h) / 2;
  const line = { fill: "none", stroke: "currentColor", strokeWidth: 1, vectorEffect: "non-scaling-stroke" as const };
  let body: ReactNode;
  if (it.cab) {
    const c = it.cab, toe = toeOf(c) * k, bare = c.fam.startsWith("filler") || c.fam.startsWith("panel") || c.fam === "valance";
    const fronts = bare ? [] : frontsOf(c, W, H - toeOf(c));
    const up = famOf(c.fam).zone === "wall";
    body = (
      <>
        {toe > 0 && <line x1={x0 + 1.5} x2={x0 + w - 1.5} y1={y0 + h} y2={y0 + h} {...line} />}
        <rect x={x0} y={y0} width={w} height={h - toe} {...line} />
        {fronts.map((fr, i) => {
          const fx = x0 + fr.x * k, fy = y0 + h - toe - (fr.y + fr.h) * k, fw = fr.w * k, fh = fr.h * k;
          const swing = fr.t === "door" || fr.t === "glass" || fr.t === "mirror";
          const ox = fr.hinge === "R" ? fx : fx + fw, hx = fr.hinge === "R" ? fx + fw : fx;
          return (
            <g key={i}>
              <rect x={fx} y={fy} width={fw} height={fh} {...line} strokeOpacity={0.8} />
              {swing && fw > 4 && <path d={`M${ox} ${fy}L${hx} ${fy + fh / 2}L${ox} ${fy + fh}`} {...line} strokeOpacity={0.45} strokeDasharray="2 2" />}
              {fr.t === "drawer" && fw > 4 && <line x1={fx + fw / 2 - Math.min(4, fw / 5)} x2={fx + fw / 2 + Math.min(4, fw / 5)} y1={fy + Math.min(2.5, fh / 3)} y2={fy + Math.min(2.5, fh / 3)} {...line} />}
              {fr.t === "open" && [1, 2].map((s) => <line key={s} x1={fx} x2={fx + fw} y1={fy + (fh * s) / 3} y2={fy + (fh * s) / 3} {...line} strokeOpacity={0.6} />)}
              {fr.t === "oven" && <rect x={fx + fw * 0.15} y={fy + fh * 0.3} width={fw * 0.7} height={fh * 0.45} {...line} strokeOpacity={0.6} />}
              {fr.t === "glass" && <line x1={fx + fw * 0.25} x2={fx + fw * 0.55} y1={fy + fh * 0.55} y2={fy + fh * 0.25} {...line} strokeOpacity={0.4} />}
            </g>
          );
        })}
        {c.counter && <line x1={x0 - 1} x2={x0 + w + 1} y1={y0 - 1} y2={y0 - 1} {...line} strokeWidth={2} />}
        {c.crown && !up && <line x1={x0 - 1} x2={x0 + w + 1} y1={y0 - 1} y2={y0 - 1} {...line} />}
        {c.crown && up && <line x1={x0 - 1} x2={x0 + w + 1} y1={y0 - 1.5} y2={y0 - 1.5} {...line} />}
      </>
    );
  } else if (elev(it)) {
    const r = (fx: number, fy: number, fw: number, fh: number, o = 1) => <rect x={x0 + fx * w} y={y0 + fy * h} width={fw * w} height={fh * h} {...line} strokeOpacity={o} />;
    const extra: Record<string, ReactNode> = {
      fridge: <>{r(0, 0, 1, 0.33)}<line x1={x0 + w * 0.12} x2={x0 + w * 0.12} y1={y0 + h * 0.4} y2={y0 + h * 0.55} {...line} /></>,
      range: <>{r(0, 0, 1, 0.1)}{r(0.12, 0.3, 0.76, 0.45, 0.7)}</>,
      wall_oven: r(0.12, 0.25, 0.76, 0.5, 0.7), oven: r(0.12, 0.25, 0.76, 0.5, 0.7),
      dishwasher: r(0, 0, 1, 0.14),
      range_hood: <path d={`M${x0} ${y0 + h}L${x0 + w * 0.3} ${y0}L${x0 + w * 0.7} ${y0}L${x0 + w} ${y0 + h}`} {...line} />,
      toilet: <>{r(0.1, 0, 0.8, 0.4)}<path d={`M${x0 + w * 0.05} ${y0 + h * 0.48}L${x0 + w * 0.95} ${y0 + h * 0.48}L${x0 + w * 0.7} ${y0 + h}L${x0 + w * 0.3} ${y0 + h}Z`} {...line} /></>,
      bathtub: <path d={`M${x0} ${y0 + h * 0.15}L${x0 + w} ${y0 + h * 0.15}`} {...line} />,
      shower: <><path d={`M${x0 + w * 0.5} ${y0}L${x0 + w * 0.5} ${y0 + h}`} {...line} strokeDasharray="2 2" strokeOpacity={0.5} /><path d={`M${x0 + w * 0.2} ${y0 + h * 0.12}l${w * 0.12} 0`} {...line} /></>,
      kitchen_sink: <path d={`M${x0 + w * 0.15} ${y0}L${x0 + w * 0.15} ${y0 - Math.min(6, h * 0.4)}L${x0 + w * 0.3} ${y0 - Math.min(6, h * 0.4)}`} {...line} />,
      washing_machine: <circle cx={x0 + w / 2} cy={y0 + h * 0.58} r={Math.min(w, h) * 0.28} {...line} />,
      dryer: <circle cx={x0 + w / 2} cy={y0 + h * 0.58} r={Math.min(w, h) * 0.28} {...line} />,
    };
    const shape = it.kind === "range_hood" ? null : it.kind === "shower" ? <rect x={x0} y={y0} width={w} height={h} {...line} strokeOpacity={0.6} /> : <rect x={x0} y={y0} width={w} height={h} rx={it.kind === "bathtub" ? 3 : 1} {...line} />;
    body = <>{shape}{extra[it.kind]}</>;
  } else {
    // from above: the footprint, its front marked
    body = <><rect x={x0} y={y0} width={w} height={h} rx={Math.min(3, w / 6, h / 6)} {...line} /><line x1={x0 + w * 0.2} x2={x0 + w * 0.8} y1={y0 + h - 2} y2={y0 + h - 2} {...line} strokeOpacity={0.35} /></>;
  }
  return <svg width={bw} height={bh} className="shrink-0" aria-hidden>{body}</svg>;
}

/** One px-per-mm for a whole list, so a 9" cabinet looks a quarter of a 36" one. */
const scaleFor = (list: TrayItem[], bw: number, bh: number) => {
  const mw = Math.max(1, ...list.map((it) => dims(it)[0])), mh = Math.max(1, ...list.map((it) => dims(it)[1]));
  return Math.min((bw - 6) / mw, (bh - 6) / mh);
};

function Card({ it, k, on, units, where, onPick }: { it: TrayItem; k: number; on: boolean; units: Units; where?: string; onPick: () => void }) {
  const [W, H] = dims(it);
  const size = `${fmtLen(W, units)} × ${fmtLen(H, units)}`;
  return (
    <button onClick={onPick} title={`${it.code ? `${it.code}, ` : ""}${itemLabel(it)}: ${fmtLen(W, units)} wide, ${fmtLen(it.d ?? CATALOG[it.kind]?.d ?? 600, units)} deep${it.h ? `, ${fmtLen(it.h, units)} high` : ""}`}
      className={`flex flex-col items-center gap-0.5 rounded-[3px] border px-1 pt-1.5 pb-1 text-center ${on ? "border-accent bg-panel-2 text-accent" : "border-line text-muted hover:border-muted hover:text-text"}`}>
      <Drawing it={it} k={k} bw={76} bh={52} />
      {it.code && <span className={`font-mono text-[12.5px] leading-tight ${on ? "text-accent" : "text-text"}`}>{it.code}</span>}
      <span className={`block w-full truncate text-[11.5px] leading-tight ${it.code ? "" : on ? "text-accent" : "text-text"}`}>{itemLabel(it)}</span>
      <span className="block w-full truncate text-[11px] leading-tight text-muted">{where ?? size}</span>
    </button>
  );
}

const ICONS: Record<TopId, ReactNode> = {
  kitchen: <><rect x="4" y="20" width="40" height="16" /><path d="M4 20h40M17 24v12M30 24v12M10 4h28v10H10zM24 4v10" /></>,
  bath: <><path d="M4 22h40v6a8 8 0 0 1-8 8H12a8 8 0 0 1-8-8z" /><path d="M10 22V9a4 4 0 0 1 8 0" /></>,
  rooms: <><path d="M6 24v-6a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v6" /><rect x="3" y="22" width="42" height="10" rx="2" /><path d="M8 32v4M40 32v4" /></>,
  other: <><rect x="10" y="4" width="28" height="32" rx="2" /><circle cx="24" cy="22" r="8" /><path d="M14 9h6" /></>,
};

export function CatalogTray({ armed, onPick, startRoom, units = "ft" }: { armed: TrayItem | null; onPick: (it: TrayItem) => void; startRoom?: string | null; units?: Units }) {
  const stdv = useStandards();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tops = useMemo(() => trayTops(), [stdv]);
  const [path, setPathRaw] = useState<string>(() => last ?? startRoom ?? "");
  const [q, setQ] = useState("");
  const setPath = (p: string) => { last = p; setPathRaw(p); setQ(""); };
  const [topId, secId] = path.split("/") as [TopId | "", string | undefined];
  const top = tops.find((t) => t.id === topId) ?? null;
  const sec: TraySection | null = top?.sections.find((s) => s.id === secId) ?? null;
  const found = q.trim() ? traySearch(tops, q) : null;
  const pick = (it: TrayItem) => onPick(it);

  const crumb = [
    <button key="f" className={`hover:text-text ${top ? "text-muted" : "text-text"}`} onClick={() => setPath("")}>Furniture</button>,
    ...(top ? [<span key="s1" className="text-line">/</span>, <button key="t" className={`hover:text-text ${sec ? "text-muted" : "text-text"}`} onClick={() => setPath(top.id)}>{top.label}</button>] : []),
    ...(sec ? [<span key="s2" className="text-line">/</span>, <span key="c" className="text-text">{sec.label}</span>] : []),
  ];

  let body: ReactNode;
  if (found) {
    const list = found.slice(0, 120);
    body = list.length ? (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1">
        {list.map(({ item, where }, i) => <Card key={i} it={item} k={scaleFor([item], 76, 52)} on={sameItem(armed, item)} units={units} where={where} onPick={() => pick(item)} />)}
      </div>
    ) : <p className="text-muted text-[13px] py-2">Nothing by that name. Try a code like B18 or W3030, or a word like sink or sofa.</p>;
  } else if (sec) {
    const items = sectionItems(sec), k = scaleFor(items, 76, 52);
    // the section's items in runs under their small headings
    const runs: { sub?: string; items: TrayItem[] }[] = [];
    for (const it of items) { if (it.sub || !runs.length) runs.push({ sub: it.sub, items: [] }); runs[runs.length - 1].items.push(it); }
    body = (
      <div className="space-y-2">
        {sec.note && <p className="text-muted text-[12.5px] leading-snug">{sec.note}</p>}
        {runs.map((r, ri) => (
          <div key={ri}>
            {r.sub && <p className="text-[12px] text-muted mb-1">{r.sub}</p>}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1">
              {r.items.map((it, i) => <Card key={i} it={it} k={k} on={sameItem(armed, it)} units={units} onPick={() => pick(it)} />)}
            </div>
          </div>
        ))}
      </div>
    );
  } else if (top) {
    body = (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
        {top.sections.map((s) => {
          const items = sectionItems(s), first = items.find((it) => it.cab) ?? items[0];
          const n = items.length;
          return (
            <button key={s.id} onClick={() => setPath(`${top.id}/${s.id}`)} className="flex items-center gap-2 rounded-[3px] border border-line px-2 py-1.5 text-left text-muted hover:border-muted hover:text-text">
              {first && <Drawing it={first} k={scaleFor([first], 44, 40)} bw={44} bh={40} />}
              <span className="min-w-0 leading-tight">
                <span className="block text-[13px] text-text">{s.label}</span>
                <span className="block text-[11.5px] text-muted">{n} {n === 1 ? "pick" : "picks"}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  } else {
    body = (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {tops.map((t) => (
          <button key={t.id} onClick={() => setPath(t.id)} className="flex items-center gap-3 rounded-[3px] border border-line px-3 py-3 text-left text-muted hover:border-muted hover:text-text">
            <svg width="48" height="40" viewBox="0 0 48 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" className="shrink-0" aria-hidden>{ICONS[t.id]}</svg>
            <span className="min-w-0 leading-tight">
              <span className="block text-[15px] text-text">{t.label}</span>
              <span className="block text-[11.5px] text-muted leading-snug">{t.blurb}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="border-t border-line bg-panel px-3 py-2 space-y-2" aria-label="Catalogue">
      <div className="flex items-center gap-2">
        {top && !found && <button className="chip !h-7 shrink-0" onClick={() => setPath(sec ? top.id : "")} aria-label="Back">← Back</button>}
        <div className="flex items-center gap-1.5 text-[13px] min-w-0 truncate">{found ? <span className="text-text">{found.length} found</span> : crumb}</div>
        <input className="input !h-8 !w-52 shrink-0 ml-auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: B18, W3030, sink, sofa" aria-label="Search the catalogue" />
      </div>
      <div className="max-h-[260px] overflow-y-auto scroll-thin">{body}</div>
    </div>
  );
}
