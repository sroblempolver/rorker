"""Rule-based interpretation used when the AI is switched off (offline runs, tests, or as the
baseline the AI is measured against). Names rooms from their contents and turns flags into
questions."""
from __future__ import annotations

import re

from .build import room_from_text
from .schema import Plan, Question

BATH = {"toilet", "washbasin", "bathtub", "shower", "vanity"}
PRIORITY = ["room_split", "label_copied", "room_multi_label", "room_no_label", "room_unknown_label", "label_on_wall"]


def interpret_rules(plan: Plan) -> Plan:
    for f in plan.floors:
        stair_rooms = {s.room_id for s in f.stairs}
        for r in f.rooms:
            kinds = {x.kind for x in f.fixtures if x.room_id == r.id}
            guess = None
            if "bed" in kinds:
                guess = ("bedroom", "Bedroom")
            elif kinds & BATH:
                guess = ("wc", "WC") if r.area_m2 < 2.5 or "bathtub" not in kinds and "shower" not in kinds and r.area_m2 < 3 else ("bathroom", "Bathroom")
            elif "car" in kinds:
                guess = ("garage", "Garage")
            elif "washing_machine" in kinds:
                guess = ("laundry", "Laundry")
            elif r.id in stair_rooms and f.level > 0:
                guess = ("stair_hall", "Stair hall")
            elif r.area_m2 < 3 and not kinds:
                guess = ("closet", "Closet")
            elif r.area_m2 < 3:
                guess = ("hallway", "Hallway")
            labelled = [room_from_text(l) for l in r.drawing_labels]
            labelled = [m for m in labelled if m]
            if r.name == "Room" and guess:
                r.type, r.name = guess
                r.label_source = "contents"
                r.confidence = 0.6
            elif len({m[0] for m in labelled}) > 1 and guess:
                pick = next((m for m in labelled if m[0] == guess[0]), None)
                if pick:
                    r.type, r.name = pick
                    r.confidence = 0.7
            elif guess and guess[0] == "stair_hall" and r.type in ("foyer", "living"):
                r.type, r.name = guess
                r.label_source = "contents"
                r.confidence = 0.6
    plan.questions = questions_from_flags(plan)
    return plan


def questions_from_flags(plan: Plan, limit: int = 5) -> list[Question]:
    idx = plan.element_index()
    flags = [fl for fl in plan.flags if fl.severity == "ask"]
    flags.sort(key=lambda fl: PRIORITY.index(fl.code) if fl.code in PRIORITY else 99)
    out: list[Question] = []
    seen: set[str] = set()
    for fl in flags:
        if any(e in seen for e in fl.element_ids):
            continue
        seen.update(fl.element_ids)
        ids = fl.element_ids
        r = idx.get(ids[0]) if ids else None
        name = getattr(r, "name", "this room")
        if fl.code == "room_split" and len(ids) == 2:
            other = getattr(idx.get(ids[1]), "name", ids[1])
            both = f"the two {name.lower()} spaces" if other == name else f"the {name.lower()} and the {other.lower()}"
            q = Question(id="", kind="room_split", element_ids=ids,
                         text=f"Are {both} ({ids[0]}, {ids[1]}) one room or two?", options=["Two rooms", "One room"])
        elif fl.code in ("label_copied", "room_unknown_label", "room_multi_label", "room_no_label"):
            q = Question(id="", kind="room_name", element_ids=ids, text=f"What is room {ids[0]}? It looks like a {name.lower()}.",
                         options=[name, "Something else"])
        else:
            q = Question(id="", kind="label", element_ids=ids, text=fl.message, options=["OK", "Change it"])
        q.default = q.options[0]
        out.append(q)
        if len(out) >= limit:
            break
    for i, q in enumerate(out, 1):
        q.id = f"Q{i}"
    return out


def apply_answers_rules(plan: Plan, answered: list[Question]) -> Plan:
    """Apply contractor answers without the AI: merges for 'one room', names for room questions."""
    from .interpret import merge_rooms
    idx = plan.element_index()
    for q in answered:
        a = (q.answer or "").strip()
        low = a.lower()
        # free text works too: "it's all one open-plan room" merges, "two rooms" doesn't
        if q.kind == "room_split" and re.search(r"\b(one|single|same|open[- ]plan|merge)\b", low) and not re.search(r"\b(two|2|separate|split)\b", low):
            merge_rooms(plan, q.element_ids)
        elif q.kind == "room_name" and a and a.lower() != "something else":
            r = idx.get(q.element_ids[0])
            if r is None or not hasattr(r, "area_m2"):
                continue
            m = room_from_text(a)
            r.type, r.name = (m[0], a if m and m[1].lower() != a.lower() else m[1]) if m else ("other", a)
            r.label_source = "contractor"
            r.confidence = 1.0
    plan.flags = [fl for fl in plan.flags if not any(set(fl.element_ids) <= set(q.element_ids) for q in answered)]
    return plan
