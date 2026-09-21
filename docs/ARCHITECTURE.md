# Architecture — Ori

> Target architecture, written pre-implementation (no code exists in this repo yet — see `docs/PROJECT.md` for status). This describes the intended system so the team builds toward one shared design.

## 1. Introduction and Goals

### 1.1 Requirements Overview

Full requirements live in `docs/PROJECT.md`. Summary: Ori imports a user's LinkedIn connections export, renders it as a filterable graph, and gives the user an AI assistant that can query the network and draft outreach — sold as a ~€5.99/month subscription.

### 1.2 Quality Goals

| Priority | Quality Goal | Scenario |
|---|---|---|
| 1 | Cost efficiency | LLM + hosting cost per active user stays comfortably under €5.99/month revenue |
| 2 | Usability | Graph re-layout on filter change feels instant (<300ms) for networks up to ~2k nodes |
| 3 | Data safety | A user's LinkedIn/contact data is only ever readable by that user (Supabase RLS enforced on every table) |
| 4 | Account safety | LinkedIn-facing actions must not get a user's account flagged or banned — see §11, this is currently **at risk**, not met |

### 1.3 Stakeholders

| Role | Expectations |
|---|---|
| Product owner (you) | A demoable MVP, then a sellable subscription product |
| End users | Their own LinkedIn data stays private; the product doesn't get their account banned |
| Collaborators (e.g. Waffelhaffel on GitHub) | A codebase they can build against once implementation starts |

## 2. Architecture Constraints

| Constraint | Negotiable? |
|---|---|
| Supabase for auth + database (reuses the existing Bifur-derived codebase) | Hard — already decided, see `docs/PROJECT.md` Key Decisions |
| Vercel for hosting the Next.js app | Hard — stated stack choice |
| Stripe for subscription payments | Hard — stated stack choice |
| Local development stack before anything is deployed | Hard — build and run locally first |
| LinkedIn network data enters only via CSV export or the chosen MCP server (see §4, §11) | Was hard (export-only); now under active reconsideration — flagged as a risk, not resolved |
| Next.js 16 (existing codebase) | Hard |

## 3. Context and Scope

### 3.1 Business Context

| External party | What Ori exchanges with them |
|---|---|
| End user | Uploads a LinkedIn CSV export; browses their graph; approves/sends drafted messages; pays a subscription |
| LinkedIn | Source of the CSV export (compliant path) and, via the MCP server, of live profile/company/job/message data (non-compliant path, see §11) |
| Stripe | Subscription checkout, billing, webhooks |
| MCP clients (e.g. Claude Desktop) | Can call Ori's own MCP tools to query/drive the network, same as the in-app assistant |

### 3.2 Technical Context

```
                    HTTPS                          HTTPS
   Browser  <----------------->  Vercel (Next.js)  <----------------->  Supabase
  (end user)                     - pages/API routes                    (Postgres, Auth, RLS)
                                        |    ^
                                stripe- |    | webhook
                                checkout|    | (subscription status)
                                        v    |
                                     Stripe API
                                        |
                                        |  MCP (stdio/local process, NOT deployed on Vercel — see §7, §11)
                                        v
                          stickerdaniel/linkedin-mcp-server
                          (Patchright/Chromium, logged into
                           the user's own LinkedIn session)
                                        |
                                        v
                                   linkedin.com
```

## 4. Solution Strategy

- **Frontend + API**: Next.js 16 on Vercel — reuses the existing (originally "Bifur") codebase rather than starting fresh. Serverless functions handle Stripe webhooks and any server-side logic.
- **Data**: Supabase Postgres with Row Level Security, so every table (contacts, clusters, message drafts, users) is scoped to the owning user by default.
- **Payments**: Stripe Checkout + webhooks update a `subscription_status` column in Supabase; feature gating reads that column.
- **Network ingestion**: LinkedIn's own CSV export remains the bulk-import path — nothing else can legally list a user's full connections (see `docs/PROJECT.md` §Constraints).
- **LinkedIn actions (profiles, companies, jobs, messages)**: the chosen tool is **stickerdaniel/linkedin-mcp-server** (3,563⭐, Apache 2.0, Python) — see §9 and §11 for why this is a live risk, not a settled decision.
- **Local-first development**: build and run the whole stack locally (Next.js dev server + local/dev Supabase project) before anything touches Vercel or production Stripe/LinkedIn credentials.

## 5. Building Block View

### 5.1 Whitebox Overall System (Level 1)

```
+-----------------------------------------------------------+
|                     Ori (Next.js app)                      |
|                                                              |
|  +----------------+  +----------------+  +----------------+ |
|  |  Graph View     |  |  Chat Assistant |  |  Billing/Auth   | |
|  |  (force-graph)  |  |  (chat panel)   |  |  UI (Supabase)  | |
|  +--------+--------+  +--------+--------+  +--------+--------+ |
|           |                    |                    |          |
|  +--------v--------------------v--------------------v--------+ |
|  |                Next.js API routes / server actions          | |
|  +----+------------------+------------------+------------------+ |
|       |                  |                  |                    |
+-------|------------------|------------------|--------------------+
        v                  v                  v
  +-----------+     +-------------+    +----------------+
  |  Supabase |     |   Stripe    |    |  MCP client     |
  | (Auth,DB) |     | (payments)  |    |  (calls the     |
  +-----------+     +-------------+    |  LinkedIn MCP)   |
                                        +--------+---------+
                                                 |
                                                 v
                                  stickerdaniel/linkedin-mcp-server
                                  (separate local process — see §7)
```

| Building Block | Responsibility |
|---|---|
| Graph View | Renders contacts as a force-directed graph, clustered by attribute, filterable live |
| Chat Assistant | Chat UI that calls the same tools an external MCP client would (`search_network`, `set_filter`, `draft_message`, ...) |
| Billing/Auth UI | Sign-up/login (Supabase Auth), subscription status, Stripe checkout entry point |
| API routes / server actions | Next.js server-side logic: CSV import, enrichment trigger, Stripe webhook handler, MCP tool orchestration |
| Supabase | Postgres (contacts, clusters, message drafts, users, subscription status) + Auth + Row Level Security |
| Stripe | Subscription checkout and billing lifecycle |
| MCP client / LinkedIn MCP | Wraps `stickerdaniel/linkedin-mcp-server` to fetch live profile/company/job/message data and (if enabled) send messages |

#### 5.1.1 MCP Integration Layer

- **Purpose:** the only building block that talks to LinkedIn directly (beyond the one-time CSV import). Everything else in Ori only ever reads Supabase.
- **Interface(s):** MCP tool calls (stdio) to a running `linkedin-mcp-server` process: `get_person_profile`, `get_my_profile`, `search_people`, `get_company_profile`, `get_inbox`, `get_conversation`, `send_message`, `connect_with_person`, etc.
- **Quality characteristic that matters here:** every write tool (`send_message`, `connect_with_person`) should be called only behind explicit user confirmation in the UI, to preserve as much of the original "human-in-the-loop" principle as this MCP choice still allows (see §11 — the read side already carries real risk, so writes need the tightest gate).
- **Location:** not part of the Vercel deployment — see §7.

## 6. Runtime View

### 6.1 CSV import → graph render (the compliant, low-risk path)

```
User -> Ori UI: upload connections.csv
Ori UI -> API route: POST /api/import
API route -> Supabase: insert/normalize rows into `contacts`
API route -> LLM: batch-classify role_family per contact
API route -> Supabase: write enriched contacts + clusters
Ori UI <- Supabase: subscribe/query contacts+clusters
Ori UI -> Graph View: render nodes/edges, ready to filter
```

### 6.2 Assistant looks up a live profile via the LinkedIn MCP (the risky path)

```
User -> Chat Assistant: "who is X, and where do they work now?"
Chat Assistant -> API route: tool call get_person_profile(X)
API route -> MCP client -> linkedin-mcp-server: get_person_profile
linkedin-mcp-server -> linkedin.com: browser session request (as the user)
linkedin.com -> linkedin-mcp-server: profile HTML/data
linkedin-mcp-server -> API route -> Chat Assistant: structured profile data
Chat Assistant -> User: answer
```

Note the difference from 6.1: this path makes a real, live, authenticated request to linkedin.com on every call — that's the source of the risk discussed in §11.

### 6.3 Subscription checkout

```
User -> Billing UI: click "Subscribe"
Billing UI -> Stripe Checkout: redirect
Stripe -> Ori webhook (API route): checkout.session.completed
API route -> Supabase: set subscription_status = active for user
Ori UI <- Supabase: unlock gated features
```

## 7. Deployment View

### 7.1 Infrastructure Level 1

| Environment | Where it runs | Notes |
|---|---|---|
| Local dev | Next.js dev server + Supabase local/dev project, on the developer's machine | Build and verify everything here first |
| Production — app | Vercel (Next.js, serverless functions) | Hosts Graph View, Chat Assistant UI, API routes, Stripe webhook handler |
| Production — data | Supabase cloud project | Postgres + Auth + RLS |
| Production — payments | Stripe | Hosted checkout + webhooks into Vercel |
| LinkedIn MCP server | **Not Vercel** — a separate, persistent process holding a real logged-in browser session per user | See §11 — this is an open infrastructure problem, not a solved deployment target |

### 7.2 Why the MCP server can't just live on Vercel

`stickerdaniel/linkedin-mcp-server` starts a real Chromium browser (via Patchright) tied to one LinkedIn login, and keeps a session profile on local disk (`~/.linkedin-mcp/profile`). Vercel serverless functions are stateless, short-lived, and can't persist a logged-in browser session or hold a Chromium binary across invocations. Concretely, this MCP server needs to run somewhere with:

- A persistent filesystem (for the browser profile / session cookies)
- A long-lived process (not a function that spins down after each request)
- One instance *per user* logged into *their own* LinkedIn account, isolated from every other user's session

That's a materially bigger and riskier piece of infrastructure than "add an MCP client call to a serverless function" — closer to running a fleet of per-user browser containers than a typical API integration. This needs its own deployment decision before it can go to production; it is not solved by putting it "on Vercel" alongside the rest of the app.

## 8. Cross-cutting Concepts

### 8.1 Auth & multi-tenancy

Supabase Auth issues the session; every table carries a `user_id` and RLS policies scope all reads/writes to `auth.uid()`. No cross-user data access anywhere in the schema.

### 8.2 Payments gating

`subscription_status` on the user row is the single source of truth for feature gating, kept in sync only via the Stripe webhook handler — never set directly from client code.

### 8.3 LinkedIn compliance posture (see §11 for the open question)

Two different risk profiles coexist in this design right now:
- CSV import (§6.1): fully compliant, LinkedIn's own official export.
- MCP-driven live actions (§6.2): browser automation against LinkedIn's real, private frontend — not compliant with LinkedIn's ToS. Write actions (`send_message`, `connect_with_person`) are the highest-risk operations and should stay behind explicit per-action user confirmation at minimum.

### 8.4 Environments & secrets

Local `.env.local` for dev keys (Supabase dev project, Stripe test keys); Vercel environment variables for production secrets. LinkedIn MCP credentials (browser session) never touch Vercel at all — see §7.2.

## 9. Architecture Decisions

| Decision | Rationale | Date | Status |
|---|---|---|---|
| Hosting: Vercel for the Next.js app | Stated stack choice; matches the existing (Bifur-derived) Next.js codebase | 2026-09-21 | Active |
| Auth + DB: Supabase | Already the existing codebase's foundation (auth, RLS, contacts table) | 2026-09-21 | Active |
| Payments: Stripe | Stated stack choice; matches the €5.99/month subscription model in `docs/PROJECT.md` | 2026-09-21 | Active |
| Build and run locally before deploying anything | Explicit instruction — de-risks the LinkedIn MCP integration especially, since it needs a real local browser session to test | 2026-09-21 | Active |
| LinkedIn live-action MCP: `stickerdaniel/linkedin-mcp-server` | Chosen for its maturity (3,563⭐, actively maintained, Apache 2.0) over the other candidates evaluated | 2026-09-21 | **Active, but conflicts with an earlier decision — see §11** |

**This table intentionally does not silently overwrite** the `docs/PROJECT.md` Key Decisions rows "Messaging is draft-only, human-in-the-loop — no auto-send" and "Data source is LinkedIn's own user-initiated export only — no scraping, no unofficial API" (both dated 2026-09-21, status Active). Both files currently exist and disagree with each other. Resolving that is a decision for you to make explicitly, not something this document should paper over — see §11.

## 10. Quality Requirements

| Scenario | Stimulus | Response | Metric |
|---|---|---|---|
| Cost stays under budget | 1,000 active subscribers | LLM + hosting spend per user | Comfortably under €5.99/month per user (target from `docs/PROJECT.md`) |
| Graph stays responsive | User applies a filter on a ~2k-node network | Graph re-lays out | Under 300ms, canvas rendering (`react-force-graph-2d`/`d3-force`), no WebGL needed |
| RLS holds | Any authenticated user queries any table | Only their own rows return | 0 cross-user data leaks in testing |

## 11. Risks and Technical Debt

Ranked by severity:

1. **Direct contradiction between two live decisions.** `docs/PROJECT.md` records "no scraping, no automation, human-in-the-loop only" as an *Active* Key Decision. This document now names `stickerdaniel/linkedin-mcp-server` — a scraper/browser-automation tool explicitly tagged `linkedin-profile-scraper` — as the chosen MCP for live LinkedIn actions. `AGENTS.md`'s "Forbidden" section still says "never build any feature that logs into LinkedIn, scrapes LinkedIn profiles, or sends a LinkedIn message without the user manually doing it themselves." **These three documents currently disagree.** Nothing has been built yet, so no harm has happened — but before implementation starts, you need to explicitly decide and then update whichever of these three is wrong, rather than leaving contradictory instructions for whoever (human or agent) builds this next.
2. **Real account-ban risk if the MCP path ships as-is.** `stickerdaniel/linkedin-mcp-server` drives a real, logged-in browser session against linkedin.com. LinkedIn can and does detect and restrict automated browser sessions; this is independent of whether a human clicked "confirm" on each message.
3. **Infrastructure mismatch, not just a compliance question.** As detailed in §7.2, this MCP server's design (one persistent local browser session per user) does not fit a Vercel serverless deployment at all. Even setting compliance aside, "MCP in order to get things done" needs its own hosting answer before it can reach production users.
4. **Multi-tenant session management is unsolved.** If pursued, Ori would need to hold one live LinkedIn browser session per subscriber, securely isolated — a meaningfully larger and more sensitive piece of infrastructure than anything else in this stack (bigger blast radius than a leaked API key: a leaked/hijacked session is a user's actual LinkedIn account).
5. **Possible mitigation, not yet decided:** restrict the MCP integration to its read-only tools (`get_person_profile`, `get_company_profile`, `search_people`, etc.) and never wire up `send_message` / `connect_with_person`, keeping at least the "never auto-send" half of the original decision intact. This is a real option, not yet chosen — flagging it here so it's a deliberate choice, not a default.

## 12. Glossary

| Term | Definition |
|---|---|
| MCP | Model Context Protocol — the protocol Ori's assistant and external AI clients use to call structured tools |
| RLS | Row Level Security — Postgres/Supabase feature restricting each row to its owning user |
| Patchright | A stealth-mode wrapper around Playwright/Chromium, used by `stickerdaniel/linkedin-mcp-server` to avoid basic bot detection |
| Voyager | LinkedIn's own private/internal web API, which browser-automation MCP servers reverse-engineer or drive indirectly |
| Attribute-derived edges | Graph edges based on shared company/role/industry/city, not real social/mutual-connection data (which LinkedIn's export doesn't provide) |

---
*ARCHITECTURE.md — describes the target system; update when the solution strategy, building blocks, or major risks actually change.*
*Last updated: 2026-09-21*
