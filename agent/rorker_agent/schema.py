"""The structured plan: the single source of truth for a building.

The 2D view in the web app is only a rendering of this data. Every element has a short,
stable, human-readable ID (G-R03, 1-W12, G-D04...) that tasks, photos, voice and fixes
reference. Coordinates are millimetres, x to the right, y DOWN (screen convention), with
the origin at the top-left of the building's overall bounds. All floors share one frame,
so a point on the ground floor sits under the same point on Level 1.

Keep this file in sync with web/src/lib/plan/types.ts.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

SCHEMA_VERSION = 1

Point = tuple[float, float]
BBox = tuple[float, float, float, float]  # x0, y0, x1, y1

RoomType = Literal[
    "kitchen", "bathroom", "wc", "bedroom", "living", "dining", "family", "study", "office",
    "hallway", "foyer", "stair_hall", "laundry", "utility", "closet", "garage", "storage",
    "balcony", "porch", "terrace", "other",
]

OpeningKind = Literal["door", "double_door", "sliding_door", "garage_door", "window", "opening"]

FixtureKind = Literal[
    # kitchen
    "base_cabinet", "wall_cabinet", "tall_cabinet", "island", "kitchen_sink", "cooktop", "range",
    "oven", "fridge", "dishwasher",
    # bath
    "toilet", "washbasin", "vanity", "bathtub", "shower", "towel_radiator",
    # utility
    "washing_machine", "dryer", "water_heater", "hvac_unit", "fireplace",
    # furniture
    "bed", "nightstand", "wardrobe", "sofa", "armchair", "chair", "dining_table", "table",
    "desk", "bookshelf", "sideboard", "tv", "lamp", "plant", "car",
    "other",
]

Source = Literal["drawing", "shape", "contents", "ai", "vision", "contractor"]


class DoorLeaf(BaseModel):
    hinge: Point
    radius: float
    start_angle: float  # degrees, y-down frame, swing arc drawn from start to end
    end_angle: float


class Room(BaseModel):
    id: str
    name: str
    type: RoomType = "other"
    polygon: list[Point]
    area_m2: float
    label_source: Source = "drawing"
    confidence: float = 1.0
    outdoor: bool = False
    wall_ids: list[str] = Field(default_factory=list)
    opening_ids: list[str] = Field(default_factory=list)
    drawing_labels: list[str] = Field(default_factory=list)  # raw text found in the drawing
    drawing_area_m2: Optional[float] = None  # area figure written in the drawing, if any
    notes: Optional[str] = None


class Wall(BaseModel):
    id: str
    polygon: list[Point]
    length_mm: float
    thickness_mm: float
    exterior: bool = False
    room_ids: list[str] = Field(default_factory=list)


class Opening(BaseModel):
    id: str
    kind: OpeningKind
    name: str
    a: Point  # centre line of the gap, along the wall
    b: Point
    width_mm: float
    thickness_mm: float
    exterior: bool = False
    polygon: list[Point]
    room_ids: list[str] = Field(default_factory=list)
    leaves: list[DoorLeaf] = Field(default_factory=list)
    confidence: float = 1.0


class Fixture(BaseModel):
    id: str
    kind: FixtureKind
    name: str
    room_id: Optional[str] = None
    center: Point
    bbox: BBox
    rotation: float = 0.0
    outline: list[list[Point]] = Field(default_factory=list)  # simplified linework for drawing
    source: Source = "drawing"
    source_ref: Optional[str] = None  # block name or candidate id
    confidence: float = 1.0


class Stair(BaseModel):
    id: str
    polygon: list[Point]
    room_id: Optional[str] = None
    outline: list[list[Point]] = Field(default_factory=list)


class Floor(BaseModel):
    id: str  # floor code used as ID prefix: G, 1, 2, B
    name: str
    level: int
    elevation_mm: float = 0
    height_mm: float = 3000
    footprint: list[list[Point]] = Field(default_factory=list)
    bounds: BBox
    rooms: list[Room] = Field(default_factory=list)
    walls: list[Wall] = Field(default_factory=list)
    openings: list[Opening] = Field(default_factory=list)
    fixtures: list[Fixture] = Field(default_factory=list)
    stairs: list[Stair] = Field(default_factory=list)


class Question(BaseModel):
    id: str
    text: str
    element_ids: list[str] = Field(default_factory=list)
    options: list[str] = Field(default_factory=list)
    default: Optional[str] = None  # what the plan currently assumes
    kind: Literal["room_name", "room_split", "fixture", "label", "exterior", "scale", "other"] = "other"
    answer: Optional[str] = None


class Flag(BaseModel):
    """Something the code noticed that may need a question. Internal, kept for testing."""
    code: str
    message: str
    element_ids: list[str] = Field(default_factory=list)
    severity: Literal["info", "warn", "ask"] = "warn"


class Exterior(BaseModel):
    estimated: bool = True
    storey_height_mm: float = 3000
    roof: Literal["gable", "hip", "flat", "unknown"] = "unknown"
    notes: Optional[str] = None


class SourceInfo(BaseModel):
    kind: Literal["dxf", "dwg", "pdf", "image"]
    filename: str
    pipeline_version: str
    model: Optional[str] = None
    ai_used: bool = False


class Building(BaseModel):
    name: str = "Building"
    size_mm: tuple[float, float] = (0, 0)
    exterior: Exterior = Field(default_factory=Exterior)


class Plan(BaseModel):
    schema_version: int = SCHEMA_VERSION
    units: Literal["mm"] = "mm"
    building: Building = Field(default_factory=Building)
    floors: list[Floor] = Field(default_factory=list)
    questions: list[Question] = Field(default_factory=list)
    flags: list[Flag] = Field(default_factory=list)
    source: SourceInfo
    stats: dict = Field(default_factory=dict)

    def element_index(self) -> dict[str, object]:
        out: dict[str, object] = {}
        for f in self.floors:
            for coll in (f.rooms, f.walls, f.openings, f.fixtures, f.stairs):
                for el in coll:
                    out[el.id] = el
        return out
