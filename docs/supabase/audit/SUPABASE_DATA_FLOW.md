# Supabase Data Flow and Relationships - Traveal Project

## Overview
This document outlines the data flow patterns, relationships, and data transformations in the Traveal application's Supabase integration.

## Entity Relationship Diagram

```
auth.users (Supabase Auth)
    ↓
users (Application Users)
    ↓
user_trips (Trips)
    ↓
trip_days (Days)
    ↓
trip_destinations (Destinations)

explore_places (Explore Places)
    ↓
auth.users (Supabase Auth)

destination_modal_content (Cached Content)
destination_images (Cached Images)
```

## Data Flow Patterns

### 1. Trip Creation Flow

```
User Input (Frontend)
    ↓
useSupabaseTripStore.createTrip()
    ↓
tripApi.createTrip()
    ↓
Supabase: INSERT INTO user_trips
    ↓
Database: user_trips table
    ↓
Response: trip_id
    ↓
Frontend: Update local state
    ↓
UI: Show new trip
```

#### Detailed Flow:
1. **User Action**: User clicks "Create Trip" button
2. **State Management**: `useSupabaseTripStore.createTrip()` called
3. **API Call**: `tripApi.createTrip()` with trip data
4. **Authentication**: Verify user authentication
5. **Data Conversion**: Convert app types to database types
6. **Database Insert**: Insert into `user_trips` table
7. **Response**: Return new trip ID
8. **State Update**: Update local Zustand state
9. **UI Update**: Re-render components with new trip

### 2. Destination Addition Flow

```
User Input (Frontend)
    ↓
useSupabaseTripStore.addDestinationToDay()
    ↓
tripApi.addDestinationToDay()
    ↓
Supabase: INSERT INTO trip_destinations
    ↓
Database: trip_destinations table
    ↓
Response: destination object
    ↓
Frontend: Update local state
    ↓
UI: Show new destination
```

#### Detailed Flow:
1. **User Action**: User adds destination to day
2. **State Management**: `useSupabaseTripStore.addDestinationToDay()` called
3. **API Call**: `tripApi.addDestinationToDay()` with destination data
4. **Data Conversion**: Convert `Destination` to `DatabaseDestination`
5. **Database Insert**: Insert into `trip_destinations` table
6. **Response**: Return created destination
7. **State Update**: Update local state with new destination
8. **UI Update**: Re-render timeline with new destination

### 3. Explore Places Flow

```
User Search (Frontend)
    ↓
useExploreStore.searchPlaces()
    ↓
API: /api/places/search
    ↓
Google Places API
    ↓
Response: Search results
    ↓
Frontend: Display results
    ↓
User Selection
    ↓
useExploreStore.addActivePlace()
    ↓
exploreApiService.addExplorePlace()
    ↓
Supabase: INSERT INTO explore_places
    ↓
Database: explore_places table
```

#### Detailed Flow:
1. **User Search**: User types in search box
2. **API Call**: Call Google Places API via Next.js API route
3. **Results**: Return formatted search results
4. **Display**: Show results in UI
5. **User Selection**: User clicks on a place
6. **State Management**: Add to active places
7. **Database**: Persist to `explore_places` table
8. **Sync**: Update local state

### 4. Content Caching Flow

```
User Request (Frontend)
    ↓
API: /api/destination/overview
    ↓
DestinationCacheService.getCachedOverview()
    ↓
Supabase: SELECT FROM destination_modal_content
    ↓
Cache Hit?
    ↓
Yes: Return cached content
    ↓
No: Generate with OpenAI
    ↓
DestinationCacheService.setCachedOverview()
    ↓
Supabase: INSERT/UPDATE destination_modal_content
    ↓
Response: Generated content
```

#### Detailed Flow:
1. **User Request**: User opens destination modal
2. **API Call**: Call `/api/destination/overview`
3. **Cache Check**: Check `destination_modal_content` table
4. **Cache Hit**: Return cached content if available and not expired
5. **Cache Miss**: Generate new content with OpenAI
6. **Cache Store**: Store generated content in database
7. **Response**: Return content to frontend
8. **Display**: Show content in modal

## Data Relationships

### 1. User Relationships

```
auth.users (Supabase Auth)
    ├── users (Application Users)
    │   ├── user_trips (User's Trips)
    │   ├── user_preferences (User Preferences)
    │   └── profiles (User Profiles)
    ├── explore_places (User's Explored Places)
    └── user_interactions (User Interactions)
```

#### Key Relationships:
- **One-to-Many**: `auth.users` → `user_trips`
- **One-to-One**: `auth.users` → `user_preferences`
- **One-to-One**: `auth.users` → `profiles`
- **One-to-Many**: `auth.users` → `explore_places`

### 2. Trip Relationships

```
user_trips (Trips)
    ├── trip_days (Days in Trip)
    │   ├── trip_destinations (Destinations per Day)
    │   │   ├── trip_destination_pois (POI Links)
    │   │   └── trip_destination_destinations (Destination Links)
    │   └── base_locations_json (Base Locations)
    └── trip_analytics (Trip Analytics)
```

#### Key Relationships:
- **One-to-Many**: `user_trips` → `trip_days`
- **One-to-Many**: `trip_days` → `trip_destinations`
- **Many-to-Many**: `trip_destinations` ↔ `pois` (via junction table)
- **Many-to-Many**: `trip_destinations` ↔ `destinations` (via junction table)

### 3. Content Relationships

```
destination_modal_content (Cached Content)
    ├── destination_images (Cached Images)
    └── ai_content_cache (AI Cache)
```

#### Key Relationships:
- **One-to-Many**: `destination_modal_content` → `destination_images`
- **Independent**: `ai_content_cache` (separate caching system)

## Data Transformations

### 1. Frontend to Database

#### Trip Transformation
```typescript
// Frontend Type
interface Trip {
  id: string
  name: string
  startDate: Date
  endDate: Date
  country: string
  totalBudget?: number
  days: TimelineDay[]
}

// Database Type
interface DatabaseTrip {
  id: string
  user_id: string
  name: string
  start_date: string
  end_date: string
  country_code: string
  total_budget?: number
  status: string
  notes?: string
  created_at: string
  updated_at: string
}
```

#### Destination Transformation
```typescript
// Frontend Type
interface Destination {
  id: string
  name: string
  coordinates: [number, number]
  links?: LocationLink[]
}

// Database Type
interface DatabaseDestination {
  id: string
  day_id: string
  name: string
  coordinates: string // "POINT(lng lat)"
  links_json?: string // JSON string
}
```

### 2. Database to Frontend

#### Coordinate Transformation
```typescript
// Database: "POINT(-122.4194 37.7749)"
// Frontend: [-122.4194, 37.7749]

function parseCoordinates(dbCoordinates: string): [number, number] {
  const match = dbCoordinates.match(/POINT\(([^)]+)\)/)
  if (!match) throw new Error('Invalid coordinate format')
  
  const [lng, lat] = match[1].split(' ').map(Number)
  return [lng, lat]
}
```

#### Links Transformation
```typescript
// Database: '{"id":"1","type":"website","url":"https://example.com"}'
// Frontend: [{ id: "1", type: "website", url: "https://example.com" }]

function parseLinks(linksJson: string | null): LocationLink[] {
  if (!linksJson) return []
  try {
    return JSON.parse(linksJson)
  } catch {
    return []
  }
}
```

## State Synchronization

### 1. Local State Management

#### Zustand Store Pattern
```typescript
interface SupabaseTripStore {
  // Local state
  currentTrip: Trip | null
  trips: Trip[]
  isLoading: boolean
  error: string | null
  
  // Actions
  loadTrips: () => Promise<void>
  createTrip: (trip: Omit<Trip, 'id'>) => Promise<string>
  addDestinationToDay: (destination: Destination, dayId: string) => Promise<void>
}
```

#### State Update Pattern
```typescript
// 1. Update local state immediately (optimistic update)
set({ isLoading: true })

// 2. Call API
const result = await tripApi.createTrip(trip)

// 3. Update local state with result
set({ 
  trips: [...trips, result],
  currentTrip: result,
  isLoading: false 
})

// 4. Handle errors
catch (error) {
  set({ 
    error: error.message,
    isLoading: false 
  })
}
```

### 2. Database Synchronization

#### Real-time Updates
```typescript
// Subscribe to changes
const subscription = supabase
  .channel('trip_changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'user_trips' },
    (payload) => {
      // Update local state based on database changes
      updateLocalState(payload)
    }
  )
  .subscribe()
```

#### Conflict Resolution
```typescript
// Handle conflicts between local and remote state
function resolveConflict(localState: Trip, remoteState: Trip): Trip {
  // Use remote state as source of truth
  // Merge local changes that haven't been persisted
  return {
    ...remoteState,
    // Preserve local changes that haven't been saved
    localChanges: getLocalChanges(localState)
  }
}
```

## Data Validation

### 1. Frontend Validation

#### Type Safety
```typescript
// Validate data before sending to API
function validateTrip(trip: Omit<Trip, 'id'>): string[] {
  const errors: string[] = []
  
  if (!trip.name.trim()) errors.push('Trip name is required')
  if (trip.startDate >= trip.endDate) errors.push('End date must be after start date')
  if (!trip.country) errors.push('Country is required')
  
  return errors
}
```

#### Runtime Validation
```typescript
// Validate API responses
function validateDestinationResponse(data: any): Destination {
  if (!data.id || !data.name || !data.coordinates) {
    throw new Error('Invalid destination data')
  }
  
  return {
    id: data.id,
    name: data.name,
    coordinates: parseCoordinates(data.coordinates),
    // ... other fields
  }
}
```

### 2. Database Validation

#### Constraints
```sql
-- Trip constraints
ALTER TABLE user_trips 
ADD CONSTRAINT check_dates 
CHECK (end_date > start_date);

-- Destination constraints
ALTER TABLE trip_destinations 
ADD CONSTRAINT check_coordinates 
CHECK (coordinates IS NOT NULL);
```

#### Triggers
```sql
-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_trips_updated_at 
BEFORE UPDATE ON user_trips 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Performance Considerations

### 1. Query Optimization

#### Efficient Queries
```typescript
// Good: Select only needed fields
const { data } = await supabase
  .from('user_trips')
  .select('id, name, start_date, end_date')
  .eq('user_id', userId)

// Bad: Select all fields
const { data } = await supabase
  .from('user_trips')
  .select('*')
  .eq('user_id', userId)
```

#### Proper Joins
```typescript
// Good: Use proper joins
const { data } = await supabase
  .from('user_trips')
  .select(`
    *,
    trip_days (
      *,
      trip_destinations (*)
    )
  `)
  .eq('user_id', userId)

// Bad: Multiple separate queries
const trips = await supabase.from('user_trips').select('*')
const days = await supabase.from('trip_days').select('*')
const destinations = await supabase.from('trip_destinations').select('*')
```

### 2. Caching Strategy

#### Content Caching
```typescript
// Cache destination content
const cacheKey = `${destination}_${city}_${category}`
const cached = await getCachedContent(cacheKey)

if (cached && !isExpired(cached)) {
  return cached.content
}

// Generate and cache new content
const content = await generateContent(destination, city, category)
await setCachedContent(cacheKey, content, TTL)
return content
```

#### Image Caching
```typescript
// Cache images with quality scoring
const images = await getCachedImages(destination)
if (images && images.length >= count) {
  return images.slice(0, count)
}

// Fetch and cache new images
const newImages = await fetchImages(destination, count)
await setCachedImages(destination, newImages)
return newImages
```

## Error Handling

### 1. API Error Handling

#### Client-side Errors
```typescript
try {
  const result = await tripApi.createTrip(trip)
  set({ trips: [...trips, result], error: null })
} catch (error) {
  if (error.code === '23505') {
    set({ error: 'Trip name already exists' })
  } else if (error.code === '23503') {
    set({ error: 'Invalid user reference' })
  } else {
    set({ error: 'Failed to create trip' })
  }
}
```

#### Server-side Errors
```typescript
try {
  const { data, error } = await supabase
    .from('user_trips')
    .insert(tripData)
  
  if (error) {
    console.error('Database error:', error)
    throw new Error(`Database error: ${error.message}`)
  }
  
  return data
} catch (error) {
  console.error('Trip creation failed:', error)
  throw error
}
```

### 2. Data Recovery

#### Rollback Strategy
```typescript
// Rollback on error
const originalState = get().currentTrip

try {
  await tripApi.updateTrip(tripId, updates)
  set({ currentTrip: updatedTrip })
} catch (error) {
  // Rollback to original state
  set({ currentTrip: originalState })
  set({ error: error.message })
}
```

#### Retry Logic
```typescript
// Retry failed operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  throw new Error('Max retries exceeded')
}
```

## Recommendations for Codex

### 1. Data Consistency
- **Implement proper data validation** at both frontend and backend
- **Add database constraints** to prevent invalid data
- **Implement proper error handling** for all data operations

### 2. Performance Optimization
- **Optimize database queries** with proper indexes and joins
- **Implement caching strategies** for frequently accessed data
- **Add pagination** for large datasets

### 3. State Management
- **Implement proper state synchronization** between local and remote state
- **Add conflict resolution** for concurrent updates
- **Implement optimistic updates** for better user experience

### 4. Error Recovery
- **Add retry logic** for failed operations
- **Implement rollback mechanisms** for failed updates
- **Add proper logging** for debugging

### 5. Data Integrity
- **Fix data serialization issues** for JSON fields
- **Implement proper data validation** at all layers
- **Add database triggers** for automatic updates

This documentation provides Codex with complete understanding of data flow and relationships in the Traveal application.
