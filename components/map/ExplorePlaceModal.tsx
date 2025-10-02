'use client'

import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, MapPin, Hotel, Landmark, Plus, Trash2, ExternalLink } from 'lucide-react'
import type { ExplorePlace, LocationLink } from '@/types'
import {
  CATEGORY_ORDER,
  getExploreCategoryMetadata,
  normalizeExploreCategoryKey,
} from '@/lib/explore/categories'

const DESTINATION_LINK_OPTIONS: { value: LocationLink['type']; label: string }[] = [
  { value: 'website', label: 'Official website' },
  { value: 'google_maps', label: 'Google Maps' },
  { value: 'tripadvisor', label: 'TripAdvisor' },
  { value: 'guide', label: 'Travel guide' },
  { value: 'blog', label: 'Blog / inspiration' },
  { value: 'tickets', label: 'Tickets & booking' },
  { value: 'other', label: 'Other' },
]

const ACCOMMODATION_LINK_OPTIONS: { value: LocationLink['type']; label: string }[] = [
  { value: 'website', label: 'Official website' },
  { value: 'google_maps', label: 'Google Maps' },
  { value: 'tripadvisor', label: 'TripAdvisor' },
  { value: 'booking', label: 'Booking.com' },
  { value: 'hotels', label: 'Hotels.com' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'other', label: 'Other' },
]

type Mode = 'destination' | 'accommodation'

type LinkDraft = {
  id: string
  type: LocationLink['type']
  label: string
  url: string
}

interface StepDefinition {
  id: number
  label: string
}

const DESTINATION_CATEGORY_EXCLUSIONS = new Set(['accommodation', 'hotel'])

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

interface ExplorePlaceModalProps {
  place: ExplorePlace
  onCancel: () => void
  onConfirm: (place: ExplorePlace) => Promise<void> | void
}

export function ExplorePlaceModal({ place, onCancel, onConfirm }: ExplorePlaceModalProps) {
  const normalizedCategory = normalizeExploreCategoryKey(place.category)
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = document.createElement('div')
    container.setAttribute('data-explore-place-modal-root', 'true')
    document.body.appendChild(container)
    setPortalContainer(container)

    return () => {
      document.body.removeChild(container)
      setPortalContainer(null)
    }
  }, [])
  const defaultMode: Mode = normalizedCategory === 'accommodation' || normalizedCategory === 'hotel'
    ? 'accommodation'
    : 'destination'

  const [mode, setMode] = useState<Mode>(defaultMode)
  const [step, setStep] = useState<number>(1)
  const [isSaving, setIsSaving] = useState(false)

  const destinationCategoryOptions = useMemo(() => {
    return CATEGORY_ORDER.filter((value) => !DESTINATION_CATEGORY_EXCLUSIONS.has(value)).map((value) => {
      const metadata = getExploreCategoryMetadata(value)
      return {
        value,
        label: metadata.label,
        colors: metadata.colors,
      }
    })
  }, [])

  const [destinationCategory, setDestinationCategory] = useState<string>(() => {
    if (defaultMode === 'destination') {
      if (normalizedCategory === 'accommodation' || normalizedCategory === 'hotel') {
        return 'attraction'
      }
      return normalizedCategory
    }
    return 'attraction'
  })
  const [destinationNotes, setDestinationNotes] = useState('')
  const [destinationLinks, setDestinationLinks] = useState<LinkDraft[]>([])

  const [accommodationCategory, setAccommodationCategory] = useState<string>(() => {
    const fromMetadata = (place.metadata?.accommodationCategory || place.metadata?.accommodationSubtype) as string | undefined
    if (fromMetadata && ACCOMMODATION_CATEGORY_OPTIONS.some((option) => option.value === fromMetadata)) {
      return fromMetadata
    }
    const inferred = normalizedCategory === 'hotel' ? 'hotel' : undefined
    return inferred ?? 'hotel'
  })
  const [accommodationNotes, setAccommodationNotes] = useState('')
  const [accommodationLinks, setAccommodationLinks] = useState<LinkDraft[]>([])

  const stepDefinitions: StepDefinition[] = mode === 'destination'
    ? [
        { id: 1, label: 'Type' },
        { id: 2, label: 'Category' },
        { id: 3, label: 'Details' },
      ]
    : [
        { id: 1, label: 'Type' },
        { id: 2, label: 'Category' },
        { id: 3, label: 'Details' },
      ]

  const totalSteps = stepDefinitions.length

  useEffect(() => {
    setStep((current) => Math.min(current, totalSteps))
  }, [totalSteps])

  const preparedLinks = (drafts: LinkDraft[]): LocationLink[] | undefined => {
    const cleaned = drafts
      .map((draft) => ({
        id: draft.id,
        type: draft.type,
        label: draft.label.trim(),
        url: draft.url.trim(),
      }))
      .filter((draft) => draft.label && draft.url)

    return cleaned.length ? cleaned : undefined
  }

  const handleSubmit = async () => {
    if (mode === 'destination' && !destinationCategory) {
      return
    }
    if (mode === 'accommodation' && !accommodationCategory) {
      return
    }

    setIsSaving(true)
    try {
      const notes = (mode === 'destination' ? destinationNotes : accommodationNotes).trim()
      const linksDrafts = mode === 'destination' ? destinationLinks : accommodationLinks
      const links = preparedLinks(linksDrafts)

      const nextPlaceMetadata = {
        ...(place.metadata ?? {}),
      }

      if (mode === 'accommodation') {
        nextPlaceMetadata.accommodationCategory = accommodationCategory
      } else {
        delete nextPlaceMetadata.accommodationCategory
        delete nextPlaceMetadata.accommodationSubtype
      }

      const nextPlace: ExplorePlace = {
        ...place,
        category: mode === 'destination' ? destinationCategory : 'accommodation',
        notes: notes || undefined,
        links,
        metadata: nextPlaceMetadata,
      }

      await onConfirm(nextPlace)
    } finally {
      setIsSaving(false)
    }
  }

  const canProceed = useMemo(() => {
    if (step === 1) {
      return true
    }
    if (mode === 'destination') {
      if (step === 2) {
        return Boolean(destinationCategory)
      }
    } else {
      if (step === 2) {
        return Boolean(accommodationCategory)
      }
    }
    return true
  }, [accommodationCategory, destinationCategory, mode, step])

  const primaryLabel = step === totalSteps ? (isSaving ? 'Saving…' : 'Add to map') : 'Next'
  const isPrimaryDisabled = isSaving || !canProceed

  const handlePrimaryAction = async () => {
    if (step === totalSteps) {
      await handleSubmit()
    } else {
      setStep((current) => Math.min(current + 1, totalSteps))
    }
  }

  const handleBack = () => {
    setStep((current) => Math.max(current - 1, 1))
  }

  const renderLinksSection = (currentMode: Mode) => {
    const drafts = currentMode === 'destination' ? destinationLinks : accommodationLinks
    const isDestination = currentMode === 'destination'
    const options = currentMode === 'destination' ? DESTINATION_LINK_OPTIONS : ACCOMMODATION_LINK_OPTIONS
    const handleAdd = () => {
      const draft = createEmptyLinkDraft()
      if (currentMode === 'destination') {
        setDestinationLinks((prev) => [...prev, draft])
      } else {
        setAccommodationLinks((prev) => [...prev, draft])
      }
    }
    const updateLink = (id: string, field: keyof Omit<LinkDraft, 'id'>, value: string) => {
      if (currentMode === 'destination') {
        setDestinationLinks((prev) => prev.map((link) => (link.id === id ? { ...link, [field]: value } : link)))
      } else {
        setAccommodationLinks((prev) => prev.map((link) => (link.id === id ? { ...link, [field]: value } : link)))
      }
    }
    const removeLink = (id: string) => {
      if (currentMode === 'destination') {
        setDestinationLinks((prev) => prev.filter((link) => link.id !== id))
      } else {
        setAccommodationLinks((prev) => prev.filter((link) => link.id !== id))
      }
    }

    return (
      <div className="mt-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-sm font-semibold text-white/70">Links</h4>
          <button
            type="button"
            onClick={handleAdd}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold text-white/80 transition whitespace-nowrap ${
              isDestination
                ? 'border-blue-400/50 bg-blue-500/20 hover:border-blue-300/60 hover:bg-blue-500/30'
                : 'border-emerald-400/50 bg-emerald-500/20 hover:border-emerald-300/60 hover:bg-emerald-500/30'
            }`}
          >
            <Plus className="h-3.5 w-3.5" /> {drafts.length > 0 ? 'Add another link' : 'Add link'}
          </button>
        </div>

        {drafts.length === 0 ? null : (
          <div className="space-y-3">
            {drafts.map((link, index) => (
              <div
                key={link.id}
                className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/5 via-white/3 to-white/5 p-4 shadow-inner shadow-black/20"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/50">Link {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeLink(link.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/60 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[160px_1fr]">
                  <div>
                    <label className="block text-[11px] font-semibold text-white/60">
                      Type
                    </label>
                    <select
                      value={link.type}
                      onChange={(event) => updateLink(link.id, 'type', event.target.value)}
                      className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm text-white transition focus:outline-none ${
                        isDestination
                          ? 'border-blue-400/30 bg-blue-500/10 focus:border-blue-300/60 focus:bg-blue-500/15'
                          : 'border-emerald-400/30 bg-emerald-500/10 focus:border-emerald-300/60 focus:bg-emerald-500/15'
                      }`}
                    >
                      {options.map((option) => (
                        <option key={option.value} value={option.value} className="bg-slate-900">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-white/60">
                        Label
                      </label>
                      <input
                        type="text"
                        value={link.label}
                        onChange={(event) => updateLink(link.id, 'label', event.target.value)}
                        placeholder={isDestination ? 'e.g. Official site' : 'e.g. Booking reference'}
                        className="mt-2 w-full rounded-xl border border-white/12 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-white/60">
                        URL
                      </label>
                      <div className="relative mt-2">
                        <ExternalLink className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                        <input
                          type="url"
                          value={link.url}
                          onChange={(event) => updateLink(link.id, 'url', event.target.value)}
                          placeholder="https://"
                          className="w-full rounded-xl border border-white/12 bg-white/10 px-10 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    )
  }

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <div className="flex h-full flex-col justify-center gap-6">
          <div>
            <h4 className="text-sm font-semibold text-white/70">Choose type</h4>
          </div>

          <div className="grid gap-4">
            <button
              type="button"
              onClick={() => setMode('destination')}
              className={`flex items-center justify-between rounded-2xl border px-5 py-5 text-left transition ${
                mode === 'destination'
                  ? 'border-blue-400 bg-blue-500/20 text-white shadow-lg shadow-blue-500/15'
                  : 'border-white/10 bg-white/5 text-white/70 hover:border-blue-400/40 hover:bg-blue-500/15 hover:text-white'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <Landmark className="h-5 w-5" /> Destination / Activity
                </div>
                <p className="text-xs text-white/60">Stops, experiences, restaurants, and highlights for the day.</p>
              </div>
              {mode === 'destination' && <span className="text-xs font-medium text-blue-200">Selected</span>}
            </button>

            <button
              type="button"
              onClick={() => setMode('accommodation')}
              className={`flex items-center justify-between rounded-2xl border px-5 py-5 text-left transition ${
                mode === 'accommodation'
                  ? 'border-emerald-400 bg-emerald-500/20 text-white shadow-lg shadow-emerald-500/15'
                  : 'border-white/10 bg-white/5 text-white/70 hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-white'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <Hotel className="h-5 w-5" /> Accommodation
                </div>
                <p className="text-xs text-white/60">Hotels, apartments, or base hubs you plan to stay in.</p>
              </div>
              {mode === 'accommodation' && <span className="text-xs font-medium text-emerald-200">Selected</span>}
            </button>
          </div>
        </div>
      )
    }

    if (mode === 'destination') {
      if (step === 2) {
        return (
          <div className="flex h-full flex-col">
            <div>
              <h4 className="text-sm font-semibold text-white/70">Choose category</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {destinationCategoryOptions.map((option) => {
                  const isSelected = destinationCategory === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDestinationCategory(option.value)}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                        isSelected
                          ? 'border-blue-400 bg-blue-500/25 text-white shadow-lg shadow-blue-500/10'
                          : 'border-white/10 bg-white/5 text-white/70 hover:border-blue-400/40 hover:bg-blue-500/15 hover:text-white'
                      }`}
                    >
                      <span>{option.label}</span>
                      {isSelected && <span className="text-xs font-medium text-blue-200">Selected</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      }

      if (step === 3) {
        return (
          <div className="flex h-full flex-col justify-between">
            <div>
              <label className="block text-sm font-medium text-white/80">Notes (optional)</label>
              <textarea
                value={destinationNotes}
                onChange={(event) => setDestinationNotes(event.target.value)}
                placeholder="Timing tips, highlights, personal reminders..."
                className="mt-2 h-24 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-blue-400/50 focus:outline-none"
              />
            </div>
            {renderLinksSection('destination')}
          </div>
        )
      }
    }

    if (mode === 'accommodation') {
      if (step === 2) {
        return (
          <div className="flex h-full flex-col">
            <div>
              <h4 className="text-sm font-semibold text-white/70">Choose stay type</h4>
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

      if (step === 3) {
        return (
          <div className="flex h-full flex-col justify-between">
            <div>
              <h4 className="text-sm font-semibold text-white/70">Stay details</h4>
              <textarea
                value={accommodationNotes}
                onChange={(event) => setAccommodationNotes(event.target.value)}
                placeholder="Check-in codes, parking info, reference numbers..."
                className="mt-3 h-24 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-emerald-400/50 focus:outline-none"
              />
            </div>
            {renderLinksSection('accommodation')}
          </div>
        )
      }
    }

    return null
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-200">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Add to research</h3>
                <p className="text-sm text-white/60">Organise this place before dropping it on the map.</p>
              </div>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <StepIndicator steps={stepDefinitions} currentStep={step} accent={mode === 'destination' ? 'destination' : 'accommodation'} />
          </div>

          <div className="relative">
            <div className="min-h-[320px]">
              {renderStepContent()}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-between gap-3">
          <button
            onClick={handleBack}
            disabled={step === 1 || isSaving}
            className={`rounded-lg border px-4 py-2 text-sm transition ${
              step === 1 || isSaving
                ? 'border-white/5 text-white/30'
                : 'border-white/10 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white'
            }`}
          >
            Back
          </button>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="hidden rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex"
            >
              Cancel
            </button>
            <button
              onClick={handlePrimaryAction}
              disabled={isPrimaryDisabled}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                mode === 'destination'
                  ? 'bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-500/40'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-500/40'
              } disabled:cursor-not-allowed`}
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!portalContainer) {
    return null
  }

  return createPortal(modalContent, portalContainer)
}

function StepIndicator({
  steps,
  currentStep,
  accent,
}: {
  steps: StepDefinition[]
  currentStep: number
  accent: 'destination' | 'accommodation'
}) {
  return (
    <div className="flex w-full items-center gap-4">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep
        const isComplete = step.id < currentStep
        const accentClasses = accent === 'destination'
          ? {
              active: 'border-blue-400/80 bg-blue-500/25 text-white',
              complete: 'border-blue-400/50 bg-blue-500/15 text-blue-100',
              idle: 'border-white/15 bg-white/5 text-white/60',
              connectorActive: 'bg-blue-400/40',
            }
          : {
              active: 'border-emerald-400/80 bg-emerald-500/25 text-white',
              complete: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100',
              idle: 'border-white/15 bg-white/5 text-white/60',
              connectorActive: 'bg-emerald-400/40',
            }

        const indicatorClasses = isActive
          ? accentClasses.active
          : isComplete
          ? accentClasses.complete
          : accentClasses.idle

        return (
          <div key={step.id} className="flex flex-1 items-center">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium transition-colors ${indicatorClasses}`}
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
                  isComplete ? accentClasses.connectorActive : 'bg-white/15'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
