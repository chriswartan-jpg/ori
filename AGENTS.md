# AGENTS.md
Drop-in operating instructions for coding agents. Read this file before every task.

Working code only. Finish the job. Plausibility is not correctness.

This file follows the AGENTS.md open standard (Linux Foundation / Agentic AI Foundation). Claude Code, Codex, Cursor, Windsurf, Copilot, Aider, Devin, Amp read it natively. For tools that look elsewhere, symlink:

ln -s AGENTS.md CLAUDE.md
ln -s AGENTS.md GEMINI.md

## 0. Non-negotiables
These rules override everything else in this file when in conflict:

- No flattery, no filler. Skip openers like "Great question", "You're absolutely right", "Excellent idea", "I'd be happy to". Start with the answer or the action.
- Disagree when you disagree. If the user's premise is wrong, say so before doing the work. Agreeing with false premises to be polite is the single worst failure mode in coding agents.
- Never fabricate. Not file paths, not commit hashes, not API names, not test results, not library functions. If you don't know, read the file, run the command, or say "I don't know, let me check."
- Stop when confused. If the task has two plausible interpretations, ask. Do not pick silently and proceed.
- Touch only what you must. Every changed line must trace directly to the user's request. No drive-by refactors, reformatting, or "while I was in there" cleanups.

## 1. Before writing code
Goal: understand the problem and the codebase before producing a diff.

- State your plan in one or two sentences before editing. For anything non-trivial, produce a numbered list of steps with a verification check for each.
- Read the files you will touch. Read the files that call the files you will touch. Claude Code: use subagents for exploration so the main context stays clean.
- Match existing patterns in the codebase. If the project uses pattern X, use pattern X, even if you'd do it differently in a greenfield repo.
- Surface assumptions out loud: "I'm assuming you want X, Y, Z. If that's wrong, say so." Do not bury assumptions inside the implementation.
- If two approaches exist, present both with tradeoffs. Do not pick one silently. Exception: trivial tasks (typo, rename, log line) where the diff fits in one sentence.

## 2. Writing code: simplicity first
Goal: the minimum code that solves the stated problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code. No configurability, flexibility, or hooks that were not requested.
- No error handling for impossible scenarios. Handle the failures that can actually happen.
- If the solution runs 200 lines and could be 50, rewrite it before showing it.
- If you find yourself adding "for future extensibility", stop. Future extensibility is a future decision.
- Bias toward deleting code over adding code. Shipping less is almost always better.

The test: would a senior engineer reading the diff call this overcomplicated? If yes, simplify.

## 3. Surgical changes
Goal: clean, reviewable diffs. Change only what the request requires.

- Do not "improve" adjacent code, comments, formatting, or imports that are not part of the task.
- Do not refactor code that works just because you are in the file.
- Do not delete pre-existing dead code unless asked. If you notice it, mention it in the summary.
- Do clean up orphans created by your own changes (unused imports, variables, functions your edit made obsolete).
- Match the project's existing style exactly: indentation, quotes, naming, file layout.

The test: every changed line traces directly to the user's request. If a line fails that test, revert it.

## 4. Goal-driven execution
Goal: define success as something you can verify, then loop until verified.

Rewrite vague asks into verifiable goals before starting:
- "Add validation" becomes "Write tests for invalid inputs (empty, malformed, oversized), then make them pass."
- "Fix the bug" becomes "Write a failing test that reproduces the reported symptom, then make it pass."
- "Refactor X" becomes "Ensure the existing test suite passes before and after, and no public API changes."
- "Make it faster" becomes "Benchmark the current hot path, identify the bottleneck with profiling, change it, show the benchmark is faster."

For every task:
- State the success criteria before writing code.
- Write the verification (test, script, benchmark, screenshot diff) where practical.
- Run the verification. Read the output. Do not claim success without checking.
- If the verification fails, fix the cause, not the test.

## 5. Tool use and verification
- Prefer running the code to guessing about the code. If a test suite exists, run it. If a linter exists, run it. If a type checker exists, run it.
- Never report "done" based on a plausible-looking diff alone. Plausibility is not correctness.
- When debugging, address root causes, not symptoms. Suppressing the error is not fixing the error.
- For UI changes, verify visually: screenshot before, screenshot after, describe the diff.
- Use CLI tools (gh, aws, gcloud, kubectl) when they exist. They are more context-efficient than reading docs or hitting APIs unauthenticated.
- When reading logs, errors, or stack traces, read the whole thing. Half-read traces produce wrong fixes.

## 6. Session hygiene
- Context is the constraint. Long sessions with accumulated failed attempts perform worse than fresh sessions with a better prompt.
- After two failed corrections on the same issue, stop. Summarize what you learned and ask the user to reset the session with a sharper prompt.
- Use subagents (Claude Code: "use subagents to investigate X") for exploration tasks that would otherwise pollute the main context with dozens of file reads.
- When committing, write descriptive commit messages (subject under 72 chars, body explains the why). No "update file" or "fix bug" commits. No "Co-Authored-By: Claude" attribution unless the project explicitly wants it.

## 7. Communication style
- Direct, not diplomatic. "This won't scale because X" beats "That's an interesting approach, but have you considered...".
- Concise by default. Two or three short paragraphs unless the user asks for depth. No padding, no restating the question, no ceremonial closings.
- When a question has a clear answer, give it. When it does not, say so and give your best read on the tradeoffs.
- Celebrate only what matters: shipping, solving genuinely hard problems, metrics that moved. Not feature ideas, not scope creep, not "wouldn't it be cool if".
- No excessive bullet points, no unprompted headers, no emoji. Prose is usually clearer than structure for short answers.

## 8. When to ask, when to proceed
Ask before proceeding when:
- The request has two plausible interpretations and the choice materially affects the output.
- The change touches something you've been told is load-bearing, versioned, or has a migration path.
- You need a credential, a secret, or a production resource you don't have access to.
- The user's stated goal and the literal request appear to conflict.

Proceed without asking when:
- The task is trivial and reversible (typo, rename a local variable, add a log line).
- The ambiguity can be resolved by reading the code or running a command.
- The user has already answered the question once in this session.

## 9. Self-improvement loop
This file is living. Keep it short by keeping it honest.

After every session where the agent did something wrong:
- Ask: was the mistake because this file lacks a rule, or because the agent ignored a rule?
- If lacking: add the rule under "Project Learnings" below, written as concretely as possible ("Always use X for Y" not "be careful with Y").
- If ignored: the rule may be too long, too vague, or buried. Tighten it or move it up.
- Every few weeks, prune. For each line, ask: "Would removing this cause the agent to make a mistake?" If no, delete. Bloated AGENTS.md files get ignored wholesale.

Boris Cherny (creator of Claude Code) keeps his team's file around 100 lines. Under 300 is a good ceiling. Over 500 and you are fighting your own config.

## 10. Project context

### THIS IS A HACKATHON BUILD — READ BEFORE EVERY TASK
Ori is being built for an **SBE business hackathon**. That changes what "good" means here,
and it applies to every prompt, not just the ones that mention it:

- **Judge every change against a specific problem it solves.** Before building, name the
  pain in one sentence ("a salesperson cannot see which accounts have gone cold"). If a
  change does not trace to a nameable problem, it does not earn its place in the demo.
- **The demo is the deliverable.** Something that is visible and legible in two minutes
  beats something technically superior that shows nothing. Empty states, seeded data and
  first-paint legibility are features, not polish.
- **The customer is no longer only the solo operator.** The original brief was one
  businessman with a lot of contacts. We are deliberately widening towards something a
  **company or team** would adopt — shared accounts, handover when someone leaves, who
  owns which relationship, which accounts are going cold. Pivoting in that direction is
  encouraged; say so when a change opens or closes that door.
- **Ask questions.** When a request could serve either the solo user or the team buyer,
  ask which. The positioning is still being decided and is worth a sentence of discussion.
- **Do not oversell.** No invented traction, no fake integrations, no UI that implies a
  capability that is not built. A demo that lies loses the room.

### What Ori is
**One mindmap of your whole network.** Contacts used to be split into three networks
(business / friends / family); they are now a single network called **Connections**,
because a colleague who became a friend is one person, not two rows. The graph clusters by
company, role, city, relation and tag, and every contact carries an interaction log
(called, met, wrote, e-mailed, noted) so the app can surface what has gone quiet.

You fill it by hand or by Excel/CSV import. There is no sign-up and no server.

This is a fresh build. The older CRM codebase the concept docs mention ("Bifur") is not in
this repo and was never available here — do not go looking for it.

**Ori never logs into LinkedIn, scrapes profiles, or sends a message on anyone's behalf.**
There is no send path and you do not build one.

`docs/ARCHITECTURE-TARGET.md` is an older product target doc that proposes LinkedIn
browser automation and therefore contradicts the rule above. The MVP is built to
`docs/ARCHITECTURE.md`.

### No backend. This is a deliberate constraint, not a gap
There is no database, no auth, no server actions and no API routes. The whole app runs in
the browser and persists to `localStorage`. Consequences you must respect:

- Data is **per browser, per device**. It is not shared, not backed up, and clearing site
  data deletes it. The UI says so; never imply otherwise.
- **Anything genuinely multi-user is not buildable as-is.** Crowdsourced or shared contact
  data can only be *represented* (a badge saying a field came from a crowdsourced source),
  never actually exchanged between people. Do not fake a network call.
- Adding a backend back is a product decision, not an implementation detail. Ask first.

### Stack
- Language and version: TypeScript 5
- Framework(s): Next.js 16 (App Router, no `src/`), React 19, Tailwind CSS 4
- State: one module store (`lib/store/`) read through `useSyncExternalStore`. No Redux,
  no Zustand, no context provider.
- Package manager: npm
- Runtime: Node 24+. Nothing is deployed.

### Commands
- Install: `npm install`
- Build: `npm run build` — must pass with zero type errors
- Test (all): `npm run check` — asserts in `lib/core/__checks__/run.ts`, no test framework
- Lint: `npm run lint` — must be clean; it catches real React mistakes (setState in an effect)
- Run locally: `npm run dev` → http://localhost:3000 (redirects to `/dashboard/connections`)

There is nothing to start first: no Docker, no Supabase CLI, no `.env`. `npm install &&
npm run dev` is the entire setup.

### Layout
```
app/              pages and layout (one dashboard route per network segment, plus import)
components/       React components; there is no components/ui/ and no shadcn here
lib/core/         ALL business logic, framework-free and pure (imports nothing from next/*)
lib/store/        the localStorage-backed store, the demo seed, and the React binding
docs/             ARCHITECTURE.md, BUILD_PLAN.md, PROJECT.md, PLAN.md, TASKS.md
```

### Layering — the rule that keeps the codebase from splitting in two
All business logic lives in `lib/core/`, and it is **pure**: every function takes a
`Dataset` and returns a value or a new `Dataset`. It never touches `localStorage`,
`window` or React.

```
UI ──► lib/store/ (state + persistence) ──► lib/core/ (pure logic) ──► Dataset
```

`lib/store/` is the only place that may touch `localStorage`. A component must not read or
write storage directly, and `lib/core/` must not know storage exists. This is what keeps
the logic testable without a browser — `npm run check` runs it all in Node.

### Graph model — read this before writing any graph code
Do **not** connect people to people. 125 contacts sharing a city is thousands of edges.

Use a **bipartite graph**: nodes are either a person or an attribute (company, role, city,
relation, tag). Every person links only to their own attribute nodes, and the force layout
turns attribute nodes into visible hubs.

Consequence: **there is no edge table.** Edges are derived deterministically from contact
attributes, in the browser, at render time. Nothing to store, sync or invalidate.

"Last contacted" is likewise not stored: it is `max(occurred_on)` over the interaction log,
computed in `lib/core/read.ts`.

**First paint must not be the whole graph.** 125 people plus their hubs is an unreadable
hairball — this was tried and rejected. The graph opens on clusters only and expands one
cluster at a time.

### Design system — "Signal"
Defined in `app/globals.css`: tokens in `:root`, exposed as utilities through `@theme
inline`. Both halves, every time — a token that is not mapped cannot be used as
`text-*`/`bg-*`/`border-*`. Do not invent new colors.

```
--background       #0A0A0B   page
--card             #121214   .panel fill
--secondary        #18181B   inputs, selected list row, hover fill
--muted            #202024   scrollbar, ::selection
--border           #33333A   hairline dividers and panel edges (decorative, ~1.5:1)
--border-strong    #64646E   boundary of anything operable: inputs, buttons, tags (≥ 3:1)
--foreground       #FFFFFF
--muted-foreground #9A9AA3   ≥ 6.3:1 on every surface
```

Semantic — meaning, never decoration:
- `--caution #FFB020` amber means exactly one thing: **this relationship has gone quiet**
  (`QUIET_AFTER_DAYS`), plus the crowdsourced warning. Never use it for focus, accents or
  primary buttons; the quiet signal must stay the brightest thing on the screen.
- `--alert #FF4D4D` destructive and errors. `--confidence #22C55E` verified.
- One hue per cluster dimension, used for hub rings and labels on the canvas and for the
  dots beside "Cluster by" in the rail — the two must match: `--hub-company #6EA8FE`,
  `--hub-role #C084FC`, `--hub-city #2DD4BF`, `--hub-relation #F472B6`, `--hub-tag #A3E635`.
- Canvas-only: `--graph-person #5B5B63` (a looked-after person is deliberately dim),
  `--graph-edge #22222A`, `--graph-edge-active #64646E` (edges of the selected person).

Type: Space Grotesk (`--font-space-grotesk`) for everything, 14px body, headings 22–28px
weight 600 letter-spacing -0.03em. JetBrains Mono for `.label-mono` (11px uppercase,
letter-spacing 0.08em), counts, dates and the `42d` counters. Headline numbers use `.stat`
(`<b>` at 20px/600 plus a mono caption); `.stat-quiet` turns it amber.

Shape and depth: `.panel` is `--card` with a 1px `--border` and 14px corners
(`--radius-panel`); inputs use 10px (`--radius-control`); buttons and tags are pills. Flat —
no shadow, no blur, no gradient in the DOM; depth comes from surface steps. The only
gradient anywhere is the radial halo behind a quiet node on the canvas.

Motion: colour and border 150ms ease; transform 180ms `cubic-bezier(.3,1.4,.5,1)`.
Focus is a 2px `--foreground` outline, offset 2px.

The canvas (`components/graph-canvas.tsx`) cannot be styled with CSS; it reads these tokens
once via `getComputedStyle` in `tokens()`. Person: 3.2px dim dot; quiet: 3.8px amber dot with
an 11px amber halo; selected: 4.5px white dot with a 1.5px white ring; hover: white. Hub:
`--background` fill with a 1.5px ring and an uppercase mono label in the dimension's hue.
Person labels draw when selected, hovered or above zoom 2.2.

Controls stay out of the way: filters live in the 200px side rail, the graph gets the space.
The feeling is a signal board: black, big numbers, one loud colour that means something.
Not a terminal, not a consumer app.

**All UI copy is English.** Code, comments, commit messages and these docs are English too.

### Simplicity is the requirement, not a preference
- No job queue, no Redis, no caching layer, no state management library.
- No new dependencies unless there is no reasonable alternative.
- No tests beyond what is needed to trust the import, the graph build, the filter math and
  the dataset layer that replaced the database.
- If a task starts growing a second abstraction layer, stop and ask.

### Forbidden
- Never build any feature that logs into LinkedIn, scrapes LinkedIn profiles, or sends a
  message on the user's behalf. This looks like a reasonable automation shortcut but
  violates the platform ToS and risks getting users' accounts banned — see the Key
  Decisions table in `docs/PROJECT.md`.
- Never present crowdsourced or third-party data as verified. It gets a visible caution.

## 11. Project Learnings
Accumulated corrections. This section is for the agent to maintain, not just the human.

When the user corrects your approach, append a one-line rule here before ending the session. Write it concretely ("Always use X for Y"), never abstractly ("be careful with Y"). If an existing line already covers the correction, tighten it instead of adding a new one. Remove lines when the underlying issue goes away (model upgrades, refactors, process changes).

- The docs say Ori extends an existing CRM codebase ("Bifur"). That codebase is not in this repo and was not available on the machine the MVP was built on — the app here is greenfield Next.js 16. Do not go looking for it.
- There is no shadcn and no `components/ui/` in this project. The design system is hand-rolled CSS tokens in `app/globals.css`; write plain components against `.panel` and `.label-mono`.
- The backend was removed on purpose (was Supabase + `proxy.ts` + `lib/actions/`). Do not reintroduce a database, auth or a server action without asking — see "No backend" in section 10.
- Never call `setState` synchronously inside a `useEffect` body; `npm run lint` fails on it. To read an external source like `localStorage` on mount, use `useSyncExternalStore` — `lib/store/use-store.ts` is the pattern.
- Bump the `KEY` suffix in `lib/store/storage.ts` whenever the stored shape changes incompatibly. The three-networks-to-one merge silently emptied every existing browser until the key went to v2.
- When generating seed data from a running index, check the moduli are coprime with the field cycles. Keying the quiet/active split on `i % 5` while the city list had 5 entries made "London" mean "never contacted" across the whole demo.
- Do not put UI copy in German. All user-facing text is English; the importer still accepts German spreadsheet *headers* on purpose, which is input tolerance, not UI language.

## 12. How this file was built
This boilerplate synthesizes:
- Sean Donahoe's IJFW ("It Just F*cking Works") principles: one install, working code, no ceremony.
- Andrej Karpathy's observations on LLM coding pitfalls (the four principles: think-first, simplicity, surgical changes, goal-driven execution).
- Boris Cherny's public Claude Code workflow (reactive pruning, keep it ~100 lines, only rules that fix real mistakes).
- Anthropic's official Claude Code best practices (explore-plan-code-commit, verification loops, context as the scarce resource).
- Community anti-sycophancy patterns (explicit banned phrases, direct-not-diplomatic).
- The AGENTS.md open standard (cross-tool portability via symlinks).

Read once. Edit sections 10 and 11 for your project. Prune the rest over time. This file gets better the more you use it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
