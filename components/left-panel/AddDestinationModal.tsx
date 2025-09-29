'use client'

import { useState, useEffect } from 'react'
import { X, Search, MapPin, Star } from 'lucide-react'
import { Destination } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { resolveCityFromPlace } from '@/lib/location/city'

interface AddDestinationModalProps {
  dayId: string
  onClose: () => void
  onAddToMaybe?: (destination: Destination) => void
}

interface SearchResult {
  id: string
  name: string
  fullName: string
  coordinates: [number, number]
  category?: string
  contextLabel?: string
  rating?: number
  placeId?: string
}

const CATEGORY_OPTIONS = [
  { value: 'city', label: 'City' },
  { value: 'attraction', label: 'Attraction' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'activity', label: 'Activity' },
  { value: 'other', label: 'Other' },
]

interface CategorySelectionDialogProps {
  placeName: string
  selectedCategory: string
  onSelectCategory: (category: string) => void
  onCancel: () => void
  onConfirm: () => void
}

function CategorySelectionDialog({ placeName, selectedCategory, onSelectCategory, onCancel, onConfirm }: CategorySelectionDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white">Choose category</h3>
        <p className="mt-1 text-sm text-white/60">{placeName}</p>
        <div className="mt-4 grid gap-2">
          {CATEGORY_OPTIONS.map((option) => {
            const isSelected = selectedCategory === option.value
            return (
              <button
                key={option.value}
                onClick={() => onSelectCategory(option.value)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-blue-500/40 hover:bg-blue-500/15 hover:text-white'
                }`}
              >
                <span>{option.label}</span>
                {isSelected && <span className="text-xs text-blue-300">Selected</span>}
              </button>
            )
          })}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
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

export function AddDestinationModal({ dayId, onClose, onAddToMaybe }: AddDestinationModalProps) {
  const { addDestinationToDay } = useSupabaseTripStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDestination, setSelectedDestination] = useState<SearchResult | null>(null)
  const [duration, setDuration] = useState(2)
  const [cost, setCost] = useState(0)
  const [notes, setNotes] = useState('')
  const [showNearbyRecommendations, setShowNearbyRecommendations] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingDestination, setPendingDestination] = useState<SearchResult | null>(null)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('attraction')

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
        
        const mapped: SearchResult[] = googleResults.slice(0, 6).map((place: any) => ({
          id: `google-${place.place_id}`,
          name: place.name,
          fullName: place.formatted_address,
          coordinates: [place.geometry.location.lng, place.geometry.location.lat] as [number, number],
          category: place.types?.[0] || 'attraction',
          contextLabel: place.formatted_address.split(',').slice(-2).join(', ').trim(),
          rating: place.rating || Math.random() * 2 + 3,
          placeId: place.place_id,
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

  const handleAddDestination = async () => {
    if (!selectedDestination) return
    setIsSaving(true)

    try {
      const city = await resolveCityFromPlace(selectedDestination.placeId, selectedDestination.fullName)

      const destination: Destination = {
        id: `search-${Date.now()}`,
        name: selectedDestination.name,
        description: selectedDestination.fullName,
        coordinates: selectedDestination.coordinates,
        city: city === 'Unknown' ? undefined : city,
        category: (selectedDestination.category as Destination['category']) ?? 'attraction',
        estimatedDuration: duration,
        cost: cost > 0 ? cost : undefined,
        rating: selectedDestination.rating,
        notes: notes || undefined,
      }

      if (dayId === 'maybe' && onAddToMaybe) {
        onAddToMaybe(destination)
      } else {
        await addDestinationToDay(destination, dayId)
      }

      onClose()
    } catch (error) {
      console.error('AddDestinationModal: Failed to add destination', error)
    } finally {
      setIsSaving(false)
    }
  }

  const activeSelectionId = categoryDialogOpen && pendingDestination
    ? pendingDestination.id
    : selectedDestination?.id

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl h-[80vh] overflow-hidden flex flex-col">
        {/* Enhanced Header with Icon */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Add Destination</h3>
              <p className="text-sm text-white/60">Search for attractions, restaurants, hotels, landmarks</p>
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
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide">
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
                    <button
                      key={result.id}
                      onClick={() => {
                        setPendingDestination(result)
                        setSelectedCategory(result.category ?? 'attraction')
                        setCategoryDialogOpen(true)
                      }}
                      className={`w-full p-3 rounded-lg text-left transition-all duration-200 ${
                        activeSelectionId === result.id
                          ? 'bg-blue-500/20 border border-blue-400/30'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
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
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Destination Details */}
          {selectedDestination && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <h4 className="font-medium text-white mb-2">Destination Details</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50">Category</p>
                      <p className="text-sm font-medium text-white">
                        {CATEGORY_OPTIONS.find((option) => option.value === selectedDestination.category)?.label ?? 'Custom'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setPendingDestination(selectedDestination)
                        setSelectedCategory(selectedDestination.category ?? 'attraction')
                        setCategoryDialogOpen(true)
                      }}
                      className="text-xs font-medium text-blue-300 hover:text-blue-200 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm text-white/80 mb-1">Duration (hours)</label>
                    <input
                      type="number"
                      min="0.5"
                      max="12"
                      step="0.5"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-400/50"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-white/80 mb-1">Estimated Cost (€)</label>
                    <input
                      type="number"
                      min="0"
                      value={cost}
                      onChange={(e) => setCost(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-400/50"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-white/80 mb-1">Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about this destination..."
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400/50 resize-none h-20"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nearby Recommendations (Future Feature) */}
          {selectedDestination && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-white/80">Nearby Recommendations</h4>
                <button
                  onClick={() => setShowNearbyRecommendations(!showNearbyRecommendations)}
                  className="text-xs text-white/60 hover:text-white transition-colors"
                >
                  {showNearbyRecommendations ? 'Hide' : 'Show'}
                </button>
              </div>
              {showNearbyRecommendations && (
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="text-sm text-blue-400 mb-2">🚀 Coming Soon</div>
                  <p className="text-xs text-blue-300">
                    This feature will show similar attractions, restaurants, and activities near {selectedDestination.name}.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleAddDestination}
            disabled={!selectedDestination || isSaving}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium transition-all duration-200 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Adding…' : 'Add Destination'}
          </button>
        </div>
      </div>
      {categoryDialogOpen && pendingDestination && (
        <CategorySelectionDialog
          placeName={pendingDestination.name}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onCancel={() => {
            setPendingDestination(null)
            setCategoryDialogOpen(false)
          }}
          onConfirm={() => {
            if (!pendingDestination) {
              return
            }
            const destinationWithCategory: SearchResult = {
              ...pendingDestination,
              category: selectedCategory,
            }
            setSelectedDestination(destinationWithCategory)
            setPendingDestination(null)
            setCategoryDialogOpen(false)
          }}
        />
      )}
    </div>
  )
}
