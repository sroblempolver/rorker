// The top and bottom of every document a client sees. Standard plans: the contractor's logo and details,
// with a small "Powered by Rorker" line. Premium: the contractor only.
import type { Brand } from "@/lib/billing/types";

export function BrandHeader({ brand }: { brand: Brand }) {
  return (
    <div className="flex items-start gap-3">
      {brand.logo_url
        ? <img src={brand.logo_url} alt="" className="h-12 w-auto max-w-[160px] object-contain" />
        : <span className="h-12 w-12 rounded-[6px] grid place-items-center text-white font-bold text-xl shrink-0" style={{ background: brand.brand_color }}>{brand.name.slice(0, 1)}</span>}
      <div className="min-w-0 text-[12.5px] leading-snug text-neutral-500">
        <p className="text-[16px] font-semibold text-neutral-900">{brand.name}</p>
        {[brand.address, [brand.phone, brand.email].filter(Boolean).join(" · "), brand.license_no && `Lic. ${brand.license_no}`].filter(Boolean).map((t) => <p key={t as string}>{t}</p>)}
      </div>
    </div>
  );
}

export function PoweredBy({ brand }: { brand: Brand }) {
  if (brand.tier === "premium") return null;
  return <p className="text-center text-[11px] text-neutral-400 pt-4">Powered by <span className="font-semibold tracking-wide">Rorker</span></p>;
}

/** The light "paper" a document sits on, so quotes and invoices look like documents, not app screens. */
export function Paper({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white text-neutral-800 rounded-[6px] shadow-[0_8px_30px_rgb(0_0_0/.35)] p-5 sm:p-8 ${className}`}>{children}</div>;
}
