# Complete Database Reference - Trip3

**Last Updated**: 2025-10-10  
**Database**: PostgreSQL 17 with PostGIS 3.3.7  
**Project**: Trip3 Travel Planning App

This is the complete technical reference for the Trip3 Supabase database. For setup instructions, see `SETUP_GUIDE.md`. For security issues, see `SECURITY_AUDIT.md`.

---

## Table of Contents

1. [Current State Overview](#current-state-overview)
2. [Extensions](#extensions)
3. [Complete Table Schemas](#complete-table-schemas)
4. [Database Functions](#database-functions)
5. [RLS Policy Reference](#rls-policy-reference)
6. [Views](#views)
7. [Performance & Indexes](#performance--indexes)
8. [Data Volumes](#data-volumes)

---

## Current State Overview

### Active Tables (13)

**User & Authentication** (3 tables)
- `users` - Application user profiles (86 rows)
- `user_preferences` - User settings (12 rows)
- `user_trip_preferences` - Trip planning preferences

**Trip Planning** (4 tables)
- `user_trips` - Trip containers (125 rows)
- `trip_days` - Daily itinerary (593 rows)
- `trip_destinations` - Places per day (64 rows)
- `trip_analytics` - Event tracking

**Explore & Discovery** (1 table)
- `explore_places` - User-saved places (35 rows)

**Content Caching** (3 tables)
- `destination_modal_content` - AI content (27 rows, 24h TTL)
- `destination_images` - Cached images (239 rows, 7-day TTL)
- `export_history` - Export logs

**Assistant/AI** (5 tables)
- `assistant_conversations` - Chat sessions
- `assistant_messages` - Chat messages
- `assistant_tool_calls` - Function calls
- `assistant_logs` - Token tracking (RLS disabled)
- `content_embeddings` - Semantic search embeddings (10 rows)

### Legacy Tables

25+ unused tables from previous projects:
- Journey system (9 tables)
- POI system (5 tables)
- VIA conversation system (6 tables)
- Assessment system (2 tables)
- Other legacy content tables

**Recommendation**: Archive and drop in cleanup migration

---

## Extensions

| Extension | Version | Purpose |
|-----------|---------|---------|
| `postgis` | 3.3.7 | Geospatial data (points, boundaries) |
| `vector` | 0.8.0 | Vector embeddings for semantic search |
| `pg_trgm` | 1.6 | Fuzzy text search |
| `pg_stat_statements` | 1.11 | Query performance monitoring |
| `pg_graphql` | 1.5.11 | GraphQL API support |
| `pgcrypto` | 1.3 | Cryptographic functions |
| `uuid-ossp` | 1.1 | UUID generation |
| `supabase_vault` | 0.3.1 | Secrets management |

---

## Complete Table Schemas

### User & Authentication

#### `users`
Application user profiles (extends auth.users)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | User ID (matches auth.users.id) |
| `email` | text | UNIQUE, NOT NULL | User email |
| `full_name` | text | NULL | Full name |
| `created_at` | timestamptz | DEFAULT now() | Account creation |
| `updated_at` | timestamptz | DEFAULT now() | Last update |

**RLS**: Enabled - Users can SELECT/UPDATE own row, service role can manage all  
**Sync**: Automatically synced from auth.users via trigger

#### `user_preferences`
User application settings

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | uuid | PRIMARY KEY, REFERENCES auth.users(id) | User ID |
| `default_country` | text | NULL | Default country code |
| `map_style` | text | NULL | Preferred map style |
| `tts_voice` | text | NULL | Text-to-speech voice |
| `stt_language` | text | NULL | Speech-to-text language |
| `flags` | jsonb | DEFAULT '{}' | Feature flags |
| `updated_at` | timestamptz | DEFAULT now() | Last update |

**RLS**: Enabled - Users manage own preferences (`user_id = auth.uid()`)

#### `user_trip_preferences`
Trip planning preferences

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | uuid | PRIMARY KEY, REFERENCES auth.users(id) | User ID |
| `default_country` | text | NULL | Default trip country |
| `preferred_categories` | text[] | NULL | Preferred place categories |
| `budget_range_min` | numeric | NULL | Min budget |
| `budget_range_max` | numeric | NULL | Max budget |
| `travel_style` | text | NULL | Travel style |
| `interests` | text[] | NULL | User interests |
| `created_at` | timestamptz | DEFAULT now() | Creation time |
| `updated_at` | timestamptz | DEFAULT now() | Last update |

**RLS**: Enabled - Full CRUD for own data

---

### Trip Planning

#### `user_trips`
Trip containers with dates, country, budget

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Trip ID |
| `user_id` | uuid | REFERENCES auth.users(id), NOT NULL | Owner |
| `name` | text | NOT NULL | Trip name |
| `start_date` | date | NOT NULL | Start date |
| `end_date` | date | NOT NULL | End date |
| `country_code` | varchar | NOT NULL | Country code (IT, FR, etc) |
| `total_budget` | numeric | NULL | Total budget |
| `status` | varchar | DEFAULT 'planning', CHECK | Status: planning/active/completed/cancelled |
| `notes` | text | NULL | Trip notes |
| `created_at` | timestamptz | DEFAULT now() | Creation time |
| `updated_at` | timestamptz | DEFAULT now() | Last update |

**RLS**: Enabled - Full CRUD for own trips (`user_id = auth.uid()`)  
**Indexes**: user_id, created_at DESC

#### `trip_days`
Daily itinerary items within trips

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Day ID |
| `trip_id` | uuid | REFERENCES user_trips(id), NOT NULL | Parent trip |
| `date` | date | NOT NULL | Day date |
| `day_order` | integer | NOT NULL | Order within trip |
| `base_location_name` | text | NULL | Legacy: single base location |
| `base_location_coordinates` | point | NULL | Legacy: coordinates |
| `base_location_context` | text | NULL | Legacy: context |
| `base_locations_json` | jsonb | DEFAULT '[]' | Current: array of base locations |
| `notes` | text | NULL | Day notes |
| `created_at` | timestamptz | DEFAULT now() | Creation time |
| `updated_at` | timestamptz | DEFAULT now() | Last update |

**RLS**: Enabled - Access via trip ownership  
**Indexes**: trip_id  
**Schema Note**: Hybrid schema with legacy single location + new array structure

**base_locations_json structure**:
```typescript
type BaseLocation = {
  name: string;
  coordinates: { lat: number; lng: number };
  context?: string;
}
```

#### `trip_destinations`
Places to visit within trip days

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Destination ID |
| `day_id` | uuid | REFERENCES trip_days(id), NOT NULL | Parent day |
| `name` | text | NOT NULL | Destination name |
| `description` | text | NULL | Description |
| `coordinates` | point | NOT NULL | Geographic coordinates |
| `city` | text | NULL | City name |
| `category` | varchar | NULL | Category |
| `rating` | numeric | NULL | Rating (1-5) |
| `image_url` | text | NULL | Image URL |
| `estimated_duration_hours` | numeric | NULL | Visit duration |
| `opening_hours` | text | NULL | Opening hours |
| `cost` | numeric | NULL | Cost/price |
| `order_index` | integer | DEFAULT 0 | Order within day |
| `notes` | text | NULL | Notes |
| `links_json` | jsonb | NULL | External links |
| `created_at` | timestamptz | DEFAULT now() | Creation time |
| `updated_at` | timestamptz | DEFAULT now() | Last update |

**RLS**: Enabled - Access via day → trip ownership  
**Indexes**: day_id, order_index

**links_json structure**:
```typescript
type LocationLink = {
  title: string;
  url: string;
  type?: string;
}
```

#### `trip_analytics`
Event tracking for trips

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Event ID |
| `trip_id` | uuid | REFERENCES user_trips(id) | Associated trip |
| `user_id` | uuid | REFERENCES auth.users(id) | User |
| `event_type` | text | NOT NULL | Event type |
| `event_data` | jsonb | NULL | Event payload |
| `created_at` | timestamptz | DEFAULT now() | Event time |

**RLS**: Enabled - Users can INSERT/SELECT own analytics

---

### Explore & Discovery

#### `explore_places`
User-saved places from search/exploration

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Place ID |
| `user_id` | uuid | REFERENCES auth.users(id), NOT NULL | Owner |
| `name` | text | NOT NULL | Place name |
| `full_name` | text | NULL | Full place name |
| `longitude` | numeric | NOT NULL | Longitude |
| `latitude` | numeric | NOT NULL | Latitude |
| `category` | text | NULL | Place category |
| `context` | text | NULL | Place context |
| `notes` | text | NULL | User notes |
| `links_json` | jsonb | DEFAULT '[]' | External links |
| `metadata` | jsonb | NULL | Additional metadata |
| `is_favorite` | boolean | DEFAULT false | Favorite flag |
| `created_at` | timestamptz | DEFAULT now() | Creation time |
| `updated_at` | timestamptz | DEFAULT now() | Last update |

**RLS**: Enabled - Full CRUD for own places  
**Indexes**: user_id, created_at DESC

---

### Content Caching

#### `destination_modal_content`
AI-generated destination content with 24h TTL

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Content ID |
| `destination_name` | text | UNIQUE, NOT NULL | Destination name |
| `destination_coordinates` | point | NULL | Coordinates |
| `destination_category` | text | NULL | Category |
| `summary` | text | NULL | Summary |
| `why_visit` | text | NULL | Why visit section |
| `key_facts` | text | NULL | Key facts |
| `general_information` | text | NULL | General info |
| `activities_attractions` | text | NULL | Activities |
| `selected_tips` | text | NULL | Tips |
| `similar_places` | text | NULL | Similar places |
| `metadata` | jsonb | NULL | Additional metadata |
| `content_version` | integer | DEFAULT 1 | Version number |
| `ai_model` | text | NULL | AI model used |
| `tokens_used` | integer | NULL | Tokens consumed |
| `quality_score` | numeric | DEFAULT 0.0 | Quality score |
| `view_count` | integer | DEFAULT 0 | View count |
| `last_viewed_at` | timestamptz | NULL | Last view |
| `avg_quality_rating` | numeric | CHECK (0.0-1.0) | Avg rating |
| `user_feedback_count` | integer | DEFAULT 0 | Feedback count |
| `created_at` | timestamptz | DEFAULT now() | Creation time |
| `updated_at` | timestamptz | DEFAULT now() | Last update |
| `expires_at` | timestamptz | DEFAULT (now() + '24:00:00') | Expiration |

**RLS**: ✅ Enabled - Public SELECT for non-expired content only (`expires_at > now()`)  
**TTL**: 24 hours  
**Indexes**: destination_name (unique), expires_at  
**Security**: Fixed 2025-10-11 - Removed duplicate policy that bypassed TTL

#### `destination_images`
Cached images from Unsplash/Pixabay with 7-day TTL

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Image ID |
| `destination_name` | text | NOT NULL | Destination name |
| `destination_coordinates` | point | NULL | Coordinates |
| `image_url` | text | NOT NULL | Full image URL |
| `thumbnail_url` | text | NOT NULL | Thumbnail URL |
| `alt_text` | text | NULL | Alt text |
| `photographer` | text | NULL | Photographer |
| `source` | text | CHECK (unsplash/pixabay) | Image source |
| `width` | integer | NULL | Width px |
| `height` | integer | NULL | Height px |
| `color` | text | NULL | Dominant color |
| `likes` | integer | DEFAULT 0 | Like count |
| `query_used` | text | NULL | Search query |
| `display_order` | integer | DEFAULT 1 | Carousel position |
| `downloads` | integer | DEFAULT 0 | Downloads |
| `tags` | text[] | DEFAULT '{}' | Tags |
| `quality_score` | numeric | CHECK (0.0-1.0), DEFAULT 0.5 | Quality score |
| `cached_at` | timestamptz | DEFAULT now() | Cache time |
| `created_at` | timestamptz | DEFAULT now() | Creation time |
| `updated_at` | timestamptz | DEFAULT now() | Last update |
| `expires_at` | timestamptz | DEFAULT (now() + '7 days') | Expiration |

**RLS**: ✅ Enabled - Public SELECT for non-expired images only (`expires_at > now()`)  
**TTL**: 7 days  
**Indexes**: destination_name, expires_at  
**Security**: Fixed 2025-10-11 - Removed duplicate policy that bypassed TTL

#### `export_history`
Export and share history logs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `export_id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Export ID |
| `destination_id` | text | NULL | Destination ID |
| `destination_name` | text | NULL | Destination name |
| `user_session` | text | NULL | User session ID |
| `export_data` | jsonb | NULL | Export payload |
| `sheets_url` | text | NULL | Google Sheets URL |
| `export_type` | text | NULL | Export type |
| `status` | text | NULL | Status |
| `error_message` | text | NULL | Error if failed |
| `created_at` | timestamptz | DEFAULT now() | Creation time |
| `completed_at` | timestamptz | NULL | Completion time |

**RLS**: Enabled - Users can manage own exports, service role has full access  
**TTL**: 30 days (via cleanup function)

---

### Assistant/AI

#### `assistant_conversations`
Conversation sessions with AI assistant

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Conversation ID |
| `user_id` | uuid | REFERENCES auth.users(id) | Owner |
| `trip_id` | uuid | REFERENCES user_trips(id), NULL | Associated trip |
| `title` | text | NULL | Title |
| `status` | text | DEFAULT 'active' | Status |
| `started_at` | timestamptz | DEFAULT now() | Start time |
| `last_turn_at` | timestamptz | DEFAULT now() | Last activity |
| `metadata` | jsonb | DEFAULT '{}' | Metadata |

**RLS**: Enabled - Users manage own conversations  
**Indexes**: user_id, trip_id

#### `assistant_messages`
Individual messages within conversations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Message ID |
| `conversation_id` | uuid | REFERENCES assistant_conversations(id) | Parent conversation |
| `user_id` | uuid | REFERENCES auth.users(id) | Owner |
| `role` | text | NOT NULL, CHECK (user/assistant/system) | Message role |
| `content` | text | NOT NULL | Message content |
| `metadata` | jsonb | DEFAULT '{}' | Metadata |
| `prompt_tokens` | integer | NULL | Prompt tokens |
| `completion_tokens` | integer | NULL | Completion tokens |
| `total_tokens` | integer | NULL | Total tokens |
| `cost_usd` | numeric | NULL | Cost in USD |
| `created_at` | timestamptz | DEFAULT now() | Creation time |

**RLS**: Enabled - Access via conversation ownership  
**Indexes**: conversation_id

#### `assistant_tool_calls`
Function/tool calls made by assistant

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Tool call ID |
| `message_id` | uuid | REFERENCES assistant_messages(id) | Parent message |
| `tool_name` | text | NOT NULL | Tool name |
| `arguments` | jsonb | NOT NULL | Arguments |
| `response` | jsonb | NULL | Response |
| `status` | text | DEFAULT 'pending', CHECK | Status |
| `error` | text | NULL | Error message |
| `created_at` | timestamptz | DEFAULT now() | Creation time |
| `completed_at` | timestamptz | NULL | Completion time |

**RLS**: Enabled - Access via message → conversation ownership  
**Indexes**: message_id

#### `assistant_logs`
Token usage and cost tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Log ID |
| `user_id` | uuid | NULL | User |
| `conversation_id` | uuid | NULL | Conversation |
| `message_id` | uuid | NULL | Message |
| `model` | text | NULL | AI model |
| `prompt_tokens` | integer | NULL | Prompt tokens |
| `completion_tokens` | integer | NULL | Completion tokens |
| `total_tokens` | integer | NULL | Total tokens |
| `cost_usd` | numeric | NULL | Cost in USD |
| `created_at` | timestamptz | DEFAULT now() | Log time |

**RLS**: ❌ Disabled - Server-side logging only  
**Indexes**: user_id, conversation_id  
**Note**: Should only be accessed via service role

#### `content_embeddings`
Semantic search embeddings for assistant knowledge

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Embedding ID |
| `title` | text | NOT NULL | Content title |
| `snippet` | text | NULL | Content snippet |
| `url` | text | NULL | Content URL |
| `tags` | jsonb | DEFAULT '[]' | Content tags |
| `metadata` | jsonb | DEFAULT '{}' | Additional metadata |
| `embedding` | vector(1536) | NULL | OpenAI embedding vector |
| `created_at` | timestamptz | DEFAULT now() | Creation time |
| `updated_at` | timestamptz | DEFAULT now() | Last update |

**RLS**: ✅ Enabled - Service role only  
**Indexes**: ivfflat on embedding for fast cosine similarity search  
**Embedding Model**: text-embedding-3-small (1536 dimensions)  
**Seeded From**: destination_modal_content (10 rows)  
**Purpose**: Semantic search for assistant knowledge retrieval

---

## Database Functions

### Trip Management

#### `get_trip_with_details(trip_uuid uuid) → jsonb`
Returns complete trip with nested days and destinations

```sql
SELECT get_trip_with_details('trip-uuid-here');
```

**Returns**:
```json
{
  "trip": { /* user_trips row */ },
  "days": [
    {
      "day": { /* trip_days row */ },
      "destinations": [ /* trip_destinations */ ]
    }
  ]
}
```

**Security**: SECURITY DEFINER, checks ownership via `auth.uid()`

---

#### `duplicate_trip(original_trip_id uuid, new_name text) → uuid`
Clones trip with all nested days and destinations

```sql
SELECT duplicate_trip('original-trip-uuid', 'My Trip Copy');
```

**Process**: Creates new trip → duplicates days → duplicates destinations  
**Returns**: New trip UUID  
**Security**: SECURITY DEFINER, checks ownership

---

#### `reorder_destinations(day_uuid uuid, destination_ids uuid[]) → boolean`
Updates order_index for destinations within a day

```sql
SELECT reorder_destinations(
  'day-uuid',
  ARRAY['dest-uuid-1', 'dest-uuid-2', 'dest-uuid-3']
);
```

**Security**: SECURITY DEFINER, checks ownership

---

### Content Management

#### `increment_destination_view_count(destination_name_param text) → void`
Increments view counter and updates timestamp

```sql
SELECT increment_destination_view_count('Rome_Italy');
```

**Updates**: view_count +1, last_viewed_at, updated_at  
**Condition**: Only non-expired content  
**Security**: SECURITY DEFINER (public operation)

---

#### `cleanup_expired_destination_content() → integer`
Deletes expired entries from destination_modal_content

```sql
SELECT cleanup_expired_destination_content();
```

**Returns**: Count of deleted rows  
**Recommended**: Daily cron job  
**Security**: SECURITY DEFINER

---

#### `cleanup_old_export_history() → integer`
Purges export records older than 30 days

```sql
SELECT cleanup_old_export_history();
```

**Returns**: Count of deleted rows  
**Recommended**: Weekly cron job  
**Security**: SECURITY DEFINER

---

### Assistant/AI Functions

#### `calculate_conversation_depth(session_id_param text) → numeric`
Calculates conversation quality score based on precision indicators

#### `calculate_quality_score(response_id uuid) → numeric`
Calculates quality score for cached AI response

#### `classify_intent(message_text text, conversation_context jsonb) → table`
Classifies user intent (exploring/planning/booking/support/general)

#### `route_to_agent(intent varchar, depth numeric, current_agent varchar) → table`
Determines which AI agent should handle conversation

#### `match_cached_responses(query_embedding vector, match_threshold float, match_count int) → table`
Semantic search for similar cached AI responses using vector similarity

#### `match_command_cache(query_embedding vector, match_threshold float, match_count int) → table`
Semantic search for similar cached commands

#### `update_cache_usage_stats(response_id uuid, tokens_used int) → void`
Updates usage statistics when cached response is served

#### `match_content_embeddings(query_embedding vector(1536), match_threshold float, match_count int) → table`
Semantic search for content using vector similarity

**Purpose**: Find relevant content based on embedding similarity

**Parameters**:
- `query_embedding`: Vector embedding of the search query (1536 dimensions)
- `match_threshold`: Minimum similarity score (0-1, default 0.7)
- `match_count`: Maximum results to return (default 10)

**Returns**: Table with columns:
- `id`: Content ID
- `title`: Content title
- `snippet`: Content preview
- `url`: Content URL
- `tags`: Content tags
- `metadata`: Additional metadata
- `similarity`: Cosine similarity score (0-1)

**Usage**:
```typescript
// Generate embedding for query
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'medieval cities in Tuscany'
});

// Search for similar content
const { data: results } = await supabase.rpc('match_content_embeddings', {
  query_embedding: embedding.data[0].embedding,
  match_threshold: 0.5,
  match_count: 5
});
```

**Security**: SECURITY DEFINER, available to service_role and authenticated users

---

### User Lifecycle

#### `handle_new_auth_user() → trigger`
Syncs auth.users into public.users on signup

**Trigger**: on_auth_user_created AFTER INSERT on auth.users  
**Action**: Inserts/updates public.users with same UUID  
**Security**: SECURITY DEFINER

---

#### `update_updated_at_column() → trigger`
Automatically sets updated_at = now() on row updates

**Applied to**: user_trips, trip_days, trip_destinations, users, user_preferences, destination_modal_content, and others

---

### PostGIS Functions

200+ spatial functions provided by PostGIS extension. Key ones:

- `ST_Distance(geography, geography)` - Distance between points
- `ST_DWithin(geography, geography, float)` - Within distance check
- `ST_AsGeoJSON(geometry)` - Convert to GeoJSON
- `ST_MakePoint(lng, lat)` - Create point from coordinates
- `ST_Transform(geometry, srid)` - Transform coordinate systems

**Full docs**: https://postgis.net/docs/

---

## RLS Policy Reference

### Policy Patterns

#### Pattern 1: Direct Ownership
```sql
-- Tables: user_trips, explore_places, user_preferences
WHERE user_id = auth.uid()
```

#### Pattern 2: Nested via Foreign Key
```sql
-- Table: trip_days
EXISTS (
  SELECT 1 FROM user_trips 
  WHERE user_trips.id = trip_days.trip_id 
  AND user_trips.user_id = auth.uid()
)
```

#### Pattern 3: Double-Nested
```sql
-- Table: trip_destinations
EXISTS (
  SELECT 1 FROM trip_days 
  JOIN user_trips ON user_trips.id = trip_days.trip_id
  WHERE trip_days.id = trip_destinations.day_id 
  AND user_trips.user_id = auth.uid()
)
```

#### Pattern 4: Public Read with TTL
```sql
-- Tables: destination_modal_content, destination_images
-- ⚠️ Currently has issues - see SECURITY_AUDIT.md
WHERE expires_at > now()
```

#### Pattern 5: Service Role Only
```sql
-- Example: admin operations
WHERE auth.role() = 'service_role'
```

### Policy Coverage

All 13 active tables have RLS enabled and policies configured:

✅ `users` - 3 policies (service role, user SELECT, user UPDATE)  
✅ `user_preferences` - 1 policy (ALL for own data)  
✅ `user_trip_preferences` - 4 policies (full CRUD)  
✅ `user_trips` - 4 policies (full CRUD)  
✅ `trip_days` - 4 policies (via trip ownership)  
✅ `trip_destinations` - 4 policies (via day → trip ownership)  
✅ `trip_analytics` - 2 policies (INSERT/SELECT own data)  
✅ `explore_places` - 4 policies (full CRUD)  
⚠️ `destination_modal_content` - 5 policies (has issue)  
⚠️ `destination_images` - 5 policies (has issue)  
✅ `export_history` - 3 policies (user session + service role)  
✅ `assistant_conversations` - 1 policy (ALL for own conversations)  
✅ `assistant_messages` - 1 policy (via conversation ownership)  
✅ `assistant_tool_calls` - 2 policies (via message ownership)  
❌ `assistant_logs` - NO RLS (service role only)

**See SECURITY_AUDIT.md for detailed policy review and issues**

---

## Views

- `trip_days_with_number` - Trip days with computed day_number field
- `cache_performance_analysis` - Cache hit rates and quality metrics
- `destination_content_performance` - Content freshness and usage stats
- PostGIS system views: `geometry_columns`, `geography_columns`

---

## Performance & Indexes

### Recommended Indexes

```sql
-- Foreign key navigation (for RLS policies)
CREATE INDEX IF NOT EXISTS idx_trip_days_trip_id ON trip_days(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_destinations_day_id ON trip_destinations(day_id);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation_id ON assistant_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_assistant_tool_calls_message_id ON assistant_tool_calls(message_id);

-- User data lookups
CREATE INDEX IF NOT EXISTS idx_user_trips_user_id_created ON user_trips(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_explore_places_user_id_created ON explore_places(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user_id ON assistant_conversations(user_id);

-- Content cache
CREATE UNIQUE INDEX IF NOT EXISTS ux_destination_modal_content_name ON destination_modal_content(destination_name);
CREATE INDEX IF NOT EXISTS idx_destination_images_name ON destination_images(destination_name);
CREATE INDEX IF NOT EXISTS idx_destination_modal_content_expires ON destination_modal_content(expires_at);
CREATE INDEX IF NOT EXISTS idx_destination_images_expires ON destination_images(expires_at);

-- Destination ordering
CREATE INDEX IF NOT EXISTS idx_trip_destinations_day_order ON trip_destinations(day_id, order_index);

-- Vector similarity (for AI cache)
CREATE INDEX IF NOT EXISTS idx_content_embeddings_hnsw ON content_embeddings 
  USING hnsw (embedding vector_cosine_ops);
```

### Performance Notes

- RLS policies with nested EXISTS may impact query performance on large datasets
- All foreign key joins used in RLS should have indexes
- Vector similarity searches use HNSW index for optimal performance
- Cache tables benefit from expires_at index for cleanup operations

---

## Data Volumes

| Table | Rows | Growth Rate |
|-------|------|-------------|
| `user_trips` | 125 | Steady (user-generated) |
| `trip_days` | 593 | ~5x trips |
| `trip_destinations` | 64 | Variable per trip |
| `users` | 86 | Matches auth signups |
| `destination_images` | 239 | High (auto-cached) |
| `explore_places` | 35 | User-dependent |
| `destination_modal_content` | 27 | Moderate (auto-cached) |
| `user_preferences` | 12 | Low (opt-in) |

**Total Active Rows**: ~1,200

**Storage Considerations**:
- JSONB columns (metadata, links_json) are compact
- Image URLs stored as text (not binary)
- Point coordinates are efficient PostGIS type
- Legacy tables add ~XXX MB (should be cleaned up)

---

## Environment Variables

Required in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://rvmbgnrmxtooutrqcnum.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Client**: `lib/supabase/client.ts` uses public vars  
**Server**: `lib/server/supabase-admin.ts` uses service role key

---

## Verification Queries

### Check Extensions
```sql
SELECT extname, extversion FROM pg_extension 
WHERE extname IN ('postgis','vector','pgcrypto','uuid-ossp','pg_trgm');
```

### Verify RLS
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user_trips','trip_days','trip_destinations','explore_places');
```

### List All Policies
```sql
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

### Check Data Volumes
```sql
SELECT 
  (SELECT COUNT(*) FROM user_trips) as trips,
  (SELECT COUNT(*) FROM trip_days) as days,
  (SELECT COUNT(*) FROM trip_destinations) as destinations,
  (SELECT COUNT(*) FROM explore_places) as places,
  (SELECT COUNT(*) FROM users) as users;
```

---

## Migration Notes

### Schema Changes
1. **Always use migrations**: Create SQL migration files
2. **Test in branch**: Use Supabase branching
3. **Backward compatibility**: Add columns as nullable
4. **Update types**: Regenerate TypeScript types after changes
5. **Update docs**: Keep this file in sync

### Pending Migrations
- Remove legacy `base_location_*` columns from `trip_days`
- Drop unused tables from previous projects
- Add CHECK constraints for enum-like text fields

---

**Last Updated**: 2025-10-10  
**Next Review**: Quarterly or after major schema changes

For setup instructions, see `SETUP_GUIDE.md`  
For security issues, see `SECURITY_AUDIT.md`

