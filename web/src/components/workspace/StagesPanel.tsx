"use client";
// The job's stages, copied from the company template when the job was made. Each job can then add,
// rename, reorder or remove its own stages without touching the template. Stages are also layers: pick
// one and the map shows only what belongs to it (pins, tasks, materials); anything without a stage is
// on the whole house.
import { useState } from "react";
import type { JobStage, StageStatus } from "@/lib/data/types";
import { useFeedback } from "@/components/ui/feedback";

const NEXT: Record<StageStatus, StageStatus> = { not_started: "active", active: "done", done: "not_started" };
const LABEL: Record<StageStatus, string> = { not_started: "Not started", active: "In progress", done: "Done" };

export function StageStrip({ stages }: { stages: JobStage[] }) {
  if (!stages.length) return null;
  return (
    <div className="flex gap-1 w-full" aria-label="Stages">
      {stages.map((s) => (
        <div key={s.id} title={`${s.name}: ${LABEL[s.status]}`} className={`h-1.5 flex-1 rounded-[1px] ${s.status === "done" ? "bg-green" : s.status === "active" ? "bg-accent" : "bg-panel-3"}`} />
      ))}
    </div>
  );
}

/** The layer for everything that has no stage. */
export const HOUSE_LAYER = "house";

export function StagesPanel({ stages, onStatus, onAdd, onRename, onDelete, onMove, layer, onLayer, counts }: {
  stages: JobStage[];
  /** the stage shown on the map (or the whole house), null for everything */
  layer: string | null;
  onLayer: (id: string | null) => void;
  /** open things on each stage, and on the whole house */
  counts: Map<string, number>;
  onStatus: (id: string, s: StageStatus) => Promise<void>;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, dir: -1 | 1) => Promise<void>;
}) {
  const { confirm } = useFeedback();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const done = stages.filter((s) => s.status === "done").length;

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">Stages</h2>
          <span className="text-muted text-sm">{done} of {stages.length} done</span>
        </div>
        <div className="mt-2"><StageStrip stages={stages} /></div>
        <p className="text-[12.5px] text-muted mt-2">Pick a stage to see only its pins, tasks and materials on the map.</p>
      </div>
      <button onClick={() => onLayer(layer === HOUSE_LAYER ? null : HOUSE_LAYER)} aria-pressed={layer === HOUSE_LAYER}
        className={`card !rounded-[3px] w-full px-3 py-2.5 flex items-center gap-3 text-left ${layer === HOUSE_LAYER ? "!border-accent bg-panel-3" : "hover:bg-panel-2"}`}>
        <span className="w-7 h-7 grid place-items-center shrink-0 text-muted">⌂</span>
        <span className="flex-1 min-w-0"><span className="block text-[14px]">Whole house</span><span className="block text-[12px] text-muted">Anything not on a stage</span></span>
        <Count n={counts.get(HOUSE_LAYER) ?? 0} />
      </button>
      <ol className="space-y-1.5">
        {stages.map((s, i) => (
          <li key={s.id} className={`card !rounded-[3px] px-3 py-2.5 flex items-center gap-3 ${layer === s.id ? "!border-accent bg-panel-3" : s.status === "active" ? "!border-accent/60" : ""}`}>
            <button onClick={() => onStatus(s.id, NEXT[s.status])} title={`${LABEL[s.status]}. Click to change.`}
              className={`w-7 h-7 rounded-[2px] border-2 grid place-items-center shrink-0 text-[12px] font-mono font-bold ${s.status === "done" ? "bg-green border-green text-[#0c1a12]" : s.status === "active" ? "border-accent text-accent" : "border-muted text-muted"}`}>
              {s.status === "done" ? "✓" : i + 1}
            </button>
            {editing === s.id ? (
              <form className="flex-1" onSubmit={async (e) => { e.preventDefault(); await onRename(s.id, draft); setEditing(null); }}>
                <input autoFocus className="input !h-8" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={async () => { await onRename(s.id, draft); setEditing(null); }} />
              </form>
            ) : (
              <button className="flex-1 text-left min-w-0" onClick={() => onLayer(layer === s.id ? null : s.id)} aria-pressed={layer === s.id} title={layer === s.id ? "Show everything again" : "Show only this stage on the map"}>
                <span className={`block text-[14px] truncate ${s.status === "done" ? "text-muted" : ""}`}>{s.name}</span>
                <span className="block text-[12px] text-muted">{LABEL[s.status]}</span>
              </button>
            )}
            <Count n={counts.get(s.id) ?? 0} />
            <div className="flex items-center gap-0.5 shrink-0 text-muted">
              <button className="w-7 h-7 rounded-[2px] hover:bg-panel-3" onClick={() => { setEditing(s.id); setDraft(s.name); }} title="Rename">✎</button>
              <button className="w-7 h-7 rounded-[2px] hover:bg-panel-3 disabled:opacity-30" disabled={i === 0} onClick={() => onMove(s.id, -1)} title="Move up">↑</button>
              <button className="w-7 h-7 rounded-[2px] hover:bg-panel-3 disabled:opacity-30" disabled={i === stages.length - 1} onClick={() => onMove(s.id, 1)} title="Move down">↓</button>
              <button className="w-7 h-7 rounded-[2px] hover:bg-panel-3 hover:text-red" onClick={async () => { if (await confirm({ title: `Remove “${s.name}”?`, body: "It comes off this job's stages. Pins on this stage stay.", confirm: "Remove stage", danger: true })) onDelete(s.id); }} title="Remove">×</button>
            </div>
          </li>
        ))}
      </ol>
      <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; await onAdd(name); setName(""); }}>
        <input className="input" placeholder="Add a stage for this job" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={!name.trim()}>Add</button>
      </form>
      <p className="text-[12.5px] text-muted">Changes here only affect this job. Edit the starting stages for new jobs under Company › Stage templates.</p>
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className={`shrink-0 min-w-[22px] h-[20px] px-1.5 rounded-[2px] text-[11.5px] font-mono font-bold grid place-items-center ${n ? "bg-accent text-accent-ink" : "text-muted"}`} title={`${n} open`}>{n}</span>;
}
