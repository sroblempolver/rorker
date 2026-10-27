"use client";
import { useState } from "react";
import type { StageTemplate } from "@/lib/data/types";
import { JOB_TYPES } from "@/lib/data/templates";
import { deleteTemplate, saveTemplate } from "../actions";
import { useFeedback } from "@/components/ui/feedback";

type Draft = { id?: string; name: string; job_type: string; stages: { name: string }[] };

function Editor({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const [t, setT] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (i: number, name: string) => setT({ ...t, stages: t.stages.map((s, j) => (j === i ? { name } : s)) });
  const move = (i: number, d: number) => {
    const s = [...t.stages];
    const [x] = s.splice(i, 1);
    s.splice(i + d, 0, x);
    setT({ ...t, stages: s });
  };
  return (
    <div className="card p-4 space-y-3">
      <div className="grid sm:grid-cols-[1fr_200px] gap-3">
        <input className="input" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="Template name" aria-label="Template name" />
        <select className="input" value={t.job_type} onChange={(e) => setT({ ...t, job_type: e.target.value })} aria-label="Job type">
          {JOB_TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
      </div>
      <ol className="space-y-1.5">
        {t.stages.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-6 text-right text-muted text-[13px]">{i + 1}</span>
            <input className="input !h-9" value={s.name} onChange={(e) => set(i, e.target.value)} aria-label={`Stage ${i + 1}`} />
            <button type="button" className="w-8 h-8 rounded hover:bg-panel-3 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
            <button type="button" className="w-8 h-8 rounded hover:bg-panel-3 disabled:opacity-30" disabled={i === t.stages.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
            <button type="button" className="w-8 h-8 rounded hover:bg-panel-3 hover:text-red" onClick={() => setT({ ...t, stages: t.stages.filter((_, j) => j !== i) })} title="Remove">×</button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-sm" onClick={() => setT({ ...t, stages: [...t.stages, { name: "" }] })}>Add stage</button>
      {err && <p className="text-red text-sm">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy} onClick={async () => {
          setBusy(true); setErr(null);
          try { await saveTemplate(t); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); }
          setBusy(false);
        }}>{busy ? "Saving…" : "Save template"}</button>
        <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

export function TemplateEditor({ templates }: { templates: StageTemplate[] }) {
  const { confirm } = useFeedback();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  return (
    <div className="space-y-3">
      {templates.map((t) => editing === t.id ? (
        <Editor key={t.id} initial={{ id: t.id, name: t.name, job_type: t.job_type, stages: t.stages.map((s) => ({ name: s.name })) }} onDone={() => setEditing(null)} />
      ) : (
        <div key={t.id} className="card p-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold">{t.name}</p>
            <p className="text-[13px] text-muted">{JOB_TYPES.find((x) => x.value === t.job_type)?.label} · {t.stages.length} stages</p>
            <p className="text-[13px] text-muted mt-1.5 line-clamp-2">{t.stages.map((s) => s.name).join(" → ")}</p>
          </div>
          <button className="btn btn-sm" onClick={() => setEditing(t.id)}>Edit</button>
          <button className="btn btn-sm btn-ghost hover:text-red" onClick={async () => { if (await confirm({ title: `Delete “${t.name}”?`, body: "Jobs that already use it keep their stages.", confirm: "Delete template", danger: true })) await deleteTemplate(t.id); }}>Delete</button>
        </div>
      ))}
      {editing === "new" ? <Editor initial={{ name: "", job_type: "renovation", stages: [{ name: "" }] }} onDone={() => setEditing(null)} />
        : <button className="btn" onClick={() => setEditing("new")}>New template</button>}
    </div>
  );
}
