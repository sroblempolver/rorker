"""Command line for the plan-reading agent.

  python -m rorker_agent read FILE [--out DIR] [--no-ai]
  python -m rorker_agent test [CASE ...] [--no-ai] [--log FILE] [--note TEXT]
  python -m rorker_agent answer PLAN.json Q1="One room" Q2="Kitchen" [--out PLAN.json]
  python -m rorker_agent worker            # process uploads queued in Supabase
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
CASES = HERE / "tests" / "fixtures"
RESULTS = HERE / "tests" / "results"
INPUT_EXT = [".dwg", ".dxf", ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".heic"]


def write_outputs(plan, report, out: Path, scorecard: dict | None = None):
    from .render import render_plan_sheet
    out.mkdir(parents=True, exist_ok=True)
    (out / "plan.json").write_text(plan.model_dump_json(indent=1))
    (out / "preview.png").write_bytes(render_plan_sheet(plan))
    lines = [f"# {plan.source.filename}", "", f"- Mode: {report['mode']}", f"- Timings: {report['timings']}",
             f"- Model: {plan.source.model or 'none'}", ""]
    for f in plan.floors:
        lines += [f"## {f.name} ({f.id})", "", "| ID | Room | Type | m² | From | Confidence |", "|---|---|---|---|---|---|"]
        lines += [f"| {r.id} | {r.name} | {r.type} | {r.area_m2} | {r.label_source} | {r.confidence:.2f} |" for r in f.rooms]
        lines += [""]
        items = [f"{x.id} {x.name}" for x in f.fixtures if x.kind not in ("lamp", "plant", "chair")]
        lines += ["Items: " + ", ".join(items), ""]
    lines += ["## Questions", ""] + [f"- **{q.id}** {q.text} ({' / '.join(q.options)}) [{', '.join(q.element_ids)}]"
                                     for q in plan.questions] + [""]
    lines += ["## Flags", ""] + [f"- `{fl.code}` {fl.message}" for fl in plan.flags] + [""]
    if scorecard:
        lines += ["## Score", "", "```", json.dumps(scorecard, indent=1, ensure_ascii=False), "```"]
    (out / "report.md").write_text("\n".join(lines))


def cmd_read(a):
    from .pipeline import run
    plan, report = run(a.file, ai=False if a.no_ai else None)
    out = Path(a.out or Path(a.file).with_suffix("").name + "-plan")
    write_outputs(plan, report, out)
    print(json.dumps(dict(out=str(out), stats=plan.stats.get(next(iter(plan.stats), ""), {}),
                          questions=[q.text for q in plan.questions]), indent=1, ensure_ascii=False))


def _inputs(case_dir: Path) -> list[Path]:
    files = [p for p in sorted(case_dir.iterdir()) if p.suffix.lower() in INPUT_EXT]
    have_dwg = shutil.which("dwg2dxf") is not None
    if any(p.suffix.lower() == ".dwg" for p in files):
        files = [p for p in files if p.suffix.lower() != (".dxf" if have_dwg else ".dwg")]
    return files


def cmd_test(a):
    from .evaluate import score
    from .pipeline import ai_available, run
    cases = a.cases or sorted(p.name for p in CASES.iterdir() if (p / "expected.json").exists())
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    use_ai = False if a.no_ai else ai_available()
    rows = []
    for case in cases:
        cdir = CASES / case
        expected = json.loads((cdir / "expected.json").read_text())
        for inp in _inputs(cdir):
            if inp.suffix.lower() not in (".dwg", ".dxf") and not use_ai:
                print(f"skip {case}/{inp.name}: needs the AI step")
                continue
            print(f"running {case}/{inp.name} ({'ai' if use_ai else 'rules'}) ...", flush=True)
            try:
                plan, report = run(str(inp), ai=use_ai)
            except Exception as e:  # keep going so one bad file does not hide the rest
                print(f"  FAILED: {e}")
                rows.append(dict(case=case, input=inp.name, mode="ai" if use_ai else "rules", error=str(e)))
                continue
            sc = score(plan, expected)
            out = RESULTS / stamp / f"{case}-{inp.suffix.lstrip('.')}"
            write_outputs(plan, report, out, sc)
            (out / "score.json").write_text(json.dumps(sc, indent=1, ensure_ascii=False))
            print(f"  rooms {sc['rooms_found']} found, {sc['rooms_named']} named right; fixtures "
                  f"{sc['fixtures_found']}; {sc['questions']} questions; {sc['unidentified_items']} unidentified; "
                  f"${sc['cost_usd']}; {sc['seconds']} s -> {out}")
            rows.append(dict(case=case, input=inp.name, mode=report["mode"], out=str(out), **sc))
    (RESULTS / stamp).mkdir(parents=True, exist_ok=True)
    (RESULTS / stamp / "summary.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False))
    log = a.log or os.environ.get("RORKER_ACCURACY_LOG")
    if log:
        append_log(Path(log), rows, a.note or "", stamp)
        print(f"logged {len(rows)} row(s) to {log}")


LOG_HEADER = ("## Agent test runs\n\nOne row per input file per run of `python -m rorker_agent test`. "
              "Rooms found = rooms whose size matches the reviewed answer; named right = of those, correct type; "
              "fixtures = expected kitchen, bath and key furniture items found in the right room.\n\n"
              "| Run | Case | Input | Mode | Rooms found | Named right | Fixtures | Questions | Unidentified | Cost | Time | Notes |\n"
              "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n")


def append_log(path: Path, rows: list[dict], note: str, stamp: str):
    text = path.read_text() if path.exists() else "# AI accuracy\n\n"
    if "## Agent test runs" not in text:
        text = text.rstrip() + "\n\n" + LOG_HEADER
    lines = []
    for r in rows:
        if "error" in r:
            lines.append(f"| {stamp} | {r['case']} | {r['input']} | {r['mode']} | failed | | | | | | | {r['error'][:120]} |")
            continue
        lines.append(f"| {stamp} | {r['case']} | {r['input']} | {r['mode']} | {r['rooms_found']} | {r['rooms_named']} | "
                     f"{r['fixtures_found']} | {r['questions']} | {r['unidentified_items']} | ${r['cost_usd']} | "
                     f"{r['seconds']} s | {note} |")
    # insert after the table header of that section
    head, _, tail = text.partition("## Agent test runs")
    sec_lines = tail.split("\n")
    # find the end of the table
    last = max(i for i, l in enumerate(sec_lines) if l.startswith("|")) if any(l.startswith("|") for l in sec_lines) else len(sec_lines) - 1
    sec_lines[last + 1:last + 1] = lines
    path.write_text(head + "## Agent test runs" + "\n".join(sec_lines))


def cmd_answer(a):
    from .interpret import apply_answers
    from .schema import Plan
    plan = Plan.model_validate_json(Path(a.plan).read_text())
    answers = dict(kv.split("=", 1) for kv in a.answers)
    plan = apply_answers(plan, answers)
    Path(a.out or a.plan).write_text(plan.model_dump_json(indent=1))
    print("\n".join(f"{q.id}: {q.text} -> {q.answer}" for q in plan.questions))


def main(argv=None):
    p = argparse.ArgumentParser(prog="rorker_agent")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("read")
    r.add_argument("file")
    r.add_argument("--out")
    r.add_argument("--no-ai", action="store_true")
    t = sub.add_parser("test")
    t.add_argument("cases", nargs="*")
    t.add_argument("--no-ai", action="store_true")
    t.add_argument("--log", help="Markdown file to append results to (e.g. rorker-ai-accuracy.md)")
    t.add_argument("--note", default="")
    an = sub.add_parser("answer")
    an.add_argument("plan")
    an.add_argument("answers", nargs="+")
    an.add_argument("--out")
    sub.add_parser("worker")
    a = p.parse_args(argv)
    if a.cmd == "read":
        cmd_read(a)
    elif a.cmd == "test":
        cmd_test(a)
    elif a.cmd == "answer":
        cmd_answer(a)
    elif a.cmd == "worker":
        from .worker import main as wmain
        wmain()


if __name__ == "__main__":
    sys.exit(main())
