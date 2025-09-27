# Route Logic Specification

## Overview
This document defines the complete route logic for the Traveal application. The route system should be simple, predictable, and agnostic to any trip structure.

## Core Principles

### 1. **Simple Rule**: Routes only show when there's a meaningful journey
- Routes connect different base locations
- Routes go through destinations as waypoints
- No routes for days with only base locations and no destinations

### 2. **Agnostic Design**: Works with any trip structure
- Any number of days
- Any number of base locations per day
- Any number of destinations per day
- Any combination of the above

### 3. **Visual Clarity**: Clear distinction between route types
- **Inter-Day Routes**: Green, solid lines (driving between cities)
- **Intra-Day Routes**: Blue, dashed lines (walking within cities) - *Currently unused*

## Route Types

### Inter-Day Routes (Primary)
- **Purpose**: Show travel between different base locations
- **Visual**: Green, solid lines
- **Transport**: Driving routes
- **Waypoints**: Include destinations as stops along the way

### Intra-Day Routes (Secondary - Currently Unused)
- **Purpose**: Show local exploration within a city
- **Visual**: Blue, dashed lines  
- **Transport**: Walking routes
- **Waypoints**: Base location to each destination

## Route Display Rules

### When No Day is Selected
- Show **all inter-day routes** where base locations change
- Hide all intra-day routes
- Show all base location markers

### When Day is Selected
- Show **routes TO/FROM the selected day** (if they meet criteria)
- Show **intra-day routes WITHIN the selected day** (if any)
- Show **markers for the selected day and adjacent days**

## Route Criteria

### Inter-Day Route Criteria
A route from Day A to Day B is shown if:
1. **Base locations are different**: `DayA.baseLocation ≠ DayB.baseLocation`
2. **Destination day has destinations**: `DayB.destinations.length > 0`
3. **Route is relevant to selection**: Either no day selected, or route involves selected day

### Intra-Day Route Criteria
A route within Day X is shown if:
1. **Day is selected**: `selectedDayId === DayX.id`
2. **Day has destinations**: `DayX.destinations.length > 0`
3. **Day has base location**: `DayX.baseLocations.length > 0`

## Use Cases & Examples

### Use Case 1: Simple City-to-City Travel
**Trip Structure:**
- Day 1: Rome (no destinations)
- Day 2: Florence (no destinations)
- Day 3: Milan (no destinations)

**Expected Behavior:**
- **No day selected**: Show routes Rome→Florence, Florence→Milan
- **Day 1 selected**: Show route Rome→Florence, show Rome marker
- **Day 2 selected**: Show routes Rome→Florence, Florence→Milan, show Florence marker
- **Day 3 selected**: Show route Florence→Milan, show Milan marker

### Use Case 2: City with Destinations
**Trip Structure:**
- Day 1: Rome (no destinations)
- Day 2: Florence (2 destinations: Duomo, Uffizi)
- Day 3: Milan (no destinations)

**Expected Behavior:**
- **No day selected**: Show routes Rome→Florence, Florence→Milan
- **Day 1 selected**: Show route Rome→Florence (through Duomo, Uffizi), show Rome marker
- **Day 2 selected**: Show routes Rome→Florence (through Duomo, Uffizi), Florence→Milan, show Florence marker + intra-day routes Florence→Duomo, Florence→Uffizi
- **Day 3 selected**: Show route Florence→Milan, show Milan marker

### Use Case 3: Multiple Days in Same City
**Trip Structure:**
- Day 1: Rome (no destinations)
- Day 2: Rome (1 destination: Colosseum)
- Day 3: Rome (1 destination: Vatican)
- Day 4: Florence (no destinations)

**Expected Behavior:**
- **No day selected**: Show route Rome→Florence (through Colosseum, Vatican)
- **Day 1 selected**: Show route Rome→Florence (through Colosseum, Vatican), show Rome marker
- **Day 2 selected**: Show route Rome→Florence (through Colosseum, Vatican), show Rome marker + intra-day route Rome→Colosseum
- **Day 3 selected**: Show route Rome→Florence (through Colosseum, Vatican), show Rome marker + intra-day route Rome→Vatican
- **Day 4 selected**: Show route Rome→Florence (through Colosseum, Vatican), show Florence marker

### Use Case 4: Complex Multi-City Trip
**Trip Structure:**
- Day 1: Rome (no destinations)
- Day 2: Rome (2 destinations: Colosseum, Vatican)
- Day 3: Florence (1 destination: Duomo)
- Day 4: Florence (no destinations)
- Day 5: Milan (2 destinations: Duomo, Galleria)

**Expected Behavior:**
- **No day selected**: Show routes Rome→Florence (through Colosseum, Vatican), Florence→Milan (through Duomo, Galleria)
- **Day 1 selected**: Show route Rome→Florence (through Colosseum, Vatican), show Rome marker
- **Day 2 selected**: Show route Rome→Florence (through Colosseum, Vatican), show Rome marker + intra-day routes Rome→Colosseum, Rome→Vatican
- **Day 3 selected**: Show routes Rome→Florence (through Colosseum, Vatican), Florence→Milan (through Duomo, Galleria), show Florence marker + intra-day route Florence→Duomo
- **Day 4 selected**: Show routes Rome→Florence (through Colosseum, Vatican), Florence→Milan (through Duomo, Galleria), show Florence marker
- **Day 5 selected**: Show route Florence→Milan (through Duomo, Galleria), show Milan marker + intra-day routes Milan→Duomo, Milan→Galleria

## Waypoint Building Logic

### Inter-Day Route Waypoints
For a route from Day A to Day B:
```
1. Start: DayA.baseLocation
2. Waypoints: All destinations from DayB (in order)
3. End: DayB.baseLocation
```

**Example**: Rome → Florence (with Duomo, Uffizi destinations)
```
Waypoints: [Rome, Duomo, Uffizi, Florence]
Route: Rome → Duomo → Uffizi → Florence
```

### Intra-Day Route Waypoints
For routes within Day X:
```
1. Start: DayX.baseLocation
2. End: Each destination (separate route for each)
```

**Example**: Florence with Duomo, Uffizi destinations
```
Route 1: Florence → Duomo
Route 2: Florence → Uffizi
```

## Implementation Requirements

### 1. Route Calculation
- Use Mapbox Directions API
- Inter-day routes: `mapbox/driving` profile
- Intra-day routes: `mapbox/walking` profile
- Cache route results to avoid duplicate API calls

### 2. Route Filtering
- Simple, predictable logic
- No complex edge cases
- Clear conditions for when routes show

### 3. Performance
- Debounced route calculation (200ms)
- Route caching
- Minimal API calls

### 4. Error Handling
- Graceful fallback for API failures
- Clear error messages
- No broken route displays

## Database Schema Requirements

### trip_days Table
```sql
id: uuid                    -- Unique day identifier
day_order: integer          -- Day sequence (0, 1, 2, ...)
base_locations_json: jsonb  -- Array of base locations
notes: text                 -- Day notes
```

### trip_destinations Table
```sql
id: uuid                    -- Unique destination identifier
day_id: uuid                -- References trip_days.id
name: text                  -- Destination name
coordinates: point          -- Destination coordinates
order_index: integer        -- Order within the day
city: text                  -- Destination city
```

## API Functions Required

### Route Calculation
```typescript
calculateInterDayRoute(fromDay: TimelineDay, toDay: TimelineDay): Promise<RouteData>
calculateIntraDayRoutes(day: TimelineDay): Promise<RouteData[]>
```

### Route Filtering
```typescript
getRoutesToShow(selectedDayId: string | null, tripDays: TimelineDay[]): RouteInfo[]
```

### Route Display
```typescript
updateMapRoutes(routes: RouteData[]): void
updateMapMarkers(days: TimelineDay[], selectedDayId: string | null): void
```

## Testing Scenarios

### Test Case 1: No Destinations
- **Input**: Day 1 (Rome, no destinations), Day 2 (Florence, no destinations)
- **Expected**: Route Rome→Florence when Day 2 selected, no routes when Day 1 selected

### Test Case 2: Single Destination
- **Input**: Day 1 (Rome, no destinations), Day 2 (Florence, 1 destination: Duomo)
- **Expected**: Route Rome→Duomo→Florence when Day 2 selected

### Test Case 3: Multiple Destinations
- **Input**: Day 1 (Rome, no destinations), Day 2 (Florence, 2 destinations: Duomo, Uffizi)
- **Expected**: Route Rome→Duomo→Uffizi→Florence when Day 2 selected

### Test Case 4: Same Base Location
- **Input**: Day 1 (Rome, no destinations), Day 2 (Rome, 1 destination: Colosseum)
- **Expected**: No inter-day route, intra-day route Rome→Colosseum when Day 2 selected

### Test Case 5: Complex Trip
- **Input**: Multiple days with various combinations of base locations and destinations
- **Expected**: Routes show correctly based on the rules above

## Migration Strategy

### Phase 1: Simplify Current Logic
1. Remove complex route filtering
2. Implement simple rule-based logic
3. Add comprehensive logging

### Phase 2: Optimize Performance
1. Implement route caching
2. Reduce API calls
3. Improve debouncing

### Phase 3: Add Intra-Day Routes
1. Implement intra-day route calculation
2. Add visual distinction
3. Update map controls

### Phase 4: Testing & Validation
1. Test all use cases
2. Validate with real data
3. Performance testing

## Success Criteria

### Functional Requirements
- ✅ Routes show correctly for all use cases
- ✅ No routes show when they shouldn't
- ✅ Routes go through destinations as waypoints
- ✅ Visual distinction between route types

### Performance Requirements
- ✅ Route calculation < 500ms
- ✅ Smooth map interactions
- ✅ Minimal API calls
- ✅ No memory leaks

### User Experience Requirements
- ✅ Predictable route behavior
- ✅ Clear visual feedback
- ✅ Responsive interface
- ✅ Error handling

## Conclusion

This specification provides a clear, simple, and agnostic route logic that will work correctly for any trip structure. The key is to keep the logic simple and predictable, with clear rules for when routes should be shown.

The implementation should focus on:
1. **Simplicity**: Clear, understandable logic
2. **Predictability**: Same behavior for similar scenarios
3. **Performance**: Fast, efficient route calculation
4. **Maintainability**: Easy to debug and modify
