"""Background worker (Railway): takes queued plan runs from Supabase, reads the drawing, stores the plan.

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, optional WORKER_POLL_SECONDS.
"""
from __future__ import annotations

import os
import socket
import tempfile
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

from .schema import Plan


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _client():
    from supabase import create_client
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def process(sb, run: dict):
    from .interpret import apply_answers
    from .pipeline import run as read_plan

    job_id = run["job_id"]
    if run["kind"] == "read":
        with tempfile.TemporaryDirectory() as tmp:
            local = Path(tmp) / (run.get("file_name") or "upload")
            local.write_bytes(sb.storage.from_("plan-files").download(run["file_path"]))
            plan, report = read_plan(str(local), filename=run.get("file_name"))
    elif run["kind"] == "answers":
        base = sb.table("plans").select("data").eq("id", run["input"]["plan_id"]).single().execute().data
        plan = Plan.model_validate(base["data"])
        plan = apply_answers(plan, run["input"]["answers"])
        report = dict(mode="ai", stats=plan.stats)
    else:
        raise ValueError(f"unknown run kind {run['kind']}")

    last = sb.table("plans").select("version").eq("job_id", job_id).order("version", desc=True).limit(1).execute().data
    version = (last[0]["version"] + 1) if last else 1
    row = sb.table("plans").insert(dict(job_id=job_id, company_id=run["company_id"], version=version,
                                        data=plan.model_dump(mode="json"), run_id=run["id"])).execute().data[0]
    sb.table("jobs").update(dict(current_plan_id=row["id"])).eq("id", job_id).execute()
    open_q = [q for q in plan.questions if not q.answer]
    sb.table("plan_runs").update(dict(
        status="needs_answers" if open_q else "done", plan_id=row["id"], finished_at=_now(),
        metrics=dict(stats=plan.stats, questions=len(open_q)))).eq("id", run["id"]).execute()


def main():
    sb = _client()
    me = f"{socket.gethostname()}:{os.getpid()}"
    poll = float(os.environ.get("WORKER_POLL_SECONDS", "3"))
    print(f"plan worker {me} started", flush=True)
    while True:
        try:
            claimed = sb.rpc("claim_plan_run", {"worker": me}).execute().data
        except Exception as e:
            print("claim failed:", e, flush=True)
            time.sleep(poll * 3)
            continue
        run = claimed[0] if isinstance(claimed, list) and claimed else (claimed if isinstance(claimed, dict) and claimed.get("id") else None)
        if not run:
            time.sleep(poll)
            continue
        print(f"run {run['id']} ({run['kind']}) for job {run['job_id']}", flush=True)
        try:
            process(sb, run)
        except Exception as e:
            traceback.print_exc()
            sb.table("plan_runs").update(dict(status="failed", error=str(e)[:2000], finished_at=_now())).eq(
                "id", run["id"]).execute()


if __name__ == "__main__":
    main()
