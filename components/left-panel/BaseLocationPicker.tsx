'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  X,
  MapPin,
  Search,
  Plus,
  ArrowLeft,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import type { DayLocation, LocationLink } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { resolveCityFromPlace } from '@/lib/location/city'

interface BaseLocationPickerProps {
  dayId: string
  onClose: () => void
}

interface LocationResult {
  id: string
  name: string
  fullName: string
  coordinates: [number, number]
  context?: string
  category?: string
  placeId?: string
}

interface StepDefinition {
  id: number
  label: string
}

const STEP_DEFINITIONS: StepDefinition[] = [
  { id: 1, label: 'Location' },
  { id: 2, label: 'Category' },
  { id: 3, label: 'Details' },
]

const ACCOMMODATION_CATEGORY_OPTIONS = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'villa', label: 'Villa' },
  { value: 'resort', label: 'Resort' },
  { value: 'guesthouse', label: 'Guesthouse' },
  { value: 'other', label: 'Other' },
]

const LINK_TYPE_OPTIONS: { value: LocationLink['type']; label: string }[] = [
  { value: 'website', label: 'Website' },
  { value: 'google_maps', label: 'Google Maps' },
  { value: 'tripadvisor', label: 'TripAdvisor' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'booking', label: 'Booking.com' },
  { value: 'hotels', label: 'Hotels.com' },
  { value: 'other', label: 'Other' },
]

type LinkDraft = {
  id: string
  type: LocationLink['type']
  label: string
  url: string
}

const createEmptyLinkDraft = (): LinkDraft => {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  return {
    id: `link-${randomId}`,
    type: 'website',
    label: '',
    url: '',
  }
}

function StepIndicator({ steps, currentStep }: { steps: StepDefinition[]; currentStep: number }) {
  return (
    <div className="flex w-full items-center gap-4">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep
        const isComplete = step.id < currentStep

        return (
          <div key={step.id} className="flex flex-1 items-center">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-emerald-400/80 bg-emerald-500/25 text-white'
                    : isComplete
                    ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/15 bg-white/5 text-white/60'
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`text-sm font-medium ${
                  isActive ? 'text-white' : isComplete ? 'text-white/70' : 'text-white/50'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`ml-4 hidden h-px flex-1 md:block ${
                  isComplete ? 'bg-emerald-400/40' : 'bg-white/15'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

const inferAccommodationCategory = (category?: string): string => {
  if (!category) {
    return 'hotel'
  }

  const normalized = category.toLowerCase()
  if (normalized.includes('apartment')) return 'apartment'
  if (normalized.includes('airbnb')) return 'airbnb'
  if (normalized.includes('hostel')) return 'hostel'
  if (normalized.includes('villa')) return 'villa'
  if (normalized.includes('resort')) return 'resort'
  if (normalized.includes('guest')) return 'guesthouse'
  if (normalized.includes('bnb')) return 'airbnb'
  return 'hotel'
}

export function BaseLocationPicker({ dayId, onClose }: BaseLocationPickerProps) {
  const { currentTrip, addBaseLocation, removeBaseLocation, updateBaseLocation } = useSupabaseTripStore()

  const [step, setStep] = useState(1)
  const totalSteps = STEP_DEFINITIONS.length

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null)
  const [accommodationCategory, setAccommodationCategory] = useState<string>('hotel')
  const [notes, setNotes] = useState('')
  const [linkDrafts, setLinkDrafts] = useState<LinkDraft[]>([])
  const [isSaving, setIsSaving] = useState(false)

  if (!currentTrip) {
    return null
  }

  const day = currentTrip.days.find((candidate) => candidate.id === dayId)
  const dayIndex = currentTrip.days.findIndex((candidate) => candidate.id === dayId)
  const baseLocations = day?.baseLocations ?? []
  const formattedDayDate = day?.date
    ? new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null

  useEffect(() => {
    if (step !== 1) {
      return
    }

    if (query.trim().length < 2) {
      setResults([])
      return
    }

    const controller = new AbortController()

    const fetchResults = async () => {
      try {
        setIsLoading(true)
        const apiEndpoint = new URL('/api/places/search', window.location.origin)
        apiEndpoint.searchParams.set('query', query)

        const response = await fetch(apiEndpoint.toString(), { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()
        const googleResults = data.results ?? []

        const mapped: LocationResult[] = googleResults.slice(0, 6).map((place: any) => ({
          id: `google-${place.place_id}`,
          name: place.name,
          fullName: place.formatted_address || place.name,
          coordinates: [place.geometry.location.lng, place.geometry.location.lat] as [number, number],
          context: place.formatted_address
            ? place.formatted_address.split(',').slice(-2).join(', ').trim()
            : place.name,
          category: place.types?.[0] || 'location',
          placeId: place.place_id,
        }))

        setResults(mapped)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Places search error:', error)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchResults()

    return () => controller.abort()
  }, [query, step])

  const canProceed = useMemo(() => {
    if (step === 1) {
      return Boolean(selectedLocation)
    }
    if (step === 2) {
      return Boolean(accommodationCategory)
    }
    return true
  }, [accommodationCategory, selectedLocation, step])

  const primaryLabel = step === totalSteps ? (isSaving ? 'Saving…' : 'Save accommodation') : 'Next'
  const isPrimaryDisabled = !canProceed || (step === totalSteps && isSaving)

  const handleSelectLocation = (location: LocationResult) => {
    setSelectedLocation(location)
    setAccommodationCategory(inferAccommodationCategory(location.category))
    setNotes('')
    setLinkDrafts([])
    setStep(2)
  }

  const handleAddLinkDraft = () => {
    setLinkDrafts((prev) => [...prev, createEmptyLinkDraft()])
  }

  const handleUpdateLinkDraft = (id: string, field: keyof Omit<LinkDraft, 'id'>, value: string) => {
    setLinkDrafts((prev) =>
      prev.map((link) => (link.id === id ? { ...link, [field]: value } : link)),
    )
  }

  const handleRemoveLinkDraft = (id: string) => {
    setLinkDrafts((prev) => prev.filter((link) => link.id !== id))
  }

  const handlePrimaryAction = async () => {
    if (step === totalSteps) {
      await handleConfirmAddLocation()
    } else {
      setStep((prev) => Math.min(prev + 1, totalSteps))
    }
  }

  const handleConfirmAddLocation = async () => {
    if (!selectedLocation || isSaving) {
      return
    }

    setIsSaving(true)

    try {
      const city = await resolveCityFromPlace(
        selectedLocation.placeId,
        selectedLocation.fullName ?? selectedLocation.context ?? selectedLocation.name,
      )

      const preparedLinks: LocationLink[] = linkDrafts
        .map((link) => ({
          id: link.id,
          type: link.type,
          label: link.label.trim(),
          url: link.url.trim(),
        }))
        .filter((link) => link.label && link.url)

      const trimmedNotes = notes.trim()

      const dayLocation: DayLocation = {
        name: selectedLocation.name,
        coordinates: selectedLocation.coordinates,
        context: selectedLocation.fullName ?? selectedLocation.context,
        city: city === 'Unknown' ? undefined : city,
        category: accommodationCategory,
        notes: trimmedNotes ? trimmedNotes : undefined,
        links: preparedLinks.length ? preparedLinks : undefined,
      }

      if (baseLocations.length > 0) {
        await updateBaseLocation(dayId, 0, dayLocation)
      } else {
        await addBaseLocation(dayId, dayLocation)
      }
      onClose()
    } catch (error) {
      console.error('BaseLocationPicker: failed to save base location', error)
    } finally {
      setIsSaving(false)
    }
  }

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <div className="space-y-6">
          {baseLocations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-emerald-300">Current accommodation</h4>
                <span className="text-xs text-white/40">Day {dayIndex + 1}</span>
              </div>
              <div className="space-y-2">
                {baseLocations.slice(0, 1).map((location, index) => (
                  <div
                    key={`${location.name}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{location.name}</p>
                      {location.context && (
                        <p className="text-xs text-white/60">{location.context}</p>
                      )}
                      {location.city && (
                        <p className="text-xs text-emerald-200">{location.city}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeBaseLocation(dayId, index)}
                      className="rounded-lg border border-emerald-400/30 px-3 py-1.5 text-xs text-emerald-200 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for hotels, apartments, or neighborhoods"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-10 py-3 text-white placeholder:text-white/40 focus:border-emerald-400/50 focus:outline-none focus:ring-0"
                autoFocus
              />
            </div>

            {query.length >= 2 && (
              <div className="max-h-72 space-y-2 overflow-y-auto scrollbar-hide">
                {isLoading ? (
                  <div className="flex items-center justify-center py-6 text-sm text-white/60">Searching…</div>
                ) : results.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
                    No results found. Try a different search term.
                  </div>
                ) : (
                  results.map((result) => {
                    const isSelected = selectedLocation?.id === result.id
                    return (
                      <button
                        key={result.id}
                        onClick={() => handleSelectLocation(result)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          isSelected
                            ? 'border-emerald-400/50 bg-emerald-500/20'
                            : 'border-white/10 bg-white/5 hover:border-emerald-400/40 hover:bg-emerald-500/15'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-sky-500/20">
                            <MapPin className="h-4 w-4 text-emerald-200" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-white">{result.name}</p>
                            {(result.fullName || result.context) && (
                              <p className="truncate text-xs text-white/50">
                                {result.fullName ?? result.context}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    if (step === 2 && selectedLocation) {
      return (
        <div className="space-y-5">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-widest text-white/60">Choose stay type</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {ACCOMMODATION_CATEGORY_OPTIONS.map((option) => {
                const isSelected = accommodationCategory === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAccommodationCategory(option.value)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-500/25 text-white shadow-lg shadow-emerald-500/10'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-white'
                    }`}
                  >
                    <span>{option.label}</span>
                    {isSelected && <span className="text-xs font-medium text-emerald-200">Selected</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )
    }

    if (step === 3 && selectedLocation) {
      return (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/80">Notes</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add arrival details, check-in reminders, or personal tips."
              className="mt-2 h-24 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-emerald-400/50 focus:outline-none"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white/80">Links</label>
              <button
                type="button"
                onClick={handleAddLinkDraft}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:border-emerald-400/60 hover:bg-emerald-500/25"
              >
                <Plus className="h-3.5 w-3.5" /> Add link
              </button>
            </div>
            {linkDrafts.length === 0 ? (
              <p className="text-sm text-white/50">
                Store booking confirmations or property pages so they are always one click away.
              </p>
            ) : (
              <div className="space-y-3">
                {linkDrafts.map((link) => (
                  <div key={link.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-white/50">
                          Type
                        </label>
                        <select
                          value={link.type}
                          onChange={(event) => handleUpdateLinkDraft(link.id, 'type', event.target.value)}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus:border-emerald-400/50 focus:outline-none"
                        >
                          {LINK_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value} className="bg-slate-900">
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium uppercase tracking-wide text-white/50">
                            Label
                          </label>
                          <input
                            type="text"
                            value={link.label}
                            onChange={(event) => handleUpdateLinkDraft(link.id, 'label', event.target.value)}
                            placeholder="e.g. Booking reference"
                            className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-emerald-400/50 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium uppercase tracking-wide text-white/50">
                            URL
                          </label>
                          <div className="relative mt-1">
                            <ExternalLink className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                            <input
                              type="url"
                              value={link.url}
                              onChange={(event) => handleUpdateLinkDraft(link.id, 'url', event.target.value)}
                              placeholder="https://"
                              className="w-full rounded-lg border border-white/10 bg-white/10 px-10 py-2 text-sm text-white placeholder:text-white/40 focus:border-emerald-400/50 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveLinkDraft(link.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Set accommodation</h3>
                {formattedDayDate && (
                  <p className="text-sm text-white/60">Day {dayIndex + 1} • {formattedDayDate}</p>
                )}
              </div>
            </div>
            <div className="pt-1">
              <StepIndicator steps={STEP_DEFINITIONS} currentStep={step} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
          <button
            onClick={() => setStep((prev) => Math.max(prev - 1, 1))}
            disabled={step === 1 || isSaving}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
              step === 1 || isSaving
                ? 'cursor-not-allowed border-white/5 text-white/30'
                : 'border-white/10 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white'
            }`}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="hidden rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white md:inline-flex"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handlePrimaryAction}
              disabled={isPrimaryDisabled}
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition ${
                isPrimaryDisabled
                  ? 'cursor-not-allowed bg-emerald-500/40 text-white/70'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
