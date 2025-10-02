# Supabase Table Schemas - Traveal Project

## Active Tables (Currently Used)

### 1. Core Trip Management

#### `user_trips` (125 rows)
**Purpose**: Main trip container for user-created trips

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique trip identifier |
| `user_id` | uuid | REFERENCES auth.users(id) | Owner of the trip |
| `name` | text | NOT NULL | Trip name/title |
| `start_date` | date | NOT NULL | Trip start date |
| `end_date` | date | NOT NULL | Trip end date |
| `country_code` | varchar | NOT NULL | Country code (e.g., 'IT', 'FR') |
| `total_budget` | numeric | NULL | Total trip budget |
| `status` | varchar | DEFAULT 'planning', CHECK | Trip status: planning/active/completed/cancelled |
| `notes` | text | NULL | Trip notes |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | DEFAULT now() | Last update timestamp |

**RLS**: Enabled
**Indexes**: Primary key, user_id foreign key

#### `trip_days` (593 rows)
**Purpose**: Individual days within a trip

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique day identifier |
| `trip_id` | uuid | REFERENCES user_trips(id) | Parent trip |
| `date` | date | NOT NULL | Day date |
| `day_order` | integer | NOT NULL | Order within trip |
| `base_location_name` | text | NULL | Legacy: single base location name |
| `base_location_coordinates` | point | NULL | Legacy: single base location coordinates |
| `base_location_context` | text | NULL | Legacy: base location context |
| `base_locations_json` | jsonb | DEFAULT '[]' | New: array of base locations |
| `notes` | text | NULL | Day-specific notes |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | DEFAULT now() | Last update timestamp |

**RLS**: Enabled
**Indexes**: Primary key, trip_id foreign key
**Note**: Hybrid schema with both legacy single location and new array structure

#### `trip_destinations` (64 rows)
**Purpose**: Destinations/attractions for each day

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique destination identifier |
| `day_id` | uuid | REFERENCES trip_days(id) | Parent day |
| `name` | text | NOT NULL | Destination name |
| `description` | text | NULL | Destination description |
| `coordinates` | point | NOT NULL | Geographic coordinates |
| `city` | text | NULL | City name |
| `category` | varchar | NULL | Destination category |
| `rating` | numeric | NULL | Rating (1-5) |
| `image_url` | text | NULL | Image URL |
| `estimated_duration_hours` | numeric | NULL | Estimated visit duration |
| `opening_hours` | text | NULL | Opening hours |
| `cost` | numeric | NULL | Cost/price |
| `order_index` | integer | DEFAULT 0 | Order within day |
| `notes` | text | NULL | Destination notes |
| `links_json` | jsonb | NULL | Links as JSON array |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | DEFAULT now() | Last update timestamp |

**RLS**: Enabled
**Indexes**: Primary key, day_id foreign key
**Note**: Links stored as JSON, needs proper serialization/deserialization

#### `trip_destination_pois` (0 rows)
**Purpose**: Junction table linking trip destinations to POIs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `trip_destination_id` | uuid | PRIMARY KEY, REFERENCES trip_destinations(id) | Trip destination |
| `poi_id` | uuid | PRIMARY KEY, REFERENCES pois(id) | POI reference |

**RLS**: Enabled
**Note**: Currently unused, POIs table is from previous project

#### `trip_destination_destinations` (0 rows)
**Purpose**: Junction table linking trip destinations to destinations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `trip_destination_id` | uuid | PRIMARY KEY, REFERENCES trip_destinations(id) | Trip destination |
| `destination_id` | uuid | PRIMARY KEY, REFERENCES destinations(id) | Destination reference |

**RLS**: Enabled
**Note**: Currently unused, destinations table is from previous project

### 2. User Management

#### `users` (86 rows)
**Purpose**: Application users (extends Supabase auth.users)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | User identifier |
| `email` | varchar | UNIQUE, NOT NULL | User email |
| `full_name` | varchar | NULL | User full name |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | DEFAULT now() | Last update timestamp |

**RLS**: Enabled
**Indexes**: Primary key, email unique index
**Note**: Extends Supabase auth.users with additional fields

#### `profiles` (0 rows)
**Purpose**: Extended user profiles

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Profile identifier |
| `user_id` | uuid | UNIQUE, REFERENCES users(id) | User reference |
| `bio` | text | NULL | User biography |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | DEFAULT now() | Last update timestamp |

**RLS**: Enabled
**Indexes**: Primary key, user_id unique index
**Note**: Currently unused but available for future profile features

#### `user_preferences` (12 rows)
**Purpose**: User application preferences

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | uuid | PRIMARY KEY, REFERENCES users(id) | User reference |
| `default_country` | text | NULL | Default country preference |
| `map_style` | text | NULL | Map style preference |
| `tts_voice` | text | NULL | Text-to-speech voice |
| `stt_language` | text | NULL | Speech-to-text language |
| `flags` | jsonb | DEFAULT '{}' | Feature flags |
| `updated_at` | timestamptz | DEFAULT now() | Last update timestamp |

**RLS**: Enabled
**Indexes**: Primary key
**Note**: Currently used for storing user preferences

### 3. Explore Functionality

#### `explore_places` (35 rows)
**Purpose**: Places discovered through explore functionality

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Place identifier |
| `user_id` | uuid | REFERENCES auth.users(id) | User who discovered |
| `name` | text | NOT NULL | Place name |
| `full_name` | text | NOT NULL | Full place name |
| `longitude` | numeric | NOT NULL | Longitude coordinate |
| `latitude` | numeric | NOT NULL | Latitude coordinate |
| `category` | text | NULL | Place category |
| `context` | text | NULL | Additional context |
| `notes` | text | NULL | User-authored notes |
| `links_json` | jsonb | DEFAULT '[]' | Saved resource links |
| `metadata` | jsonb | NULL | Provider/source metadata |
| `is_favorite` | boolean | DEFAULT false | Favorite flag |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | DEFAULT now() | Last update timestamp |

**RLS**: Enabled
**Indexes**: Primary key, user_id foreign key
**Note**: Stores full card state including notes, links, and favorite toggle

### 4. Content Caching

#### `destination_modal_content` (27 rows)
**Purpose**: Cached AI-generated destination content

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Content identifier |
| `destination_name` | text | UNIQUE, NOT NULL | Destination name (cache key) |
| `destination_coordinates` | point | NULL | Destination coordinates |
| `destination_category` | text | NULL | Destination category |
| `summary` | text | NULL | Short summary |
| `general_information` | text | NULL | Rich overview (250-300 words) |
| `why_visit` | text[] | NULL | Array of reasons to visit |
| `key_facts` | jsonb | NULL | Key facts as JSON |
| `activities_attractions` | jsonb | NULL | Activities and attractions |
| `selected_tips` | jsonb | NULL | Curated local tips |
| `similar_places` | jsonb | NULL | Similar places within 200km |
| `metadata` | jsonb | DEFAULT '{}' | Additional metadata |
| `content_version` | integer | DEFAULT 1 | Content version |
| `ai_model` | text | NULL | AI model used |
| `tokens_used` | integer | NULL | Tokens consumed |
| `quality_score` | numeric | DEFAULT 0.0 | Content quality score |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | DEFAULT now() | Last update timestamp |
| `expires_at` | timestamptz | DEFAULT (now() + '24:00:00') | Cache expiration |
| `view_count` | integer | DEFAULT 0 | View count |
| `last_viewed_at` | timestamptz | NULL | Last view timestamp |
| `avg_quality_rating` | numeric | CHECK (0.0-1.0) | Average user rating |
| `user_feedback_count` | integer | DEFAULT 0 | Feedback count |

**RLS**: Enabled
**Indexes**: Primary key, destination_name unique index
**TTL**: 24 hours
**Note**: Comprehensive caching for AI-generated content

#### `destination_images` (239 rows)
**Purpose**: Cached destination images

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Image identifier |
| `destination_name` | text | NOT NULL | Destination name |
| `destination_coordinates` | point | NULL | Destination coordinates |
| `image_url` | text | NOT NULL | Image URL |
| `thumbnail_url` | text | NOT NULL | Thumbnail URL |
| `alt_text` | text | NULL | Alt text |
| `photographer` | text | NULL | Photographer name |
| `source` | text | CHECK (unsplash/pixabay) | Image source |
| `width` | integer | NULL | Image width |
| `height` | integer | NULL | Image height |
| `color` | text | NULL | Dominant color |
| `likes` | integer | DEFAULT 0 | Like count |
| `query_used` | text | NULL | Search query used |
| `display_order` | integer | DEFAULT 1 | Carousel position |
| `downloads` | integer | DEFAULT 0 | Download count |
| `tags` | text[] | DEFAULT '{}' | Image tags |
| `expires_at` | timestamptz | DEFAULT (now() + '7 days') | Cache expiration |
| `cached_at` | timestamptz | DEFAULT now() | Cache timestamp |
| `quality_score` | numeric | CHECK (0.0-1.0), DEFAULT 0.5 | Quality score |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | DEFAULT now() | Last update timestamp |

**RLS**: Enabled
**Indexes**: Primary key
**TTL**: 7 days
**Note**: Image caching with quality scoring

### 5. System Tables

#### `spatial_ref_sys` (0 rows)
**Purpose**: PostGIS spatial reference system

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `srid` | integer | PRIMARY KEY, CHECK (srid > 0 AND srid <= 998999) | Spatial reference ID |
| `auth_name` | varchar | NULL | Authority name |
| `auth_srid` | integer | NULL | Authority SRID |
| `srtext` | varchar | NULL | Spatial reference text |
| `proj4text` | varchar | NULL | PROJ4 text |

**RLS**: Disabled
**Note**: PostGIS system table, required for geospatial operations

## Unused Tables (From Previous Projects)

### Journey System Tables
- `journeys` - Journey templates
- `journey_destinations` - Journey destination stops
- `journey_seasons` - Seasonal information
- `journey_match_reasons` - Match reasons
- `journey_special_features` - Special features
- `journey_media` - Journey media
- `journey_map_config` - Map configuration
- `journey_image_variations` - Image variations
- `ui_content` - UI content

### POI System Tables
- `pois` - Points of interest
- `destinations` - Destination master data
- `regions` - Regional data
- `zones` - Zone data
- `countries` - Country data

### Conversation System Tables
- `conversations` - Chat conversations
- `messages` - Chat messages
- `via_sessions` - Via chat sessions
- `via_messages` - Via chat messages
- `via_command_cache` - Command cache
- `via_simple_conversations` - Simple conversations
- `via_simple_messages` - Simple messages

### Assessment System Tables
- `user_assessments` - User assessments
- `user_area_scores` - Area scores

### Content System Tables
- `enhanced_zone_content` - Enhanced zone content
- `destination_content` - Destination content
- `content_embeddings` - Content embeddings

### Analytics Tables
- `trip_analytics` - Trip analytics
- `user_interactions` - User interactions
- `map_views` - Map views

### Export System Tables
- `export_history` - Export history

### AI Cache Tables
- `ai_content_cache` - AI content cache

### Other Tables
- `global_content` - Global content
- `storage_migration_plan` - Storage migration
- `country_discovery_data` - Country discovery data
- `zone_carousel_photos` - Zone carousel photos
- `user_trip_preferences` - User trip preferences

## Schema Issues Identified

### 1. Data Type Alignment
- `trip_destinations.links_json` is JSONB; ensure service-layer serializers remain in sync with `LocationLink[]` typings.
- `trip_days.base_locations_json` is authoritative for base locations; legacy single-location columns remain for backward compatibility.

### 2. Column Coverage
- Core tables now expose required fields (e.g., `explore_places` notes/links/favorites). Monitor future features for additional attributes.

### 3. Hybrid Schemas
- `trip_days` has both legacy single location and new array structure
- Need to migrate to consistent array structure

### 4. Unused Tables
- 28+ tables from previous projects taking up space
- Should be cleaned up for better performance

## Recommendations for Codex

1. **Keep Serializers in Sync**: Maintain JSON (links/base locations) conversion helpers alongside type updates.
2. **Retire Legacy Columns**: Plan migration to drop `base_location_*` once clients fully rely on `base_locations_json`.
3. **Clean Up Unused Tables**: Remove historical tables to simplify backups and tooling.
4. **Activate Analytics Tables**: Implement usage tracking leveraging `trip_analytics`, `user_interactions`, `map_views`.

This schema documentation provides Codex with complete understanding of the database structure and current state.
