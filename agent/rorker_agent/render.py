"""PNG renders of a Plan: annotated floors for the AI to look at, and previews for test reports."""
from __future__ import annotations

import io
import math

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Arc, Polygon as MPoly, Rectangle  # noqa: E402

from .schema import Floor, Plan  # noqa: E402

PALETTE = ["#cfe3f5", "#f8dcc5", "#d9efd2", "#efd5ec", "#f3efc4", "#d5ecec", "#e6dcf5", "#f5d6d6"]


def render_floor(floor: Floor, *, annotate: str = "ids", px: int = 2400, crop=None,
                 highlight: set[str] | None = None) -> bytes:
    """annotate: "ids" (room + fixture IDs, for the AI), "names" (room names, for people)."""
    x0, y0, x1, y1 = crop or floor.bounds
    pad = 600 if crop is None else 300
    x0, y0, x1, y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
    w, h = x1 - x0, y1 - y0
    inch = px / 100
    fig = plt.figure(figsize=(inch, inch * h / w), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(x0, x1)
    ax.set_ylim(y1, y0)  # y down
    ax.set_aspect("equal")
    ax.axis("off")
    scale = px / w  # pixels per mm
    fs = max(7, min(16, 260 * scale))

    for i, r in enumerate(floor.rooms):
        ax.add_patch(MPoly(r.polygon, closed=True, fc=PALETTE[i % len(PALETTE)], ec="none", zorder=1))
    for wl in floor.walls:
        ax.add_patch(MPoly(wl.polygon, closed=True, fc="#2b2f36", ec="none", zorder=3))
    for o in floor.openings:
        col = {"window": "#5ab4e5", "opening": "#f2f2f2"}.get(o.kind, "#ffffff")
        ax.add_patch(MPoly(o.polygon, closed=True, fc=col, ec="#2b2f36", lw=0.4, zorder=3))
        for lf in o.leaves:
            ax.add_patch(Arc(lf.hinge, 2 * lf.radius, 2 * lf.radius, theta1=-lf.end_angle, theta2=-lf.start_angle,
                             lw=0.8, color="#c0392b", zorder=4))
    for st in floor.stairs:
        for ln in st.outline:
            ax.plot([p[0] for p in ln], [p[1] for p in ln], color="#27703e", lw=0.6, zorder=4)
    for fx in floor.fixtures:
        unknown = fx.kind == "other"
        col = "#b0207a" if unknown else "#1f4e9c"
        for ln in fx.outline:
            ax.plot([p[0] for p in ln], [p[1] for p in ln], color=col, lw=0.7, zorder=5)
        if annotate == "ids" and (unknown or fx.confidence < 0.8 or (highlight and fx.id in highlight)):
            bx = fx.bbox
            ax.add_patch(Rectangle((bx[0], bx[1]), bx[2] - bx[0], bx[3] - bx[1], fill=False, ec=col, lw=0.6,
                                   ls="--", zorder=6))
            ax.text(bx[0], bx[1] - 40, fx.id.split("-", 1)[1], fontsize=fs * 0.6, color=col, zorder=7,
                    va="bottom", ha="left", weight="bold")
    for r in floor.rooms:
        cx = sum(p[0] for p in r.polygon) / len(r.polygon)
        cy = sum(p[1] for p in r.polygon) / len(r.polygon)
        if crop and not (crop[0] <= cx <= crop[2] and crop[1] <= cy <= crop[3]):
            continue
        label = f"{r.id}\n{r.name}" if annotate == "ids" else r.name
        ax.text(cx, cy, label, fontsize=fs * 0.75, ha="center", va="center", zorder=8, color="#111",
                bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="none", alpha=0.75))
    buf = io.BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    return buf.getvalue()


def room_crop(floor: Floor, room_id: str) -> tuple[float, float, float, float]:
    r = next(r for r in floor.rooms if r.id == room_id)
    xs = [p[0] for p in r.polygon]
    ys = [p[1] for p in r.polygon]
    return (min(xs), min(ys), max(xs), max(ys))


def render_plan_sheet(plan: Plan, px: int = 1600) -> bytes:
    """All floors side by side with room names, for reports."""
    imgs = [plt.imread(io.BytesIO(render_floor(f, annotate="names", px=px))) for f in plan.floors]
    n = len(imgs)
    fig, axs = plt.subplots(1, n, figsize=(8 * n, 8), dpi=100)
    axs = [axs] if n == 1 else axs
    for ax, im, f in zip(axs, imgs, plan.floors):
        ax.imshow(im)
        ax.set_title(f"{f.name} ({f.id})", fontsize=14)
        ax.axis("off")
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png")
    plt.close(fig)
    return buf.getvalue()
