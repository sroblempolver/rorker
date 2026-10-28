import Link from "next/link";
import { signOut } from "@/app/auth-actions";
import type { Session } from "@/lib/data/types";
import { Logo } from "./AuthShell";
import { AppGoTo } from "./AppGoTo";

export function AppShell({ session, children, demo, active, fill }: { session: Session; children: React.ReactNode; demo: boolean; active: "jobs" | "team" | "settings"; fill?: boolean }) {
  const c = session.company;
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} className={`px-3 h-9 inline-flex items-center rounded-[3px] font-display text-[15px] font-bold tracking-[0.1em] uppercase ${on ? "text-accent bg-panel-2" : "text-muted hover:text-text"}`}>{label}</Link>
  );
  return (
    <div className={fill ? "min-h-full lg:h-full flex flex-col" : "min-h-full flex flex-col"}>
      <header className="h-14 shrink-0 border-b border-line bg-panel/80 backdrop-blur sticky top-0 z-20 flex items-center gap-4 px-4">
        <Link href="/jobs"><Logo size={20} /></Link>
        <nav className="flex items-center gap-1 ml-2">{tab("/jobs", "Jobs", active === "jobs")}{tab("/settings/team", "Team", active === "team")}{tab("/settings", "Company", active === "settings")}</nav>
        <div className="ml-auto flex items-center gap-3 min-w-0">
          <AppGoTo />
          {demo && <span className="chip hidden sm:inline-flex">Demo mode</span>}
          {c && (
            <span className="hidden md:inline-flex items-center gap-2 text-sm text-muted min-w-0">
              {c.logo_url ? <img src={c.logo_url} alt="" className="w-6 h-6 rounded object-contain bg-ink" /> : <span className="w-6 h-6 rounded grid place-items-center text-[11px] font-bold" style={{ background: c.brand_color, color: "#111" }}>{c.name.slice(0, 1)}</span>}
              <span className="truncate max-w-[180px]">{c.name}</span>
            </span>
          )}
          <form action={signOut}><button className="btn btn-ghost btn-sm">Sign out</button></form>
        </div>
      </header>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}
