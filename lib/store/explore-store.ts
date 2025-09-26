'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ExplorePlace } from '@/types'

interface ExploreStoreState {
  query: string
  results: ExplorePlace[]
  recent: ExplorePlace[]
  selectedPlace: ExplorePlace | null
  activePlaces: ExplorePlace[]
  isSearching: boolean
  error: string | null
  setQuery: (query: string) => void
  searchPlaces: (query: string) => Promise<void>
  setSelectedPlace: (place: ExplorePlace | null) => void
  clearResults: () => void
  addRecent: (place: ExplorePlace) => void
  addActivePlace: (place: ExplorePlace) => void
  removeActivePlace: (placeId: string) => void
}

export const useExploreStore = create<ExploreStoreState>()(
  persist(
    (set, get) => ({
      query: '',
      results: [],
      recent: [],
      selectedPlace: null,
      activePlaces: [],
      isSearching: false,
      error: null,
      setQuery: (query) => set({ query }),
      searchPlaces: async (query: string) => {
        const trimmed = query.trim()
        if (trimmed.length < 2) {
          set({ results: [], error: null })
          return
        }

        set({ isSearching: true, error: null })
        try {
          const response = await fetch(`/api/explore/search?query=${encodeURIComponent(trimmed)}`)
          if (!response.ok) {
            throw new Error(`Search failed with status ${response.status}`)
          }
          const data = await response.json()
          const results: ExplorePlace[] = data.results ?? []
          set({ results, error: null })
        } catch (error) {
          console.error('ExploreStore: search error', error)
          set({
            error: error instanceof Error ? error.message : 'Unable to search locations',
            results: [],
          })
        } finally {
          set({ isSearching: false })
        }
      },
      setSelectedPlace: (place) => set({ selectedPlace: place }),
      clearResults: () => set({ results: [], error: null }),
      addRecent: (place) => {
        const { recent } = get()
        const filtered = recent.filter((item) => item.id !== place.id)
        const updated = [place, ...filtered].slice(0, 6)
        set({ recent: updated })
      },
      addActivePlace: (place) => {
        const { activePlaces } = get()
        const exists = activePlaces.some((item) => item.id === place.id)
        if (exists) return
        set({ activePlaces: [...activePlaces, place] })
      },
      removeActivePlace: (placeId) => {
        const { activePlaces, selectedPlace } = get()
        const updated = activePlaces.filter((place) => place.id !== placeId)
        set({
          activePlaces: updated,
          selectedPlace: selectedPlace?.id === placeId ? null : selectedPlace,
        })
      },
    }),
    {
      name: 'explore-store',
      partialize: (state) => ({
        recent: state.recent,
        // Only persist the recent places list, not temporary state like query, results, etc.
      }),
    }
  )
)
