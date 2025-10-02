# Supabase Project Overview - Traveal

## Project Information
- **Project Name**: Traveal
- **Project URL**: https://rvmbgnrmxtooutrqcnum.supabase.co
- **Database Type**: PostgreSQL with PostGIS extensions
- **Authentication**: Supabase Auth
- **RLS**: Row Level Security enabled on most tables

## Current Database State
- **Total Tables**: 40+ tables
- **Active Tables**: 12 tables (relevant to current Traveal project)
- **Unused Tables**: 28+ tables (from previous projects)
- **Total Rows**: ~1,200 rows across active tables

## Architecture Overview

### Frontend Integration
- **Framework**: Next.js 15 with App Router
- **State Management**: Zustand stores (`supabase-trip-store.ts`, `explore-store.ts`)
- **API Layer**: Next.js API routes + Supabase client
- **Authentication**: Supabase Auth with AuthGuard component

### Backend Services
- **Database**: PostgreSQL with PostGIS for geospatial data
- **Caching**: Destination content and image caching
- **AI Integration**: OpenAI API for destination overviews
- **External APIs**: Google Places, Unsplash, Pixabay

## Active Tables Summary

| Table | Rows | Purpose | Status |
|-------|------|---------|--------|
| `user_trips` | 125 | Core trip management | ✅ Active |
| `trip_days` | 593 | Trip day planning | ✅ Active |
| `trip_destinations` | 64 | Destination details | ✅ Active |
| `explore_places` | 35 | Explore functionality | ✅ Active |
| `destination_modal_content` | 27 | AI content caching | ✅ Active |
| `destination_images` | 239 | Image caching | ✅ Active |
| `users` | 86 | User management | ✅ Active |
| `user_preferences` | 12 | User settings | ✅ Active |
| `profiles` | 0 | User profiles | ✅ Active |
| `trip_destination_pois` | 0 | Junction table | ✅ Active |
| `trip_destination_destinations` | 0 | Junction table | ✅ Active |
| `spatial_ref_sys` | 0 | PostGIS system | ✅ Active |

## Unused Tables (From Previous Projects)
- Journey system tables (journeys, journey_destinations, etc.)
- POI system tables (pois, destinations, regions, zones, countries)
- Conversation system tables (conversations, messages, via_*)
- Assessment system tables (user_assessments, user_area_scores)
- Content system tables (enhanced_zone_content, destination_content)
- Analytics tables (trip_analytics, user_interactions, map_views)
- Export system tables (export_history)
- AI cache tables (ai_content_cache)

## Key Features Implemented

### 1. Trip Management
- Create, read, update, delete trips
- Multi-day trip planning
- Destination management per day
- Base location management
- Trip duplication and sharing

### 2. Explore Functionality
- Place search and discovery
- Favorite places management
- Recent searches
- Place categorization

### 3. Content Caching
- AI-generated destination overviews
- Image caching from Unsplash/Pixabay
- Quality scoring and filtering
- TTL-based expiration

### 4. User Management
- Supabase Auth integration
- User preferences storage
- Profile management
- Session management

## Data Flow Architecture

```
Frontend (Next.js) 
    ↓
API Routes (/api/*)
    ↓
Supabase Client
    ↓
PostgreSQL Database
    ↓
External APIs (OpenAI, Google, Unsplash)
```

## Security Model
- **RLS**: Enabled on all user-facing tables
- **Auth**: Supabase Auth with JWT tokens
- **API Security**: Authentication required for all API routes
- **Data Isolation**: User data isolated by user_id

## Performance Considerations
- **Caching**: Destination content cached for 24 hours
- **Image Caching**: Images cached for 7 days
- **Database Indexing**: Proper indexes on foreign keys
- **Query Optimization**: Efficient queries with proper joins

## Migration Status
- **Current State**: Hybrid architecture with some unused tables
- **Recommended Action**: Clean up unused tables to improve performance
- **Data Safety**: All data preserved in archive project

## Next Steps for Codex
1. Review the detailed table schemas in `SUPABASE_TABLE_SCHEMAS.md`
2. Understand API integration patterns in `SUPABASE_API_INTEGRATION.md`
3. Review data relationships in `SUPABASE_DATA_RELATIONSHIPS.md`
4. Check functions and policies in `SUPABASE_FUNCTIONS_POLICIES.md`

This documentation provides Codex with complete visibility into the Supabase project structure and current state.
