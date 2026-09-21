# Redefine Ori's visual language

You are redesigning the entire visual language of Ori. This is a visual-only mandate: the
product, the routes, the data model and the business logic stay as they are. Every pixel is
in scope; every behaviour is not.

## 1. Read before you write anything

- `AGENTS.md` — the operating rules for this repo. Sections 0–9 bind you. Section 10
  "Design system" does **not** — see §4 below.
- `app/globals.css` — the current token set, 116 lines, the whole design system.
- `components/primitives.tsx` — `BTN`, `BTN_QUIET`, `BTN_DANGER`, `INPUT`, `Field`,
  `TextField`, `Notice`. Almost every surface in the app is built from these seven exports.
- `components/graph-canvas.tsx` — the mindmap. Canvas 2D, not DOM. Read it fully.
- `docs/PROJECT.md` — what the product is and who it is for.

Then run `npm install && npm run dev`, press **Reset demo data**, and click through every
route and state in §3 before forming an opinion. There is nothing else to start: no Docker,
no database, no `.env`.

## 2. What this is being judged on

Ori is being built for an SBE business hackathon, and that changes what "good" means:

- **The demo is the deliverable.** Something legible in two minutes beats something
  technically superior that shows nothing. First-paint legibility, empty states and the
  seeded demo network are features, not polish.
- **Every visual decision must trace to a problem it solves.** "A user cannot see which
  relationships have gone cold" is a problem. "It looks more modern" is not.
- **The buyer may be a team, not just a solo operator.** The product is widening towards
  something a company would adopt — who owns which relationship, what happens at handover,
  which accounts are going quiet. If a design choice opens or closes that door, say so.
- **Do not oversell.** No UI that implies a capability that is not built: no sync badge, no
  team avatars, no "connected to LinkedIn", no invented counts. A demo that lies loses the
  room.
- **There is no backend.** Everything lives in `localStorage`, per browser, per device. The
  UI must never imply the data is shared, synced or backed up. `Reset demo data` and
  `Delete all` in the header are real, load-bearing demo controls — design them as such.

## 3. The complete surface you own

There is **one** network, called **Connections** (`NETWORKS = ["connections"]` in
`lib/core/types.ts`). The three-network era is over; if you find copy or UI that still
implies business/friends/family, it is a bug.

Routes:

| Route | Renders |
|---|---|
| `/` | redirect to `/dashboard/connections` |
| `/dashboard` | redirect |
| `/dashboard/[network]` | `network-screen` → `network-view` → filter bar, graph/list tabs, detail panel |
| `/dashboard/[network]/import` | page shell → `import-wizard` |

Components: `network-screen`, `network-switcher`, `network-view`, `filter-bar`,
`graph-canvas`, `contact-list`, `contact-panel`, `contact-form`, `import-wizard`,
`primitives`. Plus `app/layout.tsx` (fonts, `<body>`), `app/globals.css`, and the page shell
in `app/dashboard/[network]/import/page.tsx`.

`components/network-switcher.tsx` now renders a one-item nav — a tab group with a single tab.
It is a leftover of the pivot and it looks like one. Decide what the header should be instead
(product mark, contact count, quiet count, demo controls) and rebuild it.

States you must design, not just the happy path:

- **Dashboard**: first-paint loading ("Loading your network …"); storage-error notice in the
  header; empty network (the `EMPTY_HINT` copy); populated graph tab; populated list tab;
  filters active vs. none; the "0 of 125 visible" dead end.
- **Detail panel**: nothing selected (the explainer text); contact selected with full details;
  contact with no e-mail/phone/notes; interaction log empty; interaction log with entries;
  inline error after a failed write.
- **Contact form**: new vs. edit, validation error.
- **Import wizard**: step 1 idle; parsing; parse error; preview table with remarks; preview
  truncated at 20 rows; step 3 success summary.
- **Every one of the above at 390px wide.** The `lg:` breakpoint is currently the only thing
  between the two-column dashboard and a phone.

## 4. You are allowed to break the current design system

`AGENTS.md` §10 "Design system" freezes the palette, the fonts, the `.panel` treatment and the
"no shadow, no gradient" rule. That section is the thing you are here to replace. Treat it as
a starting point you are overriding, not as law.

In exchange, one requirement: **in the same change, rewrite `AGENTS.md` §10 to describe the
system you built**, and update the `components/ui` line in §11 "Project Learnings" if it stops
being true. Otherwise the next agent to touch this repo will quietly undo your work.

The intent it currently encodes — *"a command center or intelligence terminal: dark, precise,
technical, a little classified"* — is an input, not a constraint. Argue with it if you have a
better answer for what an app about your own relationships, shown to a hackathon audience,
should feel like.

## 5. Hard constraints

1. **Do not touch `lib/core/` or `lib/store/`.** No business logic, no types, no graph
   building, no filter math, no persistence. `npm run check` failing means you went too far.
   If a visual idea needs a new field, stop and say so.
2. **Component boundaries and props stay.** Same files, same exports, same prop signatures.
   You are reskinning, not re-architecting. Splitting a component's internals is fine;
   changing what `network-view` hands `graph-canvas` is not.
3. **No new dependencies.** No icon library, no animation library, no shadcn, no CSS-in-JS.
   Tailwind 4 plus hand-written CSS in `globals.css` is the toolkit. `react-force-graph-2d`
   stays.
4. **All UI copy is English.** Rewrite a label only where the design genuinely requires it,
   and list every string you changed. (The importer accepts German spreadsheet *headers* on
   purpose — that is input tolerance, not UI language. Leave it.)
5. **Keep every accessibility affordance.** `aria-pressed` on the tabs and list rows,
   `aria-current` in the nav, `role="alert"` on error notices, the `<label>` wrapper in
   `Field`, a visible `:focus-visible` ring, and the list tab as the keyboard-operable equal
   of the canvas. Verify contrast: body text ≥ 4.5:1, large text and UI borders ≥ 3:1.
6. **Dark stays.** No light theme, no theme toggle.
7. **Layout may change; information architecture may not.** Re-lay-out within a route freely —
   where filters live, how the panel docks, what the header says. The routes, the single
   network and the graph/list split stay.
8. **Never call `setState` synchronously inside a `useEffect` body** — `npm run lint` fails on
   it, and it is the mistake most likely to bite you in `graph-canvas.tsx`.

## 6. Traps specific to this codebase

- **Tailwind 4 has no config file.** Tokens are declared in `:root` and exposed as utilities
  through the `@theme inline` block in `globals.css`. A token that is not mapped there cannot
  be used as `text-*`/`bg-*`/`border-*`. Both halves, every time.
- **`* { border-color: var(--border) }`** in `globals.css` silently gives every element a
  default border colour. Know that before you change `--border`.
- **The canvas cannot be styled with CSS.** `graph-canvas.tsx` reads the tokens once via
  `getComputedStyle(document.documentElement)` and caches them in a module-level `palette`.
  Every new token the canvas needs must be added to `tokens()`. A canvas font string cannot
  contain `var()` — that is why the font family names are read out of the CSS variables.
- **Do not rebuild `graphData`.** Filtering works by `nodeVisibility`/`linkVisibility` over a
  stable node array; handing the force layout new objects restarts the simulation and makes
  the map jump on every keystroke. See the comments atop `graph-canvas.tsx` and
  `network-view.tsx`.
- **`zoomToFit` fires once on `onEngineStop`.** If you change node sizes or padding, re-check
  the fit against the full seeded set.
- **Label legibility is zoom-dependent**: person labels only draw when selected or when
  `scale > 2.2`. That threshold is a design decision you now own.
- **Amber means something.** The ring around a quiet node, the amber "last contact" line and
  the amber `{days}d` in the list all encode `QUIET_AFTER_DAYS = 90`. Whatever the new palette
  is, "this relationship has gone quiet" must stay readable at a glance — it is the single
  thing the product exists to show. Same for the red destructive affordance.
- There is a stray `console.log` at `components/graph-canvas.tsx:187`. It is in your files;
  remove it.

## 7. The graph is the demo

The mindmap is the one screen the room will remember — give it the most attention, not the
least. Today it renders the full bipartite graph: people as small filled dots, attribute hubs
as larger stroked circles, hairline edges, labels drawn above the node.

Design all of it: node shape and size scale, the person-vs-hub distinction, edge weight and
colour, label typography and its zoom threshold, hover, selection, and the quiet signal.

**Explicitly out of scope.** `AGENTS.md` says first paint should open on clusters and expand
one at a time, and `lib/core/graph/clusters.ts` computes that overview. It is not wired into
the UI, and someone else is working on it right now — do not design it, do not build it, do
not wire it in. Restyle the graph as it renders today, and keep the visual language you
establish additive, so the cluster overview can adopt it when it lands.

## 8. Process — do not skip step 1

**Step 0 — Recon.** Read §1, run the app, screenshot every surface in §3 at 1440×900 and
390×844. These are your before shots.

**Step 1 — Three directions, then stop.** Before writing a line of production code, present
three distinct visual directions. For each: one paragraph of intent, the full token table
(background/surface/border/text/accent/semantic, with hex), the type pairing and scale, the
radius/border/elevation rule, the motion rule, and a rendered mock of *one* screen — the
populated dashboard — so the three can be compared honestly. Make them genuinely different,
not one idea at three saturations. Say which you would ship and why.

This is a hackathon: keep step 1 tight enough to decide in minutes. **Then stop and wait for a
decision.** Do not proceed on your own judgement.

**Step 2 — Tokens.** Rewrite `app/globals.css`: `:root` tokens, the `@theme inline` map, base
element styles, shared classes. New fonts go through `next/font` in `app/layout.tsx`, never a
`<link>`.

**Step 3 — Primitives and chrome.** `components/primitives.tsx`, then `network-screen` and
whatever replaces `network-switcher`. Getting the seven primitives right moves most of the app
at once.

**Step 4 — Screens.** `network-view`, `filter-bar`, `contact-list`, `contact-panel`,
`contact-form`, `import-wizard`, the import page shell. Every state in §3, including 390px.

**Step 5 — The mindmap.** `graph-canvas.tsx`, per §7.

**Step 6 — Docs and verification.** Rewrite `AGENTS.md` §10 per §4, then run §9.

## 9. Definition of done

All four must pass, with output shown, not asserted:

```
npm run lint
npx tsc --noEmit
npm run build      # zero type errors
npm run check      # core asserts — if these fail you touched lib/core
```

Plus visual verification, which is the actual deliverable:

- Before/after screenshots at **1440×900** and **390×844** for every surface and state in §3.
- The graph at three zoom levels, with a node selected, on hover, and with the quiet filter
  on.
- A contrast check on the new palette for body text, muted text, borders and each semantic
  colour.

Do not report done on a plausible-looking diff. `AGENTS.md` §5 applies: run it, look at it,
show it.

## 10. How to report

Per step: what changed, what it looks like (screenshot), what you decided and why, and
anything you found that contradicts this brief. `AGENTS.md` §0 applies — if part of this is
wrong, say so before building it, not after.
