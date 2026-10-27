"""House rules: the code-normal sizes a house is built to, used wherever the drawing doesn't say.
Mirror of web/src/lib/plan/rules.ts (the 3D builds from the same numbers). Millimetres."""
from __future__ import annotations

RULES = dict(
    storey=3000, ceiling=2700, slab=200, wall_exterior=300, wall_interior=120,
    sill=900, sill_wet=1200, sill_kitchen=1050, head=2100,
    door_head=2100, garage_head=2300, opening_head=2400,
    pitch=26.6, low_pitch=18.4, eave=450, fascia=200,
    plinth=450, step=225, tread=300, railing=1000, walk=1200,
)

WET = {"bathroom", "wc", "laundry"}


def opening_span(kind: str, room_types: list[str]) -> tuple[float, float]:
    """Bottom and top of a door or window above its floor."""
    if kind == "window":
        sill = RULES["sill_wet"] if WET & set(room_types) else RULES["sill_kitchen"] if "kitchen" in room_types else RULES["sill"]
        return sill, RULES["head"]
    if kind == "garage_door":
        return 0, RULES["garage_head"]
    if kind == "opening":
        return 0, RULES["opening_head"]
    return 0, RULES["door_head"]
