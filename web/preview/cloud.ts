// Real accounts for the build site: sign-in, loading an account and saving every change. The page keeps
// working on its jobs in memory exactly as the demo does; a saver watches them and writes what changed
// (one row per thing, see supabase/build/) a moment later. Crew and client links go through the `build`
// edge function, which shows them only what their link may see.
import { createClient, type Session } from "@supabase/supabase-js";
import type { JobMessage, PinComment, TeamMessage } from "@/lib/data/types";
import type { PlaceTag } from "@/lib/plan/places";
import { fromRecords, POSTED, recKey, toRecords, type PageSaved, type Rec, type SavedAccount } from "@/lib/cloud/records";

const URL_ = "https://uofdydjfwdsvaribvsfy.supabase.co";
// the publishable key: safe in the page, the security rules decide what it can reach
const KEY = "sb_publishable_WJumqpPot9tvGyBPbpYhcg_pdJYhm7F";
export const BUCKET = "build-files";
export const sb = createClient(URL_, KEY, { auth: { persistSession: true, storageKey: "rorker-build-auth" } });

/** The `build` function: sign-up and everything a no-sign-in link does. */
export async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${URL_}/functions/v1/build`, { method: "POST", headers: { "content-type": "application/json", apikey: KEY }, body: JSON.stringify({ action, ...body }) });
  } catch { throw new Error("Can't reach Rorker. Check your connection and try again."); }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error ?? "Something went wrong. Try again.");
  return j as T;
}

export async function signUp(input: { email: string; password: string; name: string; company: string }) {
  await call("signup", input);
  return signIn(input.email, input.password);
}
export async function signIn(email: string, password: string) {
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(/invalid/i.test(error.message) ? "That email and password don't match." : error.message);
  return data.session;
}
export const signOut = () => sb.auth.signOut();
export async function currentSession(): Promise<Session | null> {
  const { data } = await sb.auth.getSession();
  return data.session;
}

export interface Account { id: string; name: string; memberId: string; role: "admin" | "employee" }

/** The account this person signs in to, made the first time (they're its owner). */
export async function myAccount(s: Session): Promise<{ account: Account; isNew: boolean }> {
  const find = async () => {
    const { data, error } = await sb.from("account_users").select("account_id, member_id, role, accounts(name)").eq("user_id", s.user.id).order("created_at").limit(1).maybeSingle();
    if (error) throw new Error("Couldn't open your account. Try again.");
    return data;
  };
  let row = await find();
  let isNew = false;
  if (!row) {
    const company = (s.user.user_metadata?.company as string | undefined) || "My company";
    const { error } = await sb.rpc("create_account", { account_name: company, owner_member: "m0" });
    if (error) throw new Error("Couldn't set up your company. Try again.");
    row = await find();
    isNew = true;
  }
  if (!row) throw new Error("Couldn't open your account. Try again.");
  const name = (row.accounts as unknown as { name: string } | null)?.name ?? "My company";
  return { account: { id: row.account_id, name, memberId: row.member_id, role: row.role as Account["role"] }, isNew };
}

/** Every saved row of the account. Plans are big, so they come in pages. */
export async function loadAccount(accountId: string): Promise<{ saved: SavedAccount; rows: Rec[] }> {
  const rows: Rec[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await sb.from("records").select("kind, id, job_id, data").eq("account_id", accountId).order("kind").order("id").range(from, from + 499);
    if (error) throw new Error("Couldn't load your jobs. Check your connection and reload.");
    rows.push(...(data as Rec[]));
    if (!data || data.length < 500) break;
  }
  return { saved: fromRecords(rows), rows };
}

export type SaveState = "saved" | "saving" | "error";

/** Writes what changed since the last save, a moment after each change. */
export class Saver {
  private last = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  constructor(private accountId: string, private snapshot: () => PageSaved, private onState: (s: SaveState) => void, loaded: Rec[]) {
    for (const r of loaded) if (!POSTED.includes(r.kind)) this.last.set(recKey(r), JSON.stringify(r.data));
    window.addEventListener("beforeunload", (e) => { if (this.timer || this.running) { e.preventDefault(); } });
  }
  /** something changed: save soon */
  poke(delay = 500) {
    if (this.timer) clearTimeout(this.timer);
    this.onState("saving");
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, delay);
  }
  async flush(): Promise<void> {
    if (this.running) { this.again = true; return this.running; }
    this.running = this.write().finally(() => { this.running = null; });
    await this.running;
    if (this.again) { this.again = false; await this.flush(); }
  }
  private async write() {
    const now = toRecords(this.snapshot());
    const seen = new Set<string>();
    const changed: (Rec & { json: string })[] = [];
    for (const r of now) {
      const k = recKey(r);
      seen.add(k);
      const json = JSON.stringify(r.data);
      if (this.last.get(k) !== json) changed.push({ ...r, json });
    }
    const gone = [...this.last.keys()].filter((k) => !seen.has(k));
    try {
      // a plan is big; keep each request small
      let batch: typeof changed = [], size = 0;
      const send = async () => {
        if (!batch.length) return;
        const { error } = await sb.from("records").upsert(batch.map((r) => ({ account_id: this.accountId, kind: r.kind, id: r.id, job_id: r.job_id, data: r.data, updated_at: new Date().toISOString() })));
        if (error) throw error;
        for (const r of batch) this.last.set(recKey(r), r.json);
        batch = []; size = 0;
      };
      for (const r of changed) { batch.push(r); size += r.json.length; if (size > 1_500_000 || batch.length >= 200) await send(); }
      await send();
      const byKind = new Map<string, string[]>();
      for (const k of gone) { const i = k.indexOf(":"); byKind.set(k.slice(0, i), [...(byKind.get(k.slice(0, i)) ?? []), k.slice(i + 1)]); }
      for (const [kind, ids] of byKind) {
        const { error } = await sb.from("records").delete().eq("account_id", this.accountId).eq("kind", kind).in("id", ids);
        if (error) throw error;
        for (const id of ids) this.last.delete(`${kind}:${id}`);
      }
      this.onState(this.timer ? "saving" : "saved");
    } catch (e) {
      console.error(e);
      this.onState("error");
    }
  }
}

const shortId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const ext = (f: File) => (f.name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? f.type.split("/")[1] ?? "bin").toLowerCase();

/** Store a file under the account: <account>/<job>/<folder>/<id>.<ext>. Returns its path. */
export async function upload(accountId: string, jobId: string, folder: string, f: File): Promise<string> {
  const path = `${accountId}/${jobId}/${folder}/${shortId()}.${ext(f)}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || undefined });
  if (error) throw new Error("Couldn't upload that file. Check your connection and try again.");
  return path;
}

const signed = new Map<string, string>();
/** Addresses to show stored files (good for a week); anything already an address is left as it is. */
export async function fileUrls(paths: string[]): Promise<Map<string, string>> {
  const need = [...new Set(paths.filter((p) => !/^(https?:|blob:|data:)/.test(p) && !signed.has(p)))];
  if (need.length) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(need, 7 * 24 * 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }
  return new Map(paths.map((p) => [p, signed.get(p) ?? p]));
}

/** A pin's thread, fresh from the database (photos sent from a crew link show up here). */
export async function listComments(accountId: string, pinId: string): Promise<PinComment[]> {
  const { data, error } = await sb.from("records").select("data").eq("account_id", accountId).eq("kind", "comment").eq("data->>pin_id", pinId);
  if (error) throw new Error("Couldn't load the thread.");
  const list = (data ?? []).map((r) => r.data as PinComment).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const urls = await fileUrls(list.flatMap((c) => c.photos));
  return list.map((c) => ({ ...c, photos: c.photos.map((p) => urls.get(p) ?? p) }));
}

export async function addComment(accountId: string, jobId: string, c: Omit<PinComment, "id" | "photos" | "created_at">, files: File[]) {
  const photos = await Promise.all(files.map((f) => upload(accountId, jobId, `pins/${c.pin_id}`, f)));
  const row: PinComment = { ...c, id: shortId(), photos, created_at: new Date().toISOString() };
  const { error } = await sb.from("records").insert({ account_id: accountId, kind: "comment", id: row.id, job_id: jobId, data: row });
  if (error) throw new Error("Couldn't post that. Check your connection and try again.");
}

/** Messages written straight in (the sample job's thread on a new account). */
export async function putMessages(accountId: string, list: JobMessage[]) {
  if (!list.length) return;
  const { error } = await sb.from("records").insert(list.map((m) => ({ account_id: accountId, kind: "message", id: m.id, job_id: m.job_id, data: m })));
  if (error) console.error(error);
}

/** A file as base64, to send through the function (crew photos). Big phone photos are shrunk first. */
export async function photoData(f: File): Promise<{ type: string; data: string }> {
  let blob: Blob = f;
  if (f.size > 2_500_000 && /^image\/(jpeg|png|webp)$/.test(f.type)) {
    try {
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("shrink"))), "image/jpeg", 0.85));
    } catch { blob = f; }
  }
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { type: blob.type || "image/jpeg", data: btoa(s) };
}

/** A job's thread with its client, fresh from the database (the client writes from their link). */
export async function listMessages(accountId: string, jobId: string): Promise<JobMessage[]> {
  const { data, error } = await sb.from("records").select("data").eq("account_id", accountId).eq("kind", "message").eq("job_id", jobId);
  if (error) throw new Error("Couldn't load the messages.");
  const list = (data ?? []).map((r) => r.data as JobMessage).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const urls = await fileUrls(list.flatMap((m) => m.photos));
  return list.map((m) => ({ ...m, photos: m.photos.map((p) => urls.get(p) ?? p) }));
}

export async function addMessage(accountId: string, jobId: string, author: string, body: string, file: File | null, places: PlaceTag[]) {
  const photos = file ? [await upload(accountId, jobId, "messages", file)] : [];
  const m: JobMessage = { id: shortId(), job_id: jobId, from: "contractor", author_name: author, body: body || null, photos, created_at: new Date().toISOString(), ...(places.length ? { places } : {}) };
  const { error } = await sb.from("records").insert({ account_id: accountId, kind: "message", id: m.id, job_id: jobId, data: m });
  if (error) throw new Error("Couldn't send that. Check your connection and try again.");
}

/** The team board, fresh from the database (crew answer from their links). */
export async function listTeam(accountId: string): Promise<TeamMessage[]> {
  const { data, error } = await sb.from("records").select("data").eq("account_id", accountId).eq("kind", "team");
  if (error) throw new Error("Couldn't load the messages.");
  const list = (data ?? []).map((r) => r.data as TeamMessage).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const urls = await fileUrls(list.flatMap((m) => m.photos));
  return list.map((m) => ({ ...m, photos: m.photos.map((p) => urls.get(p) ?? p) }));
}

/** The office writes to everyone (to = null) or to picked people. */
export async function addTeamMessage(accountId: string, author: string, to: string[] | null, body: string, file: File | null) {
  const photos = file ? [await upload(accountId, "team", "messages", file)] : [];
  const m: TeamMessage = { id: shortId(), from: "office", author_name: author, member_id: null, to, body: body || null, photos, created_at: new Date().toISOString() };
  const { error } = await sb.from("records").insert({ account_id: accountId, kind: "team", id: m.id, job_id: null, data: m });
  if (error) throw new Error("Couldn't send that. Check your connection and try again.");
}
