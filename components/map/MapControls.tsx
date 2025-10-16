'use client'

import { useMemo, useState, type ComponentType } from 'react'
import { Info, ChevronDown, ChevronUp, Route as RouteIcon, MapPin, Car, Footprints } from 'lucide-react'
import { CATEGORY_ORDER, getExploreCategoryMetadata, ExploreCategoryMetadata } from '@/lib/explore/categories'
import { useSupabaseTripStore, RouteProfile } from '@/lib/store/supabase-trip-store'
import mapboxgl from 'mapbox-gl'

interface MapToggleProps {
  map: any
  className?: string
}

export function MapLegendToggle({ map, className }: MapToggleProps) {
  void map
  const [isExpanded, setIsExpanded] = useState(false)
  const categories: ExploreCategoryMetadata[] = useMemo(() => {
    return CATEGORY_ORDER.filter((key) => key !== 'hotel').map((key) => getExploreCategoryMetadata(key))
  }, [])

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex min-h-[3rem] w-full min-w-[220px] max-w-[220px] items-center gap-2 overflow-hidden rounded-lg border border-white/12 bg-[rgba(8,14,24,0.55)] px-3 text-left text-white shadow-lg shadow-black/25 backdrop-blur-md transition-all duration-200 hover:bg-white/10 hover:border-white/20"
        aria-expanded={isExpanded}
      >
        <Info className="h-4 w-4 text-white/60" />
        <span className="text-sm font-medium text-white">Legend</span>
        {isExpanded ? (
          <ChevronDown className="ml-auto h-4 w-4 text-white/60" />
        ) : (
          <ChevronUp className="ml-auto h-4 w-4 text-white/60" />
        )}
      </button>

      {isExpanded && (
        <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-20 min-w-[220px] rounded-lg border border-white/10 bg-slate-950/95 px-3 pb-3 shadow-xl backdrop-blur-sm">
          <div className="space-y-3 pt-3">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-white/50">Marker categories</p>
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.key} className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 rounded-full border border-white/20"
                      style={{ backgroundColor: category.colors.border }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white">{category.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-3">
              <p className="mb-2 text-xs uppercase tracking-wider text-white/50">Marker styles</p>
              <div className="space-y-2">
                <p className="text-xs font-medium text-white">Outlined dots = Explore anywhere</p>
                <p className="text-xs font-medium text-white">Filled dots = Itinerary destinations</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function MapRouteToggle({ map, className }: MapToggleProps) {
  void map
  const routeModeEnabled = useSupabaseTripStore((state) => state.routeModeEnabled)
  const routeSelectionStart = useSupabaseTripStore((state) => state.routeSelectionStart)
  const adHocRouteResult = useSupabaseTripStore((state) => state.adHocRouteResult)
  const routeProfile = useSupabaseTripStore((state) => state.routeProfile)
  const setRouteModeEnabled = useSupabaseTripStore((state) => state.setRouteModeEnabled)
  const setRouteProfile = useSupabaseTripStore((state) => state.setRouteProfile)
  const clearAdHocRoute = useSupabaseTripStore((state) => state.clearAdHocRoute)

  const handleToggle = () => {
    const next = !routeModeEnabled
    setRouteModeEnabled(next)
    if (!next) {
      clearAdHocRoute()
    }
  }

  const handleProfileClick = (profile: RouteProfile) => {
    setRouteProfile(profile)
    if (!routeModeEnabled) {
      setRouteModeEnabled(true)
    }
  }

  const statusLabel = (() => {
    if (!routeModeEnabled) return 'Tap to enable'
    if (routeSelectionStart) return 'Select end point'
    if (adHocRouteResult) return 'Route ready'
    return 'Select start point'
  })()

  const activeClasses = routeModeEnabled
    ? 'border-emerald-400/80 text-white shadow-lg shadow-emerald-500/25'
    : 'border-white/12 text-white/80 shadow-lg shadow-black/25'

  const pillVariants: Array<{
    profile: RouteProfile
    icon: ComponentType<{ className?: string }>
    label: string
  }> = [
    { profile: 'driving', icon: Car, label: 'Car route' },
    { profile: 'walking', icon: Footprints, label: 'Walking route' },
  ]

  return (
    <div
      role="group"
      className={`flex min-h-[3rem] w-full min-w-[240px] max-w-[240px] items-center gap-3 overflow-hidden rounded-lg border bg-[rgba(8,14,24,0.55)] px-3 py-2 backdrop-blur-md transition-all duration-200 ${activeClasses} ${className ?? ''}`}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={routeModeEnabled}
        className="flex flex-1 items-center gap-3 rounded-md px-1 py-1 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
      >
        <RouteIcon className="h-4 w-4" />
        <div className="flex flex-col min-w-0 text-left">
          <span className="text-sm font-semibold">Route</span>
          <span className="text-xs opacity-80 truncate">{statusLabel}</span>
        </div>
      </button>
      <div className="flex items-center gap-2">
        {pillVariants.map(({ profile, icon: Icon, label }) => {
          const isActive = routeModeEnabled && routeProfile === profile
          const baseClasses =
            'flex h-8 w-8 items-center justify-center rounded-full border text-white transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60'
          const stateClasses = (() => {
            if (!routeModeEnabled) {
              return 'border-white/10 text-white/30 hover:border-white/20 hover:text-white/50'
            }
            if (isActive) {
              return 'border-emerald-400/80 bg-emerald-400/15 text-white hover:bg-emerald-400/20'
            }
            return 'border-white/12 text-white/50 hover:border-white/20 hover:text-white/80'
          })()

          return (
            <button
              key={profile}
              type="button"
              aria-pressed={isActive}
              aria-label={label}
              onClick={() => handleProfileClick(profile)}
              className={`${baseClasses} ${stateClasses}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function AllDestinationsToggle({ map, className }: MapToggleProps) {
  const showAllDestinations = useSupabaseTripStore((state) => state.showAllDestinations)
  const setShowAllDestinations = useSupabaseTripStore((state) => state.setShowAllDestinations)
  const currentTrip = useSupabaseTripStore((state) => state.currentTrip)

  const handleToggle = () => {
    const next = !showAllDestinations
    setShowAllDestinations(next)

    if (!next || !map || typeof map.fitBounds !== 'function') {
      return
    }

    const points: [number, number][] = []
    const seen = new Set<string>()

    currentTrip?.days.forEach((day) => {
      day.destinations.forEach((destination) => {
        const coord = destination.coordinates
        if (!coord || coord.length !== 2) {
          return
        }
        const key = `${coord[0]}:${coord[1]}`
        if (!seen.has(key)) {
          seen.add(key)
          points.push(coord)
        }
      })
      day.baseLocations?.forEach((base) => {
        const coord = base.coordinates
        if (!coord || coord.length !== 2) {
          return
        }
        const key = `${coord[0]}:${coord[1]}`
        if (!seen.has(key)) {
          seen.add(key)
          points.push(coord)
        }
      })
    })

    if (points.length === 0) {
      return
    }

    if (points.length === 1) {
      map.flyTo({
        center: points[0],
        zoom: Math.max(map.getZoom() ?? 7, 7),
        duration: 600,
      })
      return
    }

    const bounds = points.reduce((acc, coord) => {
      if (!acc) {
        return new mapboxgl.LngLatBounds(coord, coord)
      }
      acc.extend(coord)
      return acc
    }, null as mapboxgl.LngLatBounds | null)

    if (bounds) {
      map.fitBounds(bounds, { padding: 80, duration: 800 })
    }
  }

  const activeClasses = showAllDestinations
    ? 'border-emerald-400/80 text-white shadow-lg shadow-emerald-500/25'
    : 'border-white/12 text-white/80 shadow-lg shadow-black/25'

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={showAllDestinations}
      className={`flex min-h-[3rem] w-full min-w-[240px] max-w-[240px] items-center gap-3 overflow-hidden rounded-lg border bg-[rgba(8,14,24,0.55)] px-4 py-2 backdrop-blur-md transition-all duration-200 ${activeClasses} ${className ?? ''}`}
    >
      <MapPin className="h-4 w-4" />
      <div className="flex flex-col text-left">
        <span className="text-sm font-semibold">All Destinations</span>
        <span className="text-xs opacity-80">{showAllDestinations ? 'Showing itinerary overview' : 'Show entire trip'}</span>
      </div>
    </button>
  )
}
