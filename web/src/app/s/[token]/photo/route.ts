// A photo sent from a shared link, without signing in: the person the link is for answers a photo
// request (or shows their work) on one of their own tasks. The link's token is the only key, and the
// photo lands only on a pin that link shows.
import { NextResponse } from "next/server";
import { getRepo } from "@/lib/data";

const MAX = 15 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await req.formData().catch(() => null);
  const pin = form?.get("pin");
  const file = form?.get("photo");
  if (typeof pin !== "string" || !(file instanceof File)) return NextResponse.json({ error: "Pick a photo." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "That isn't a photo." }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "That photo is too big (over 15 MB)." }, { status: 413 });
  const photos = await getRepo().addSharedPhoto(token, pin, file);
  if (!photos) return NextResponse.json({ error: "This link doesn't work any more. Ask whoever sent it for a new one." }, { status: 404 });
  return NextResponse.json({ photos });
}
