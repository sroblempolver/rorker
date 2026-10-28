// Accounts and links for the build site (build.rorker.com). The page talks to the database itself for
// the contractor (row-level security lets admins in), and comes here for the rest:
//   signup  make a contractor's sign-in (confirmed straight away, so there's no email to wait for)
//   link    open a crew or client link: only what that link may show, never the tables
//   photo   a crew member sends a photo onto one of their own tasks
//   done    a crew member marks one of their own tasks done
//   client  a client signs, declines or pays on their money page (prices and lines can't change)
//   message a client writes to the contractor (words and a photo) on the job's thread
//   messages the job's thread again, for a client page that's open
//   note    a client drops a note on their map: private, or shared with the contractor if the job allows
//   unnote  a client takes one of their own notes off
//   got     a client ticks off something on their shopping list
// The rules for what a link shows and what a client may change are in core.js, built from the page's own
// code (web/preview/build-links.mjs), so both sides agree.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { clientBilling, clientBuys, clientNote, clientPinIds, clientView, companyOf, crewPinIds, crewWork, findLink, forClient, fromRecords, linkLive } from "./core.js";

const ORIGINS = [/^https:\/\/([a-z0-9-]+\.)?rorker\.com$/, /^https:\/\/[a-z0-9-]+\.github\.io$/, /^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];
const extra = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const allowed = (o: string | null) => !!o && (extra.includes(o) || ORIGINS.some((r) => r.test(o)));

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BUCKET = "build-files";
const MAX_PHOTO = 12 * 1024 * 1024;
const WEEK = 7 * 24 * 3600;

const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs = 10 * 60_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

type Row = { account_id: string; kind: string; id: string; job_id: string | null; data: Record<string, unknown> };
const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

/** The link with this token, its account, and that account's rows. */
async function open(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const { data: hit } = await db.from("records").select("account_id, data").eq("kind", "share").eq("data->>token", token).maybeSingle();
  if (!hit || !linkLive(hit.data)) return null;
  const q = db.from("records").select("account_id, kind, id, job_id, data").eq("account_id", hit.account_id);
  const [{ data: rows, error }, { data: acct }] = await Promise.all([q.limit(20000), db.from("accounts").select("name").eq("id", hit.account_id).single()]);
  if (error) throw error;
  const saved = fromRecords(rows as Row[]);
  const link = findLink(saved, token);
  if (!link) return null;
  return { accountId: hit.account_id as string, saved, link, company: companyOf(hit.account_id, acct?.name ?? "Your contractor", saved.settings) };
}

/** Signed addresses for stored photos (a comment holds file paths). */
async function sign(paths: string[]): Promise<Map<string, string>> {
  const files = [...new Set(paths.filter((p) => p && !/^(https?:|blob:|data:)/.test(p)))];
  const out = new Map<string, string>(paths.filter((p) => /^(https?:|data:)/.test(p)).map((p) => [p, p]));
  if (!files.length) return out;
  const { data } = await db.storage.from(BUCKET).createSignedUrls(files, WEEK);
  for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl);
  return out;
}
async function photosByPin(comments: { pin_id: string; photos: string[] }[], pins: Set<string>) {
  const mine = comments.filter((c) => pins.has(c.pin_id));
  const urls = await sign(mine.flatMap((c) => c.photos));
  const by: Record<string, string[]> = {};
  for (const c of mine) for (const p of c.photos) { const u = urls.get(p); if (u) (by[c.pin_id] ??= []).push(u); }
  return by;
}

type Msg = { id: string; job_id: string; photos: string[] };
/** A job's thread with addresses to show its photos. */
async function thread(messages: Msg[], jobId: string) {
  const mine = messages.filter((m) => m.job_id === jobId);
  const urls = await sign(mine.flatMap((m) => m.photos));
  return mine.map((m) => ({ ...m, photos: m.photos.map((p) => urls.get(p)).filter(Boolean) }));
}
async function photo(body: Record<string, unknown>) {
  const type = str(body.type, 40) || "image/jpeg";
  if (!/^image\/(jpeg|png|webp|heic|heif|gif)$/.test(type)) return { error: "Send a photo (JPG, PNG or HEIC)." };
  const b64 = typeof body.data === "string" ? body.data : "";
  if (!b64 || b64.length > MAX_PHOTO * 1.37) return { error: "That photo is too big. Try a smaller one." };
  return { type, bytes: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), ext: type.split("/")[1].replace("jpeg", "jpg") };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": allowed(origin) ? origin! : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Not found." }, 404);
  if (!allowed(origin)) return json({ error: "Not allowed from this page." }, 403);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip, 300)) return json({ error: "Too many requests. Give it a minute." }, 429);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const action = str(body.action, 20);

  try {
    if (action === "signup") {
      if (limited(`signup:${ip}`, 10)) return json({ error: "Too many new accounts from here. Try again later." }, 429);
      const email = str(body.email, 200).toLowerCase(), password = typeof body.password === "string" ? body.password : "";
      const name = str(body.name, 80), company = str(body.company, 120);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "That email doesn't look right." }, 400);
      if (password.length < 8 || password.length > 72) return json({ error: "Use a password of at least 8 characters." }, 400);
      const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name || null, company: company || null } });
      if (error) {
        if (/already|registered|exists/i.test(error.message)) return json({ error: "That email already has an account. Sign in instead." }, 409);
        throw error;
      }
      return json({ ok: true });
    }

    const token = str(body.token, 64);
    const o = await open(token);
    if (!o) return json({ error: "This link was turned off or has run out. Ask the contractor for a new one." }, 404);
    const { saved, link, company, accountId } = o;

    if (action === "link") {
      if (link.audience === "client") {
        const view = clientView(link, company, saved, await photosByPin(saved.comments, clientPinIds(link, saved)), await thread(saved.messages, link.job_id));
        return view ? json({ kind: "client", view }) : json({ error: "This job isn't there any more." }, 404);
      }
      const pins = new Set(saved.jobs.flatMap((d: { pins: { id: string }[] }) => d.pins.map((p) => p.id)));
      const work = crewWork(link, company, saved, await photosByPin(saved.comments, pins));
      return work ? json({ kind: "crew", work }) : json({ error: "This link was turned off." }, 404);
    }

    if (action === "photo" || action === "done") {
      if (link.audience === "client") return json({ error: "Not on this link." }, 403);
      const pinId = str(body.pin, 80);
      if (!crewPinIds(link, saved).has(pinId)) return json({ error: "That task isn't on your link." }, 403);
      const job = saved.jobs.find((d: { pins: { id: string }[] }) => d.pins.some((p) => p.id === pinId));
      const pin = job.pins.find((p: { id: string }) => p.id === pinId);
      const pinComments = saved.comments.filter((c: { pin_id: string }) => c.pin_id === pinId);

      if (action === "done") {
        if (pin.close_requirement === "photo" && !pinComments.some((c: { photos: string[] }) => c.photos.length)) return json({ error: "This one needs a photo before it's done. Take the photo first." }, 400);
        const { comment_count: _, ...rest } = pin;
        void _;
        const next = { ...rest, status: "done", closed_at: new Date().toISOString() };
        const { error } = await db.from("records").update({ data: next, updated_at: new Date().toISOString() }).eq("account_id", accountId).eq("kind", "pin").eq("id", pinId);
        if (error) throw error;
        return json({ ok: true });
      }

      if (limited(`photo:${token}`, 60)) return json({ error: "That's a lot of photos at once. Give it a minute." }, 429);
      const f = await photo(body);
      if ("error" in f) return json({ error: f.error }, 400);
      const path = `${accountId}/${job.job.id}/pins/${pinId}/${uid()}.${f.ext}`;
      const up = await db.storage.from(BUCKET).upload(path, f.bytes, { contentType: f.type });
      if (up.error) throw up.error;
      const comment = { id: uid(), pin_id: pinId, author_id: null, author_name: link.label, body: `Photo from ${link.label}`, photos: [path], created_at: new Date().toISOString() };
      const { error } = await db.from("records").insert({ account_id: accountId, kind: "comment", id: comment.id, job_id: job.job.id, data: comment });
      if (error) throw error;
      const by = await photosByPin([...pinComments, comment], new Set([pinId]));
      return json({ photos: by[pinId] ?? [] });
    }

    if (action === "client") {
      if (link.audience !== "client" || !link.job_id) return json({ error: "Not on this link." }, 403);
      const job = saved.jobs.find((d: { job: { id: string } }) => d.job.id === link.job_id);
      if (!job) return json({ error: "This job isn't there any more." }, 404);
      const sent = body.billing as { quotes?: unknown[] } | undefined;
      if (!sent || !Array.isArray(sent.quotes)) return json({ error: "Bad request." }, 400);
      const r = clientBilling(job.billing ?? { quotes: [], invoices: [], payments: [] }, sent);
      if ("error" in r) return json({ error: r.error }, 400);
      const { error } = await db.from("records").upsert({ account_id: accountId, kind: "billing", id: job.job.id, job_id: job.job.id, data: r.billing, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ billing: forClient(r.billing) });
    }

    if (action === "message" || action === "messages") {
      if (link.audience !== "client" || !link.job_id) return json({ error: "Not on this link." }, 403);
      const job = saved.jobs.find((d: { job: { id: string } }) => d.job.id === link.job_id);
      if (!job) return json({ error: "This job isn't there any more." }, 404);
      if (action === "messages") return json({ messages: await thread(saved.messages, job.job.id) });
      if (limited(`message:${token}`, 60)) return json({ error: "That's a lot of messages at once. Give it a minute." }, 429);
      const text = str(body.body, 4000);
      const photos: string[] = [];
      if (body.data) {
        const f = await photo(body);
        if ("error" in f) return json({ error: f.error }, 400);
        const path = `${accountId}/${job.job.id}/messages/${uid()}.${f.ext}`;
        const up = await db.storage.from(BUCKET).upload(path, f.bytes, { contentType: f.type });
        if (up.error) throw up.error;
        photos.push(path);
      }
      if (!text && !photos.length) return json({ error: "Write something or add a photo." }, 400);
      const m = { id: uid(), job_id: job.job.id, from: "client", author_name: job.job.client_name || "Client", body: text || null, photos, created_at: new Date().toISOString() };
      const { error } = await db.from("records").insert({ account_id: accountId, kind: "message", id: m.id, job_id: job.job.id, data: m });
      if (error) throw error;
      return json({ messages: await thread([...saved.messages, m], job.job.id) });
    }

    if (action === "note" || action === "unnote" || action === "got") {
      if (link.audience !== "client" || !link.job_id) return json({ error: "Not on this link." }, 403);
      const at = new Date().toISOString();
      if (action === "got") {
        const id = str(body.id, 80);
        if (!clientBuys(link, saved).has(id)) return json({ error: "That isn't on your list." }, 403);
        const line = saved.materials.find((m: { id: string }) => m.id === id);
        const { error } = await db.from("records").update({ data: { ...line, status: body.undo ? "to_buy" : "got" }, updated_at: at }).eq("account_id", accountId).eq("kind", "material").eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }
      if (action === "unnote") {
        const id = str(body.id, 80);
        const own = (p: { id: string; job_id: string; created_by: string | null }) => p.id === id && p.job_id === link.job_id && p.created_by === "client";
        const kind = saved.notes.some(own) ? "note" : saved.jobs.some((d: { pins: { id: string; job_id: string; created_by: string | null }[] }) => d.pins.some(own)) ? "pin" : null;
        if (!kind) return json({ error: "That note isn't yours." }, 403);
        const { error } = await db.from("records").delete().eq("account_id", accountId).eq("kind", kind).eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }
      if (limited(`note:${token}`, 60)) return json({ error: "That's a lot of notes at once. Give it a minute." }, 429);
      const n = clientNote(link, saved, body.note, uid(), at);
      if (!n) return json({ error: "That note couldn't be added. Give it a title." }, 400);
      const shared = !!(body.note as { shared?: boolean })?.shared;
      const { error } = await db.from("records").insert({ account_id: accountId, kind: shared ? "pin" : "note", id: n.id, job_id: n.job_id, data: n });
      if (error) throw error;
      return json({ note: n, shared });
    }

    return json({ error: "Not found." }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong on our side. Try again in a moment." }, 500);
  }
});
