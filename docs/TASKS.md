# TASKS.md

> This file tracks the current sprint's tasks, blockers, and open questions.
> It is the first thing to check after reading AGENTS.md and docs/PROJECT.md.
> Reset this file when starting a new sprint — move completed work to PLAN.md.

---

# TASKS.md — Ori

> Sprint: 0 — Planning & Validation
> Goal: Turn the merged concept into a buildable MVP plan and resolve the open compliance/product questions before writing any code.
> Started: 2026-09-21
> Target: TBD (start of Sprint 1 — MVP build)

---

## Active Tasks

### In Progress
_(none yet)_

### Up Next
- [ ] Request the LinkedIn data export (Settings → Data Privacy → Get a copy of your data → Connections) so a real CSV exists to build against
- [ ] Decide whether the assistant lives as an in-app panel or runs through an MCP client (e.g. Claude) with the app as the view
- [ ] Agree the normalized person/contact shape so graph work can start against mock data without waiting on the CSV parser
- [ ] Validate that the "draft-only, no auto-send" model is still compelling enough for target users (job seekers, founders/freelancers, students)

### Done This Sprint
- [x] Merged the two original concept docs (network-graph hackathon brief + subscription messaging brief) into one coherent concept — `bifur-project-idea.md`
- [x] Wrote `README.md`, `docs/PROJECT.md`, and `AGENTS.md` scaffolding for the project

---

## Blockers
Anything preventing progress. Must be resolved before the sprint can complete.

| Blocker | Blocks what | Resolution path |
| ------- | ----------- | --------------- |
| No LinkedIn export requested yet | Building/testing the CSV import parser, seeding a real demo | Request the export today (Settings → Data Privacy → Get a copy of your data) |

---

## Open Questions
Questions that need answers before a task can be written or executed.

| Question | Who answers | Priority |
| -------- | ----------- | -------- |
| In-app assistant panel vs. MCP-client-as-the-view? | Team | Medium |
| Single-person network view only, or a "compare two networks" mode? | Team | Low |
| Does draft-only messaging need a browser extension/bookmarklet, or is copy/paste acceptable for v1? | Team | Medium |

---

## Deferred From This Sprint
_(none yet)_

---

## Decisions Made This Session
- 2026-09-21 Merged conflicting messaging approaches (automated send vs. graph-only) into a single human-in-the-loop model: assistant drafts, user always sends manually. Reason: removes the ToS/account-ban risk that was the biggest open risk in the original subscription concept.
- 2026-09-21 `docs/ARCHITECTURE.md` intentionally not created yet — no real code structure exists to document; write it once the app is actually being built.
- 2026-09-21 Product name confirmed as Ori. The underlying codebase being reused was originally built under the name Bifur — that stays as a technical lineage note, not the product name.

---

## Next Sprint Preview
Sprint 1 — MVP Build: CSV import + role-family enrichment, graph rendering with clustering/filters, and a first chat-assistant pass (`search_network`, `get_clusters`, `set_filter`).
