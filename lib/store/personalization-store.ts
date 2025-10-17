'use client'

import { create } from 'zustand'
import {
  deletePersonalizationProfile,
  getPersonalizationProfile,
  type PersonalizationProfile,
  type PersonalizationProfileInput,
  upsertPersonalizationProfile,
} from '@/lib/supabase/personalization-api'

type PersonalizationStatus = 'idle' | 'loading' | 'ready' | 'error'

interface PersonalizationState {
  profile: PersonalizationProfile | null
  status: PersonalizationStatus
  isSaving: boolean
  error: string | null
  lastLoadedAt: number | null
  hasDismissedPrompt: boolean
  overlay: {
    isOpen: boolean
    onClose?: () => void
  }
  loadProfile: () => Promise<void>
  saveProfile: (input: PersonalizationProfileInput) => Promise<void>
  resetProfile: () => Promise<void>
  setHasDismissedPrompt: (dismissed: boolean) => void
  setOverlayState: (overlay: { isOpen: boolean; onClose?: () => void }) => void
  setProfileForTesting?: (profile: PersonalizationProfile | null) => void
}

export const usePersonalizationStore = create<PersonalizationState>((set, get) => ({
  profile: null,
  status: 'idle',
  isSaving: false,
  error: null,
  lastLoadedAt: null,
  hasDismissedPrompt: false,
  overlay: {
    isOpen: false,
    onClose: undefined,
  },

  loadProfile: async () => {
    const { status } = get()
    if (status === 'loading') {
      return
    }

    set({ status: 'loading', error: null })
    try {
      const profile = await getPersonalizationProfile()
      set({
        profile,
        status: 'ready',
        error: null,
        lastLoadedAt: Date.now(),
      })
    } catch (error) {
      console.error('[personalization] loadProfile failed', error)
      set({
        profile: null,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to load personalization profile',
      })
    }
  },

  saveProfile: async (input) => {
    set({ isSaving: true, error: null })
    try {
      const profile = await upsertPersonalizationProfile(input)
      set({
        profile,
        status: 'ready',
        isSaving: false,
        error: null,
        lastLoadedAt: Date.now(),
        hasDismissedPrompt: true,
      })
    } catch (error) {
      console.error('[personalization] saveProfile failed', error)
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save personalization profile',
        status: 'error',
      })
      throw error
    }
  },

  resetProfile: async () => {
    set({ isSaving: true, error: null })
    try {
      await deletePersonalizationProfile()
      set({
        profile: null,
        isSaving: false,
        status: 'ready',
        error: null,
        hasDismissedPrompt: false,
        lastLoadedAt: Date.now(),
      })
    } catch (error) {
      console.error('[personalization] resetProfile failed', error)
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to reset personalization profile',
        status: 'error',
      })
      throw error
    }
  },

  setHasDismissedPrompt: (dismissed: boolean) => {
    set({ hasDismissedPrompt: dismissed })
  },

  setOverlayState: (overlay) => {
    set({ overlay })
  },

  setProfileForTesting: (profile) => set({ profile }),
}))
