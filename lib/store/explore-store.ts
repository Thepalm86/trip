'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { ExplorePlace } from '@/types'
import { exploreApiService } from '@/lib/supabase/explore-api'
import { resolveCityFromPlace, fallbackCityFromFullName } from '@/lib/location/city'
import { getExploreCategoryMetadata } from '@/lib/explore/categories'

interface RouteSelectionState {
  start: ExplorePlace | null
  end: ExplorePlace | null
}

interface ExploreStoreState {
  query: string
  results: ExplorePlace[]
  recent: ExplorePlace[]
  selectedPlace: ExplorePlace | null
  activePlaces: ExplorePlace[]
  isSearching: boolean
  error: string | null
  isSyncing: boolean
  showMarkers: boolean
  visibleCategories: string[] | null
  lastAddedPlace: ExplorePlace | null
  routeSelection: RouteSelectionState
  setQuery: (query: string) => void
  searchPlaces: (query: string) => Promise<void>
  setSelectedPlace: (place: ExplorePlace | null) => void
  clearResults: () => void
  addRecent: (place: ExplorePlace) => void
  addActivePlace: (place: ExplorePlace) => Promise<void>
  removeActivePlace: (placeId: string) => Promise<void>
  updateActivePlace: (placeId: string, updates: Partial<Omit<ExplorePlace, 'notes'>> & { notes?: string | null }) => Promise<ExplorePlace | null>
  toggleFavorite: (placeId: string) => Promise<void>
  syncWithSupabase: () => Promise<void>
  loadFromSupabase: () => Promise<void>
  toggleMarkers: () => void
  setShowMarkers: (showMarkers: boolean) => void
  setVisibleCategories: (categories: string[] | null) => void
  reset: () => void
  clearLastAddedPlace: () => void
  setRouteSelectionStart: (place: ExplorePlace | null) => void
  setRouteSelectionEnd: (place: ExplorePlace | null) => void
  setRouteSelection: (selection: RouteSelectionState) => void
  clearRouteSelection: () => void
}

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

const storage = typeof window === 'undefined'
  ? createJSONStorage(() => noopStorage)
  : createJSONStorage(() => window.localStorage)

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
      showMarkers: true,
      visibleCategories: null,
      lastAddedPlace: null,
      routeSelection: { start: null, end: null },
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
        const { activePlaces, visibleCategories } = get()
        const placeIdHint = (place.metadata?.placeId as string | undefined)
          ?? (place.metadata?.place_id as string | undefined)
          ?? (place.metadata?.sourceId as string | undefined)

        const resolvedCity = await resolveCityFromPlace(placeIdHint, place.fullName ?? place.name)
        const normalizedCity = resolvedCity === 'Unknown' ? undefined : resolvedCity

        const categoryKey = getExploreCategoryMetadata(place.category).key

        const placeWithSourceId: ExplorePlace = {
          ...place,
          city: normalizedCity,
          metadata: {
            ...(place.metadata ?? {}),
            sourceId: (place.metadata?.sourceId as string | undefined) ?? place.id,
          },
          isFavorite: place.isFavorite ?? false,
        }

        const exists = activePlaces.some((item) => {
          const matchesId = item.id === placeWithSourceId.id
          const matchesSourceId = (item.metadata?.sourceId as string | undefined) === (placeWithSourceId.metadata?.sourceId as string | undefined)
          const matchesLocation =
            item.name === placeWithSourceId.name &&
            item.coordinates[0] === placeWithSourceId.coordinates[0] &&
            item.coordinates[1] === placeWithSourceId.coordinates[1]

          return matchesId || matchesSourceId || matchesLocation
        })
        if (exists) return

        try {
          // Add to Supabase
          const savedPlace = await exploreApiService.addExplorePlace(placeWithSourceId)

          // Merge notes (Supabase record does not persist notes yet)
        const mergedPlace: ExplorePlace = {
          ...savedPlace,
          notes: savedPlace.notes ?? placeWithSourceId.notes ?? null,
          links: savedPlace.links ?? placeWithSourceId.links ?? undefined,
          metadata: {
            ...(savedPlace.metadata ?? {}),
            ...(placeWithSourceId.metadata ?? {}),
          },
          city: placeWithSourceId.city ?? savedPlace.city,
          isFavorite: savedPlace.isFavorite ?? placeWithSourceId.isFavorite ?? false,
        }

          const nextVisibleCategories = Array.isArray(visibleCategories) && !visibleCategories.includes(categoryKey)
            ? [...visibleCategories, categoryKey]
            : visibleCategories

          // Update local state with persisted record (to use canonical ID)
          set({
            activePlaces: [...activePlaces, mergedPlace],
            lastAddedPlace: mergedPlace,
            visibleCategories: nextVisibleCategories ?? null,
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : undefined
          const isAuthError = errorMessage === 'User not authenticated'

          const logPayload = {
            error,
            errorMessage,
            placeId: placeWithSourceId.id,
          }

          if (isAuthError) {
            console.warn('ExploreStore: User not authenticated, storing place locally only', logPayload)
          } else {
            console.error('ExploreStore: Error adding active place to Supabase', logPayload)
          }

          const nextVisibleCategories = Array.isArray(visibleCategories) && !visibleCategories.includes(categoryKey)
            ? [...visibleCategories, categoryKey]
            : visibleCategories

          // Still add to local state even if Supabase fails
          const nextPlace = { ...placeWithSourceId }
          set({
            activePlaces: [...activePlaces, nextPlace],
            lastAddedPlace: nextPlace,
            visibleCategories: nextVisibleCategories ?? null,
          })
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
      updateActivePlace: async (placeId, updates) => {
        const { activePlaces, selectedPlace } = get()
        const existingPlace = activePlaces.find((place) => place.id === placeId)

        if (!existingPlace) {
          console.warn('ExploreStore: Attempted to update missing place', { placeId, updates })
          return null
        }

        const mergedMetadata = {
          ...(existingPlace.metadata ?? {}),
          ...(updates.metadata ?? {}),
        }

        const sanitizedUpdates: Partial<ExplorePlace> = {
          ...updates,
        }

        if ('links' in updates) {
          sanitizedUpdates.links = updates.links ?? undefined
        }

        const updatedPlace: ExplorePlace = {
          ...existingPlace,
          ...sanitizedUpdates,
          metadata: mergedMetadata,
        }

        // Ensure coordinates persist if not provided in updates
        if (!updates.coordinates) {
          updatedPlace.coordinates = existingPlace.coordinates
        }

        const refreshedPlaces = activePlaces.map((place) =>
          place.id === placeId ? updatedPlace : place
        )

        set({
          activePlaces: refreshedPlaces,
          selectedPlace: selectedPlace?.id === placeId ? updatedPlace : selectedPlace,
        })

        try {
          const persisted = await exploreApiService.updateExplorePlace({
            ...updatedPlace,
            metadata: mergedMetadata,
            notes: updatedPlace.notes ?? null,
          })

          const finalPlace: ExplorePlace = {
            ...persisted,
            metadata: mergedMetadata,
            notes: persisted.notes ?? updatedPlace.notes ?? null,
            links: persisted.links ?? updatedPlace.links,
            isFavorite: persisted.isFavorite ?? updatedPlace.isFavorite ?? false,
          }

          set((state) => ({
            activePlaces: state.activePlaces.map((place) =>
              place.id === placeId ? finalPlace : place
            ),
            selectedPlace:
              state.selectedPlace?.id === placeId ? finalPlace : state.selectedPlace,
          }))

          return finalPlace
        } catch (error) {
          console.error('ExploreStore: Error updating active place in Supabase', error)
          return updatedPlace
        }
      },
      toggleFavorite: async (placeId) => {
        const { activePlaces, selectedPlace, updateActivePlace } = get()
        const existing = activePlaces.find((place) => place.id === placeId)
        if (!existing) {
          return
        }

        const updatedPlace = { ...existing, isFavorite: !existing.isFavorite }
        const updatedActivePlaces = activePlaces.map((place) =>
          place.id === placeId ? updatedPlace : place
        )

        set({
          activePlaces: updatedActivePlaces,
          selectedPlace:
            selectedPlace?.id === placeId
              ? { ...selectedPlace, isFavorite: updatedPlace.isFavorite }
              : selectedPlace,
        })

        try {
          await updateActivePlace(placeId, { isFavorite: updatedPlace.isFavorite })
        } catch (error) {
          console.error('ExploreStore: Failed to persist favourite toggle', error)
        }
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
          const enriched = await Promise.all(
            places.map(async (place) => {
              if (place.city && place.city.length > 0) {
                return { ...place, isFavorite: place.isFavorite ?? false }
              }

              const placeIdHint = (place.metadata?.placeId as string | undefined)
                ?? (place.metadata?.place_id as string | undefined)
                ?? (place.metadata?.sourceId as string | undefined)

              const resolvedCity = await resolveCityFromPlace(placeIdHint, place.fullName ?? place.name)
              const fallbackCity = fallbackCityFromFullName(place.fullName ?? place.context ?? place.name)
              const normalizedCity = resolvedCity !== 'Unknown' ? resolvedCity : (fallbackCity === 'Unknown' ? undefined : fallbackCity)

              return {
                ...place,
                city: normalizedCity,
                isFavorite: place.isFavorite ?? false,
              }
            })
          )
          const { visibleCategories } = get()
          const allCategories = Array.from(new Set(enriched.map((place) => getExploreCategoryMetadata(place.category).key)))

          const nextVisibleCategories = Array.isArray(visibleCategories)
            ? Array.from(new Set([...visibleCategories.filter((key) => allCategories.includes(key)), ...allCategories]))
            : null

          set({ activePlaces: enriched, visibleCategories: nextVisibleCategories })
        } catch (error) {
          console.error('ExploreStore: Error loading from Supabase', error)
          set({ error: error instanceof Error ? error.message : 'Load failed' })
        } finally {
          set({ isSyncing: false })
        }
      },
      toggleMarkers: () => {
        const state = get()
        const next = !state.showMarkers

        if (next && Array.isArray(state.visibleCategories) && state.visibleCategories.length === 0) {
          set({ showMarkers: next, visibleCategories: null })
          return
        }

        set({ showMarkers: next })
      },
      setShowMarkers: (showMarkers) => {
        const { visibleCategories } = get()

        if (showMarkers && Array.isArray(visibleCategories) && visibleCategories.length === 0) {
          set({ showMarkers, visibleCategories: null })
          return
        }

        set({ showMarkers })
      },
      setVisibleCategories: (categories) => {
        const normalized = Array.isArray(categories)
          ? categories.map((category) => category.trim().toLowerCase())
          : null

        const shouldShowMarkers = normalized === null ? true : normalized.length > 0

        set({
          visibleCategories: normalized,
          showMarkers: shouldShowMarkers,
        })
      },
      setRouteSelectionStart: (place) => set((state) => ({
        routeSelection: {
          ...state.routeSelection,
          start: place,
        },
      })),
      setRouteSelectionEnd: (place) => set((state) => ({
        routeSelection: {
          ...state.routeSelection,
          end: place,
        },
      })),
      setRouteSelection: (selection) => set({ routeSelection: selection }),
      clearRouteSelection: () => set({ routeSelection: { start: null, end: null } }),
      clearLastAddedPlace: () => set({ lastAddedPlace: null }),
      reset: () => {
        const { showMarkers, visibleCategories } = get()
        set({
          query: '',
          results: [],
          recent: [],
          selectedPlace: null,
          activePlaces: [],
          isSearching: false,
          error: null,
          isSyncing: false,
          showMarkers,
          visibleCategories,
          lastAddedPlace: null,
          routeSelection: { start: null, end: null },
        })
      },
    }),
    {
      name: 'explore-store',
      version: 4,
      storage,
      partialize: (state) => ({
        recent: state.recent,
        showMarkers: state.showMarkers,
        activePlaces: state.activePlaces,
        // Persist recent search history, marker visibility preference, and saved markers
      }),
      migrate: (persistedState, version) => {
        if (version < 2 && persistedState) {
          const { activePlaces: _oldActivePlaces, ...rest } = persistedState as Record<string, unknown>
          return rest
        }
        if (version < 3 && persistedState) {
          return {
            ...(persistedState as Record<string, unknown>),
            visibleCategories: null,
          }
        }
        if (version < 4 && persistedState) {
          const { visibleCategories: _discarded, ...rest } = persistedState as Record<string, unknown>
          return rest
        }
        return persistedState as any
      },
    }
  )
)
