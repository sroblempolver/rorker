"""Step 2 of the plan-reading agent: pull geometry out of a CAD drawing (DXF) with code.

Nothing here guesses names. It finds floors, wall pieces, the openings between them, the
rooms those walls enclose, the text in each room, named blocks, and clusters of plain lines
that may be fixtures. The interpretation step (interpret.py) names things.

Output is a RawDrawing in the drawing's own coordinates (millimetres, y up).
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Optional

import ezdxf
from ezdxf import path as ezpath
from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Point as SPoint, Polygon, box
from shapely.ops import polygonize, unary_union

# ---- layer classification -------------------------------------------------------------

LAYER_RULES = [
    ("wall", r"wall|^a-wall|mur|стен|^walls?$|partition"),
    ("door", r"door|^a-door|porte"),
    ("window", r"window|glaz|^a-glaz|fenetre"),
    ("stair", r"stair|steps|escal"),
    ("furniture", r"furn|equip|fixt|plumb|sanit|kitchen|appliance|cabinet"),
    ("ignore", r"dim|axis|grid|defpoints|anno|text|title|hatch|area|viewport|frame|border|^0-dim"),
]
UNITS_TO_MM = {0: 1.0, 1: 25.4, 2: 304.8, 4: 1.0, 5: 10.0, 6: 1000.0}

NUMBER_RE = re.compile(r"^\s*\d+([.,]\d+)?\s*(m2|m²|sq\.?\s*m)?\s*$", re.I)
FLOOR_TITLE_RE = re.compile(r"floor|level|storey|story|plan|basement|attic|ground", re.I)


def classify_layer(name: str) -> str:
    n = name.lower()
    for kind, rx in LAYER_RULES:
        if re.search(rx, n):
            return kind
    return "other"


# ---- raw output -----------------------------------------------------------------------


@dataclass
class RawText:
    text: str
    x: float
    y: float
    layer: str
    height: float


@dataclass
class RawBlock:
    name: str
    layer: str
    center: tuple[float, float]
    bbox: tuple[float, float, float, float]
    rotation: float
    outline: list[list[tuple[float, float]]]


@dataclass
class RawCandidate:
    """A cluster of plain linework that may be a fixture (sink, toilet, cabinet...)."""
    cid: str
    bbox: tuple[float, float, float, float]
    outline: list[list[tuple[float, float]]]
    layer: str


@dataclass
class RawOpening:
    poly: Polygon
    a: tuple[float, float]
    b: tuple[float, float]
    width: float
    thickness: float
    kind: str  # door | window | opening
    leaves: list[dict] = field(default_factory=list)
    exterior: bool = False


@dataclass
class RawFloor:
    index: int
    title: Optional[str]
    walls: list[Polygon]
    openings: list[RawOpening]
    rooms: list[Polygon]
    footprint: list[Polygon]
    texts: list[RawText]
    blocks: list[RawBlock]
    candidates: list[RawCandidate]
    stairs: list[Polygon]
    stair_lines: list[list[tuple[float, float]]]
    axis_labels: dict[str, tuple[float, float]]
    bounds: tuple[float, float, float, float]


@dataclass
class RawDrawing:
    floors: list[RawFloor]
    layers: dict[str, str]
    units_scale: float
    stats: dict


# ---- entity flattening ----------------------------------------------------------------


@dataclass
class Prim:
    layer: str
    kind: str  # layer class
    etype: str
    pts: list[tuple[float, float]]  # flattened polyline
    closed: bool = False
    arc: Optional[dict] = None  # for ARC: center, radius, start, end (degrees)
    block: Optional[str] = None  # top-level block this came from


def _flatten(e, scale: float) -> Optional[list[tuple[float, float]]]:
    try:
        p = ezpath.make_path(e)
    except Exception:
        return None
    try:
        pts = [(v.x * scale, v.y * scale) for v in p.flattening(distance=5 / max(scale, 1e-9))]
    except Exception:
        return None
    return pts if len(pts) >= 2 else None


def _iter_virtual(e, depth=0):
    if depth > 6:
        return
    try:
        for ve in e.virtual_entities():
            if ve.dxftype() == "INSERT":
                yield from _iter_virtual(ve, depth + 1)
            else:
                yield ve
    except Exception:
        return


def _collect(msp, scale: float, layers: dict[str, str]):
    prims: list[Prim] = []
    texts: list[RawText] = []
    blocks: list[tuple[str, str, float, list[Prim]]] = []

    def add_entity(e, layer: str, kind: str, block: Optional[str]):
        t = e.dxftype()
        if t in ("TEXT", "MTEXT", "ATTRIB"):
            txt = e.plain_text() if t == "MTEXT" else e.dxf.text
            ins = e.dxf.insert
            texts.append(RawText(txt.strip(), ins.x * scale, ins.y * scale, layer,
                                 float((e.dxf.get("char_height", 0) if t == "MTEXT" else e.dxf.get("height", 0)) or 0) * scale))
            return None
        if t in ("HATCH", "DIMENSION", "POINT", "SOLID", "IMAGE", "WIPEOUT", "VIEWPORT", "LEADER", "MLEADER"):
            return None
        pts = _flatten(e, scale)
        if not pts:
            return None
        arc = None
        if t == "ARC":
            c = e.dxf.center
            arc = dict(center=(c.x * scale, c.y * scale), radius=e.dxf.radius * scale,
                       start=e.dxf.start_angle, end=e.dxf.end_angle)
        closed = t in ("CIRCLE", "ELLIPSE") or bool(getattr(e, "closed", False)) or (
            len(pts) > 2 and math.dist(pts[0], pts[-1]) < 1)
        return Prim(layer, kind, t, pts, closed, arc, block)

    for e in msp:
        layer = e.dxf.layer
        kind = layers.setdefault(layer, classify_layer(layer))
        if e.dxftype() == "INSERT":
            name = e.dxf.name
            sub: list[Prim] = []
            for ve in _iter_virtual(e):
                vl = ve.dxf.layer if ve.dxf.layer not in ("0",) else layer
                vk = layers.setdefault(vl, classify_layer(vl))
                if kind == "wall":
                    vk = "wall"
                pr = add_entity(ve, vl, vk, name)
                if pr:
                    sub.append(pr)
            if kind == "wall":
                prims.extend(sub)
            elif sub:
                blocks.append((name, layer, float(e.dxf.get("rotation", 0) or 0), sub))
            continue
        pr = add_entity(e, layer, kind, None)
        if pr:
            prims.append(pr)
    return prims, texts, blocks


# ---- geometry helpers -------------------------------------------------------------------


def _polys(g) -> list[Polygon]:
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, MultiPolygon):
        return list(g.geoms)
    return [p for p in getattr(g, "geoms", []) if isinstance(p, Polygon)]


def thickness_of(p: Polygon) -> float:
    per = p.length
    return 2 * p.area / per if per else 0


def _bbox_gap(a, b) -> float:
    dx = max(0, max(a[0], b[0]) - min(a[2], b[2]))
    dy = max(0, max(a[1], b[1]) - min(a[3], b[3]))
    return math.hypot(dx, dy)


def _cluster_bboxes(bbs: list[tuple], gap: float) -> list[list[int]]:
    n = len(bbs)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(n):
        for j in range(i + 1, n):
            if _bbox_gap(bbs[i], bbs[j]) < gap:
                parent[find(i)] = find(j)
    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    return list(groups.values())


# ---- walls, openings, rooms -------------------------------------------------------------


def wall_faces(wall_prims: list[Prim]) -> list[Polygon]:
    """Wall linework -> solid wall pieces. Most CAD walls are drawn as two parallel lines with
    end caps, so polygonizing the noded linework gives each wall's solid outline."""
    lines = _snapped_lines([p.pts for p in wall_prims if len(p.pts) >= 2])
    if not lines:
        return []
    noded = unary_union(lines)
    faces = [f for f in polygonize(noded) if f.area > 2000]  # > 0.002 m2
    # faces that are room-sized are rooms with no openings; drop them here
    return [f for f in faces if thickness_of(f) < 800]


def _snapped_lines(polylines, tol: float = 6.0) -> list[LineString]:
    """CAD linework often misses its neighbours by a fraction of a millimetre, which leaves wall
    outlines open. Snap every vertex to nearby vertices (within tol) and to a 1 mm grid."""
    verts: dict[tuple[int, int], tuple[float, float]] = {}
    cell = tol

    def snap(x, y):
        kx, ky = int(round(x / cell)), int(round(y / cell))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                v = verts.get((kx + dx, ky + dy))
                if v and abs(v[0] - x) <= tol and abs(v[1] - y) <= tol:
                    return v
        v = (round(x), round(y))
        verts[(kx, ky)] = v
        return v

    out = []
    for pl in polylines:
        pts = [snap(x, y) for x, y in pl]
        pts = [q for i, q in enumerate(pts) if i == 0 or q != pts[i - 1]]
        if len(pts) >= 2:
            out.append(LineString(pts))
    # also snap line endpoints that stop just short of another line (T junctions)
    snapped = []
    tree_lines = out
    from shapely.strtree import STRtree
    tree = STRtree(tree_lines)
    for ln in out:
        coords = list(ln.coords)
        for end in (0, -1):
            pt = SPoint(coords[end])
            best = None
            for j in tree.query(pt.buffer(tol)):
                other = tree_lines[j]
                if other is ln:
                    continue
                d = other.distance(pt)
                if 0 < d <= tol and (best is None or d < best[0]):
                    best = (d, other)
            if best:
                q = best[1].interpolate(best[1].project(pt))
                coords[end] = (q.x, q.y)
        snapped.append(LineString(coords))
    return snapped


@dataclass
class _Face:
    a: tuple[float, float]
    b: tuple[float, float]
    mid: tuple[float, float]
    u: tuple[float, float]
    n: tuple[float, float]  # outward normal
    length: float
    piece: int


def _end_faces(pieces: list[Polygon]) -> list[_Face]:
    faces = []
    for idx, p in enumerate(pieces):
        ring = p.simplify(3).exterior
        coords = list(ring.coords)
        ccw = ring.is_ccw
        for (x0, y0), (x1, y1) in zip(coords, coords[1:]):
            L = math.hypot(x1 - x0, y1 - y0)
            if not (40 <= L <= 650):
                continue
            ux, uy = (x1 - x0) / L, (y1 - y0) / L
            # outward normal: right of direction for CCW rings
            nx, ny = (uy, -ux) if ccw else (-uy, ux)
            faces.append(_Face((x0, y0), (x1, y1), ((x0 + x1) / 2, (y0 + y1) / 2), (ux, uy), (nx, ny), L, idx))
    return faces


def bridge_openings(pieces: list[Polygon], max_gap: float = 4200) -> list[tuple[Polygon, _Face, _Face]]:
    """Pair wall end faces that look at each other across a gap: that gap is a door, window
    or open passage. Returns the gap polygons."""
    faces = _end_faces(pieces)
    solid = unary_union(pieces)
    best: dict[int, tuple[float, int]] = {}
    for i, f in enumerate(faces):
        for j, g in enumerate(faces):
            if f.piece == g.piece and i == j:
                continue
            if f.n[0] * g.n[0] + f.n[1] * g.n[1] > -0.985:
                continue
            dx, dy = g.mid[0] - f.mid[0], g.mid[1] - f.mid[1]
            d = dx * f.n[0] + dy * f.n[1]
            if not (40 < d < max_gap):
                continue
            lateral = abs(dx * f.u[0] + dy * f.u[1])
            if lateral > 0.35 * min(f.length, g.length) + 30:
                continue
            if min(f.length, g.length) / max(f.length, g.length) < 0.5:
                continue
            if i not in best or d < best[i][0]:
                best[i] = (d, j)
    out = []
    seen = set()
    for i, (d, j) in best.items():
        if best.get(j, (None, None))[1] != i or (j, i) in seen:
            continue
        seen.add((i, j))
        f, g = faces[i], faces[j]
        quad = Polygon([f.a, f.b, g.a, g.b]).convex_hull
        if quad.area < 1000:
            continue
        # the gap must be (mostly) empty of wall
        if quad.buffer(-15).intersection(solid).area > 0.15 * quad.area:
            continue
        out.append((quad, f, g))
    # second pass: an end face with no partner that looks straight at the side of another wall
    # (a passage that ends on a T or L junction)
    used = {i for pair in seen for i in pair}
    taken = unary_union([q for q, _, _ in out]) if out else Polygon()
    for i, f in enumerate(faces):
        if i in used or pieces[f.piece].area < 0.6e6:  # free-standing stubs (stair walls, columns)
            continue
        ray = LineString([f.mid, (f.mid[0] + f.n[0] * max_gap, f.mid[1] + f.n[1] * max_gap)])
        hit_d = None
        for k, p in enumerate(pieces):
            if k == f.piece:
                continue
            x = ray.intersection(p.boundary)
            if x.is_empty:
                continue
            pts = [x] if x.geom_type == "Point" else [g for g in getattr(x, "geoms", []) if g.geom_type == "Point"]
            for pt in pts:
                d = math.dist(f.mid, (pt.x, pt.y))
                if d > 40 and (hit_d is None or d < hit_d):
                    hit_d = d
        if hit_d is None or hit_d > 3600:
            continue
        # the face's own piece must not be hit first (ray leaving through itself)
        if pieces[f.piece].buffer(-2).intersects(LineString([
                (f.mid[0] + f.n[0] * 5, f.mid[1] + f.n[1] * 5),
                (f.mid[0] + f.n[0] * (hit_d - 5), f.mid[1] + f.n[1] * (hit_d - 5))])):
            continue
        ga = (f.a[0] + f.n[0] * hit_d, f.a[1] + f.n[1] * hit_d)
        gb = (f.b[0] + f.n[0] * hit_d, f.b[1] + f.n[1] * hit_d)
        quad = Polygon([f.a, f.b, gb, ga])
        if quad.buffer(-15).intersection(solid).area > 0.15 * quad.area:
            continue
        if quad.buffer(-15).intersects(taken):
            continue
        g = _Face(gb, ga, ((ga[0] + gb[0]) / 2, (ga[1] + gb[1]) / 2), (-f.u[0], -f.u[1]), (-f.n[0], -f.n[1]), f.length, -1)
        out.append((quad, f, g))
        taken = taken.union(quad)
    return [o for o in out if _open_sides(o[0], o[1], o[2], solid)]


def _open_sides(quad: Polygon, f: "_Face", g: "_Face", solid) -> bool:
    """A real opening has walls only at its two jambs. If the other two sides run along wall,
    the 'gap' is a recess or closet inside a wall, not a way through."""
    sides = [LineString([f.a, g.b]), LineString([f.b, g.a])]
    for sd in sides:
        if sd.length < 1:
            continue
        covered = sd.intersection(solid.buffer(25)).length
        if covered > 0.5 * sd.length:
            return False
    return True


def _arc_hits(arcs: list[Prim], poly: Polygon) -> list[dict]:
    leaves = []
    grown = poly.buffer(120)
    for p in arcs:
        a = p.arc
        if not a or not (350 <= a["radius"] <= 1300):
            continue
        sweep = (a["end"] - a["start"]) % 360
        if not (60 <= sweep <= 120):
            continue
        if grown.contains(SPoint(a["center"])):
            leaves.append(a)
    return leaves


# ---- floors -----------------------------------------------------------------------------


def read_dxf(path: str) -> RawDrawing:
    doc = ezdxf.readfile(path)
    msp = doc.modelspace()
    scale = UNITS_TO_MM.get(int(doc.header.get("$INSUNITS", 4) or 4), 1.0)
    layers: dict[str, str] = {}
    prims, texts, blocks = _collect(msp, scale, layers)

    faces_all = wall_faces([p for p in prims if p.kind == "wall"])
    walls_all = [p for p in _polys(unary_union(faces_all)) if p.area > 5000]
    if not walls_all:
        raise ValueError("No wall layer found. Wall detection needs a layer named like 'wall'.")

    # floors = clusters of wall pieces separated by a clear gap
    groups = _cluster_bboxes([w.bounds for w in walls_all], gap=2500)
    groups = [g for g in groups if sum(walls_all[i].area for i in g) > 0.05 * sum(w.area for w in walls_all)]
    groups.sort(key=lambda g: (min(walls_all[i].bounds[0] for i in g)))

    floors: list[RawFloor] = []
    for fi, g in enumerate(groups):
        pieces = [walls_all[i] for i in g]
        zone = unary_union(pieces).buffer(5)
        faces = [f for f in faces_all if zone.contains(f.representative_point())]
        floors.append(_read_floor(fi, pieces, faces, prims, texts, blocks))

    stats = dict(
        entities=len(prims), texts=len(texts), blocks=len(blocks), wall_pieces=len(walls_all),
        layers=layers,
    )
    return RawDrawing(floors, layers, scale, stats)


def _read_floor(fi, pieces, faces, prims, texts, blocks) -> RawFloor:
    wall_union = unary_union(pieces)
    x0, y0, x1, y1 = wall_union.bounds
    region = box(x0 - 1500, y0 - 1500, x1 + 1500, y1 + 1500)

    def inside(pts):
        return region.contains(SPoint(pts[0])) or region.contains(SPoint(pts[len(pts) // 2]))

    fprims = [p for p in prims if inside(p.pts)]
    ftexts = [t for t in texts if region.contains(SPoint(t.x, t.y))]
    ftitle_region = box(x0 - 1500, y0 - 4000, x1 + 1500, y1 + 4000)
    title = None
    titles = [t for t in texts if ftitle_region.contains(SPoint(t.x, t.y)) and FLOOR_TITLE_RE.search(t.text)
              and not region.buffer(-1400).contains(SPoint(t.x, t.y))]
    if titles:
        title = max(titles, key=lambda t: t.height).text

    # stairs (needed first: nobody walls off a staircase mid-flight, so gaps across stairs are not openings)
    stair_prims = [p for p in fprims if p.kind == "stair"]
    stair_geo = unary_union([LineString(p.pts).buffer(25) for p in stair_prims]) if stair_prims else Polygon()
    stairs = [Polygon(s.exterior).convex_hull for s in _polys(stair_geo) if s.area > 20000]
    stairs = _polys(unary_union(stairs)) if stairs else []
    stair_zone = unary_union(stairs).buffer(-50) if stairs else Polygon()

    # openings
    gaps = [gp for gp in bridge_openings(pieces) if not gp[0].intersects(stair_zone)]
    arcs = [p for p in fprims if p.etype == "ARC" and p.kind in ("door", "other", "furniture")]
    plain = [p for p in fprims if p.kind in ("other", "window")]
    openings: list[RawOpening] = []
    for quad, f, g in gaps:
        a = ((f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2)
        b = ((g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2)
        width = math.dist(a, b)
        thick = (f.length + g.length) / 2
        leaves = _arc_hits(arcs, quad)
        kind = "opening"
        if leaves:
            kind = "door"
        else:
            inner = quad.buffer(-10)
            along = sum(LineString(p.pts).intersection(inner).length for p in plain
                        if LineString(p.pts).intersects(inner))
            if along > 1.5 * width or any(p.kind == "window" and LineString(p.pts).intersects(inner) for p in plain):
                kind = "window"
        openings.append(RawOpening(quad, a, b, width, thick, kind, leaves))

    # windows drawn inside the wall: the wall outline runs straight past, the window is a wall
    # face between two jamb lines with window linework inside it
    win_faces = []
    for fc in faces:
        mrr = fc.minimum_rotated_rectangle
        cs = list(mrr.exterior.coords)
        e1, e2 = math.dist(cs[0], cs[1]), math.dist(cs[1], cs[2])
        long_, short = max(e1, e2), min(e1, e2)
        if not (400 <= long_ <= 4000 and short <= 700 and long_ > 1.8 * short):
            continue
        if fc.area < 0.85 * mrr.area:
            continue
        inner = fc.buffer(-8)
        along = sum(LineString(p.pts).intersection(inner).length for p in plain
                    if LineString(p.pts).intersects(inner))
        if along < 1.5 * long_:
            continue
        if e1 >= e2:
            a = ((cs[1][0] + cs[2][0]) / 2, (cs[1][1] + cs[2][1]) / 2)
            b = ((cs[0][0] + cs[3][0]) / 2, (cs[0][1] + cs[3][1]) / 2)
        else:
            a = ((cs[0][0] + cs[1][0]) / 2, (cs[0][1] + cs[1][1]) / 2)
            b = ((cs[2][0] + cs[3][0]) / 2, (cs[2][1] + cs[3][1]) / 2)
        win_faces.append(fc)
        openings.append(RawOpening(fc, a, b, long_, short, "window", []))
    if win_faces:
        cut = unary_union(win_faces).buffer(1)
        pieces = [q for p in pieces for q in _polys(p.difference(cut)) if q.area > 5000]

    mass = unary_union(pieces + [o.poly.buffer(1) for o in openings])
    rooms, footprint = [], []
    for poly in _polys(mass):
        if poly.area < 1e6 * 0.3:
            continue
        footprint.append(Polygon(poly.exterior))
        for ring in poly.interiors:
            r = Polygon(ring)
            if r.area >= 0.35e6 and thickness_of(r) > 350:
                rooms.append(r)
    outside = unary_union(footprint)
    for o in openings:
        o.exterior = o.poly.buffer(60).difference(outside).area > 1000

    # linework that belongs to door leaves and windows is not a fixture
    opening_zone = unary_union([o.poly.buffer(40) for o in openings])
    hinge_pts = [SPoint(l["center"]).buffer(60) for o in openings for l in o.leaves]
    hinge_zone = unary_union(hinge_pts) if hinge_pts else Polygon()
    door_arcs = {id(p) for p in arcs if any(SPoint(p.arc["center"]).within(o.poly.buffer(120)) for o in openings)}

    # fixture candidates: plain linework not in walls, openings, stairs or dims
    cand_geoms = []
    for p in fprims:
        if p.kind not in ("other", "furniture") or id(p) in door_arcs:
            continue
        ls = LineString(p.pts)
        if ls.length < 30:
            continue
        if ls.within(opening_zone) or ls.intersects(hinge_zone) and p.etype == "LINE":
            continue
        if ls.within(wall_union.buffer(10)):
            continue
        cand_geoms.append((ls, p))
    clusters = _polys(unary_union([ls.buffer(12) for ls, _ in cand_geoms])) if cand_geoms else []
    candidates: list[RawCandidate] = []
    for k, cl in enumerate(sorted(clusters, key=lambda c: (-c.bounds[3], c.bounds[0]))):
        bx = cl.bounds
        w, h = bx[2] - bx[0], bx[3] - bx[1]
        if w * h < 0.03e6 or w * h > 14e6 or max(w, h) > 6000:
            continue
        if outside.buffer(400).contains(cl) is False:
            continue
        if stairs and cl.intersection(stair_zone.buffer(100)).area > 0.4 * cl.area:
            continue
        lines = [list(ls.coords) for ls, _ in cand_geoms if ls.intersects(cl)]
        candidates.append(RawCandidate(f"c{len(candidates) + 1}", bx, _simplify_lines(lines), "plain"))

    fblocks = []
    for name, layer, rot, sub in blocks:
        pts = [pt for p in sub for pt in p.pts]
        if not pts:
            continue
        xs, ys = [q[0] for q in pts], [q[1] for q in pts]
        bb = (min(xs), min(ys), max(xs), max(ys))
        c = ((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2)
        if not region.contains(SPoint(c)):
            continue
        fblocks.append(RawBlock(name, layer, c, bb, rot, _simplify_lines([p.pts for p in sub])))

    axis = {}
    for t in ftexts:
        if t.layer and classify_layer(t.layer) == "ignore" and re.fullmatch(r"[A-Za-zА-Я0-9]{1,2}", t.text):
            axis.setdefault(t.text, (t.x, t.y))

    stair_lines = _simplify_lines([p.pts for p in stair_prims])
    return RawFloor(fi, title, pieces, openings, rooms, footprint, ftexts, fblocks, candidates, stairs,
                    stair_lines, axis, (x0, y0, x1, y1))


def _simplify_lines(lines: list[list[tuple[float, float]]], tol: float = 8) -> list[list[tuple[float, float]]]:
    out = []
    for ln in lines:
        if len(ln) < 2:
            continue
        s = LineString(ln).simplify(tol)
        out.append([(round(x, 1), round(y, 1)) for x, y in s.coords])
    return out
