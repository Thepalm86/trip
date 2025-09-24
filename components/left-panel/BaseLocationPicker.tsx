'use client'

import { useState, useEffect } from 'react'
import { X, MapPin, Search, Plus, Navigation } from 'lucide-react'
import { DayLocation } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'

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
  category?: string
}

function getCategoryLabel(category: string): string {
  const categoryLabels: Record<string, string> = {
    'country': 'Country',
    'administrative_area_level_1': 'State/Province',
    'administrative_area_level_2': 'Region/County',
    'locality': 'City',
    'sublocality': 'Town/Neighborhood',
    'establishment': 'Business',
    'tourist_attraction': 'Attraction',
    'restaurant': 'Restaurant',
    'lodging': 'Hotel',
    'shopping_mall': 'Shopping',
    'museum': 'Museum',
    'park': 'Park',
    'location': 'Location'
  }
  return categoryLabels[category] || 'Location'
}

export function BaseLocationPicker({ dayId, onClose }: BaseLocationPickerProps) {
  const { currentTrip, setDayLocation } = useSupabaseTripStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null)

  if (!currentTrip) {
    return null
  }

  const day = currentTrip.days.find(d => d.id === dayId)
  const dayIndex = currentTrip.days.findIndex(d => d.id === dayId)

  // Nearby recommendations (future feature)
  const [nearbyRecommendations, setNearbyRecommendations] = useState<LocationResult[]>([])
  const [showNearbyRecommendations, setShowNearbyRecommendations] = useState(false)

  // Google Places API search functionality (via Next.js API route)
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }

    const controller = new AbortController()
    const fetchResults = async () => {
      try {
        setIsLoading(true)
        
        // Use our Next.js API route to proxy Google Places API
        const apiEndpoint = new URL('/api/places/search', window.location.origin)
        apiEndpoint.searchParams.set('query', query)

        const response = await fetch(apiEndpoint.toString(), { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()
        const googleResults = data.results ?? []
        
        const mapped: LocationResult[] = googleResults.slice(0, 6).map((place: any) => ({
          id: `google-${place.place_id}`,
          name: place.name,
          fullName: place.formatted_address,
          coordinates: [place.geometry.location.lng, place.geometry.location.lat] as [number, number],
          context: place.formatted_address.split(',').slice(-2).join(', ').trim(),
          category: place.types?.[0] || 'location'
        }))

        setResults(mapped)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Places search error:', error)
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

  // Future feature: Get nearby recommendations based on selected location
  const handleGetNearbyRecommendations = async (location: LocationResult) => {
    setShowNearbyRecommendations(true)
    // TODO: Implement nearby recommendations API call
    // This would fetch popular attractions, restaurants, hotels, etc. near the selected location
    console.log('Getting nearby recommendations for:', location.name)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl h-[80vh] overflow-hidden flex flex-col">
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
        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-6">
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
                placeholder="Search for cities, regions, or specific places..."
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-green-400/50 transition-all duration-200"
              />
            </div>

            {/* Search Results */}
            {query.length >= 2 && (
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide">
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
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white text-sm truncate">{result.name}</span>
                            {result.category && (
                              <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                                {getCategoryLabel(result.category)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-white/50 truncate">{result.fullName}</div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Nearby Recommendations (Future Feature) */}
          {showNearbyRecommendations && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-white/80">Nearby Recommendations</h4>
                <button
                  onClick={() => setShowNearbyRecommendations(false)}
                  className="text-xs text-white/60 hover:text-white transition-colors"
                >
                  Hide
                </button>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="text-sm text-blue-400 mb-2">🚀 Coming Soon</div>
                <p className="text-xs text-blue-300">
                  This feature will show popular attractions, restaurants, and hotels near your selected base location.
                </p>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <h4 className="text-sm font-medium text-green-400 mb-2">About Base Locations</h4>
            <ul className="text-xs text-green-300 space-y-1">
              <li>• Set the main city, region, or specific place for this day</li>
              <li>• All activities and destinations will be planned around this location</li>
              <li>• Can be a hotel, landmark, or any point of interest</li>
              <li>• Helps organize multi-city trips logically</li>
              <li>• Can be changed anytime without losing your activities</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 p-6 border-t border-white/10">
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
