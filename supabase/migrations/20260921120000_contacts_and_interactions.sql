-- Ori MVP schema. See docs/ARCHITECTURE.md §3.
--
-- Two tables, on purpose:
--   * no edge table    - graph edges are derived from contact attributes at render time (§6)
--   * no groups table  - attribute nodes are the clusters
--   * no contacts.last_contact_at - it is max(occurred_on) over interactions, read in
--     lib/core/read.ts. A denormalized column would need a trigger and could drift.

create type public.network as enum ('business', 'friends', 'family');
create type public.contact_source as enum ('manual', 'excel');
create type public.interaction_kind as enum ('call', 'message', 'meeting', 'email', 'note');

create table public.contacts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  network      public.network not null,
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
  source       public.contact_source not null default 'manual',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Dedupe key for the importer. Only bites where an e-mail exists; exports often have none.
create unique index contacts_user_network_email_idx
  on public.contacts (user_id, network, lower(email))
  where email is not null;

create index contacts_user_network_idx on public.contacts (user_id, network);

create table public.interactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  contact_id  uuid not null references public.contacts on delete cascade,
  kind        public.interaction_kind not null,
  occurred_on date not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index interactions_contact_idx on public.interactions (contact_id, occurred_on desc);

-- RLS -------------------------------------------------------------------------
-- interactions.user_id is denormalized on purpose: the policy stays a column check
-- instead of a subquery on contacts for every row.

alter table public.contacts enable row level security;
alter table public.interactions enable row level security;

create policy contacts_select on public.contacts
  for select to authenticated using (user_id = (select auth.uid()));
create policy contacts_insert on public.contacts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy contacts_update on public.contacts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy contacts_delete on public.contacts
  for delete to authenticated using (user_id = (select auth.uid()));

create policy interactions_select on public.interactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy interactions_insert on public.interactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy interactions_update on public.interactions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy interactions_delete on public.interactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Data API grants. New tables are not auto-exposed (see config.toml auto_expose_new_tables),
-- so without these PostgREST answers "permission denied" instead of applying RLS.
-- anon gets select only: RLS then returns zero rows to a request without a user JWT.
grant select, insert, update, delete on public.contacts, public.interactions to authenticated;
grant select on public.contacts, public.interactions to anon;
grant all on public.contacts, public.interactions to service_role;
