"""The self-check: house rules, lining floors up, building questions with a spot for the dot, and the
AI's second look (mocked)."""
from pathlib import Path

import pytest

from rorker_agent import interpret, selfcheck
from rorker_agent.pipeline import run
from rorker_agent.rules import opening_span

CASE = Path(__file__).parent / "fixtures" / "house"


@pytest.fixture(scope="module")
def plan():
    p, _ = run(str(CASE / "house.dxf"), ai=False)
    return p


def _edges(f):
    pts = [p for r in f.rooms for p in r.polygon]
    return min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts)


def test_floors_line_up(plan):
    g, up = plan.floors
    # the drawing has level 1 a few cm off the ground floor; the self-check moved it back
    assert abs(_edges(g)[1] - _edges(up)[1]) < 5
    assert any("line up" in f for f in plan.stats["self_check"]["fixes"])


def test_small_offsets_only(plan):
    p = plan.model_copy(deep=True)
    selfcheck.translate_floor(p.floors[1], 0, 900)
    assert selfcheck.align_floors(p) == []  # a 90 cm step is design, not a drawing error


def test_roof_question_has_a_spot_and_applies(plan):
    p = plan.model_copy(deep=True)
    q = next(q for q in p.questions if "roof" in q.element_ids)
    assert q.point and q.point.outside and q.point.floor_id == "1"
    assert q.default == "Hip" and len(p.questions) <= selfcheck.MAX_QUESTIONS
    interpret.apply_answers(p, {q.id: "Gable"}, ai=False)
    assert p.building.exterior.roof == "gable"
    # free words work too
    p.building.exterior.roof = "unknown"
    q.answer = None
    interpret.apply_answers(p, {q.id: "it's flat, a deck on top"}, ai=False)
    assert p.building.exterior.roof == "flat"


def test_garage_without_a_door_is_asked_about(plan):
    p = plan.model_copy(deep=True)
    g = p.floors[0]
    garage = next(r for r in g.rooms if r.type == "garage")
    g.openings = [o for o in g.openings if not (garage.id in o.room_ids and o.exterior)]
    qs = selfcheck.rule_questions(p)
    assert any(garage.id in q.element_ids for q in qs)


def test_rule_heights():
    inch = lambda mm: round(mm / 25.4, 3)
    assert tuple(map(inch, opening_span("window", ["bathroom"]))) == (48, 80)
    assert tuple(map(inch, opening_span("window", ["bedroom"]))) == (36, 80)
    assert tuple(map(inch, opening_span("garage_door", ["garage"]))) == (0, 84)


def test_feet_and_inches():
    from rorker_agent.rules import ft2, ftin
    assert ftin(4191) == "13' 9\"" and ftin(2032) == "6' 8\"" and ftin(4203.7) == "13' 9½\""
    assert ft2(12.5) == "135 ft²"


def test_elevations_render(plan):
    png = selfcheck.render_elevations(plan)
    assert png[:8] == b"\x89PNG\r\n\x1a\n" and len(png) > 20000


def test_ai_second_look_is_applied(plan, monkeypatch):
    p = plan.model_copy(deep=True)
    win = next(o for o in p.floors[0].openings if o.kind == "window")
    canned = dict(notes="Hip lines on the roof plan.",
                  fixes=[dict(op="set_roof", id="", value="hip", why="roof plan shows hips"),
                         dict(op="set_opening_kind", id=win.id, value="sliding_door", why="drawn full height"),
                         dict(op="set_storey_height", id="", value="99999", why="nonsense is ignored")],
                  questions=[dict(text="Is the back porch covered?", options=["Yes", "No"], element_ids=["G-W02"])])
    seen = {}

    def fake(content, schema, system=None):
        seen["images"] = sum(1 for c in content if c["type"] == "image")
        return canned, dict(model="m", input_tokens=1, output_tokens=1, seconds=0)

    monkeypatch.setattr(interpret, "call_claude", fake)
    selfcheck.self_check(p, ai=True)
    assert seen["images"] == 2  # the drawing and the elevations
    assert p.building.exterior.roof == "hip"
    assert next(o for o in p.floors[0].openings if o.id == win.id).kind == "sliding_door"
    assert p.building.exterior.storey_height_mm == 3000
    asked = next(q for q in p.questions if q.text == "Is the back porch covered?")
    assert asked.point and asked.point.floor_id == "G"
    # the roof is settled, so the roof question goes
    assert not any("roof" in q.element_ids and not q.answer for q in p.questions)
