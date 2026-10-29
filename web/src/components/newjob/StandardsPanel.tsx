"use client";
// Standards: the company's own default sizes and check limits, grouped, each one typed in feet and
// inches (or degrees, a count, square feet). A changed number shows the usual one beside it and can be
// put back. Everything the drawing tool sizes or checks reads from here (lib/plan/standards.ts).
import { useEffect, useState } from "react";
import { allStandards, isChanged, setStd, std, useStandards, type StdDef } from "@/lib/plan/standards";
import { fmtLen, parseLength, type Units } from "@/lib/plan/units";

const show = (d: StdDef, v: number, u: Units) =>
  d.unit === "len" ? fmtLen(v, u) : d.unit === "deg" ? `${v}°` : d.unit === "sqft" ? `${v} ft²` : d.unit === "pct" ? `${v}%` : String(v);
const read = (d: StdDef, s: string, u: Units) => {
  if (d.unit === "len") return parseLength(s, u);
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function StandardsPanel({ units = "ft", onClose, focus }: { units?: Units; onClose: () => void; /** a standard's key: open on just that one (from a check's "The rule") */ focus?: string | null }) {
  useStandards();
  const [q, setQ] = useState(() => allStandards().find((d) => d.key === focus)?.label ?? "");
  useEffect(() => { const d = allStandards().find((x) => x.key === focus); if (d) setQ(d.label); }, [focus]);
  const list = allStandards().filter((d) => !q || `${d.group} ${d.label}`.toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(list.map((d) => d.group))];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="eyebrow">Your standards</p>
        <button className="btn btn-sm btn-ghost ml-auto" onClick={onClose}>Done</button>
      </div>
      <p className="text-muted leading-snug">The sizes new things start at and the limits the checks warn at. Change any of them to how your company builds.</p>
      <input className="input !h-9" placeholder="Find a standard" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a standard" />
      {groups.map((g) => (
        <div key={g} className="space-y-1.5">
          <p className="label !mb-0 pt-1">{g}</p>
          {list.filter((d) => d.group === g).map((d) => (
            <div key={d.key} className={d.key === focus ? "rounded-md ring-1 ring-accent p-1.5 -m-1.5" : undefined}>
              <div className="flex items-center gap-2">
                <label className="flex-1 min-w-0" htmlFor={`std-${d.key}`}>{d.label}</label>
                <input id={`std-${d.key}`} key={`${d.key}-${std(d.key)}`} className={`input !h-8 !w-28 text-right font-mono ${isChanged(d.key) ? "!border-accent" : ""}`}
                  defaultValue={show(d, std(d.key), units)}
                  onBlur={(e) => { const v = read(d, e.target.value, units); if (v != null && v >= 0) setStd(d.key, d.unit === "len" ? Math.round(v * 10) / 10 : v); else e.target.value = show(d, std(d.key), units); }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              </div>
              {isChanged(d.key) && <button className="text-[12px] text-muted underline" onClick={() => setStd(d.key, null)}>Usual: {show(d, d.value, units)}. Put it back</button>}
              {d.help && <p className="text-[12px] text-muted leading-snug">{d.help}</p>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
