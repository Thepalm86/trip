'use client'

import { useEffect, useState } from 'react'
import { Search, Loader2, MapPin, Sparkles, X } from 'lucide-react'
import { useExploreStore } from '@/lib/store/explore-store'
import type { ExplorePlace } from '@/types'

const MIN_QUERY_LENGTH = 2

interface ExploreSearchDockProps {
  defaultExpanded?: boolean
}

export function ExploreSearchDock({ defaultExpanded = false }: ExploreSearchDockProps) {
  const query = useExploreStore((state) => state.query)
  const setQuery = useExploreStore((state) => state.setQuery)
  const results = useExploreStore((state) => state.results)
  const recent = useExploreStore((state) => state.recent)
  const isSearching = useExploreStore((state) => state.isSearching)
  const selectedPlace = useExploreStore((state) => state.selectedPlace)
  const searchPlaces = useExploreStore((state) => state.searchPlaces)
  const setSelectedPlace = useExploreStore((state) => state.setSelectedPlace)
  const addRecent = useExploreStore((state) => state.addRecent)
  const addActivePlace = useExploreStore((state) => state.addActivePlace)
  const error = useExploreStore((state) => state.error)

  const [localQuery, setLocalQuery] = useState(query)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    setLocalQuery(query)
  }, [query])

  useEffect(() => {
    const trimmed = localQuery.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return
    }

    const handler = setTimeout(() => {
      setQuery(trimmed)
      searchPlaces(trimmed)
      setShowResults(true)
    }, 300)

    return () => clearTimeout(handler)
  }, [localQuery, searchPlaces, setQuery])

  const handleSelect = (place: ExplorePlace) => {
    addRecent(place)
    addActivePlace(place)
    setSelectedPlace(null)
    setLocalQuery('')
    setShowResults(false)
    setIsExpanded(false)
  }

  if (!isExpanded) {
    return (
      <button
        onClick={() => {
          setIsExpanded(true)
          setTimeout(() => setShowResults(true), 150)
        }}
        className="pointer-events-auto inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/80 transition hover:bg-white/10"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 text-blue-200">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex flex-col">
          <span className="font-semibold text-white">Explore anywhere</span>
          <span className="text-xs uppercase tracking-wide text-white/50">Search cities, POIs, base hubs</span>
        </div>
      </button>
    )
  }

  return (
    <div className="pointer-events-auto w-80 max-w-full">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-lg shadow-2xl">
        <div className="relative flex items-center">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            autoFocus
            value={localQuery}
            onFocus={() => setShowResults(true)}
            onChange={(event) => setLocalQuery(event.target.value)}
            placeholder="Search places, cities, POIs..."
            className="w-full rounded-2xl bg-transparent py-3 pl-11 pr-12 text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
            {isSearching && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}
            <button
              onClick={() => {
                setSelectedPlace(null)
                setLocalQuery('')
                setShowResults(false)
                setIsExpanded(false)
              }}
              className="rounded-full bg-white/5 p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {(showResults || results.length > 0 || recent.length > 0) && (
          <div className="max-h-72 overflow-y-auto border-t border-white/10">
            {error ? (
              <div className="p-4 text-sm text-red-300">{error}</div>
            ) : localQuery.trim().length >= MIN_QUERY_LENGTH ? (
              <ResultList
                title="Results"
                isSearching={isSearching}
                items={results}
                onSelect={handleSelect}
              />
            ) : recent.length > 0 ? (
              <ResultList
                title="Recent"
                items={recent}
                onSelect={handleSelect}
              />
            ) : (
              <div className="p-4 text-sm text-white/50">
                Start typing to discover places across your trip.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface ResultListProps {
  title: string
  items: ExplorePlace[]
  onSelect: (place: ExplorePlace) => void
  isSearching?: boolean
}

function ResultList({ title, items, onSelect, isSearching }: ResultListProps) {
  if (isSearching) {
    return (
      <div className="flex items-center gap-3 p-4 text-sm text-white/60">
        <Loader2 className="h-4 w-4 animate-spin" />
        Searching locations...
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="p-4 text-sm text-white/50">No matches yet. Try a different search.</div>
    )
  }

  return (
    <div className="space-y-1 p-2">
      <div className="px-2 text-xs font-semibold uppercase tracking-wider text-white/40">{title}</div>
      {items.map((place) => (
        <button
          key={place.id}
          onClick={() => onSelect(place)}
          className="flex w-full flex-col gap-1 rounded-xl px-3 py-2 text-left transition-all duration-200 hover:bg-white/5"
        >
          <div className="flex items-center justify-between text-sm text-white">
            <span className="font-semibold">{place.name}</span>
            {place.relevance && (
              <span className="text-xs text-white/40">{Math.round(place.relevance * 100)}%</span>
            )}
          </div>
          <div className="text-xs text-white/60 line-clamp-1">{place.fullName}</div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/40">
            <MapPin className="h-3 w-3" />
            <span>{place.category || 'Place'}</span>
            {place.context && (
              <>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span className="line-clamp-1">{place.context}</span>
              </>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
