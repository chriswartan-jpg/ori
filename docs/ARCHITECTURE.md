# Architecture — the MVP as built

> Scope note: Ori is a fresh build. It does not extend the older CRM codebase the concept
> docs mention ("Bifur"); nothing of it is in this repo. `docs/ARCHITECTURE-TARGET.md` is a
> product target doc that contradicts this one — see `docs/TASKS.md`.

## 1. What the MVP does

Three mindmaps of your own network: **Business**, **Freunde**, **Familie**. You switch
between them, and each one is a separate graph. A contact lives in exactly one network.

You fill the network two ways: a contact form, or an Excel/CSV import. For each contact you
log interactions — called, met, wrote, e-mailed, noted — with a date. The graph shows the
clusters; the contact panel shows how long it has been quiet.

An assistant that helps sort and maintain the network comes later, and so do MCP connections
to LinkedIn and other platforms. Neither is built now. The layering in §4 is what keeps
both cheap to add.

## 2. Module map

```
lib/
  core/                     all business logic, framework-free
    types.ts                Network, Contact, Interaction, GraphContact, GraphNode, GraphFilter, daysSince
    contacts.ts             contact reads and writes
    interactions.ts         interaction log reads and writes
    read.ts                 getGraphData(supabase, userId, network) -> GraphContact[]
    import/
      parse-spreadsheet.ts  .xlsx / .csv -> ContactInput[] + per-row problems
      normalize.ts          company / name / url / phone cleanup
      ingest.ts             insert a batch, dedupe, return counts
    graph/
      build.ts              GraphContact[] -> { nodes, edges } bipartite
      filter.ts             pure visibility function over the graph
    __checks__/run.ts       assert-based checks for the parser, build and filter

  actions/                  Server Actions, thin adapters
  supabase/                 client / server / service-role factories

app/
  login/                    sign in, sign up
  dashboard/[network]/      the mindmap, filter bar, detail panel
  dashboard/[network]/import/   spreadsheet import
proxy.ts                    Next.js 16 middleware successor: session refresh + /dashboard gate
```

`lib/core/` imports nothing from `next/*`. That is what lets the same code serve a Server
Action today and a chat route or MCP endpoint later without being rewritten.

There is no `app/api/` directory yet. Add one only when the assistant arrives.

## 3. Schema

Two tables. No groups table, no clusters table, **no edge table** (see §6).

```sql
create type network as enum ('business', 'friends', 'family');
create type contact_source as enum ('manual', 'excel');
create type interaction_kind as enum ('call', 'message', 'meeting', 'email', 'note');

create table contacts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  network      network not null,
  first_name   text not null,
  last_name    text not null default '',
  email        text,
  phone        text,
  company      text,
  company_norm text,                       -- derived in core, used for clustering
  role         text,                       -- free-text job title
  city         text,
  relation     text,                       -- "Bruder", "Studium", "Kundin"
  tags         text[] not null default '{}',
  notes        text,
  profile_url  text,
  source       contact_source not null default 'manual',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Dedupe key for the importer. Only bites where an e-mail exists; the export often has none.
create unique index contacts_user_network_email_idx
  on contacts (user_id, network, lower(email))
  where email is not null;

create index contacts_user_network_idx on contacts (user_id, network);

create table interactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  contact_id  uuid not null references contacts on delete cascade,
  kind        interaction_kind not null,
  occurred_on date not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index interactions_contact_idx on interactions (contact_id, occurred_on desc);
```

RLS on both tables, `user_id = auth.uid()` for every operation. No table is readable across
users. `interactions.user_id` is denormalized on purpose: it makes the RLS policy a column
check instead of a subquery on every row.

**"Last contacted" is not a column.** It is `max(occurred_on)` per contact, computed in
`read.ts`. A denormalized column would need a trigger and could drift; the graph already
loads every contact of one network in one pass, so there is nothing to optimize yet.

## 4. Layering

```
UI ──► lib/actions/*.ts  (auth, Zod validation, one call into core, revalidatePath) ──► lib/core/ ──► Supabase
```

An adapter contains nothing else. A `.from('contacts')` query inside `lib/actions/` belongs
in `lib/core/`. When the assistant arrives it becomes a second adapter over the same core,
not a second copy of the logic.

## 5. Import pipeline

1. **Parse in the browser.** `read-excel-file` for `.xlsx`, Papaparse for `.csv`. The raw
   file never goes to the server, which sidesteps Server Action body limits and renders the
   preview instantly.
   *Why not SheetJS:* the `xlsx` package on npm is stuck at 0.18.5 with open advisories; the
   fixed build ships only from the vendor's own CDN. `read-excel-file` is maintained on npm.
2. **Map headers by alias**, German and English: `Vorname/First Name`, `Nachname/Last Name`,
   `E-Mail/Email`, `Telefon/Phone`, `Firma/Company`, `Rolle/Position/Titel`, `Stadt/Ort/City`,
   `Beziehung/Relation`, `Tags`, `Notizen/Notes`. Unknown columns are ignored, not an error.
3. If no name column is found, fail loudly and **name the headers that were found**. A silent
   empty import is the worst outcome here. A downloadable CSV template is offered for exactly
   this case, which is cheaper than a column-mapping UI.
4. Normalize to `ContactInput`, show a preview table with per-row problems, user confirms.
5. Send to the server in batches of 200 through a Server Action. Insert; skip rows whose
   e-mail already exists in that network. Report inserted / updated / skipped.

## 6. Graph building

`lib/core/graph/build.ts` turns one network's `GraphContact[]` into `{ nodes, edges }`.

Do **not** connect people to people. 200 contacts sharing a city is 19,900 edges on its own.

**Bipartite:** nodes are either a person or an attribute. Every person links only to their
own attribute nodes — company, role, city, relation, and one per tag. 800 people gives a few
thousand edges, and the force layout produces the clusters we want with attribute nodes as
visible hubs. The same code serves all three networks: Business fills company and role,
Familie fills relation, and nothing needs a per-network branch.

Consequence: **there is no edge table.** Edges are derived deterministically from contact
attributes, in the browser, at render time. Nothing to store, sync or invalidate.

Rules:
- One attribute node per distinct value. `null` produces no node — there is no "null" hub.
- Attribute nodes with a single member are dropped. A hub of one is noise.
- Companies are capped at the top 40 by member count, the tail buckets as "Other".
- People with no attribute at all stay as isolated nodes. They are still contacts you own.
- `build.ts` is pure and has no database access, so it is trivially testable. The checks live
  here and nowhere else.

Rendering uses `react-force-graph-2d` on canvas. Person nodes small and neutral, attribute
nodes larger and labelled, quiet contacts marked with the amber token.

`filter.ts` returns **visibility**, never a new graph: filters hide nodes so the layout stays
stable while the user explores. An attribute node is visible while at least one visible
person hangs on it.

## 7. Explicitly not built

No assistant, no chat route, no MCP server, no LinkedIn connection of any kind, no edge
table, no groups table, no job queue, no pagination, no Stripe, no theme toggle, no
denormalized "last contacted" column, no per-contact cadence target.

When the assistant arrives it gets a tool registry under `lib/core/tools/` and one route
handler, both reading the same core modules. Nothing in this document has to change for that.

## 8. The LinkedIn line

Ori never logs into LinkedIn, scrapes profiles, or sends a message on anyone's behalf. Future
platform connections go through MCP servers the **user** connects, and any message stays a
draft the human sends. This is a product rule, not an implementation detail.
