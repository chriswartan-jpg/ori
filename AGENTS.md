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

### What Ori is
Three mindmaps of your own network — **Business**, **Freunde**, **Familie** — switchable, each
one a separate graph. A contact lives in exactly one network. You fill a network by hand or by
Excel/CSV import, and you log interactions per contact (called, met, wrote, e-mailed, noted)
so the app can show what has gone quiet.

This is a fresh build. The older CRM codebase the concept docs mention ("Bifur") is not in
this repo and was never available here — do not go looking for it.

An assistant that helps sort and maintain the network comes later, and so do MCP connections
to LinkedIn and other platforms that the user connects themselves. Neither is built now. The
layering below is what keeps both cheap to add.

**Ori never logs into LinkedIn, scrapes profiles, or sends a message on anyone's behalf.**
Future platform connections go through MCP servers the user connects, and any message stays a
draft the human sends. There is no send path and you do not build one.

`docs/ARCHITECTURE-TARGET.md` is a product target doc that proposes a LinkedIn
browser-automation MCP server and therefore contradicts the rule above and
`docs/PROJECT.md` Key Decisions. The MVP is built to `docs/ARCHITECTURE.md`. Resolving that
contradiction is an open team decision, tracked in `docs/TASKS.md`.

### Stack
- Language and version: TypeScript 5
- Framework(s): Next.js 16 (App Router, no `src/`), React 19, Tailwind CSS 4, Supabase (Postgres, Auth, RLS)
- Package manager: npm
- Runtime / deployment target: Node 24 locally; Vercel + hosted Supabase later. Nothing is deployed yet.

### Commands
- Install: `npm install`
- Local database: `supabase start` (needs OrbStack running), `supabase db reset` to replay migrations + seed
- Build: `npm run build`
- Test (all): `npm run check` — asserts in `lib/core/__checks__/run.ts`, no test framework
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`
- Run locally: `npm run dev` → http://localhost:3000

Local Supabase: API `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`, Mailpit
(catches auth mails) `http://127.0.0.1:54324`. Seeded demo login: `demo@ori.local` / `demo12345`.

### Layout
```
app/              pages and layout. No app/api/ yet — the assistant comes later
components/       React components; there is no components/ui/ and no shadcn in this project
lib/core/         ALL business logic, framework-free (imports nothing from next/*)
lib/actions/      Server Actions — thin adapters only
lib/supabase/     client / server / service-role factories
supabase/         migrations, seed.sql, config.toml
docs/             ARCHITECTURE.md, BUILD_PLAN.md, LOCAL_SETUP.md, PROJECT.md, PLAN.md, TASKS.md
proxy.ts          Next.js 16 middleware successor: session refresh + /dashboard gate
```

### Layering — the rule that keeps the codebase from splitting in two
All business logic lives in `lib/core/`. Server Actions and route handlers are thin adapters
that resolve auth and call into core.

```
UI ──► lib/actions/*.ts  (Server Actions) ──► lib/core/ ──► Supabase

Later, an assistant route handler and an MCP endpoint become a second and third adapter over
the same core, not a second copy of the logic.
```

An adapter contains auth context, argument validation, one call into core, `revalidatePath`.
Nothing else. A `.from('contacts')` query inside `lib/actions/` belongs in `lib/core/`.
There is no `app/api/` directory yet; do not add one without asking.

### Graph model — read this before writing any graph code
Do **not** connect people to people. 200 contacts sharing a city is 19,900 edges on its own.

Use a **bipartite graph**: nodes are either a person or an attribute (company, role, city,
relation, tag). Every person links only to their own attribute nodes. The force layout then
produces the clusters we want with attribute nodes as visible hubs. The same code serves all
three networks — Business fills company and role, Familie fills relation — so there is no
per-network branch.

Consequence: **there is no edge table.** Edges are derived deterministically from contact
attributes, in the browser, at render time. Nothing to store, sync or invalidate.

"Last contacted" is likewise not a column: it is `max(occurred_on)` over `interactions`,
computed in `lib/core/read.ts`.

### Design system
Defined in `app/globals.css`. Do not invent new colors.

```
--background       #050505
--card             #0A0A0A
--secondary        #111111
--muted            #171717
--border           #232323
--foreground       #F2F2F2
--muted-foreground #7A7A7A
```

Semantic, used sparingly and only for meaning: `#22C55E` green (confidence, verified),
`#EAB308` amber (caution, medium), `#D92D20` red (alert, high, destructive).

- Inter for headlines and body, JetBrains Mono for labels, badges, timestamps, counts.
- Labels are uppercase mono, 11px, letter-spacing 0.1em — the `.label-mono` class.
- Panels use `.panel`: 1px borders, `border-radius: 0.375rem`, flat, no shadows, no blur, no gradients.
- Generous negative space. Depth comes from layering and borders, never from shadow.
- Motion is restrained: border-color and opacity transitions around 0.15s. Nothing bouncy.

The feeling is a command center or intelligence terminal: dark, precise, technical, a little
classified. Not a consumer app, not a startup landing page.

UI copy is German. Code, comments, commit messages and these docs are English.

### Simplicity is the requirement, not a preference
- No job queue, no Redis, no caching layer, no state management library.
- No new dependencies unless there is no reasonable alternative. The stack is fixed.
- No edge table in the database. See "Graph model".
- No tests beyond what is needed to trust the import, the graph build and the filter math.
- If a task starts growing a second abstraction layer, stop and ask.

### Ownership (see docs/BUILD_PLAN.md "Coordination")
- Only db-agent writes `supabase/migrations/`. If another agent needs a column, it asks.
- Only core-agent writes inside `lib/core/`.
- ui-agent never queries Supabase directly. It calls Server Actions.
- Shared types live in `lib/core/types.ts` and change by agreement, not unilaterally.

### Forbidden
- Never build any feature that logs into LinkedIn, scrapes LinkedIn profiles, or sends a
  LinkedIn message without the user manually doing it themselves. This looks like a
  reasonable automation shortcut but violates LinkedIn's ToS and risks getting users'
  accounts banned — see the Key Decisions table in `docs/PROJECT.md`.

## 11. Project Learnings
Accumulated corrections. This section is for the agent to maintain, not just the human.

When the user corrects your approach, append a one-line rule here before ending the session. Write it concretely ("Always use X for Y"), never abstractly ("be careful with Y"). If an existing line already covers the correction, tighten it instead of adding a new one. Remove lines when the underlying issue goes away (model upgrades, refactors, process changes).

- The docs say Ori extends an existing CRM codebase ("Bifur"). That codebase is not in this repo and was not available on the machine the MVP was built on — the app here is greenfield Next.js 16. Do not go looking for it.
- Next.js 16 renamed `middleware.ts` to `proxy.ts`. The session refresh and the `/dashboard` gate live in `proxy.ts` at the repo root.
- There is no shadcn and no `components/ui/` in this project. The design system is hand-rolled CSS tokens in `app/globals.css`; write plain components against `.panel` and `.label-mono`.

## 12. How this file was built
This boilerplate synthesizes:
- Sean Donahoe's IJFW ("It Just F*cking Works") principles: one install, working code, no ceremony.
- Andrej Karpathy's observations on LLM coding pitfalls (the four principles: think-first, simplicity, surgical changes, goal-driven execution).
- Boris Cherny's public Claude Code workflow (reactive pruning, keep it ~100 lines, only rules that fix real mistakes).
- Anthropic's official Claude Code best practices (explore-plan-code-commit, verification loops, context as the scarce resource).
- Community anti-sycophancy patterns (explicit banned phrases, direct-not-diplomatic).
- The AGENTS.md open standard (cross-tool portability via symlinks).

Read once. Edit sections 10 and 11 for your project. Prune the rest over time. This file gets better the more you use it.
