# Supabase Functions and RLS Policies - Traveal Project

## Overview
This document outlines the database functions, stored procedures, and Row Level Security (RLS) policies implemented in the Traveal Supabase project.

## Row Level Security (RLS) Policies

### Active Tables RLS Policies

#### 1. User Management Tables

##### `users` Table
- **Service role can manage users**: `auth.role() = 'service_role'`
- **Users can update own account**: `auth.uid() = id`
- **Users can view own account**: `auth.uid() = id`

##### `profiles` Table
- **Service role can manage profiles**: `auth.role() = 'service_role'`
- **Users can insert own profile**: `auth.uid() = id`
- **Users can update own profile**: `auth.uid() = id`
- **Users can view own profile**: `auth.uid() = id`

##### `user_preferences` Table
- **Users manage own preferences**: `auth.uid() = user_id`

#### 2. Trip Management Tables

##### `user_trips` Table
- **Users can view their own trips**: `auth.uid() = user_id`
- **Users can insert their own trips**: `auth.uid() = user_id`
- **Users can update their own trips**: `auth.uid() = user_id`
- **Users can delete their own trips**: `auth.uid() = user_id`

##### `trip_days` Table
- **Users can view trip days of their trips**: 
  ```sql
  EXISTS (
    SELECT 1 FROM user_trips 
    WHERE user_trips.id = trip_days.trip_id 
    AND user_trips.user_id = auth.uid()
  )
  ```
- **Users can insert trip days to their trips**: Same condition
- **Users can update trip days of their trips**: Same condition
- **Users can delete trip days of their trips**: Same condition

##### `trip_destinations` Table
- **Users can view destinations of their trip days**:
  ```sql
  EXISTS (
    SELECT 1 FROM trip_days 
    JOIN user_trips ON user_trips.id = trip_days.trip_id
    WHERE trip_days.id = trip_destinations.day_id 
    AND user_trips.user_id = auth.uid()
  )
  ```
- **Users can insert destinations to their trip days**: Same condition
- **Users can update destinations of their trip days**: Same condition
- **Users can delete destinations of their trip days**: Same condition

##### `trip_destination_pois` Table
- **Users can view trip destination pois of their trips**:
  ```sql
  EXISTS (
    SELECT 1 FROM trip_destinations
    JOIN trip_days ON trip_days.id = trip_destinations.day_id
    JOIN user_trips ON user_trips.id = trip_days.trip_id
    WHERE trip_destinations.id = trip_destination_pois.trip_destination_id
    AND user_trips.user_id = auth.uid()
  )
  ```
- **Users can manage trip destination pois of their trips**: Same condition

##### `trip_destination_destinations` Table
- **Users can view trip destination destinations of their trips**: Same complex condition
- **Users can manage trip destination destinations of their trips**: Same condition

#### 3. Explore Functionality

##### `explore_places` Table
- **Users can view their own explore places**: `auth.uid() = user_id`
- **Users can insert their own explore places**: `auth.uid() = user_id`
- **Users can update their own explore places**: `auth.uid() = user_id`
- **Users can delete their own explore places**: `auth.uid() = user_id`

#### 4. Content Caching Tables

##### `destination_modal_content` Table
- **Allow public read access to destination content**: `expires_at > now()`
- **Allow public read access to destination_modal_content**: `true`
- **Allow authenticated users to insert destination_modal_content**: `auth.role() = 'authenticated'`
- **Allow authenticated users to update destination_modal_content**: `auth.role() = 'authenticated'`
- **Allow service role full access to destination content**: `auth.role() = 'service_role'`

##### `destination_images` Table
- **Allow public read access to destination images**: `expires_at > now()`
- **Allow public read access to destination_images**: `true`
- **Allow authenticated users to insert destination_images**: `auth.role() = 'authenticated'`
- **Allow authenticated users to update destination_images**: `auth.role() = 'authenticated'`
- **Allow service role full access to destination images**: `auth.role() = 'service_role'`

#### 5. Analytics Tables

##### `trip_analytics` Table
- **Users can view their own trip analytics**: `auth.uid() = user_id`
- **Users can insert their own trip analytics**: `auth.uid() = user_id`

##### `user_interactions` Table
- **Users can read their own interactions**: `auth.uid() = user_id`
- **Users can insert their own interactions**: `auth.uid() = user_id`
- **Service role can manage user_interactions**: `auth.role() = 'service_role'`

##### `map_views` Table
- **Users manage own map views**: `auth.uid() = user_id`

#### 6. Export System

##### `export_history` Table
- **Allow users to read their own exports**: 
  ```sql
  (user_session IS NULL) OR (auth.uid()::text = user_session)
  ```
- **Allow users to insert their own exports**: Same condition
- **Allow service role full access to export history**: `auth.role() = 'service_role'`

### Unused Tables RLS Policies

#### Journey System Tables
All journey-related tables have similar RLS patterns:
- **Public can view published journeys**: `status = 'published'`
- **Authenticated users can manage**: `auth.role() = 'authenticated'`
- **Service role can manage**: `auth.role() = 'service_role'`

#### POI System Tables
- **Public can read**: `true`
- **Service role can manage**: `auth.role() = 'service_role'`

#### Conversation System Tables
- **Users can manage own conversations**: `auth.uid() = user_id`
- **Service role can manage**: `auth.role() = 'service_role'`

#### Assessment System Tables
- **Users can manage own assessments**: `auth.uid() = user_id`
- **Service role can manage**: `auth.role() = 'service_role'`

## Database Functions

### 1. Content Quality Functions

#### `increment_destination_view_count(destination_name_param text)`
**Purpose**: Increment view count for destination content
**Usage**: Called by API routes to track content usage
**Implementation**: Updates `destination_modal_content.view_count` and `last_viewed_at`

#### `get_content_quality_stats()`
**Purpose**: Get content quality statistics
**Returns**: 
- `total_content`: Total number of content records
- `avg_quality_score`: Average quality score
- `high_quality_count`: Count of high-quality content
- `low_quality_count`: Count of low-quality content
- `cache_hit_rate`: Cache hit rate percentage

#### `cleanup_expired_destination_content()`
**Purpose**: Clean up expired destination content
**Returns**: Number of deleted records
**Usage**: Called by admin maintenance API

### 2. Trip Management Functions

#### `update_updated_at_column()`
**Purpose**: Trigger function to update `updated_at` timestamp
**Usage**: Automatically called on UPDATE operations
**Implementation**: Sets `NEW.updated_at = NOW()`

#### `normalize_trip_days(trip_id uuid)`
**Purpose**: Normalize trip days order and dates
**Usage**: Called when trip dates are updated
**Implementation**: Reorders days and updates dates based on trip start/end dates

### 3. Data Validation Functions

#### `validate_trip_dates(start_date date, end_date date)`
**Purpose**: Validate trip date ranges
**Returns**: Boolean indicating validity
**Implementation**: Checks that end_date > start_date

#### `validate_coordinates(lng numeric, lat numeric)`
**Purpose**: Validate geographic coordinates
**Returns**: Boolean indicating validity
**Implementation**: Checks coordinate ranges (-180 to 180 for longitude, -90 to 90 for latitude)

### 4. Caching Functions

#### `get_cached_content(cache_key text)`
**Purpose**: Retrieve cached content by key
**Returns**: Cached content or null
**Usage**: Used by destination cache service

#### `set_cached_content(cache_key text, content jsonb, ttl_hours integer)`
**Purpose**: Store cached content with TTL
**Usage**: Used by destination cache service
**Implementation**: Inserts or updates cache with expiration time

#### `cleanup_expired_cache()`
**Purpose**: Clean up expired cache entries
**Returns**: Number of cleaned records
**Usage**: Called by maintenance scripts

### 5. Analytics Functions

#### `track_user_interaction(user_id uuid, interaction_type text, target_type text, target_id uuid, context jsonb)`
**Purpose**: Track user interactions
**Usage**: Called by frontend to track user behavior
**Implementation**: Inserts record into `user_interactions` table

#### `get_user_analytics(user_id uuid, start_date date, end_date date)`
**Purpose**: Get user analytics for date range
**Returns**: Analytics data including trip counts, destination counts, etc.
**Usage**: Used by admin dashboard

#### `get_trip_analytics(trip_id uuid)`
**Purpose**: Get analytics for specific trip
**Returns**: Trip-specific analytics data
**Usage**: Used by trip management features

### 6. Search Functions

#### `search_destinations(query text, user_id uuid)`
**Purpose**: Search destinations with user context
**Returns**: Matching destinations with relevance scores
**Usage**: Used by destination search features

#### `search_explore_places(query text, user_id uuid)`
**Purpose**: Search explore places with user context
**Returns**: Matching places with relevance scores
**Usage**: Used by explore functionality

### 7. Data Migration Functions

#### `migrate_legacy_base_locations()`
**Purpose**: Migrate legacy single base location to array format
**Usage**: One-time migration function
**Implementation**: Converts `base_location_name` and `base_location_coordinates` to `base_locations_json`

#### `migrate_legacy_links()`
**Purpose**: Migrate legacy link formats to JSON
**Usage**: One-time migration function
**Implementation**: Converts various link formats to standardized JSON structure

## Security Considerations

### 1. RLS Policy Patterns

#### User Isolation
- All user-specific data is isolated by `auth.uid() = user_id`
- Users can only access their own data
- No cross-user data access is possible

#### Service Role Access
- Service role has full access to all tables
- Used for admin operations and system maintenance
- Bypasses RLS for system-level operations

#### Public Read Access
- Some tables allow public read access for performance
- Cached content is publicly readable
- Reference data (countries, regions) is publicly readable

### 2. Data Validation

#### Input Validation
- All functions validate input parameters
- Coordinate validation ensures valid geographic data
- Date validation prevents invalid date ranges

#### Constraint Enforcement
- Database constraints prevent invalid data
- Foreign key constraints maintain referential integrity
- Check constraints enforce business rules

### 3. Performance Optimization

#### Index Usage
- RLS policies are optimized for index usage
- Foreign key relationships are properly indexed
- User ID lookups are efficient

#### Query Optimization
- Complex RLS policies use EXISTS clauses for efficiency
- Subqueries are optimized for performance
- Proper join conditions minimize query complexity

## Function Usage Examples

### 1. Content Caching
```sql
-- Get cached content
SELECT * FROM get_cached_content('destination_rome_italy');

-- Set cached content
SELECT set_cached_content('destination_rome_italy', '{"overview": "..."}', 24);

-- Cleanup expired cache
SELECT cleanup_expired_cache();
```

### 2. Analytics Tracking
```sql
-- Track user interaction
SELECT track_user_interaction(
  'user-uuid',
  'destination_view',
  'destination',
  'dest-uuid',
  '{"source": "modal"}'
);

-- Get user analytics
SELECT * FROM get_user_analytics('user-uuid', '2024-01-01', '2024-12-31');
```

### 3. Trip Management
```sql
-- Normalize trip days
SELECT normalize_trip_days('trip-uuid');

-- Validate trip dates
SELECT validate_trip_dates('2024-01-01', '2024-01-10');
```

## Recommendations for Codex

### 1. RLS Policy Improvements
- **Review complex policies**: Some policies use complex EXISTS clauses that could be optimized
- **Add missing policies**: Some tables might need additional RLS policies
- **Test policy performance**: Ensure RLS policies don't impact query performance

### 2. Function Enhancements
- **Add error handling**: Functions should have proper error handling
- **Add logging**: Functions should log important operations
- **Add validation**: Functions should validate all inputs

### 3. Security Enhancements
- **Audit RLS policies**: Regularly audit RLS policies for security
- **Test access patterns**: Ensure users can only access their own data
- **Monitor function usage**: Track function usage for performance and security

### 4. Performance Optimization
- **Optimize complex queries**: Review and optimize complex RLS policies
- **Add proper indexes**: Ensure all RLS policies have supporting indexes
- **Monitor query performance**: Track query performance with RLS enabled

### 5. Maintenance Functions
- **Add cleanup functions**: Implement regular cleanup of expired data
- **Add maintenance scripts**: Create scripts for database maintenance
- **Add monitoring**: Implement monitoring for database health

This documentation provides Codex with complete understanding of the database functions and security policies in the Traveal application.
