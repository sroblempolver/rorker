import Link from "next/link";

export function Logo({ size = 22 }: { size?: number }) {
  // the Talking Plan mark: a speech bubble drawn as plan walls with a doorway. Below 24 px we use its
  // small cut (no door swing); the wordmark is the custom stencil lettering from the brand kit.
  return (
    <span className="inline-flex items-center gap-2" aria-label="Rorker">
      <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden>
        <path fill="var(--accent)" d="M28 32H228V84H200V60H56V170H200V140H228V200H108L64 244V200H28Z" />
      </svg>
      <svg height={size * 0.72} width={size * 0.72 * 4.28} viewBox="0 0 428 100" aria-hidden>
        <g fill="currentColor" fillRule="evenodd">
          <path transform="translate(0 0)" d="M0 0H22V100H0Z M28 0H30A30 30 0 0 1 30 62H28Z M28 20H30A10 10.5 0 0 1 30 41H28Z M30 68H52L62 100H40Z" />
          <path transform="translate(74 0)" d="M27 0A27 30 0 0 0 0 30V70A27 30 0 0 0 27 100V78A5 8 0 0 1 22 70V30A5 8 0 0 1 27 22Z M33 0A27 30 0 0 1 60 30V70A27 30 0 0 1 33 100V78A5 8 0 0 0 38 70V30A5 8 0 0 0 33 22Z" />
          <path transform="translate(146 0)" d="M0 0H22V100H0Z M28 0H30A30 30 0 0 1 30 62H28Z M28 20H30A10 10.5 0 0 1 30 41H28Z M30 68H52L62 100H40Z" />
          <path transform="translate(220 0)" d="M0 0H22V100H0Z M28 50L40 0H62L46 50Z M28 50H46L62 100H40Z" />
          <path transform="translate(294 0)" d="M0 0H22V100H0Z M28 0H60V20H28Z M28 40H54V60H28Z M28 80H60V100H28Z" />
          <path transform="translate(366 0)" d="M0 0H22V100H0Z M28 0H30A30 30 0 0 1 30 62H28Z M28 20H30A10 10.5 0 0 1 30 41H28Z M30 68H52L62 100H40Z" />
        </g>
      </svg>
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
