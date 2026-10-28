"use client";
// One job: the plan on the left, the side panel on the right (details, pins, stages, plan). All state
// lives here and every change goes through the WorkspaceApi, so the same screen runs on the server
// actions or on the in-memory preview. Like a good game menu, Esc (or the Back bar, or the browser's
// back button) always steps back one thing, most changes can be undone, and the job opens where you left it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementStatus, Question } from "@/lib/plan/types";
import { clearMarks, MARK_COLORS, showMarks } from "@/lib/plan/marks";
import type { ElementEdit, ItemInput, JobItem, Pin, PinInput, PinKind, PlanRow } from "@/lib/data/types";
import { today } from "@/lib/dates";
import { PlanChat } from "./PlanChat";
import { applyEdits } from "@/lib/plan/edits";
import { JOB_KEY, furnishWhere, jobSettings, stageLook } from "@/lib/plan/build";
import { elementLabel, findElement, roomOf } from "@/lib/plan/geometry";
import { recall, remember } from "@/lib/remember";
import { pinLevel } from "@/components/plan/pinLevel";
import { PlanViewer, type Level } from "@/components/plan/PlanViewer";
import { Assistant } from "@/components/assistant/Assistant";
import type { ColorMode } from "@/components/plan/FloorCanvas";
import type { PinTarget, ScreenPoint } from "@/components/plan/target";
import { STATUS_LABEL } from "@/components/plan/style";
import { TeamContext } from "@/components/team/context";
import { ShortcutsDialog, useFeedback } from "@/components/ui/feedback";
import { useEscape, useHotkeys } from "@/components/ui/hotkeys";
import type { WorkspaceApi, WorkspaceData } from "./api";
import { Inspector, ProjectSummary, type AddPin } from "./Inspector";
import { PinDetail, PinForm, PinsList, QuickPin, where } from "./PinsPanel";
import { PlanPanel, UploadBox } from "./PlanPanel";
import { ShareDialog } from "./ShareDialog";
import { useFollowMarks } from "./useFollowMarks";
import { HOUSE_LAYER, StagesPanel, StageStrip } from "./StagesPanel";
import { MoneyPanel } from "@/components/billing/MoneyPanel";
import { AddMaterial, MaterialsPanel, blankLine, type BuyTarget } from "@/components/materials/MaterialsPanel";
import { parseQty, type Suggestion } from "@/lib/materials/suggest";
import { NEXT_STATUS, pinSummary, qtyText, type MaterialInput, type MaterialLine } from "@/lib/materials/types";

const TABS: Tab[] = ["details", "pins", "buy", "stages", "plan", "money"];

interface Undo { id: number; label: string; run: () => void | Promise<void>; key?: string }

/** a remembered level still fits this plan (rooms can change when the plan is read again) */
function levelFits(plan: PlanRow["data"], l: Level) {
  if (l.kind === "site" || l.kind === "exterior") return true;
  const f = plan.floors.find((x) => x.id === l.floorId);
  if (!f) return false;
  if (l.kind === "floor") return true;
  return f.rooms.some((r) => r.id === l.roomId) && (l.kind === "room" || l.sideKey.startsWith(`${l.roomId}:`));
}
const sameLevel = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Tab = "details" | "pins" | "buy" | "stages" | "plan" | "money";
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
  // a stage picked in Stages is a layer: the map shows only what's on it (HOUSE_LAYER: no stage)
  const [layer, setLayer] = useState<string | null>(null);
  const [pinMode, setPinMode] = useState(false);
  // a pin being made: `at` set means the quick card at that screen point, otherwise the full form
  const [draft, setDraft] = useState<(PinTarget & { at?: ScreenPoint; preset?: { kind: PinKind; title: string; tagged?: string[]; photo?: boolean; stage?: string | null } }) | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>(data.startOnMoney && data.billing ? "money" : data.plan ? "details" : "plan");
  const [flyTo, setFlyTo] = useState<{ ids: string[]; n: number } | null>(null);
  const job = data.job;
  const [billing, setBilling] = useState(data.billing);
  const [payouts, setPayouts] = useState(!!data.payoutsConnected);
  const [moneyKey, setMoneyKey] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  // materials: lines on every job (so one add can split across jobs), the add sheet, the line to open
  const [mlines, setMlines] = useState<MaterialLine[]>(data.materials?.lines ?? []);
  const [buyDraft, setBuyDraft] = useState<{ target: BuyTarget | null; preset?: Partial<Suggestion> & { name?: string } } | null>(null);
  const [buyFocus, setBuyFocus] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });
  const [lastBuyer, setLastBuyer] = useState<string | null>(null);
  // this job's tasks and stages are live here (a task made a moment ago can be picked for a line)
  const mjobs = useMemo(() => {
    const here = { tasks: pins.filter((p) => p.kind === "task").map((p) => ({ id: p.id, number: p.number, title: p.title, tagged: p.tagged, stage_id: p.stage_id })), stages: stages.map((x) => ({ id: x.id, name: x.name })) };
    return (data.materials?.jobs ?? [{ id: data.job.id, name: data.job.name, address: data.job.address }]).map((j) => (j.id === data.job.id ? { ...j, ...here } : j));
  }, [data.materials?.jobs, data.job, pins, stages]);
  useEffect(() => { void api.materials?.list().then(setMlines).catch(() => {}); }, [api]);
  // opening the add sheet or the list starts at the top
  useEffect(() => { if (tab === "buy") panelRef.current?.scrollTo(0, 0); }, [tab, buyDraft]);
  const { toast } = useFeedback();

  const say = useCallback((m: string) => toast(m), [toast]);
  const guard = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try { return await fn(); } catch (e) { toast(e instanceof Error ? e.message : "Something went wrong.", { tone: "error" }); }
  }, [toast]);

  // Undo: newest last. Ctrl+Z, the Undo button in the header, or Undo on the toast all take the top one.
  const undos = useRef<Undo[]>([]);
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const undoSeq = useRef(0);
  const take = useCallback((pick: (u: Undo) => boolean) => {
    const u = [...undos.current].reverse().find(pick);
    if (u) undos.current = undos.current.filter((x) => x !== u);
    setUndoLabel(undos.current.at(-1)?.label ?? null);
    return u;
  }, []);
  /** Remember how to take a change back; `announce` puts it on a toast with an Undo button too. */
  const undoable = useCallback((label: string, run: Undo["run"], opts: { announce?: boolean; key?: string } = {}) => {
    const u: Undo = { id: ++undoSeq.current, label, run, key: opts.key };
    undos.current = [...undos.current.slice(-29), u];
    setUndoLabel(label);
    if (opts.announce) toast(label, { action: { label: "Undo", run: () => { if (take((x) => x === u)) void guard(async () => { await run(); }); } } });
  }, [toast, take, guard]);
  const undo = useCallback(() => {
    const u = take(() => true);
    if (!u) return say("Nothing to undo");
    void guard(async () => { await u.run(); say(`Undone: ${u.label}`); });
  }, [take, guard, say]);

  // Deletes wait out the Undo window before they reach the server, so Undo brings back everything
  // (comments, photos, the same number). Leaving the job sends them right away.
  const pending = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; commit: () => Promise<void> }>());
  const deleteLater = useCallback((key: string, commit: () => Promise<void>) => {
    const timer = setTimeout(() => { pending.current.delete(key); take((u) => u.key === key); void guard(commit); }, 6500);
    pending.current.set(key, { timer, commit });
    return () => { clearTimeout(timer); pending.current.delete(key); };
  }, [guard, take]);
  useEffect(() => {
    const all = pending.current;
    const flush = () => { all.forEach((p) => { clearTimeout(p.timer); void p.commit().catch(() => {}); }); all.clear(); };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, []);

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
    setBilling(data.billing); setMoneyKey((k) => k + 1);
    if (data.materials) setMlines(data.materials.lines);
    setStates(new Map(data.states.map((s) => [s.element_id, s.status] as [string, ElementStatus])));
  }, [data]);
  const [askOpen, setAskOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [help, setHelp] = useState(false);

  // the plan as it is now: what the reader found, plus everything moved or changed in the app
  const view = useMemo(() => (plan ? applyEdits(plan.data, edits) : null), [plan, edits]);
  // furnishing, and how built the house looks: finished, unless a stage is picked in Stages
  const settings = useMemo(() => jobSettings(edits), [edits]);
  const layerStage = layer && layer !== HOUSE_LAYER ? stages.find((s) => s.id === layer) ?? null : null;
  const look = layerStage ? stageLook(layerStage, settings) : "finished";
  const inLayer = useCallback((p: { stage_id: string | null }) => !layer || (layer === HOUSE_LAYER ? !p.stage_id || !stages.some((s) => s.id === p.stage_id) : p.stage_id === layer), [layer, stages]);
  const layerPins = useMemo(() => (layer ? pins.filter(inLayer) : pins), [pins, layer, inLayer]);
  // on a layer, the progress colours show just what's on it: each thing, and its room, amber while
  // anything there is open and green once it's all done
  const layerStates = useMemo(() => {
    if (!layer || !view) return states;
    const m = new Map<string, ElementStatus>();
    const mark = (id: string, done: boolean) => { if (!done) m.set(id, "in_progress"); else if (!m.has(id)) m.set(id, "done"); };
    for (const p of layerPins) {
      const e = p.element_id ? findElement(view, p.element_id) : null;
      if (!e) continue;
      mark(e.el.id, p.status === "done");
      const r = roomOf(e);
      if (r) mark(r, p.status === "done");
    }
    return m;
  }, [layer, view, layerPins, states]);
  const stageCounts = useMemo(() => {
    const c = new Map<string, number>();
    const known = new Set(stages.map((s) => s.id));
    for (const p of pins) if (p.status !== "done") { const k = p.stage_id && known.has(p.stage_id) ? p.stage_id : HOUSE_LAYER; c.set(k, (c.get(k) ?? 0) + 1); }
    return c;
  }, [pins, stages]);
  const pickLayer = useCallback((id: string | null) => { setLayer(id); if (id) setColorMode("progress"); }, []);

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

  /** Point at elements from a question without leaving the current panel. A question about the outside
   *  (the roof, the way in) puts a blinking dot on the building instead. */
  const showElements = useCallback((ids: string[], q?: Question) => {
    if (q?.point) {
      const pt = q.point;
      return showMarks([{ floor_id: pt.floor_id, x: pt.x, y: pt.y, z: pt.z, outside: pt.outside, label: "?", color: MARK_COLORS[5][1], id: null }]);
    }
    if (!plan || !ids.length) return;
    const e = findElement(plan.data, ids[0]);
    if (!e) return;
    setLevelRaw({ kind: "floor", floorId: e.floor.id });
    setSelected(ids[0]);
    setSelectedPin(null);
    setFlyTo({ ids, n: Date.now() });
  }, [plan]);

  // the assistant pointing at a place: go there and open it in the side panel (not over the Plan tab's chat)
  useFollowMarks(view, level, setLevelRaw, (id) => { setSelected(id); setSelectedPin(null); setSelectedItem(null); setDraft(null); setTab((t) => (t === "plan" ? t : "details")); });

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
    undoable(`Pin #${p.number} added`, async () => {
      await api.deletePin(p.id);
      setPins((l) => l.filter((x) => x.id !== p.id));
      setSelectedPin((s) => (s === p.id ? null : s));
    }, { announce: true });
    return p;
  }, [api, undoable]);

  const applyStatus = useCallback(async (id: string, s: ElementStatus | null) => {
    setStates((m) => { const n = new Map(m); if (s) n.set(id, s); else n.delete(id); return n; });
    await guard(() => api.setElementState(id, s));
  }, [api, guard]);
  const setStatus = useCallback(async (id: string, s: ElementStatus | null) => {
    const prev = states.get(id) ?? null;
    if (prev === s) return;
    const e = plan ? findElement(plan.data, id) : null;
    const name = e ? elementLabel(e) : id;
    await applyStatus(id, s);
    undoable(s ? `${name}: ${STATUS_LABEL[s]}` : `${name}: status cleared`, () => applyStatus(id, prev), { announce: true });
  }, [states, plan, applyStatus, undoable]);

  const applyPin = useCallback(async (id: string, input: Parameters<WorkspaceApi["updatePin"]>[1]) => {
    await api.updatePin(id, input);
    setPins((list) => list.map((p) => (p.id === id ? { ...p, ...input, closed_at: input.status === "done" ? new Date().toISOString() : input.status ? null : p.closed_at } as Pin : p)));
  }, [api]);
  const updatePin = useCallback(async (id: string, input: Parameters<WorkspaceApi["updatePin"]>[1]) => {
    const before = pins.find((p) => p.id === id);
    await applyPin(id, input);
    if (!before) return;
    // put back exactly the fields that changed
    const back = Object.fromEntries(Object.keys(input).map((k) => [k, before[k as keyof Pin]])) as Parameters<WorkspaceApi["updatePin"]>[1];
    const label = input.status === "done" ? `Pin #${before.number} closed` : input.status ? `Pin #${before.number}: ${input.status === "open" ? "reopened" : "in progress"}` : `Pin #${before.number} changed`;
    undoable(label, () => applyPin(id, back), { announce: input.status === "done" });
  }, [pins, applyPin, undoable]);

  const deletePin = useCallback(async (p: Pin) => {
    setPins((l) => l.filter((x) => x.id !== p.id));
    setSelectedPin((s) => (s === p.id ? null : s));
    const key = `pin:${p.id}`;
    const cancel = deleteLater(key, () => api.deletePin(p.id));
    undoable(`Pin #${p.number} deleted`, () => { cancel(); setPins((l) => [...l.filter((x) => x.id !== p.id), p].sort((a, b) => a.number - b.number)); }, { announce: true, key });
  }, [api, deleteLater, undoable]);

  /** Save a change to one plan element: merged into what was saved before, null puts it back as drawn. */
  const putEdit = useCallback(async (id: string, value: ElementEdit | null) => {
    setEdits((all) => { const out = { ...all }; if (value) out[id] = value; else delete out[id]; return out; });
    await guard(() => api.saveElementEdit(id, value));
  }, [api, guard]);
  const saveEdit = useCallback(async (id: string, patch: ElementEdit | null) => {
    const before = edits[id] ?? null;
    const e = plan ? findElement(plan.data, id) : null;
    const name = e ? elementLabel(e) : id;
    const moved = patch && Object.keys(patch).every((k) => k === "dx" || k === "dy" || k === "dz");
    undoable(!patch ? `${name} put back as drawn` : moved ? `Moved ${name}` : `Changed ${name}`, () => putEdit(id, before), { announce: !patch });
    let next: ElementEdit | null = null;
    setEdits((all) => {
      const merged = patch ? Object.fromEntries(Object.entries({ ...all[id], ...patch }).filter(([, v]) => v !== undefined && v !== null && v !== "")) as ElementEdit : null;
      next = merged && Object.keys(merged).length ? merged : null;
      const out = { ...all };
      if (next) out[id] = next; else delete out[id];
      return out;
    });
    await guard(() => api.saveElementEdit(id, next));
  }, [api, guard, edits, plan, undoable, putEdit]);

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
    undoable(`Added ${it.label || it.kind}`, async () => {
      await api.deleteItem(it.id);
      setItems((l) => l.filter((i) => i.id !== it.id));
      setSelectedItem((s) => (s === it.id ? null : s));
    });
  }, [api, guard, say, selectItem, undoable]);

  const applyItem = useCallback(async (id: string, input: Partial<ItemInput>) => {
    setItems((l) => l.map((i) => (i.id === id ? { ...i, ...input } as JobItem : i)));
    await guard(() => api.updateItem(id, input));
  }, [api, guard]);
  const updateItem = useCallback(async (id: string, input: Partial<ItemInput>) => {
    const before = items.find((i) => i.id === id);
    await applyItem(id, input);
    if (!before) return;
    const back = Object.fromEntries(Object.keys(input).map((k) => [k, before[k as keyof JobItem]])) as Partial<ItemInput>;
    const moved = Object.keys(input).every((k) => k === "x" || k === "y");
    undoable(`${moved ? "Moved" : "Changed"} ${before.label || before.kind}`, () => applyItem(id, back));
  }, [items, applyItem, undoable]);

  const deleteItem = useCallback(async (id: string) => {
    const it = items.find((i) => i.id === id);
    setItems((l) => l.filter((i) => i.id !== id));
    setSelectedItem(null);
    if (!it) return;
    const key = `item:${id}`;
    const cancel = deleteLater(key, () => api.deleteItem(id));
    undoable(`Removed ${it.label || it.kind}`, () => { cancel(); setItems((l) => [...l, it]); }, { announce: true, key });
  }, [api, items, deleteLater, undoable]);

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

  /** One step up the map: wall -> room -> floor -> outside -> the whole job. */
  const stepOut = useCallback(() => {
    if (level.kind === "wall") setLevel({ kind: "room", floorId: level.floorId, roomId: level.roomId });
    else if (level.kind === "room") setLevel({ kind: "floor", floorId: level.floorId });
    else if (level.kind === "floor") setLevel({ kind: "exterior" });
    else if (level.kind === "exterior") setLevel({ kind: "site" });
  }, [level, setLevel]);
  const pickedSomething = !!selectedItem || (!!selected && !(level.kind === "room" && selected === level.roomId));
  /** Back one step, like backing out of a game menu: the top-most thing open closes first. */
  const back = useCallback(() => {
    if (askOpen) return setAskOpen(false);
    if (pinMode) return setPinMode(false);
    if (draft) return setDraft(null);
    if (tab === "buy" && buyDraft) return setBuyDraft(null);
    if (selectedPin) return setSelectedPin(null);
    if (selectedItem) return setSelectedItem(null);
    if (pickedSomething) return setSelected(level.kind === "room" ? level.roomId : null);
    stepOut();
  }, [askOpen, pinMode, draft, tab, buyDraft, selectedPin, selectedItem, pickedSomething, level, stepOut]);
  useEscape(back);

  // the tabs this job shows (Buy and Money only when they're wired up); 1, 2, 3... open them in order
  const shownTabs = TABS.filter((t) => (t !== "buy" || !!api.materials) && (t !== "money" || !!(billing && api.money)));
  const openTab = useCallback((t: Tab) => { if (t === "buy" && tab === "buy") setBuyDraft(null); setTab(t); if (t !== "pins") setDraft(null); }, [tab]);
  useHotkeys({
    p: () => { if (plan) setPinMode((m) => !m); },
    ...Object.fromEntries(shownTabs.map((t, i) => [String(i + 1), () => openTab(t)])),
    "Mod+z": undo,
    "?": () => setHelp(true),
  });

  // open where you left this job last time on this device: same tab, same floor or room, 2D or 3D
  const memKey = `job.${job.id}`;
  const restored = useRef(false);
  const replaceNext = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const m = recall<{ tab?: Tab; level?: Level; view3d?: boolean; colorMode?: ColorMode }>(memKey);
    if (!m) return;
    if (m.tab && !data.startOnMoney && shownTabs.includes(m.tab) && (plan || m.tab !== "details")) setTab(m.tab);
    if (typeof m.view3d === "boolean" && data.can3d !== false) setView3d(m.view3d);
    if (m.colorMode) setColorMode(m.colorMode);
    if (m.level && plan && m.level.kind !== "site" && levelFits(plan.data, m.level)) { replaceNext.current = true; setLevel(m.level); }
  }, [memKey, plan, data.can3d, setLevel]);
  useEffect(() => { if (restored.current) remember(memKey, { tab, level, view3d, colorMode }); }, [memKey, tab, level, view3d, colorMode]);

  // the browser's back and forward buttons walk the map too (and a phone's back gesture)
  const fromHistory = useRef(false);
  const levelNow = useRef(level);
  levelNow.current = level;
  useEffect(() => {
    const here = { ...(history.state ?? {}), rorkerJob: job.id, rorkerLevel: level };
    if (fromHistory.current) { fromHistory.current = false; return; }
    if (history.state?.rorkerJob === job.id && sameLevel(history.state.rorkerLevel, level)) return;
    if (history.state?.rorkerJob !== job.id || replaceNext.current) { replaceNext.current = false; history.replaceState(here, ""); }
    else history.pushState(here, "");
  }, [level, job.id]);
  useEffect(() => {
    const pop = (e: PopStateEvent) => {
      const l = e.state?.rorkerJob === job.id ? (e.state.rorkerLevel as Level | undefined) : undefined;
      if (!l || sameLevel(l, levelNow.current)) return;
      fromHistory.current = true;
      setLevel(l);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [job.id, setLevel]);

  // the browser tab says which job this is
  useEffect(() => {
    const was = document.title;
    document.title = `${job.name} · Rorker`;
    return () => { document.title = was; };
  }, [job.name]);

  const stageOp = useCallback(async (fn: () => Promise<typeof stages>) => {
    const next = await guard(fn);
    if (next) setStages(next);
  }, [guard]);

  const pin = selectedPin ? pins.find((p) => p.id === selectedPin) ?? null : null;
  // what the Back bar over the details goes back to
  const backTo = (() => {
    if (!view || tab !== "details") return null;
    const fl = "floorId" in level ? view.floors.find((f) => f.id === level.floorId) : null;
    const rm = fl && "roomId" in level ? fl.rooms.find((r) => r.id === level.roomId) : null;
    if (pickedSomething) return rm?.name ?? fl?.name ?? (level.kind === "exterior" ? "the outside" : "the whole job");
    if (level.kind === "wall") return rm?.name ?? "the room";
    if (level.kind === "room") return fl?.name ?? "the floor";
    if (level.kind === "floor") return "the outside";
    if (level.kind === "exterior") return "the whole job";
    return null;
  })();
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
      if (draft && !draft.at) return <PinForm key={`${draft.elementId}${draft.anchor?.x}${draft.preset?.title}`} plan={view} draft={draft} preset={{ kind: "task", title: "", stage: layerStage?.id ?? null, ...draft.preset }} stages={stages} onCancel={() => setDraft(null)} onCreate={async (input) => { await createPin(input); }} />;
      if (pin) return <PinDetail pin={pin} plan={view} stages={stages} onBack={() => setSelectedPin(null)} onShow={() => showPin(pin.id)}
        linkFor={data.canShare && api.personLink && api.shareUrl ? async (m) => `${api.shareUrl!((await api.personLink!(m)).token)}?pin=${pin.id}` : undefined}
        openLinkFor={data.canShare && api.personLink && api.openShare ? (m) => { void api.personLink!(m).then((l) => api.openShare!(l.token, pin.id)); } : undefined}
        onUpdate={(input) => updatePin(pin.id, input)}
        onDelete={() => deletePin(pin)}
        loadComments={() => api.listComments(pin.id)}
        addComment={async (body, photos) => {
          const c = await api.addComment(pin.id, body, photos);
          setPins((l) => l.map((x) => (x.id === pin.id ? { ...x, comment_count: c.length } : x)));
          return c;
        }} />;
      return <PinsList key={pinFilter.n} initialFilter={pinFilter.kind} pins={layerPins} plan={view} onSelect={showPin} onNew={() => { setPinMode(true); say("Click the map where the pin goes"); }} />;
    }
    if (tab === "buy") {
      if (buyDraft) return <AddMaterial key={`${buyDraft.target?.where}${buyDraft.preset?.name}`} target={buyDraft.target} preset={buyDraft.preset} jobs={mjobs} stages={stages} existing={mlines}
        defaults={{ jobId: job.id, buyer: lastBuyer }} onCancel={() => setBuyDraft(null)} onAdd={async (ls, together) => { await addMaterials(ls, together); setBuyDraft(null); }} />;
      return <MaterialsPanel key={buyFocus.n} jobId={job.id} lines={layer ? mlines.filter((l) => l.job_id !== job.id || inLayer(l)) : mlines} jobs={mjobs} plan={view} stages={stages} focus={buyFocus.id}
        onAdd={() => openBuy(null)} onUpdate={updateMaterial} onRemove={removeMaterial} onShoppingRun={api.openShopping}
        onShow={(l) => (l.element_id ? showElements([l.element_id]) : l.pin_id && showPin(l.pin_id))}
        onSplit={(l, j, q) => void addMaterials([{ ...blankLine(j, null, { name: l.name, unit: l.unit, qty: q }, l.buyer), store: l.store, link: l.link, unit_cost: l.unit_cost, fulfil: l.fulfil, installer: l.installer, note: l.note, group_id: l.group_id }])} />;
    }
    if (tab === "stages") return (
      <StagesPanel stages={stages} layer={layer} onLayer={pickLayer} counts={stageCounts}
        lookOf={(st) => stageLook(st, settings)} onLook={(id, l) => void saveEdit(JOB_KEY, { stage_looks: { ...settings.stage_looks, [id]: l } })}
        onStatus={async (id, s) => {
          const before = stages.find((x) => x.id === id);
          await stageOp(() => api.setStageStatus(id, s));
          if (before) undoable(`${before.name}: ${s === "active" ? "in progress" : s.replace("_", " ")}`, () => stageOp(() => api.setStageStatus(id, before.status)));
        }}
        onAdd={(n) => stageOp(() => api.addStage(n))}
        onRename={(id, n) => stageOp(() => api.renameStage(id, n))}
        onDelete={(id) => stageOp(() => api.deleteStage(id))}
        onMove={(id, d) => stageOp(() => api.moveStage(id, d))} />
    );
    if (tab === "money" && billing && data.brand && api.money) {
      const money = api.money;
      return <MoneyPanel key={moneyKey} initial={billing} brand={data.brand} jobId={job.id} plan={view} stages={stages} connected={payouts}
        job={{ name: job.name, address: job.address, client_name: job.client_name, client_email: job.client_email, client_phone: job.client_phone }}
        onConnect={() => void guard(async () => { await money.connectPayouts(); setPayouts(true); say("Payouts are on. Clients can now pay by card or bank."); })}
        api={{ say, openClient: money.openClient, save: (b) => { setBilling(b); money.save(b); },
          showRoom: (roomId) => { const f = view?.floors.find((fl) => fl.rooms.some((r) => r.id === roomId)); if (f) { setLevelRaw({ kind: "room", floorId: f.id, roomId }); setSelected(roomId); } } }} />;
    }
    if (tab === "plan") return (
      <div className="space-y-3">
      {api.ask && view && (
        <PlanChat send={api.ask} context={askContext} onChanged={api.afterAssistant} onFurnish={(room) => { if (view) void saveEdit(JOB_KEY, { furnish: furnishWhere(view, jobSettings(edits).furnish, room) }); }}
          rooms={view.floors.flatMap((f) => f.rooms.map((r) => (view.floors.length > 1 ? `${r.name} (${f.name})` : r.name)))} />
      )}
      <PlanPanel plan={plan} runs={runs} aiAvailable={data.aiAvailable} onShow={showElements}
        onUpload={async (f) => { await api.uploadPlan(f); const r = await api.refreshPlan(); setRuns(r.runs); say("Reading the plan. This takes a minute or two."); }}
        onAnswer={async (a) => {
          if (!plan) return;
          await api.answer(plan.id, a);
          clearMarks();
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
      buy={api.materials ? { lines: mlines.filter((l) => l.job_id === job.id && l.status !== "returned"), onQuick: quickBuy, onAll: quickBuyAll, onMore: (t) => openBuy(t), onOpen: openLine, onTick: (id) => { const l = mlines.find((x) => x.id === id); if (l) void updateMaterial(id, { status: NEXT_STATUS[l.status] }); } } : undefined} />;
  }, [tab, buyDraft, buyFocus, mlines, mjobs, lastBuyer, job.id, addMaterials, updateMaterial, removeMaterial, quickBuy, quickBuyAll, openBuy, openLine, draft, pin, plan, view, stages, pins, runs, level, selected, states, api, data.aiAvailable, data.canShare, say, showPin, updatePin, deletePin, undoable, stageOp, setLevel, setStatus, select, addPin, createPin, showElements,
    edits, saveEdit, items, selectedItem, selectItem, addItem, updateItem, deleteItem, showPinKind, pinFilter, askContext, billing, payouts, moneyKey, data.brand, job, guard, layer, layerPins, layerStage, inLayer, stageCounts, pickLayer, settings]);

  // where the quick card sits inside the map, kept on screen
  const quick = (() => {
    if (!draft?.at || !mapRef.current) return null;
    const r = mapRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.width - 298, draft.at.x - r.left + 14));
    const top = Math.max(8, Math.min(r.height - 190, draft.at.y - r.top - 40));
    return { left, top };
  })();


  const tabBtn = (t: Tab, label: string, badge?: number) => (
    <button key={t} onClick={() => openTab(t)} title={`${label} (${shownTabs.indexOf(t) + 1})`} aria-selected={tab === t} role="tab"
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
          {undoLabel && (
            <button onClick={undo} className="btn btn-ghost btn-sm" title={`Undo: ${undoLabel} (Ctrl+Z)`} aria-label={`Undo: ${undoLabel}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
              Undo
            </button>
          )}
          {data.canShare && api.createShareLink && (
            <button onClick={() => setSharing(true)} className="btn btn-ghost btn-sm" title="Send a sub or a crew member a link to their part of this job">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
              Share
            </button>
          )}
          <button onClick={() => setHelp(true)} className="hidden md:inline-flex w-8 h-8 items-center justify-center text-muted hover:text-text" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
            <kbd className="kbd !min-w-[22px] !h-[22px]">?</kbd>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div ref={mapRef} className="relative h-[62vh] shrink-0 lg:shrink lg:h-auto lg:flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-line">
          {plan && view ? (
            <PlanViewer plan={view} level={level} setLevel={setLevel} selected={selected} onSelect={(id) => select(id)} selectedPin={selectedPin} onSelectPin={showPin}
              states={layerStates} pins={layerPins} colorMode={colorMode} setColorMode={setColorMode} pinMode={pinMode} setPinMode={setPinMode} onPlacePin={placePin} draft={draft}
              flyTo={flyTo} onAllJobs={onAllJobs} jobName={job.name}
              items={items} selectedItem={selectedItem} onSelectItem={selectItem} onMoveItem={(id, x, y) => updateItem(id, { x, y })} onMovePin={movePin} onMoveFixture={moveFixture}
              view3d={view3d} setView3d={setView3d} can3d={data.can3d !== false}
              furnish={settings.furnish} onFurnish={(furnish) => void saveEdit(JOB_KEY, { furnish })}
              look={look}
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
            <QuickPin key={`${draft.at.x},${draft.at.y}`} plan={view} target={draft} left={quick.left} top={quick.top} onCancel={() => setDraft(null)} stages={stages} stage={layerStage?.id ?? null}
              onSave={async (kind, title, tagged, photo, stage) => { await guard(() => createPin({ kind, title, tagged, due_date: today(), close_requirement: photo ? "photo" : "confirm", element_id: draft.elementId, floor_id: draft.floorId, x: draft.x, y: draft.y, anchor: draft.anchor, priority: kind === "issue" ? 2 : 1, stage_id: stage })); }}
              onMore={(kind, title, tagged, photo, stage) => { setDraft({ ...draft, at: undefined, preset: { kind, title, tagged, photo, stage } }); setTab("pins"); }}
              onBuy={api.materials ? async (title, tagged, more, stage) => {
                const t: BuyTarget = { element_id: draft.elementId, floor_id: draft.floorId, x: draft.x, y: draft.y, anchor: draft.anchor ?? null, where: where(view, draft), suggestions: [] };
                const q = parseQty(title);
                if (more || !q.name) return openBuy(t, q.name ? { name: q.name, qty: q.qty } : undefined);
                await addMaterials([{ ...blankLine(job.id, t, q, tagged[0] ?? lastBuyer), stage_id: stage }]);
                setDraft(null);
              } : undefined} />
          )}
          {layer && plan && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-14 z-10 flex items-center gap-2 h-9 pl-3 pr-1 rounded-[4px] bg-[#17181b]/92 backdrop-blur-sm border border-accent text-[13px]" role="status">
              <span className="eyebrow !text-[11.5px]">Layer</span>
              <span className="font-medium">{layerStage?.name ?? "Whole house"}</span>
              <span className="text-muted">{layerPins.filter((p) => p.status !== "done").length} open</span>
              <button onClick={() => setLayer(null)} className="h-7 px-2 rounded-[3px] text-muted hover:text-text hover:bg-panel-3" title="Show everything">Show all ✕</button>
            </div>
          )}
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
            {billing && api.money && tabBtn("money", "Money", billing.quotes.filter((q) => q.status === "approved")
              .flatMap((q) => q.schedule).filter((d) => !d.invoice_id && stages.some((s) => s.status === "done" && s.name === d.stage_name)).length)}
          </div>
          {backTo && (
            <button onClick={back} className="shrink-0 h-10 px-4 flex items-center gap-2 border-b border-line text-[13.5px] text-muted hover:text-text hover:bg-panel-2 text-left" title="Back (Esc)">
              <span aria-hidden className="text-[16px] leading-none">‹</span>
              <span className="truncate">Back to {backTo}</span>
              <kbd className="kbd ml-auto hidden md:inline-grid !h-5 !text-[10.5px]">Esc</kbd>
            </button>
          )}
          <div ref={panelRef} className="flex-1 min-h-0 overflow-y-auto scroll-thin">{panel}</div>
        </aside>
      </div>
      {help && <ShortcutsDialog onClose={() => setHelp(false)} groups={[
        { title: "Getting around", items: [
          { keys: ["Esc"], does: "Back one step" },
          { keys: ["1", "2", "3", "4"], does: "Details, Pins, Stages, Plan" },
          { keys: ["Alt", "←"], does: "Browser back walks the map too" },
        ] },
        { title: "Doing things", items: [
          { keys: ["P"], does: "Pick up a pin, click to drop it" },
          { keys: ["Mod", "Z"], does: "Undo the last change" },
          { keys: ["?"], does: "This list" },
        ] },
      ]} />}
      {sharing && <ShareDialog api={api} members={data.members} pins={pins} plan={view} onClose={() => setSharing(false)} />}
      {api.ask && <Assistant send={api.ask} context={askContext} onChanged={api.afterAssistant} open={askOpen} setOpen={setAskOpen} />}
    </div>
    </TeamContext.Provider>
  );
}
