"use client";
// One job: the plan on the left, the side panel on the right (details, pins, stages, plan). All state
// lives here and every change goes through the WorkspaceApi, so the same screen runs on the server
// actions or on the in-memory preview.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementStatus } from "@/lib/plan/types";
import type { Pin } from "@/lib/data/types";
import { findElement, roomOf } from "@/lib/plan/geometry";
import { PlanViewer, type Level } from "@/components/plan/PlanViewer";
import type { ColorMode } from "@/components/plan/FloorCanvas";
import type { WorkspaceApi, WorkspaceData } from "./api";
import { Inspector } from "./Inspector";
import { PinDetail, PinForm, PinsList } from "./PinsPanel";
import { PlanPanel, UploadBox } from "./PlanPanel";
import { StagesPanel, StageStrip } from "./StagesPanel";

type Tab = "details" | "pins" | "stages" | "plan";

export function JobWorkspace({ data, api, onAllJobs }: { data: WorkspaceData; api: WorkspaceApi; onAllJobs: () => void }) {
  const [plan, setPlan] = useState(data.plan);
  const [runs, setRuns] = useState(data.runs);
  const [stages, setStages] = useState(data.stages);
  const [pins, setPins] = useState(data.pins);
  const [states, setStates] = useState(() => new Map(data.states.map((s) => [s.element_id, s.status] as [string, ElementStatus])));
  const [level, setLevelRaw] = useState<Level>({ kind: "exterior" });
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("type");
  const [pinMode, setPinMode] = useState(false);
  const [draft, setDraft] = useState<{ floorId: string; x: number | null; y: number | null; elementId: string | null } | null>(null);
  const [tab, setTab] = useState<Tab>(data.plan ? "details" : "plan");
  const [flyTo, setFlyTo] = useState<{ ids: string[]; n: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const job = data.job;

  const say = useCallback((m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 3200); }, []);
  const guard = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try { return await fn(); } catch (e) { say(e instanceof Error ? e.message : "Something went wrong."); }
  }, [say]);

  // poll while the plan reader is working
  const working = runs.some((r) => r.status === "queued" || r.status === "running");
  useEffect(() => {
    if (!working) return;
    const t = setInterval(async () => {
      const fresh = await api.refreshPlan().catch(() => null);
      if (!fresh) return;
      setRuns(fresh.runs);
      if (fresh.plan && fresh.plan.id !== plan?.id) {
        setPlan(fresh.plan);
        setLevelRaw({ kind: "exterior" });
        setSelected(null);
        say(`Plan ready: version ${fresh.plan.version}`);
        setTab(fresh.plan.data.questions.some((q) => !q.answer) ? "plan" : "details");
      }
    }, 2500);
    return () => clearInterval(t);
  }, [working, api, plan?.id, say]);

  const setLevel = useCallback((l: Level) => {
    setLevelRaw(l);
    setPinMode(false);
    setSelectedPin(null);
    setSelected(l.kind === "room" ? l.roomId : null);
    if (l.kind === "room") setTab("details");
  }, []);

  const select = useCallback((id: string | null, fly = false) => {
    setSelected(id);
    setSelectedPin(null);
    setDraft(null);
    if (id) {
      setTab("details");
      if (fly) setFlyTo({ ids: [id], n: Date.now() });
    }
  }, []);

  /** Show a pin: open its floor (and room), select it and switch to its card. */
  const showPin = useCallback((id: string) => {
    const pin = pins.find((p) => p.id === id);
    setSelectedPin(id);
    setSelected(null);
    setDraft(null);
    setTab("pins");
    if (!pin || !plan) return;
    const e = pin.element_id ? findElement(plan.data, pin.element_id) : null;
    const floorId = e?.floor.id ?? pin.floor_id;
    if (!floorId) return;
    const rid = e ? roomOf(e) : null;
    if (level.kind === "wall" && e && (e.kind === "wall" || e.kind === "opening")) return; // already facing it
    setLevelRaw(rid ? { kind: "room", floorId, roomId: rid } : { kind: "floor", floorId });
  }, [pins, plan, level]);

  /** Point at elements from a question without leaving the current panel. */
  const showElements = useCallback((ids: string[]) => {
    if (!plan || !ids.length) return;
    const e = findElement(plan.data, ids[0]);
    if (!e) return;
    setLevelRaw({ kind: "floor", floorId: e.floor.id });
    setSelected(ids[0]);
    setSelectedPin(null);
    setFlyTo({ ids, n: Date.now() });
  }, [plan]);

  const placePin = useCallback((floorId: string, x: number | null, y: number | null, elementId: string | null) => {
    setPinMode(false);
    setSelectedPin(null);
    setDraft({ floorId, x: x == null ? null : Math.round(x), y: y == null ? null : Math.round(y), elementId });
    setTab("pins");
  }, []);

  const setStatus = useCallback(async (id: string, s: ElementStatus | null) => {
    setStates((m) => { const n = new Map(m); if (s) n.set(id, s); else n.delete(id); return n; });
    await guard(() => api.setElementState(id, s));
  }, [api, guard]);

  const updatePin = useCallback(async (id: string, input: Parameters<WorkspaceApi["updatePin"]>[1]) => {
    await api.updatePin(id, input);
    setPins((list) => list.map((p) => (p.id === id ? { ...p, ...input, closed_at: input.status === "done" ? new Date().toISOString() : input.status ? null : p.closed_at } as Pin : p)));
  }, [api]);

  const stageOp = useCallback(async (fn: () => Promise<typeof stages>) => {
    const next = await guard(fn);
    if (next) setStages(next);
  }, [guard]);

  const pin = selectedPin ? pins.find((p) => p.id === selectedPin) ?? null : null;
  const openPins = pins.filter((p) => p.status !== "done").length;
  const questions = plan?.data.questions.filter((q) => !q.answer).length ?? 0;
  const currentStage = stages.find((s) => s.status === "active");
  const lastRun = runs[0];

  const panel = useMemo(() => {
    if (tab === "pins") {
      if (draft) return <PinForm plan={plan?.data ?? null} draft={draft} stages={stages} onCancel={() => setDraft(null)} onCreate={async (input) => {
        const p = await api.createPin(input);
        setPins((l) => [...l, p]);
        setDraft(null);
        setSelectedPin(p.id);
        say(`Pin #${p.number} added`);
      }} />;
      if (pin) return <PinDetail pin={pin} plan={plan?.data ?? null} stages={stages} onBack={() => setSelectedPin(null)} onShow={() => showPin(pin.id)}
        onUpdate={(input) => updatePin(pin.id, input)}
        onDelete={async () => { await api.deletePin(pin.id); setPins((l) => l.filter((x) => x.id !== pin.id)); setSelectedPin(null); }}
        loadComments={() => api.listComments(pin.id)}
        addComment={async (body, photos) => {
          const c = await api.addComment(pin.id, body, photos);
          setPins((l) => l.map((x) => (x.id === pin.id ? { ...x, comment_count: c.length } : x)));
          return c;
        }} />;
      return <PinsList pins={pins} plan={plan?.data ?? null} onSelect={showPin} onNew={() => { if (level.kind === "exterior" && plan) setLevel({ kind: "floor", floorId: plan.data.floors[0].id }); setPinMode(true); say("Click the plan where the pin goes"); }} />;
    }
    if (tab === "stages") return (
      <StagesPanel stages={stages}
        onStatus={(id, s) => stageOp(() => api.setStageStatus(id, s))}
        onAdd={(n) => stageOp(() => api.addStage(n))}
        onRename={(id, n) => stageOp(() => api.renameStage(id, n))}
        onDelete={(id) => stageOp(() => api.deleteStage(id))}
        onMove={(id, d) => stageOp(() => api.moveStage(id, d))} />
    );
    if (tab === "plan") return (
      <PlanPanel plan={plan} runs={runs} aiAvailable={data.aiAvailable} onShow={showElements}
        onUpload={async (f) => { await api.uploadPlan(f); const r = await api.refreshPlan(); setRuns(r.runs); say("Reading the plan. This takes a minute or two."); }}
        onAnswer={async (a) => {
          if (!plan) return;
          await api.answer(plan.id, a);
          const r = await api.refreshPlan();
          setRuns(r.runs);
          if (r.plan) setPlan(r.plan);
          say("Thanks, the plan is being updated");
        }} />
    );
    if (!plan) return null;
    return <Inspector plan={plan.data} level={level} selected={selected} states={states} pins={pins} setLevel={setLevel}
      onSetStatus={setStatus} onSelect={select} onSelectPin={showPin}
      onAddPin={(id) => { const e = findElement(plan.data, id); if (e) placePin(e.floor.id, null, null, id); }} />;
  }, [tab, draft, pin, plan, stages, pins, runs, level, selected, states, api, data.aiAvailable, say, showPin, updatePin, stageOp, setLevel, setStatus, select, placePin, showElements]);

  const tabBtn = (t: Tab, label: string, badge?: number) => (
    <button key={t} onClick={() => { setTab(t); if (t !== "pins") setDraft(null); }} aria-selected={tab === t} role="tab"
      className={`flex-1 h-11 text-[12px] font-display font-semibold tracking-[0.1em] uppercase border-b-2 inline-flex items-center justify-center gap-1.5 ${tab === t ? "border-accent text-text" : "border-transparent text-muted hover:text-text"}`}>
      {label}{badge ? <span className={`text-[10.5px] rounded-full px-1.5 min-w-[18px] ${t === "plan" ? "bg-accent text-accent-ink" : "bg-panel-3 text-text"}`}>{badge}</span> : null}
    </button>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 border-b border-line bg-panel px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="min-w-0">
          <h1 className="font-display text-[18px] font-bold leading-tight truncate">{job.name}</h1>
          <p className="text-[12.5px] text-muted truncate">{[job.address, job.client_name].filter(Boolean).join(" · ") || "No address yet"}</p>
        </div>
        <div className="flex-1 min-w-[180px] max-w-[420px]">
          <div className="flex items-baseline gap-2 text-[12.5px] mb-1">
            <span className="text-muted">Stage</span>
            <span className="truncate">{currentStage?.name ?? (!stages.length ? "No stages" : stages.every((s) => s.status === "done") ? "All done" : stages.some((s) => s.status === "done") ? `Next: ${stages.find((s) => s.status !== "done")!.name}` : "Not started")}</span>
            <span className="ml-auto text-muted shrink-0">{stages.filter((s) => s.status === "done").length}/{stages.length}</span>
          </div>
          <StageStrip stages={stages} />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {working && <span className="chip"><span className="dot bg-accent animate-pulse" />Reading plan…</span>}
          {lastRun?.status === "failed" && !working && <span className="chip text-red">Last read failed</span>}
          <span className="chip">{openPins} open pin{openPins === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="relative h-[62vh] shrink-0 lg:shrink lg:h-auto lg:flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-line">
          {plan ? (
            <PlanViewer plan={plan.data} level={level} setLevel={setLevel} selected={selected} onSelect={(id) => select(id)} selectedPin={selectedPin} onSelectPin={showPin}
              states={states} pins={pins} colorMode={colorMode} setColorMode={setColorMode} pinMode={pinMode} setPinMode={setPinMode} onPlacePin={placePin}
              flyTo={flyTo} onAllJobs={onAllJobs} jobName={job.name} />
          ) : (
            <div className="h-full grid place-items-center p-6 bg-[#0f141a]">
              <div className="max-w-md w-full text-center">
                <p className="font-display text-xl font-bold mb-1">{working ? "Reading the plan…" : "No plan yet"}</p>
                <p className="text-muted mb-5">{working ? "Walls, rooms, doors and windows are being found and numbered. This takes a minute or two." : "Upload the AutoCAD file, a PDF or a photo of the drawing. It becomes a clickable plan."}</p>
                {!working && <UploadBox onUpload={async (f) => { await api.uploadPlan(f); const r = await api.refreshPlan(); setRuns(r.runs); }} />}
              </div>
            </div>
          )}
          {toast && <div role="status" className="absolute left-1/2 -translate-x-1/2 top-14 z-10 px-4 py-2 rounded-lg bg-[#1d242d] border border-line shadow-lg text-[14px]">{toast}</div>}
          {plan && questions > 0 && tab !== "plan" && (
            <button onClick={() => setTab("plan")} className="absolute left-1/2 -translate-x-1/2 bottom-3 z-10 btn btn-primary btn-sm shadow-lg">
              {questions} question{questions > 1 ? "s" : ""} about this plan
            </button>
          )}
        </div>
        <aside className="lg:w-[400px] shrink-0 flex flex-col min-h-0 bg-panel">
          <div role="tablist" className="flex border-b border-line shrink-0 px-2">
            {tabBtn("details", "Details")}
            {tabBtn("pins", "Pins", openPins)}
            {tabBtn("stages", "Stages")}
            {tabBtn("plan", "Plan", questions)}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">{panel}</div>
        </aside>
      </div>
    </div>
  );
}

