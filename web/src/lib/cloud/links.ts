// What a no-sign-in link opens, built from an account's saved rows. The `build` edge function runs this
// (with the service key) so crew and clients never read the tables themselves.
import type { Billing, Brand, DocJob } from "@/lib/billing/types";
import { forClient } from "@/lib/billing/clientGuard";
import { clientMemberId, type ClientNoteInput, type Company, type JobMessage, type Pin, type ShareLink, type SharedView, type SharedWork, type StageStatus } from "@/lib/data/types";
import { linkLive, linkPins, shareView, shareWork } from "@/lib/share";
import type { SavedAccount, Settings } from "./records";

/** What a client's link shows: their job's progress, the 3D/2D plan with what's tagged to them (things to
 *  look at) and its photos, their shopping list, their own notes, their thread with the contractor, and
 *  their money page. No crew task list, no costs. */
export interface ClientView {
  company: SharedWork["company"];
  brand: Brand;
  job: DocJob & { id: string };
  stages: { name: string; status: StageStatus }[];
  billing: Billing;
  /** the plan and the pins tagged to the client, with their photos (null for an old link without a plan) */
  view: SharedView | null;
  /** the thread with the contractor, oldest first; photos are addresses to show */
  messages: JobMessage[];
  /** their private notes on the map (shared ones are pins in `view`) */
  notes: Pin[];
  /** the contractor lets them add notes the contractor sees */
  can_add: boolean;
}

export function companyOf(accountId: string, name: string, s: Settings | null): Company {
  return { id: accountId, name: s?.brand.name || name, logo_url: s?.brand.logo_url ?? null, brand_color: s?.brand.brand_color || "#ff6a1f", phone: s?.brand.phone ?? s?.phone ?? null, email: s?.brand.email ?? null, license_no: s?.brand.license_no ?? null, website: null, address: s?.brand.address ?? null };
}

export const findLink = (a: SavedAccount, token: string) => a.shares.find((l) => l.token === token) ?? null;

/** A crew link: the plan and their tasks, on one job or (a person's own link) every job. */
export function crewWork(l: ShareLink, company: Company, a: SavedAccount, photos: Record<string, string[]>): SharedWork | null {
  return shareWork(l, company, a.jobs.map((d) => ({
    company, job: d.job, plan: d.plan?.data ?? null, edits: d.edits, items: d.items, pins: d.pins, stages: d.stages, members: a.members,
    photos, materials: a.materials.filter((m) => m.job_id === d.job.id),
  })));
}

/** The pins a crew link may post photos on or close: only theirs, never the crew's other work. */
export function crewPinIds(l: ShareLink, a: SavedAccount): Set<string> {
  if (!linkLive(l) || l.audience === "client") return new Set();
  return new Set(a.jobs.filter((d) => !l.job_id || d.job.id === l.job_id).flatMap((d) => linkPins(l, d.pins).map((p) => p.id)));
}

/** The pins a client's link shows (and the photos on them): the ones tagged to the job's client. */
export function clientPinIds(l: ShareLink, a: SavedAccount): Set<string> {
  const d = a.jobs.find((x) => x.job.id === l.job_id);
  return new Set(d ? d.pins.filter((p) => p.tagged.includes(clientMemberId(d.job.id))).map((p) => p.id) : []);
}

/** photos: addresses by pin id, for the client's pins; messages: the job's thread with addresses */
export function clientView(l: ShareLink, company: Company, a: SavedAccount, photos: Record<string, string[]> = {}, messages: JobMessage[] = []): ClientView | null {
  if (!linkLive(l) || l.audience !== "client") return null;
  const d = a.jobs.find((x) => x.job.id === l.job_id);
  if (!d) return null;
  const brand: Brand = a.settings?.brand ?? { name: company.name, logo_url: company.logo_url, brand_color: company.brand_color, phone: company.phone, email: null, address: null, license_no: null, tier: "standard" };
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
      const v = shareView({ ...l, audience: "crew", job_id: d.job.id, member_id: clientMemberId(d.job.id), pin_ids: [] },
        { company, job: d.job, plan: d.plan?.data ?? null, edits: d.edits, items: d.items, pins: d.pins, stages: d.stages, members: a.members, photos, materials: a.materials.filter((m) => m.job_id === d.job.id) });
      // the link hides who made each pin; the client's own shared notes stay marked as theirs
      const theirs = new Set(d.pins.filter((p) => p.created_by === "client").map((p) => p.id));
      return v && { ...v, label: d.job.client_name || "you", pins: v.pins.map((p) => (theirs.has(p.id) ? { ...p, created_by: "client" } : p)) };
    })(),
    messages,
    notes: a.notes.filter((n) => n.job_id === d.job.id),
    can_add: !!d.job.client_can_add,
  };
}

/** The material lines a client's link may tick off: the ones they're buying. */
export function clientBuys(l: ShareLink, a: SavedAccount): Set<string> {
  if (!linkLive(l) || l.audience !== "client" || !l.job_id) return new Set();
  const me = clientMemberId(l.job_id);
  return new Set(a.materials.filter((m) => m.job_id === l.job_id && m.buyer === me).map((m) => m.id));
}

/** A note from the client's link as a pin: checked and trimmed; null when it can't be made. Shared
 *  notes need the job to allow them, and get the next pin number on the job. */
export function clientNote(l: ShareLink, a: SavedAccount, n: ClientNoteInput, id: string, at: string): Pin | null {
  const d = a.jobs.find((x) => x.job.id === l.job_id);
  if (!d || !linkLive(l) || l.audience !== "client" || typeof n?.title !== "string") return null;
  const title = n.title.trim().slice(0, 140);
  if (!title || (n.shared && !d.job.client_can_add)) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const floor = str(n.floor_id, 80);
  const anchor = n.anchor && typeof n.anchor === "object" && ["site", "exterior", "wall", "point"].includes(n.anchor.view) && num(n.anchor.x) !== null && num(n.anchor.y) !== null
    ? { view: n.anchor.view, x: n.anchor.x, y: n.anchor.y, ...(num(n.anchor.z) !== null ? { z: n.anchor.z } : {}), ...(str(n.anchor.side, 80) ? { side: str(n.anchor.side, 80)! } : {}) } : null;
  const mine = a.notes.filter((x) => x.job_id === d.job.id);
  return {
    id, job_id: d.job.id, number: 1 + Math.max(0, ...(n.shared ? d.pins : mine).map((p) => p.number)),
    element_id: str(n.element_id, 80), floor_id: floor && d.plan?.data.floors.some((f) => f.id === floor) ? floor : null,
    x: num(n.x), y: num(n.y), anchor, kind: "note", title, body: str(n.body, 2000), status: "open", priority: 1, due_date: null,
    tagged: [clientMemberId(d.job.id)], close_requirement: "confirm", stage_id: null, links: [], created_by: "client", created_at: at, closed_at: null,
  };
}
