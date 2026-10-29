"""Steps 3-4 without AI: turn the raw CAD geometry into a Plan with stable IDs, text labels
matched to rooms, named blocks mapped to fixture kinds, and flags for anything doubtful.

interpret.py then refines names, fixtures and questions with Claude.
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from statistics import median
from typing import Optional

from shapely.geometry import LineString, Point as SPoint, Polygon, box
from shapely.ops import unary_union

from . import __version__
from .cad import NUMBER_RE, RawDrawing, RawFloor, classify_layer
from .rules import ft2
from .schema import (Building, DoorLeaf, Fixture, Flag, Floor, Opening, Plan, Room, SourceInfo, Stair,
                     Wall)

# ---- vocabularies -------------------------------------------------------------------------

ROOM_WORDS: list[tuple[str, str, str]] = [
    # regex, type, display name
    (r"fam(ily)?\.?\s*room|^fam\b", "family", "Family room"),
    (r"kitchen|^kit\b", "kitchen", "Kitchen"),
    (r"dining|^din\b", "dining", "Dining room"),
    (r"living|lounge|^liv\b", "living", "Living room"),
    (r"master\s*bed", "bedroom", "Master bedroom"),
    (r"bed\s*room|^bed\b|^br\b|^bdrm", "bedroom", "Bedroom"),
    (r"bath\s*room|^bath\b|^ba\b", "bathroom", "Bathroom"),
    (r"en\s*suite|ensuite", "bathroom", "En-suite"),
    (r"lavatory|powder|^lav\b", "wc", "Lavatory"),
    (r"^w\.?c\.?$|toilet", "wc", "WC"),
    (r"laundry|utility|^w$", "laundry", "Laundry"),
    (r"garage", "garage", "Garage"),
    (r"study|library", "study", "Study"),
    (r"office", "office", "Office"),
    (r"foyer|entry|entrance|vestibule", "foyer", "Foyer"),
    (r"lobby", "hallway", "Lobby"),
    (r"hall|corridor|passage|landing", "hallway", "Hallway"),
    (r"stair", "stair_hall", "Stairs"),
    (r"closet|wardrobe|walk.?in|^wic\b", "closet", "Closet"),
    (r"pantry|store|storage", "storage", "Storage"),
    (r"balcony", "balcony", "Balcony"),
    (r"porch", "porch", "Porch"),
    (r"terrace|patio|deck", "terrace", "Terrace"),
]

BLOCK_WORDS: list[tuple[str, str, str]] = [
    (r"door.?handle|handle", "_skip", ""),
    (r"piple|people|person|human|figure", "_skip", ""),  # drawn people are decoration
    (r"s-?bed|single.?bed", "bed", "Single bed"),
    (r"bed", "bed", "Bed"),
    (r"night.?stand|bedside", "nightstand", "Nightstand"),
    (r"wardrobe|closet", "wardrobe", "Wardrobe"),
    (r"love.?seat", "sofa", "Loveseat"),
    (r"sofa|couch|settee", "sofa", "Sofa"),
    (r"arm.?cha", "armchair", "Armchair"),
    (r"desk.?lamp|table.?lamp", "lamp", "Desk lamp"),
    (r"standard.?lamp|floor.?lamp", "lamp", "Floor lamp"),
    (r"lamp|light", "lamp", "Lamp"),
    (r"chair|stool|seat", "chair", "Chair"),
    (r"desk", "desk", "Desk"),
    (r"dining.?table", "dining_table", "Dining table"),
    (r"table", "table", "Table"),
    (r"plant|tree|shrub", "plant", "Plant"),
    (r"toilet|^wc|water.?closet|^t$|^wc\d*$", "toilet", "Toilet"),
    (r"^(fh|hb|whb|lav)$", "washbasin", "Washbasin"),
    (r"basin|lavabo|vanity", "washbasin", "Washbasin"),
    (r"sink", "kitchen_sink", "Sink"),
    (r"bath|tub", "bathtub", "Bathtub"),
    (r"shower", "shower", "Shower"),
    (r"stove|cooktop|hob|range", "cooktop", "Cooktop"),
    (r"oven", "oven", "Oven"),
    (r"fridge|refrig", "fridge", "Fridge"),
    (r"dish.?wash", "dishwasher", "Dishwasher"),
    (r"wash(ing)?.?mach|washer", "washing_machine", "Washing machine"),
    (r"dryer", "dryer", "Dryer"),
    (r"boiler|water.?heater", "water_heater", "Water heater"),
    (r"\btv\b|television", "tv", "TV"),
    (r"car|auto|vehicle|mers", "car", "Car"),
    (r"fire.?place", "fireplace", "Fireplace"),
    (r"shelf|book", "bookshelf", "Bookshelf"),
]

FLOOR_CODES = [
    (r"basement|cellar|lower", "B", -1),
    (r"ground|^gf\b|main", "G", 0),
    (r"first|level\s*1\b|1st|upper", "1", 1),
    (r"second|level\s*2\b|2nd", "2", 2),
    (r"third|level\s*3\b|3rd", "3", 3),
]


def room_from_text(text: str) -> Optional[tuple[str, str]]:
    t = text.strip().lower()
    for rx, typ, name in ROOM_WORDS:
        if re.search(rx, t):
            return typ, name
    return None


def block_kind(name: str) -> tuple[str, str]:
    n = name.lower()
    for rx, kind, display in BLOCK_WORDS:
        if re.search(rx, n):
            return kind, display
    return "other", name


def _floor_code(title: Optional[str], index: int, n: int) -> tuple[str, str, int]:
    if title:
        t = title.lower()
        for rx, code, level in FLOOR_CODES:
            if re.search(rx, t):
                return code, title.strip().capitalize() if title.isupper() else title.strip(), level
        m = re.search(r"(\d+)", t)
        if m:
            return m.group(1), title.strip(), int(m.group(1))
    if index == 0:
        return "G", "Ground floor", 0
    return str(index), f"Level {index}", index


# ---- frame --------------------------------------------------------------------------------


class Frame:
    """Drawing (y up, floors side by side) -> plan (y down, floors stacked in one frame)."""

    def __init__(self, offsets: list[tuple[float, float]], bounds: tuple[float, float, float, float]):
        self.offsets = offsets
        self.minx, self.miny, self.maxx, self.maxy = bounds

    def pt(self, fi: int, p) -> tuple[float, float]:
        ox, oy = self.offsets[fi]
        x, y = p[0] - ox, p[1] - oy
        return (round(x - self.minx, 1), round(self.maxy - y, 1))

    def poly(self, fi: int, poly: Polygon) -> list[tuple[float, float]]:
        # drop the tiny fillets the CAD linework leaves at corners
        simple = poly.simplify(2, preserve_topology=True)
        if simple.is_empty or simple.geom_type != "Polygon":
            simple = poly
        return [self.pt(fi, c) for c in list(simple.exterior.coords)[:-1]]

    def lines(self, fi: int, lines) -> list[list[tuple[float, float]]]:
        return [[self.pt(fi, c) for c in ln] for ln in lines]

    def bbox(self, fi: int, bb) -> tuple[float, float, float, float]:
        a, b = self.pt(fi, (bb[0], bb[1])), self.pt(fi, (bb[2], bb[3]))
        return (min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1]))


def _align(floors: list[RawFloor]) -> list[tuple[float, float]]:
    """Offset of each floor relative to the first, from shared grid axis labels when the drawing
    has them, otherwise from the floors' wall bounds (aligned at their top-left corner)."""
    base = floors[0]
    offsets = [(0.0, 0.0)]
    for f in floors[1:]:
        common = set(base.axis_labels) & set(f.axis_labels)
        if len(common) >= 2:
            dx = median(f.axis_labels[k][0] - base.axis_labels[k][0] for k in common)
            dy = median(f.axis_labels[k][1] - base.axis_labels[k][1] for k in common)
            # labels sit beside the grid, so only the axis perpendicular to the floor offset is reliable
            if abs(dx) > abs(dy):
                dy = 0.0
            else:
                dx = 0.0
            offsets.append((dx, dy))
        else:
            offsets.append((f.bounds[0] - base.bounds[0], f.bounds[3] - base.bounds[3]))
    return offsets


# ---- build --------------------------------------------------------------------------------


def build_plan(raw: RawDrawing, filename: str, kind: str = "dxf") -> Plan:
    floors_raw = raw.floors
    offsets = _align(floors_raw)
    # overall bounds in the aligned drawing frame
    xs, ys = [], []
    for fi, f in enumerate(floors_raw):
        ox, oy = offsets[fi]
        xs += [f.bounds[0] - ox, f.bounds[2] - ox]
        ys += [f.bounds[1] - oy, f.bounds[3] - oy]
    frame = Frame(offsets, (min(xs), min(ys), max(xs), max(ys)))

    plan = Plan(source=SourceInfo(kind=kind, filename=filename, pipeline_version=__version__))
    plan.building = Building(size_mm=(round(max(xs) - min(xs)), round(max(ys) - min(ys))))
    label_floor_names: dict[str, list[str]] = defaultdict(list)

    used_codes = set()
    for fi, rf in enumerate(floors_raw):
        code, name, level = _floor_code(rf.title, fi, len(floors_raw))
        while code in used_codes:
            code = str(int(code) + 1) if code.isdigit() else f"{code}{fi}"
        used_codes.add(code)
        floor = _build_floor(plan, rf, fi, code, name, level, frame)
        floor.elevation_mm = level * 3000
        plan.floors.append(floor)
        for r in floor.rooms:
            for lab in r.drawing_labels:
                label_floor_names[lab.lower()].append(r.id)

    plan.floors.sort(key=lambda f: f.level)
    _cross_floor_flags(plan)
    plan.flags.append(Flag(code="no_exterior", severity="info",
                           message="The drawing has floor plans only. The outside view is estimated from "
                                   "the footprint and window positions with 10 ft storeys."))
    plan.stats = _stats(plan)
    return plan


def _sort_key(poly_pts):
    xs = [p[0] for p in poly_pts]
    ys = [p[1] for p in poly_pts]
    return (round(min(ys) / 500), min(xs))


def _build_floor(plan: Plan, rf: RawFloor, fi: int, code: str, name: str, level: int, fr: Frame) -> Floor:
    bx = fr.bbox(fi, rf.bounds)
    floor = Floor(id=code, name=name, level=level, bounds=bx,
                  footprint=[fr.poly(fi, p) for p in rf.footprint])

    # rooms -------------------------------------------------------------------------------
    rooms_geo = sorted(rf.rooms, key=lambda p: _sort_key(fr.poly(fi, p)))
    room_ids = []
    for i, poly in enumerate(rooms_geo, 1):
        rid = f"{code}-R{i:02d}"
        room_ids.append(rid)
        floor.rooms.append(Room(id=rid, name="Room", polygon=fr.poly(fi, poly),
                                area_m2=round(poly.area / 1e6, 2), label_source="drawing"))

    # texts -> rooms
    texts = [t for t in rf.texts if t.text and classify_layer(t.layer) != "ignore" or NUMBER_RE.match(t.text or "")]
    for t in texts:
        if not t.text.strip():
            continue
        pt = SPoint(t.x, t.y)
        is_num = bool(NUMBER_RE.match(t.text))
        hit = next((i for i, p in enumerate(rooms_geo) if p.contains(pt)), None)
        on_wall = False
        if hit is None:
            # label sitting on a wall: nearest room within 800 mm
            near = sorted(((p.distance(pt), i) for i, p in enumerate(rooms_geo)))
            if near and near[0][0] < 800:
                hit = near[0][1]
                on_wall = True
        if hit is None:
            continue
        room = floor.rooms[hit]
        if is_num:
            val = float(re.sub(r"[^\d.,]", "", t.text).replace(",", "."))
            if room.drawing_area_m2 is None or on_wall is False:
                room.drawing_area_m2 = val
        else:
            if re.search(r"floor|level|plan", t.text, re.I) and len(t.text) > 6:
                continue
            room.drawing_labels.append(t.text.strip())
            if on_wall:
                plan.flags.append(Flag(code="label_on_wall", severity="warn",
                                       message=f'The label "{t.text.strip()}" sits on a wall, not inside a room. '
                                               f"Matched to the nearest room.", element_ids=[room.id]))

    for room in floor.rooms:
        _name_room(plan, room)

    # walls ---------------------------------------------------------------------------------
    outside = unary_union(rf.footprint)
    walls_geo = sorted(rf.walls, key=lambda p: _sort_key(fr.poly(fi, p)))
    for i, poly in enumerate(walls_geo, 1):
        wid = f"{code}-W{i:02d}"
        mrr = poly.minimum_rotated_rectangle
        cs = list(mrr.exterior.coords)
        e = sorted([math.dist(cs[0], cs[1]), math.dist(cs[1], cs[2])])
        thick = max(60.0, 2 * poly.area / poly.length) if poly.length else e[0]
        length = poly.area / thick if thick else e[1]
        ext = poly.buffer(80).difference(outside).area > 5000
        adj = [room_ids[k] for k, rp in enumerate(rooms_geo)
               if poly.buffer(40).intersection(rp.exterior).length > 150]
        floor.walls.append(Wall(id=wid, polygon=fr.poly(fi, poly), length_mm=round(length),
                                thickness_mm=round(min(thick * 1.0, e[0])), exterior=ext, room_ids=adj))
        for rid in adj:
            next(r for r in floor.rooms if r.id == rid).wall_ids.append(wid)

    # openings ------------------------------------------------------------------------------
    ops = sorted(rf.openings, key=lambda o: _sort_key(fr.poly(fi, o.poly)))
    counters = Counter()
    for o in ops:
        adj = [room_ids[k] for k, rp in enumerate(rooms_geo) if o.poly.buffer(90).intersects(rp)]
        kind = o.kind
        if kind == "door" and len(o.leaves) >= 2:
            kind = "double_door"
        if kind == "opening" and o.exterior and o.width > 2300:
            adj_types = [next(r for r in floor.rooms if r.id == a).type for a in adj]
            kind = "garage_door" if "garage" in adj_types else "opening"
        prefix = {"window": "WN", "opening": "OP"}.get(kind, "D")
        counters[prefix] += 1
        oid = f"{code}-{prefix}{counters[prefix]:02d}"
        names = {"door": "Door", "double_door": "Double door", "window": "Window", "opening": "Open passage",
                 "garage_door": "Garage door", "sliding_door": "Sliding door"}
        nm = names[kind]
        if kind in ("door", "double_door") and o.exterior:
            nm = "Exterior " + nm.lower()
        leaves = []
        for lf in o.leaves:
            leaves.append(DoorLeaf(hinge=fr.pt(fi, lf["center"]), radius=round(lf["radius"]),
                                   start_angle=round(-lf["end"], 1), end_angle=round(-lf["start"], 1)))
        floor.openings.append(Opening(id=oid, kind=kind, name=nm, a=fr.pt(fi, o.a), b=fr.pt(fi, o.b),
                                      width_mm=round(o.width), thickness_mm=round(o.thickness),
                                      exterior=o.exterior, polygon=fr.poly(fi, o.poly), room_ids=adj,
                                      leaves=leaves))
        for rid in adj:
            next(r for r in floor.rooms if r.id == rid).opening_ids.append(oid)

    # stairs --------------------------------------------------------------------------------
    for i, sp in enumerate(sorted(rf.stairs, key=lambda p: -p.area)[:3], 1):
        room = next((room_ids[k] for k, rp in enumerate(rooms_geo) if rp.intersects(sp.centroid)), None)
        lines = [ln for ln in rf.stair_lines if sp.buffer(50).intersects(LineString(ln))]
        floor.stairs.append(Stair(id=f"{code}-S{i:02d}", polygon=fr.poly(fi, sp), room_id=room,
                                  outline=fr.lines(fi, lines)))

    # fixtures: named blocks + linework candidates --------------------------------------------
    items = []
    for b in rf.blocks:
        kind, display = block_kind(b.name)
        if kind == "_skip":
            continue
        c = SPoint(b.center)
        room = next((room_ids[k] for k, rp in enumerate(rooms_geo) if rp.contains(c)), None)
        if room is None and not outside.contains(c):
            continue  # site planting and the like
        items.append(dict(kind=kind, name=display, center=b.center, bbox=b.bbox, rot=b.rotation,
                          outline=b.outline, room=room, source="drawing", ref=b.name,
                          conf=1.0 if kind != "other" else 0.3))
    for cnd in rf.candidates:
        c = box(*cnd.bbox).centroid
        room = next((room_ids[k] for k, rp in enumerate(rooms_geo) if rp.contains(c)), None)
        if room is None:
            continue
        items.append(dict(kind="other", name="Unidentified item", center=(c.x, c.y), bbox=cnd.bbox, rot=0,
                          outline=cnd.outline, room=room, source="shape", ref=cnd.cid, conf=0.2))
    items.sort(key=lambda it: (round((-it["center"][1]) / 500), it["center"][0]))
    for i, it in enumerate(items, 1):
        floor.fixtures.append(Fixture(
            id=f"{code}-F{i:02d}", kind=it["kind"], name=it["name"], room_id=it["room"],
            center=fr.pt(fi, it["center"]), bbox=fr.bbox(fi, it["bbox"]), rotation=-it["rot"],
            outline=fr.lines(fi, it["outline"]), source=it["source"], source_ref=it["ref"],
            confidence=it["conf"]))

    _room_flags(plan, floor, rooms_geo)
    return floor


def _name_room(plan: Plan, room: Room):
    labels = [l for l in room.drawing_labels if not NUMBER_RE.match(l)]
    named = [(l, room_from_text(l)) for l in labels]
    known = [(l, m) for l, m in named if m]
    if known:
        types = {m[0] for _, m in known}
        room.type, room.name = known[0][1]
        room.confidence = 0.95 if len(types) == 1 else 0.5
        if len(set(l.lower() for l, _ in known)) > 1:
            plan.flags.append(Flag(code="room_multi_label", severity="ask",
                                   message=f"{room.id} has more than one label: {', '.join(l for l, _ in known)}.",
                                   element_ids=[room.id]))
    elif labels:
        room.name = labels[0].title()
        room.confidence = 0.5
        plan.flags.append(Flag(code="room_unknown_label", severity="ask",
                               message=f'{room.id} is labelled "{labels[0]}", which is not a room name I know.',
                               element_ids=[room.id]))
    else:
        room.name = "Room"
        room.label_source = "contents"
        room.confidence = 0.3
        plan.flags.append(Flag(code="room_no_label", severity="ask",
                               message=f"{room.id} ({ft2(room.area_m2)}) has no label in the drawing.",
                               element_ids=[room.id]))


def _room_flags(plan: Plan, floor: Floor, rooms_geo: list[Polygon]):
    by_id = {r.id: r for r in floor.rooms}
    for k, r in enumerate(floor.rooms):
        da = r.drawing_area_m2
        if da is None or da <= 0:
            continue
        if abs(da - r.area_m2) <= max(1.0, 0.15 * da):
            continue
        # does a neighbour make up the difference? then the drawing treats them as one room
        best = None
        for j, other in enumerate(floor.rooms):
            if j == k or not rooms_geo[k].buffer(400).intersects(rooms_geo[j]):
                continue
            combined = r.area_m2 + other.area_m2
            if abs(combined - da) <= max(1.5, 0.12 * da):
                best = other
        if best:
            plan.flags.append(Flag(
                code="room_split", severity="ask", element_ids=[r.id, best.id],
                message=f"The drawing gives {r.name.lower()} {r.id} an area of {ft2(da)}, which matches "
                        f"{r.id} and {best.id} together ({ft2(r.area_m2 + best.area_m2)}). The walls show two rooms."))
        else:
            plan.flags.append(Flag(
                code="area_mismatch", severity="warn", element_ids=[r.id],
                message=f"{r.id} measures {ft2(r.area_m2)} but the drawing says {ft2(da)}."))


def _cross_floor_flags(plan: Plan):
    if len(plan.floors) < 2:
        return
    ground = {lab.lower() for r in plan.floors[0].rooms for lab in r.drawing_labels}
    for f in plan.floors[1:]:
        for r in f.rooms:
            rep = [l for l in r.drawing_labels if l.lower() in ground and room_from_text(l)
                   and room_from_text(l)[0] in ("living", "foyer", "dining", "kitchen", "garage", "family")]
            if rep:
                plan.flags.append(Flag(
                    code="label_copied", severity="ask", element_ids=[r.id],
                    message=f'{r.id} on {f.name} carries the label(s) {", ".join(rep)}, which also appear on '
                            f"the ground floor. They may have been copied by mistake."))


def _stats(plan: Plan) -> dict:
    out = {}
    for f in plan.floors:
        out[f.id] = dict(rooms=len(f.rooms), walls=len(f.walls),
                         doors=sum(1 for o in f.openings if o.kind not in ("window", "opening")),
                         windows=sum(1 for o in f.openings if o.kind == "window"),
                         openings=sum(1 for o in f.openings if o.kind == "opening"),
                         fixtures=len(f.fixtures),
                         unidentified=sum(1 for x in f.fixtures if x.kind == "other"))
    return out
