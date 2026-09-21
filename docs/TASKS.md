# TASKS.md

> This file tracks the current sprint's tasks, blockers, and open questions.
> It is the first thing to check after reading AGENTS.md and docs/PROJECT.md.
> Reset this file when starting a new sprint — move completed work to PLAN.md.

---

# TASKS.md — Ori

> Sprint: 1 — MVP Build
> Goal: Three switchable mindmaps you can actually fill — by hand and by spreadsheet — with
> an interaction log that makes gone-quiet contacts visible.
> Started: 2026-09-21
> Target: TBD

---

## Active Tasks

### In Progress
- [ ] Phase 1 — schema, RLS, seed across all three networks (db-agent)
- [ ] Phase 2 — core modules: import, graph, read, Server Actions (core-agent)
- [ ] Phase 3 — UI: login, network switcher, graph, filters, contact panel, import (ui-agent)

### Up Next
- [ ] Run the whole thing against a real spreadsheet, not just the seed
- [ ] Phase 4 — demo polish: loading and error states, realistic demo account, video backup
- [ ] Decide what the assistant actually does before building it (see Open Questions)

### Done This Sprint
- [x] Rescoped from the LinkedIn-export concept to three self-filled networks
- [x] Phase 0 — Next.js 16 scaffold, design tokens, fonts, `proxy.ts`, Supabase local stack,
      `lib/core/types.ts` as the shared contract
- [x] `docs/ARCHITECTURE.md` rewritten to describe the MVP as built; the older target doc kept
      as `docs/ARCHITECTURE-TARGET.md`

---

## Blockers
Anything preventing progress. Must be resolved before the sprint can complete.

| Blocker | Blocks what | Resolution path |
| ------- | ----------- | --------------- |
| `docs/ARCHITECTURE-TARGET.md` contradicts `docs/PROJECT.md`, `AGENTS.md` and this sprint's scope | Any decision about live LinkedIn access. The MVP was built export-free in the meantime, so nothing is blocked today | Decide explicitly: keep the no-scraping rule, or adopt the browser-automation MCP and update the other three docs. See ARCHITECTURE-TARGET.md §11 risk 1 |
| `git` on the build machine refuses to run (Xcode licence not accepted) | Nothing right now — `/Library/Developer/CommandLineTools/usr/bin/git` works as a substitute | `sudo xcodebuild -license`, or keep using the Command Line Tools binary |

---

## Open Questions
Questions that need answers before a task can be written or executed.

| Question | Who answers | Priority |
| -------- | ----------- | -------- |
| Export-only/draft-only, or live LinkedIn access via `linkedin-mcp-server`? The two architecture docs currently disagree. | Team (Paul + Christian) | **High** |
| What does the assistant actually do first — tag and clean up the network, or suggest who to contact next? It needs one job it does well, not a chat box. | Team | High |
| Which platforms are worth an MCP connection beyond LinkedIn, and does the user attach them or does Ori host them? | Team | Medium |
| Does family need a tree layout rather than the bipartite cluster graph? | Decide against real data | Medium |
| Single-person view only, or a "compare two networks" mode? | Team | Low |

---

## Deferred From This Sprint
- Assistant and MCP server. `lib/core/` is framework-free so both are adapters later, not rewrites.
- Stripe subscription checkout and onboarding.
- Follow-up reminders and timing suggestions.

---

## Decisions Made This Session
- 2026-09-21 Rescoped: three networks (business, friends, family) filled by the user, instead
  of a LinkedIn-export-driven professional graph. One `contacts` table with a `network` column
  and one graph builder serves all three; shipping one network and retrofitting two would have
  cost more.
- 2026-09-21 Assistant and MCP moved out of the MVP. The value has to hold up without them.
- 2026-09-21 MVP scaffolded as a greenfield Next.js 16 app. The "existing Bifur codebase" the
  concept docs assume is reused does not exist in this repo and was not on the build machine,
  so the schema was written from scratch.
- 2026-09-21 Two tables only, `contacts` and `interactions`. No groups table, no edge table, no
  denormalized "last contacted" column — it is `max(occurred_on)`, computed on read.
- 2026-09-21 No shadcn/ui. The design system is hand-rolled CSS tokens, so shadcn primitives
  would have been overridden wholesale. `components/ui/` does not exist.
- 2026-09-21 `read-excel-file` for `.xlsx` instead of SheetJS. The `xlsx` package on npm is
  stuck at 0.18.5 with open advisories and the fixed build ships only from the vendor's CDN.
- 2026-09-21 Spreadsheet columns are matched by a German/English alias table plus a
  downloadable template, instead of a column-mapping UI. The mapping UI gets built when a real
  file defeats the aliases.

---

## Next Sprint Preview
Sprint 2 — the assistant: one job it does well (see Open Questions), exposed as a tool
registry under `lib/core/tools/` plus one route handler, reading the same core modules.
