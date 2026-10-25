"""Run with: pytest -q (from agent/). No API key needed: the AI step is mocked."""
import json
from pathlib import Path

import httpx2 as httpx
import pytest

from rorker_agent import interpret
from rorker_agent.evaluate import score
from rorker_agent.pipeline import run

CASE = Path(__file__).parent / "fixtures" / "house"
EXPECTED = json.loads((CASE / "expected.json").read_text())


@pytest.fixture(scope="module")
def rules_plan():
    plan, _ = run(str(CASE / "house.dxf"), ai=False)
    return plan


def test_floors_and_ids(rules_plan):
    assert [f.id for f in rules_plan.floors] == ["G", "1"]
    ids = [el_id for el_id in rules_plan.element_index()]
    assert len(ids) == len(set(ids)), "element IDs must be unique"
    assert all(i.startswith(("G-", "1-")) for i in ids)


def test_geometry_baseline(rules_plan):
    sc = score(rules_plan, EXPECTED)
    # the code alone must find nearly every room and name the labelled ones
    assert sc["rooms_found_pct"] >= 85, sc
    assert sc["rooms_named_pct"] >= 90, sc
    g = rules_plan.floors[0]
    assert sum(1 for o in g.openings if o.kind == "window") >= 5
    assert sum(1 for o in g.openings if o.kind in ("door", "double_door", "garage_door")) >= 8


def test_flags_find_known_problems(rules_plan):
    codes = {f.code for f in rules_plan.flags}
    assert {"room_split", "label_copied", "room_no_label"} <= codes
    assert 1 <= len(rules_plan.questions) <= 5


def test_ai_result_is_applied(rules_plan, monkeypatch):
    plan = rules_plan.model_copy(deep=True)
    up = plan.floors[1]
    split = next(f for f in plan.flags if f.code == "room_split" and f.element_ids[0].startswith("1-"))
    a, b = split.element_ids
    kitchen = next(r for r in plan.floors[0].rooms if r.type == "kitchen")
    unknown = next(x for x in plan.floors[0].fixtures if x.room_id == kitchen.id and x.kind == "other")
    canned = dict(building_name="House", roof="hip", notes="", openings=[],
                  rooms=[dict(id=a, name="Master bedroom", type="bedroom", confidence=0.9, reason="bed")],
                  fixtures=[dict(id=unknown.id, kind="base_cabinet", name="Base cabinet", confidence=0.9)],
                  merge_rooms=[[a, b]],
                  questions=[dict(text="Is this one bedroom?", element_ids=[a], options=["Yes", "No"], kind="room_split")])
    monkeypatch.setattr(interpret, "call_claude", lambda content, schema, system=None: (canned, dict(model="m", input_tokens=1, output_tokens=1, seconds=0)))
    out = interpret.interpret_cad_plan(plan)
    rooms = {r.id: r for r in out.floors[1].rooms}
    assert a in rooms and b not in rooms
    assert rooms[a].area_m2 > 25
    assert next(x for x in out.floors[0].fixtures if x.id == unknown.id).kind == "base_cabinet"
    assert out.questions[0].default == "Yes"


def _sse(result: dict) -> bytes:
    msg = {"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-opus-5-5", "content": [],
           "stop_reason": None, "stop_sequence": None, "usage": {"input_tokens": 10, "output_tokens": 1}}
    text = json.dumps(result)
    events = [
        ("message_start", {"type": "message_start", "message": msg}),
        ("content_block_start", {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}),
        ("content_block_delta", {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": text}}),
        ("content_block_stop", {"type": "content_block_stop", "index": 0}),
        ("message_delta", {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": None}, "usage": {"output_tokens": 20}}),
        ("message_stop", {"type": "message_stop"}),
    ]
    return "".join(f"event: {e}\ndata: {json.dumps(d)}\n\n" for e, d in events).encode()


def test_request_shape(monkeypatch):
    """The real SDK call path, against a fake server: checks model, thinking, structured output, fallbacks."""
    seen = {}

    def handler(request: httpx.Request):
        seen["body"] = json.loads(request.content)
        seen["beta"] = request.headers.get("anthropic-beta")
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=_sse({"ok": True}))

    monkeypatch.setattr(interpret, "_client_overrides", dict(api_key="test", http_client=httpx.Client(transport=httpx.MockTransport(handler))))
    out, usage = interpret.call_claude([{"type": "text", "text": "hi"}], {"type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"], "additionalProperties": False})
    assert out == {"ok": True}
    b = seen["body"]
    assert b["model"] == "claude-opus-5-5"
    assert b["thinking"] == {"type": "adaptive"}
    assert b["output_config"]["format"]["type"] == "json_schema"
    assert b["fallbacks"] == "default"
    assert "server-side-fallback-2026-07-01" in seen["beta"]
