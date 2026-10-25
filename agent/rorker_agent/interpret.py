"""Steps 3 and 5 of the plan-reading agent: Claude looks at the drawing and the extracted data,
names rooms and fixtures, and writes the short question batch for the contractor.

Also applies the contractor's answers back onto the plan (apply_answers).
"""
from __future__ import annotations

import base64
import json
import os
import time
from typing import Any

import anthropic
from shapely.geometry import Polygon
from shapely.ops import unary_union

from .render import render_floor, room_crop
from .schema import Flag, Plan, Question
from . import schema as S

MODEL = os.environ.get("RORKER_MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("RORKER_EFFORT", "high")
MAX_QUESTIONS = 5

ROOM_TYPES = list(S.RoomType.__args__)
FIXTURE_KINDS = list(S.FixtureKind.__args__)
OPENING_KINDS = list(S.OpeningKind.__args__)

SYSTEM = """You are the plan-reading engine of a construction management product for general contractors.
You receive a building drawing that code has already parsed into rooms, walls, openings and items, each with
a short unique ID (G-R03 = ground floor room 3, 1-F12 = level 1 item 12). Your job is to interpret it the way
an experienced contractor would, so the contractor gets a correct plan and only has to answer a few questions.

How to work:
- Trust the geometry (walls, room shapes, areas, item positions); it comes straight from the CAD file.
- Interpret the meaning: room names and types, what each unidentified item is, and which door is the front door.
- Use every clue: labels written in the drawing, the area figures, the items inside each room (a bed means a
  bedroom; a toilet and basin mean a bathroom or WC; a car means a garage), room size and position.
- Drawing labels can be wrong: copied from another floor, abbreviated ("W", "FAM. ROOM"), misspelled, or
  sitting on a wall. Fix spelling and expand abbreviations silently when the meaning is clear.
- An item marked "Unidentified" is plain linework the code could not name. Look at its shape in the images
  (dashed box with its ID). Kitchen runs of rectangles along a wall are base cabinets; a small circle-in-
  rectangle in a bathroom is a washbasin; an oval with a tank is a toilet; a long rounded rectangle is a
  bathtub; a square with a diagonal or a drain is a shower; four circles in a square is a cooktop.
  Use kind "other" with a short descriptive name only when you really cannot tell. Use "none" when it is not
  an object at all (a rug outline, a hatch boundary, a stray line, part of a door or window).
- Only ask about things that change the plan and that you cannot settle from the drawing. Never ask about
  something you are confident about. Ask at most 5 questions, fewer is better, zero is fine. Each question is
  one short sentence a busy contractor can answer by tapping an option or saying a few words, names the
  element IDs it is about, and offers 2-4 options with the first being your best guess (which the plan uses
  until answered). Merge related doubts into one question.
- Keep your own names short and plain (Kitchen, Master bedroom, Base cabinet, Toilet)."""


def _room_summary(plan: Plan) -> list[dict]:
    out = []
    for f in plan.floors:
        for r in f.rooms:
            items = [f"{x.id.split('-', 1)[1]}:{'Unidentified' if x.kind == 'other' else x.name}"
                     for x in f.fixtures if x.room_id == r.id]
            out.append(dict(id=r.id, floor=f.name, current_name=r.name, drawing_labels=r.drawing_labels,
                            drawing_area_m2=r.drawing_area_m2, measured_area_m2=r.area_m2,
                            openings=r.opening_ids, items=items))
    return out


def _fixture_summary(plan: Plan) -> list[dict]:
    out = []
    for f in plan.floors:
        for x in f.fixtures:
            w, h = x.bbox[2] - x.bbox[0], x.bbox[3] - x.bbox[1]
            out.append(dict(id=x.id, room=x.room_id, current=("Unidentified" if x.kind == "other" else x.name),
                            source=("CAD block " + (x.source_ref or "")) if x.source == "drawing" else "plain lines",
                            size_mm=[round(w), round(h)]))
    return out


def _png_block(data: bytes) -> dict:
    return {"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                         "data": base64.standard_b64encode(data).decode()}}


def _output_schema() -> dict:
    room = {"type": "object", "additionalProperties": False,
            "required": ["id", "name", "type", "confidence", "reason"],
            "properties": {"id": {"type": "string"}, "name": {"type": "string"},
                           "type": {"type": "string", "enum": ROOM_TYPES},
                           "confidence": {"type": "number"}, "reason": {"type": "string"}}}
    fixture = {"type": "object", "additionalProperties": False,
               "required": ["id", "kind", "name", "confidence"],
               "properties": {"id": {"type": "string"}, "kind": {"type": "string", "enum": FIXTURE_KINDS + ["none"]},
                              "name": {"type": "string"}, "confidence": {"type": "number"}}}
    opening = {"type": "object", "additionalProperties": False, "required": ["id", "kind", "name"],
               "properties": {"id": {"type": "string"}, "kind": {"type": "string", "enum": OPENING_KINDS},
                              "name": {"type": "string"}}}
    question = {"type": "object", "additionalProperties": False,
                "required": ["text", "element_ids", "options", "kind"],
                "properties": {"text": {"type": "string"}, "element_ids": {"type": "array", "items": {"type": "string"}},
                               "options": {"type": "array", "items": {"type": "string"}},
                               "kind": {"type": "string", "enum": ["room_name", "room_split", "fixture", "label",
                                                                   "exterior", "scale", "other"]}}}
    return {"type": "object", "additionalProperties": False,
            "required": ["building_name", "rooms", "fixtures", "openings", "merge_rooms", "questions", "roof", "notes"],
            "properties": {
                "building_name": {"type": "string"},
                "rooms": {"type": "array", "items": room},
                "fixtures": {"type": "array", "items": fixture},
                "openings": {"type": "array", "items": opening},
                "merge_rooms": {"type": "array", "items": {"type": "array", "items": {"type": "string"}}},
                "questions": {"type": "array", "items": question},
                "roof": {"type": "string", "enum": ["gable", "hip", "flat", "unknown"]},
                "notes": {"type": "string"},
            }}


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(max_retries=3, timeout=900, **_client_overrides)


_client_overrides: dict = {}  # tests inject a mock http_client here


def call_claude(content: list[dict], schema: dict, system: str = SYSTEM) -> tuple[dict, dict]:
    """One structured call. Returns (parsed JSON, usage info)."""
    client = _client()
    t0 = time.time()
    with client.beta.messages.stream(
        model=MODEL,
        max_tokens=64000,
        system=system,
        thinking={"type": "adaptive"},
        output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": schema}},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[{"role": "user", "content": content}],
    ) as stream:
        msg = stream.get_final_message()
    if msg.stop_reason == "refusal":
        raise RuntimeError(f"The model declined the request: {getattr(msg, 'stop_details', None)}")
    if msg.stop_reason == "max_tokens":
        raise RuntimeError("The model ran out of output tokens before finishing the plan.")
    text = next(b.text for b in msg.content if b.type == "text")
    usage = dict(model=msg.model, input_tokens=msg.usage.input_tokens, output_tokens=msg.usage.output_tokens,
                 seconds=round(time.time() - t0, 1))
    return json.loads(text), usage


# ---- interpretation of a CAD plan -------------------------------------------------------------


def interpret_cad_plan(plan: Plan) -> Plan:
    content: list[dict] = []
    for f in plan.floors:
        content.append({"type": "text", "text": f"Floor {f.id} ({f.name}), annotated: room IDs, and dashed boxes "
                                                f"around items that need naming."})
        content.append(_png_block(render_floor(f, annotate="ids", px=2400)))
    # close-ups of small rooms with unidentified items (kitchens, bathrooms)
    crops = []
    for f in plan.floors:
        for r in f.rooms:
            unk = [x for x in f.fixtures if x.room_id == r.id and x.kind == "other"]
            if unk and r.area_m2 < 30:
                crops.append((len(unk), f, r))
    crops.sort(key=lambda c: -c[0])
    for _, f, r in crops[:10]:
        content.append({"type": "text", "text": f"Close-up of {r.id}."})
        content.append(_png_block(render_floor(f, annotate="ids", px=1200, crop=room_crop(f, r.id))))

    data = dict(
        floors=[dict(id=f.id, name=f.name, level=f.level) for f in plan.floors],
        rooms=_room_summary(plan),
        items=_fixture_summary(plan),
        openings=[dict(id=o.id, kind=o.kind, exterior=o.exterior, width_mm=o.width_mm, rooms=o.room_ids)
                  for f in plan.floors for o in f.openings if o.kind != "window"],
        flags=[fl.model_dump(include={"code", "message", "element_ids"}) for fl in plan.flags if fl.severity != "info"],
        exterior="The drawing has floor plans only, no elevations." if any(
            fl.code == "no_exterior" for fl in plan.flags) else "Elevations present.",
    )
    content.append({"type": "text", "text": (
        "Parsed data (JSON):\n" + json.dumps(data, ensure_ascii=False) +
        "\n\nReturn: every room with its final name and type; every item whose current name is 'Unidentified' "
        "or whose CAD block name looks wrong, with its kind and name; openings you want to rename or reclassify "
        "(for example the front door, a garage door, sliding doors); rooms that should be merged into one "
        "because the drawing clearly treats them as one room (only when you are sure, otherwise ask); "
        f"and at most {MAX_QUESTIONS} questions. The flags list what the code found doubtful; resolve each one "
        "either by deciding or by asking.")})

    result, usage = call_claude(content, _output_schema())
    apply_result(plan, result, source="ai")
    plan.source.model = usage["model"]
    plan.source.ai_used = True
    plan.stats["ai_usage"] = usage
    return plan


def apply_result(plan: Plan, result: dict[str, Any], source: str = "ai"):
    idx = plan.element_index()
    for r in result.get("rooms", []):
        room = idx.get(r["id"])
        if not isinstance(room, S.Room):
            continue
        if room.name != r["name"] and source == "ai":
            room.label_source = "ai" if room.drawing_labels else "contents"
        if source == "contractor":
            room.label_source = "contractor"
        room.name, room.type = r["name"], r["type"]
        room.confidence = float(r.get("confidence", room.confidence))
        if r.get("reason"):
            room.notes = r["reason"]
    for fx in result.get("fixtures", []):
        item = idx.get(fx["id"])
        if not isinstance(item, S.Fixture):
            continue
        if fx["kind"] == "none":
            for f in plan.floors:
                f.fixtures = [x for x in f.fixtures if x.id != item.id]
            continue
        item.kind, item.name = fx["kind"], fx["name"]
        item.confidence = float(fx.get("confidence", 0.8))
        if item.source == "shape":
            item.source = "ai" if source == "ai" else "contractor"
    for o in result.get("openings", []):
        op = idx.get(o["id"])
        if isinstance(op, S.Opening):
            op.kind, op.name = o["kind"], o["name"]
    for group in result.get("merge_rooms", []):
        merge_rooms(plan, group)
    if result.get("building_name"):
        plan.building.name = result["building_name"]
    if result.get("roof"):
        plan.building.exterior.roof = result["roof"]
    if result.get("notes"):
        plan.building.exterior.notes = result["notes"] if source == "ai" else plan.building.exterior.notes
    if "questions" in result:
        qs = []
        for i, q in enumerate(result["questions"][:MAX_QUESTIONS], 1):
            opts = q.get("options") or []
            qs.append(Question(id=f"Q{i}", text=q["text"], element_ids=q.get("element_ids", []), options=opts,
                               default=opts[0] if opts else None, kind=q.get("kind", "other")))
        if source == "ai":
            plan.questions = qs
        else:  # follow-up questions after answers
            answered = [q for q in plan.questions if q.answer]
            plan.questions = answered + [q.model_copy(update={"id": f"Q{len(answered) + i}"}) for i, q in
                                         enumerate(qs, 1)]


def merge_rooms(plan: Plan, ids: list[str]):
    """Merge rooms that the walls split but the contractor (or drawing) treats as one. The first ID stays."""
    if len(ids) < 2:
        return
    for f in plan.floors:
        rooms = [r for r in f.rooms if r.id in ids]
        if len(rooms) != len(ids):
            continue
        keep = next(r for r in rooms if r.id == ids[0])
        shared = [o for o in f.openings if sum(1 for r in rooms if r.id in o.room_ids) >= 2]
        geo = unary_union([Polygon(r.polygon).buffer(1) for r in rooms] + [Polygon(o.polygon).buffer(1) for o in shared])
        if geo.geom_type != "Polygon":
            geo = geo.buffer(200).buffer(-200)
        if geo.geom_type != "Polygon":
            plan.flags.append(Flag(code="merge_failed", message=f"Could not merge {', '.join(ids)}: not adjacent.",
                                   element_ids=ids))
            return
        geo = geo.simplify(5)
        keep.polygon = [(round(x, 1), round(y, 1)) for x, y in list(geo.exterior.coords)[:-1]]
        keep.area_m2 = round(sum(r.area_m2 for r in rooms), 2)
        for r in rooms:
            if r is keep:
                continue
            keep.wall_ids = sorted(set(keep.wall_ids + r.wall_ids))
            keep.opening_ids = sorted(set(keep.opening_ids + r.opening_ids))
            keep.drawing_labels += r.drawing_labels
            for x in f.fixtures:
                if x.room_id == r.id:
                    x.room_id = keep.id
            for w in f.walls:
                w.room_ids = sorted({keep.id if i == r.id else i for i in w.room_ids})
            for o in f.openings:
                o.room_ids = sorted({keep.id if i == r.id else i for i in o.room_ids})
            for s in f.stairs:
                if s.room_id == r.id:
                    s.room_id = keep.id
        # openings now fully inside the merged room become part of it
        for o in shared:
            o.kind = "opening"
            o.name = "Open passage"
        f.rooms = [r for r in f.rooms if r.id == keep.id or r.id not in ids]
        return


# ---- contractor answers -------------------------------------------------------------------------


def apply_answers(plan: Plan, answers: dict[str, str], ai: bool | None = None) -> Plan:
    """answers: question id -> the contractor's answer (an option or free text / voice transcript).
    Without the AI, the common answers (one room or two, a room's name) are applied by rules."""
    for q in plan.questions:
        if q.id in answers:
            q.answer = answers[q.id]
    answered = [q for q in plan.questions if q.answer]
    if not answered:
        return plan
    if ai is None:
        ai = bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
    if not ai:
        from .heuristics import apply_answers_rules
        return apply_answers_rules(plan, [q for q in answered if q.id in answers])
    content = [{"type": "text", "text": (
        "The contractor answered your questions about this plan. Apply the answers.\n\n"
        "Current rooms and items (JSON):\n" + json.dumps(dict(rooms=_room_summary(plan), items=_fixture_summary(plan)),
                                                         ensure_ascii=False) +
        "\n\nQuestions and answers:\n" + "\n".join(
            f"- {q.id} ({', '.join(q.element_ids)}): {q.text}\n  Answer: {q.answer}" for q in answered) +
        "\n\nReturn only what changes: rooms (with final name and type), items, openings and merge_rooms that "
        "the answers imply. Ask a follow-up question only if an answer is unclear or contradicts the drawing; "
        "otherwise return no questions. building_name, roof and notes may be left empty.")}]
    result, usage = call_claude(content, _output_schema())
    apply_result(plan, result, source="contractor")
    plan.stats.setdefault("answer_usage", []).append(usage)
    return plan
