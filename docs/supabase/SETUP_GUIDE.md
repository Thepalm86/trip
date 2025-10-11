# Setup Guide - Trip3 Supabase

**Last Updated**: 2025-10-10  
**For Current State**: See `DATABASE_REFERENCE.md`  
**For Security Issues**: See `SECURITY_AUDIT.md`

This guide explains how to stand up a brand‑new Supabase project so Trip3 works exactly like it does today. It covers required extensions, tables, RPC functions, Row Level Security (RLS), environment configuration, and verification steps.

The app code assumes client-side access via `lib/supabase/client.ts` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-side access via `lib/server/supabase-admin.ts` with `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

---

## TL;DR checklist

- Enable extensions: PostGIS 3.3.7, Vector 0.8.0, pgcrypto, uuid-ossp, pg_trgm, pg_graphql
- Create the schema (tables listed below) or import it from the current project
- Add/verify core RPC functions (trip management, content caching, cleanup)
- Apply RLS policies for user-scoped data tables
- **Fix cache table RLS** (remove duplicate `true` SELECT policies)
- Configure Auth (email sign-in, redirect URLs)
- Add storage bucket policies
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

**Core Application Tables** (13 active):

Trip planning (user-owned data):
- `users` (86 rows) - app-level user profiles (extends `auth.users`)
- `user_preferences` (12 rows) - user application settings
- `user_trip_preferences` - trip planning preferences
- `user_trips` (125 rows) - trip containers
- `trip_days` (593 rows) - daily itinerary items
- `trip_destinations` (64 rows) - places to visit per day
- `trip_analytics` - event tracking
- `explore_places` (35 rows) - user-saved places

Content and caching (server-managed):
- `destination_modal_content` (27 rows) - AI-generated content (24h TTL)
- `destination_images` (239 rows) - cached images (7-day TTL)
- `export_history` - export/share logs

Assistant/AI (conversational features):
- `assistant_conversations` - conversation sessions
- `assistant_messages` - chat messages
- `assistant_tool_calls` - function calls
- `assistant_logs` - token usage tracking (RLS disabled)

**Legacy/Unused Tables** (not required for minimal setup):
- `trip_destination_pois`, `trip_destination_destinations` (0 rows, junction tables to unused POI system)
- Previous project tables: `countries`, `zones`, `regions`, `destinations`, `pois`, `routes`, `journeys` suite

**Note**: For a minimal Trip3 core, use only the "Core Application Tables" above. The current project has ~1,200 active rows across these 13 tables.

**Recent Schema Updates** (2025-10-11):
- Added `user_trip_preferences.accessibility` (text[]) for accessibility requirements
- Added `user_trip_preferences.dietary` (text[]) for dietary restrictions
- Added `destination_modal_content.display_name` (text) for human-friendly names
- Added `destination_modal_content.tags` (text[]) for content categorization

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

-- IMPORTANT: Only allow reading non-expired content
create policy "read fresh destination content" on public.destination_modal_content
  for select using (expires_at > now());

-- Allow authenticated users to insert/update (for caching)
create policy "authenticated insert content" on public.destination_modal_content
  for insert with check (auth.role() = 'authenticated');

create policy "authenticated update content" on public.destination_modal_content
  for update using (auth.role() = 'authenticated');

-- Service role has full access
create policy "service role full access content" on public.destination_modal_content
  for all using (auth.role() = 'service_role');

-- destination_images
alter table public.destination_images enable row level security;

-- IMPORTANT: Only allow reading non-expired images
create policy "read fresh images" on public.destination_images
  for select using (expires_at > now());

-- Allow authenticated users to insert/update (for caching)
create policy "authenticated insert images" on public.destination_images
  for insert with check (auth.role() = 'authenticated');

create policy "authenticated update images" on public.destination_images
  for update using (auth.role() = 'authenticated');

-- Service role has full access
create policy "service role full access images" on public.destination_images
  for all using (auth.role() = 'service_role');

-- export_history (server logs)
alter table public.export_history enable row level security;

-- Users can insert/read their own exports
create policy "users manage own exports" on public.export_history
  for insert with check ((user_session IS NULL) OR ((auth.uid())::text = user_session));

create policy "users read own exports" on public.export_history
  for select using ((user_session IS NULL) OR ((auth.uid())::text = user_session));

-- Service role has full access
create policy "service role full access exports" on public.export_history
  for all using (auth.role() = 'service_role');
```

**⚠️ CRITICAL**: Do NOT add a second SELECT policy with `using (true)` as this would bypass the TTL expiration check. The current production database has this issue and needs fixing.

### Assistant/AI Tables

```sql
-- assistant_conversations
alter table public.assistant_conversations enable row level security;

create policy "users manage own conversations" on public.assistant_conversations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- assistant_messages
alter table public.assistant_messages enable row level security;

create policy "users access messages via conversations" on public.assistant_messages
  for all using (
    exists (
      select 1 from assistant_conversations ac
      where ac.id = conversation_id and ac.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from assistant_conversations ac
      where ac.id = conversation_id and ac.user_id = auth.uid()
    )
  );

-- assistant_tool_calls
alter table public.assistant_tool_calls enable row level security;

create policy "users manage tool calls via conversations" on public.assistant_tool_calls
  for all using (
    exists (
      select 1 from assistant_messages am
      join assistant_conversations ac on ac.id = am.conversation_id
      where am.id = message_id and ac.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from assistant_messages am
      join assistant_conversations ac on ac.id = am.conversation_id
      where am.id = message_id and ac.user_id = auth.uid()
    )
  );

create policy "users view tool calls" on public.assistant_tool_calls
  for select using (
    exists (
      select 1 from assistant_messages am
      join assistant_conversations ac on ac.id = am.conversation_id
      where am.id = message_id and ac.user_id = auth.uid()
    )
  );

-- assistant_logs: NO RLS (server-side logging only)
-- This table should only be accessed via service role
```

If you prefer to keep destination content server-only, change the `expires_at > now()` to `false` and fetch content exclusively with server-side `supabaseAdmin`.

---

## 5) RPC functions used by the app

### Core Trip Management Functions

```sql
-- Get full trip with nested days and destinations
create or replace function public.get_trip_with_details(trip_uuid uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'trip', row_to_json(t),
    'days', (
      select jsonb_agg(
        jsonb_build_object(
          'day', row_to_json(d),
          'destinations', (
            select jsonb_agg(row_to_json(dest))
            from trip_destinations dest
            where dest.day_id = d.id
            order by dest.order_index
          )
        )
      )
      from trip_days d
      where d.trip_id = t.id
      order by d.day_order
    )
  )
  into result
  from user_trips t
  where t.id = trip_uuid
  and t.user_id = auth.uid();
  
  return result;
end;
$$;

-- Duplicate trip with all nested data
create or replace function public.duplicate_trip(original_trip_id uuid, new_name text)
returns uuid
language plpgsql
security definer
as $$
declare
  new_trip_id uuid;
  day_record record;
  dest_record record;
begin
  -- Create new trip
  insert into user_trips (user_id, name, start_date, end_date, country_code, total_budget, status, notes)
  select user_id, new_name, start_date, end_date, country_code, total_budget, 'planning', notes
  from user_trips
  where id = original_trip_id
  and user_id = auth.uid()
  returning id into new_trip_id;
  
  -- Duplicate days and destinations
  for day_record in 
    select * from trip_days where trip_id = original_trip_id order by day_order
  loop
    insert into trip_days (trip_id, date, day_order, base_location_name, base_location_coordinates, base_location_context, notes, base_locations_json)
    values (new_trip_id, day_record.date, day_record.day_order, day_record.base_location_name, day_record.base_location_coordinates, day_record.base_location_context, day_record.notes, day_record.base_locations_json)
    returning id into day_record.id;
    
    -- Duplicate destinations for this day
    for dest_record in 
      select * from trip_destinations where day_id = day_record.id order by order_index
    loop
      insert into trip_destinations (day_id, name, description, coordinates, category, rating, image_url, estimated_duration_hours, opening_hours, cost, order_index, notes, city, links_json)
      values (day_record.id, dest_record.name, dest_record.description, dest_record.coordinates, dest_record.category, dest_record.rating, dest_record.image_url, dest_record.estimated_duration_hours, dest_record.opening_hours, dest_record.cost, dest_record.order_index, dest_record.notes, dest_record.city, dest_record.links_json);
    end loop;
  end loop;
  
  return new_trip_id;
end;
$$;

-- Reorder destinations within a day
create or replace function public.reorder_destinations(day_uuid uuid, destination_ids uuid[])
returns boolean
language plpgsql
security definer
as $$
declare
  i integer;
begin
  -- Update order_index for each destination
  for i in 1..array_length(destination_ids, 1) loop
    update trip_destinations 
    set order_index = i - 1
    where id = destination_ids[i]
    and day_id = day_uuid
    and exists (
      select 1 from trip_days td
      join user_trips t on t.id = td.trip_id
      where td.id = day_uuid
      and t.user_id = auth.uid()
    );
  end loop;
  
  return true;
end;
$$;
```

### Content Management Functions

```sql
-- Increment view count for destination content
create or replace function public.increment_destination_view_count(destination_name_param text)
returns void
language plpgsql
security definer
as $$
begin
    update destination_modal_content 
    set 
        view_count = view_count + 1,
        last_viewed_at = now(),
        updated_at = now()
    where destination_name = destination_name_param 
    and expires_at > now();
end;
$$;

-- Cleanup expired destination content
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

-- Cleanup old export history (30+ days)
create or replace function public.cleanup_old_export_history()
returns integer
language plpgsql
security definer
as $$
declare
    deleted_count integer;
begin
    delete from export_history 
    where created_at < now() - interval '30 days';
    
    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$;
```

### User Lifecycle Triggers

```sql
-- Sync auth.users into public.users on signup
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email, full_name, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    now(),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();
  return new;
end;
$$;

-- Create trigger on auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Update updated_at column automatically
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to tables (example for user_trips)
create trigger update_user_trips_updated_at
  before update on public.user_trips
  for each row execute procedure public.update_updated_at_column();
```

Notes:
- `security definer` lets these functions run with creator privileges
- All trip functions respect RLS by checking `auth.uid()`
- Apply the `update_updated_at_column` trigger to all tables with `updated_at` fields

---

## 6) Storage Bucket Policies

**Current State**: Storage RLS is enabled but no policies exist (clients cannot access by default).

Add policies for your storage buckets:

```sql
-- Example: Public CDN bucket for cached images
insert into storage.buckets (id, name, public) 
values ('destination-images', 'destination-images', true);

create policy "public read destination images"
  on storage.objects for select
  using (bucket_id = 'destination-images');

create policy "authenticated upload destination images"
  on storage.objects for insert
  with check (bucket_id = 'destination-images' and auth.role() = 'authenticated');

-- Example: Private user content bucket
insert into storage.buckets (id, name, public) 
values ('user-content', 'user-content', false);

create policy "users manage own content"
  on storage.objects for all
  using (
    bucket_id = 'user-content' 
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'user-content' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## 7) Helpful indexes

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

## 8) Critical Security Fixes for Existing Database

If you're updating an existing database (not creating fresh), apply these fixes:

```sql
-- FIX 1: Remove duplicate SELECT policies that bypass TTL
drop policy if exists "Allow public read access to destination_modal_content" on public.destination_modal_content;
drop policy if exists "Allow public read access to destination_images" on public.destination_images;

-- Verify only TTL-gated policy remains
select policyname, cmd, qual 
from pg_policies 
where tablename in ('destination_modal_content', 'destination_images')
and cmd = 'SELECT';
-- Expected: Only policies with "expires_at > now()" condition

-- FIX 2: Add storage policies (if buckets exist)
-- See section 6 above for policy examples
```

---

## 9) Auth configuration

- Provider: Email (password) is sufficient; add OAuth providers if desired.
- Redirect URLs: Add your local and deployed domains to Supabase Auth settings (e.g., `http://localhost:3000` and your production domain) for magic links and password resets.
- Email templates: Optional customization.
- RLS relies on `auth.uid()` from JWT; no custom JWT claims are required.

Client/server initialization in the app:
- Client: `lib/supabase/client.ts` uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Server: `lib/server/supabase-admin.ts` uses `SUPABASE_SERVICE_ROLE_KEY` and disables session persistence.

---

## 10) Environment variables

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

## 11) Verification steps

After applying schema, extensions, RPCs, and RLS, verify:

1) Extensions
```sql
select extname from pg_extension where extname in ('postgis','vector','pgcrypto','uuid-ossp','pg_trgm');
```

2) RPCs
```sql
-- Test trip functions (requires authenticated context)
select public.get_trip_with_details('your-trip-uuid-here');
select public.duplicate_trip('your-trip-uuid-here', 'Duplicate Trip');

-- Test content functions
select public.increment_destination_view_count('Rome_Italy');
select public.cleanup_expired_destination_content();
select public.cleanup_old_export_history();
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

## 12) Optional data backfill and content

If you want the same content richness as the old project:
- Seed `countries/zones/regions/destinations/pois/routes` with your curated data
- Backfill `destination_modal_content` and `destination_images` with known entries
- Generate embeddings for `content_embeddings` if you plan to use vector search

---

## 13) Deployment notes

- Set all env vars in your deployment (e.g., Vercel). Do not expose the service role key in client-side code.
- If you restrict `destination_modal_content`/`destination_images` to server-only, ensure the UI uses server functions to fetch content.
- Monitor RLS errors in logs if client queries fail silently.

---

## 14) What's strictly required vs. optional

- Required for Trip3 core: extensions, “Trip planning core” tables, RLS for those tables, env vars, and auth setup. The three RPCs should exist if you use the destination content features.
- Optional: exploration and journey tables, vector embeddings, export history, broad content caches—keep them if you rely on those UI sections.

---

## 15) Appendix: minimal policy set summary

- `user_trips`: user_id = auth.uid() for all CRUD
- `trip_days`: via exists(user_trips.user_id = auth.uid())
- `trip_destinations`: via exists(trip_days -> user_trips.user_id = auth.uid())
- `trip_destination_pois` and `trip_destination_destinations`: via exists(trip_destinations -> trip_days -> user_trips.user_id = auth.uid())
- `explore_places`: user_id = auth.uid() for CRUD
- `user_trip_preferences`: user_id = auth.uid() for CRUD
- `destination_modal_content`, `destination_images`: SELECT allowed to clients (or server-only if you prefer)
- `export_history`: server-only

This mirrors the way our code queries data in `lib/supabase/trip-api.ts`, `lib/supabase/explore-api.ts`, and server utilities in `lib/server/destination-cache.ts`.

