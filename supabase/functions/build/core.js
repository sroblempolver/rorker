// Generated from web/src/lib (cloud/, share.ts, billing/clientGuard.ts) by web/preview/build-links.mjs. Do not edit.

// src/lib/cloud/records.ts
function fromRecords(rows) {
  const jobs = /* @__PURE__ */ new Map();
  const of = (kind) => rows.filter((r) => r.kind === kind);
  for (const r of of("job")) {
    const v = r.data;
    jobs.set(r.id, { job: v.job, can3d: v.can3d, payoutsConnected: v.payoutsConnected, plan: null, stages: [], pins: [], items: [], edits: {}, states: [], runs: [] });
  }
  for (const r of rows) {
    const d = r.job_id ? jobs.get(r.job_id) : void 0;
    if (!d) continue;
    if (r.kind === "plan") {
      const p = r.data;
      if (!d.plan || p.id === d.job.current_plan_id) d.plan = p;
    } else if (r.kind === "stage") d.stages.push(r.data);
    else if (r.kind === "pin") d.pins.push(r.data);
    else if (r.kind === "item") d.items.push(r.data);
    else if (r.kind === "run") d.runs.push(r.data);
    else if (r.kind === "edits") d.edits = r.data;
    else if (r.kind === "states") d.states = r.data;
    else if (r.kind === "billing") d.billing = r.data;
  }
  const comments = of("comment").map((r) => r.data).sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const d of jobs.values()) {
    d.stages.sort((a, b) => a.position - b.position);
    d.pins.sort((a, b) => a.number - b.number);
    d.runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
    d.pins = d.pins.map((p) => ({ ...p, comment_count: comments.filter((c) => c.pin_id === p.id).length }));
  }
  const members = of("member").map((r) => r.data).sort((a, b) => Number(b.is_owner) - Number(a.is_owner) || a.full_name.localeCompare(b.full_name));
  return {
    jobs: [...jobs.values()].sort((a, b) => b.job.created_at.localeCompare(a.job.created_at)),
    members,
    comments,
    notes: of("note").map((r) => r.data),
    photos: of("photo").map((r) => r.data).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    messages: of("message").map((r) => r.data).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    team: of("team").map((r) => r.data).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    access: of("access").map((r) => r.data),
    materials: of("material").map((r) => r.data),
    shares: of("share").map((r) => r.data).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    settings: of("settings")[0]?.data ?? null
  };
}

// src/lib/billing/clientGuard.ts
var without = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
var sameExcept = (a, b, keys) => JSON.stringify(without(a, keys)) === JSON.stringify(without(b, keys));
var byId = (xs = []) => new Map(xs.map((x) => [x.id, x]));
var QUOTE_FREE = ["status", "chosen", "picked_option", "viewed_at", "approved_at", "signed_by", "declined_at", "activity", "schedule"];
var CO_FREE = ["status", "approved_at", "signed_by", "invoice_id", "activity"];
var INVOICE_FREE = ["status", "activity"];
var open = (s) => s === "sent" || s === "viewed";
function clientBilling(full, sent) {
  const server = shown(full);
  const no = (why) => ({ error: `That change can't be made from this page (${why}).` });
  const sq = byId(server.quotes), sc = byId(server.change_orders), si = byId(server.invoices), sp = byId(server.payments);
  if (sent.quotes.length !== server.quotes.length || (sent.change_orders ?? []).length !== (server.change_orders ?? []).length) return no("quotes");
  const signed = /* @__PURE__ */ new Set();
  const quotes = [];
  for (const q of sent.quotes) {
    const was = sq.get(q.id);
    if (!was || !sameExcept(was, q, QUOTE_FREE)) return no("quote");
    if (JSON.stringify(was.schedule.map((d) => ({ ...d, invoice_id: null }))) !== JSON.stringify(q.schedule.map((d) => ({ ...d, invoice_id: null })))) return no("payment plan");
    if (was.status === q.status) {
      quotes.push(open(was.status) ? { ...was, chosen: q.chosen, picked_option: q.picked_option, viewed_at: q.viewed_at ?? was.viewed_at } : was);
      continue;
    }
    if (!open(was.status) || !["viewed", "approved", "declined"].includes(q.status)) return no("quote status");
    if (q.status === "approved") signed.add(q.id);
    quotes.push(q);
  }
  const change_orders = [];
  for (const c of sent.change_orders ?? []) {
    const was = sc.get(c.id);
    if (!was || !sameExcept(was, c, CO_FREE)) return no("change order");
    if (was.status === c.status) {
      change_orders.push(was);
      continue;
    }
    if (was.status !== "sent" || c.status !== "approved" && c.status !== "declined") return no("change order status");
    if (c.status === "approved") signed.add(c.id);
    change_orders.push(c);
  }
  const invoices = [];
  for (const inv of sent.invoices) {
    const was = si.get(inv.id);
    if (was) {
      if (!sameExcept(was, inv, INVOICE_FREE)) return no("invoice");
      invoices.push({ ...was, status: inv.status, activity: inv.activity });
    } else {
      const from = inv.change_order_id ? signed.has(inv.change_order_id) : !!inv.quote_id && signed.has(inv.quote_id);
      if (!from) return no("new invoice");
      invoices.push(inv);
    }
  }
  if (server.invoices.some((i) => !invoices.some((x) => x.id === i.id))) return no("invoice removed");
  const payments = [];
  for (const p of sent.payments) {
    const was = sp.get(p.id);
    if (was) {
      payments.push(was);
      continue;
    }
    if (!invoices.some((i) => i.id === p.invoice_id) || !(p.amount > 0) || !Number.isInteger(p.amount)) return no("payment");
    payments.push(p);
  }
  if (server.payments.some((p) => !payments.some((x) => x.id === p.id))) return no("payment removed");
  const draft = (xs = []) => xs.filter((x) => x.status === "draft");
  return { billing: {
    ...full,
    quotes: [...quotes, ...draft(full.quotes)],
    invoices: [...invoices, ...draft(full.invoices)],
    payments,
    change_orders: full.change_orders ? [...change_orders, ...draft(full.change_orders)] : void 0
  } };
}
var shown = (b) => ({
  ...b,
  quotes: b.quotes.filter((q) => q.status !== "draft"),
  invoices: b.invoices.filter((i) => i.status !== "draft"),
  ...b.change_orders ? { change_orders: b.change_orders.filter((c) => c.status !== "draft") } : {}
});
function forClient(b) {
  const s = shown(b);
  return { ...s, payments: s.payments.map((p) => ({ ...p, fee: 0 })) };
}

// src/lib/data/types.ts
var clientMemberId = (jobId) => `client:${jobId}`;

// src/lib/share.ts
function linkLive(l, now = /* @__PURE__ */ new Date()) {
  return !l.revoked_at && (!l.expires_at || new Date(l.expires_at) > now);
}
function linkPins(l, pins) {
  return pins.filter((p) => l.member_id && p.tagged.includes(l.member_id) || l.pin_ids.includes(p.id));
}
function linkMaterials(l, d, pinIds) {
  return (d.materials ?? []).filter((m) => m.status !== "returned" && (l.member_id && (m.installer === l.member_id || m.buyer === l.member_id) || m.task_id && pinIds.has(m.task_id))).map((m) => ({
    id: m.id,
    name: m.name,
    qty: m.qty,
    unit: m.unit,
    status: m.status,
    task_id: m.task_id,
    task: m.task_id && d.pins.find((p) => p.id === m.task_id)?.title || m.stage_id && d.stages.find((s) => s.id === m.stage_id)?.name || null,
    needed_by: m.needed_by,
    store: m.fulfil === "stock" ? "from stock" : m.store,
    note: m.note,
    buyer: d.members.find((x) => x.id === m.buyer)?.full_name.split(" ")[0] ?? null,
    you_get: !!l.member_id && m.buyer === l.member_id
  }));
}
function linkCrew(l, members) {
  const m = l.member_id ? members.find((x) => x.id === l.member_id) : null;
  return m && m.crew !== "sub" ? "employee" : "sub";
}
function shareView(l, d) {
  if (!linkLive(l) || l.audience === "client" || l.job_id !== null && l.job_id !== d.job.id) return null;
  const pins = linkPins(l, d.pins).map((p) => ({ ...p, created_by: null, comment_count: 0 }));
  const mine = new Set(pins.map((p) => p.id));
  const crewPins = linkCrew(l, d.members) === "employee" ? d.pins.filter((p) => !mine.has(p.id) && p.status !== "done" && (p.kind === "task" || p.kind === "issue")).map((p) => ({ ...p, created_by: null, comment_count: 0 })) : [];
  const tagged = new Set([...pins, ...crewPins].flatMap((p) => p.tagged));
  return {
    label: l.label,
    expires_at: l.expires_at,
    company: { name: d.company.name, logo_url: d.company.logo_url, brand_color: d.company.brand_color, phone: d.company.phone },
    job: { id: d.job.id, name: d.job.name, address: d.job.address },
    plan: d.plan,
    edits: d.edits,
    items: d.items,
    pins,
    stages: [...d.stages].sort((a, b) => a.position - b.position).map((s) => ({ name: s.name, status: s.status })),
    people: d.members.filter((m) => tagged.has(m.id)).map((m) => ({ id: m.id, full_name: m.full_name, title: m.title })),
    photos: Object.fromEntries(pins.map((p) => [p.id, d.photos?.[p.id] ?? []]).filter(([, ph]) => ph.length)),
    materials: linkMaterials(l, d, mine),
    ...crewPins.length ? { crew_pins: crewPins } : {}
  };
}
function shareWork(l, company, jobs) {
  if (!linkLive(l) || l.audience === "client") return null;
  const views = jobs.map((d) => shareView(l, d)).filter((v) => !!v);
  const open2 = (v) => v.pins.filter((p) => p.status !== "done").length;
  const shown2 = l.job_id ? views : views.filter((v) => v.pins.length || v.materials?.length).sort((a, b) => open2(b) - open2(a));
  return {
    label: l.label,
    expires_at: l.expires_at,
    company: { name: company.name, logo_url: company.logo_url, brand_color: company.brand_color, phone: company.phone },
    jobs: shown2
  };
}

// src/lib/photos.ts
function findElement(plan, id) {
  for (const floor of plan.floors) {
    const r = floor.rooms.find((x) => x.id === id);
    if (r) return { kind: "room", floor, id, room: r.id, name: r.name };
    const w = floor.walls.find((x) => x.id === id);
    if (w) return { kind: "wall", floor, id, room: w.room_ids[0] ?? null, name: w.exterior ? "Exterior wall" : "Wall" };
    const o = floor.openings.find((x) => x.id === id);
    if (o) return { kind: "opening", floor, id, room: o.room_ids[0] ?? null, name: o.name };
    const f = floor.fixtures.find((x) => x.id === id);
    if (f) return { kind: "fixture", floor, id, room: f.room_id, name: f.name.replace(/\s*\((likely|probably|maybe)\)\s*$/i, "") };
    const s = floor.stairs.find((x) => x.id === id);
    if (s) return { kind: "stair", floor, id, room: s.room_id, name: "Stairs" };
  }
  return null;
}
function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function placeOf(plan, at) {
  if (!plan) return { room_id: null, element_id: at.element_id ?? null, floor_id: at.floor_id ?? null };
  const e = at.element_id ? findElement(plan, at.element_id) : null;
  if (e) {
    return { room_id: e.room, element_id: e.kind === "room" ? null : e.id, floor_id: e.floor.id };
  }
  const sideRoom = at.side?.split(":")[0];
  if (sideRoom) {
    const f2 = plan.floors.find((x) => x.rooms.some((r) => r.id === sideRoom));
    if (f2) return { room_id: sideRoom, element_id: null, floor_id: f2.id };
  }
  const f = at.floor_id ? plan.floors.find((x) => x.id === at.floor_id) : null;
  if (f && at.x != null && at.y != null) {
    const r = f.rooms.find((x) => pointInPoly([at.x, at.y], x.polygon));
    return { room_id: r?.id ?? null, element_id: null, floor_id: f.id };
  }
  return { room_id: null, element_id: null, floor_id: f?.id ?? null };
}
function pinPlace(plan, p) {
  return placeOf(plan, { element_id: p.element_id, floor_id: p.floor_id, x: p.anchor?.view === "wall" ? null : p.x, y: p.anchor?.view === "wall" ? null : p.y, side: p.anchor?.view === "wall" ? p.anchor.side : null });
}
function gatherPhotos(s) {
  const out = [];
  for (const u of s.uploads) out.push({
    key: `upload:${u.id}`,
    src: u.src,
    source: "upload",
    by: u.by,
    created_at: u.created_at,
    room_id: u.room_id,
    element_id: u.element_id,
    floor_id: u.floor_id,
    stage_id: u.stage_id,
    caption: u.caption,
    client: u.client,
    photo_id: u.id
  });
  const pins = new Map(s.pins.map((p) => [p.id, p]));
  for (const c of s.comments) {
    const p = pins.get(c.pin_id);
    if (!p || !c.photos.length) continue;
    const at = pinPlace(s.plan, p);
    const by = c.author_id ? { kind: "team", name: s.names?.get(c.author_id) ?? c.author_name ?? "Team", member_id: c.author_id } : { kind: "crew", name: c.author_name ?? "Crew" };
    const caption = c.body && !/^Photo from /.test(c.body) ? c.body : null;
    c.photos.forEach((src, i) => out.push({
      key: `pin:${c.id}:${i}`,
      src,
      source: "pin",
      by,
      created_at: c.created_at,
      ...at,
      stage_id: p.stage_id,
      caption,
      client: p.tagged.includes(s.clientId),
      pin: { id: p.id, number: p.number, title: p.title }
    }));
  }
  for (const m of s.messages) {
    if (!m.photos.length) continue;
    const tag = m.places?.[0];
    const at = tag ? placeOf(s.plan, { element_id: tag.id }) : { room_id: null, element_id: null, floor_id: null };
    m.photos.forEach((src, i) => out.push({
      key: `message:${m.id}:${i}`,
      src,
      source: "message",
      by: { kind: m.from === "client" ? "client" : "team", name: m.author_name },
      created_at: m.created_at,
      ...at,
      stage_id: null,
      caption: m.body?.replace(/@(?=\S)/g, "") ?? null,
      client: true
    }));
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.key.localeCompare(b.key));
}
function cleanPhotoInput(plan, stages, i) {
  const str = (v, max) => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const el = str(i?.element_id, 80);
  const fromEl = el ? placeOf(plan, { element_id: el }) : null;
  const room = str(i?.room_id, 80);
  const roomOk = room && plan?.floors.some((f) => f.rooms.some((r) => r.id === room)) ? room : null;
  const room_id = fromEl?.room_id ?? roomOk;
  const floor_id = fromEl?.floor_id ?? (room_id ? plan.floors.find((f) => f.rooms.some((r) => r.id === room_id)).id : null);
  const stage = str(i?.stage_id, 80);
  return { room_id, element_id: fromEl?.element_id ?? null, floor_id, stage_id: stage && stages.some((s) => s.id === stage) ? stage : null, caption: str(i?.caption, 500) };
}

// src/lib/cloud/links.ts
function companyOf(accountId, name, s) {
  return { id: accountId, name: s?.brand.name || name, logo_url: s?.brand.logo_url ?? null, brand_color: s?.brand.brand_color || "#ff6a1f", phone: s?.brand.phone ?? s?.phone ?? null, email: s?.brand.email ?? null, license_no: s?.brand.license_no ?? null, website: null, address: s?.brand.address ?? null };
}
var findLink = (a, token) => a.shares.find((l) => l.token === token) ?? null;
function crewWork(l, company, a, photos) {
  return shareWork(l, company, a.jobs.map((d) => ({
    company,
    job: d.job,
    plan: d.plan?.data ?? null,
    edits: d.edits,
    items: d.items,
    pins: d.pins,
    stages: d.stages,
    members: a.members,
    photos,
    materials: a.materials.filter((m) => m.job_id === d.job.id)
  })));
}
function crewPinIds(l, a) {
  if (!linkLive(l) || l.audience === "client") return /* @__PURE__ */ new Set();
  return new Set(a.jobs.filter((d) => !l.job_id || d.job.id === l.job_id).flatMap((d) => linkPins(l, d.pins).map((p) => p.id)));
}
function clientPinIds(l, a) {
  const d = a.jobs.find((x) => x.job.id === l.job_id);
  return new Set(d ? d.pins.filter((p) => p.tagged.includes(clientMemberId(d.job.id))).map((p) => p.id) : []);
}
function clientPhotos(l, a) {
  const d = linkLive(l) && l.audience === "client" ? a.jobs.find((x) => x.job.id === l.job_id) : void 0;
  if (!d) return [];
  const pins = new Set(d.pins.map((p) => p.id));
  return gatherPhotos({
    plan: d.plan?.data ?? null,
    pins: d.pins,
    comments: a.comments.filter((c) => pins.has(c.pin_id)),
    messages: a.messages.filter((m) => m.job_id === d.job.id),
    uploads: (a.photos ?? []).filter((p) => p.job_id === d.job.id),
    clientId: clientMemberId(d.job.id)
  }).filter((p) => p.client).map((p) => p.by.kind === "crew" ? { ...p, by: { kind: "crew", name: "Crew" } } : p);
}
function clientView(l, company, a, photos = {}, messages = [], jobPhotos) {
  if (!linkLive(l) || l.audience !== "client") return null;
  const d = a.jobs.find((x) => x.job.id === l.job_id);
  if (!d) return null;
  const brand = a.settings?.brand ?? { name: company.name, logo_url: company.logo_url, brand_color: company.brand_color, phone: company.phone, email: null, address: null, license_no: null, tier: "standard" };
  return {
    company: { name: company.name, logo_url: company.logo_url, brand_color: company.brand_color, phone: company.phone },
    brand,
    job: { id: d.job.id, name: d.job.name, address: d.job.address, client_name: d.job.client_name, client_email: d.job.client_email, client_phone: d.job.client_phone },
    stages: d.stages.map((s) => ({ name: s.name, status: s.status })),
    billing: forClient(d.billing ?? { quotes: [], invoices: [], payments: [] }),
    // the same view a crew link builds, as if for a person tagged as the client: their pins only, no
    // crew, names only for whoever else is on those pins, and materials they're buying or that go with
    // their pins
    view: (() => {
      const v = shareView(
        { ...l, audience: "crew", job_id: d.job.id, member_id: clientMemberId(d.job.id), pin_ids: [] },
        { company, job: d.job, plan: d.plan?.data ?? null, edits: d.edits, items: d.items, pins: d.pins, stages: d.stages, members: a.members, photos, materials: a.materials.filter((m) => m.job_id === d.job.id) }
      );
      const theirs = new Set(d.pins.filter((p) => p.created_by === "client").map((p) => p.id));
      return v && { ...v, label: d.job.client_name || "you", pins: v.pins.map((p) => theirs.has(p.id) ? { ...p, created_by: "client" } : p) };
    })(),
    messages,
    notes: a.notes.filter((n) => n.job_id === d.job.id),
    can_add: !!d.job.client_can_add,
    ...jobPhotos ? { photos: jobPhotos } : {}
  };
}
function clientBuys(l, a) {
  if (!linkLive(l) || l.audience !== "client" || !l.job_id) return /* @__PURE__ */ new Set();
  const me = clientMemberId(l.job_id);
  return new Set(a.materials.filter((m) => m.job_id === l.job_id && m.buyer === me).map((m) => m.id));
}
function clientNote(l, a, n, id, at) {
  const d = a.jobs.find((x) => x.job.id === l.job_id);
  if (!d || !linkLive(l) || l.audience !== "client" || typeof n?.title !== "string") return null;
  const title = n.title.trim().slice(0, 140);
  if (!title || n.shared && !d.job.client_can_add) return null;
  const num = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
  const str = (v, max) => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const floor = str(n.floor_id, 80);
  const anchor = n.anchor && typeof n.anchor === "object" && ["site", "exterior", "wall", "point"].includes(n.anchor.view) && num(n.anchor.x) !== null && num(n.anchor.y) !== null ? { view: n.anchor.view, x: n.anchor.x, y: n.anchor.y, ...num(n.anchor.z) !== null ? { z: n.anchor.z } : {}, ...str(n.anchor.side, 80) ? { side: str(n.anchor.side, 80) } : {} } : null;
  const mine = a.notes.filter((x) => x.job_id === d.job.id);
  return {
    id,
    job_id: d.job.id,
    number: 1 + Math.max(0, ...(n.shared ? d.pins : mine).map((p) => p.number)),
    element_id: str(n.element_id, 80),
    floor_id: floor && d.plan?.data.floors.some((f) => f.id === floor) ? floor : null,
    x: num(n.x),
    y: num(n.y),
    anchor,
    kind: "note",
    title,
    body: str(n.body, 2e3),
    status: "open",
    priority: 1,
    due_date: null,
    tagged: [clientMemberId(d.job.id)],
    close_requirement: "confirm",
    stage_id: null,
    links: [],
    created_by: "client",
    created_at: at,
    closed_at: null
  };
}
function photoJobIds(l, a) {
  if (!linkLive(l)) return /* @__PURE__ */ new Set();
  if (l.audience === "client") return new Set(l.job_id ? [l.job_id] : []);
  return new Set(a.jobs.filter((d) => l.job_id ? d.job.id === l.job_id : linkPins(l, d.pins).length > 0).map((d) => d.job.id));
}
function linkPhoto(l, a, jobId, input, id, path, at) {
  const d = a.jobs.find((x) => x.job.id === jobId);
  if (!d || !photoJobIds(l, a).has(jobId)) return null;
  const client = l.audience === "client";
  const by = client ? { kind: "client", name: d.job.client_name || "Client" } : { kind: "crew", name: l.label, member_id: l.member_id };
  return { id, job_id: jobId, src: path, by, created_at: at, ...cleanPhotoInput(d.plan?.data ?? null, d.stages, input), client };
}

// src/lib/plan/tags.ts
function cleanPlaces(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const t of v.slice(0, 8)) {
    const o = t;
    if (typeof o?.id !== "string" || typeof o.label !== "string" || !/^[\w:.-]{1,80}$/.test(o.id)) continue;
    const label = o.label.trim().slice(0, 80);
    if (label && !out.some((x) => x.id === o.id)) out.push({ id: o.id, label });
  }
  return out;
}

// src/lib/cloud/team.ts
function teamFor(list, memberId) {
  return list.filter((m) => m.from === "office" ? !m.to || m.to.includes(memberId) : m.member_id === memberId);
}
export {
  cleanPlaces,
  clientBilling,
  clientBuys,
  clientNote,
  clientPhotos,
  clientPinIds,
  clientView,
  companyOf,
  crewPinIds,
  crewWork,
  findLink,
  forClient,
  fromRecords,
  linkLive,
  linkPhoto,
  photoJobIds,
  teamFor
};
