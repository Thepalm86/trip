# Supabase Schema Changelog

This document tracks all schema changes to the Trip3 Supabase database.

---

## 2025-10-11

### Added Dietary and Tags Columns

**Migration**: `add_dietary_and_tags_columns`

**Changes**:
1. Added `user_trip_preferences.dietary` (text[])
   - Purpose: Store dietary restrictions and requirements
   - Used by: Assistant to respect food constraints when suggesting restaurants/activities
   - Example values: `['vegetarian', 'vegan', 'gluten-free', 'halal', 'kosher']`

2. Added `destination_modal_content.tags` (text[])
   - Purpose: Tag metadata for content categorization and filtering
   - Used by: Assistant when summarizing and filtering nearby attractions
   - Example values: `['family-friendly', 'nightlife', 'historical', 'romantic', 'adventure']`
   - Includes GIN index for fast array searches

**Reason**: These columns were being queried by the application code but didn't exist in the database, causing warning logs and missing functionality.

**Impact**: 
- ✅ Eliminates remaining Supabase query warnings
- ✅ Enables dietary-aware recommendations
- ✅ Better content filtering and categorization
- ✅ No breaking changes (columns are nullable)

---

## 2025-10-11

### Added Missing Columns for Assistant Features

**Migration**: `add_missing_columns_accessibility_display_name`

**Changes**:
1. Added `user_trip_preferences.accessibility` (text[])
   - Purpose: Store user accessibility requirements for trip planning
   - Used by: Assistant context service for personalized recommendations
   - Example values: `['step-free', 'wheelchair-accessible', 'hearing-impaired-friendly']`

2. Added `destination_modal_content.display_name` (text)
   - Purpose: Human-friendly display name for destinations
   - Used by: Knowledge retrieval for cleaner presentation
   - Example: "Uffizi Galleries" vs "Uffizi Galleries_Firenze_tourist_attraction"
   - Includes index for faster lookups when not null

**Reason**: These columns were being queried by the application code but didn't exist in the database, causing warning logs and missing functionality.

**Impact**: 
- ✅ Eliminates Supabase query warnings
- ✅ Enables accessibility-aware trip planning
- ✅ Improves destination name presentation
- ✅ No breaking changes (columns are nullable)

---

## 2025-10-11

### Security Fix: Cache Table RLS

**Migration**: `fix_cache_table_rls_security`

**Changes**:
- Removed duplicate SELECT policies on `destination_modal_content` and `destination_images`
- Both tables had a policy with `qual = true` that bypassed TTL expiration
- Now only TTL-gated policies remain (`expires_at > now()`)

**Reason**: Critical security issue - expired content was accessible to clients

**Impact**:
- ✅ Expired content now properly blocked
- ✅ TTL system working as designed
- 🔒 Security posture improved

---

## 2025-10-11

### Added Content Embeddings for Semantic Search

**Migration**: `create_content_embeddings_table`

**Changes**:
1. Created `content_embeddings` table
   - Stores vector embeddings (1536 dimensions) for semantic search
   - Uses OpenAI text-embedding-3-small model
   - IVFFlat index for fast cosine similarity
   - RLS enabled (service role only)

2. Created `match_content_embeddings()` function
   - Returns content similar to query embedding
   - Parameters: query_embedding, match_threshold, match_count
   - Returns: id, title, snippet, url, tags, metadata, similarity

3. Seeded with 10 destinations from `destination_modal_content`

**Reason**: Enable semantic knowledge retrieval for assistant

**Impact**:
- ✅ Assistant can find relevant content by meaning, not just keywords
- ✅ Better context-aware responses
- ✅ Foundation for RAG (Retrieval-Augmented Generation)

---

## Prior to 2025-10-11

Schema history not formally tracked. See `DATABASE_REFERENCE.md` for current complete schema documentation.

---

## Migration Naming Convention

Pattern: `<date>_<descriptive_name>`
- Use snake_case
- Keep descriptive but concise
- Include date prefix for chronological ordering

Examples:
- ✅ `add_missing_columns_accessibility_display_name`
- ✅ `fix_cache_table_rls_security`
- ✅ `create_content_embeddings_table`
- ❌ `fix` (too vague)
- ❌ `addColumns` (use snake_case)

---

## Rollback Procedures

### Rollback: add_dietary_and_tags_columns

```sql
-- Remove added columns
ALTER TABLE public.user_trip_preferences DROP COLUMN IF EXISTS dietary;
ALTER TABLE public.destination_modal_content DROP COLUMN IF EXISTS tags;
DROP INDEX IF EXISTS idx_destination_modal_content_tags;
```

**Impact**: Application will continue working (code handles missing columns gracefully), but warnings will return.

### Rollback: add_missing_columns_accessibility_display_name

```sql
-- Remove added columns
ALTER TABLE public.user_trip_preferences DROP COLUMN IF EXISTS accessibility;
ALTER TABLE public.destination_modal_content DROP COLUMN IF EXISTS display_name;
DROP INDEX IF EXISTS idx_destination_modal_content_display_name;
```

**Impact**: Application will continue working (code handles missing columns gracefully), but warnings will return.

### Rollback: fix_cache_table_rls_security

**⚠️ NOT RECOMMENDED** - Would reintroduce security vulnerability.

If absolutely necessary:
```sql
-- Re-add the problematic policies (NOT RECOMMENDED)
CREATE POLICY "Allow public read access to destination_modal_content" 
  ON public.destination_modal_content FOR SELECT USING (true);

CREATE POLICY "Allow public read access to destination_images" 
  ON public.destination_images FOR SELECT USING (true);
```

### Rollback: create_content_embeddings_table

```sql
-- Remove table and function
DROP FUNCTION IF EXISTS public.match_content_embeddings(vector(1536), float, int);
DROP TABLE IF EXISTS public.content_embeddings;
```

**Impact**: Semantic search will not work, but assistant will continue functioning with basic knowledge retrieval.

---

## See Also

- **Current Schema**: `DATABASE_REFERENCE.md`
- **Setup Guide**: `SETUP_GUIDE.md`
- **Security Audit**: `SECURITY_AUDIT.md`

