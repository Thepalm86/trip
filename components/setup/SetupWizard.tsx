'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Sparkles, CalendarRange, Users, Compass, ArrowLeft, ArrowRight, Check, Loader2, Edit3, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format as formatDate,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { LocationSearchInput, LocationSelection } from '@/components/setup/LocationSearchInput'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { usePersonalizationStore } from '@/lib/store/personalization-store'
import { addDays, cn } from '@/lib/utils'

type StepId = 'intro' | 'destination' | 'timing' | 'party' | 'naming'

interface WizardFormState {
  tripName: string
  destination: LocationSelection | null
  startDate: Date | null
  endDate: Date | null
  travelers: number
  mobility: 'walking' | 'mixed' | 'rideshare'
  pace: 'leisurely' | 'balanced' | 'packed'
  partyType: 'solo' | 'couple' | 'family' | 'friends' | 'team'
  adults: number
  kids: number
}

interface StepDefinition {
  id: StepId
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const steps: StepDefinition[] = [
  {
    id: 'intro',
    title: 'Let’s design an unforgettable journey',
    description: 'Answer a few quick questions so Traveal can craft the perfect planning workspace for you.',
    icon: Sparkles,
  },
  {
    id: 'destination',
    title: 'Where are you headed?',
    description: 'Search for your primary destination so we can tailor maps, content, and local context.',
    icon: Compass,
  },
  {
    id: 'timing',
    title: 'When are you traveling?',
    description: 'Share your travel window — you can refine exact dates in the planner anytime.',
    icon: CalendarRange,
  },
  {
    id: 'party',
    title: 'Who’s coming along?',
    description: 'Choose who you’re planning for so we can tailor timelines, pacing, and recommendations.',
    icon: Users,
  },
  {
    id: 'naming',
    title: 'Give your trip a name',
    description: 'Add a headline so you can spot this itinerary instantly when you come back.',
    icon: Edit3,
  },
]

const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

interface DatePickerFieldProps {
  value: Date | null
  onSelect: (date: Date) => void
  minDate?: Date
  today: Date
  rangeStart?: Date | null
  rangeEnd?: Date | null
  isInvalid?: boolean
  ariaLabel?: string
}

function DatePickerField({
  value,
  onSelect,
  minDate,
  today,
  rangeStart,
  rangeEnd,
  isInvalid,
  ariaLabel,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false)

  const normalizedValue = useMemo(() => (value ? startOfDay(value) : null), [value])
  const minSelectableDate = useMemo(
    () => (minDate ? startOfDay(minDate) : undefined),
    [minDate]
  )
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(normalizedValue ?? today))

  useEffect(() => {
    setVisibleMonth(startOfMonth(normalizedValue ?? today))
  }, [normalizedValue, today])

  const calendarDays = useMemo(() => {
    const start = startOfWeek(visibleMonth, { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [visibleMonth])

  const rangeStartDate = rangeStart ? startOfDay(rangeStart) : undefined
  const rangeEndDate = rangeEnd ? startOfDay(rangeEnd) : undefined
  const hasRange =
    rangeStartDate && rangeEndDate && !isBefore(rangeEndDate, rangeStartDate)

  const prevMonth = () => setVisibleMonth((current) => addMonths(current, -1))
  const nextMonth = () => setVisibleMonth((current) => addMonths(current, 1))

  const isPrevDisabled = useMemo(() => {
    if (!minSelectableDate) {
      return false
    }
    const previousMonthEnd = endOfMonth(addMonths(visibleMonth, -1))
    return isBefore(previousMonthEnd, minSelectableDate)
  }, [minSelectableDate, visibleMonth])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            'w-full px-4 py-3 rounded-lg border text-left transition-all duration-200 flex items-center justify-between gap-3 bg-white/5 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-0',
            isInvalid
              ? 'border-red-500/70 bg-red-500/10 text-red-100'
              : 'border-white/10 hover:border-blue-400/50 hover:bg-white/10'
          )}
        >
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.18em] text-white/40">
              Selected
            </span>
            <span className="text-base font-semibold text-white">
              {normalizedValue ? formatDate(normalizedValue, 'MMM d, yyyy') : 'Select a date'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <span>{normalizedValue ? formatDate(normalizedValue, 'EEE') : ''}</span>
            <Calendar className="h-4 w-4" />
          </div>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="center"
          side="bottom"
          sideOffset={14}
          collisionPadding={16}
          avoidCollisions={false}
          className="z-[60] w-[320px] rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-[0_28px_64px_rgba(4,9,20,0.55)] backdrop-blur-xl focus:outline-none"
        >
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              disabled={isPrevDisabled}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-all duration-200 hover:border-blue-400/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                isPrevDisabled && 'pointer-events-none opacity-30'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <div className="text-sm font-semibold text-white">
                {formatDate(visibleMonth, 'MMMM yyyy')}
              </div>
              <div className="text-xs text-white/50">
                {formatDate(visibleMonth, 'yyyy')}
              </div>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-all duration-200 hover:border-blue-400/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-[0.14em] text-white/40">
            {weekdayLabels.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const isDisabled =
                (minSelectableDate && isBefore(day, minSelectableDate)) || false
              const isOutside = !isSameMonth(day, visibleMonth)
              const isSelected = normalizedValue ? isSameDay(day, normalizedValue) : false
              const isToday = isSameDay(day, today)
              const isRangeBoundary =
                (!!rangeStartDate && isSameDay(day, rangeStartDate)) ||
                (!!rangeEndDate && isSameDay(day, rangeEndDate))
              const isInRange =
                hasRange &&
                !isRangeBoundary &&
                isAfter(day, rangeStartDate!) &&
                isBefore(day, rangeEndDate!)

              return (
                <button
                  type="button"
                  key={day.toISOString()}
                  onClick={() => {
                    if (isDisabled) {
                      return
                    }
                    onSelect(startOfDay(day))
                    setOpen(false)
                  }}
                  disabled={isDisabled}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-sm font-medium text-white/80 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-0',
                    !isDisabled &&
                      !isSelected &&
                      !isRangeBoundary &&
                      'hover:bg-white/10 hover:text-white',
                    isOutside && 'text-white/35',
                    isDisabled && 'cursor-not-allowed text-white/20 opacity-40',
                    isToday && !isSelected && !isRangeBoundary && 'border border-blue-400/40 text-white',
                    isInRange && 'bg-blue-500/10 text-white border border-blue-400/30',
                    (isSelected || isRangeBoundary) &&
                      'bg-blue-500 text-white shadow-[0_14px_36px_rgba(79,140,255,0.35)]'
                  )}
                >
                  {formatDate(day, 'd')}
                </button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function SetupWizard() {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [isTripNameDirty, setIsTripNameDirty] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const createTrip = useSupabaseTripStore((state) => state.createTrip)
  const savePersonalizationProfile = usePersonalizationStore((state) => state.saveProfile)

  const [formState, setFormState] = useState<WizardFormState>(() => {
    const today = startOfDay(new Date())
    return {
      tripName: '',
      destination: null,
      startDate: null,
      endDate: null,
      travelers: 2,
      mobility: 'walking',
      pace: 'balanced',
      partyType: 'couple',
      adults: 2,
      kids: 0,
    }
  })

  const currentStep = steps[stepIndex]

  const canProceed = useMemo(() => {
    switch (currentStep.id) {
      case 'intro':
        return true
      case 'destination':
        return Boolean(formState.destination)
      case 'timing':
        return isValidDateRange(formState.startDate, formState.endDate)
      case 'party':
        return formState.travelers > 0
      case 'naming':
        return Boolean(formState.tripName.trim())
      default:
        return false
    }
  }, [currentStep.id, formState.destination, formState.endDate, formState.startDate, formState.travelers, formState.tripName])

  const goToNext = useCallback(() => {
    setStepIndex((index) => Math.min(index + 1, steps.length - 1))
  }, [])

  const goToPrevious = useCallback(() => {
    setStepIndex((index) => Math.max(index - 1, 0))
  }, [])

  const handleDestinationSelect = useCallback(
    (selection: LocationSelection) => {
      setFormState((state) => {
        const nextState = { ...state, destination: selection }
        if (!isTripNameDirty) {
          nextState.tripName = generateTripName(selection)
        }
        return nextState
      })
    },
    [isTripNameDirty]
  )

  const handleSubmit = useCallback(async () => {
    if (!formState.destination || !formState.startDate || !formState.endDate) {
      return
    }

    const start = formState.startDate
    const end = formState.endDate

    if (!isValidDateRange(start, end)) {
      setSubmitError('Please choose a valid travel window.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const name = formState.tripName.trim() || generateTripName(formState.destination)
      const days = buildInitialDays(start, end)
      await createTrip({
        name,
        startDate: start,
        endDate: end,
        country: formState.destination.countryCode,
        days,
      })

      const profileInput = {
        pace: formState.pace,
        mobility: formState.mobility,
        interests: [] as string[],
        budgetLevel: null,
        dietary: [],
        notes: `Party: ${formState.partyType}, Travelers: ${formState.travelers}${formState.kids > 0 ? ` (kids: ${formState.kids})` : ''}`,
      }

      try {
        await savePersonalizationProfile(profileInput)
      } catch (error) {
        console.warn('SetupWizard: failed to save personalization profile during onboarding', error)
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('trip3:show-trip-switcher-hint', 'true')
      }
      router.replace('/')
    } catch (error) {
      console.error('SetupWizard: failed to create trip', error)
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong while creating your trip. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [createTrip, formState.destination, formState.endDate, formState.mobility, formState.pace, formState.startDate, formState.travelers, formState.tripName, router, savePersonalizationProfile])

  const handleSubmitStep = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (isLastStep(stepIndex)) {
        void handleSubmit()
      } else if (canProceed) {
        goToNext()
      }
    },
    [canProceed, goToNext, handleSubmit, stepIndex]
  )

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-12">
      <div className="absolute inset-0 opacity-60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.28),transparent_52%),radial-gradient(circle_at_80%_10%,rgba(6,182,212,0.18),transparent_55%),radial-gradient(circle_at_50%_65%,rgba(168,85,247,0.18),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.8)_0%,rgba(2,6,23,0.92)_35%,rgba(15,23,42,0.88)_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl rounded-[40px] border border-white/10 bg-white/[0.04] p-10 shadow-[0_42px_80px_rgba(3,8,20,0.65)] backdrop-blur-2xl">
        <header className="flex items-start justify-between gap-6 pb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.36em] text-white/40">Step {stepIndex + 1} of {steps.length}</p>
            <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">{currentStep.title}</h1>
            <p className="mt-2 max-w-xl text-base text-white/70">{currentStep.description}</p>
          </div>
          <div className="hidden shrink-0 rounded-3xl bg-white/8 p-4 text-white/65 md:block">
            <currentStep.icon className="h-8 w-8" aria-hidden="true" />
          </div>
        </header>

        <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        <form onSubmit={handleSubmitStep} className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
            >
              {currentStep.id === 'intro' ? (
                <IntroStep />
              ) : null}

              {currentStep.id === 'destination' ? (
                <DestinationStep
                  formState={formState}
                  onDestinationSelect={handleDestinationSelect}
                />
              ) : null}

              {currentStep.id === 'timing' ? (
                <TimingStep
                  formState={formState}
                  onUpdate={(updates) => {
                    setFormState((state) => ({ ...state, ...updates }))
                  }}
                />
              ) : null}

              {currentStep.id === 'party' ? (
                <PartyStep
                  formState={formState}
                  onUpdate={(updates) => {
                    setFormState((state) => ({ ...state, ...updates }))
                  }}
                />
              ) : null}

              {currentStep.id === 'naming' ? (
                <TripNameStep
                  formState={formState}
                  onTripNameChange={(value) => {
                    setIsTripNameDirty(true)
                    setFormState((state) => ({ ...state, tripName: value }))
                  }}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>

          {submitError ? (
            <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {submitError}
            </div>
          ) : null}

          <footer className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-white/50">
              {currentStep.id === 'intro' ? (
                <span>We’ll set up your workspace in under a minute.</span>
              ) : currentStep.id === 'destination' ? (
                <span>Choose a locale to personalize recommendations.</span>
              ) : currentStep.id === 'timing' ? (
                <span>We’ll generate the right number of timeline days automatically.</span>
              ) : currentStep.id === 'naming' ? (
                <span>You can rename it anytime from the planner header.</span>
              ) : (
                <span>You can refine these preferences anytime.</span>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={goToPrevious}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:border-white/40 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!canProceed || isSubmitting}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_38px_rgba(56,189,248,0.35)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                  (!canProceed || isSubmitting) && 'cursor-not-allowed opacity-60',
                  isSubmitting && 'animate-pulse'
                )}
              >
                {isLastStep(stepIndex) ? (
                  <>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                    {isSubmitting ? 'Creating your trip...' : 'Create my trip'}
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  )
}

function IntroStep() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/8 via-white/4 to-white/2 p-6 backdrop-blur">
        <h2 className="text-xl font-semibold text-white">What you can expect</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { title: 'Personalized timeline', description: 'We’ll craft the perfect day-by-day plan based on your interests.' },
            { title: 'Smarter recommendations', description: 'Your assistant will suggest activities, dining, and stays tailored for you.' },
            { title: 'Collaborative workspace', description: 'Invite friends, keep notes, and adjust your plans with powerful tools.' },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl bg-white/[0.04] p-4">
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-white/70">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface DestinationStepProps {
  formState: WizardFormState
  onDestinationSelect: (selection: LocationSelection) => void
}

function DestinationStep({ formState, onDestinationSelect }: DestinationStepProps) {
  return (
    <div className="space-y-6">
      <LocationSearchInput value={formState.destination} onSelect={onDestinationSelect} />

      {formState.destination ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <p className="text-sm text-white/60">
            We’ll tailor maps, content, and recommendations to {formState.destination.title}. You can adjust or add more hubs later.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-white/60">
          Pick a hub city or country — we’ll preload key context and inspirations for you.
        </div>
      )}
    </div>
  )
}

interface TimingStepProps {
  formState: WizardFormState
  onUpdate: (updates: Partial<WizardFormState>) => void
}

function TimingStep({ formState, onUpdate }: TimingStepProps) {
  const today = useMemo(() => startOfDay(new Date()), [])

  const handleStartSelect = (selectedDate: Date) => {
    const sanitized = isBefore(selectedDate, today) ? today : selectedDate
    const alignedEnd =
      formState.endDate && isBefore(formState.endDate, sanitized)
        ? sanitized
        : formState.endDate
    onUpdate({ startDate: sanitized, endDate: alignedEnd ?? null })
  }

  const handleEndSelect = (selectedDate: Date) => {
    const base = formState.startDate ?? today
    const sanitized = isBefore(selectedDate, base) ? base : selectedDate
    if (!formState.startDate) {
      onUpdate({ startDate: sanitized, endDate: sanitized })
      return
    }
    onUpdate({ endDate: sanitized })
  }

  const isEndDateValid = isValidDateRange(formState.startDate, formState.endDate)
  const durationDays = calculateDurationDays(formState.startDate, formState.endDate)

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-white/80">Departure</label>
          <DatePickerField
            value={formState.startDate}
            onSelect={handleStartSelect}
            minDate={today}
            today={today}
            rangeStart={formState.startDate}
            rangeEnd={formState.endDate}
            ariaLabel="Select trip start date"
          />
          <p className="text-sm text-white/60">
            You can always adjust this date later from the timeline.
          </p>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-white/80">Return</label>
          <DatePickerField
            value={formState.endDate}
            onSelect={handleEndSelect}
            minDate={formState.startDate}
            today={today}
            rangeStart={formState.startDate}
            rangeEnd={formState.endDate}
            isInvalid={!isEndDateValid}
            ariaLabel="Select trip end date"
          />
          <p className="text-sm text-white/60">
            We’ll auto-generate one day per date in this range.
          </p>
          {!isEndDateValid ? (
            <div className="text-sm text-red-400">
              Return date should be on or after your departure date.
            </div>
          ) : null}
        </div>
      </div>

      <div className="p-4 rounded-lg bg-white/5 border border-white/10">
        <h4 className="text-sm font-medium text-white/80 mb-3">Trip Summary</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">Duration</span>
            <span className="text-white font-medium">
              {durationDays > 0 ? `${durationDays} ${durationDays === 1 ? 'day' : 'days'}` : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">Start</span>
            <span className="text-white font-medium">{formatDisplayDate(formState.startDate)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">End</span>
            <span className="text-white font-medium">{formatDisplayDate(formState.endDate)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface PartyStepProps {
  formState: WizardFormState
  onUpdate: (updates: Partial<WizardFormState>) => void
}

function PartyStep({ formState, onUpdate }: PartyStepProps) {
  const familySectionRef = useRef<HTMLDivElement | null>(null)
  const teamSectionRef = useRef<HTMLDivElement | null>(null)

  const partyOptions: Array<{
    value: WizardFormState['partyType']
    label: string
    description: string
    defaultAdults: number
    defaultKids: number
  }> = [
    {
      value: 'solo',
      label: 'Solo explorer',
      description: 'Just you and the open road. Perfect for spontaneous adventures.',
      defaultAdults: 1,
      defaultKids: 0,
    },
    {
      value: 'couple',
      label: 'Couple getaway',
      description: 'Plan a memorable escape for two.',
      defaultAdults: 2,
      defaultKids: 0,
    },
    {
      value: 'family',
      label: 'Family crew',
      description: 'Travelling with kids or multiple generations.',
      defaultAdults: Math.max(1, formState.adults || 2),
      defaultKids: formState.kids > 0 ? formState.kids : 1,
    },
    {
      value: 'team',
      label: 'Team / group',
      description: 'Retreats, reunions, or larger travelling parties.',
      defaultAdults: Math.max(4, formState.adults || 6),
      defaultKids: 0,
    },
  ]

  const handleSelectOption = (option: (typeof partyOptions)[number]) => {
    const adults = option.value === 'family' ? Math.max(1, option.defaultAdults) : option.defaultAdults
    const kids = option.value === 'family' ? Math.max(0, option.defaultKids) : 0
    let nextPace: WizardFormState['pace'] = formState.pace
    let nextMobility: WizardFormState['mobility'] = formState.mobility

    switch (option.value) {
      case 'solo':
        nextPace = 'balanced'
        nextMobility = 'walking'
        break
      case 'couple':
        nextPace = 'leisurely'
        nextMobility = 'mixed'
        break
      case 'family':
        nextPace = 'leisurely'
        nextMobility = 'mixed'
        break
      case 'friends':
        nextPace = 'packed'
        nextMobility = 'mixed'
        break
      case 'team':
        nextPace = 'balanced'
        nextMobility = 'rideshare'
        break
      default:
        break
    }

    onUpdate({
      partyType: option.value,
      adults,
      kids,
      travelers: Math.max(1, adults + kids),
      pace: nextPace,
      mobility: nextMobility,
    })

    setTimeout(() => {
      if (option.value === 'family') {
        familySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (option.value === 'team') {
        teamSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 120)
  }

  const handleAdjust = (updates: Partial<Pick<WizardFormState, 'adults' | 'kids'>>) => {
    const adults = updates.adults ?? formState.adults
    const kids = updates.kids ?? formState.kids
    onUpdate({
      adults,
      kids,
      travelers: Math.max(1, adults + kids),
    })
  }

  const isFamily = formState.partyType === 'family'
  const isTeam = formState.partyType === 'team'

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-white/40 mb-3">Select your travel group</p>
        <div className="grid gap-4 md:grid-cols-2">
          {partyOptions.map((option) => {
            const isActive = formState.partyType === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelectOption(option)}
                className={cn(
                  'flex h-full flex-col items-start rounded-3xl border border-white/10 bg-white/[0.05] p-5 text-left transition-all duration-200 hover:border-white/40 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  isActive && 'border-blue-400/60 bg-blue-500/15 shadow-[0_20px_48px_rgba(56,189,248,0.28)]'
                )}
              >
                <span className="text-base font-semibold text-white">{option.label}</span>
                <p className="mt-2 text-sm text-white/60">{option.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {isFamily ? (
        <div ref={familySectionRef} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-white">Family breakdown</h3>
            <p className="text-sm text-white/60">Let us know how many adults and kids are travelling so daily pacing matches your crew.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CounterField
              label="Adults"
              value={formState.adults}
              min={1}
              onChange={(value) => handleAdjust({ adults: value })}
            />
            <CounterField
              label="Kids"
              value={formState.kids}
              min={0}
              onChange={(value) => handleAdjust({ kids: value })}
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
            Total travellers: <span className="font-semibold text-white">{formState.adults + formState.kids}</span>
          </div>
        </div>
      ) : null}

      {isTeam ? (
        <div ref={teamSectionRef} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Group size</h3>
              <p className="text-sm text-white/60">Adjust the number of travellers in your party.</p>
            </div>
            <CounterField
              compact
              label="Travellers"
              value={formState.travelers}
              min={4}
              onChange={(value) => handleAdjust({ adults: value, kids: 0 })}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

interface CounterFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  compact?: boolean
}

function CounterField({ label, value, onChange, min = 0, max = 16, compact = false }: CounterFieldProps) {
  const decrement = () => {
    const next = Math.max(min, value - 1)
    if (next !== value) {
      onChange(next)
    }
  }

  const increment = () => {
    const next = Math.min(max, value + 1)
    if (next !== value) {
      onChange(next)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3',
        compact ? 'w-auto gap-4' : 'gap-6'
      )}
    >
      {compact ? (
        <span className="text-lg font-semibold text-white">
          <span className="sr-only">{label}: </span>
          {value}
        </span>
      ) : (
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-[0.18em] text-white/40">{label}</span>
          <span className="text-lg font-semibold text-white">{value}</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={decrement}
          className="h-9 w-9 rounded-full border border-white/20 text-white transition-all duration-200 hover:border-white/50 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          –
        </button>
        <button
          type="button"
          onClick={increment}
          className="h-9 w-9 rounded-full border border-white/20 text-white transition-all duration-200 hover:border-white/50 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

interface TripNameStepProps {
  formState: WizardFormState
  onTripNameChange: (value: string) => void
}

function TripNameStep({ formState, onTripNameChange }: TripNameStepProps) {
  const suggestedName = formState.tripName || (formState.destination ? generateTripName(formState.destination) : '')
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
        <label className="text-xs uppercase tracking-[0.24em] text-white/40">Trip name</label>
        <input
          value={formState.tripName}
          onChange={(event) => onTripNameChange(event.target.value)}
          placeholder={suggestedName || 'Name your adventure'}
          className="mt-3 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-blue-400/60 focus:outline-none"
        />
        <p className="mt-3 text-sm text-white/60">
          This label appears in your planner header and trip switcher. Keep it short and memorable.
        </p>
      </div>
    </div>
  )
}

function buildInitialDays(start: Date, end: Date) {
  const days = []
  let cursor = new Date(start)
  let index = 0

  while (cursor <= end) {
    const dayId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `temp-day-${crypto.randomUUID()}`
        : `temp-day-${Math.random().toString(36).slice(2)}`

    days.push({
      id: dayId,
      dayOrder: index,
      date: new Date(cursor),
      destinations: [],
      baseLocations: [],
      openSlots: [],
      notes: undefined,
    })
    index += 1
    cursor = addDays(cursor, 1)
  }

  return days
}

function generateTripName(selection: LocationSelection) {
  return `Trip to ${selection.title}`
}

function isLastStep(index: number) {
  return index === steps.length - 1
}

function calculateDurationDays(start: Date | null, end: Date | null) {
  if (!start || !end) {
    return 0
  }
  const diff = end.getTime() - start.getTime()
  return diff >= 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) + 1 : 0
}

function formatDisplayDate(date: Date | null) {
  if (!date) {
    return '—'
  }
  return formatDate(date, 'EEE, MMM d, yyyy')
}

function isValidDateRange(start: Date | null, end: Date | null) {
  if (!start || !end) {
    return false
  }
  return end >= start
}
