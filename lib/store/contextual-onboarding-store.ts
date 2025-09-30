'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ContextualTip =
  | 'destination-actions'
  | 'accommodation-actions'
  | 'route-metrics'

interface ContextualOnboardingState {
  activeTip: ContextualTip | null
  hasSeenDestinationActions: boolean
  hasSeenAccommodationActions: boolean
  hasSeenRouteMetrics: boolean
  requestTip: (tip: ContextualTip) => void
  dismissTip: () => void
  resetTips: () => void
}

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

const STORAGE_KEY = 'traveal:contextual-coachmarks:v1'

export const useContextualOnboardingStore = create<ContextualOnboardingState>()(
  persist(
    (set, get) => ({
      activeTip: null,
      hasSeenDestinationActions: false,
      hasSeenAccommodationActions: false,
      hasSeenRouteMetrics: false,
      requestTip: (tip) => {
        const state = get()
        if (state.activeTip === tip) {
          return
        }
        if (
          (tip === 'destination-actions' && state.hasSeenDestinationActions) ||
          (tip === 'accommodation-actions' && state.hasSeenAccommodationActions) ||
          (tip === 'route-metrics' && state.hasSeenRouteMetrics)
        ) {
          return
        }
        set({ activeTip: tip })
      },
      dismissTip: () => {
        const { activeTip } = get()
        if (!activeTip) {
          return
        }
        set((state) => {
          if (!state.activeTip) {
            return state
          }
          if (state.activeTip === 'destination-actions') {
            return {
              ...state,
              activeTip: null,
              hasSeenDestinationActions: true,
            }
          }
          if (state.activeTip === 'accommodation-actions') {
            return {
              ...state,
              activeTip: null,
              hasSeenAccommodationActions: true,
            }
          }
          return {
            ...state,
            activeTip: null,
            hasSeenRouteMetrics: true,
          }
        })
      },
      resetTips: () =>
        set({
          activeTip: null,
          hasSeenDestinationActions: false,
          hasSeenAccommodationActions: false,
          hasSeenRouteMetrics: false,
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : noopStorage,
      ),
      partialize: (state) => ({
        hasSeenDestinationActions: state.hasSeenDestinationActions,
        hasSeenAccommodationActions: state.hasSeenAccommodationActions,
        hasSeenRouteMetrics: state.hasSeenRouteMetrics,
      }),
    },
  ),
)
