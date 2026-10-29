"""House rules: the code-normal sizes a house is built to, used wherever the drawing doesn't say.
Mirror of web/src/lib/plan/rules.ts (the 3D builds from the same numbers). US residential sizes in
whole inches, stored as millimetres."""
from __future__ import annotations

IN = 25.4

RULES = dict(
    storey=121 * IN, ceiling=108 * IN, slab=8 * IN, wall_exterior=7 * IN, wall_interior=4.5 * IN,
    sill=36 * IN, sill_wet=48 * IN, sill_kitchen=42 * IN, head=80 * IN,
    door_head=80 * IN, garage_head=84 * IN, opening_head=84 * IN,
    pitch=26.6, low_pitch=18.4, eave=18 * IN, fascia=8 * IN,
    plinth=18 * IN, step=7.5 * IN, tread=11 * IN, railing=36 * IN, walk=48 * IN,
)

WET = {"bathroom", "wc", "laundry"}


def ftin(mm: float) -> str:
    """A length the way the contractor reads it: 13' 9½" (nearest half inch)."""
    halves = round(mm / IN * 2)
    ft, inch = divmod(halves, 24)
    whole, half = divmod(inch, 2)
    return f"{ft}' {whole}{'½' if half else ''}\""


def ft2(m2: float) -> str:
    """An area in square feet: 120 ft²."""
    return f"{round(m2 * 10.7639)} ft²"


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
