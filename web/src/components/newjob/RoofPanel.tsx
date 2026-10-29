"use client";
// The house as a whole: the roof's shape, how steep it is (rise in 12, like a framing square, or
// degrees), how far the eaves stick out, and how high the foundation stands above the ground. Each starts
// at the company's standard; a typed value is kept on the sketch and wins over it.
import { std, useStandards } from "@/lib/plan/standards";
import type { Sketch } from "@/lib/plan/sketch";
import { fmtLen, parseLength, roundLen, type Units } from "@/lib/plan/units";

const SHAPES = [["hip", "Hip"], ["gable", "Gable"], ["shed", "Shed"], ["flat", "Flat"]] as const;
const toDeg = (rise: number) => Math.round((Math.atan(rise / 12) * 180 / Math.PI) * 10) / 10;
const toRise = (deg: number) => Math.round(Math.tan((deg * Math.PI) / 180) * 12 * 2) / 2;

export function RoofPanel({ sketch, units = "ft", onChange, onClose }: {
  sketch: Sketch; units?: Units;
  /** `history`: false while a slider is moving (the change before it was already kept for undo) */
  onChange: (s: Sketch, history?: boolean) => void; onClose?: () => void;
}) {
  useStandards();
  const shape = SHAPES.some(([k]) => k === sketch.roof) ? sketch.roof! : "hip";
  const flat = shape === "flat";
  const pitch = sketch.roof_pitch_deg ?? std("roof.pitch");
  const eave = sketch.eave_mm ?? std(flat ? "roof.flatOverhang" : "roof.eave");
  const plinth = sketch.plinth_mm ?? std("house.plinth");
  const set = (p: Partial<Sketch>, history = true) => onChange({ ...sketch, ...p }, history);
  const len = (id: string, label: string, v: number, own: boolean, put: (mm: number | undefined) => void, max: number) => (
    <div>
      <label className="label !mb-1" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-2">
        <input id={id} key={`${id}-${v}`} className={`input !h-9 !w-28 font-mono ${own ? "!border-accent" : ""}`} defaultValue={fmtLen(v, units)}
          onBlur={(e) => { const mm = parseLength(e.target.value, units); if (mm != null && mm <= max) put(roundLen(mm, units)); else e.target.value = fmtLen(v, units); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        {own && <button className="text-[12px] text-muted underline" onClick={() => put(undefined)}>Use my standard</button>}
      </div>
    </div>
  );
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <p className="eyebrow">Roof and foundation</p>
        {onClose && <button className="btn btn-sm btn-ghost ml-auto" onClick={onClose}>Done</button>}
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Roof shape">
        {SHAPES.map(([k, l]) => <button key={k} onClick={() => set({ roof: k })} aria-pressed={shape === k} className={`chip !h-7 ${shape === k ? "!text-accent !border-accent" : ""}`}>{l}</button>)}
      </div>
      {!flat && (
        <div>
          <label className="label !mb-1" htmlFor="pitch">Pitch</label>
          <input id="pitch" type="range" min={1} max={18} step={0.5} className="w-full" value={toRise(pitch)} onPointerDown={() => set({})}
            onChange={(e) => set({ roof_pitch_deg: toDeg(+e.target.value) }, false)} aria-label="Pitch, rise in 12" />
          <div className="flex items-center gap-2">
            <input key={`rise-${pitch}`} className={`input !h-9 !w-20 font-mono ${sketch.roof_pitch_deg != null ? "!border-accent" : ""}`} defaultValue={`${toRise(pitch)}/12`} aria-label="Rise in 12"
              onBlur={(e) => { const r = parseFloat(e.target.value); if (r > 0 && r <= 24) set({ roof_pitch_deg: toDeg(r) }); else e.target.value = `${toRise(pitch)}/12`; }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
            <input key={`deg-${pitch}`} className="input !h-9 !w-20 font-mono" defaultValue={`${pitch}°`} aria-label="Pitch in degrees"
              onBlur={(e) => { const d = parseFloat(e.target.value); if (d > 0 && d < 70) set({ roof_pitch_deg: Math.round(d * 10) / 10 }); else e.target.value = `${pitch}°`; }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
            {sketch.roof_pitch_deg != null && <button className="text-[12px] text-muted underline" onClick={() => set({ roof_pitch_deg: undefined })}>Use my standard</button>}
          </div>
        </div>
      )}
      {len("eave", flat ? "Overhang" : "Eaves overhang", eave, sketch.eave_mm != null, (mm) => set({ eave_mm: mm }), 1500)}
      {len("plinth", "Foundation above the ground", plinth, sketch.plinth_mm != null, (mm) => set({ plinth_mm: mm }), 2500)}
    </div>
  );
}
