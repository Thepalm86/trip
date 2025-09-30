'use client'

import { create } from 'zustand'

type OnboardingStepId = string | null

interface OnboardingStore {
  isDemoActive: boolean
  currentStepId: OnboardingStepId
  startDemo: () => void
  stopDemo: () => void
  setStep: (stepId: OnboardingStepId) => void
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  isDemoActive: false,
  currentStepId: null,
  startDemo: () => set({ isDemoActive: true }),
  stopDemo: () => set({ isDemoActive: false, currentStepId: null }),
  setStep: (stepId) => set({ currentStepId: stepId }),
}))
