import Link from "next/link";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <path d="M3 10.5 12 3l9 7.5V21H3z" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M8 21v-6h8v6M3 10.5h18" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <span className="font-display font-bold text-[17px] tracking-[0.12em] uppercase">Rorker</span>
    </span>
  );
}

export function AuthShell({ title, sub, children, demo }: { title: string; sub?: string; children: React.ReactNode; demo?: boolean }) {
  return (
    <main className="min-h-full grid place-items-center px-4 py-10" style={{ background: "radial-gradient(1200px 600px at 70% -10%, #1b2430 0%, var(--ink) 60%)" }}>
      <div className="w-full max-w-[420px]">
        <Link href="/" className="inline-block mb-8"><Logo /></Link>
        <h1 className="font-display text-[26px] font-bold mb-1">{title}</h1>
        {sub && <p className="text-muted mb-6">{sub}</p>}
        {demo && (
          <p className="chip mb-5 !h-auto !py-1.5 !rounded-lg !text-[12.5px] leading-snug">
            Demo mode: no database is connected yet, so data stays on this computer and any email works.
          </p>
        )}
        <div className="card p-6">{children}</div>
      </div>
    </main>
  );
}
