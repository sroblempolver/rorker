"""Furnishing rules that run after the plan is read, with or without the AI.

1. Kitchens get real cabinets. When the drawing shows the counter (the usual 600 mm deep outline with
   cabinet divisions), those exact sizes are kept and each box becomes a cabinet or appliance. When it
   doesn't, a layout is generated from stock sizes and fitted to the walls with fillers. Either way
   the sink, dishwasher, range and fridge are placed by the usual planning rules, and wall cabinets,
   a hood and a bridge cabinet over the fridge are added above.
2. Unidentified boxes get a likely name from their size, the room and what is around them (a 1.7 m
   box in a bathroom is a bathtub), so they can be drawn and modelled. These stay low confidence.

Sizes (US stock lines, NKBA planning guidelines, NEC 210.52):
  base 34 1/2" + 1 1/2" top = 36" (914) high, 24" (610) deep, 9"-42" wide in 3" steps
  wall 12" (305) deep, 30"/36"/42" high, bottom at 54" (1372); 24" deep bridge over the fridge
  sink base 33"/36", dishwasher 24", range 30", fridge opening 36", blind corner 42", lazy susan 36"
  landing: sink 24" one side + 18" other, range 12" + 15", fridge 15" on the handle side
  dishwasher within 36" of the sink; range never under a window; hood 24"-30" above the cooktop
Metric drawings (600 mm modules) keep metric sizes: 600 deep, 150-1200 wide, wall units 330 deep.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from shapely.geometry import Point as SPoint, Polygon

from .schema import Fixture, Floor, Opening, Plan, Room

IN = 25.4
US_WIDTHS = [36, 33, 30, 27, 24, 21, 18, 15, 12, 9]  # inches, stock base and wall widths
METRIC_WIDTHS = [1000, 900, 800, 600, 500, 450, 400, 300, 200, 150]


@dataclass
class Spec:
    metric: bool
    depth: float          # base cabinet depth
    base_h: float         # to the top of the countertop
    wall_depth: float
    wall_bottom: float
    wall_top: float
    sink_w: float
    dw_w: float
    range_w: float
    fridge_w: float
    corner_w: float       # blind corner base along the primary run

    def widths(self) -> list[int]:
        return METRIC_WIDTHS if self.metric else [round(w * IN) for w in US_WIDTHS]

    def code(self, kind: str, w: float, h: float | None = None) -> str:
        if self.metric:
            names = {"B": "Base", "DB": "Drawer base", "SB": "Sink base", "BBC": "Corner base", "W": "Wall unit",
                     "WB": "Bridge unit", "F": "Filler", "DW": "Dishwasher", "RG": "Range", "RF": "Fridge space", "HD": "Hood"}
            return f"{names.get(kind, kind)} {round(w)}" + (f"×{round(h)}" if h and kind in ("W", "WB") else "")
        wi = round(w / IN)
        if kind in ("W", "WB"):
            return f"W{wi}{round((h or 0) / IN)}"
        if kind == "F":
            return f"F{max(1, wi)}"
        if kind in ("DW", "RG", "RF", "HD"):
            return {"DW": "DW", "RG": "RANGE", "RF": "REF", "HD": "HOOD"}[kind] + str(wi)
        return f"{kind}{wi}"


def us_spec(ceiling: float) -> Spec:
    top = 2286 if ceiling >= 2440 else 2134  # 36" or 30" wall cabinets under the usual 8'+ ceiling
    return Spec(False, 610, 914, 305, 1372, top, 36 * IN, 24 * IN, 30 * IN, 36 * IN, 42 * IN)


def metric_spec(ceiling: float) -> Spec:
    return Spec(True, 600, 900, 330, 1450, min(2170, ceiling - 300), 900, 600, 600, 900, 1000)


@dataclass
class Seg:
    t0: float
    t1: float
    role: str = "base"     # base, sink, dw, range, fridge, corner, filler
    front: str = "doors"
    fixed: bool = False    # size came from the drawing

    @property
    def w(self) -> float:
        return self.t1 - self.t0


@dataclass
class Run:
    a: tuple[float, float]    # start point on the wall face
    u: tuple[float, float]    # along the wall
    n: tuple[float, float]    # into the room (the way cabinet fronts face)
    t0: float
    t1: float
    depth: float
    segs: list[Seg] = field(default_factory=list)
    windows: list[tuple[float, float]] = field(default_factory=list)  # intervals along the run

    def pt(self, t: float, d: float = 0) -> tuple[float, float]:
        return (self.a[0] + self.u[0] * t + self.n[0] * d, self.a[1] + self.u[1] * t + self.n[1] * d)

    def t_of(self, p) -> float:
        return (p[0] - self.a[0]) * self.u[0] + (p[1] - self.a[1]) * self.u[1]

    def d_of(self, p) -> float:
        return (p[0] - self.a[0]) * self.n[0] + (p[1] - self.a[1]) * self.n[1]


def _unit(dx: float, dy: float) -> tuple[float, float]:
    L = math.hypot(dx, dy) or 1.0
    return (dx / L, dy / L)


def _edges(room: Room):
    """Room edges with the inward normal."""
    pts = room.polygon[:-1] if room.polygon[0] == room.polygon[-1] else room.polygon
    poly = Polygon(pts)
    out = []
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        u = _unit(b[0] - a[0], b[1] - a[1])
        n = (-u[1], u[0])
        mid = ((a[0] + b[0]) / 2 + n[0] * 50, (a[1] + b[1]) / 2 + n[1] * 50)
        if not poly.contains(SPoint(mid)):
            n = (u[1], -u[0])
        out.append((tuple(a), tuple(b), u, n, math.hypot(b[0] - a[0], b[1] - a[1])))
    return out


def _rects(fx: Fixture):
    """Closed four-sided outlines of a fixture."""
    out = []
    for ln in fx.outline:
        if len(ln) == 5 and math.dist(ln[0], ln[-1]) < 1:
            out.append([tuple(p) for p in ln[:4]])
    return out


# ---------------------------------------------------------------- kitchens

def _runs_from_counter(room: Room, counter: Fixture) -> list[Run]:
    edges = _edges(room)
    runs: list[Run] = []
    for r in _rects(counter):
        sides = [(r[i], r[(i + 1) % 4]) for i in range(4)]
        lens = [math.dist(*s) for s in sides]
        depth, length = min(lens), max(lens)
        if not (450 <= depth <= 720 and length >= 550):
            continue
        best = None
        for a, b, u, n, L in edges:
            # the counter's back edge lies on this wall: every corner is within depth of the wall line
            ds = [(p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1] for p in r]
            if min(ds) > -60 and min(ds) < 120 and max(ds) < depth + 120:
                ts = [(p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1] for p in r]
                along = max(ts) - min(ts)
                if along >= length - 5 and (best is None or along > best[0]):
                    best = (along, Run(a, u, n, min(ts), max(ts), depth))
        if best:
            runs.append(best[1])
    # divisions: short lines across a run
    for run in runs:
        cuts = set()
        for ln in counter.outline:
            if len(ln) != 2:
                continue
            p, q = ln
            if abs(run.t_of(p) - run.t_of(q)) > 30:
                continue
            t = (run.t_of(p) + run.t_of(q)) / 2
            dmin, dmax = sorted((run.d_of(p), run.d_of(q)))
            if run.t0 + 50 < t < run.t1 - 50 and dmin < 120 and dmax > run.depth * 0.7 and dmax < run.depth + 80:
                cuts.add(round(t, 1))
        ts = [run.t0, *sorted(cuts), run.t1]
        run.segs = [Seg(ts[i], ts[i + 1], fixed=True) for i in range(len(ts) - 1)]
    return runs


def _blocked(run_edge, floor: Floor, room: Room):
    """Door and window intervals along a wall edge."""
    a, b, u, n, L = run_edge
    doors, windows = [], []
    for o in floor.openings:
        if room.id not in o.room_ids:
            continue
        ta = (o.a[0] - a[0]) * u[0] + (o.a[1] - a[1]) * u[1]
        tb = (o.b[0] - a[0]) * u[0] + (o.b[1] - a[1]) * u[1]
        da = abs((o.a[0] - a[0]) * n[0] + (o.a[1] - a[1]) * n[1])
        db = abs((o.b[0] - a[0]) * n[0] + (o.b[1] - a[1]) * n[1])
        if max(da, db) > 400 or max(ta, tb) < 0 or min(ta, tb) > L:
            continue
        iv = (min(ta, tb), max(ta, tb))
        (windows if o.kind == "window" else doors).append(iv)
    return doors, windows


def _free(L: float, blocks: list[tuple[float, float]], pad: float) -> list[tuple[float, float]]:
    cur, out = 0.0, []
    for s, e in sorted(blocks):
        if s - pad > cur:
            out.append((cur, s - pad))
        cur = max(cur, e + pad)
    if L > cur:
        out.append((cur, L))
    return out


def _runs_generated(floor: Floor, room: Room, spec: Spec) -> list[Run]:
    edges = _edges(room)
    info = []
    for i, e in enumerate(edges):
        doors, windows = _blocked(e, floor, room)
        free = [iv for iv in _free(e[4], doors, 100) if iv[1] - iv[0] >= 600]
        best = max(free, key=lambda iv: iv[1] - iv[0], default=None)
        info.append((i, e, best, windows))
    cand = [x for x in info if x[2]]
    if not cand:
        return []
    primary = max(cand, key=lambda x: x[2][1] - x[2][0])
    runs = []
    i, e, (s, t), windows = primary
    run = Run(e[0], e[2], e[3], s, t, spec.depth, windows=windows)
    runs.append(run)
    # an L: the next wall round a corner the primary run reaches
    n_edges = len(edges)
    for j, at_end in (((i + 1) % n_edges, True), ((i - 1) % n_edges, False)):
        _, e2, iv2, w2 = info[j]
        if not iv2:
            continue
        reaches = (t > e[4] - 5) if at_end else (s < 5)
        starts = (iv2[0] < 5) if at_end else (iv2[1] > e2[4] - 5)
        if reaches and starts and iv2[1] - iv2[0] >= 1500:
            # the corner square belongs to the primary run; this run starts past it
            r2 = Run(e2[0], e2[2], e2[3], iv2[0] + (spec.depth if at_end else 0), iv2[1] - (0 if at_end else spec.depth), spec.depth, windows=w2)
            runs.append(r2)
            run_corner = "end" if at_end else "start"
            run.segs.append(Seg(t - spec.corner_w, t, "corner", "blind_corner") if run_corner == "end" else Seg(s, s + spec.corner_w, "corner", "blind_corner"))
            break
    return runs


def _fill(length: float, widths: list[int]) -> list[int]:
    """Stock widths that fill a gap: fewest boxes, at most 3" (or 160 mm when it must) left over for
    fillers, and the narrowest 9"/150 boxes only when nothing else fits."""
    L = int(length)
    if L < min(widths):
        return []
    best: list = [None] * (L + 1)  # best[x] = (cost, pieces) to make exactly x
    best[0] = (0.0, [])
    narrow = min(widths)
    for x in range(1, L + 1):
        for w in widths:
            if w <= x and best[x - w] is not None:
                c = best[x - w][0] + 1 + (0.6 if w == narrow else 0)
                if best[x] is None or c < best[x][0]:
                    best[x] = (c, best[x - w][1] + [w])
    for slack in (76, 160, L):
        pick = None
        for x in range(L, max(-1, L - slack - 1), -1):
            if best[x] is not None and x > 0 and (pick is None or best[x][0] < pick[0]):
                pick = best[x]
        if pick:
            return sorted(pick[1], reverse=True)
    return []


def _place_generated(runs: list[Run], spec: Spec, room: Room, floor: Floor):
    primary = runs[0]

    def taken(run: Run):
        return sorted((s.t0, s.t1) for s in run.segs)

    def free_gaps(run: Run):
        return _free(run.t1 - run.t0, [(a - run.t0, b - run.t0) for a, b in taken(run)], 0)

    def put(run: Run, center: float, w: float, role: str, front: str) -> bool:
        t0 = max(run.t0 + 10, min(center - w / 2, run.t1 - 10 - w))
        for a, b in taken(run):
            if t0 < b and t0 + w > a:
                return False
        run.segs.append(Seg(t0, t0 + w, role, front))
        return True

    # sink: under a window over a run, else the middle of the primary run
    sink_run, sink_c = primary, (primary.t0 + primary.t1) / 2
    for r in runs:
        for a, b in r.windows:
            if r.t0 + spec.sink_w / 2 < (a + b) / 2 < r.t1 - spec.sink_w / 2:
                sink_run, sink_c = r, (a + b) / 2
                break
    if not put(sink_run, sink_c, spec.sink_w, "sink", "sink"):
        for r in runs:
            gaps = [(a + r.t0, b + r.t0) for a, b in free_gaps(r) if b - a >= spec.sink_w]
            if gaps:
                a, b = max(gaps, key=lambda g: g[1] - g[0])
                sink_run = r
                put(r, (a + b) / 2, spec.sink_w, "sink", "sink")
                break
    sink = next((s for s in sink_run.segs if s.role == "sink"), None)
    if sink is None:
        sink = Seg(sink_run.t0, sink_run.t0)
    # dishwasher right next to the sink, on the side with more room
    left, right = sink.t0 - sink_run.t0, sink_run.t1 - sink.t1
    sides = [sink.t1 + spec.dw_w / 2, sink.t0 - spec.dw_w / 2]
    for c in (sides if right >= left else sides[::-1]):
        if put(sink_run, c, spec.dw_w, "dw", "appliance"):
            break
    # range: middle of the largest free stretch that leaves landing on both sides and isn't under a window
    best = None
    for r in runs:
        for a, b in free_gaps(r):
            a, b = a + r.t0, b + r.t0
            if b - a < spec.range_w + 305 + 381:
                continue
            c = (a + b) / 2
            if any(wa - 100 < c < wb + 100 for wa, wb in r.windows):
                continue
            score = min(b - a, 2000) + (800 if r is not sink_run else 0)
            if best is None or score > best[0]:
                best = (score, r, c)
    if not best:  # a tight kitchen: 12" of landing on one side is the minimum
        for r in runs:
            for a, b in free_gaps(r):
                a, b = a + r.t0, b + r.t0
                if b - a >= spec.range_w + 305 and not any(wa < b and wb > a for wa, wb in r.windows):
                    best = (0, r, b - spec.range_w / 2 - 20)
                    break
            if best:
                break
    if best:
        put(best[1], best[2], spec.range_w, "range", "appliance")
    # fridge: the end of a run farthest from the sink that isn't a corner
    ends = []
    for r in runs:
        corner = [s for s in r.segs if s.role == "corner"]
        if not corner or corner[0].t0 > r.t0 + 1:
            ends.append((r, r.t0 + 40 + spec.fridge_w / 2))
        if not corner or corner[0].t1 < r.t1 - 1:
            ends.append((r, r.t1 - 40 - spec.fridge_w / 2))
    ends.sort(key=lambda x: -math.dist(x[0].pt(x[1]), sink_run.pt((sink.t0 + sink.t1) / 2)))
    placed = any((r.t1 - r.t0) > spec.fridge_w + 1200 and put(r, c, spec.fridge_w, "fridge", "appliance") for r, c in ends)
    if not placed:  # tight: any run end it fits, tight to the wall
        for r, c in ends:
            c = r.t0 + 10 + spec.fridge_w / 2 if c < (r.t0 + r.t1) / 2 else r.t1 - 10 - spec.fridge_w / 2
            if put(r, c, spec.fridge_w, "fridge", "appliance"):
                break
    # everything else: stock cabinets, fillers at the ends
    widths = spec.widths()
    for r in runs:
        for a, b in free_gaps(r):
            a, b = a + r.t0, b + r.t0
            pieces = _fill(b - a, widths)
            extra = (b - a) - sum(pieces)
            t = a + extra / 2 if pieces else a
            if pieces and extra > 0:
                r.segs.append(Seg(a, t, "filler", "panel"))
            for w in pieces:
                r.segs.append(Seg(t, t + w, "base", "doors"))
                t += w
            if b - t > 1:
                r.segs.append(Seg(t, b, "filler", "panel"))
        r.segs.sort(key=lambda s: s.t0)


def _assign_drawn(runs: list[Run], sink_pt):
    segs = [(r, s) for r in runs for s in r.segs]
    for r in runs:
        # a box that meets the end of another run sits in the corner
        for s in r.segs:
            for o in runs:
                if o is r:
                    continue
                for end in (o.t0, o.t1):
                    p = o.pt(end, o.depth / 2)
                    if s.t0 - 50 <= r.t_of(p) <= s.t1 + 50 and -50 <= r.d_of(p) <= r.depth + 50 and math.dist(p, r.pt((s.t0 + s.t1) / 2, r.depth / 2)) < r.depth * 1.2:
                        s.role, s.front = "corner", "blind_corner"
    sink = None
    if sink_pt:
        for r, s in segs:
            if s.t0 <= r.t_of(sink_pt) <= s.t1 and 0 <= r.d_of(sink_pt) <= r.depth + 50:
                sink = (r, s)
    if not sink:
        free = [x for x in segs if x[1].role == "base" and 760 <= x[1].w <= 1000]
        sink = free[0] if free else None
    if sink:
        sink[1].role, sink[1].front = "sink", "sink"

    def neighbours(r, s):
        i = r.segs.index(s)
        out = [r.segs[i - 1]] if i > 0 else []
        out += [r.segs[i + 1]] if i + 1 < len(r.segs) else []
        # across a corner: the first box of the other run
        if s.role in ("corner", "sink") and s.front in ("blind_corner", "sink"):
            for o in runs:
                if o is r or not o.segs:
                    continue
                for cand in (o.segs[0], o.segs[-1]):
                    if math.dist(o.pt((cand.t0 + cand.t1) / 2), r.pt((s.t0 + s.t1) / 2)) < s.w + cand.w + r.depth:
                        out.append(cand)
        return out

    owner = {id(s): r for r, s in segs}
    # fridge: a 750-1000 box at the open end of a run
    for r in runs:
        for s in (r.segs[0], r.segs[-1]):
            if s.role == "base" and 740 <= s.w <= 1050 and not any(x.role == "fridge" for _, x in segs):
                s.role, s.front = "fridge", "appliance"
    # dishwasher: a 450-610 box next to the sink, preferring the longer run
    if sink:
        cands = [x for x in neighbours(*sink) if x.role == "base" and 430 <= x.w <= 620]
        cands.sort(key=lambda x: -(owner[id(x)].t1 - owner[id(x)].t0))
        if cands:
            cands[0].role, cands[0].front = "dw", "appliance"
    # range: a 600-770 box, away from the sink and fridge, with landing either side
    best = None
    for r, s in segs:
        if s.role != "base" or not 590 <= s.w <= 770:
            continue
        nb = neighbours(r, s)
        score = 0
        score -= 5 * sum(1 for x in nb if x.role == "fridge")
        score -= 3 * sum(1 for x in nb if x.role == "sink")
        score += sum(1 for x in nb if x.role in ("base", "dw"))
        score += min(s.t0 - r.t0, r.t1 - s.t1) / 1000
        if best is None or score > best[0]:
            best = (score, s)
    if best:
        best[1].role, best[1].front = "range", "appliance"
    # boxes wider than a stock cabinet split in two; drawers either side of the range
    for r in runs:
        out = []
        for s in r.segs:
            if s.role == "base" and s.w > 1000:
                mid = (s.t0 + s.t1) / 2
                out += [Seg(s.t0, mid, fixed=True), Seg(mid, s.t1, fixed=True)]
            else:
                out.append(s)
        r.segs = out
        for i, s in enumerate(r.segs):
            if s.role == "base":
                nb = [r.segs[j] for j in (i - 1, i + 1) if 0 <= j < len(r.segs)]
                if any(x.role == "range" for x in nb):
                    s.front = "drawers"
                elif s.w < 330:
                    s.front = "door"


def _rect(run: Run, t0: float, t1: float, d0: float, d1: float):
    return [run.pt(t0, d0), run.pt(t1, d0), run.pt(t1, d1), run.pt(t0, d1), run.pt(t0, d0)]


def _bbox(pts):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return (min(xs), min(ys), max(xs), max(ys))


def _circle(c, r, n=14):
    return [(c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n)) for i in range(n + 1)]


def _cabinets(runs: list[Run], spec: Spec, room: Room, next_id, source: str, sink_outline) -> list[Fixture]:
    out: list[Fixture] = []

    def add(kind, name, code, run, t0, t1, d0, d1, h, elev=0.0, front=None, extra=None):
        rect = _rect(run, t0, t1, d0, d1)
        bb = _bbox(rect)
        outline = [rect] + (extra or [])
        out.append(Fixture(
            id=next_id(), kind=kind, name=name, room_id=room.id, center=((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2),
            bbox=bb, rotation=0, outline=[[tuple(round(v, 1) for v in p) for p in ln] for ln in outline], source=source,
            source_ref="kitchen-fit", confidence=0.8 if source == "drawing" else 0.6, height_mm=h, elevation_mm=elev,
            facing=round(math.degrees(math.atan2(run.n[1], run.n[0])), 1), front=front, spec=code,
        ))

    D, H = spec.depth, spec.base_h
    for run in runs:
        d = run.depth if run.segs and run.segs[0].fixed else D
        for s in run.segs:
            w = s.w
            if s.role == "sink":
                bowl = sink_outline or [_rect(run, s.t0 + w * 0.15, s.t1 - w * 0.15, d * 0.2, d * 0.8)]
                add("kitchen_sink", f"Sink base {_size(w, spec)}", spec.code("SB", w), run, s.t0, s.t1, 0, d, H, front="sink", extra=bowl)
            elif s.role == "dw":
                add("dishwasher", f"Dishwasher {_size(w, spec)}", spec.code("DW", w), run, s.t0, s.t1, 0, d, H, front="appliance")
            elif s.role == "range":
                burners = [_circle(run.pt(s.t0 + w * fx, d * fy), min(w, d) * 0.13) for fx in (0.3, 0.7) for fy in (0.3, 0.68)]
                add("range", f"Range {_size(w, spec)}", spec.code("RG", w), run, s.t0, s.t1, 0, d, H, front="appliance", extra=burners)
            elif s.role == "fridge":
                add("fridge", f"Fridge space {_size(w, spec)}", spec.code("RF", w), run, s.t0, s.t1, 0, max(d, 700), 1780, front="appliance",
                    extra=[[run.pt(s.t0, 0), run.pt(s.t1, max(d, 700))], [run.pt(s.t1, 0), run.pt(s.t0, max(d, 700))]])
            elif s.role == "corner":
                add("base_cabinet", f"Corner base {_size(w, spec)}", spec.code("BBC", w), run, s.t0, s.t1, 0, d, H, front="blind_corner")
            elif s.role == "filler":
                add("filler", f"Filler {_size(w, spec)}", spec.code("F", w), run, s.t0, s.t1, 0, d, H, front="panel")
            else:
                kind = "DB" if s.front == "drawers" else "B"
                label = "Drawer base" if s.front == "drawers" else "Base cabinet"
                add("base_cabinet", f"{label} {_size(w, spec)}", spec.code(kind, w), run, s.t0, s.t1, 0, d, H, front=s.front,
                    extra=[[run.pt((s.t0 + s.t1) / 2, d), run.pt((s.t0 + s.t1) / 2, d - 60)]] if s.front == "doors" else None)
        # above the counter
        wd = spec.wall_depth
        for s in run.segs:
            w = s.w
            under_window = any(a < s.t1 - 50 and b > s.t0 + 50 for a, b in run.windows)
            if s.role == "range":
                elev = H + 711
                add("range_hood", f"Range hood {_size(w, spec)}", spec.code("HD", w), run, s.t0, s.t1, 0, 457, spec.wall_top - elev, elev, front="appliance")
            elif s.role == "fridge":
                h = 381 if spec.wall_top - 381 > 1830 else spec.wall_top - 1830
                if h >= 250:
                    add("wall_cabinet", f"Bridge cabinet {_size(w, spec)}", spec.code("WB", w, h), run, s.t0, s.t1, 0, max(d, 610), h, spec.wall_top - h, front="doors")
            elif under_window and s.role in ("sink", "base", "dw"):
                continue
            elif s.role == "filler":
                add("filler", f"Wall filler {_size(w, spec)}", spec.code("F", w), run, s.t0, s.t1, 0, wd, spec.wall_top - spec.wall_bottom, spec.wall_bottom, front="panel")
            else:
                h = spec.wall_top - spec.wall_bottom
                add("wall_cabinet", f"Wall cabinet {_size(w, spec)}", spec.code("W", w, h), run, s.t0, s.t1, 0, wd, h, spec.wall_bottom,
                    front="door" if w < 460 else "doors")
    return out


def _size(w: float, spec: Spec) -> str:
    return f"{round(w)}" if spec.metric else f'{round(w / IN)}"'


def fit_kitchen(floor: Floor, room: Room, next_id) -> list[str]:
    """Replace the kitchen's counter linework with cabinets. Returns the ids it removed."""
    inside = [f for f in floor.fixtures if f.room_id == room.id]
    if any(f.kind in ("base_cabinet", "kitchen_sink", "dishwasher", "range") and f.source_ref == "kitchen-fit" for f in inside):
        return []
    counter = None
    for f in inside:
        if f.kind in ("other", "base_cabinet") and _runs_from_counter(room, f):
            counter = f
            break
    removed: list[str] = []
    sink_pt, sink_outline = None, None
    if counter:
        runs = _runs_from_counter(room, counter)
        widths = [s.w for r in runs for s in r.segs]
        metric = sum(1 for w in widths if abs(w - round(w / 50) * 50) < 8) >= len(widths) * 0.6
        spec = metric_spec(floor.height_mm) if metric else us_spec(floor.height_mm)
        cpoly = Polygon(_bbox_poly(counter.bbox))
        for f in inside:
            if f is counter:
                continue
            w, h = f.bbox[2] - f.bbox[0], f.bbox[3] - f.bbox[1]
            if f.kind in ("other", "kitchen_sink") and 250 <= max(w, h) <= 1100 and cpoly.contains(SPoint(f.center)):
                sink_pt, sink_outline = f.center, [[tuple(p) for p in ln] for ln in f.outline]
                removed.append(f.id)
                break
        _assign_drawn(runs, sink_pt)
        removed.append(counter.id)
        source = "drawing"
    else:
        spec = us_spec(floor.height_mm)
        runs = _runs_generated(floor, room, spec)
        if not runs:
            return []
        _place_generated(runs, spec, room, floor)
        source = "contents"
    cabinets = _cabinets(runs, spec, room, next_id, source, sink_outline)
    floor.fixtures = [f for f in floor.fixtures if f.id not in removed] + cabinets
    return removed


def _bbox_poly(b):
    return [(b[0], b[1]), (b[2], b[1]), (b[2], b[3]), (b[0], b[3])]


# ---------------------------------------------------------------- unidentified boxes

def _against_wall(room: Room, f: Fixture) -> tuple[float, float] | None:
    """(length along the wall, depth off it) when the box backs onto a room edge."""
    w, h = f.bbox[2] - f.bbox[0], f.bbox[3] - f.bbox[1]
    for a, b, u, n, L in _edges(room):
        corners = _bbox_poly(f.bbox)
        ds = [(p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1] for p in corners]
        if -40 < min(ds) < 120:
            along = abs(w * u[0]) + abs(h * u[1])
            return along, max(ds)
    return None


def _pieces(outline, tol: float = 4.0, min_piece: float = 150.0, min_side: float = 60.0):
    """Linework that falls apart into separate shapes: [(line indexes, bbox)], largest first. A shape
    inside another shape's box is detail of it (the basin in a vanity) and stays with it; slivers
    (a lone shelf line) stay with the biggest piece."""
    from shapely.geometry import LineString
    from shapely.ops import unary_union
    geoms = [LineString(ln).buffer(tol) if len(ln) > 1 else None for ln in outline]
    live = [g for g in geoms if g is not None]
    if not live:
        return []
    u = unary_union(live)
    parts = list(getattr(u, "geoms", [u]))
    groups: list[list[int]] = [[] for _ in parts]
    for i, g in enumerate(geoms):
        if g is not None:
            groups[max(range(len(parts)), key=lambda k: parts[k].intersection(g).area)].append(i)
    bbs = [p.bounds for p in parts]
    area = lambda b: (b[2] - b[0]) * (b[3] - b[1])
    order = sorted(range(len(parts)), key=lambda k: -area(bbs[k]))
    owner = list(range(len(parts)))
    for k in order:
        a = bbs[k]
        for j in order:
            b = bbs[j]
            if j != k and area(b) > area(a) and b[0] - 10 <= a[0] and b[1] - 10 <= a[1] and a[2] <= b[2] + 10 and a[3] <= b[3] + 10:
                owner[k] = j
                break
        if owner[k] == k and min(a[2] - a[0], a[3] - a[1]) < min_side and k != order[0]:
            owner[k] = order[0]

    def top(k):
        while owner[k] != k:
            k = owner[k]
        return k

    merged: dict[int, list[int]] = {}
    for k in range(len(parts)):
        merged.setdefault(top(k), []).extend(groups[k])
    out = []
    for k, idx in merged.items():
        b = _bbox([pt for i in idx for pt in outline[i]])
        if max(b[2] - b[0], b[3] - b[1]) >= min_piece:
            out.append((sorted(idx), b))
    return sorted(out, key=lambda x: -area(x[1]))


def split_unknowns(floor: Floor, next_id) -> None:
    """An unrecognised block whose linework falls apart into separate shapes becomes one movable
    piece per shape, so a contractor can still move each bit even when nobody knows what it is."""
    out: list[Fixture] = []
    for f in floor.fixtures:
        pieces = _pieces(f.outline) if f.kind == "other" and len(f.outline) > 1 else []
        if len(pieces) < 2:
            out.append(f)
            continue
        pieces.sort(key=lambda p: (round(p[1][1] / 50), p[1][0]))
        for k, (idx, bb) in enumerate(pieces):
            out.append(f.model_copy(update={
                "id": f.id if k == 0 else next_id(),
                "name": "Unidentified piece",
                "outline": [f.outline[i] for i in idx],
                "bbox": tuple(bb),
                "center": ((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2),
                "source_ref": f"{f.source_ref or f.id} · piece {k + 1} of {len(pieces)}",
                "confidence": min(f.confidence, 0.3),
            }))
    floor.fixtures = out


def classify_unknowns(floor: Floor) -> None:
    rooms = {r.id: r for r in floor.rooms}
    others = [f for f in floor.fixtures if f.kind == "other"]
    for f in others:
        w, h = f.bbox[2] - f.bbox[0], f.bbox[3] - f.bbox[1]
        lo, hi = min(w, h), max(w, h)
        room = rooms.get(f.room_id or "")
        rtype = room.type if room else "other"

        def name(kind: str, label: str, conf: float = 0.45):
            f.kind, f.name, f.confidence = kind, f"{label} (likely)", conf

        # linework inside another fixture is part of it (the inside of a tub, a wardrobe's door line)
        parent = next((o for o in floor.fixtures if o is not f and o.kind != "part"
                       and o.bbox[0] - 30 <= f.bbox[0] and o.bbox[1] - 30 <= f.bbox[1] and f.bbox[2] <= o.bbox[2] + 30 and f.bbox[3] <= o.bbox[3] + 30
                       and (o.bbox[2] - o.bbox[0]) * (o.bbox[3] - o.bbox[1]) > w * h * 1.05), None)
        if parent:
            f.kind, f.name, f.confidence = "part", f"Part of {parent.id}", 0.5
            continue
        if lo <= 90 and 500 <= hi <= 1000:
            f.kind, f.name, f.confidence = "door_leaf", "Door leaf", 0.5
            continue
        wall = _against_wall(room, f) if room else None
        if rtype in ("bathroom", "wc"):
            if 1350 <= hi <= 1950 and 650 <= lo <= 950:
                name("bathtub", "Bathtub")
            elif 700 <= lo and hi <= 1100:
                name("shower", "Shower")
            elif wall and 380 <= wall[1] <= 640 and 500 <= wall[0] <= 1850:
                name("vanity", "Vanity")
        elif rtype in ("bedroom",):
            if 350 <= lo <= 560 and hi <= 620:
                name("nightstand", "Nightstand", 0.5)
            elif wall and 450 <= wall[1] <= 700 and wall[0] >= 900:
                name("wardrobe", "Wardrobe")
            elif 700 <= lo and hi <= 950:
                name("armchair", "Armchair", 0.35)
        elif rtype == "laundry" and 550 <= lo and hi <= 720:
            name("washing_machine", "Washer")
        elif rtype in ("dining",) and lo >= 800 and hi >= 1200:
            name("dining_table", "Dining table", 0.55)
        if f.kind != "other" or not wall:
            continue
        along, depth = wall
        if 200 <= depth <= 460 and along >= 900:
            name("bookshelf", "Shelving", 0.4)
        elif 460 < depth <= 700 and along >= 900:
            name("wardrobe" if rtype in ("foyer", "hallway", "closet", "stair_hall") else "sideboard",
                 "Built-in storage" if rtype in ("foyer", "hallway", "closet", "stair_hall") else "Sideboard", 0.4)


def furnish(plan: Plan) -> Plan:
    for floor in plan.floors:
        nums = [int(f.id.split("-F")[-1]) for f in floor.fixtures if "-F" in f.id and f.id.split("-F")[-1].isdigit()]
        counter = [max(nums, default=0)]

        def next_id(code=floor.id):
            counter[0] += 1
            return f"{code}-F{counter[0]:02d}"

        for room in floor.rooms:
            if room.type == "kitchen":
                fit_kitchen(floor, room, next_id)
        split_unknowns(floor, next_id)
        classify_unknowns(floor)
    return plan
