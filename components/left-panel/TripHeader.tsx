'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Loader2, Search } from 'lucide-react'

import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { useResearchStore } from '@/lib/store/research-store'
import { ONBOARDING_EVENT_NAME, ONBOARDING_STORAGE_KEY } from '@/components/onboarding/AppOnboarding'
import { DateSelector } from './DateSelector'
import { buildCountryOptions } from './CountrySelector'
import { searchCountries, type CountrySearchResult } from '@/lib/map/country-search'
import { getCountryMeta, setCountryMeta } from '@/lib/map/country-cache'
import { TripSwitcher } from './TripSwitcher'
import { UserProfile } from '@/components/auth/user-profile'
import { ShareTripModal } from '@/components/modals/ShareTripModal'
import { TravealLogo } from '@/components/common/TravealLogo'

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
            setResults(
              dedupeByCode(
                found.map((entry: CountrySearchResult) => ({
                  code: entry.code,
                  name: entry.name,
                  bbox: entry.bbox,
                  center: entry.center,
                }))
              )
            )
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

          <div className="flex-1 space-y-2 overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-6 text-sm text-white/60">Searching…</div>
            ) : results.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] py-12 text-center text-sm text-white/50">
                {query.trim() ? 'No results found. Try another country name.' : 'Start typing to search.'}
              </div>
            ) : (
              results.map((option) => {
                const isActive = option.code.toUpperCase() === selectedCode?.toUpperCase()
                return (
                  <button
                    key={option.code}
                    onClick={() => void handleSelect(option)}
                    disabled={isSaving}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? 'border-emerald-400/60 bg-emerald-500/10 text-white'
                        : 'border-white/10 bg-white/[0.03] text-white/80 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold">{option.name}</div>
                    <div className="text-xs text-white/55">{option.code.toUpperCase()}</div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface TripHeaderProps {
  className?: string
}

export function TripHeader({ className }: TripHeaderProps) {
  const { currentTrip, updateTrip } = useSupabaseTripStore()
  const trips = useSupabaseTripStore((state) => state.trips)
  const openResearch = useResearchStore((state) => state.open)

  const [showDateSelector, setShowDateSelector] = useState(false)
  const [showCountrySelector, setShowCountrySelector] = useState(false)
  const [isCountrySaving, setIsCountrySaving] = useState(false)
  const [countryName, setCountryName] = useState<string | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isTripSwitcherOpen, setIsTripSwitcherOpen] = useState(false)
  const [showTripSwitcherHint, setShowTripSwitcherHint] = useState(false)

  const countryOptions = useMemo(() => buildCountryOptions(), [])
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

  const selectedCountry = currentTrip?.country ?? null
  const countryLabel = selectedCountry ? countryName ?? selectedCountry : 'Choose a country'

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

    const optionMatch = countryOptions.find((option) => option.code.toUpperCase() === normalized)
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
      .then((results) => {
        if (cancelled) return
        const match =
          results.find((result) => result.code.toUpperCase() === normalized) ?? results[0]
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    const shouldHighlight = window.sessionStorage.getItem('trip3:show-trip-switcher-hint')
    if (shouldHighlight) {
      window.sessionStorage.removeItem('trip3:show-trip-switcher-hint')
      setShowTripSwitcherHint(true)
    }
  }, [trips.length])

  const hasDates = Boolean(currentTrip?.startDate && currentTrip?.endDate)
  const datesSummary = hasDates
    ? `${currentTrip!.startDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} – ${currentTrip!.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'Set travel dates'

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
      console.error('TripHeader: failed to set country', error)
    } finally {
      setIsCountrySaving(false)
    }
  }

  const handleTripSwitcherOpenChange = (open: boolean) => {
    if (open) {
      setShowTripSwitcherHint(false)
    }
    setIsTripSwitcherOpen(open)
  }

  if (!currentTrip) {
    return null
  }

  return (
    <div className={className}>
      <div className="relative overflow-visible rounded-[32px] border border-white/12 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950/95">
        <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-emerald-500/5" />
        <div className="absolute inset-0 rounded-[32px] bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.08),transparent_55%)]" />

        <div className="relative z-10 rounded-[32px] p-6" data-tour="trip-summary">
          <div className="mb-4 flex items-center gap-4">
            <TravealLogo className="shrink-0" />
            <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
              <TripSwitcher
                open={isTripSwitcherOpen}
                onOpenChange={handleTripSwitcherOpenChange}
                highlight={showTripSwitcherHint && trips.length > 1}
              />
              <button
                type="button"
                onClick={() => setShowCountrySelector(true)}
                className="group flex h-12 shrink-0 items-center justify-between gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-left text-white/90 shadow-sm backdrop-blur transition hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-300/40"
              >
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
                    Destination
                  </span>
                  <span className="block truncate text-sm font-semibold text-white">{countryLabel}</span>
                </span>
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-white/40 transition group-hover:text-blue-300" />
              </button>
              <button
                type="button"
                onClick={() => setShowDateSelector(true)}
                className="group flex h-12 shrink-0 items-center justify-between gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-left text-white/90 shadow-sm backdrop-blur transition hover:border-emerald-400/60 hover:bg-emerald-500/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
              >
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
                    Dates
                  </span>
                  <span className="block truncate text-sm font-semibold text-white">{datesSummary}</span>
                </span>
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-white/40 transition group-hover:text-emerald-300" />
              </button>
              <div className="ml-2 flex items-center gap-2" data-tour="header-actions">
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

      {showDateSelector ? <DateSelector onClose={() => setShowDateSelector(false)} /> : null}

      {showCountrySelector ? (
        <CountrySelectModal
          onClose={handleCountryModalClose}
          onSelect={handleCountrySelect}
          options={countryOptions}
          selectedCode={selectedCountry}
          isSaving={isCountrySaving}
          token={mapboxToken}
        />
      ) : null}

      <ShareTripModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        trip={currentTrip}
      />
    </div>
  )
}
