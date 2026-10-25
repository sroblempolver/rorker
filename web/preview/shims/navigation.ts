// Stand-in for next/navigation inside the standalone preview.
export function useRouter() {
  return { push: (href: string) => window.dispatchEvent(new CustomEvent("preview-nav", { detail: href })), refresh() {}, back() {} };
}
export function redirect(href: string): never {
  window.dispatchEvent(new CustomEvent("preview-nav", { detail: href }));
  throw new Error("redirect");
}
