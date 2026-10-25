// Stand-in for next/link inside the standalone preview.
import type { AnchorHTMLAttributes } from "react";
export default function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href} {...rest} onClick={(e) => { onClick?.(e); e.preventDefault(); window.dispatchEvent(new CustomEvent("preview-nav", { detail: href })); }} />;
}
