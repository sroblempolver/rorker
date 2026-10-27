"""The plan reader's self-check. Once a plan is read, it is built the way the 3D builds it (the house
rules in rules.py fill in whatever the drawing leaves out) and checked before the contractor sees it:

1. Rules, no AI: what a builder spots at a glance. A floor drawn a few centimetres off the one below is
   lined up with it. A roof the drawing doesn't show, a house with no door to the outside and a garage
   with no way in for a car become questions, each with a spot on the building for the blinking dot.
2. With the AI: the drawing goes next to elevations of what was built, and Claude lists what doesn't
   match. What it can settle itself (the roof, the storey height, a door that is really a window, a room
   that is really a porch) is fixed; the rest becomes a question.
"""
from __future__ import annotations

import io
import math

from .rules import RULES, opening_span
from .schema import Flag, Floor, Plan, Question, QuestionPoint

MAX_QUESTIONS = 5
ALIGN_MAX = 200  # mm: a bigger offset between floors is design, not drawing error
ENTRY_ROOMS = {"foyer", "hallway", "stair_hall", "living"}
DOORS = {"door", "double_door", "sliding_door"}


def self_check(plan: Plan, ai: bool = False, drawing_png: bytes | None = None) -> Plan:
    fixes = align_floors(plan)
    questions = rule_questions(plan)
    if ai:
        try:
            more, ai_fixes = ai_check(plan, drawing_png)
            fixes += ai_fixes
            questions = [q for q in questions if not _settled(plan, q)] + more
        except Exception as e:  # the plan is still good without the second look
            plan.flags.append(Flag(code="self_check_failed", severity="info", message=str(e)[:200]))
    add_questions(plan, questions)
    plan.stats["self_check"] = dict(fixes=fixes, questions=[q.text for q in questions])
    return plan


# ---- 1. rules --------------------------------------------------------------------------------------


def _indoor_bbox(f: Floor):
    pts = [p for r in f.rooms if not r.outdoor for p in r.polygon]
    if not pts:
        return None
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def align_floors(plan: Plan) -> list[str]:
    """Line each floor up with the one below when both outside edges on an axis are off by the same few
    centimetres: a drawing misalignment, not a design. Returns what was moved."""
    floors = sorted(plan.floors, key=lambda f: f.level)
    done = []
    for lo, up in zip(floors, floors[1:]):
        a, b = _indoor_bbox(lo), _indoor_bbox(up)
        if not a or not b:
            continue
        shift = []
        for i0, i1 in ((0, 2), (1, 3)):
            d0, d1 = b[i0] - a[i0], b[i1] - a[i1]
            ok = abs(d0) <= ALIGN_MAX and abs(d1) <= ALIGN_MAX and abs(d0 - d1) <= 20 and abs(d0 + d1) / 2 > 5
            shift.append(-round((d0 + d1) / 2) if ok else 0)
        if any(shift):
            translate_floor(up, *shift)
            done.append(f"Moved {up.name} by {shift[0]} mm, {shift[1]} mm to line up with {lo.name}")
    return done


def translate_floor(f: Floor, dx: float, dy: float):
    mv = lambda p: (p[0] + dx, p[1] + dy)  # noqa: E731
    box = lambda b: (b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy)  # noqa: E731
    f.footprint = [[mv(p) for p in ring] for ring in f.footprint]
    f.bounds = box(f.bounds)
    for r in f.rooms:
        r.polygon = [mv(p) for p in r.polygon]
    for w in f.walls:
        w.polygon = [mv(p) for p in w.polygon]
    for o in f.openings:
        o.a, o.b, o.polygon = mv(o.a), mv(o.b), [mv(p) for p in o.polygon]
        for lf in o.leaves:
            lf.hinge = mv(lf.hinge)
    for x in f.fixtures:
        x.center, x.bbox = mv(x.center), box(x.bbox)
        x.outline = [[mv(p) for p in ln] for ln in x.outline]
    for s in f.stairs:
        s.polygon = [mv(p) for p in s.polygon]
        s.outline = [[mv(p) for p in ln] for ln in s.outline]


def _top_point(plan: Plan) -> QuestionPoint | None:
    floors = sorted(plan.floors, key=lambda f: f.level)
    if not floors:
        return None
    top = floors[-1]
    b = _indoor_bbox(top) or top.bounds
    return QuestionPoint(floor_id=top.id, x=round((b[0] + b[2]) / 2), y=round((b[1] + b[3]) / 2),
                         z=(top.height_mm or 2700) + 3500, outside=True)  # above the ridge


def _at(f: Floor, el, z: float = 1500) -> QuestionPoint:
    if hasattr(el, "a"):
        x, y = (el.a[0] + el.b[0]) / 2, (el.a[1] + el.b[1]) / 2
    else:
        pts = el.polygon
        x, y = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
    return QuestionPoint(floor_id=f.id, x=round(x), y=round(y), z=z, outside=True)


ROOF_OPTIONS = ["Hip", "Gable", "Flat"]


def rule_questions(plan: Plan) -> list[Question]:
    out: list[Question] = []
    floors = sorted(plan.floors, key=lambda f: f.level)
    if not floors:
        return out
    g = floors[0]
    if plan.building.exterior.roof == "unknown":
        out.append(Question(id="", kind="exterior", element_ids=["roof"], options=ROOF_OPTIONS, default="Hip",
                            text="What kind of roof is it? I drew a hip roof (sloping on all four sides) for now.",
                            point=_top_point(plan)))
    if not any(o.exterior and o.kind in DOORS for o in g.openings):
        tp = _top_point(plan)
        out.append(Question(id="", kind="exterior", element_ids=[], options=["I'll point to it", "There isn't one yet"],
                            text="I can't find a door to the outside on the ground floor. Where is the way in?",
                            point=QuestionPoint(floor_id=g.id, x=tp.x, y=tp.y, z=1200, outside=True) if tp else None))
    for r in g.rooms:
        if r.type != "garage":
            continue
        ways_in = [o for o in g.openings if r.id in o.room_ids and o.exterior and (o.kind == "garage_door" or o.width_mm > 2000)]
        if not ways_in:
            out.append(Question(id="", kind="exterior", element_ids=[r.id], options=["Garage door on the street side", "No car door, it's used as a room"],
                                default="Garage door on the street side",
                                text=f"The garage ({r.id}) has no door wide enough for a car. Is there a garage door?",
                                point=_at(g, r, 1200)))
    return out


def _settled(plan: Plan, q: Question) -> bool:
    return "roof" in q.element_ids and plan.building.exterior.roof != "unknown"


def add_questions(plan: Plan, new: list[Question]):
    """Building questions go in with the reader's own; at most MAX_QUESTIONS open at once, so the least
    useful room questions give way (they keep their best guess)."""
    answered = [q for q in plan.questions if q.answer]
    open_ = [q for q in plan.questions if not q.answer and not _settled(plan, q)]
    have = {q.text for q in plan.questions}
    new = [q for q in new if q.text not in have]
    keep = max(0, MAX_QUESTIONS - len(new))
    merged = open_[:keep] + new[:MAX_QUESTIONS]
    for q in merged:
        if not q.default and q.options:
            q.default = q.options[0]
    plan.questions = answered + merged
    n = len(answered)
    for i, q in enumerate(merged, n + 1):
        q.id = f"Q{i}"


def apply_exterior_answer(plan: Plan, q: Question) -> bool:
    """The rule-side answers to the building questions. True when the answer was used."""
    a = (q.answer or "").strip().lower()
    if "roof" in q.element_ids:
        for kind in ("hip", "gable", "flat"):
            if kind in a:
                plan.building.exterior.roof = kind
                return True
        if "pitch" in a or "slop" in a:
            plan.building.exterior.roof = "hip"
            return True
    return False


# ---- 2. the AI's second look ----------------------------------------------------------------------


def outward(f: Floor, o) -> tuple[float, float]:
    """The unit vector from a door or window out of the building, away from its rooms."""
    from shapely.geometry import Point, Polygon
    dx, dy = o.b[0] - o.a[0], o.b[1] - o.a[1]
    L = math.hypot(dx, dy) or 1
    n = (-dy / L, dx / L)
    mx, my = (o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2
    probe = Point(mx + n[0] * (o.thickness_mm / 2 + 250), my + n[1] * (o.thickness_mm / 2 + 250))
    if any(Polygon(r.polygon).contains(probe) for r in f.rooms if not r.outdoor and len(r.polygon) >= 3):
        n = (-n[0], -n[1])
    return n


def describe_outside(plan: Plan) -> str:
    """What was built, in words: the part of the 3D that comes from rules rather than the drawing."""
    ex = plan.building.exterior
    floors = sorted(plan.floors, key=lambda f: f.level)
    lines = [f"Floors: {', '.join(f'{f.name} ({f.id}) at {f.elevation_mm:.0f} mm, {f.height_mm:.0f} mm high' for f in floors)}.",
             f"Roof: {ex.roof if ex.roof != 'unknown' else 'not shown, so a hip roof by the rules'}, pitch "
             f"{ex.roof_pitch_deg or RULES['pitch']} degrees, eaves {ex.eave_mm or RULES['eave']} mm out; lower parts of the "
             "house not covered by a floor above get a lean-to roof against the taller wall.",
             f"Ground floor stands {ex.plinth_mm or RULES['plinth']} mm above the grade; walls with no room on either side are "
             "drawn as porch posts (columns if 200-600 mm, railing posts if thinner) and the porch gets a canopy on its posts, "
             "or the balcony of the floor above when there is one."]
    for f in floors:
        for o in f.openings:
            if not o.exterior:
                continue
            types = [r.type for r in f.rooms if r.id in o.room_ids]
            lo, hi = opening_span(o.kind, types)
            lines.append(f"- {o.id} {o.kind} {o.width_mm:.0f} mm wide, {lo:.0f} to {hi:.0f} mm above the floor, rooms {o.room_ids or 'none (porch)'}")
        posts = [w.id for w in f.walls if not w.room_ids]
        if posts:
            lines.append(f"- {f.name}: free-standing walls (porch posts or balcony): {', '.join(posts)}")
    return "\n".join(lines)


def render_elevations(plan: Plan, px: int = 1400) -> bytes:
    """Four flat elevations of what was built: walls, doors and windows at their rule heights, porch posts
    and the roof outline. The AI compares them with the drawing."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon as MPoly, Rectangle

    floors = sorted(plan.floors, key=lambda f: f.level)
    ex = plan.building.exterior
    roof = ex.roof if ex.roof != "unknown" else "hip"
    pitch = math.tan(math.radians(ex.roof_pitch_deg or RULES["pitch"]))
    sides = [("Front", (0, 1)), ("Back", (0, -1)), ("Left", (-1, 0)), ("Right", (1, 0))]
    fig, axs = plt.subplots(2, 2, figsize=(px / 100, px / 100 * 0.7), dpi=100)
    for ax, (name, (nx, ny)) in zip(axs.flat, sides):
        along = (lambda p: p[0]) if nx == 0 else (lambda p: p[1])
        for fi, f in enumerate(floors):
            base = f.elevation_mm or fi * RULES["storey"]
            H = f.height_mm or 2700
            b = _indoor_bbox(f)
            if not b:
                continue
            u0, u1 = (b[0], b[2]) if nx == 0 else (b[1], b[3])
            ax.add_patch(Rectangle((u0, base), u1 - u0, H, facecolor="#e8e1d3", edgecolor="#333", lw=1))
            for o in f.openings:
                if not o.exterior:
                    continue
                n = outward(f, o)
                if n[0] * nx + n[1] * ny < 0.7:
                    continue
                lo, hi = opening_span(o.kind, [r.type for r in f.rooms if r.id in o.room_ids])
                a0, a1 = sorted((along(o.a), along(o.b)))
                col = "#9cc9df" if o.kind in ("window", "sliding_door") else "#ffffff" if not o.room_ids else "#8a6a48"
                ax.add_patch(Rectangle((a0, base + lo), a1 - a0, hi - lo, facecolor=col, edgecolor="#333", lw=0.8))
                ax.text((a0 + a1) / 2, base + hi + 80, o.id, ha="center", fontsize=6)
            for w in f.walls:
                if w.room_ids:
                    continue
                us, vs = [along(p) for p in w.polygon], [p[1] if nx == 0 else p[0] for p in w.polygon]
                thin = min(max(us) - min(us), max(vs) - min(vs)) <= 200
                ax.add_patch(Rectangle((min(us), base), max(us) - min(us), RULES["railing"] if thin else H, facecolor="#f2eee6", edgecolor="#333", lw=0.8))
        top = floors[-1]
        b = _indoor_bbox(top)
        if b:
            u0, u1 = (b[0], b[2]) if nx == 0 else (b[1], b[3])
            w0, w1 = (b[1], b[3]) if nx == 0 else (b[0], b[2])
            eave = (top.elevation_mm or (len(floors) - 1) * RULES["storey"]) + (top.height_mm or 2700)
            o = ex.eave_mm or RULES["eave"]
            if roof == "flat":
                ax.add_patch(Rectangle((u0 - 150, eave), u1 - u0 + 300, 250, facecolor="#3d3f43"))
            else:
                # the ridge runs along the long side: seen from there a hip is a trapezoid and a gable a
                # band; seen from the end, both are a triangle
                span = min(u1 - u0, w1 - w0)
                rise = span / 2 * pitch
                inset = min((u1 - u0) / 2, span / 2) if roof == "hip" or (u1 - u0) < (w1 - w0) else -o
                pts = [(u0 - o, eave - o * pitch), (u1 + o, eave - o * pitch), (u1 - inset, eave + rise), (u0 + inset, eave + rise)]
                ax.add_patch(MPoly(pts, closed=True, facecolor="#3d3f43", edgecolor="#222"))
        ax.axhline(-(ex.plinth_mm or RULES["plinth"]), color="#5a7a40", lw=2)
        ax.set_title(f"{name} elevation (mm)", fontsize=10)
        ax.set_aspect("equal")
        ax.autoscale_view()
        ax.tick_params(labelsize=6)
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png")
    plt.close(fig)
    return buf.getvalue()


SYSTEM = """You check a building model against the drawing it was built from, for a construction app used
by general contractors. The plan reader already turned the drawing into rooms, walls, doors and windows.
Where the drawing says nothing (heights, the roof, porches), house rules filled in code-normal values.
You get the drawing, the elevations of what was built and a list of what the rules filled in.

Find what doesn't match the drawing or would look wrong to a builder: the wrong roof type (look for roof
lines, hip or ridge lines, a roof plan or elevation, notes), the wrong storey height (level marks, section
heights), a door that is a window or the other way round, a room that is really an open porch or balcony,
porch posts with nothing on them. Fix what the drawing settles. Ask only about what changes the build and
the drawing cannot settle, at most 3 questions, each one short sentence with 2-4 options, best guess
first. Return no fixes and no questions when it all matches."""


def _schema() -> dict:
    return {
        "type": "object", "additionalProperties": False,
        "required": ["fixes", "questions", "notes"],
        "properties": {
            "fixes": {"type": "array", "items": {
                "type": "object", "additionalProperties": False, "required": ["op", "id", "value", "why"],
                "properties": {
                    "op": {"type": "string", "enum": ["set_roof", "set_storey_height", "set_opening_kind", "set_room_outdoor"]},
                    "id": {"type": "string", "description": "element ID, or empty for the building"},
                    "value": {"type": "string", "description": "hip/gable/flat; millimetres; an opening kind; true/false"},
                    "why": {"type": "string"}}}},
            "questions": {"type": "array", "items": {
                "type": "object", "additionalProperties": False, "required": ["text", "options", "element_ids"],
                "properties": {"text": {"type": "string"}, "options": {"type": "array", "items": {"type": "string"}},
                               "element_ids": {"type": "array", "items": {"type": "string"}}}}},
            "notes": {"type": "string"},
        },
    }


def ai_check(plan: Plan, drawing_png: bytes | None) -> tuple[list[Question], list[str]]:
    from .interpret import _png_block, call_claude
    from .render import render_plan_sheet
    drawing = drawing_png or render_plan_sheet(plan)
    content = [{"type": "text", "text": "The drawing:"}, _png_block(drawing),
               {"type": "text", "text": "Elevations of what was built from it:"}, _png_block(render_elevations(plan)),
               {"type": "text", "text": "What the house rules filled in:\n" + describe_outside(plan)}]
    result, usage = call_claude(content, _schema(), system=SYSTEM)
    plan.stats.setdefault("self_check_usage", []).append(usage)
    return _apply_ai(plan, result)


def _apply_ai(plan: Plan, result: dict) -> tuple[list[Question], list[str]]:
    idx = plan.element_index()
    done = []
    for fx in result.get("fixes", []):
        op, el, v = fx.get("op"), idx.get(fx.get("id") or ""), str(fx.get("value", "")).strip().lower()
        if op == "set_roof" and v in ("hip", "gable", "flat"):
            plan.building.exterior.roof = v
        elif op == "set_storey_height" and v.replace(".", "", 1).isdigit() and 2200 <= float(v) <= 6000:
            h = float(v)
            plan.building.exterior.storey_height_mm = h
            for i, f in enumerate(sorted(plan.floors, key=lambda f: f.level)):
                f.elevation_mm, f.height_mm = i * h, h
        elif op == "set_opening_kind" and el is not None and hasattr(el, "leaves") and v in ("door", "double_door", "sliding_door", "garage_door", "window", "opening"):
            el.kind = v
        elif op == "set_room_outdoor" and el is not None and hasattr(el, "outdoor"):
            el.outdoor = v in ("true", "yes", "1")
        else:
            continue
        done.append(f"{op} {fx.get('id') or ''} {v}: {fx.get('why', '')}".strip())
    qs = []
    floor_of = {el_id: f for f in plan.floors for coll in (f.rooms, f.walls, f.openings, f.fixtures, f.stairs) for el_id in (x.id for x in coll)}
    for q in result.get("questions", [])[:3]:
        ids = [i for i in q.get("element_ids", []) if i in idx]
        point = _at(floor_of[ids[0]], idx[ids[0]]) if ids and hasattr(idx[ids[0]], "polygon") else _top_point(plan)
        qs.append(Question(id="", kind="exterior", text=q["text"], options=q.get("options", [])[:4],
                           element_ids=ids or (["roof"] if "roof" in q["text"].lower() else []), point=point))
    if result.get("notes"):
        plan.building.exterior.notes = result["notes"][:500]
    return qs, done
