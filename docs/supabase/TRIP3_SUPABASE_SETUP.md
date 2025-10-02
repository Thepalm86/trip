### Trip3 Supabase Setup — Fresh Project Blueprint

This guide explains how to stand up a brand‑new Supabase project so Trip3 works exactly like it does today. It covers required extensions, tables, RPC functions, Row Level Security (RLS), environment configuration, and verification steps.

The app code assumes client-side access via `lib/supabase/client.ts` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-side access via `lib/server/supabase-admin.ts` with `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

---

## TL;DR checklist

- Enable extensions: PostGIS, Vector, pgcrypto, uuid-ossp, pg_trgm
- Create the schema (tables listed below) or import it from the current project
- Add/verify RPC functions: `increment_destination_view_count`, `get_content_quality_stats`, `cleanup_expired_destination_content`
- Apply RLS policies for user-scoped data tables
- Configure Auth (email sign-in, redirect URLs)
- Add environment variables locally and in deployment
- Run verification queries to confirm RLS and RPCs work

---

## 1) Required Supabase extensions

Run in SQL Editor (or migrations):

```sql
create extension if not exists postgis;
create extension if not exists vector;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;
```

Why:
- PostGIS: geography points/boundaries used by `countries`, `zones`, `regions`, `destinations`, `pois`
- Vector: `content_embeddings.embedding`
- pgcrypto/uuid-ossp: `gen_random_uuid()` defaults
- pg_trgm: fuzzy-search/trigram indexes where needed

---

## 2) Schema overview (tables the app uses)

Trip planning core (user-owned data):
- `users` (app-level mirror; not the `auth.users` system table)
- `profiles`
- `user_trips`
- `trip_days`
- `trip_destinations`
- `trip_destination_pois`
- `trip_destination_destinations`
- `trip_analytics`
- `user_trip_preferences`
- `explore_places`

Content and caching (server-managed, read-heavy):
- `destination_modal_content`
- `destination_images`
- `export_history`
- `content_embeddings`

Exploration data (discovery/AI features):
- `countries`, `zones`, `regions`, `destinations`, `pois`, `routes`, `country_discovery_data`, `enhanced_zone_content`, `destination_content`, `ai_content_cache`, `user_interactions`, `map_views`, `global_content`, plus optional `journeys` suite (`journeys`, `journey_*` tables) if you use the journeys UI/content.

Note: The current project includes all of the above. If you want a minimal Trip3 core, you can start with only the “Trip planning core” and “Content and caching”.

---

## 3) Two ways to create the schema

### Option A — Recommended: Export from current project and import into the new one

1. Install the Supabase CLI and authenticate.
2. Export schema only (no data) from the current project:
   - Use the Dashboard SQL export or CLI dump. With CLI: `supabase db dump --schema public --data false --file schema.sql`
3. Inspect and prune tables you don’t want to carry over.
4. Apply the curated `schema.sql` to the new project via SQL Editor or CLI: `supabase db restore --file schema.sql`
5. (Optional) Export/Import seed data for lookup/content tables you want prefilled.

This ensures all table definitions, checks, defaults, foreign keys, and constraints match exactly.

### Option B — Manual: Create only the needed tables

If you prefer a clean slate, recreate only the tables in “Trip planning core” + “Content and caching”. Use the existing project as the source of truth for column types, defaults, and constraints (you can copy the CREATE TABLE DDL from `public` schema). Then add RLS and RPCs from sections below.

---

## 4) Row Level Security (RLS) policies

Enable RLS on user-scoped tables and add policies. These patterns match how the app reads/writes.

General pattern for user-owned rows:

```sql
-- Example: user_trips
alter table public.user_trips enable row level security;

create policy "select own trips" on public.user_trips
  for select using (user_id = auth.uid());

create policy "insert own trips" on public.user_trips
  for insert with check (user_id = auth.uid());

create policy "update own trips" on public.user_trips
  for update using (user_id = auth.uid());

create policy "delete own trips" on public.user_trips
  for delete using (user_id = auth.uid());
```

Tables that reference `user_trips` via foreign keys need policies that join back to the owner. Use subqueries to assert ownership:

```sql
-- trip_days (owned via user_trips)
alter table public.trip_days enable row level security;

create policy "select own days" on public.trip_days
  for select using (
    exists (
      select 1
      from public.user_trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  );

create policy "insert into own trips" on public.trip_days
  for insert with check (
    exists (
      select 1
      from public.user_trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  );

create policy "update own days" on public.trip_days
  for update using (
    exists (
      select 1
      from public.user_trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  );

create policy "delete own days" on public.trip_days
  for delete using (
    exists (
      select 1
      from public.user_trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  );
```

```sql
-- trip_destinations (owned via trip_days -> user_trips)
alter table public.trip_destinations enable row level security;

create policy "select own destinations" on public.trip_destinations
  for select using (
    exists (
      select 1
      from public.trip_days d
      join public.user_trips t on t.id = d.trip_id
      where d.id = day_id and t.user_id = auth.uid()
    )
  );

create policy "insert into own destinations" on public.trip_destinations
  for insert with check (
    exists (
      select 1
      from public.trip_days d
      join public.user_trips t on t.id = d.trip_id
      where d.id = day_id and t.user_id = auth.uid()
    )
  );

create policy "update own destinations" on public.trip_destinations
  for update using (
    exists (
      select 1
      from public.trip_days d
      join public.user_trips t on t.id = d.trip_id
      where d.id = day_id and t.user_id = auth.uid()
    )
  );

create policy "delete own destinations" on public.trip_destinations
  for delete using (
    exists (
      select 1
      from public.trip_days d
      join public.user_trips t on t.id = d.trip_id
      where d.id = day_id and t.user_id = auth.uid()
    )
  );
```

```sql
-- trip_destination_pois & trip_destination_destinations (owned via trip_destinations)
alter table public.trip_destination_pois enable row level security;
alter table public.trip_destination_destinations enable row level security;

create policy "select own tdp" on public.trip_destination_pois
  for select using (
    exists (
      select 1
      from public.trip_destinations td
      join public.trip_days d on d.id = td.day_id
      join public.user_trips t on t.id = d.trip_id
      where td.id = trip_destination_id and t.user_id = auth.uid()
    )
  );

create policy "insert into own tdp" on public.trip_destination_pois
  for insert with check (
    exists (
      select 1
      from public.trip_destinations td
      join public.trip_days d on d.id = td.day_id
      join public.user_trips t on t.id = d.trip_id
      where td.id = trip_destination_id and t.user_id = auth.uid()
    )
  );

create policy "update own tdp" on public.trip_destination_pois
  for update using (
    exists (
      select 1
      from public.trip_destinations td
      join public.trip_days d on d.id = td.day_id
      join public.user_trips t on t.id = d.trip_id
      where td.id = trip_destination_id and t.user_id = auth.uid()
    )
  );

create policy "delete own tdp" on public.trip_destination_pois
  for delete using (
    exists (
      select 1
      from public.trip_destinations td
      join public.trip_days d on d.id = td.day_id
      join public.user_trips t on t.id = d.trip_id
      where td.id = trip_destination_id and t.user_id = auth.uid()
    )
  );

-- Repeat the same four policies for public.trip_destination_destinations
```

```sql
-- explore_places (user-owned)
alter table public.explore_places enable row level security;

create policy "select own explore places" on public.explore_places
  for select using (user_id = auth.uid());

create policy "upsert own explore places" on public.explore_places
  for insert with check (user_id = auth.uid());

create policy "update own explore places" on public.explore_places
  for update using (user_id = auth.uid());

create policy "delete own explore places" on public.explore_places
  for delete using (user_id = auth.uid());

-- Ensure explore cards persist full state
alter table public.explore_places
  add column if not exists notes text,
  add column if not exists links_json jsonb default '[]'::jsonb,
  add column if not exists metadata jsonb,
  add column if not exists is_favorite boolean default false;
```

```sql
-- user_trip_preferences (keyed by user_id)
alter table public.user_trip_preferences enable row level security;

create policy "select own preferences" on public.user_trip_preferences
  for select using (user_id = auth.uid());

create policy "insert own preferences" on public.user_trip_preferences
  for insert with check (user_id = auth.uid());

create policy "update own preferences" on public.user_trip_preferences
  for update using (user_id = auth.uid());
```

Server-managed content (writes via service role, reads allowed to clients):

```sql
-- destination_modal_content
alter table public.destination_modal_content enable row level security;

-- Allow clients to read; writes happen via server role
create policy "read destination content" on public.destination_modal_content
  for select using (true);

-- destination_images
alter table public.destination_images enable row level security;

create policy "read destination images" on public.destination_images
  for select using (true);

-- export_history (server logs)
alter table public.export_history enable row level security;

-- Optional: deny client reads entirely (only service role uses it)
create policy "no client reads" on public.export_history for select using (false);
```

If you prefer to keep destination content server-only, change the `using (true)` to `using (false)` and fetch content exclusively with server-side `supabaseAdmin`.

---

## 5) RPC functions used by the app

Implement these in SQL (adjust names/types if you customized columns).

```sql
-- Increment view count for destination content
create or replace function public.increment_destination_view_count(destination_name_param text)
returns void
language sql
security definer
as $$
  update public.destination_modal_content
  set view_count = coalesce(view_count, 0) + 1,
      last_viewed_at = now()
  where destination_name = destination_name_param;
$$;
```

```sql
-- Content quality stats for dashboards
create or replace function public.get_content_quality_stats()
returns table (
  total_content bigint,
  avg_quality_score numeric,
  high_quality_count bigint,
  low_quality_count bigint,
  cache_hit_rate numeric
)
language sql
security definer
as $$
  with base as (
    select quality_score, (expires_at >= now()) as is_fresh
    from public.destination_modal_content
  )
  select
    count(*) as total_content,
    coalesce(avg(quality_score), 0) as avg_quality_score,
    sum(case when quality_score >= 0.7 then 1 else 0 end) as high_quality_count,
    sum(case when quality_score < 0.7 then 1 else 0 end) as low_quality_count,
    case when count(*) = 0 then 0 else (
      sum(case when is_fresh then 1 else 0 end)::numeric / count(*)::numeric
    ) end as cache_hit_rate
  from base;
$$;
```

```sql
-- Cleanup expired destination content; returns number of rows deleted
create or replace function public.cleanup_expired_destination_content()
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from public.destination_modal_content
  where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
```

Notes:
- `security definer` lets these functions run with creator privileges; ensure only trusted roles can execute DDL, and rely on RLS + grants for data access.

---

## 6) Helpful indexes

Add or confirm the following indexes to keep queries fast:

```sql
-- Foreign key navigation
create index if not exists idx_trip_days_trip_id on public.trip_days(trip_id);
create index if not exists idx_trip_destinations_day_id on public.trip_destinations(day_id);

-- Ordering destinations within a day
create index if not exists idx_trip_destinations_day_order on public.trip_destinations(day_id, order_index);

-- User lists
create index if not exists idx_user_trips_user on public.user_trips(user_id, created_at desc);
create index if not exists idx_explore_places_user on public.explore_places(user_id, created_at desc);

-- Content cache lookups
create unique index if not exists ux_destination_modal_content_name on public.destination_modal_content(destination_name);
create index if not exists idx_destination_images_name on public.destination_images(destination_name);
```

---

## 7) Auth configuration

- Provider: Email (password) is sufficient; add OAuth providers if desired.
- Redirect URLs: Add your local and deployed domains to Supabase Auth settings (e.g., `http://localhost:3000` and your production domain) for magic links and password resets.
- Email templates: Optional customization.
- RLS relies on `auth.uid()` from JWT; no custom JWT claims are required.

Client/server initialization in the app:
- Client: `lib/supabase/client.ts` uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Server: `lib/server/supabase-admin.ts` uses `SUPABASE_SERVICE_ROLE_KEY` and disables session persistence.

---

## 8) Environment variables

Set these in `.env.local` and your deployment provider:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Mapbox, etc., if not already set
NEXT_PUBLIC_MAPBOX_TOKEN=...
```

Ensure `.env.local` is present locally and not committed. The project already reads these in `lib/supabase/client.ts` and `lib/server/supabase-admin.ts`.

---

## 9) Verification steps

After applying schema, extensions, RPCs, and RLS, verify:

1) Extensions
```sql
select extname from pg_extension where extname in ('postgis','vector','pgcrypto','uuid-ossp','pg_trgm');
```

2) RPCs
```sql
select * from public.get_content_quality_stats();
select public.cleanup_expired_destination_content();
select public.increment_destination_view_count('Rome_Italy_attraction');
```

3) RLS correctness (as an authenticated user)
- Insert a row into `user_trips`, then confirm you can read/update/delete it.
- Attempt to read another user's trip: query should return zero rows.
- Insert a `trip_days` row for your `user_trips` and verify it is visible.

4) App smoke test
- Start the app, sign up/sign in, create a trip, add days and destinations.
- Use explore flow to add `explore_places`.
- Open a destination; ensure content cache reads and image fetches work.

---

## 10) Optional data backfill and content

If you want the same content richness as the old project:
- Seed `countries/zones/regions/destinations/pois/routes` with your curated data
- Backfill `destination_modal_content` and `destination_images` with known entries
- Generate embeddings for `content_embeddings` if you plan to use vector search

---

## 11) Deployment notes

- Set all env vars in your deployment (e.g., Vercel). Do not expose the service role key in client-side code.
- If you restrict `destination_modal_content`/`destination_images` to server-only, ensure the UI uses server functions to fetch content.
- Monitor RLS errors in logs if client queries fail silently.

---

## 12) What’s strictly required vs. optional

- Required for Trip3 core: extensions, “Trip planning core” tables, RLS for those tables, env vars, and auth setup. The three RPCs should exist if you use the destination content features.
- Optional: exploration and journey tables, vector embeddings, export history, broad content caches—keep them if you rely on those UI sections.

---

## 13) Appendix: minimal policy set summary

- `user_trips`: user_id = auth.uid() for all CRUD
- `trip_days`: via exists(user_trips.user_id = auth.uid())
- `trip_destinations`: via exists(trip_days -> user_trips.user_id = auth.uid())
- `trip_destination_pois` and `trip_destination_destinations`: via exists(trip_destinations -> trip_days -> user_trips.user_id = auth.uid())
- `explore_places`: user_id = auth.uid() for CRUD
- `user_trip_preferences`: user_id = auth.uid() for CRUD
- `destination_modal_content`, `destination_images`: SELECT allowed to clients (or server-only if you prefer)
- `export_history`: server-only

This mirrors the way our code queries data in `lib/supabase/trip-api.ts`, `lib/supabase/explore-api.ts`, and server utilities in `lib/server/destination-cache.ts`.

