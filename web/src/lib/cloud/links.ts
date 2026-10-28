// What a no-sign-in link opens, built from an account's saved rows. The `build` edge function runs this
// (with the service key) so crew and clients never read the tables themselves.
import type { Billing, Brand, DocJob } from "@/lib/billing/types";
import { forClient } from "@/lib/billing/clientGuard";
import type { Company, ShareLink, SharedWork, StageStatus } from "@/lib/data/types";
import { linkLive, linkPins, shareWork } from "@/lib/share";
import type { SavedAccount, Settings } from "./records";

/** What a client's link shows: their job's progress and their money page. No crew, tasks or costs. */
export interface ClientView {
  company: SharedWork["company"];
  brand: Brand;
  job: DocJob & { id: string };
  stages: { name: string; status: StageStatus }[];
  billing: Billing;
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

export function clientView(l: ShareLink, company: Company, a: SavedAccount): ClientView | null {
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
  };
}
