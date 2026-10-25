// Serves uploaded files in local demo mode only. With Supabase, files come from signed storage URLs.
import fs from "node:fs/promises";
import path from "node:path";
import { getSession, isDemo } from "@/lib/data";
import { demoFilePath } from "@/lib/data/demo-repo";

const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf", ".svg": "image/svg+xml" };

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!isDemo()) return new Response("Not found", { status: 404 });
  const s = await getSession();
  const rel = (await params).path.join("/");
  if (!s?.company || !rel.startsWith(s.company.id + "/")) return new Response("Not found", { status: 404 });
  try {
    const file = demoFilePath(rel);
    const buf = await fs.readFile(file);
    const ext = path.extname(file).toLowerCase();
    return new Response(new Uint8Array(buf), { headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "private, max-age=3600" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
