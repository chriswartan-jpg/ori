---
description: "Three switchable mindmaps of your own network — business, friends, family — that you fill yourself, with an interaction log that shows which relationships have gone quiet."
type: Project
about: "ori"
---

# Ori

## What This Is

A web app that turns your own network into three switchable, filterable graphs — **Business**,
**Freunde**, **Familie**. You fill each one yourself, by hand or by Excel/CSV import, and log
interactions per contact (called, met, wrote, e-mailed, noted) so the app can surface which
relationships have gone quiet.

Planned but not built in the MVP: an assistant that helps sort and maintain the network, and
MCP connections so the user can attach LinkedIn and other platforms themselves.

## Core Value

People cannot see their own network. A contact list is alphabetical, which is the one order
that tells you nothing — not who you know where, not who does what, not who you have not
spoken to in a year. Ori turns the list into a graph you can explore and a log that remembers
for you, across all three parts of a life rather than only the professional one.

## Current State

| Attribute | Value |
|-----------|-------|
| Type | Application |
| Version | 0.1 (MVP in progress) |
| Status | Prototype — MVP being built, runs locally only |
| Last Updated | 2026-09-21 |

No Production URLs yet — nothing deployed. Local only: Next.js on :3000, Supabase on :54321.

## Requirements

### Core Features

- Three networks — business, friends, family — switchable, each rendered as its own graph
- Create, edit and delete contacts by hand, per network
- Excel/CSV import with header auto-detection, preview and explicit confirm
- Interaction log per contact: kind, date, note; "last contacted" derived from it
- Force-directed graph clustered by company, role, city, relation and tags
- Live filters that hide nodes without re-laying out the graph, plus a "gone quiet" filter
- A keyboard-accessible contact list as an equal alternative to the canvas

### Validated (Shipped)

None yet — the MVP has not been through a real user run.

### Active (In Progress)

- Ori MVP: schema + RLS + seed, core modules, and the three mindmaps with import and interaction log

### Planned (Next)

- [ ] Assistant that helps sort, tag and maintain the network, and suggests who to contact
- [ ] MCP connections the user attaches themselves (LinkedIn and other platforms)
- [ ] Follow-up reminders and timing suggestions
- [ ] Stripe subscription checkout + onboarding

### Out of Scope

- Automated LinkedIn login, scraping, or auto-sending messages — violates LinkedIn's ToS and
  risks account bans; every send stays a manual, user-approved action
- A separate data model per network — one `contacts` table with a `network` column and one
  bipartite graph builder serves all three
- Full social-graph edges (mutual connections) — no data source for them; edges are
  attribute-derived only
- A denormalized "last contacted" column — derived from the interaction log instead

## Target Users

**Primary:** People whose network is large enough that they lose track of it
- Founders & freelancers staying top-of-mind with clients and partners
- Job seekers keeping recruiters and hiring managers warm

**Secondary:** Anyone who wants one place for professional and private contacts and keeps
forgetting when they last called their aunt

## Context

**Business Context:**
Positioned as a subscription product (~€5.99/month) aimed at individuals rather than sales teams — existing CRMs solve this shape of problem only for sales orgs, not personal networking.

**Technical Context:**
A fresh Next.js 16 + Supabase build. An earlier codebase (originally called Bifur) inspired the
concept but is not part of this repo and was not available when the MVP was built, so the
schema was written from scratch — two tables, `contacts` and `interactions`. Data enters via
the contact form and a spreadsheet import; platform connections are deferred to user-attached
MCP servers rather than any direct LinkedIn integration.

```
  contact form  ─┐
                 ├─►  Ori app  ──►  contacts + interactions
  .xlsx / .csv  ─┘  (Next.js +      (Supabase, RLS per user)
   (browser-side     Supabase)              │
    parse, preview)       │                 ▼
                          ▼        three mindmaps: business / friends / family
                  interaction log   (bipartite graph, edges derived at render time)

  deferred:  assistant (sort, tag, suggest who to contact)
             MCP — Ori as a server, and platform MCP servers the user attaches
```

## Constraints

### Technical Constraints

- No platform API gives a user their own contact list, so the user supplies the data: contact
  form or spreadsheet import. Platform connections later go through user-attached MCP servers.
- No mutual-connection data from anywhere — graph edges must be attribute-derived, not social
- Family reads more like a tree than a cluster graph; the MVP models it with `relation`
  attribute nodes and no special case, to be revisited against real data
- Graph rendering (`react-force-graph-2d` / `d3-force` on canvas) comfortably handles up to a couple thousand nodes; beyond that would need WebGL

### Business Constraints

- LLM + hosting cost per user must sit comfortably under the €5.99/month subscription price
- Small team / hackathon-origin project — scope must stay tight enough to demo in 90 seconds

### Compliance Constraints

- Must never automate LinkedIn login, scraping, or message sending — ToS violation risk of account suspension for users
- Handles personal contact and message-draft data — GDPR applies (EU users)

## Key Decisions

| Decision | Rationale | Date | Status |
|----------|-----------|------|--------|
| Messaging is draft-only, human-in-the-loop — no auto-send | Automated LinkedIn messaging violates ToS and risks user account bans; this was the single biggest risk in the original messaging-assistant concept | 2026-09-21 | Active |
| Graph edges are attribute-derived (company/role/city/relation/tag), not social | There is no mutual-connection data source; attribute edges also make clusters more readable than a real social graph would | 2026-09-21 | Active |
| The user supplies the data: contact form plus Excel/CSV import. Platform connections later go through MCP servers the user attaches themselves | No platform API gives a user their own contact list, and scraping violates ToS and risks account restriction | 2026-09-21 | Active |
| Three networks from the start: business, friends, family | They are the same shape of problem, and one `network` column plus one graph builder covers all three — cheaper than shipping one and retrofitting two | 2026-09-21 | Active, supersedes "professional only for v1" |
| Build fresh rather than extend the older codebase (originally called Bifur) | That codebase is not in this repo and was not available on the build machine; the schema and app were written from scratch, keeping only the design system from the concept docs | 2026-09-21 | Active, supersedes "build on the existing codebase" |
| Assistant and MCP deferred out of the MVP | The value has to hold up without them: a network you cannot see is not fixed by a chat box on top of it. `lib/core/` is framework-free so both become adapters later, not rewrites | 2026-09-21 | Active |
| Two tables, `contacts` and `interactions`. No groups, clusters or edge table | Edges are derived from attributes at render time and "last contacted" is `max(occurred_on)` — nothing to store, sync or invalidate | 2026-09-21 | Active |
| Product name is Ori | Resolves the open naming question from the original concept doc | 2026-09-21 | Active |

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Trial → paid conversion rate | TBD | — | — |
| Monthly churn | TBD | — | — |
| Interactions logged + contacts revived per active user | TBD | — | — |
| Reply rate on assisted messages (self-reported) | TBD | — | — (assistant not built) |
| LLM + hosting cost per user vs. €5.99 revenue | Comfortably under €5.99 | — | — |

## Tech Stack / Tools

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 | Fresh scaffold. No component library — the design system is hand-rolled CSS tokens |
| Backend / DB | Supabase (Postgres + auth + RLS) | Two tables, RLS scoped by `user_id`. Runs locally in Docker via OrbStack |
| Graph rendering | `react-force-graph-2d` / `d3-force` (canvas) | Handles up to ~2k nodes without WebGL |
| Spreadsheet import | `read-excel-file` (.xlsx), Papaparse (.csv) | Parsed in the browser. The `xlsx` package on npm is stuck at 0.18.5 with open advisories |
| Payments | Stripe | Not built yet. Subscriptions, ~€5.99/month |
| AI / LLM | TBD provider | Not built yet. Assistant for sorting, tagging and follow-up suggestions |
| Agent protocol | MCP (Model Context Protocol) | Not built yet. Both directions: Ori as an MCP server, and user-attached platform MCP servers as a data source |

## Links

| Resource | URL |
|----------|-----|
| Repository | https://github.com/chriswartan-jpg/ori |
| Production | TBD |
| Documentation | See `README.md`, `docs/TASKS.md`, `docs/PLAN.md` in this folder |

---
*PROJECT.md — Updated when requirements or context change*
*Last updated: 2026-09-21 — rescoped from the LinkedIn-export concept to three self-filled networks*
