# 🗄️ Supabase Database Setup for Trip Planning App

## ✅ What's Been Created

Your trip planning app now has a complete Supabase database setup with the following components:

### 📋 **Database Tables Created:**

1. **`user_trips`** - Main trip records
2. **`trip_days`** - Individual days within trips  
3. **`trip_destinations`** - Destinations/activities for each day
4. **`trip_destination_pois`** - Links to Traveal POIs
5. **`trip_destination_destinations`** - Links to Traveal destinations
6. **`trip_analytics`** - Trip usage tracking
7. **`user_trip_preferences`** - User preferences

### 🔒 **Security Features:**

- **Row Level Security (RLS)** enabled on all tables
- **User-specific policies** - users can only access their own data
- **Secure functions** with proper authentication checks

### 🛠️ **Helper Functions:**

- `get_trip_with_details(trip_uuid)` - Get complete trip data
- `calculate_trip_stats(trip_uuid)` - Calculate trip statistics
- `duplicate_trip(original_trip_id, new_name)` - Duplicate trips
- `reorder_destinations(day_uuid, destination_ids)` - Reorder destinations

### 🔗 **Integration Features:**

- **Links to Traveal data** - Connect your trips to existing POIs and destinations
- **Automatic timestamps** - `created_at` and `updated_at` fields
- **Optimized indexes** - Fast queries for common operations

> ℹ️ Before calling the Supabase store, copy `.env.example` to `.env.local` and populate each placeholder with project secrets (Supabase URL, anon key, service role key, Mapbox token, etc.). Keep `SUPABASE_SERVICE_ROLE_KEY` and other private keys on the server only.

## 🚀 **How to Use**

### **1. Switch to Supabase Store**

Replace your current Zustand store import:

```typescript
// Old
import { useTripStore } from '@/lib/store/trip-store'

// New  
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
```

### **2. Initialize Data**

```typescript
const { loadTrips, currentTrip, isLoading } = useSupabaseTripStore()

// Load user's trips on app start
useEffect(() => {
  loadTrips()
}, [])
```

### **3. Create New Trip**

```typescript
const { createTrip } = useSupabaseTripStore()

const handleCreateTrip = async () => {
  const tripId = await createTrip({
    name: 'My Italy Adventure',
    startDate: new Date(),
    endDate: addDays(new Date(), 7),
    country: 'IT',
    days: [
      {
        id: generateId(),
        date: new Date(),
        destinations: [],
        baseLocations: []
      }
    ]
  })
  console.log('Created trip:', tripId)
}
```

### **4. Add Destinations**

```typescript
const { addDestinationToDay } = useSupabaseTripStore()

const handleAddDestination = async (dayId: string) => {
  await addDestinationToDay(dayId, {
    id: generateId(),
    name: 'Colosseum',
    coordinates: [12.4924, 41.8902],
    category: 'attraction',
    rating: 4.5
  })
}
```

## 🔧 **API Functions Available**

### **Trip Management:**
- `loadTrips()` - Load all user trips
- `loadTrip(tripId)` - Load specific trip
- `createTrip(trip)` - Create new trip
- `updateTrip(tripId, updates)` - Update trip
- `duplicateTrip(tripId, newName)` - Duplicate trip

### **Day Management:**
- `addNewDay()` - Add new day to current trip
- `duplicateDay(dayId)` - Duplicate a day
- `removeDay(dayId)` - Remove a day
- `setDayLocation(dayId, location)` - Set or clear the primary base location (`baseLocations[0]`) for a day

### **Destination Management:**
- `addDestinationToDay(dayId, destination)` - Add destination
- `removeDestinationFromDay(destinationId)` - Remove destination
- `moveDestination(destinationId, fromDayId, toDayId, newIndex)` - Move between days
- `reorderDestinations(dayId, startIndex, endIndex)` - Reorder within day

### **Utility:**
- `getTripStats(tripId)` - Get trip statistics
- `setError(error)` - Set error message
- `clearError()` - Clear error message

## 🎯 **Key Benefits**

1. **🔄 Real-time Sync** - All changes are automatically saved to Supabase
2. **👤 User Isolation** - Each user only sees their own trips
3. **🔗 Traveal Integration** - Connect to existing POI and destination data
4. **📊 Analytics Ready** - Track user behavior and trip statistics
5. **🚀 Performance** - Optimized queries with proper indexing
6. **🔒 Security** - Row-level security ensures data privacy

## 🐛 **Error Handling**

The Supabase store includes comprehensive error handling:

```typescript
const { error, isLoading, clearError } = useSupabaseTripStore()

// Display errors to user
if (error) {
  return <div className="error">Error: {error}</div>
}

// Show loading states
if (isLoading) {
  return <div>Loading...</div>
}
```

## 🔄 **Migration from Local Store**

To migrate from your current local Zustand store:

1. **Replace imports** in your components
2. **Add authentication** (Supabase Auth)
3. **Initialize trips** on app load
4. **Handle loading states** and errors
5. **Test all functionality** with real data

## 📝 **Next Steps**

1. **Set up Supabase Auth** for user authentication
2. **Test the integration** with your existing components
3. **Add error boundaries** for better error handling
4. **Implement offline support** if needed
5. **Add analytics tracking** for user insights

Your trip planning app now has a robust, scalable database backend that integrates seamlessly with the existing Traveal project! 🎉
