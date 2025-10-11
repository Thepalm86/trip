'use client'

import { useEffect, useMemo, useState } from 'react'
import { Edit3, Search, Calendar, Globe, ChevronDown, Loader2 } from 'lucide-react'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { TabSystem } from './TabSystem'
import { DateSelector } from './DateSelector'
import { UserProfile } from '@/components/auth/user-profile'
import { ONBOARDING_EVENT_NAME, ONBOARDING_STORAGE_KEY } from '@/components/onboarding/AppOnboarding'
import { useResearchStore } from '@/lib/store/research-store'
import { ShareTripModal } from '@/components/modals/ShareTripModal'
import { buildCountryOptions } from './CountrySelector'
import { searchCountries, CountrySearchResult } from '@/lib/map/country-search'
import { getCountryMeta, setCountryMeta } from '@/lib/map/country-cache'

export function LeftPanel() {
  const { currentTrip, updateTrip } = useSupabaseTripStore()
  const openResearch = useResearchStore((state) => state.open)
  const [showDateSelector, setShowDateSelector] = useState(false)
  const [isEditingTripName, setIsEditingTripName] = useState(false)
  const [tripName, setTripName] = useState(currentTrip?.name || '')
  const [showCountrySelector, setShowCountrySelector] = useState(false)
  const [isCountrySaving, setIsCountrySaving] = useState(false)
  const countryOptions = useMemo(() => buildCountryOptions(), [])
  const [countryName, setCountryName] = useState<string | null>(null)
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  useEffect(() => {
    if (currentTrip && !isEditingTripName) {
      setTripName(currentTrip.name)
    }
  }, [currentTrip?.name, isEditingTripName])

  const selectedCountry = currentTrip?.country ?? null
  const countryLabel = selectedCountry
    ? countryName ?? selectedCountry
    : 'Choose a country'

  useEffect(() => {
    if (!selectedCountry) {
      setCountryName(null)
      return
    }

    const normalized = selectedCountry.toUpperCase()
    const meta = getCountryMeta(normalized)

    if (meta?.name) {
      setCountryName(meta.name)
      return
    }

    const optionMatch = countryOptions.find(option => option.code.toUpperCase() === normalized)
    if (optionMatch) {
      setCountryName(optionMatch.name)
      setCountryMeta(normalized, { name: optionMatch.name })
      return
    }

    if (!mapboxToken) {
      setCountryName(normalized)
      return
    }

    let cancelled = false

    searchCountries(normalized, mapboxToken, 1)
      .then(results => {
        if (cancelled) return
        const match = results.find(result => result.code.toUpperCase() === normalized) ?? results[0]
        if (match) {
          setCountryName(match.name)
          setCountryMeta(normalized, { name: match.name, bbox: match.bbox, center: match.center })
        } else {
          setCountryName(normalized)
        }
      })
      .catch(() => {
        if (cancelled) return
        setCountryName(normalized)
      })

    return () => {
      cancelled = true
    }
  }, [selectedCountry, countryOptions, mapboxToken])

  const dateRangeLabel = currentTrip?.startDate && currentTrip?.endDate
    ? `${currentTrip.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${currentTrip.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'Set travel dates'

  const hasDates = Boolean(currentTrip?.startDate && currentTrip?.endDate)
  const datesSummary = hasDates ? dateRangeLabel : 'Set travel dates'

  const handleTripNameSave = async () => {
    if (!currentTrip) {
      setIsEditingTripName(false)
      return
    }

    if (tripName.trim() && tripName !== currentTrip.name) {
      await updateTrip(currentTrip.id, { name: tripName.trim() })
    }
    setIsEditingTripName(false)
  }

  const handleTripNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTripNameSave()
    } else if (e.key === 'Escape') {
      if (currentTrip) {
        setTripName(currentTrip.name)
      }
      setIsEditingTripName(false)
    }
  }

  const handleRestartOnboarding = () => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY)
    window.dispatchEvent(new Event(ONBOARDING_EVENT_NAME))
  }

  const handleCountryModalClose = () => {
    if (!isCountrySaving) {
      setShowCountrySelector(false)
    }
  }

  const handleCountrySelect = async (option: CountrySelectionOption) => {
    if (!currentTrip) {
      return
    }
    setIsCountrySaving(true)
    try {
      if (option.name) {
        setCountryName(option.name)
      }
      setCountryMeta(option.code, {
        name: option.name,
        bbox: option.bbox,
        center: option.center,
      })
      await updateTrip(currentTrip.id, { country: option.code })
      setShowCountrySelector(false)
    } catch (error) {
      console.error('LeftPanel: failed to set country', error)
    } finally {
      setIsCountrySaving(false)
    }
  }

  if (!currentTrip) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" data-tour="left-panel">
        <div className="text-white/80">Loading trip...</div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col" data-tour="left-panel">
      {/* Enhanced Trip Hero Header */}
      <div className="relative overflow-visible">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-emerald-500/5"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]"></div>
        
        <div className="relative z-10 p-6 border-b border-white/10" data-tour="trip-summary">
          {/* Trip Hero Section */}
          <div className="mb-2">
            {/* Trip Title - Hero with Profile and Actions */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex flex-1 min-w-[220px] items-center gap-3">
                {isEditingTripName ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={tripName}
                        onChange={(e) => setTripName(e.target.value)}
                        onBlur={handleTripNameSave}
                        onKeyDown={handleTripNameKeyDown}
                        className="w-full bg-transparent text-3xl font-bold text-white outline-none focus:outline-none border-b-2 border-blue-400/50 pb-2"
                        autoFocus
                        placeholder="Enter trip name..."
                      />
                      <div className="absolute -bottom-1 left-0 h-0.5 w-full bg-gradient-to-r from-blue-400 to-purple-400"></div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditingTripName(true)}
                      className="group flex items-center gap-3 text-left transition-all duration-200 hover:text-blue-300"
                    >
                      <h1 className="text-3xl font-bold text-white group-hover:text-blue-300 transition-colors duration-200">
                        {currentTrip.name}
                      </h1>
                    <Edit3 className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-blue-400" />
                  </button>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCountrySelector(true)}
                  className="group flex h-12 items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-4 text-left text-white/90 shadow-sm backdrop-blur transition hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-300/40"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/10">
                    <Globe className="h-4 w-4 text-blue-300" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.26em] text-white/50">
                      Destination
                    </span>
                    <span className="block truncate text-sm font-semibold text-white">
                      {countryLabel}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-white/40 transition group-hover:text-blue-300" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDateSelector(true)}
                  className="group flex h-12 items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-4 text-left text-white/90 shadow-sm backdrop-blur transition hover:border-emerald-400/60 hover:bg-emerald-500/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10">
                    <Calendar className="h-4 w-4 text-emerald-300" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.26em] text-white/50">
                      Dates
                    </span>
                    <span className="block truncate text-sm font-semibold text-white">
                      {datesSummary}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-white/40 transition group-hover:text-emerald-300" />
                </button>
              </div>
              
              {/* Actions and User Profile */}
              <div className="ml-auto flex items-center gap-2" data-tour="header-actions">
                <UserProfile
                  onShare={() => setIsShareModalOpen(true)}
                  onShowGuide={handleRestartOnboarding}
                  onOpenResearch={openResearch}
                />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <TabSystem />
      </div>

      {/* Date Selector Modal */}
      {showDateSelector && (
        <DateSelector onClose={() => setShowDateSelector(false)} />
      )}

      {showCountrySelector && (
        <CountrySelectModal
          onClose={handleCountryModalClose}
          onSelect={handleCountrySelect}
          options={countryOptions}
          selectedCode={selectedCountry}
          isSaving={isCountrySaving}
          token={mapboxToken}
        />
      )}

      <ShareTripModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        trip={currentTrip}
      />
    </div>
  )
}

type StaticCountryOption = ReturnType<typeof buildCountryOptions>[number]

interface CountrySelectionOption {
  code: string
  name: string
  bbox?: [number, number, number, number]
  center?: [number, number]
}

interface CountrySelectModalProps {
  onClose: () => void
  onSelect: (option: CountrySelectionOption) => Promise<void>
  options: StaticCountryOption[]
  selectedCode: string | null
  isSaving: boolean
  token: string
}

function dedupeByCode(options: CountrySelectionOption[]): CountrySelectionOption[] {
  const seen = new Set<string>()
  const result: CountrySelectionOption[] = []
  for (const option of options) {
    const code = option.code.toUpperCase()
    if (seen.has(code)) continue
    seen.add(code)
    result.push({ ...option, code })
  }
  return result
}

function CountrySelectModal({ onClose, onSelect, options, selectedCode, isSaving, token }: CountrySelectModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CountrySelectionOption[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const selectedName = useMemo(() => {
    if (!selectedCode) return 'Not set'
    const fromResults = results.find(option => option.code.toUpperCase() === selectedCode.toUpperCase())
    if (fromResults) return fromResults.name
    const fromBase = options.find(option => option.code.toUpperCase() === selectedCode.toUpperCase())
    return fromBase?.name ?? selectedCode
  }, [options, results, selectedCode])

  useEffect(() => {
    let cancelled = false
    const trimmed = query.trim()

    if (!trimmed) {
      setResults([])
      setIsSearching(false)
      return () => {
        cancelled = true
      }
    }

    if (!token) {
      setResults([])
      setIsSearching(false)
      return () => {
        cancelled = true
      }
    }

    setIsSearching(true)

    const timeoutId = window.setTimeout(() => {
      searchCountries(trimmed, token, 8)
        .then((found) => {
          if (cancelled) return
          if (found.length === 0) {
            setResults([])
          } else {
            setResults(dedupeByCode(found.map((entry: CountrySearchResult) => ({
              code: entry.code,
              name: entry.name,
              bbox: entry.bbox,
              center: entry.center,
            }))))
          }
        })
        .catch((error) => {
          if (cancelled) return
          console.error('CountrySelectModal: search failed', error)
          setResults([])
        })
        .finally(() => {
          if (cancelled) return
          setIsSearching(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [query, token])

  const handleSelect = async (option: CountrySelectionOption) => {
    if (isSaving || option.code.toUpperCase() === selectedCode?.toUpperCase()) return
    await onSelect(option)
    setQuery('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Select Country</h3>
            <p className="text-sm text-white/60">Focus your planning on the country you want to explore.</p>
            <p className="mt-2 text-xs text-white/40">Current: {selectedName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
            disabled={isSaving}
          >
            Close
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 px-6 py-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for a country..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/60" />
            )}
          </div>

          <div className="flex-1 overflow-y-auto rounded-xl border border-white/5 bg-white/[0.02]">
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-white/50">
                {query.trim() ? 'No countries match your search.' : 'Start typing to find any country.'}
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {results.map((option) => {
                  const isSelected = option.code.toUpperCase() === selectedCode?.toUpperCase()
                  return (
                    <button
                      key={option.code}
                      onClick={() => handleSelect(option)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white/80 transition hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:text-white/40"
                      disabled={isSelected || isSaving}
                    >
                      <span>{option.name}</span>
                      <span className="text-xs text-white/40">{isSelected ? 'Selected' : option.code}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
