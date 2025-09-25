'use client'

import { useState, useEffect } from 'react'
import { 
  Search, 
  MapPin, 
  Star, 
  Clock, 
  X, 
  Plus,
  Trash2
} from 'lucide-react'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { Destination } from '@/types'

interface SearchResult {
  id: string
  name: string
  fullName: string
  coordinates: [number, number]
  category?: string
  contextLabel?: string
  rating?: number
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
    'attraction': 'Attraction',
    'location': 'Location'
  }
  return categoryLabels[category] || 'Location'
}

export function ExplorationTab() {
  const { 
    currentTrip, 
    explorationLocations, 
    addExplorationLocation, 
    removeExplorationLocation,
    clearExplorationLocations,
    selectedDestination,
    setSelectedDestination,
    selectedDayId,
    setSelectedDay,
    addDestinationToDay
  } = useSupabaseTripStore()
  
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dragOverDayId, setDragOverDayId] = useState<string | null>(null)

  // Google Places API search functionality
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }

    const controller = new AbortController()
    const fetchResults = async () => {
      try {
        setIsLoading(true)
        
        const apiEndpoint = new URL('/api/places/search', window.location.origin)
        apiEndpoint.searchParams.set('query', query)

        const response = await fetch(apiEndpoint.toString(), { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()
        const googleResults = data.results ?? []
        
        const mapped: SearchResult[] = googleResults.slice(0, 8).map((place: any) => ({
          id: `google-${place.place_id}`,
          name: place.name,
          fullName: place.formatted_address,
          coordinates: [place.geometry.location.lng, place.geometry.location.lat] as [number, number],
          category: place.types?.[0] || 'attraction',
          contextLabel: place.formatted_address.split(',').slice(-2).join(', ').trim(),
          rating: place.rating || Math.random() * 2 + 3
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

  const handleAddLocation = (result: SearchResult) => {
    const destination: Destination = {
      id: `exploration-${Date.now()}-${result.id}`,
      name: result.name,
      description: result.fullName,
      coordinates: result.coordinates,
      category: (result.category as Destination['category']) ?? 'attraction',
      estimatedDuration: 2, // Default duration
      rating: result.rating,
    }

    addExplorationLocation(destination)
    setQuery('') // Clear search after adding
    setResults([])
  }

  const handleDrop = (e: React.DragEvent, dayId: string) => {
    e.preventDefault()
    setDragOverDayId(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (data.type === 'exploration-location' && data.location) {
        // Add the exploration location to the selected day
        addDestinationToDay(data.location, dayId)
        // Remove it from exploration locations
        removeExplorationLocation(data.location.id)
      }
    } catch (error) {
      console.error('Error handling drop:', error)
    }
  }

  const handleDragOver = (e: React.DragEvent, dayId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDayId(dayId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverDayId(null)
  }

  const handleRemoveLocation = (destinationId: string) => {
    removeExplorationLocation(destinationId)
  }

  if (!currentTrip) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white text-lg">Loading exploration...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* Timeline Sidebar */}
      <div className="w-80 border-r border-white/10 bg-white/[0.02] overflow-y-auto scrollbar-hide">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/80">Timeline</h3>
            <span className="text-xs text-white/40">Click to view day</span>
          </div>
          
          <div className="space-y-2">
            {currentTrip.days.map((day, index) => {
              const isSelected = selectedDayId === day.id
              return (
                <button
                  key={day.id}
                  onClick={() => setSelectedDay(day.id)}
                  onDrop={(e) => handleDrop(e, day.id)}
                  onDragOver={(e) => handleDragOver(e, day.id)}
                  onDragLeave={handleDragLeave}
                  className={`w-full p-3 rounded-lg text-left transition-all duration-200 ${
                    dragOverDayId === day.id
                      ? 'bg-green-500/20 border border-green-400/50'
                      : isSelected
                      ? 'bg-blue-500/20 border border-blue-400/30'
                      : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      isSelected ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/80'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm">Day {index + 1}</div>
                      <div className="text-xs text-white/60 truncate">
                        {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {day.location && ` • ${day.location.name}`}
                      </div>
                    </div>
                    <div className="text-xs text-white/60">
                      {day.destinations.length}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Exploration Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">Explore Locations</h2>
              <p className="text-sm text-white/60">Search and discover new places to add to your trip</p>
            </div>
            {explorationLocations.length > 0 && (
              <button
                onClick={clearExplorationLocations}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all duration-200 text-sm font-medium"
              >
                <Trash2 className="h-3 w-3" />
                Clear All
              </button>
            )}
          </div>

          {/* Search */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for attractions, restaurants, hotels, landmarks..."
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400/50 transition-all duration-200"
              />
            </div>

            {/* Search Results */}
            {query.length >= 2 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-white/80">Search Results</h4>
                <div className="max-h-64 overflow-y-auto scrollbar-hide space-y-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="flex items-center gap-3 text-sm text-white/60">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                        <span>Searching...</span>
                      </div>
                    </div>
                  ) : results.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="text-sm text-white/60">No results found</div>
                    </div>
                  ) : (
                    results.map((result) => (
                      <div
                        key={result.id}
                        className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                              <MapPin className="h-4 w-4 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-white text-sm truncate">{result.name}</span>
                                {result.category && (
                                  <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">
                                    {getCategoryLabel(result.category)}
                                  </span>
                                )}
                                {result.rating && (
                                  <div className="flex items-center gap-1">
                                    <Star className="h-3 w-3 text-yellow-400 fill-current" />
                                    <span className="text-xs text-white/60">{result.rating.toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-white/50 truncate">{result.fullName}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddLocation(result)}
                            className="ml-3 p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all duration-200"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Added Locations */}
          {explorationLocations.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-white/80">
                Added Locations ({explorationLocations.length})
              </h4>
              <div className="space-y-2">
                {explorationLocations.map((location) => (
                  <div
                    key={location.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'exploration-location',
                        location: location
                      }))
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    className={`p-3 rounded-lg border transition-all duration-200 cursor-grab active:cursor-grabbing ${
                      selectedDestination?.id === location.id
                        ? 'bg-blue-500/20 border-blue-400/30'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedDestination(
                      selectedDestination?.id === location.id ? null : location
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white text-sm truncate">{location.name}</span>
                            {location.category && (
                              <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                                {getCategoryLabel(location.category)}
                              </span>
                            )}
                            {location.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-yellow-400 fill-current" />
                                <span className="text-xs text-white/60">{location.rating.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-white/50">
                            <span className="truncate">{location.description}</span>
                            {location.estimatedDuration && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{location.estimatedDuration}h</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveLocation(location.id)
                        }}
                        className="ml-3 p-2 rounded-lg text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {explorationLocations.length === 0 && query.length < 2 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-white/40" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Start Exploring</h3>
                <p className="text-sm text-white/60 max-w-sm mx-auto">
                  Search for attractions, restaurants, hotels, and other locations to discover new places for your trip
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
