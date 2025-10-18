'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  X,
  Sparkles,
  Footprints,
  BusFront,
  Car,
  Gauge,
  Feather,
  Mountain,
  Martini,
  Utensils,
  Landmark,
  PartyPopper,
  Trees,
  PiggyBank,
  Building,
  Salad,
  Cake,
  HeartPulse,
  Shell,
  Check,
  ChevronLeft,
  Loader2,
  ArrowRight,
  Leaf,
  WheatOff,
} from 'lucide-react'
import clsx from 'clsx'

import { usePersonalizationStore } from '@/lib/store/personalization-store'
import type { PersonalizationProfileInput } from '@/lib/supabase/personalization-api'

interface PersonalizationModalProps {
  isOpen: boolean
  onClose: () => void
}

type PersonalizationStep = 1 | 2 | 3

type PaceOption = {
  value: PersonalizationProfileInput['pace']
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

type MobilityOption = {
  value: PersonalizationProfileInput['mobility']
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

type PickerOption = {
  value: string
  label: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
}

const paceOptions: PaceOption[] = [
  {
    value: 'leisurely',
    title: 'Leisurely Explorer',
    description: 'Slow mornings, scenic strolls, generous downtime.',
    icon: Feather,
  },
  {
    value: 'balanced',
    title: 'Balanced Adventurer',
    description: 'A steady rhythm of highlights and relaxed pockets.',
    icon: Gauge,
  },
  {
    value: 'packed',
    title: 'Momentum Seeker',
    description: 'Maximize every hour with a brisk, energetic cadence.',
    icon: Mountain,
  },
]

const mobilityOptions: MobilityOption[] = [
  {
    value: 'walking',
    title: 'Mostly walking',
    description: 'I enjoy covering ground on foot whenever possible.',
    icon: Footprints,
  },
  {
    value: 'mixed',
    title: 'Mix it up',
    description: 'Happy to blend walking with transit and short rides.',
    icon: Car,
  },
  {
    value: 'rideshare',
    title: 'Ride-first',
    description: 'Prefer private transfers or minimal walking.',
    icon: BusFront,
  },
]

const interestOptions: PickerOption[] = [
  { value: 'food', label: 'Food & drink', description: 'Signature restaurants, markets, hidden bars', icon: Utensils },
  { value: 'culture', label: 'Culture', description: 'Museums, galleries, local history', icon: Landmark },
  { value: 'outdoors', label: 'Outdoors', description: 'Parks, hikes, natural escapes', icon: Trees },
  { value: 'nightlife', label: 'Nightlife', description: 'Late-night energy, live music, speakeasies', icon: PartyPopper },
  { value: 'adventure', label: 'Adventure', description: 'High-energy pursuits and adrenaline hits', icon: Mountain },
  { value: 'wellness', label: 'Wellness', description: 'Spas, mindful retreats, restorative sessions', icon: HeartPulse },
  { value: 'architecture', label: 'Design & architecture', description: 'Iconic structures and neighborhood gems', icon: Building },
  { value: 'family', label: 'Family-friendly', description: 'Kid-ready activities and relaxed pacing', icon: Sparkles },
]

const budgetOptions: PickerOption[] = [
  { value: 'lean', label: 'Value-focused', description: 'Smart savings without sacrificing experience', icon: PiggyBank },
  { value: 'mid', label: 'Comfort', description: 'Thoughtful mix of splurge and savvy', icon: Building },
  { value: 'premium', label: 'Premium', description: 'Ready for standout reservations and upgrades', icon: Martini },
]

const dietaryOptions: PickerOption[] = [
  { value: 'vegetarian', label: 'Vegetarian', icon: Salad },
  { value: 'vegan', label: 'Vegan', icon: Leaf },
  { value: 'gluten_free', label: 'Gluten-free', icon: WheatOff },
  { value: 'dairy_free', label: 'Dairy-free', icon: Cake },
  { value: 'halal', label: 'Halal', icon: Utensils },
  { value: 'kosher', label: 'Kosher', icon: Shell },
  { value: 'no_restrictions', label: 'No specific restrictions', icon: Sparkles },
]

type PersonalizationFormState = {
  pace: PersonalizationProfileInput['pace']
  mobility: PersonalizationProfileInput['mobility']
  interests: string[]
  budgetLevel: PersonalizationProfileInput['budgetLevel'] | null
  dietary: string[]
  notes: string
}

const defaultForm: PersonalizationFormState = {
  pace: 'balanced',
  mobility: 'mixed',
  interests: ['culture', 'food'],
  budgetLevel: null,
  dietary: [],
  notes: '',
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function PersonalizationModal({ isOpen, onClose }: PersonalizationModalProps) {
  const [step, setStep] = useState<PersonalizationStep>(1)
  const [draft, setDraft] = useState<PersonalizationFormState>(defaultForm)
  const [showValidation, setShowValidation] = useState(false)

  const profile = usePersonalizationStore((state) => state.profile)
  const status = usePersonalizationStore((state) => state.status)
  const isSaving = usePersonalizationStore((state) => state.isSaving)
  const error = usePersonalizationStore((state) => state.error)
  const loadProfile = usePersonalizationStore((state) => state.loadProfile)
  const saveProfile = usePersonalizationStore((state) => state.saveProfile)
  const resetProfile = usePersonalizationStore((state) => state.resetProfile)
  const setHasDismissedPrompt = usePersonalizationStore((state) => state.setHasDismissedPrompt)

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setShowValidation(false)

      // lazily load profile
      if (status === 'idle') {
        void loadProfile()
      }

      if (profile) {
        setDraft({
          pace: profile.pace,
          mobility: profile.mobility,
          interests: profile.interests?.length ? profile.interests : defaultForm.interests,
          budgetLevel: profile.budgetLevel,
          dietary: profile.dietary ?? [],
          notes: profile.notes ?? '',
        })
      } else {
        setDraft(defaultForm)
      }
    }
  }, [isOpen, status, loadProfile, profile])

  useEffect(() => {
    if (profile && !isOpen) {
      setDraft({
        pace: profile.pace,
        mobility: profile.mobility,
        interests: profile.interests,
        budgetLevel: profile.budgetLevel,
        dietary: profile.dietary ?? [],
        notes: profile.notes ?? '',
      })
    }
  }, [profile, isOpen])

  const hasInterests = draft.interests.length > 0
  const canAdvanceStepOne = hasInterests

  const handleAdvance = () => {
    if (step === 1) {
      if (!canAdvanceStepOne) {
        setShowValidation(true)
        return
      }
      setStep(2)
      return
    }

    if (step === 2) {
      setShowValidation(false)
      void handleSave()
    }
  }

  const handleSave = async () => {
    const payload: PersonalizationProfileInput = {
      pace: draft.pace,
      mobility: draft.mobility,
      interests: draft.interests,
      budgetLevel: draft.budgetLevel ?? null,
      dietary: draft.dietary.length ? draft.dietary : null,
      notes: draft.notes ? draft.notes.trim() : null,
    }

    try {
      await saveProfile(payload)
      setStep(3)
      setShowValidation(false)
    } catch {
      // saveProfile already updates error state
    }
  }

  const handleClose = useCallback(() => {
    if (isSaving) return
    onClose()
  }, [isSaving, onClose])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleClose])

  const handleSkip = () => {
    setHasDismissedPrompt(true)
    handleClose()
  }

  const renderStepIndicator = () => {
    const items: Array<{ step: PersonalizationStep; label: string }> = [
      { step: 1, label: 'Travel style' },
      { step: 2, label: 'Fine tune' },
      { step: 3, label: 'Ready' },
    ]

    return (
      <div className="flex items-center gap-2">
        {items.map(({ step: stepId, label }, index) => {
          const isActive = step === stepId
          const isComplete = step > stepId
          const showConnector = index < items.length - 1
          return (
            <div key={stepId} className="flex items-center gap-2">
              <div
                className={clsx(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition',
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/70'
                    : isComplete
                      ? 'bg-emerald-400/10 text-emerald-200/90'
                      : 'bg-white/5 text-white/50'
                )}
              >
                <span
                  className={clsx(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                    isActive || isComplete ? 'bg-emerald-400 text-slate-900' : 'bg-white/10 text-white/60'
                  )}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : stepId}
                </span>
                <span>{label}</span>
              </div>
              {showConnector ? <div className="h-px w-8 rounded-full bg-white/10" /> : null}
            </div>
          )
        })}
      </div>
    )
  }

  const renderStepOne = () => (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white">Tune the assistant to your rhythm</h3>
        <p className="text-sm text-white/70">
          We will shape itineraries, route defaults, and recommendations to honor your travel pace and priorities. Answer the
          quick prompts below—skip anytime.
        </p>
      </div>

      <div className="space-y-6">
        <section>
          <header className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">What pace matches this trip?</p>
              <p className="text-xs text-white/60">
                Set the cadence you want. We’ll pace proposed days and route density to match.
              </p>
            </div>
          </header>
          <div className="grid gap-3 md:grid-cols-3">
            {paceOptions.map((option) => {
              const Icon = option.icon ?? Sparkles
              const isSelected = draft.pace === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDraft((state) => ({ ...state, pace: option.value }))}
                  className={clsx(
                    'group flex h-full flex-col items-start gap-2 rounded-2xl border px-4 py-4 text-left transition',
                    isSelected
                      ? 'border-emerald-400/80 bg-emerald-400/10 shadow-lg shadow-emerald-500/30'
                      : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]'
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-10 w-10 items-center justify-center rounded-full transition',
                      isSelected ? 'bg-emerald-400 text-slate-900' : 'bg-white/10 text-emerald-200'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{option.title}</p>
                    <p className="text-xs text-white/60">{option.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <header className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">How should we move around?</p>
              <p className="text-xs text-white/60">
                We’ll bias route suggestions and highlighted experiences toward the mobility you prefer.
              </p>
            </div>
          </header>
          <div className="grid gap-3 md:grid-cols-3">
            {mobilityOptions.map((option) => {
              const Icon = option.icon ?? Sparkles
              const isSelected = draft.mobility === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDraft((state) => ({ ...state, mobility: option.value }))}
                  className={clsx(
                    'group flex h-full flex-col items-start gap-2 rounded-2xl border px-4 py-4 text-left transition',
                    isSelected
                      ? 'border-emerald-400/80 bg-emerald-400/10 shadow-lg shadow-emerald-500/30'
                      : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]'
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-10 w-10 items-center justify-center rounded-full transition',
                      isSelected ? 'bg-emerald-400 text-slate-900' : 'bg-white/10 text-emerald-200'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{option.title}</p>
                    <p className="text-xs text-white/60">{option.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <header className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">What should we spotlight?</p>
              <p className="text-xs text-white/60">
                Choose the interests that matter most. We’ll surface more of what you love first.
              </p>
            </div>
            <span className="text-xs text-emerald-300/90">Pick at least one</span>
          </header>
          <div className="grid gap-3 md:grid-cols-2">
            {interestOptions.map((option) => {
              const Icon = option.icon
              const isSelected = draft.interests.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setDraft((state) => ({
                      ...state,
                      interests: toggleValue(state.interests, option.value),
                    }))
                  }
                  className={clsx(
                    'flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition',
                    isSelected
                      ? 'border-emerald-400/80 bg-emerald-400/10 shadow-lg shadow-emerald-500/30'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                  )}
                >
                  {Icon ? (
                    <span
                      className={clsx(
                        'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition',
                        isSelected ? 'bg-emerald-400 text-slate-900' : 'bg-white/10 text-emerald-200'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                  ) : null}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">{option.label}</p>
                    {option.description ? <p className="text-xs text-white/60">{option.description}</p> : null}
                  </div>
                  <span
                    className={clsx(
                      'ml-auto flex h-6 w-6 items-center justify-center rounded-full border transition',
                      isSelected ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-white/20 text-white/30'
                    )}
                  >
                    {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                </button>
              )
            })}
          </div>
          {showValidation && !hasInterests ? (
            <p className="text-xs text-rose-300">Select at least one interest to continue.</p>
          ) : null}
        </section>
      </div>
    </div>
  )

  const renderStepTwo = () => (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white">Add finishing touches</h3>
        <p className="text-sm text-white/70">
          These optional notes help the assistant fine-tune restaurant picks, lodging ideas, and push notifications you
          receive.
        </p>
      </div>

      <div className="space-y-6">
        <section>
          <header className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Comfort level</p>
              <p className="text-xs text-white/60">
                Fine-tune price guidance and when to suggest upgrades or premium reservations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDraft((state) => ({ ...state, budgetLevel: null }))}
              className="text-xs text-white/50 underline-offset-4 transition hover:text-white/80"
            >
              Clear selection
            </button>
          </header>
          <div className="grid gap-3 md:grid-cols-3">
            {budgetOptions.map((option) => {
              const Icon = option.icon ?? Sparkles
              const isSelected = draft.budgetLevel === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setDraft((state) => ({
                      ...state,
                      budgetLevel: option.value as PersonalizationProfileInput['budgetLevel'],
                    }))
                  }
                  className={clsx(
                    'flex h-full flex-col items-start gap-2 rounded-2xl border px-4 py-4 text-left transition',
                    isSelected
                      ? 'border-emerald-400/80 bg-emerald-400/10 shadow-lg shadow-emerald-500/30'
                      : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]'
                  )}
                >
                  {Icon ? (
                    <span
                      className={clsx(
                        'flex h-10 w-10 items-center justify-center rounded-full transition',
                        isSelected ? 'bg-emerald-400 text-slate-900' : 'bg-white/10 text-emerald-200'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                  ) : null}
                  <div>
                    <p className="text-sm font-semibold text-white">{option.label}</p>
                    {option.description ? <p className="text-xs text-white/60">{option.description}</p> : null}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <header className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Dietary or accessibility notes</p>
              <p className="text-xs text-white/60">We respect these when highlighting restaurants or suggesting tours.</p>
            </div>
            <button
              type="button"
              onClick={() => setDraft((state) => ({ ...state, dietary: [] }))}
              className="text-xs text-white/50 underline-offset-4 transition hover:text-white/80"
            >
              Clear all
            </button>
          </header>
          <div className="flex flex-wrap gap-2">
            {dietaryOptions.map((option) => {
              const Icon = option.icon
              const isSelected = draft.dietary.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setDraft((state) => ({
                      ...state,
                      dietary: toggleValue(state.dietary, option.value),
                    }))
                  }
                  className={clsx(
                    'flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition',
                    isSelected
                      ? 'border-emerald-400/80 bg-emerald-400/15 text-emerald-100'
                      : 'border-white/12 bg-white/5 text-white/70 hover:border-white/25 hover:text-white'
                  )}
                >
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <header className="mb-3">
            <p className="text-sm font-medium text-white">Anything else we should factor in?</p>
            <p className="text-xs text-white/60">
              Share must-do experiences, scheduling constraints, or preferences specific to this trip.
            </p>
          </header>
          <textarea
            value={draft.notes}
            onChange={(event) => setDraft((state) => ({ ...state, notes: event.target.value }))}
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/90 shadow-inner transition placeholder:text-white/40 focus:border-emerald-300/70 focus:outline-none"
            placeholder="Example: Traveling with older parents that prefer seated dining, plus a bucket-list focus on live jazz."
          />
        </section>

        {profile ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
            <div>
              <p className="font-medium text-emerald-100">Profile in sync</p>
              <p className="text-emerald-200/80">Update anytime—your assistant adapts instantly.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void resetProfile()
                setDraft(defaultForm)
              }}
              className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/20"
            >
              Reset profile
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-400/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )

  const renderStepThree = () => (
    <div className="flex h-full flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-200">
        <Sparkles className="h-8 w-8" />
      </div>
      <div className="space-y-3 px-6">
        <h3 className="text-2xl font-semibold text-white">Personalization locked in</h3>
        <p className="text-sm text-white/70">
          We’ll tilt recommendations, route profiles, and itinerary pacing toward your preferences. You can revisit these
          settings anytime from the assistant menu.
        </p>
      </div>
      <button
        type="button"
        onClick={handleClose}
        className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/20 px-5 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
      >
        <Check className="h-4 w-4" />
        Close
      </button>
    </div>
  )

  if (!isOpen) {
    return null
  }

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target) {
      handleClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 py-12 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
    >
      <div className="relative flex w-full max-w-4xl lg:max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[rgba(9,15,27,0.96)] shadow-2xl shadow-black/60">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">Trip concierge</p>
              <h2 className="text-lg font-semibold text-white">Personalize your journey</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {renderStepIndicator()}
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-white/10 bg-white/10 p-2 text-white/70 transition hover:border-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              aria-label="Close personalization modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="assistant-scroll max-h-[70vh] overflow-y-auto px-6 py-6">
          {step === 1 ? renderStepOne() : null}
          {step === 2 ? renderStepTwo() : null}
          {step === 3 ? renderStepThree() : null}
        </div>

        {step !== 3 ? (
          <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-6 py-5">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              <span>Optional—skip anytime.</span>
            </div>
            <div className="flex items-center gap-2">
              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:border-white/25 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
                >
                  Skip for now
                </button>
              )}

              <button
                type="button"
                onClick={handleAdvance}
                disabled={isSaving}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-sky-500 px-5 py-2 text-sm font-medium text-slate-900 shadow-lg transition focus:outline-none focus:ring-2 focus:ring-emerald-300/60 disabled:cursor-not-allowed disabled:opacity-50',
                  step === 2 && 'min-w-[170px] justify-center'
                )}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === 2 ? (
                  <>
                    Save personalization <Check className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  )
}
