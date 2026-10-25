"use client";
import { useActionState, useState } from "react";
import type { Company } from "@/lib/data/types";

type State = { error?: string; message?: string } | undefined;

export function CompanyForm({ action, company, submitLabel }: { action: (s: State, f: FormData) => Promise<State>; company?: Company; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [color, setColor] = useState(company?.brand_color ?? "#ff6a1f");
  const [preview, setPreview] = useState<string | null>(company?.logo_url ?? null);
  return (
    <form action={formAction} className="space-y-4">
      <div><label className="label" htmlFor="cname">Company name</label><input id="cname" name="name" required className="input" defaultValue={company?.name} /></div>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-[4px] border border-line bg-ink grid place-items-center overflow-hidden shrink-0">
          {preview ? <img src={preview} alt="Logo preview" className="max-w-full max-h-full object-contain" /> : <span className="text-muted text-xs">Logo</span>}
        </div>
        <div className="min-w-0">
          <label className="btn btn-sm cursor-pointer">Upload logo
            <input type="file" name="logo" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPreview(URL.createObjectURL(f)); }} />
          </label>
          <p className="text-xs text-muted mt-1">PNG or SVG, square works best.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" className="input" defaultValue={company?.phone ?? ""} /></div>
        <div><label className="label" htmlFor="cemail">Email</label><input id="cemail" name="email" type="email" className="input" defaultValue={company?.email ?? ""} /></div>
        <div><label className="label" htmlFor="lic">Licence number</label><input id="lic" name="license_no" className="input" defaultValue={company?.license_no ?? ""} /></div>
        <div><label className="label" htmlFor="web">Website</label><input id="web" name="website" className="input" defaultValue={company?.website ?? ""} /></div>
      </div>
      <div>
        <label className="label" htmlFor="color">Brand colour</label>
        <div className="flex items-center gap-3">
          <input id="color" name="brand_color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 rounded-[4px] bg-ink border border-line p-1" />
          <span className="text-sm text-muted">Used on client links, reports and quotes.</span>
        </div>
      </div>
      {state?.error && <p className="text-red text-sm">{state.error}</p>}
      {state?.message && <p className="text-green text-sm">{state.message}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
