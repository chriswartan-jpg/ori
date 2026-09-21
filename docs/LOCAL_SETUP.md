# Local setup (OrbStack + Supabase)

Everything runs locally. No cloud Supabase project is needed to build, and none should be created until the app works end to end on the machine.

## 1. OrbStack

OrbStack provides the Docker runtime. It is lighter and faster than Docker Desktop on macOS and sets itself as the default Docker context on install.

```bash
brew install --cask orbstack
open -a OrbStack
docker info | head -5          # must succeed before continuing
docker context ls              # 'orbstack' should be marked as current
```

If `docker info` fails, nothing below will work. Fix that first.

## 2. Supabase CLI

```bash
brew install supabase/tap/supabase
supabase --version
```

From the repo root:

```bash
supabase init        # creates supabase/ with config.toml
supabase start       # pulls and starts the local stack in Docker
```

First start pulls several images and takes a few minutes. Afterwards it is seconds.

`supabase start` prints the local credentials. The ones that matter:

| Service | Address |
| --- | --- |
| API | http://127.0.0.1:54321 |
| Studio (DB UI) | http://127.0.0.1:54323 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Inbucket (catches auth emails) | http://127.0.0.1:54324 |

Put the printed API URL and anon key into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<printed by supabase start>
SUPABASE_SERVICE_ROLE_KEY=<printed by supabase start>
```

`.env.local` stays in `.gitignore`. It already is.

Useful commands:

```bash
supabase stop            # stop the stack, keeps data
supabase db reset        # wipe and replay all migrations + seed
supabase status          # show credentials again
```

## 3. Migrations

Never change the database through Studio and leave it there. Every schema change is a migration file, so `supabase db reset` reproduces the whole database from scratch.

```bash
supabase migration new add_linkedin_fields
# edit supabase/migrations/<timestamp>_add_linkedin_fields.sql
supabase db reset
```

There is no hosted project to pull from — every table in this repo was written as a migration from the start. The schema is two tables, `contacts` and `interactions`; see `docs/ARCHITECTURE.md` §3.

## 4. Seed data

`supabase/seed.sql` runs automatically on `supabase db reset`. It creates one test user (`demo@ori.local` / `demo12345`) and contacts across all three networks: roughly 90 business, 35 friends, 15 family, plus a few hundred interactions.

Those sizes are deliberate. Enough for the graph to look real, small enough that every iteration is instant. Do not seed 800.

Interaction dates are relative to `current_date`, and some contacts deliberately have no interaction at all or none for over 90 days — otherwise the "stille Kontakte" filter has nothing to show.

Never seed with real contact data. Generate plausible fake names and companies.

## 5. Running the app

```bash
npm install
npm run dev        # http://localhost:3000
```

Log in with the seeded demo user, or sign up for a fresh account.

Sign up through the app. The confirmation email lands in Inbucket at :54324, not in a real inbox.

## 6. Checks before saying a phase is done

```bash
npm run build      # must pass with zero type errors
npm run check      # asserts for the parser, the graph build and the filter
supabase db reset  # must replay cleanly from an empty database
```

## 7. Deployment

Not during the build phase. When the app works locally, create a hosted Supabase project, run the same migrations against it with `supabase db push`, and point Vercel at it. Do not develop against the hosted database.

Note for macOS: if `git` or `python3` refuse to run with an Xcode licence error, accept it once with `sudo xcodebuild -license`. The Command Line Tools binaries under `/Library/Developer/CommandLineTools/usr/bin/` work without it.
