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
and photos wait for the key. The same key turns on the Rorker assistant (the "Ask" button: chat and
one-tap voice across every job). It runs on the server with the signed-in person's own access, so it can
change things for them but never shows what they couldn't see; `RORKER_ASSISTANT_MODEL` overrides the
model. Voice uses the browser's own speech (Chrome, Edge, Safari).

Admins can share a job from its header: a no-sign-in link at `/s/<token>` that shows the plan and only
the tasks tagged to that person (or picked for a one-time sub). Links can expire and be turned off.

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

## Plan tests (the reader's scorecard) and drawing by hand

The New project reader is measured on real plans in the preview's **Plan tests** page (`#/bench`).
Each test plan is exactly what an upload sends the reader (`parts`, made by `lib/intake/files.ts`) plus
the right answer, drawn with the same sketch editor contractors use (`components/newjob/SketchEditor.tsx`).
**Run all** reads every plan with the live reader (questions skipped) and `lib/bench/score.ts` scores it
out of 100: floors, homes, rooms found by overlap after lining the floors up, rooms named right, scale,
doors, windows (room and side) and the main fixtures. Plans added in the page live in that browser
(IndexedDB); "Save all to a file" exports them. Shared test plans are `web/bench/cases/<id>/case.json`,
listed in `web/bench/cases/index.json`, and are copied beside the preview page by `preview/build.mjs`.

When a read is wrong, New project's review has **Fix it by drawing** (and the start screen **Draw it
myself**): rooms dragged out over the uploaded drawing, split, reshaped by corner or wall, doors, windows,
things, scale from one known length, and "Line up" to sit the picture under the rooms.

Inside a job, **Build** (the button over Pin on the map, or `B`) changes the house where it stands: put a
door or window in a wall, slide or resize one (US standard sizes in `web/src/lib/plan/standard.ts`), move
a wall (the room next door follows), or split a room. Changes are edits on top of the drawing
(`web/src/lib/plan/house.ts`), so Undo and "Put back as drawn" work and pins keep their ids. The plan's
questions, a new drawing and talking to the plan live there too (they used to be the Plan tab).

## Deploy (Railway + Supabase)

Everything is new for this project: a new GitHub repo, Supabase project, Railway project and API key.

1. **Supabase**: create the project, then run the files in `supabase/migrations/` in order
   (SQL editor or `supabase db push`). It creates the tables, row-level security, the
   `plan-files`, `company-assets` and `pin-photos` buckets and the default stage templates.
2. **Railway, web service**: root directory `web`. Variables: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (the assistant).
3. **Railway, agent service**: root directory `agent` (builds `agent/Dockerfile`, runs the worker).
   Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.

Keys go in the Railway and Supabase settings only. The Supabase code path is written against the
schema but has not run against a live project yet; expect a short shakedown when it exists.

## The build site: real accounts (build.rorker.com)

The build site is the preview page with real accounts on the Supabase project "rorker". A contractor
makes an account on the page (the `build` function signs them up, no email to confirm) and gets the
sample jobs to start from; every change is saved a moment later and loads on any device.

- **Tables** (`supabase/build/`): `accounts`, `account_users` (who signs in, as which team member) and
  `records`, one row per thing (job, plan, pin, stage, wall item, material, team member, share link,
  the job's money, pin threads) with the thing as JSON. Only the account's admins can read or write
  them (row-level security). Photos go in the private `build-files` bucket.
- **Links** (`supabase/functions/build`): crew and clients don't sign in and never read the tables.
  The function opens the link and hands back only what it may show. Crew (`#/s/<token>`): the plan and
  their tasks, never money or client details; an employee also sees the crew's other open tasks, a sub
  only their own; they can send photos and mark their own tasks done. Client (`#/c/<token>`): the job's
  stages and their quotes, invoices and receipts, never crew or costs; they can sign and pay, and the
  function refuses any other change (`web/src/lib/billing/clientGuard.ts`).
- The link rules are the page's own code, copied into the function by `node preview/build-links.mjs`
  (run it after changing `src/lib/share.ts`, `src/lib/cloud/` or the client guard, then redeploy).
- "Look around on sample data" on the sign-in screen runs the old in-memory preview.
- **Credits and plans** (`#/credits`): homeowners pay only in credits; businesses have a monthly tier with
  credits and limits on plans, floors and square feet. Every number is a placeholder in
  `web/src/lib/credits/config.ts`. No payment provider yet; see `docs/credits-and-stripe.md`.

## Preview build

`npm run preview` in `web/` builds the same screens into one HTML file on the sample house, with data
in memory. It is what the shared preview link shows until the Railway site is up.
