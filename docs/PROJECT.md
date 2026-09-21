---
description: "The graph view for your LinkedIn network, with an AI assistant that finds the right people and drafts outreach to keep relationships warm — without ever automating LinkedIn itself."
type: Project
about: "ori"
---

# Ori

## What This Is

A web app that turns a LinkedIn connections export into an interactive, filterable graph of your professional network, with an AI assistant that can query the graph, surface who's worth talking to, and draft outreach and follow-up messages for relationships that have gone quiet. Paired with an MCP server so any AI client — not just the in-app assistant — can query and act on the network the same way.

## Core Value

People with large LinkedIn networks can't see who they know or remember who's gone cold. Ori turns the flat connections list into a graph you can explore and an assistant that helps you act on it, without ever risking a LinkedIn ban by automating sends.

## Current State

| Attribute | Value |
|-----------|-------|
| Type | Application |
| Version | 0.0 (concept) |
| Status | Prototype — idea/planning stage, no code written yet |
| Last Updated | 2026-09-21 |

No Production URLs yet — nothing deployed.

## Requirements

### Core Features

- Import a LinkedIn connections CSV export and normalize it into contacts
- Render the network as an interactive, force-directed graph clustered by company, role, industry, city
- Live filters that re-lay out the graph (city, role, industry, company, seniority, connection date)
- Chat assistant that queries and drives the graph view ("who could help me with X in Y")
- Relationship-health tracking: flag contacts gone quiet, draft follow-ups, suggest timing — user always sends manually
- MCP server exposing the same capabilities to external AI clients

### Validated (Shipped)

None yet — implementation hasn't started.

### Active (In Progress)

None yet.

### Planned (Next)

- [ ] CSV import + role-family enrichment (LLM classification pass)
- [ ] Graph rendering with clustering + filters
- [ ] Chat assistant (`search_network`, `get_clusters`, `set_filter`)
- [ ] Message drafting + no-reply tracking + reminders
- [ ] Stripe subscription checkout + onboarding

### Out of Scope

- Automated LinkedIn login, scraping, or auto-sending messages — violates LinkedIn's ToS and risks account bans; every send stays a manual, user-approved action
- Friends & family networks — professional-only for v1; the data model allows the expansion later, it's just not built now
- Full social-graph edges (mutual connections) — not available from the LinkedIn export; edges are attribute-derived only

## Target Users

**Primary:** People with large, under-used LinkedIn networks who want to actually use them
- Job seekers keeping recruiters and hiring managers warm
- Founders & freelancers staying top-of-mind with clients and partners

**Secondary:** Students & recent grads nurturing contacts from events, associations, internships

## Context

**Business Context:**
Positioned as a subscription product (~€5.99/month) aimed at individuals rather than sales teams — existing CRMs solve this shape of problem only for sales orgs, not personal networking.

**Technical Context:**
Builds on an existing codebase (originally built under the name Bifur; Next.js 16 + Supabase with auth/RLS, a `contacts` table, a groups system, an import pipeline) rather than starting from zero. LinkedIn has no API for a user's own connections, so the only compliant data source is LinkedIn's own user-initiated data export (CSV).

```
   LinkedIn            CSV           Ori app                    MCP clients
 "Get your data" --->  export  --->  (Next.js + Supabase)  <--->  (Claude, etc.)
                                          |          |
                                          v          v
                                     graph view   chat / assistant
                                    (force-graph)  (drafts messages,
                                                     never sends them)
                                          |
                                          v
                                  contact / cluster / message-draft
                                     tables (Supabase, RLS)
```

## Constraints

### Technical Constraints

- No official LinkedIn API for a user's own connection list — the CSV export is the only legitimate ingestion path
- City and industry are not present in the export and must be inferred or manually tagged
- No mutual-connection data — graph edges must be attribute-derived, not social
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
| Graph edges are attribute-derived (company/role/industry/city), not social | LinkedIn's export has no mutual-connection data; attribute edges also make clusters more readable than a real social graph would | 2026-09-21 | Active |
| Data source is LinkedIn's own user-initiated export only — no scraping, no unofficial API | Scraping violates ToS and risks account restriction; the export is the only clean, legitimate path | 2026-09-21 | Active |
| Professional network only for v1, friends/family deferred | Ship one group well rather than three badly; the data model already allows the expansion later | 2026-09-21 | Active |
| Build on the existing codebase (originally called Bifur; Next.js 16 + Supabase) rather than starting fresh | Reuses existing auth/RLS, contacts table, groups system, import pipeline, and dark design system | 2026-09-21 | Active |
| Product name is Ori | Resolves the open naming question from the original concept doc | 2026-09-21 | Active |

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Trial → paid conversion rate | TBD | — | — |
| Monthly churn | TBD | — | — |
| Drafts created + marked-sent + follow-ups completed per active user | TBD | — | — |
| Reply rate on assisted messages (self-reported) | TBD | — | — |
| LLM + hosting cost per user vs. €5.99 revenue | Comfortably under €5.99 | — | — |

## Tech Stack / Tools

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js 16 | Reused from the existing codebase (originally called Bifur) |
| Backend / DB | Supabase (Postgres + auth + RLS) | Reused from the existing codebase (originally called Bifur) |
| Graph rendering | `react-force-graph-2d` / `d3-force` (canvas) | Handles up to ~2k nodes without WebGL |
| Payments | Stripe | Subscriptions, ~€5.99/month |
| AI / LLM | TBD provider | Role classification, message drafting, chat assistant |
| Agent protocol | MCP (Model Context Protocol) | Lets external AI clients query/act on the network |

## Links

| Resource | URL |
|----------|-----|
| Repository | TBD |
| Production | TBD |
| Documentation | See `README.md`, `docs/TASKS.md`, `docs/PLAN.md` in this folder |

---
*PROJECT.md — Updated when requirements or context change*
*Last updated: 2026-09-21*
