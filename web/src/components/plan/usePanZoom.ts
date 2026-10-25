"use client";
// Pan and zoom for an SVG viewBox: wheel zoom follows the mouse, drag pans, two-finger pinch zooms,
// and animateTo() glides the camera to a box. Zooming against a limit calls onLimit, which the plan
// uses to step up or down a level (building -> floor -> room -> wall).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface View { x: number; y: number; w: number; h: number }
type Box = { x: number; y: number; w: number; h: number };

interface Opts {
  minScale?: number; // relative to the fitted "home" box
  maxScale?: number;
  padding?: number; // fraction of the box added around it when fitting
  onLimit?: (dir: "in" | "out", at: { x: number; y: number }) => void;
}

function fit(box: Box, aspect: number, pad: number): View {
  const w0 = box.w * (1 + pad * 2), h0 = box.h * (1 + pad * 2);
  let w = w0, h = h0;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return { x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2, w, h };
}

export function usePanZoom(ref: React.RefObject<SVGSVGElement | null>, home: Box, opts: Opts = {}) {
  const { minScale = 0.8, maxScale = 12, padding = 0.06 } = opts;
  const [aspect, setAspect] = useState(1.6);
  const [widthPx, setWidthPx] = useState(1000);
  const [view, setView] = useState<View>(() => fit(home, 1.6, padding));
  const viewRef = useRef(view);
  viewRef.current = view;
  const homeRef = useRef(home);
  const anim = useRef<number | null>(null);
  const onLimit = useRef(opts.onLimit);
  onLimit.current = opts.onLimit;
  const limitCooldown = useRef(0);
  const [dragging, setDragging] = useState(false);
  const moved = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) { setAspect(r.width / r.height); setWidthPx(r.width); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  // keep the camera's centre and zoom when the container changes shape
  useEffect(() => {
    setView((v) => {
      const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
      const w = Math.max(v.w, v.h * aspect) === v.w ? v.w : v.h * aspect;
      const h = w / aspect;
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    });
  }, [aspect]);

  const homeView = useCallback(() => fit(homeRef.current, aspect, padding), [aspect, padding]);
  const limits = useCallback(() => {
    const hv = homeView();
    return { maxW: hv.w / minScale, minW: hv.w / maxScale };
  }, [homeView, minScale, maxScale]);

  const animateTo = useCallback((box: Box, pad = padding, ms = 520) => {
    const target = fit(box, aspect, pad);
    const start = { ...viewRef.current };
    const t0 = performance.now();
    if (anim.current) cancelAnimationFrame(anim.current);
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = (t: number) => {
      const k = reduce ? 1 : Math.min(1, (t - t0) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      // interpolate in log space for zoom so it feels even
      const w = Math.exp(Math.log(start.w) + (Math.log(target.w) - Math.log(start.w)) * e);
      const h = w / aspect;
      const cx = start.x + start.w / 2 + (target.x + target.w / 2 - (start.x + start.w / 2)) * e;
      const cy = start.y + start.h / 2 + (target.y + target.h / 2 - (start.y + start.h / 2)) * e;
      setView({ x: cx - w / 2, y: cy - h / 2, w, h });
      if (k < 1) anim.current = requestAnimationFrame(step);
      else anim.current = null;
    };
    anim.current = requestAnimationFrame(step);
  }, [aspect, padding]);

  const setHome = useCallback((box: Box, animate = true, pad = padding) => {
    homeRef.current = box;
    if (animate) animateTo(box, pad);
    else setView(fit(box, aspect, pad));
  }, [animateTo, aspect, padding]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    const v = viewRef.current;
    return { x: v.x + ((clientX - r.left) / r.width) * v.w, y: v.y + ((clientY - r.top) / r.height) * v.h };
  }, [ref]);

  const zoomAt = useCallback((factor: number, clientX: number, clientY: number) => {
    if (anim.current) { cancelAnimationFrame(anim.current); anim.current = null; }
    const { maxW, minW } = limits();
    const v = viewRef.current;
    const p = toWorld(clientX, clientY);
    let w = v.w / factor;
    const hitOut = w > maxW * 1.0001, hitIn = w < minW * 0.9999;
    w = Math.min(maxW, Math.max(minW, w));
    if ((hitOut || hitIn) && onLimit.current && performance.now() > limitCooldown.current) {
      limitCooldown.current = performance.now() + 650;
      onLimit.current(hitIn ? "in" : "out", p);
      return;
    }
    const h = w / aspect;
    const fx = (p.x - v.x) / v.w, fy = (p.y - v.y) / v.h;
    setView({ x: p.x - fx * w, y: p.y - fy * h, w, h });
  }, [aspect, limits, toWorld]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref, zoomAt]);

  // pointers: one = pan, two = pinch
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ x: number; y: number; dist?: number } | null>(null);
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved.current = false;
      last.current = { x: e.clientX, y: e.clientY };
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        last.current = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId) || !last.current) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const el = ref.current!;
      const r = el.getBoundingClientRect();
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (last.current.dist) zoomAt(dist / last.current.dist, mid.x, mid.y);
        last.current = { ...mid, dist };
        moved.current = true;
        return;
      }
      const dx = e.clientX - last.current.x, dy = e.clientY - last.current.y;
      if (!moved.current && Math.hypot(dx, dy) < 5) return;
      if (!moved.current) {
        moved.current = true;
        setDragging(true);
        el.setPointerCapture(e.pointerId);
      }
      if (anim.current) { cancelAnimationFrame(anim.current); anim.current = null; }
      const v = viewRef.current;
      setView({ ...v, x: v.x - (dx / r.width) * v.w, y: v.y - (dy / r.height) * v.h });
      last.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 0) { last.current = null; setDragging(false); }
    },
    onPointerCancel: (e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId);
      last.current = null;
      setDragging(false);
    },
    // swallow the click that ends a drag
    onClickCapture: (e: React.MouseEvent) => {
      if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false; }
    },
  };

  const zoomBy = (f: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    zoomAt(f, r.left + r.width / 2, r.top + r.height / 2);
  };

  return { view, handlers, dragging, animateTo, setHome, zoomBy, toWorld, scale: homeView().w / view.w, px: view.w / widthPx };
}
