"""Score a plan against a hand-checked expected result, so every test run gives comparable numbers.

expected.json:
  {"name": "house", "floors": [{"name": "Ground floor", "rooms": [
      {"name": "Kitchen", "type": "kitchen", "area_m2": 8.8, "fixtures": ["base_cabinet", "cooktop"]}, ...]}]}
"""
from __future__ import annotations

from .schema import Plan

# Claude Opus 5.5 list prices, USD per million tokens
PRICE_IN, PRICE_OUT = 4.0, 20.0


def _area_ok(a: float, b: float) -> bool:
    return abs(a - b) <= max(0.6, 0.2 * b)


def score(plan: Plan, expected: dict) -> dict:
    rooms_expected = rooms_found = rooms_named = 0
    fx_expected = fx_found = 0
    misses: list[str] = []
    wrong_names: list[str] = []
    missing_fixtures: list[str] = []
    for fi, ef in enumerate(expected["floors"]):
        floor = next((f for f in plan.floors if f.name.lower() == ef["name"].lower()), None)
        if floor is None and fi < len(plan.floors):
            floor = sorted(plan.floors, key=lambda f: f.level)[fi]
        available = list(floor.rooms) if floor else []
        # match the most specific rooms first: same type and close area, then area alone
        pending = list(ef["rooms"])
        matches = []
        for strict in (True, False):
            rest = []
            for er in pending:
                cands = [r for r in available if _area_ok(r.area_m2, er["area_m2"]) and (not strict or r.type == er["type"])]
                if cands:
                    best = min(cands, key=lambda r: abs(r.area_m2 - er["area_m2"]))
                    available.remove(best)
                    matches.append((er, best))
                else:
                    rest.append(er)
            pending = rest
        for er in pending:
            rooms_expected += 1
            fx_expected += len(er.get("fixtures", []))
            misses.append(f'{ef["name"]}: {er["name"]} ({er["area_m2"]} m²)')
            missing_fixtures += [f'{er["name"]}: {k}' for k in er.get("fixtures", [])]
        for er, r in matches:
            rooms_expected += 1
            rooms_found += 1
            if r.type == er["type"]:
                rooms_named += 1
            else:
                wrong_names.append(f'{r.id} is "{r.name}" ({r.type}), expected {er["name"]} ({er["type"]})')
            kinds = {x.kind for x in floor.fixtures if x.room_id == r.id}
            for k in er.get("fixtures", []):
                fx_expected += 1
                if k in kinds:
                    fx_found += 1
                else:
                    missing_fixtures.append(f"{r.id} {er['name']}: {k}")
    unidentified = sum(1 for f in plan.floors for x in f.fixtures if x.kind == "other")
    usage = plan.stats.get("ai_usage") or {}
    cost = (usage.get("input_tokens", 0) * PRICE_IN + usage.get("output_tokens", 0) * PRICE_OUT) / 1e6
    pct = lambda a, b: round(100 * a / b) if b else 100
    return dict(
        rooms_found=f"{rooms_found}/{rooms_expected}", rooms_found_pct=pct(rooms_found, rooms_expected),
        rooms_named=f"{rooms_named}/{rooms_found}", rooms_named_pct=pct(rooms_named, rooms_found),
        fixtures_found=f"{fx_found}/{fx_expected}", fixtures_found_pct=pct(fx_found, fx_expected),
        questions=len(plan.questions), unidentified_items=unidentified,
        cost_usd=round(cost, 3), seconds=plan.stats.get("timings", {}).get("total_s"),
        missed_rooms=misses, wrong_names=wrong_names, missing_fixtures=missing_fixtures,
    )
