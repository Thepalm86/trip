# 🗺️ Map Architecture & Components Documentation

## Overview

This document provides a comprehensive guide to the mapping system in the Trip3 application. The system consists of 8 specialized React components that work together to create a sophisticated, interactive mapping experience using Mapbox GL JS.

## 📋 Table of Contents

- [Component Overview](#component-overview)
- [Detailed Component Analysis](#detailed-component-analysis)
- [Data Flow Architecture](#data-flow-architecture)
- [Visual Design System](#visual-design-system)
- [Performance Optimizations](#performance-optimizations)
- [Integration Points](#integration-points)
- [File References](#file-references)

## 🏗️ Component Overview

The map system consists of **8 specialized components** that work together:

| Component | Lines | Role | File Path |
|-----------|-------|------|-----------|
| **InteractiveMap** | 107 | Main map container & initialization | [`components/map/InteractiveMap.tsx`](../components/map/InteractiveMap.tsx) |
| **MapIntegration** | 141 | Orchestrator & component coordinator | [`components/map/MapIntegration.tsx`](../components/map/MapIntegration.tsx) |
| **MapInitializer** | 532 | Map setup, sources & visual styling | [`components/map/MapInitializer.tsx`](../components/map/MapInitializer.tsx) |
| **RouteManager** | 370 | Route calculation & rendering | [`components/map/RouteManager.tsx`](../components/map/RouteManager.tsx) |
| **MarkerManager** | 193 | Marker management & visual states | [`components/map/MarkerManager.tsx`](../components/map/MarkerManager.tsx) |
| **MapEventHandler** | 273 | User interactions & popups | [`components/map/MapEventHandler.tsx`](../components/map/MapEventHandler.tsx) |
| **MapCleanup** | 273 | Viewport & selection management | [`components/map/MapCleanup.tsx`](../components/map/MapCleanup.tsx) |
| **MapControls** | 122 | UI controls & legend | [`components/map/MapControls.tsx`](../components/map/MapControls.tsx) |

## 🔧 Detailed Component Analysis

### 1. InteractiveMap.tsx - Main Map Container

**File**: [`components/map/InteractiveMap.tsx`](../components/map/InteractiveMap.tsx)

**Role**: Primary map initialization and container

**Key Features**:
- Mapbox GL JS setup with dark theme (`mapbox://styles/mapbox/dark-v11`)
- Navigation controls (zoom, compass, rotation lock)
- Loading states and error handling
- Map instance exposure to parent components via ref
- Default center: Rome coordinates (12.4964, 41.9028)

**Key Functions**:
```typescript
// Map initialization
map.current = new mapboxgl.Map({
  container: mapContainer.current,
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [12.4964, 41.9028], // Rome coordinates
  zoom: 12,
  pitch: 0,
  bearing: 0,
  antialias: true,
  dragRotate: false,
})
```

### 2. MapIntegration.tsx - Orchestrator

**File**: [`components/map/MapIntegration.tsx`](../components/map/MapIntegration.tsx)

**Role**: Coordinates all map components and manages data flow

**Key Features**:
- Component orchestration - brings together all map modules
- State management integration with Zustand store
- Loading state coordination for route calculations
- Props distribution to specialized components

**Component Structure**:
```typescript
<>
  <MapInitializer map={map} hasTrip={hasTrip} />
  <RouteManager map={map} hasTrip={hasTrip} tripDays={tripDays} selectedDayId={selectedDayId} token={token} onLoadingChange={setIsLoadingRoutes} />
  <MarkerManager map={map} hasTrip={hasTrip} tripDays={tripDays} selectedDayId={selectedDayId} />
  <MapEventHandler map={map} hasTrip={hasTrip} tripDays={tripDays} selectedDayId={selectedDayId} selectedDestination={selectedDestination} setSelectedDay={setSelectedDay} setSelectedDestination={setSelectedDestination} />
  <MapCleanup map={map} hasTrip={hasTrip} tripDays={tripDays} selectedDayId={selectedDayId} selectedDestination={selectedDestination} />
</>
```

### 3. MapInitializer.tsx - Map Setup & Styling

**File**: [`components/map/MapInitializer.tsx`](../components/map/MapInitializer.tsx)

**Role**: Initializes map sources, layers, and visual styling

#### Map Sources Created:
- `base-locations` - Base city/region markers
- `destinations` - Activity/destination markers  
- `routes` - Main travel routes between base locations
- `day-routes` - Routes within individual days
- `day-markers` - Markers on routes between base location changes
- `selection-highlight` - Highlight selected items

#### Visual Layers (16 total):

**Base Location Layers:**
- `base-locations-outer` - Outer ring glow effect
- `base-locations-layer` - Main circle with hover/selection states
- `base-locations-day-number` - Day number labels
- `base-locations-labels` - Location name labels

**Destination Layers:**
- `destinations-outer` - Outer ring glow effect
- `destinations-layer` - Main circle with consistent blue color
- `destinations-activity-letter` - Activity sequence letters (A, B, C, etc.)
- `destinations-labels` - Destination name labels

**Route Layers:**
- `routes-shadow` - Route shadow/glow effect
- `routes-layer` - Main route lines with hover effects
- `routes-arrows` - Direction arrows on routes
- `routes-labels` - Distance/duration labels

**Day Route Layers:**
- `day-routes-shadow` - Day route shadow with green color
- `day-routes-layer` - Dashed day routes with green color

**Utility Layers:**
- `day-markers-layer` - Day markers on routes
- `day-markers-number` - Day number on route markers
- `selection-highlight-layer` - Selection highlight ring

### 4. RouteManager.tsx - Route Calculation

**File**: [`components/map/RouteManager.tsx`](../components/map/RouteManager.tsx)

**Role**: Calculates and renders all route types using Mapbox Directions API

#### Route Types Calculated:

1. **Base Routes** (`base-` prefix)
   - Between base locations (cities/regions)
   - **Segmented into individual point-to-point routes** for better trip planning
   - Uses **driving** mode for long-distance travel
   - Shows individual segments with specific distances/times
   - Example: Rome → Florence with Siena stop becomes:
     - Rome → Siena (2.5h • 120km)
     - Siena → Florence (1.2h • 60km)

2. **Day Routes** (`day-` prefix)  
   - Between destinations within a single day
   - Uses **walking** mode for local exploration
   - Consistent green coloring

3. **Base-to-Destination Routes** (`base-dest-` prefix)
   - From base location to individual destinations
   - Uses **walking** mode
   - Only shown when destination isn't part of main route
   - **Consistent green coloring** for all routes

#### Smart Route Logic:
- **Debounced calculation** (500ms delay) to prevent API spam
- **Selected day filtering** - only shows routes for selected day
- **Route segmentation** - breaks multi-stop routes into individual segments
- **Point-to-point calculation** - each segment shows specific distance/time
- **Duplicate prevention** - avoids redundant base-to-destination routes

**API Integration**:
```typescript
// Individual segment calculation (point-to-point)
for (let i = 0; i < waypoints.length - 1; i++) {
  const startPoint = waypoints[i]
  const endPoint = waypoints[i + 1]
  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${startPoint[0]},${startPoint[1]};${endPoint[0]},${endPoint[1]}?access_token=${token}&geometries=geojson&overview=full`
  )
}
```

### 5. MarkerManager.tsx - Marker Management

**File**: [`components/map/MarkerManager.tsx`](../components/map/MarkerManager.tsx)

**Role**: Manages all map markers and their visual states

#### Marker Types:

1. **Base Location Markers**
   - Green circles with day numbers
   - Show selected day + previous day (for travel context)
   - Enhanced with hover/selection states

2. **Destination Markers**
   - Consistent blue color (`#3b82f6`) matching legend
   - Activity sequence letters (A, B, C, etc.)
   - Shown only for the selected day

#### Smart Display Logic:
- **Contextual visibility** - shows relevant markers based on selection
- **Travel day detection** - includes departure/arrival points
- **State synchronization** - updates feature states for hover/selection

**Color System**:
```typescript
const DAY_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Orange
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange-red
]
```

### 6. MapEventHandler.tsx - User Interactions

**File**: [`components/map/MapEventHandler.tsx`](../components/map/MapEventHandler.tsx)

**Role**: Handles all user interactions and popups

#### Click Handlers:
- **Base location clicks** → Select day in left panel + show popup
- **Destination clicks** → Select day + destination + show popup  
- **Route clicks** → Show route information popup

#### Hover Effects:
- **Feature state updates** for visual feedback
- **Cursor changes** (pointer on interactive elements)
- **Smooth transitions** between states

#### Enhanced Popups:
- **Rich content** with day numbers, activity counts, ratings
- **Contextual information** (duration, cost, descriptions)
- **Custom styling** with glassmorphism effects

**Popup Example**:
```typescript
const popup = new mapboxgl.Popup({
  closeButton: true,
  closeOnClick: false,
  className: 'custom-popup'
})
  .setLngLat(feature.geometry.coordinates)
  .setHTML(`
    <div class="p-3 min-w-[200px]">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
          ${dayNumber}
        </div>
        <h3 class="font-semibold text-sm text-white">${feature.properties.name}</h3>
      </div>
      <p class="text-xs text-white/60 mb-2">Day ${dayNumber} Base Location</p>
    </div>
  `)
```

### 7. MapCleanup.tsx - Viewport & Selection Management

**File**: [`components/map/MapCleanup.tsx`](../components/map/MapCleanup.tsx)

**Role**: Manages map viewport, bounds fitting, and selection highlighting

#### Smart Bounds Fitting:
- **Day-specific centering** when day is selected
- **Travel day detection** - includes departure/arrival points
- **Adaptive zoom levels** based on location count:
  - Single location: maxZoom 11
  - Two locations: maxZoom 12  
  - Multiple locations: maxZoom 13
  - Travel days: maxZoom 10 (wider view)

#### Selection Highlighting:
- **Destination selection** - highlights selected destination
- **Day selection** - highlights selected day's base location
- **Visual feedback** with green highlight ring

**Zoom Logic**:
```typescript
if (isTravelDay) {
  fitOptions = { padding: 100, maxZoom: 10, duration: 1200 }
} else if (locationCount === 1) {
  fitOptions = { padding: 120, maxZoom: 11, duration: 1200 }
} else if (locationCount === 2) {
  fitOptions = { padding: 100, maxZoom: 12, duration: 1200 }
} else {
  fitOptions = { padding: 80, maxZoom: 13, duration: 1200 }
}
```

### 8. MapControls.tsx - UI Controls

**File**: [`components/map/MapControls.tsx`](../components/map/MapControls.tsx)

**Role**: Provides map legend and user interface controls

#### Interactive Legend:
- **Expandable/collapsible** legend panel
- **Visual examples** of all map elements
- **Color coding** explanation
- **Route type differentiation**

## 🔄 Data Flow Architecture

```
User Interaction → MapEventHandler → Zustand Store → MapCleanup
                ↓
            Visual Updates → MarkerManager → RouteManager → Map Rendering
```

### State Management Integration

**Store**: [`lib/store/supabase-trip-store.ts`](../lib/store/supabase-trip-store.ts)

**Key State Variables**:
- `currentTrip` - Current trip data
- `selectedDayId` - Currently selected day
- `selectedDestination` - Currently selected destination
- `tripDays` - Array of trip days

**State Updates**:
- Adding/removing destinations triggers map updates
- Day selection updates viewport and markers
- Destination selection highlights on map

## 🎨 Visual Design System

### Color Palette

| Element | Color | Hex Code | Usage |
|---------|-------|----------|-------|
| **Base Locations** | Green | `#10b981` | Main city/region markers (consistent) |
| **Destinations** | Blue | `#3b82f6` | Activity markers (consistent, letters A/B/C) |
| **All Routes** | Green | `#10b981` | All routes (base routes, day routes, base-to-destination routes) |
| **Selection** | Bright Green | `#34d399` | Highlight selected items |

### Simplified Color System

The system uses a clean, simplified color scheme:

**All Routes**: GREEN (`#10b981`)
- Base routes between cities
- Day routes within cities  
- Base-to-destination routes
- All route types use the same green color for consistency

**Markers**:
- Base locations: GREEN (`#10b981`)
- Destinations: BLUE (`#3b82f6`) with letters (A, B, C, etc.)

### Interactive States

| State | Visual Changes | Behavior |
|-------|----------------|----------|
| **Hover** | Larger radius, brighter colors | Cursor pointer |
| **Selected** | Maximum size, brightest colors, thick borders | Highlight ring |
| **Default** | Standard size and opacity | Normal appearance |

### Typography & Styling

**Fonts**: Open Sans (Bold, Semibold) with Arial Unicode MS fallback
**Effects**: Glassmorphism, backdrop blur, gradient overlays
**Animations**: Smooth transitions (200-1200ms duration)

## ⚡ Performance Optimizations

1. **Debounced Route Calculation** - Prevents API spam with 500ms delay
2. **Selective Rendering** - Only shows relevant markers/routes for selected day
3. **Feature State Management** - Efficient hover/selection updates
4. **Memory Cleanup** - Proper cleanup of sources and layers on unmount
5. **Smart Bounds Fitting** - Adaptive zoom based on content density
6. **Lazy Loading** - Components only initialize when needed

## 🔗 Integration Points

### With DayBuilderModal

**File**: [`components/modals/DayBuilderModal.tsx`](../components/modals/DayBuilderModal.tsx)

**Integration Features**:
- **Real-time synchronization** when adding/removing destinations
- **Mini-map integration** with same visual system
- **Bidirectional updates** between modal and main map

**Mini-Map Component**: [`components/modals/DayMiniMap.tsx`](../components/modals/DayMiniMap.tsx)

### With State Management

**Store**: [`lib/store/supabase-trip-store.ts`](../lib/store/supabase-trip-store.ts)

**Integration Features**:
- **Zustand store integration** for trip data
- **Selected day synchronization** across components
- **Real-time updates** when data changes

### With Left Panel Components

**Day Card**: [`components/left-panel/DayCard.tsx`](../components/left-panel/DayCard.tsx)
**Itinerary Tab**: [`components/left-panel/ItineraryTab.tsx`](../components/left-panel/ItineraryTab.tsx)

**Integration Features**:
- **Double-click to open Day Builder** from day cards
- **Day selection** updates map viewport
- **Destination management** syncs with map markers

## 📁 File References

### Core Map Components
- [`components/map/InteractiveMap.tsx`](../components/map/InteractiveMap.tsx) - Main map container
- [`components/map/MapIntegration.tsx`](../components/map/MapIntegration.tsx) - Component orchestrator
- [`components/map/MapInitializer.tsx`](../components/map/MapInitializer.tsx) - Map setup & styling
- [`components/map/RouteManager.tsx`](../components/map/RouteManager.tsx) - Route calculation
- [`components/map/MarkerManager.tsx`](../components/map/MarkerManager.tsx) - Marker management
- [`components/map/MapEventHandler.tsx`](../components/map/MapEventHandler.tsx) - User interactions
- [`components/map/MapCleanup.tsx`](../components/map/MapCleanup.tsx) - Viewport management
- [`components/map/MapControls.tsx`](../components/map/MapControls.tsx) - UI controls

### Integration Components
- [`components/modals/DayBuilderModal.tsx`](../components/modals/DayBuilderModal.tsx) - Day builder with mini-map
- [`components/modals/DayMiniMap.tsx`](../components/modals/DayMiniMap.tsx) - Interactive mini-map
- [`components/left-panel/DayCard.tsx`](../components/left-panel/DayCard.tsx) - Day card component
- [`components/left-panel/ItineraryTab.tsx`](../components/left-panel/ItineraryTab.tsx) - Itinerary management

### State & Types
- [`lib/store/supabase-trip-store.ts`](../lib/store/supabase-trip-store.ts) - Zustand state management
- [`types/index.ts`](../types/index.ts) - TypeScript type definitions

### Styling
- [`app/globals.css`](../app/globals.css) - Global styles and map-specific CSS

### Configuration
- [`.env.local`](../.env.local) - Environment variables (Mapbox token)

## 🚀 Usage Examples

### Adding a New Map Layer

```typescript
// In MapInitializer.tsx
if (!map.getSource('new-layer')) {
  map.addSource('new-layer', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  })
}

if (!map.getLayer('new-layer-style')) {
  map.addLayer({
    id: 'new-layer-style',
    type: 'circle',
    source: 'new-layer',
    paint: {
      'circle-radius': 8,
      'circle-color': '#ff0000'
    }
  })
}
```

### Handling Map Events

```typescript
// In MapEventHandler.tsx
map.on('click', 'new-layer-style', (e) => {
  const feature = e.features[0]
  if (feature) {
    // Handle click event
    console.log('Clicked feature:', feature.properties)
  }
})
```

### Updating Map Data

```typescript
// In any component with map access
const updateMapData = (newFeatures) => {
  if (map.getSource('destinations')) {
    map.getSource('destinations').setData({
      type: 'FeatureCollection',
      features: newFeatures
    })
  }
}
```

## 🔧 Troubleshooting

### Common Issues

1. **Map not loading**: Check Mapbox token in `.env.local`
2. **Routes not showing**: Verify Mapbox Directions API access
3. **Markers not updating**: Check if sources are initialized
4. **Performance issues**: Ensure proper cleanup in useEffect

### Debug Tools

- Browser console logs for map initialization
- Mapbox GL JS debug mode
- Network tab for API calls
- React DevTools for component state

## 📚 Additional Resources

- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/)
- [Mapbox Directions API](https://docs.mapbox.com/api/navigation/directions/)
- [React + Mapbox Integration](https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-react/)
- [Zustand State Management](https://github.com/pmndrs/zustand)

---

*This documentation covers the complete mapping system architecture. For specific implementation details, refer to the individual component files listed above.*
