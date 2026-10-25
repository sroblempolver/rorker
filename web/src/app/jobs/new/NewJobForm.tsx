"use client";
import { useActionState, useState } from "react";
import { createJob } from "@/app/jobs/actions";
import { JOB_TYPES } from "@/lib/data/templates";

export function NewJobForm({ templates, ai }: { templates: { id: string; name: string; job_type: string; count: number }[]; ai: boolean }) {
  const [state, action, pending] = useActionState(createJob, null);
  const [type, setType] = useState("renovation");
  const [tpl, setTpl] = useState(templates.find((t) => t.job_type === "renovation")?.id ?? templates[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  return (
    <form action={action} className="space-y-6">
      <section className="card p-5 space-y-4">
        <div><label className="label" htmlFor="name">Job name</label><input id="name" name="name" required className="input" placeholder="Hadley Road kitchen" /></div>
        <div><label className="label" htmlFor="address">Address</label><input id="address" name="address" className="input" placeholder="12 Hadley Road" /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="job_type">Type of job</label>
            <select id="job_type" name="job_type" className="input" value={type} onChange={(e) => {
              setType(e.target.value);
              const t = templates.find((x) => x.job_type === e.target.value);
              if (t) setTpl(t.id);
            }}>
              {JOB_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="template_id">Stages</label>
            <select id="template_id" name="template_id" className="input" value={tpl} onChange={(e) => setTpl(e.target.value)}>
              <option value="">No stages for now</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.count} stages)</option>)}
            </select>
          </div>
        </div>
        <div><label className="label" htmlFor="start_date">Start date</label><input id="start_date" name="start_date" type="date" className="input sm:max-w-[220px]" /></div>
      </section>
      <section className="card p-5 space-y-4">
        <p className="eyebrow">Client</p>
        <div><label className="label" htmlFor="client_name">Name</label><input id="client_name" name="client_name" className="input" /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label" htmlFor="client_email">Email</label><input id="client_email" name="client_email" type="email" className="input" /></div>
          <div><label className="label" htmlFor="client_phone">Phone</label><input id="client_phone" name="client_phone" className="input" /></div>
        </div>
      </section>
      <section className="card p-5 space-y-3">
        <p className="eyebrow">Plan</p>
        <label className="block rounded-[4px] border-2 border-dashed border-line p-5 text-center cursor-pointer hover:border-chalk">
          <span className="block text-[14px] mb-1">{file ? file.name : "Add the AutoCAD file, a PDF or a photo of the plan"}</span>
          <span className="block text-[12px] text-muted">Optional. You can add it later from the job.{!ai && " PDFs and photos need the plan reader key; AutoCAD files work without it."}</span>
          <input type="file" name="plan" accept=".dwg,.dxf,.pdf,image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      </section>
      {state?.error && <p className="text-red text-sm">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Creating…" : "Create job"}</button>
    </form>
  );
}
