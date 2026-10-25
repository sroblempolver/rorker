// A shared job link: opens without signing in and shows only what the link was made for.
import type { Metadata } from "next";
import { getRepo } from "@/lib/data";
import { SharedJob } from "@/components/share/SharedJob";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared job · Rorker", robots: { index: false, follow: false } };

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getRepo().getSharedView(token);
  if (!view) return (
    <main className="min-h-screen grid place-items-center p-6 bg-ink">
      <div className="card p-8 max-w-sm text-center">
        <p className="font-display text-lg font-bold mb-1">This link doesn&apos;t work any more</p>
        <p className="text-muted text-sm">It was switched off or it ran out. Ask whoever sent it for a new one.</p>
      </div>
    </main>
  );
  return <main className="h-screen flex flex-col bg-ink"><SharedJob view={view} /></main>;
}
