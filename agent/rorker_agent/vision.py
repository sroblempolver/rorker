"""Plan reading for drawings that are only pictures: scanned or flattened PDFs, photos of a drawing,
and hand sketches. Claude reads the image directly and returns rooms, openings and items in image
pixels plus a scale; code turns that into the same Plan structure as the CAD path.

This path is less exact than CAD (no exact coordinates), so every room is marked with a lower
confidence and the scale is one of the things the contractor can confirm.
"""
from __future__ import annotations

import base64
import io
import math

from PIL import Image, ImageOps
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

from . import __version__
from . import schema as S
from .interpret import FIXTURE_KINDS, MAX_QUESTIONS, OPENING_KINDS, ROOM_TYPES, call_claude
from .schema import Building, Fixture, Flag, Floor, Opening, Plan, Question, Room, SourceInfo, Wall

MAX_EDGE = 2400

VISION_SYSTEM = """You are the plan-reading engine of a construction management product for general contractors.
You get an image of a floor plan: a PDF export, a scan, a phone photo of a drawing, or a hand sketch. Read it like an
experienced contractor and return the plan as structured data in IMAGE PIXEL coordinates (x right, y down, origin at
the top-left of the full image you are given, which is the first image).

Rules:
- One entry per floor shown. Floors are often drawn side by side; name them from their titles.
- Rooms: polygon along the INSIDE face of the walls, vertices clockwise, only right angles unless the wall is
  clearly angled. Every enclosed space, including small ones (WC, closet, lobby). Name and type from labels,
  area figures and contents (beds, toilets, cars). Labels may be tiny, copied, abbreviated or misspelled.
- Openings: doors (single, double, sliding, garage), windows and open passages, each as the two end points of the
  gap measured along the wall centre line.
- Items: kitchen and bathroom fixtures and main furniture, each with its centre and size in pixels.
- Scale: work out millimetres per pixel from dimension strings or grid spacing (for example a 3600 bay), and say
  what you used. If nothing is written, estimate from typical sizes (doors about 800-900 mm, beds about 2000 mm).
- Reference point per floor: the pixel position of the top-left outside corner of that floor's main outer wall,
  so floors can be stacked.
- Ask at most 5 short questions, only about things that change the plan and that you cannot settle from the image,
  each with 2-4 options, your best guess first."""


def load_image(path: str) -> Image.Image:
    if path.lower().endswith(".pdf"):
        import pymupdf
        doc = pymupdf.open(path)
        page = doc[0]
        zoom = 3200 / max(page.rect.width, page.rect.height)
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    else:
        img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    # trim white margins
    gray = ImageOps.invert(img.convert("L")).point(lambda v: 255 if v > 30 else 0)
    bb = gray.getbbox()
    if bb:
        pad = 20
        img = img.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(img.width, bb[2] + pad),
                        min(img.height, bb[3] + pad)))
    s = MAX_EDGE / max(img.size)
    if s < 1:
        img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    return img


def _b64(img: Image.Image) -> dict:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return {"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                         "data": base64.standard_b64encode(buf.getvalue()).decode()}}


def _schema() -> dict:
    pt = {"type": "array", "items": {"type": "number"}}
    room = {"type": "object", "additionalProperties": False,
            "required": ["name", "type", "polygon", "label_text", "confidence"],
            "properties": {"name": {"type": "string"}, "type": {"type": "string", "enum": ROOM_TYPES},
                           "polygon": {"type": "array", "items": pt}, "label_text": {"type": "string"},
                           "confidence": {"type": "number"}}}
    opening = {"type": "object", "additionalProperties": False, "required": ["kind", "a", "b"],
               "properties": {"kind": {"type": "string", "enum": OPENING_KINDS}, "a": pt, "b": pt}}
    item = {"type": "object", "additionalProperties": False, "required": ["kind", "name", "center", "size"],
            "properties": {"kind": {"type": "string", "enum": FIXTURE_KINDS}, "name": {"type": "string"},
                           "center": pt, "size": pt}}
    floor = {"type": "object", "additionalProperties": False,
             "required": ["name", "level", "reference_px", "exterior_wall_mm", "rooms", "openings", "items"],
             "properties": {"name": {"type": "string"}, "level": {"type": "integer"}, "reference_px": pt,
                            "exterior_wall_mm": {"type": "number"},
                            "rooms": {"type": "array", "items": room}, "openings": {"type": "array", "items": opening},
                            "items": {"type": "array", "items": item}}}
    question = {"type": "object", "additionalProperties": False,
                "required": ["text", "room_names", "options", "kind"],
                "properties": {"text": {"type": "string"}, "room_names": {"type": "array", "items": {"type": "string"}},
                               "options": {"type": "array", "items": {"type": "string"}},
                               "kind": {"type": "string", "enum": ["room_name", "room_split", "fixture", "label",
                                                                   "exterior", "scale", "other"]}}}
    return {"type": "object", "additionalProperties": False,
            "required": ["mm_per_px", "scale_evidence", "floors", "questions"],
            "properties": {"mm_per_px": {"type": "number"}, "scale_evidence": {"type": "string"},
                           "floors": {"type": "array", "items": floor},
                           "questions": {"type": "array", "items": question}}}


def read_image_plan(path: str, filename: str, kind: str) -> Plan:
    img = load_image(path)
    content: list[dict] = [{"type": "text", "text": f"Full image ({img.width} x {img.height} px):"}, _b64(img)]
    # zoomed tiles so small labels and fixtures are readable; coordinates stay in full-image pixels
    w, h = img.size
    for (cx, cy) in ((0, 0), (1, 0), (0, 1), (1, 1)):
        x0, y0 = int(cx * w * 0.45), int(cy * h * 0.45)
        x1, y1 = int(min(w, x0 + w * 0.55)), int(min(h, y0 + h * 0.55))
        tile = img.crop((x0, y0, x1, y1))
        tile = tile.resize((tile.width * 2, tile.height * 2), Image.LANCZOS) if max(tile.size) < 1300 else tile
        content.append({"type": "text", "text": f"Zoomed tile covering full-image pixels x {x0}-{x1}, y {y0}-{y1}:"})
        content.append(_b64(tile))
    content.append({"type": "text", "text": "Read this plan. All coordinates in full-image pixels."})
    result, usage = call_claude(content, _schema(), system=VISION_SYSTEM)
    plan = plan_from_vision(result, filename, kind)
    plan.source.model = usage["model"]
    plan.source.ai_used = True
    plan.stats["ai_usage"] = usage
    plan.stats["scale_evidence"] = result.get("scale_evidence")
    return plan


def plan_from_vision(result: dict, filename: str, kind: str) -> Plan:
    k = float(result.get("mm_per_px") or 10.0)
    floors_in = sorted(result.get("floors", []), key=lambda f: f.get("level", 0))
    plan = Plan(source=SourceInfo(kind=kind, filename=filename, pipeline_version=__version__))

    # align floors on their reference corner
    def conv(f, p):
        rx, ry = f.get("reference_px") or [0, 0]
        return ((p[0] - rx) * k, (p[1] - ry) * k)

    all_pts = [conv(f, p) for f in floors_in for r in f["rooms"] for p in r["polygon"] if len(p) == 2]
    if not all_pts:
        raise ValueError("No rooms were found in the image.")
    minx = min(p[0] for p in all_pts) - 400
    miny = min(p[1] for p in all_pts) - 400

    def mm(f, p):
        x, y = conv(f, p)
        return (round(x - minx, 1), round(y - miny, 1))

    used = set()
    for fi, f in enumerate(floors_in):
        level = int(f.get("level", fi))
        code = "G" if level == 0 else ("B" if level < 0 else str(level))
        while code in used:
            code = f"{code}{fi}"
        used.add(code)
        floor = Floor(id=code, name=f.get("name") or ("Ground floor" if level == 0 else f"Level {level}"),
                      level=level, elevation_mm=level * 3000, bounds=(0, 0, 0, 0))
        rooms_geo = []
        for r in f["rooms"]:
            pts = [mm(f, p) for p in r["polygon"] if len(p) == 2]
            if len(pts) < 3:
                continue
            poly = Polygon(pts).buffer(0)
            if poly.geom_type != "Polygon" or poly.area < 0.3e6:
                continue
            rooms_geo.append((r, poly))
        rooms_geo.sort(key=lambda rp: (round(rp[1].bounds[1] / 500), rp[1].bounds[0]))
        for i, (r, poly) in enumerate(rooms_geo, 1):
            floor.rooms.append(Room(
                id=f"{code}-R{i:02d}", name=r["name"], type=r["type"],
                polygon=[(round(x, 1), round(y, 1)) for x, y in list(poly.exterior.coords)[:-1]],
                area_m2=round(poly.area / 1e6, 2), label_source="vision",
                confidence=min(float(r.get("confidence", 0.6)), 0.85),
                drawing_labels=[r["label_text"]] if r.get("label_text") else []))
        polys = [p for _, p in rooms_geo]
        ext_t = float(f.get("exterior_wall_mm") or 300)
        inside = unary_union([p.buffer(70, join_style=2) for p in polys])
        footprint = inside.buffer(ext_t - 70, join_style=2)
        floor.footprint = [[(round(x, 1), round(y, 1)) for x, y in list(g.exterior.coords)[:-1]]
                           for g in getattr(footprint, "geoms", [footprint])]

        # openings
        op_geo = []
        counters: dict[str, int] = {}
        for o in f.get("openings", []):
            a, b = mm(f, o["a"]), mm(f, o["b"])
            if math.dist(a, b) < 300:
                continue
            ln = LineString([a, b])
            t = ext_t if not inside.buffer(-20).contains(ln.centroid) else 150
            gap = ln.buffer(t * 0.75, cap_style=2)
            adj = [floor.rooms[j].id for j, p in enumerate(polys) if gap.buffer(60).intersects(p)]
            kd = o["kind"]
            prefix = {"window": "WN", "opening": "OP"}.get(kd, "D")
            counters[prefix] = counters.get(prefix, 0) + 1
            names = {"door": "Door", "double_door": "Double door", "window": "Window", "opening": "Open passage",
                     "garage_door": "Garage door", "sliding_door": "Sliding door"}
            floor.openings.append(Opening(
                id=f"{code}-{prefix}{counters[prefix]:02d}", kind=kd, name=names[kd], a=a, b=b,
                width_mm=round(math.dist(a, b)), thickness_mm=round(t), exterior=len(adj) <= 1,
                polygon=[(round(x, 1), round(y, 1)) for x, y in list(gap.exterior.coords)[:-1]], room_ids=adj,
                confidence=0.6))
            op_geo.append(gap)
        cut = unary_union(op_geo) if op_geo else Polygon()

        # walls: the band between rooms, split into straight pieces along each room edge
        mass = footprint.difference(unary_union(polys))
        wall_polys = []
        for p in polys:
            cs = list(p.exterior.coords)
            for (x0, y0), (x1, y1) in zip(cs, cs[1:]):
                if math.dist((x0, y0), (x1, y1)) < 300:
                    continue
                band = LineString([(x0, y0), (x1, y1)]).buffer(ext_t + 50, cap_style=2).intersection(mass)
                band = band.difference(unary_union(wall_polys)) if wall_polys else band
                band = band.difference(cut)
                for g in getattr(band, "geoms", [band]):
                    if g.geom_type == "Polygon" and g.area > 40000:
                        wall_polys.append(g)
        wall_polys.sort(key=lambda g: (round(g.bounds[1] / 500), g.bounds[0]))
        outside = footprint.buffer(1)
        for i, g in enumerate(wall_polys, 1):
            thick = 2 * g.area / g.length if g.length else 150
            adj = [floor.rooms[j].id for j, p in enumerate(polys) if g.buffer(40).intersection(p.exterior).length > 150]
            floor.walls.append(Wall(id=f"{code}-W{i:02d}",
                                    polygon=[(round(x, 1), round(y, 1)) for x, y in list(g.exterior.coords)[:-1]],
                                    length_mm=round(g.area / max(thick, 1)), thickness_mm=round(thick),
                                    exterior=g.buffer(80).difference(outside).area > 5000, room_ids=adj))
        for r in floor.rooms:
            r.wall_ids = [w.id for w in floor.walls if r.id in w.room_ids]
            r.opening_ids = [o.id for o in floor.openings if r.id in o.room_ids]

        # items
        items = []
        for it in f.get("items", []):
            c = mm(f, it["center"])
            sw, sh = (it.get("size") or [0, 0])[:2]
            sw, sh = max(sw * k, 200), max(sh * k, 200)
            room = next((floor.rooms[j].id for j, p in enumerate(polys) if p.contains(box(c[0] - 1, c[1] - 1, c[0] + 1, c[1] + 1))), None)
            items.append((c, sw, sh, it, room))
        items.sort(key=lambda t: (round(t[0][1] / 500), t[0][0]))
        for i, (c, sw, sh, it, room) in enumerate(items, 1):
            bb = (c[0] - sw / 2, c[1] - sh / 2, c[0] + sw / 2, c[1] + sh / 2)
            floor.fixtures.append(Fixture(id=f"{code}-F{i:02d}", kind=it["kind"], name=it["name"], room_id=room,
                                          center=c, bbox=tuple(round(v, 1) for v in bb), source="vision",
                                          confidence=0.6))
        b = footprint.bounds
        floor.bounds = tuple(round(v, 1) for v in b)
        plan.floors.append(floor)

    xs = [f.bounds[2] for f in plan.floors]
    ys = [f.bounds[3] for f in plan.floors]
    plan.building = Building(size_mm=(round(max(xs)), round(max(ys))))
    names = {r.name.lower(): r.id for f in plan.floors for r in f.rooms}
    for i, q in enumerate(result.get("questions", [])[:MAX_QUESTIONS], 1):
        ids = [names[n.lower()] for n in q.get("room_names", []) if n.lower() in names]
        opts = q.get("options") or []
        plan.questions.append(Question(id=f"Q{i}", text=q["text"], element_ids=ids, options=opts,
                                       default=opts[0] if opts else None, kind=q.get("kind", "other")))
    plan.flags.append(Flag(code="vision_source", severity="info",
                           message=f"Read from an image. Scale {k:.2f} mm per pixel: {result.get('scale_evidence', '')}"))
    plan.flags.append(Flag(code="no_exterior", severity="info",
                           message="The outside view is estimated from the footprint with 3 m storeys."))
    from .build import _stats
    plan.stats = _stats(plan)
    return plan
