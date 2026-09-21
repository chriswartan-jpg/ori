> **Historisches Konzeptdokument.** Der Scope hat sich seit diesem Stand geändert: Ori ist
> jetzt drei selbst gefüllte Netzwerke (Business, Freunde, Familie) mit Interaktions-Log,
> nicht ein LinkedIn-Export-Graph. Assistent und MCP sind aus dem MVP heraus verschoben, und
> "Freunde und Familie" ist nicht mehr aufgeschoben, sondern der Kern. Verbindlich sind
> `docs/PROJECT.md` und `docs/ARCHITECTURE.md`.

# Ori: Your LinkedIn Network, Visualized and Kept Warm

*Merged concept — combines the network-graph hackathon brief with the relationship-assistant/subscription brief into one product.*

---

## 1. The one-liner

Obsidian made a folder of notes navigable by drawing the graph. Nobody has done that for the people you know. Ori is the graph view for your LinkedIn network, with an AI assistant sitting inside it that helps you find the right people and stay in touch with them — without ever automating LinkedIn itself.

## 2. The problem

A LinkedIn network is a list. You scroll it, you cannot use it. After a few years you have 800+ connections and no idea who among them is a 3D artist, who is in Cologne, or who you haven't spoken to in a year. Two failures compound each other:

- **Discovery failure** — the information about who you know is all there, but the interface (a flat list) is the bottleneck.
- **Decay failure** — relationships go cold with no system telling you which ones, and following up feels awkward enough that people just don't.

Existing CRMs solve this for sales teams. Nobody has built the personal, individual version.

## 3. Target users

- **Job seekers** keeping recruiters and hiring managers warm.
- **Students & recent grads** nurturing contacts from events, associations, internships.
- **Founders & freelancers** staying top-of-mind with clients and partners.
- **Anyone networking-heavy** who values their connections but lacks time to maintain them.

## 4. What we are building

A web app with four parts:

1. **The graph.** Every connection is a node. Nodes cluster by what they have in common: company, role family, industry, city. See at once that you know eleven people in post-production and exactly one in finance.
2. **Filters.** Narrow the graph live — city, role, industry, company, seniority, connection date. The graph re-lays out around what's left.
3. **The assistant.** A chat panel next to the graph that *drives the view*, not just answers in text. Ask "who could help me with 3D animation in NRW" and the graph dims to six highlighted nodes with a short explanation of why each one. The assistant also drafts outreach and follow-up messages — the user always sends.
4. **Relationship health.** Track which contacts have gone quiet, surface no-reply follow-ups, and suggest timing to reach back out — a dashboard layer on top of the graph, not a separate product.

**Scope decision: professional only.** Friends and family are a later expansion of the same idea. We build one group well rather than three badly.

## 5. The compliance line (read this before building anything else)

This decision shapes the entire architecture, so it's stated once, up front, and never violated:

> **Ori reads your network and drafts messages for you. It never logs into LinkedIn, scrapes profiles, or sends anything automatically.**

Why this matters:

- **LinkedIn has no API for your own connection list**, and scraping it violates the ToS and gets accounts restricted — not something to demo on stage or build a subscription business on.
- Automated *sending* is explicitly restricted by LinkedIn's ToS and risks getting user accounts flagged or banned. That risk is not worth carrying for either a hackathon demo or a paying customer's account.
- The clean, legitimate path in both directions:
  - **In:** LinkedIn's own data export (Settings → Data Privacy → Get a copy of your data → Connections) — user-initiated, fully legitimate, arrives as CSV.
  - **Out:** the assistant drafts a message; the user copies it into LinkedIn (or approves a send through whatever official channel exists) themselves. Human-in-the-loop, always.

This turns what was the single biggest open risk in the messaging-assistant version of this idea into a non-issue, at the cost of losing "fully automated" as a feature. That trade is worth it — it's the difference between a product that can be demoed and sold, and one that can get users banned.

> **Action item for everyone on the team, today:** request your LinkedIn export now. If we start requesting it at the hackathon, we lose the first day.

### What the export gives us

| Field | Available |
| --- | --- |
| First name, last name | Yes |
| Profile URL | Yes |
| Email address | Sometimes |
| Company | Yes |
| Position | Yes |
| Connected on (date) | Yes |
| City / location | No |
| Industry | No |
| Mutual connections | No |

### Filling the gaps

- **Role family** (designer, developer, producer, founder?) comes from an LLM classification pass over the free-text position field. One batch call, cached in the database.
- **City** is the hard one. In order of preference: infer from a known local company, let the user bulk-tag the people who matter, or fall back to "unknown" as a filter value. For the demo, seed the presenter's own network with locations filled in by hand.

### What connects two people

No mutual-connection data exists in the export, so edges are **attribute-derived**, not social: two nodes link when they share a company, role family, industry, or city. This is a design choice, not a compromise — attribute edges are what make clusters readable ("everyone in video production," "everyone at this agency"). A real social graph would mostly show noise.

## 6. The assistant, concretely

Two modes, same underlying model:

**Explore mode** (graph-driven): "Who could help me with 3D animation in NRW?" → graph dims to six highlighted nodes with reasons.

**Relationship mode** (message-driven):
1. User: *"Message the founder of the student association — say it was great taking part in the event."*
2. Assistant drafts the message and shows it for approval.
3. User copies it into LinkedIn and sends it themselves; marks it sent in the app.
4. No reply after X days → assistant flags it: *"[Name] hasn't replied yet. Want a friendly follow-up draft?"*
5. User approves, edits, or dismisses.

## 7. The MCP server

Alongside the app, an MCP server so any AI client can query and act on the network.

| Tool | What it does |
| --- | --- |
| `import_connections` | Ingest a LinkedIn export CSV, normalize, deduplicate |
| `search_network` | Find people by name, company, role, city |
| `get_clusters` | Return the current cluster structure with sizes |
| `find_connectors` | Who in the network sits between two clusters |
| `suggest_contacts` | Given a goal, return the people worth talking to and why |
| `set_filter` | Drive the graph view from a conversation |
| `draft_message` | Compose an outreach or follow-up message for user approval |
| `track_reply` | Mark a message sent/replied and update relationship-health state |

`set_filter` is what makes the in-app assistant feel alive: the model doesn't describe a filter, it applies one.

**Out of scope, explicitly:** any tool that logs into LinkedIn, scrapes profiles, or sends a message without the user's own action. This is the line from Section 5, enforced at the tool-design level.

## 8. Technical architecture

Not starting from zero — the existing codebase (originally built under the name Bifur) already has Next.js 16, Supabase with auth and row-level security, a `contacts` table, a groups system, an import pipeline, and a dark design system well suited to a graph view.

What changes:

- A LinkedIn connection is a `contact` with `source = 'linkedin'`. Add columns for `profile_url`, `role_family`, `city`, `connected_on`.
- Groups become clusters — same table, mostly the same UI.
- The import action gets a second parser for the LinkedIn CSV format next to the existing Excel one.
- Edges are computed in the browser from attributes, held in memory — no edge table, no migration, no sync problem.
- New tables for message drafts, sent/reply status, and follow-up timing (the "relationship health" layer).
- A scheduler/background job checks for unreplied messages and triggers reminder notifications.

**Graph rendering:** `react-force-graph-2d` or `d3-force` on canvas handles up to a couple thousand nodes comfortably — enough for this use case; WebGL is unnecessary.

**Suggested stack:**
- Frontend: Next.js (already in place)
- Backend: the existing Supabase/Next.js service, extended with the scheduler
- Payments: Stripe (subscriptions)
- AI: LLM for role classification, message drafting, and the chat assistant

## 9. Business model

- **Subscription**: ~€5.99/month per user.
- Potential tiers later: free trial, premium (more contacts, richer analytics, priority AI), team plans.
- **Unit economics to work out**: LLM API cost per user/month, hosting, payment fees — keep comfortably under €5.99.

## 10. Go-to-market

- Lead with a concrete, relatable demo: the student-association follow-up.
- Target communities where networking matters: student associations, job-seeker groups, founder communities.
- Content angle: "Never let a good connection go cold."
- Free trial or freemium hook to lower the barrier.

## 11. Demo, 90 seconds (hackathon cut)

| Time | Screen |
| --- | --- |
| 0:00 | The LinkedIn connections page, scrolled fast. "800 people. Useless." |
| 0:10 | Upload the export CSV. The graph draws itself. |
| 0:25 | Clusters are visible and labelled. Zoom into one. |
| 0:40 | Filter to Cologne plus creative roles. The graph collapses to something readable. |
| 0:55 | Ask the assistant a real question. Watch it highlight the answer in the graph. |
| 1:10 | Ask it to draft a follow-up to someone who's gone quiet. Show the draft, not an auto-send. |
| 1:20 | One line on where this goes: same view, friends and family, one network. |

Seed the demo account the night before. Record a video backup.

## 12. Split of work

| Stream | Owns |
| --- | --- |
| **Data** | CSV parsing, normalization, dedupe, LLM enrichment pass, Supabase schema |
| **Graph** | Rendering, layout, clustering, filters, interaction, performance |
| **Assistant and MCP** | MCP server, chat panel, message drafting, tools that drive the view |
| **Demo** | Seed data, script, video backup, closing slide |

Agree the normalized person shape in the first hour so the graph stream can build against mock data immediately instead of waiting on the data stream.

## 13. Risks

| Risk | Mitigation |
| --- | --- |
| Export not requested in time | Everyone requests it today, before the hackathon |
| City data missing | Manual tagging for the demo set, honest "unknown" bucket otherwise |
| Graph is a hairball | Aggressive default filtering, cluster-level view first, drill down second |
| LLM enrichment is slow or wrong | Batch it once at import, cache it, allow manual correction |
| Judges/users ask about LinkedIn ToS | Answer ready: user-initiated export only, drafts only, user always sends — no scraping, no automation |
| Account safety for paying users | Human-in-the-loop by design (Section 5) — the product cannot get an account flagged, because it never acts on LinkedIn itself |
| Credential & data security | We never hold LinkedIn credentials or tokens since we never log in as the user; still need strong security and a clear privacy policy for message/contact data (GDPR) |
| AI message quality | Poorly worded or generic drafts could embarrass users; tone and personalization matter, and the user reviews every draft before sending |
| Cost control | LLM usage must stay profitable at €5.99/month |
| Scope creep into friends and family | Not this weekend |

## 14. Roadmap

**Phase 1 — Validation**
- [ ] Confirm the human-in-the-loop messaging model is acceptable to target users (does "draft, don't send" still deliver enough value?).
- [ ] Everyone requests their LinkedIn export.

**Phase 2 — MVP**
- [ ] CSV import, normalization, role-family enrichment.
- [ ] Graph view with clustering and filters.
- [ ] Chat assistant with `search_network`, `get_clusters`, `set_filter`.

**Phase 3 — Relationship layer**
- [ ] Message drafting + manual "mark as sent" + no-reply tracking.
- [ ] Follow-up reminders and timing suggestions.
- [ ] Connections/relationship-health dashboard.

**Phase 4 — Productize**
- [ ] Stripe subscription checkout.
- [ ] Onboarding wizard (purchase → connect → guided first run).
- [ ] Marketing landing page.

**Phase 5 — Launch & grow**
- [ ] Free trial, referral loop, community outreach.
- [ ] Analytics on relationship health, premium tier.

## 15. Success metrics

- Trial → paid conversion rate.
- Monthly churn.
- Drafts created + marked-sent + follow-ups completed per active user.
- Reply rate on assisted messages (self-reported by user).
- LLM/hosting cost per user vs. €5.99 revenue.

## 16. Open questions

1. ~~Do we keep the name Bifur, or is this a different product that deserves its own?~~ **Resolved 2026-09-21: the product is called Ori.** (The underlying codebase being reused was originally built under the name Bifur — that's a technical lineage note, not the product name.)
2. Is the assistant a panel inside the app, or does the whole thing run through an MCP client like Claude with the app as the view? The second is more unusual and might pitch better for a hackathon.
3. Do we show one person's network, or is there a version where two people compare networks? Interesting, probably too much for a first pass.
4. How much friction does "draft only, user sends" add in practice — does it need a browser extension or bookmarklet to make pasting-and-sending painless, or is copy/paste good enough for v1?

---

*Next: pick a product name, then decide whether to start with the graph/MVP build or the compliance and business-model validation.*
