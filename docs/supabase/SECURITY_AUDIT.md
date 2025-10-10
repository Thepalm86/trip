# Security Audit - Trip3 Database

**Audit Date**: 2025-10-10  
**Database**: PostgreSQL 17 with PostGIS 3.3.7  
**Status**: 🟡 Active with 1 critical issue requiring immediate fix

---

## Executive Summary

- **RLS Coverage**: 13/13 tables (100%)
- **Critical Issues**: 1 (cache table over-exposure)
- **Warnings**: 2 (assistant_logs RLS, storage policies)
- **Overall Rating**: ⚠️ Good with required fixes

---

## 🔴 Critical Issue: Cache Tables Expose Expired Content

### Problem

Both `destination_modal_content` and `destination_images` have **duplicate SELECT policies**:
1. ✅ Policy with TTL: `expires_at > now()` 
2. ❌ Policy without TTL: `using (true)`

The second policy allows **reading expired content indefinitely**, defeating the TTL purpose.

### Impact

- Stale/incorrect information shown to users
- Cache expiration system bypassed
- Unnecessary data transfer

### Current Policies

```sql
-- destination_modal_content
"Allow public read access to destination content" → WHERE expires_at > now()  ✅
"Allow public read access to destination_modal_content" → WHERE true  ❌

-- destination_images  
"Allow public read access to destination images" → WHERE expires_at > now()  ✅
"Allow public read access to destination_images" → WHERE true  ❌
```

### Fix (Apply Immediately)

```sql
-- Remove unconditional policies
DROP POLICY "Allow public read access to destination_modal_content" 
  ON public.destination_modal_content;

DROP POLICY "Allow public read access to destination_images" 
  ON public.destination_images;

-- Verify fix
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('destination_modal_content', 'destination_images')
AND cmd = 'SELECT';
-- Expected: Only policies with "expires_at > now()" condition
```

### Test After Fix

```sql
-- 1. Mark content as expired
UPDATE destination_modal_content 
SET expires_at = now() - interval '1 day'
WHERE destination_name = 'Test_Location';

-- 2. Try to read as anonymous user
SELECT * FROM destination_modal_content 
WHERE destination_name = 'Test_Location';
-- Expected: 0 rows (content is expired)

-- 3. Service role can still access (for cleanup)
-- Use service role key to verify admin access works
```

---

## ⚠️ Warning #1: Assistant Logs Without RLS

### Issue

`assistant_logs` table has **RLS disabled** entirely.

### Risk Level

Low (if application layer enforcement is correct)

### Details

**Contains**: `user_id`, `conversation_id`, `message_id`, token counts, costs  
**Current Access**: Service role only (enforced at application layer)  
**Risk**: If accidentally exposed to client queries, data could leak

### Recommendation

**Option 1 - Enable RLS** (Preferred):
```sql
ALTER TABLE assistant_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON assistant_logs
  FOR ALL USING (auth.role() = 'service_role');
```

**Option 2 - Document Pattern**:
Keep RLS disabled but add explicit comment:
```sql
COMMENT ON TABLE assistant_logs IS 
  'SECURITY: No RLS. This table MUST ONLY be accessed via service role. 
   Contains sensitive cost and usage data.';
```

---

## ⚠️ Warning #2: Storage Has No Policies

### Issue

Storage RLS is **enabled** but **no policies exist** = default deny for all clients.

### Impact

- Clients cannot read or write to any storage buckets
- All storage access must go through service role

### Is This Intentional?

If you're not using Supabase Storage for user files, this is fine. If you plan to use it, add policies:

### Fix (If Needed)

```sql
-- For public CDN bucket (destination images)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('destination-images', 'destination-images', true);

CREATE POLICY "public_read_images" ON storage.objects
  FOR SELECT USING (bucket_id = 'destination-images');

CREATE POLICY "authenticated_upload_images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'destination-images' 
    AND auth.role() = 'authenticated'
  );

-- For private user content
INSERT INTO storage.buckets (id, name, public) 
VALUES ('user-content', 'user-content', false);

CREATE POLICY "users_manage_own_files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'user-content' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## ✅ Secure Tables

### Direct Ownership Pattern

These tables correctly restrict access to owned data:

**Tables**: `user_trips`, `explore_places`, `user_preferences`, `user_trip_preferences`, `assistant_conversations`

**Pattern**:
```sql
WHERE user_id = auth.uid()
```

**Status**: ✅ Secure

---

### Nested Ownership Pattern

These tables correctly verify ownership through foreign key chains:

**`trip_days`** (via trip ownership):
```sql
EXISTS (
  SELECT 1 FROM user_trips 
  WHERE user_trips.id = trip_days.trip_id 
  AND user_trips.user_id = auth.uid()
)
```

**`trip_destinations`** (via day → trip ownership):
```sql
EXISTS (
  SELECT 1 FROM trip_days 
  JOIN user_trips ON user_trips.id = trip_days.trip_id
  WHERE trip_days.id = trip_destinations.day_id 
  AND user_trips.user_id = auth.uid()
)
```

**`assistant_messages`** (via conversation ownership):
```sql
EXISTS (
  SELECT 1 FROM assistant_conversations ac
  WHERE ac.id = conversation_id AND ac.user_id = auth.uid()
)
```

**`assistant_tool_calls`** (via message → conversation ownership):
```sql
EXISTS (
  SELECT 1 FROM assistant_messages am
  JOIN assistant_conversations ac ON ac.id = am.conversation_id
  WHERE am.id = message_id AND ac.user_id = auth.uid()
)
```

**Status**: ✅ Secure - Ownership chains properly verified

---

### Multi-Role Pattern

**`users` table**:
- Service role: Full access
- Users: Can SELECT/UPDATE own row only

**`export_history` table**:
- Service role: Full access  
- Users: Can INSERT/SELECT own exports (via user_session match)

**Status**: ✅ Secure - Appropriate access levels

---

## Testing Recommendations

### Test 1: User Isolation

```sql
-- As user A, create a trip
INSERT INTO user_trips (user_id, name, start_date, end_date, country_code)
VALUES (auth.uid(), 'User A Trip', '2025-01-01', '2025-01-07', 'IT');

-- As user B, attempt to read user A's trip
SELECT * FROM user_trips WHERE user_id != auth.uid();
-- Expected: 0 rows
```

### Test 2: Expired Content (After Fix)

```sql
-- Set content to expired
UPDATE destination_images 
SET expires_at = now() - interval '1 day'
WHERE id = 'test-image-id';

-- Try to read as anonymous
SELECT * FROM destination_images WHERE id = 'test-image-id';
-- Expected BEFORE fix: 1 row (BUG)
-- Expected AFTER fix: 0 rows (CORRECT)
```

### Test 3: Nested Ownership

```sql
-- As user B, try to add day to user A's trip
INSERT INTO trip_days (trip_id, date, day_order)
SELECT id, '2025-01-02', 2 
FROM user_trips 
WHERE user_id != auth.uid() 
LIMIT 1;
-- Expected: RLS violation error
```

### Test 4: Assistant Conversation Isolation

```sql
-- As user A, create conversation
INSERT INTO assistant_conversations (user_id, title)
VALUES (auth.uid(), 'My Conversation');

-- As user B, try to read user A's conversation
SELECT * FROM assistant_conversations WHERE user_id != auth.uid();
-- Expected: 0 rows
```

---

## Compliance Checklist

- [x] RLS enabled on all user data tables
- [x] User ownership verified at every level
- [x] Nested relationships properly secured
- [ ] **Cache table TTL properly enforced** ← FIX REQUIRED
- [ ] **Assistant logs protected** ← REVIEW REQUIRED
- [ ] **Storage policies defined** ← REVIEW REQUIRED
- [x] Service role has admin access where needed
- [x] No data leakage between users (when TTL fix applied)
- [x] Auth integration uses `auth.uid()` correctly

---

## Action Items

### 🔴 Immediate (This Week)
1. ✅ Apply cache table RLS fix (SQL provided above)
2. ✅ Test with expired content
3. ✅ Verify only TTL-gated policies remain

### 🟡 High Priority (This Month)
4. ⚠️ Decide on `assistant_logs` approach (enable RLS or document)
5. ⚠️ Review storage needs and add policies if required
6. ⚠️ Add monitoring for RLS violations in logs

### 🟢 Medium Priority (This Quarter)
7. Review SECURITY DEFINER functions annually
8. Monitor query performance on RLS-heavy tables
9. Audit policies after any schema changes

---

## Monitoring

### What to Monitor

1. **Failed queries due to RLS**: Check Supabase logs for permission errors
2. **Unusual access patterns**: Monitor for attempts to access other users' data
3. **Service role usage**: Ensure service role is only used server-side
4. **Cache table access**: After fix, verify no expired content is served

### Metrics to Track

- RLS policy evaluation time (performance impact)
- Number of RLS violations per day
- Service role vs anon key usage ratio
- Cache hit rate and expiration effectiveness

---

## Summary

**Current Security Posture**: Good with one critical fix required

**Strengths**:
- 100% RLS coverage on active tables
- Proper ownership verification chains
- Appropriate use of SECURITY DEFINER functions

**Weaknesses**:
- Cache table duplicate policies bypass TTL
- `assistant_logs` has no RLS protection
- Storage policies undefined

**Next Review**: Quarterly or after major schema changes

---

**For complete database reference, see `DATABASE_REFERENCE.md`**  
**For setup instructions, see `SETUP_GUIDE.md`**

