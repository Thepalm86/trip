'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ExplorePlace } from '@/types'
import { exploreApiService } from '@/lib/supabase/explore-api'

interface ExploreStoreState {
  query: string
  results: ExplorePlace[]
  recent: ExplorePlace[]
  selectedPlace: ExplorePlace | null
  activePlaces: ExplorePlace[]
  isSearching: boolean
  error: string | null
  isSyncing: boolean
  setQuery: (query: string) => void
  searchPlaces: (query: string) => Promise<void>
  setSelectedPlace: (place: ExplorePlace | null) => void
  clearResults: () => void
  addRecent: (place: ExplorePlace) => void
  addActivePlace: (place: ExplorePlace) => Promise<void>
  removeActivePlace: (placeId: string) => Promise<void>
  syncWithSupabase: () => Promise<void>
  loadFromSupabase: () => Promise<void>
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
      isSyncing: false,
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
      addActivePlace: async (place) => {
        const { activePlaces } = get()
        const exists = activePlaces.some((item) => item.id === place.id)
        if (exists) return

        try {
          // Add to Supabase
          await exploreApiService.addExplorePlace(place)
          
          // Update local state
          set({ activePlaces: [...activePlaces, place] })
        } catch (error) {
          console.error('ExploreStore: Error adding active place to Supabase', error)
          // Still add to local state even if Supabase fails
          set({ activePlaces: [...activePlaces, place] })
        }
      },
      removeActivePlace: async (placeId) => {
        const { activePlaces, selectedPlace } = get()
        
        try {
          // Remove from Supabase
          await exploreApiService.removeExplorePlace(placeId)
        } catch (error) {
          console.error('ExploreStore: Error removing active place from Supabase', error)
        }

        // Update local state regardless of Supabase result
        const updated = activePlaces.filter((place) => place.id !== placeId)
        set({
          activePlaces: updated,
          selectedPlace: selectedPlace?.id === placeId ? null : selectedPlace,
        })
      },
      syncWithSupabase: async () => {
        const { activePlaces } = get()
        set({ isSyncing: true, error: null })
        
        try {
          await exploreApiService.syncExplorePlaces(activePlaces)
        } catch (error) {
          console.error('ExploreStore: Error syncing with Supabase', error)
          set({ error: error instanceof Error ? error.message : 'Sync failed' })
        } finally {
          set({ isSyncing: false })
        }
      },
      loadFromSupabase: async () => {
        set({ isSyncing: true, error: null })
        
        try {
          const places = await exploreApiService.getExplorePlaces()
          set({ activePlaces: places })
        } catch (error) {
          console.error('ExploreStore: Error loading from Supabase', error)
          set({ error: error instanceof Error ? error.message : 'Load failed' })
        } finally {
          set({ isSyncing: false })
        }
      },
    }),
    {
      name: 'explore-store',
      partialize: (state) => ({
        recent: state.recent,
        activePlaces: state.activePlaces,
        // Persist both recent and active places
      }),
    }
  )
)
