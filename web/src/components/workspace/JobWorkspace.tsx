"use client";
// One job: the plan on the left, the side panel on the right (details, pins, stages, plan). All state
// lives here and every change goes through the WorkspaceApi, so the same screen runs on the server
// actions or on the in-memory preview.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementStatus } from "@/lib/plan/types";
import type { ElementEdit, ItemInput, JobItem, Pin, PinInput, PinKind } from "@/lib/data/types";
import { today } from "@/lib/dates";
import { PlanChat } from "./PlanChat";
import { applyEdits } from "@/lib/plan/edits";
import { findElement } from "@/lib/plan/geometry";
import { pinLevel } from "@/components/plan/pinLevel";
import { PlanViewer, type Level } from "@/components/plan/PlanViewer";
import { Assistant } from "@/components/assistant/Assistant";
import type { ColorMode } from "@/components/plan/FloorCanvas";
import type { PinTarget, ScreenPoint } from "@/components/plan/target";
import { TeamContext } from "@/components/team/context";
import type { WorkspaceApi, WorkspaceData } from "./api";
import { Inspector, ProjectSummary, type AddPin } from "./Inspector";
import { PinDetail, PinForm, PinsList, QuickPin, where } from "./PinsPanel";
import { PlanPanel, UploadBox } from "./PlanPanel";
import { ShareDialog } from "./ShareDialog";
import { StagesPanel, StageStrip } from "./StagesPanel";
import { AddMaterial, MaterialsPanel, blankLine, type BuyTarget } from "@/components/materials/MaterialsPanel";
import { parseQty, type Suggestion } from "@/lib/materials/suggest";
import { pinSummary, qtyText, type MaterialInput, type MaterialLine } from "@/lib/materials/types";

type Tab = "details" | "pins" | "buy" | "stages" | "plan";



export function JobWorkspace({ data, api, onAllJobs }: { data: WorkspaceData; api: WorkspaceApi; onAllJobs: () => void }) {
  const [plan, setPlan] = useState(data.plan);
  const [runs, setRuns] = useState(data.runs);
  const [stages, setStages] = useState(data.stages);
  const [pins, setPins] = useState(data.pins);
  const [items, setItems] = useState<JobItem[]>(data.items);
  const [edits, setEdits] = useState<Record<string, ElementEdit>>(data.edits);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [view3d, setView3d] = useState(data.can3d !== false);
  const [pinFilter, setPinFilter] = useState<{ kind: PinKind | "open"; n: number }>({ kind: "open", n: 0 });
  const [states, setStates] = useState(() => new Map(data.states.map((s) => [s.element_id, s.status] as [string, ElementStatus])));
  const [level, setLevelRaw] = useState<Level>({ kind: "site" });
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("type");
  const [pinMode, setPinMode] = useState(false);
  // a pin being made: `at` set means the quick card at that screen point, otherwise the full form
  const [draft, setDraft] = useState<(PinTarget & { at?: ScreenPoint; preset?: { kind: PinKind; title: string; tagged?: string[]; photo?: boolean } }) | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>(data.plan ? "details" : "plan");
  const [flyTo, setFlyTo] = useState<{ ids: string[]; n: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const job = data.job;
  // materials: lines on every job (so one add can split across jobs), the add sheet, the line to open
  const [mlines, setMlines] = useState<MaterialLine[]>(data.materials?.lines ?? []);
  const [buyDraft, setBuyDraft] = useState<{ target: BuyTarget | null; preset?: Partial<Suggestion> & { name?: string } } | null>(null);
  const [buyFocus, setBuyFocus] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });
  const [lastBuyer, setLastBuyer] = useState<string | null>(null);
  const mjobs = useMemo(() => data.materials?.jobs ?? [{ id: data.job.id, name: data.job.name, address: data.job.address }], [data.materials?.jobs, data.job]);
  useEffect(() => { void api.materials?.list().then(setMlines).catch(() => {}); }, [api]);
  // opening the add sheet or the list starts at the top
  useEffect(() => { if (tab === "buy") panelRef.current?.scrollTo(0, 0); }, [tab, buyDraft]);

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
        setLevelRaw({ kind: "site" });
        setSelected(null);
        say(`Plan ready: version ${fresh.plan.version}`);
        setTab(fresh.plan.data.questions.some((q) => !q.answer) ? "plan" : "details");
      }
    }, 2500);
    return () => clearInterval(t);
  }, [working, api, plan?.id, say]);

  // fresh data from outside (the assistant changed something): take it, keep where the person is
  const firstData = useRef(data);
  useEffect(() => {
    if (firstData.current === data) return;
    firstData.current = data;
    setPlan(data.plan); setRuns(data.runs); setStages(data.stages); setPins(data.pins); setItems(data.items); setEdits(data.edits);
    if (data.materials) setMlines(data.materials.lines);
    setStates(new Map(data.states.map((s) => [s.element_id, s.status] as [string, ElementStatus])));
  }, [data]);
  const [askOpen, setAskOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Esc puts the pin back
  useEffect(() => {
    if (!pinMode) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setPinMode(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [pinMode]);

  // the plan as it is now: what the reader found, plus everything moved or changed in the app
  const view = useMemo(() => (plan ? applyEdits(plan.data, edits) : null), [plan, edits]);

  const setLevel = useCallback((l: Level) => {
    setLevelRaw(l);
    setSelectedItem(null);
    setPinMode(false);
    setSelectedPin(null);
    setDraft((d) => (d?.at ? null : d));
    setSelected(l.kind === "room" ? l.roomId : null);
    if (l.kind === "room") setTab("details");
  }, []);

  const select = useCallback((id: string | null, fly = false) => {
    setSelected(id);
    setSelectedPin(null);
    setSelectedItem(null);
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
    setSelectedItem(null);
    setSelected(null);
    setDraft(null);
    setTab("pins");
    if (!pin || !plan) return;
    const to = pinLevel(plan.data, pin);
    if (!to) return;
    const e = pin.element_id ? findElement(plan.data, pin.element_id) : null;
    if (!pin.anchor && level.kind === "wall" && e && (e.kind === "wall" || e.kind === "opening")) return; // already facing it
    setLevelRaw(to);
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

  /** A click on the map with the pin tool (or right-click / long-press): quick card right there. */
  const placePin = useCallback((t: PinTarget, at: ScreenPoint) => {
    setPinMode(false);
    setSelectedPin(null);
    setDraft({ ...t, at });
  }, []);

  /** From the side panel (an element's actions): straight to the full form. */
  const addPin = useCallback((a: AddPin) => {
    setPinMode(false);
    setSelectedPin(null);
    setDraft({ floorId: a.floorId ?? null, x: null, y: null, elementId: a.elementId, anchor: a.anchor ?? null, preset: a.preset });
    setTab("pins");
  }, []);

  const createPin = useCallback(async (input: PinInput) => {
    const p = await api.createPin(input);
    setPins((l) => [...l, p]);
    setDraft(null);
    setSelectedPin(p.id);
    say(`Pin #${p.number} added`);
    return p;
  }, [api, say]);

  const setStatus = useCallback(async (id: string, s: ElementStatus | null) => {
    setStates((m) => { const n = new Map(m); if (s) n.set(id, s); else n.delete(id); return n; });
    await guard(() => api.setElementState(id, s));
  }, [api, guard]);

  const updatePin = useCallback(async (id: string, input: Parameters<WorkspaceApi["updatePin"]>[1]) => {
    await api.updatePin(id, input);
    setPins((list) => list.map((p) => (p.id === id ? { ...p, ...input, closed_at: input.status === "done" ? new Date().toISOString() : input.status ? null : p.closed_at } as Pin : p)));
  }, [api]);

  /** Save a change to one plan element: merged into what was saved before, null puts it back as drawn. */
  const saveEdit = useCallback(async (id: string, patch: ElementEdit | null) => {
    let next: ElementEdit | null = null;
    setEdits((all) => {
      const merged = patch ? Object.fromEntries(Object.entries({ ...all[id], ...patch }).filter(([, v]) => v !== undefined && v !== null && v !== "")) as ElementEdit : null;
      next = merged && Object.keys(merged).length ? merged : null;
      const out = { ...all };
      if (next) out[id] = next; else delete out[id];
      return out;
    });
    await guard(() => api.saveElementEdit(id, next));
  }, [api, guard]);

  const moveFixture = useCallback((id: string, dx: number, dy: number, dz: number) => {
    const e = edits[id] ?? {};
    void saveEdit(id, { dx: (e.dx ?? 0) + dx || undefined, dy: (e.dy ?? 0) + dy || undefined, dz: (e.dz ?? 0) + dz || undefined });
  }, [edits, saveEdit]);

  const selectItem = useCallback((id: string) => {
    setSelectedItem(id);
    setSelected(null);
    setSelectedPin(null);
    setDraft(null);
    setTab("details");
  }, []);

  const addItem = useCallback(async (input: ItemInput) => {
    const it = await guard(() => api.createItem(input));
    if (!it) return;
    setItems((l) => [...l, it]);
    selectItem(it.id);
    say("Placed. Drag it to where it goes");
  }, [api, guard, say, selectItem]);

  const updateItem = useCallback(async (id: string, input: Partial<ItemInput>) => {
    setItems((l) => l.map((i) => (i.id === id ? { ...i, ...input } as JobItem : i)));
    await guard(() => api.updateItem(id, input));
  }, [api, guard]);

  const deleteItem = useCallback(async (id: string) => {
    setItems((l) => l.filter((i) => i.id !== id));
    setSelectedItem(null);
    await guard(() => api.deleteItem(id));
  }, [api, guard]);

  /** Add lines to the list; the ones for this job with a spot get a material pin on the map. Lines
   *  added together at one spot (a whole room's list, a kit) share one pin, so the map stays readable. */
  const addMaterials = useCallback(async (inputs: MaterialInput[], together = false) => {
    const m = api.materials;
    if (!m || !inputs.length) return;
    const here = (i: MaterialInput) => i.job_id === job.id && !!(i.element_id || i.anchor || i.x != null);
    const newPin = async (ls: MaterialInput[]) => {
      const i = ls[0];
      const { status: _s, ...sum } = pinSummary(ls); void _s;
      const p = await guard(() => api.createPin({ kind: "material", ...sum, element_id: i.element_id, floor_id: i.floor_id, x: i.x, y: i.y, anchor: i.anchor, stage_id: i.stage_id, priority: 1 }));
      if (p) setPins((l) => [...l, p]);
      return p?.id ?? null;
    };
    let withPins: MaterialInput[];
    if (together) {
      const pid = inputs.some(here) ? await newPin(inputs.filter(here)) : null;
      withPins = inputs.map((i) => (here(i) ? { ...i, pin_id: pid } : i));
    } else withPins = await Promise.all(inputs.map(async (i) => (here(i) ? { ...i, pin_id: await newPin([i]) } : i)));
    const made = await guard(() => m.create(withPins));
    if (!made) return;
    setMlines((l) => [...l, ...made]);
    if (inputs[0]?.buyer) setLastBuyer(inputs[0].buyer);
    const first = made[0];
    const jobsN = new Set(made.map((x) => x.job_id)).size;
    say(together ? `Added ${made.length} items to the list` : made.length > 1 ? `Added ${first.name} for ${jobsN} jobs` : `On the list: ${qtyText(first.qty, first.unit)} ${first.name}`);
  }, [api, guard, job.id, say]);

  /** Keep a material pin in step with every line on it. */
  const syncPin = useCallback(async (pinId: string | null, all: MaterialLine[]) => {
    if (!pinId || !pins.some((p) => p.id === pinId)) return;
    const on = all.filter((l) => l.pin_id === pinId);
    if (!on.length) { setPins((ps) => ps.filter((p) => p.id !== pinId)); await guard(() => api.deletePin(pinId)); return; }
    const sum = pinSummary(on);
    setPins((ps) => ps.map((p) => (p.id === pinId ? { ...p, ...sum } : p)));
    await guard(() => api.updatePin(pinId, sum));
  }, [api, guard, pins]);

  const updateMaterial = useCallback(async (id: string, patch: Partial<MaterialInput>) => {
    const before = mlines.find((l) => l.id === id);
    if (!before || !api.materials) return;
    const next = { ...before, ...patch } as MaterialLine;
    const all = mlines.map((x) => (x.id === id ? next : x));
    setMlines(all);
    await guard(() => api.materials!.update(id, patch));
    await syncPin(before.pin_id, all);
  }, [api, guard, mlines, syncPin]);

  const removeMaterial = useCallback(async (id: string) => {
    const l = mlines.find((x) => x.id === id);
    const all = mlines.filter((x) => x.id !== id);
    setMlines(all);
    await guard(() => api.materials!.remove(id));
    await syncPin(l?.pin_id ?? null, all);
  }, [api, guard, mlines, syncPin]);

  /** One tap on a suggestion: straight onto the list, for whoever was picked last time. */
  const quickBuy = useCallback((t: BuyTarget, s: Suggestion) => { void addMaterials([blankLine(job.id, t, s, lastBuyer)]); }, [addMaterials, job.id, lastBuyer]);
  /** Everything picked for a spot at once (a whole room's list): one pin for the lot. */
  const quickBuyAll = useCallback((t: BuyTarget, list: Suggestion[]) => { void addMaterials(list.map((s) => blankLine(job.id, t, s, lastBuyer)), true); }, [addMaterials, job.id, lastBuyer]);
  const openBuy = useCallback((target: BuyTarget | null, preset?: Partial<Suggestion> & { name?: string }) => {
    setBuyDraft({ target, preset });
    setDraft(null);
    setTab("buy");
  }, []);
  const openLine = useCallback((id: string) => { setBuyDraft(null); setBuyFocus({ id, n: Date.now() }); setTab("buy"); }, []);

  const movePin = useCallback((id: string, input: Partial<PinInput>) => { void guard(() => updatePin(id, input)); }, [guard, updatePin]);

  /** A count chip (3 tasks, 1 issue): the pins list, showing just those. */
  const showPinKind = useCallback((kind: PinKind) => {
    setPinFilter({ kind, n: Date.now() });
    setSelectedPin(null);
    setDraft(null);
    setTab("pins");
  }, []);

  const stageOp = useCallback(async (fn: () => Promise<typeof stages>) => {
    const next = await guard(fn);
    if (next) setStages(next);
  }, [guard]);

  const pin = selectedPin ? pins.find((p) => p.id === selectedPin) ?? null : null;
  const openPins = pins.filter((p) => p.status !== "done").length;
  const questions = plan?.data.questions.filter((q) => !q.answer).length ?? 0;
  const currentStage = stages.find((s) => s.status === "active");
  const lastRun = runs[0];

  // what the assistant knows about the screen: which job, where in it, what's picked
  const askContext = useMemo(() => {
    const fl = view && "floorId" in level ? view.floors.find((f) => f.id === level.floorId) : null;
    const rm = fl && "roomId" in level ? fl.rooms.find((r) => r.id === level.roomId) : null;
    const where = level.kind === "site" ? "the job overview" : level.kind === "exterior" ? "the outside of the building"
      : [fl?.name, rm?.name, level.kind === "wall" ? `wall ${level.sideKey}` : null].filter(Boolean).join(", ");
    const el = view && selected ? findElement(view, selected) : null;
    const sel = el ? `${selected} (${("name" in el.el && el.el.name) || el.kind})` : selectedPin ? `pin ${pins.find((p) => p.id === selectedPin)?.number ?? ""}`.trim() : null;
    return { jobId: job.id, jobName: job.name, where, selected: sel };
  }, [view, level, selected, selectedPin, pins, job.id, job.name]);

  const panel = useMemo(() => {
    if (tab === "pins") {
      if (draft && !draft.at) return <PinForm key={`${draft.elementId}${draft.anchor?.x}${draft.preset?.title}`} plan={view} draft={draft} preset={draft.preset} stages={stages} onCancel={() => setDraft(null)} onCreate={async (input) => { await createPin(input); }} />;
      if (pin) return <PinDetail pin={pin} plan={view} stages={stages} onBack={() => setSelectedPin(null)} onShow={() => showPin(pin.id)}
        linkFor={data.canShare && api.personLink && api.shareUrl ? async (m) => `${api.shareUrl!((await api.personLink!(m)).token)}?pin=${pin.id}` : undefined}
        openLinkFor={data.canShare && api.personLink && api.openShare ? (m) => { void api.personLink!(m).then((l) => api.openShare!(l.token, pin.id)); } : undefined}
        onUpdate={(input) => updatePin(pin.id, input)}
        onDelete={async () => { await api.deletePin(pin.id); setPins((l) => l.filter((x) => x.id !== pin.id)); setSelectedPin(null); }}
        loadComments={() => api.listComments(pin.id)}
        addComment={async (body, photos) => {
          const c = await api.addComment(pin.id, body, photos);
          setPins((l) => l.map((x) => (x.id === pin.id ? { ...x, comment_count: c.length } : x)));
          return c;
        }} />;
      return <PinsList key={pinFilter.n} initialFilter={pinFilter.kind} pins={pins} plan={view} onSelect={showPin} onNew={() => { setPinMode(true); say("Click the map where the pin goes"); }} />;
    }
    if (tab === "buy") {
      if (buyDraft) return <AddMaterial key={`${buyDraft.target?.where}${buyDraft.preset?.name}`} target={buyDraft.target} preset={buyDraft.preset} jobs={mjobs} stages={stages} existing={mlines}
        defaults={{ jobId: job.id, buyer: lastBuyer }} onCancel={() => setBuyDraft(null)} onAdd={async (ls, together) => { await addMaterials(ls, together); setBuyDraft(null); }} />;
      return <MaterialsPanel key={buyFocus.n} jobId={job.id} lines={mlines} jobs={mjobs} plan={view} stages={stages} focus={buyFocus.id}
        onAdd={() => openBuy(null)} onUpdate={updateMaterial} onRemove={removeMaterial} onShoppingRun={api.openShopping}
        onShow={(l) => (l.element_id ? showElements([l.element_id]) : l.pin_id && showPin(l.pin_id))}
        onSplit={(l, j, q) => void addMaterials([{ ...blankLine(j, null, { name: l.name, unit: l.unit, qty: q }, l.buyer), store: l.store, link: l.link, unit_cost: l.unit_cost, fulfil: l.fulfil, installer: l.installer, note: l.note, group_id: l.group_id }])} />;
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
      <div className="space-y-3">
      {api.ask && view && (
        <PlanChat send={api.ask} context={askContext} onChanged={api.afterAssistant}
          rooms={view.floors.flatMap((f) => f.rooms.map((r) => (view.floors.length > 1 ? `${r.name} (${f.name})` : r.name)))} />
      )}
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
      </div>
    );
    if (!plan || !view) return null;
    return <Inspector plan={view} level={level} selected={selected} states={states} pins={pins} stages={stages} setLevel={setLevel}
      onSetStatus={setStatus} onSelect={select} onSelectPin={showPin} onAddPin={addPin}
      edits={edits} onSaveEdit={saveEdit} items={items} selectedItem={selectedItem} onSelectItem={selectItem}
      onAddItem={addItem} onUpdateItem={updateItem} onDeleteItem={deleteItem} onPinKind={showPinKind}
      buy={api.materials ? { lines: mlines.filter((l) => l.job_id === job.id && l.status !== "returned"), onQuick: quickBuy, onAll: quickBuyAll, onMore: (t) => openBuy(t), onOpen: openLine } : undefined} />;
  }, [tab, buyDraft, buyFocus, mlines, mjobs, lastBuyer, job.id, addMaterials, updateMaterial, removeMaterial, quickBuy, quickBuyAll, openBuy, openLine, draft, pin, plan, view, stages, pins, runs, level, selected, states, api, data.aiAvailable, data.canShare, say, showPin, updatePin, stageOp, setLevel, setStatus, select, addPin, createPin, showElements,
    edits, saveEdit, items, selectedItem, selectItem, addItem, updateItem, deleteItem, showPinKind, pinFilter, askContext]);

  // where the quick card sits inside the map, kept on screen
  const quick = (() => {
    if (!draft?.at || !mapRef.current) return null;
    const r = mapRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.width - 298, draft.at.x - r.left + 14));
    const top = Math.max(8, Math.min(r.height - 190, draft.at.y - r.top - 40));
    return { left, top };
  })();


  const tabBtn = (t: Tab, label: string, badge?: number) => (
    <button key={t} onClick={() => { if (t === "buy" && tab === "buy") setBuyDraft(null); setTab(t); if (t !== "pins") setDraft(null); }} aria-selected={tab === t} role="tab"
      className={`flex-1 h-12 text-[14px] font-display font-bold tracking-[0.1em] uppercase border-b-[3px] inline-flex items-center justify-center gap-1.5 ${tab === t ? "border-accent text-text" : "border-transparent text-muted hover:text-text"}`}>
      {label}{badge ? <span className={`font-mono text-[11px] rounded-[2px] px-1.5 min-w-[18px] ${t === "plan" ? "bg-accent text-accent-ink" : "bg-panel-3 text-text"}`}>{badge}</span> : null}
    </button>
  );

  const team = useMemo(() => ({ members: data.members, me: data.me }), [data.members, data.me]);

  return (
    <TeamContext.Provider value={team}>
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 border-b border-line bg-panel px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="min-w-0">
          <h1 className="font-stencil text-[22px] font-extrabold uppercase leading-none truncate">{job.name}</h1>
          <p className="text-[12.5px] text-muted truncate">{[job.address, job.client_name].filter(Boolean).join(" · ") || "No address yet"}</p>
        </div>
        <div className="flex-1 min-w-[180px] max-w-[420px]">
          <div className="flex items-baseline gap-2 text-[12.5px] mb-1">
            <span className="eyebrow !text-[11.5px]">Stage</span>
            <span className="truncate">{currentStage?.name ?? (!stages.length ? "No stages" : stages.every((s) => s.status === "done") ? "All done" : stages.some((s) => s.status === "done") ? `Next: ${stages.find((s) => s.status !== "done")!.name}` : "Not started")}</span>
            <span className="ml-auto text-muted font-mono shrink-0">{stages.filter((s) => s.status === "done").length}/{stages.length}</span>
          </div>
          <StageStrip stages={stages} />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {working && <span className="chip"><span className="dot bg-accent animate-pulse" />Reading plan…</span>}
          {lastRun?.status === "failed" && !working && <span className="chip text-red">Last read failed</span>}
          <span className="chip font-mono !text-text"><span className="w-2 h-2 bg-accent" />{openPins} open pin{openPins === 1 ? "" : "s"}</span>
          {data.canShare && api.createShareLink && (
            <button onClick={() => setSharing(true)} className="btn btn-ghost btn-sm" title="Send a sub or a crew member a link to their part of this job">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
              Share
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div ref={mapRef} className="relative h-[62vh] shrink-0 lg:shrink lg:h-auto lg:flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-line">
          {plan && view ? (
            <PlanViewer plan={view} level={level} setLevel={setLevel} selected={selected} onSelect={(id) => select(id)} selectedPin={selectedPin} onSelectPin={showPin}
              states={states} pins={pins} colorMode={colorMode} setColorMode={setColorMode} pinMode={pinMode} setPinMode={setPinMode} onPlacePin={placePin} draft={draft}
              flyTo={flyTo} onAllJobs={onAllJobs} jobName={job.name}
              items={items} selectedItem={selectedItem} onSelectItem={selectItem} onMoveItem={(id, x, y) => updateItem(id, { x, y })} onMovePin={movePin} onMoveFixture={moveFixture}
              view3d={view3d} setView3d={setView3d} can3d={data.can3d !== false}
              hud={<div className="w-[300px] bg-[#17181b]/92 backdrop-blur-sm border border-line border-l-[3px] border-l-accent rounded-[4px] p-3"><ProjectSummary compact plan={view} pins={pins} states={states} stages={stages} setLevel={setLevel} onPinKind={showPinKind} /></div>} />
          ) : (
            <div className="h-full grid place-items-center p-6 bg-ink">
              <div className="max-w-md w-full text-center">
                <p className="font-display text-xl font-bold mb-1">{working ? "Reading the plan…" : "No plan yet"}</p>
                <p className="text-muted mb-5">{working ? "Walls, rooms, doors and windows are being found and numbered. This takes a minute or two." : "Upload the AutoCAD file, a PDF or a photo of the drawing. It becomes a clickable plan."}</p>
                {!working && <UploadBox onUpload={async (f) => { await api.uploadPlan(f); const r = await api.refreshPlan(); setRuns(r.runs); }} />}
              </div>
            </div>
          )}
          {quick && draft?.at && (
            <QuickPin key={`${draft.at.x},${draft.at.y}`} plan={view} target={draft} left={quick.left} top={quick.top} onCancel={() => setDraft(null)}
              onSave={async (kind, title, tagged, photo) => { await guard(() => createPin({ kind, title, tagged, due_date: today(), close_requirement: photo ? "photo" : "confirm", element_id: draft.elementId, floor_id: draft.floorId, x: draft.x, y: draft.y, anchor: draft.anchor, priority: kind === "issue" ? 2 : 1 })); }}
              onMore={(kind, title, tagged, photo) => { setDraft({ ...draft, at: undefined, preset: { kind, title, tagged, photo } }); setTab("pins"); }}
              onBuy={api.materials ? async (title, tagged, more) => {
                const t: BuyTarget = { element_id: draft.elementId, floor_id: draft.floorId, x: draft.x, y: draft.y, anchor: draft.anchor ?? null, where: where(view, draft), suggestions: [] };
                const q = parseQty(title);
                if (more || !q.name) return openBuy(t, q.name ? { name: q.name, qty: q.qty } : undefined);
                await addMaterials([blankLine(job.id, t, q, tagged[0] ?? lastBuyer)]);
                setDraft(null);
              } : undefined} />
          )}
          {toast && <div role="status" className="absolute left-1/2 -translate-x-1/2 top-14 z-10 px-4 py-2 rounded-[3px] bg-panel-2 border border-line border-l-[3px] border-l-accent shadow-lg text-[14px]">{toast}</div>}
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
            {api.materials && tabBtn("buy", "Buy", mlines.filter((l) => l.job_id === job.id && l.status === "to_buy").length)}
            {tabBtn("stages", "Stages")}
            {tabBtn("plan", "Plan", questions)}
          </div>
          <div ref={panelRef} className="flex-1 min-h-0 overflow-y-auto scroll-thin">{panel}</div>
        </aside>
      </div>
      {sharing && <ShareDialog api={api} members={data.members} pins={pins} plan={view} onClose={() => setSharing(false)} />}
      {api.ask && <Assistant send={api.ask} context={askContext} onChanged={api.afterAssistant} open={askOpen} setOpen={setAskOpen} />}
    </div>
    </TeamContext.Provider>
  );
}
