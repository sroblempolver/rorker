// Sign-in gate for build.rorker.com on Vercel. Every page and file needs a signed-in Rorker account
// whose email is in ALLOWED_EMAILS (Vercel project setting, comma separated). Open without sign-in:
// the sign-in page itself, /link/ (share links for crew and clients) and the icons.

export const config = {
  matcher: "/((?!signin/|link/|favicon|apple-touch-icon|icon-512|og\\.png).*)",
};

const SUPABASE = "https://uofdydjfwdsvaribvsfy.supabase.co";
const KEY = "sb_publishable_WJumqpPot9tvGyBPbpYhcg_pdJYhm7F"; // public key, the same one the pages use
const COOKIE = "rk_session";

const checked = new Map<string, number>(); // token -> expiry (ms), kept while this instance lives

const allowed = () =>
  (process.env.ALLOWED_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

function readCookie(header: string | null, name: string) {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function claims(token: string): { exp?: number; email?: string } | null {
  try {
    const b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b + "=".repeat((4 - (b.length % 4)) % 4)));
  } catch {
    return null;
  }
}

/** "ok", "denied" (a real account that is not on the list) or "none" (no session or expired). */
async function check(token: string | null): Promise<"ok" | "denied" | "none"> {
  if (!token) return "none";
  const c = claims(token);
  if (!c?.exp || c.exp * 1000 < Date.now()) return "none";
  const known = checked.get(token);
  if (known && known > Date.now()) return "ok";
  // The token's signature is checked by Supabase itself, so a made-up token never passes.
  const r = await fetch(`${SUPABASE}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!r?.ok) return "none";
  const email = String((await r.json()).email ?? "").toLowerCase();
  if (!allowed().includes(email)) return "denied";
  if (checked.size > 500) checked.clear();
  checked.set(token, c.exp * 1000);
  return "ok";
}

export default async function middleware(req: Request) {
  const url = new URL(req.url);
  const state = await check(readCookie(req.headers.get("cookie"), COOKIE));
  if (state === "ok") return new Response(null, { headers: { "x-middleware-next": "1" } });
  const to = new URL("/signin/", url);
  to.searchParams.set("next", url.pathname + url.search);
  if (state === "denied") to.searchParams.set("denied", "1");
  return new Response(null, { status: 307, headers: { Location: to.toString(), "Cache-Control": "no-store" } });
}
