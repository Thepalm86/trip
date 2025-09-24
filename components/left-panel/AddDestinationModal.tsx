'use client'

import { useState, useEffect } from 'react'
import { X, Search, MapPin, Star, Clock, DollarSign, Plus } from 'lucide-react'
import { Destination } from '@/types'
import { useTripStore } from '@/lib/store/trip-store'

interface AddDestinationModalProps {
  dayId: string
  onClose: () => void
}

interface SearchResult {
  id: string
  name: string
  fullName: string
  coordinates: [number, number]
  category?: string
  contextLabel?: string
  rating?: number
}

export function AddDestinationModal({ dayId, onClose }: AddDestinationModalProps) {
  const { addDestinationToDay } = useTripStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDestination, setSelectedDestination] = useState<SearchResult | null>(null)
  const [duration, setDuration] = useState(2)
  const [cost, setCost] = useState(0)
  const [notes, setNotes] = useState('')

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
        endpoint.searchParams.set('types', 'poi,place,neighborhood,address')

        const response = await fetch(endpoint.toString(), { signal: controller.signal })
        if (!response.ok) return

        const data = await response.json()
        const features = data.features ?? []
        
        const mapped: SearchResult[] = features.map((feature: any) => ({
          id: feature.id,
          name: feature.text,
          fullName: feature.place_name,
          coordinates: feature.center,
          category: feature.properties?.category,
          contextLabel: feature.context?.[0]?.text,
          rating: Math.random() * 2 + 3 // Mock rating
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

  const handleAddDestination = () => {
    if (!selectedDestination) return

    const destination: Destination = {
      id: `search-${Date.now()}`,
      name: selectedDestination.name,
      description: selectedDestination.fullName,
      coordinates: selectedDestination.coordinates,
      category: (selectedDestination.category as Destination['category']) ?? 'attraction',
      estimatedDuration: duration,
      cost: cost > 0 ? cost : undefined,
      rating: selectedDestination.rating,
    }

    addDestinationToDay(destination, dayId)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Add Destination</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
          {/* Search */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for destinations..."
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400/50 transition-all duration-200"
              />
            </div>

            {/* Search Results */}
            {query.length >= 2 && (
              <div className="space-y-2">
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
                      onClick={() => setSelectedDestination(result)}
                      className={`w-full p-3 rounded-lg text-left transition-all duration-200 ${
                        selectedDestination?.id === result.id
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleAddDestination}
            disabled={!selectedDestination}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium transition-all duration-200 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Destination
          </button>
        </div>
      </div>
    </div>
  )
}
