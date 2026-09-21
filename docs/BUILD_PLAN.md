# Build plan — MVP

Four phases. Each has an owner agent, a definition of done, and a check anyone can run.
Do not start a phase before its dependency is done.

## Phase 0 — Foundation (done)

- OrbStack running, `supabase start` working, `.env.local` filled.
- Next.js 16 app scaffolded, design tokens in `app/globals.css`, fonts in `app/layout.tsx`.
- `proxy.ts` refreshes the session and gates `/dashboard/*`. Without it `/dashboard` is open.
- `lib/core/types.ts` published as the shared contract, `lib/supabase/*` factories in place.

## Phase 1 — Database (db-agent)

Depends on: nothing. Everything else waits for this.

- Migrations for `contacts` and `interactions` per `docs/ARCHITECTURE.md` §3, so
  `supabase db reset` builds the database from empty.
- RLS on both tables, `user_id = auth.uid()`, verified with a real negative test.
- `supabase/seed.sql`: one test user plus contacts across all three networks, with
  interaction history — including some that have gone quiet.

**Done when:** `supabase db reset` runs clean, the demo user can log in against the real auth
endpoint, and the anon key alone returns no rows.

## Phase 2 — Core modules (core-agent)

Depends on: Phase 1 shape (the columns in `docs/ARCHITECTURE.md` §3), not on its completion.

- `contacts.ts`, `interactions.ts`, `read.ts`.
- `import/parse-spreadsheet.ts` and `normalize.ts`, pure functions, no database.
- `import/ingest.ts`: batch insert, dedupe on e-mail within a network.
- `graph/build.ts` and `graph/filter.ts` — generalized to company / role / city / relation / tag.
- Server Actions in `lib/actions/` as thin adapters.
- Checks in `lib/core/__checks__/run.ts` for the parser, `build.ts` and `filter.ts`. Nowhere else.

**Done when:** `npm run check` is green, and a spreadsheet with German headers and prelude
rows parses into clean `ContactInput` records.

## Phase 3 — UI (ui-agent)

Depends on: Phase 2.

- Login / sign-up.
- Network switcher — the three mindmaps, prominent, the first thing on the dashboard.
- Graph canvas with `react-force-graph-2d`. Person nodes small, attribute nodes larger and
  labelled, quiet contacts marked.
- Filter bar: company, role, city, relation, tag, free text, "nur stille Kontakte".
  Filters hide nodes, they do not rebuild the layout.
- Click a person: side panel with details, the interaction log, a form to log an interaction,
  and edit / delete.
- Contact form for manual entry. Import page: file picker, client-side parse, preview with
  per-row problems, explicit confirm, template download.
- Empty states for all three networks. Design system from `AGENTS.md` §10. No new colors.

**Done when:** all three networks render, filtering feels instant, a contact can be created
by hand and by import, and logging a call changes what the panel says.

## Phase 4 — Demo polish (all)

- Seed a realistic demo account for each network.
- Loading and error states on the import path.
- Record a video of the full run as a backup.

---

## Definition of done, every phase

1. `npm run build` passes with zero type errors.
2. `supabase db reset` still replays cleanly.
3. `npm run check` is green.
4. No new dependency was added without noting it here and why.
5. Nothing in `lib/actions/` contains business logic.

## Coordination

- Only db-agent writes `supabase/`. If another agent needs a column, it asks.
- Only core-agent writes inside `lib/core/` and `lib/actions/`.
- ui-agent owns `app/` and `components/`, and never queries Supabase directly.
- Shared types live in `lib/core/types.ts` and change by agreement, not unilaterally.

## Open

Questions to answer while building rather than blocking on. Pick the simpler option and note
the choice here.

- Family is a tree, not a cluster graph. Default: same bipartite graph via `relation`
  attribute nodes, no special case. Revisit if it reads badly with real data.
- Dedupe key for the importer. Default: e-mail within a network, insert everything else, and
  report duplicates by name in the preview instead of merging them.
- Column-mapping UI for imports. Default: alias detection plus a downloadable template. Add
  the mapping UI when a real file fails.

## New dependencies

- `read-excel-file` — reads `.xlsx` in the browser. The `xlsx` package on npm is stuck at
  0.18.5 with open advisories and the fixed build ships only from the vendor's own CDN.
- `papaparse` — `.csv` parsing.
- `tsx` (dev) — runs `lib/core/__checks__/run.ts` without a test framework.
