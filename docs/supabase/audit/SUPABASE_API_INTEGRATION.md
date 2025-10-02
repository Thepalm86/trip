# Supabase API Integration Patterns - Traveal Project

## Overview
This document outlines how the Traveal frontend integrates with Supabase, including API patterns, data flow, and integration points.

## Client Configuration

### Supabase Client Setup
**File**: `lib/supabase/client.ts`
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Admin Client Setup
**File**: `lib/server/supabase-admin.ts`
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
```

## API Integration Patterns

### 1. Trip Management API

#### Service: `lib/supabase/trip-api.ts`
**Purpose**: CRUD operations for trip management

#### Key Functions:

##### `getUserTrips(): Promise<Trip[]>`
```typescript
async getUserTrips(): Promise<Trip[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const { data: trips, error } = await supabase
    .from('user_trips')
    .select(`
      *,
      trip_days (
        *,
        trip_destinations (*)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return trips.map(convertDatabaseTripToApp)
}
```

##### `createTrip(trip: Omit<Trip, 'id'>): Promise<string>`
```typescript
async createTrip(trip: Omit<Trip, 'id'>): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('user_trips')
    .insert(convertAppTripToDatabase(trip, user.id))
    .select('id')
    .single()

  if (error) throw error
  return data.id
}
```

##### `addDestinationToDay(dayId: string, destination: Destination): Promise<Destination>`
```typescript
async addDestinationToDay(dayId: string, destination: Destination): Promise<Destination> {
  const { data, error } = await supabase
    .from('trip_destinations')
    .insert(convertAppDestinationToDatabase(destination, dayId))
    .select('*')
    .single()

  if (error) throw error
  return convertDatabaseDestinationToApp(data)
}
```

#### Data Conversion Functions:

##### `convertDatabaseTripToApp(dbTrip: DatabaseTrip): Trip`
```typescript
function convertDatabaseTripToApp(dbTrip: DatabaseTrip): Trip {
  return {
    id: dbTrip.id,
    name: dbTrip.name,
    startDate: new Date(dbTrip.start_date),
    endDate: new Date(dbTrip.end_date),
    country: dbTrip.country_code,
    totalBudget: dbTrip.total_budget,
    days: dbTrip.trip_days?.map(convertDatabaseDayToApp) || []
  }
}
```

##### `convertAppDestinationToDatabase(destination: Destination, dayId: string): DatabaseDestination`
```typescript
function convertAppDestinationToDatabase(destination: Destination, dayId: string): DatabaseDestination {
  return {
    day_id: dayId,
    name: destination.name,
    description: destination.description,
    coordinates: `POINT(${destination.coordinates[0]} ${destination.coordinates[1]})`,
    city: destination.city,
    category: destination.category,
    rating: destination.rating,
    image_url: destination.imageUrl,
    estimated_duration_hours: destination.estimatedDuration,
    opening_hours: destination.openingHours,
    cost: destination.cost,
    notes: destination.notes,
    links_json: destination.links ? JSON.stringify(destination.links) : null
  }
}
```

### 2. Explore Places API

#### Service: `lib/supabase/explore-api.ts`
**Purpose**: CRUD operations for explore places

#### Key Functions:

##### `getExplorePlaces(): Promise<ExplorePlace[]>`
```typescript
async getExplorePlaces(): Promise<ExplorePlace[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('explore_places')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data.map(this.fromRecord)
}
```

##### `addExplorePlace(place: ExplorePlace): Promise<ExplorePlace>`
```typescript
async addExplorePlace(place: ExplorePlace): Promise<ExplorePlace> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const record = this.toRecord(place, user.id)
  const { data, error } = await supabase
    .from('explore_places')
    .insert(record)
    .select('*')
    .single()

  if (error) throw error
  return this.fromRecord(data)
}
```

#### Data Conversion:

##### `toRecord(place: ExplorePlace, userId: string): ExplorePlaceRecord`
```typescript
private toRecord(place: ExplorePlace, userId: string): Omit<ExplorePlaceRecord, 'created_at' | 'updated_at'> {
  return {
    id: place.id,
    user_id: userId,
    name: place.name,
    full_name: place.fullName,
    longitude: place.coordinates[0],
    latitude: place.coordinates[1],
    category: place.category,
    context: place.context
  }
}
```

### 3. Destination Caching API

#### Service: `lib/server/destination-cache.ts`
**Purpose**: Caching AI-generated content and images

#### Key Functions:

##### `getCachedOverview(destinationName: string, city?: string, category?: string)`
```typescript
static async getCachedOverview(
  destinationName: string,
  city?: string,
  category?: string
): Promise<{ overview: string; source: 'cache' | 'api' } | null> {
  const supabase = supabaseAdmin
  const destinationKey = `${destinationName}${city ? `_${city}` : ''}${category ? `_${category}` : ''}`

  const { data, error } = await supabase
    .from('destination_modal_content')
    .select('*')
    .eq('destination_name', destinationKey)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return { overview: data.general_information || data.summary || '', source: 'cache' }
}
```

##### `setCachedOverview(destinationName: string, city: string | undefined, category: string | undefined, overview: string, metadata: object)`
```typescript
static async setCachedOverview(
  destinationName: string,
  city: string | undefined,
  category: string | undefined,
  overview: string,
  metadata: object = {}
): Promise<void> {
  const supabase = supabaseAdmin
  const destinationKey = `${destinationName}${city ? `_${city}` : ''}${category ? `_${category}` : ''}`
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + this.CACHE_TTL_HOURS)

  const cacheData = {
    destination_name: destinationKey,
    destination_coordinates: metadata.coordinates ? {
      x: metadata.coordinates[0],
      y: metadata.coordinates[1]
    } : null,
    destination_category: category || null,
    summary: overview,
    general_information: overview,
    activities_attractions: metadata.activities || null,
    selected_tips: metadata.tips || null,
    similar_places: metadata.similarPlaces || null,
    metadata: { ...metadata },
    content_version: 1,
    quality_score: metadata.qualityScore || 0.8,
    expires_at: expiresAt.toISOString()
  }

  await supabase
    .from('destination_modal_content')
    .upsert(cacheData, { onConflict: 'destination_name' })
}
```

## API Routes Integration

### 1. Destination Overview API
**File**: `app/api/destination/overview/route.ts`

```typescript
export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request)
    
    const { destination, city, category } = await request.json()
    
    // Check cache first
    const cached = await DestinationCacheService.getCachedOverview(destination, city, category)
    if (cached) {
      return NextResponse.json({ overview: cached.overview, source: cached.source })
    }

    // Generate new content with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a knowledgeable travel writer..." },
        { role: "user", content: prompt }
      ],
      max_tokens: 600,
      temperature: 0.7
    })

    const overview = completion.choices[0]?.message?.content || ''
    
    // Cache the result
    await DestinationCacheService.setCachedOverview(destination, city, category, overview, metadata)
    
    return NextResponse.json({ overview, source: 'api' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate overview' }, { status: 500 })
  }
}
```

### 2. Destination Photos API
**File**: `app/api/destination/photos/route.ts`

```typescript
export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request)
    
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const count = parseInt(searchParams.get('count') || '10')

    // Check cache first
    const cached = await DestinationCacheService.getCachedImages(destinationName, city)
    if (cached && cached.images.length >= count) {
      return NextResponse.json({ photos: cached.images.slice(0, count), source: cached.source })
    }

    // Fetch from external APIs
    let photos: EnhancedPhoto[] = []
    
    // Try Unsplash first
    const unsplashResponse = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}`,
      { headers: { 'Authorization': `Client-ID ${process.env.NEXT_PUBLIC_UNSPLASH_KEY}` } }
    )
    
    if (unsplashResponse.ok) {
      const unsplashData = await unsplashResponse.json()
      photos = unsplashData.results.map(photo => enhancePhotoWithQuality(photo, 'unsplash'))
    }

    // Cache the results
    if (photos.length >= count) {
      await DestinationCacheService.setCachedImages(destinationName, city, photos)
    }

    return NextResponse.json({ photos: photos.slice(0, count), source: 'api' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
  }
}
```

## State Management Integration

### 1. Supabase Trip Store
**File**: `lib/store/supabase-trip-store.ts`

#### Key Patterns:

##### Loading Trips
```typescript
loadTrips: async () => {
  set({ isLoading: true, error: null })
  try {
    const trips = await tripApi.getUserTrips()
    set({ trips, currentTrip: trips[0] || null, isLoading: false })
  } catch (error) {
    set({ error: error.message, isLoading: false })
  }
}
```

##### Adding Destinations
```typescript
addDestinationToDay: async (destination: Destination, dayId: string) => {
  set({ isLoading: true, error: null })
  try {
    const createdDestination = await tripApi.addDestinationToDay(dayId, destination)
    
    // Update local state
    const { currentTrip, trips } = get()
    if (currentTrip) {
      const updatedTrip = {
        ...currentTrip,
        days: currentTrip.days.map(day =>
          day.id === dayId
            ? { ...day, destinations: [...day.destinations, createdDestination] }
            : day
        )
      }
      set({ currentTrip: updatedTrip, trips: updatedTrips, isLoading: false })
    }
  } catch (error) {
    set({ error: error.message, isLoading: false })
  }
}
```

### 2. Explore Store
**File**: `lib/store/explore-store.ts`

#### Key Patterns:

##### Syncing with Supabase
```typescript
syncWithSupabase: async () => {
  set({ isSyncing: true })
  try {
    const places = await exploreApiService.syncExplorePlaces(get().activePlaces)
    set({ activePlaces: places, isSyncing: false })
  } catch (error) {
    set({ error: error.message, isSyncing: false })
  }
}
```

## Authentication Integration

### 1. Auth Guard
**File**: `components/auth/auth-guard.tsx`

```typescript
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/auth" replace />
  
  return <>{children}</>
}
```

### 2. Server-side Auth
**File**: `lib/server/auth.ts`

```typescript
export async function requireAuthenticatedUser(request: NextRequest): Promise<User> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header')
  }

  const token = authHeader.substring(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  
  if (error || !user) {
    throw new UnauthorizedError('Invalid or expired token')
  }
  
  return user
}
```

## Error Handling Patterns

### 1. Client-side Error Handling
```typescript
try {
  const result = await tripApi.getUserTrips()
  set({ trips: result, error: null })
} catch (error) {
  console.error('Error loading trips:', error)
  set({ 
    error: error instanceof Error ? error.message : 'Failed to load trips',
    isLoading: false 
  })
}
```

### 2. Server-side Error Handling
```typescript
try {
  const data = await supabase.from('user_trips').select('*')
  if (data.error) throw data.error
  return data.data
} catch (error) {
  console.error('Database error:', error)
  throw new Error('Failed to fetch trips')
}
```

## Performance Optimizations

### 1. Caching Strategy
- **Destination Content**: 24-hour TTL
- **Images**: 7-day TTL
- **Quality Scoring**: Prevents low-quality content
- **Cache Invalidation**: Automatic expiration

### 2. Query Optimization
- **Selective Fields**: Only fetch needed columns
- **Proper Joins**: Use foreign key relationships
- **Ordering**: Consistent ordering for UI
- **Pagination**: Limit results when appropriate

### 3. State Management
- **Local State**: Immediate UI updates
- **Optimistic Updates**: Update UI before server confirmation
- **Error Recovery**: Rollback on failure
- **Loading States**: User feedback during operations

## Integration Issues Identified

### 1. Data Serialization
- **Problem**: JSON fields not properly serialized/deserialized
- **Impact**: Data corruption, type mismatches
- **Solution**: Implement proper conversion functions

### 2. State Synchronization
- **Problem**: Local state not always synced with database
- **Impact**: Data inconsistency, potential data loss
- **Solution**: Implement proper sync mechanisms

### 3. Error Handling
- **Problem**: Inconsistent error handling across components
- **Impact**: Poor user experience, difficult debugging
- **Solution**: Standardize error handling patterns

### 4. Performance
- **Problem**: Some queries could be optimized
- **Impact**: Slower response times
- **Solution**: Implement query optimization and caching

## Recommendations for Codex

1. **Fix Data Serialization**: Implement proper JSON handling for links and base locations
2. **Improve Error Handling**: Standardize error handling across all API calls
3. **Optimize Queries**: Review and optimize database queries
4. **Implement Caching**: Add more caching layers where appropriate
5. **Add Monitoring**: Implement proper logging and monitoring
6. **Test Coverage**: Add comprehensive tests for API integration

This documentation provides Codex with complete understanding of how the frontend integrates with Supabase.
