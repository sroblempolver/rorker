# Rorker

A job platform for contractors. Upload the AutoCAD file, a PDF or a photo of the plan, and it becomes a
clickable, numbered 2D plan of the building. Every room, wall, door, window and fixture gets an ID that
pins, tasks, status and (later) quotes and client updates hang off.

This repo is Phase 1: contractor accounts and company setup, jobs and the all-jobs view, the plan reader,
the game-style job map (whole site → outside → floor → room → wall, with things on each wall drawn from the front), pins and quick notes anywhere on it, the team (owner and admins, employees as editors) with staff
tagging on pins, and per-job stages from company templates.

```
agent/      Python plan reader: DWG/DXF/PDF/photo -> structured plan JSON, plus the test runner and worker
web/        Next.js app (App Router, React 19, Tailwind 4, Supabase)
supabase/   Database schema, security rules and storage buckets (one migration)
```

## How it fits together

```
upload ─▶ web inserts a plan_run (queued) + stores the file
                         │
               agent worker claims it ─▶ DWG→DXF (LibreDWG) ─▶ geometry (ezdxf, shapely)
                         │                ─▶ plan reader (Claude, structured output) ─▶ IDs + ≤5 questions
                         ▼
            new plans row (versioned) ─▶ web shows it; answers go back as another run
```

The plan is data first. IDs look like `G-R04` (ground floor, room 4), `1-W12` (level 1, wall 12):
`R` rooms, `W` walls, `D` doors, `WN` windows, `OP` openings, `F` fixtures, `S` stairs.
Coordinates are millimetres with y pointing down.

## Run it locally (demo mode)

Demo mode needs no accounts: data lives in `web/.data/`, and plan reading runs the local agent.

```bash
# plan reader
cd agent && pip install -e . && cd ..
# for .dwg files you also need LibreDWG's dwg2dxf on PATH (see agent/Dockerfile)

# web
cd web && npm install && npm run dev      # http://localhost:3000, click "Open the demo"
```

The demo signs you in to "Demo Builders" with the house.dwg job already read. Signing up instead gives
an empty company so onboarding can be tried. To see the employee view, sign in as
`marco@demobuilders.test` after opening the demo once: he is on the demo team as an employee.

Set `ANTHROPIC_API_KEY` to turn on the full plan reader. Without it, AutoCAD files are read from their
geometry alone (rooms, walls, doors, windows and named blocks), answers are applied by rules, and PDFs
and photos wait for the key.

## Test the plan reader

Each test case is a folder under `agent/tests/fixtures/<case>/` with the input files and an
`expected.json` (the reviewed rooms and fixtures).

```bash
cd agent
python3 -m pytest -q tests                         # fast checks, no API calls
python3 -m rorker_agent test --no-ai               # geometry + rules baseline on every case
python3 -m rorker_agent test house --log /mnt/project-files/rorker-ai-accuracy.md --note "first AI run"
python3 -m rorker_agent read some-plan.pdf --out out/   # one file -> plan.json, preview.png, report.md
python3 -m rorker_agent answer out/plan.json Q1="One room" Q3="Pantry"
```

`test` writes `tests/results/<time>/<case>-<ext>/` (plan, preview image, report, score) and, with
`--log`, appends one row per input to the "Agent test runs" table: rooms found, rooms named right,
fixtures found, questions asked, unidentified items, cost and time. To add a case, drop the drawing and
an `expected.json` in a new folder; `house/expected.json` shows the format.

## Deploy (Railway + Supabase)

Everything is new for this project: a new GitHub repo, Supabase project, Railway project and API key.

1. **Supabase**: create the project, then run `supabase/migrations/20261025000001_init.sql`
   (SQL editor or `supabase db push`). It creates the tables, row-level security, the
   `plan-files`, `company-assets` and `pin-photos` buckets and the default stage templates.
2. **Railway, web service**: root directory `web`. Variables: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. **Railway, agent service**: root directory `agent` (builds `agent/Dockerfile`, runs the worker).
   Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.

Keys go in the Railway and Supabase settings only. The Supabase code path is written against the
schema but has not run against a live project yet; expect a short shakedown when it exists.

## Preview build

`npm run preview` in `web/` builds the same screens into one HTML file on the sample house, with data
in memory. It is what the shared preview link shows until the Railway site is up.
