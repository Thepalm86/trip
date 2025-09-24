'use client'

import { useState, useEffect } from 'react'
import { X, MapPin, Search, Plus, Navigation } from 'lucide-react'
import { DayLocation } from '@/types'
import { useTripStore } from '@/lib/store/trip-store'

interface BaseLocationPickerProps {
  dayId: string
  onClose: () => void
}

interface LocationResult {
  id: string
  name: string
  fullName: string
  coordinates: [number, number]
  context?: string
}

export function BaseLocationPicker({ dayId, onClose }: BaseLocationPickerProps) {
  const { currentTrip, setDayLocation } = useTripStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null)

  const day = currentTrip.days.find(d => d.id === dayId)
  const dayIndex = currentTrip.days.findIndex(d => d.id === dayId)

  // Popular base locations for quick selection
  const popularLocations = [
    { name: 'Florence', context: 'Tuscany, Italy', coordinates: [11.2558, 43.7696] as [number, number] },
    { name: 'Siena', context: 'Tuscany, Italy', coordinates: [11.3317, 43.3188] as [number, number] },
    { name: 'Rome', context: 'Lazio, Italy', coordinates: [12.4964, 41.9028] as [number, number] },
    { name: 'Venice', context: 'Veneto, Italy', coordinates: [12.3396, 45.4408] as [number, number] },
    { name: 'Milan', context: 'Lombardy, Italy', coordinates: [9.1900, 45.4642] as [number, number] },
    { name: 'Naples', context: 'Campania, Italy', coordinates: [14.2681, 40.8518] as [number, number] },
    { name: 'Bologna', context: 'Emilia-Romagna, Italy', coordinates: [11.3426, 44.4949] as [number, number] },
    { name: 'Turin', context: 'Piedmont, Italy', coordinates: [7.6869, 45.0703] as [number, number] },
  ]

  // Search functionality
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }

    const controller = new AbortController()
    const fetchResults = async () => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (!token) return

      try {
        setIsLoading(true)
        const endpoint = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`)
        endpoint.searchParams.set('access_token', token)
        endpoint.searchParams.set('autocomplete', 'true')
        endpoint.searchParams.set('limit', '6')
        endpoint.searchParams.set('language', 'en')
        endpoint.searchParams.set('proximity', '12.4964,41.9028')
        endpoint.searchParams.set('types', 'place,locality,region')

        const response = await fetch(endpoint.toString(), { signal: controller.signal })
        if (!response.ok) return

        const data = await response.json()
        const features = data.features ?? []
        
        const mapped: LocationResult[] = features.map((feature: any) => ({
          id: feature.id,
          name: feature.text,
          fullName: feature.place_name,
          coordinates: feature.center,
          context: feature.context?.[0]?.text
        }))

        setResults(mapped)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Search error:', error)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchResults()
    return () => controller.abort()
  }, [query])

  const handleSetLocation = (location: LocationResult) => {
    const dayLocation: DayLocation = {
      name: location.name,
      coordinates: location.coordinates,
      context: location.context
    }
    
    setDayLocation(dayId, dayLocation)
    onClose()
  }

  const handleSetPopularLocation = (location: typeof popularLocations[0]) => {
    const dayLocation: DayLocation = {
      name: location.name,
      coordinates: location.coordinates,
      context: location.context
    }
    
    setDayLocation(dayId, dayLocation)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Set Base Location</h3>
              <p className="text-sm text-white/60">Day {dayIndex + 1} • {day?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
          {/* Current Location */}
          {day?.location && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <h4 className="text-sm font-medium text-blue-400 mb-2">Current Base Location</h4>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <div className="font-medium text-white">{day.location.name}</div>
                  {day.location.context && (
                    <div className="text-sm text-white/60">{day.location.context}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a city or region..."
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-green-400/50 transition-all duration-200"
              />
            </div>

            {/* Search Results */}
            {query.length >= 2 && (
              <div className="space-y-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
                      <span>Searching...</span>
                    </div>
                  </div>
                ) : results.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="text-sm text-white/60">No results found</div>
                  </div>
                ) : (
                  results.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSetLocation(result)}
                      className="w-full p-3 rounded-lg text-left transition-all duration-200 bg-white/5 border border-white/10 hover:bg-green-500/10 hover:border-green-400/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white text-sm truncate">{result.name}</div>
                          <div className="text-xs text-white/50 truncate">{result.fullName}</div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Popular Locations */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white/80">Popular Base Locations</h4>
            <div className="grid grid-cols-2 gap-3">
              {popularLocations.map((location, index) => (
                <button
                  key={index}
                  onClick={() => handleSetPopularLocation(location)}
                  className="p-3 rounded-lg text-left transition-all duration-200 bg-white/5 border border-white/10 hover:bg-green-500/10 hover:border-green-400/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm truncate">{location.name}</div>
                      <div className="text-xs text-white/50 truncate">{location.context}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <h4 className="text-sm font-medium text-green-400 mb-2">About Base Locations</h4>
            <ul className="text-xs text-green-300 space-y-1">
              <li>• Set the main city or region for this day</li>
              <li>• All activities and destinations will be planned around this location</li>
              <li>• Helps organize multi-city trips logically</li>
              <li>• Can be changed anytime without losing your activities</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
