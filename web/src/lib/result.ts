// Server actions lose their error message in production builds (Next hides it), so actions whose
// message matters to the user return { error } instead of throwing, and the client re-throws it.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() }; } catch (e) {
    // redirect() and notFound() must keep propagating
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function unwrap<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
