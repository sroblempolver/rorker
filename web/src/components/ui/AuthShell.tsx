import Link from "next/link";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      {/* a survey stake with its flag: the mark you put on a site */}
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <rect x="1" y="1" width="22" height="22" rx="2" fill="var(--accent)" />
        <path d="M8 19V5" stroke="var(--accent-ink)" strokeWidth="2.4" strokeLinecap="square" />
        <path d="M9 5h9l-2.5 3.2L18 11.5H9z" fill="var(--accent-ink)" />
      </svg>
      <span className="font-stencil font-extrabold leading-none tracking-[0.1em] uppercase" style={{ fontSize: size * 1.05 }}>Rorker</span>
    </span>
  );
}

export function AuthShell({ title, sub, children, demo }: { title: string; sub?: string; children: React.ReactNode; demo?: boolean }) {
  return (
    <main className="min-h-full grid place-items-center px-4 py-10" style={{ background: "radial-gradient(900px 500px at 75% -10%, rgb(255 106 31 / 0.10) 0%, transparent 60%), repeating-linear-gradient(0deg, transparent 0 39px, rgb(255 255 255 / 0.025) 39px 40px), repeating-linear-gradient(90deg, transparent 0 39px, rgb(255 255 255 / 0.025) 39px 40px), var(--ink)" }}>
      <div className="w-full max-w-[420px]">
        <Link href="/" className="inline-block mb-8"><Logo /></Link>
        <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em] mb-1">{title}</h1>
        {sub && <p className="text-muted mb-6">{sub}</p>}
        {demo && (
          <p className="chip mb-5 !h-auto !py-1.5 !text-[12.5px] leading-snug">
            Demo mode: no database is connected yet, so data stays on this computer and any email works.
          </p>
        )}
        <div className="card p-6 border-t-[3px] !border-t-accent">{children}</div>
      </div>
    </main>
  );
}
