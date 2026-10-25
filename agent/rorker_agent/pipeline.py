"""The plan-reading agent, end to end: intake -> extraction -> interpretation -> IDs -> questions.

    plan, report = run("house.dwg")                 # AI if a key is configured
    plan, report = run("house.dwg", ai=False)       # rules only (offline / baseline)
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from .schema import Plan

CAD_EXT = {".dxf", ".dwg"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".heic", ".gif", ".bmp", ".tif", ".tiff"}


def ai_available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def detect_kind(path: str) -> str:
    ext = Path(path).suffix.lower()
    with open(path, "rb") as fh:
        head = fh.read(16)
    if head.startswith(b"AC10") or ext == ".dwg":
        return "dwg"
    if head.startswith(b"%PDF") or ext == ".pdf":
        return "pdf"
    if ext == ".dxf" or head.lstrip().startswith(b"0\r\nSECTION") or head.lstrip().startswith(b"0\nSECTION"):
        return "dxf"
    if ext in IMAGE_EXT or head[:3] == b"\xff\xd8\xff" or head[:8] == b"\x89PNG\r\n\x1a\n":
        return "image"
    raise ValueError(f"Unsupported file type: {Path(path).name}. Send AutoCAD (DWG/DXF), PDF or a photo.")


def dwg_to_dxf(path: str, workdir: str) -> str:
    exe = shutil.which("dwg2dxf")
    if not exe:
        raise RuntimeError("DWG support needs LibreDWG's dwg2dxf on the server (see agent/Dockerfile).")
    out = os.path.join(workdir, Path(path).stem + ".dxf")
    subprocess.run([exe, "-y", "-o", out, path], check=True, capture_output=True, timeout=300)
    return out


def run(path: str, ai: bool | None = None, filename: str | None = None) -> tuple[Plan, dict]:
    from .build import build_plan
    from .cad import read_dxf
    from .heuristics import interpret_rules

    filename = filename or Path(path).name
    use_ai = ai_available() if ai is None else ai
    kind = detect_kind(path)
    timings: dict[str, float] = {}
    t0 = time.time()
    with tempfile.TemporaryDirectory() as tmp:
        if kind in ("dwg", "dxf"):
            dxf = dwg_to_dxf(path, tmp) if kind == "dwg" else path
            timings["convert_s"] = round(time.time() - t0, 2)
            raw = read_dxf(dxf)
            timings["extract_s"] = round(time.time() - t0 - timings["convert_s"], 2)
            plan = build_plan(raw, filename, kind)
            t1 = time.time()
            if use_ai:
                from .interpret import interpret_cad_plan
                plan = interpret_cad_plan(plan)
            else:
                plan = interpret_rules(plan)
            timings["interpret_s"] = round(time.time() - t1, 2)
        else:
            if not use_ai:
                raise RuntimeError("PDFs without CAD data, photos and sketches need the AI step (no API key set).")
            from .vision import read_image_plan
            plan = read_image_plan(path, filename, kind)
    timings["total_s"] = round(time.time() - t0, 2)
    plan.stats["timings"] = timings
    plan.stats["mode"] = "ai" if use_ai else "rules"
    report = dict(kind=kind, mode=plan.stats["mode"], timings=timings, stats=plan.stats)
    return plan, report
