'use client'

import { useEffect, useMemo, useState } from 'react'
import { Share2, Edit3, HelpCircle, Sparkles, Search, Calendar, Globe, ChevronDown, Settings } from 'lucide-react'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { TabSystem } from './TabSystem'
import { DateSelector } from './DateSelector'
import { UserProfile } from '@/components/auth/user-profile'
import { ONBOARDING_EVENT_NAME, ONBOARDING_STORAGE_KEY } from '@/components/onboarding/AppOnboarding'
import { useResearchStore } from '@/lib/store/research-store'
import { buildCountryOptions } from './CountrySelector'

export function LeftPanel() {
  const { currentTrip, updateTrip } = useSupabaseTripStore()
  const openResearch = useResearchStore((state) => state.open)
  const [showDateSelector, setShowDateSelector] = useState(false)
  const [isEditingTripName, setIsEditingTripName] = useState(false)
  const [tripName, setTripName] = useState(currentTrip?.name || '')
  const [showCountrySelector, setShowCountrySelector] = useState(false)
  const [isCountrySaving, setIsCountrySaving] = useState(false)
  const countryOptions = useMemo(() => buildCountryOptions(), [])

  useEffect(() => {
    if (currentTrip && !isEditingTripName) {
      setTripName(currentTrip.name)
    }
  }, [currentTrip?.name, isEditingTripName])

  const selectedCountry = currentTrip?.country ?? null
  const countryLabel = selectedCountry
    ? countryOptions.find(option => option.code === selectedCountry)?.name ?? selectedCountry
    : 'Select a country'

  const dateRangeLabel = currentTrip?.startDate && currentTrip?.endDate
    ? `${currentTrip.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${currentTrip.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'Set travel dates'

  const dayCount = useMemo(() => currentTrip?.days.length ?? 0, [currentTrip?.days.length])

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

  const handleCountrySelect = async (code: string) => {
    if (!currentTrip) {
      return
    }
    setIsCountrySaving(true)
    try {
      await updateTrip(currentTrip.id, { country: code })
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
            <div className="mb-3 flex items-center justify-between">
              <div className="flex-1">
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
              
              {/* Actions and User Profile */}
              <div className="ml-6 flex items-center gap-3" data-tour="header-actions">
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    className="group p-2 rounded-lg bg-white/5 text-white/40 transition-all duration-200 disabled:cursor-not-allowed"
                    aria-label="Share trip (coming soon)"
                    disabled
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRestartOnboarding}
                    className="group p-2 rounded-lg bg-white/5 text-white/60 transition-all duration-200 hover:bg-purple-500/20 hover:text-purple-400 hover:shadow-lg hover:shadow-purple-500/20"
                    title="Show guided tour"
                    aria-label="Show guided tour"
                  >
                    <HelpCircle className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                  </button>
                  <button
                    type="button"
                    onClick={openResearch}
                    className="group p-2 rounded-lg bg-white/5 text-white/60 transition-all duration-200 hover:bg-emerald-500/20 hover:text-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20"
                    title="Open research"
                    aria-label="Open research"
                  >
                    <Sparkles className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                  </button>
                  <button
                    type="button"
                    className="group p-2 rounded-lg bg-white/5 text-white/40 transition-all duration-200 disabled:cursor-not-allowed"
                    aria-label="Open settings (coming soon)"
                    disabled
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
                
                {/* User Profile */}
                <div className="ml-2" data-tour="profile">
                  <UserProfile />
                </div>
              </div>
            </div>

            {/* Trip Overview Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Destination Card */}
              <button
                onClick={() => setShowCountrySelector(true)}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.04] p-3 text-left transition-all duration-300 hover:border-blue-400/40 hover:bg-gradient-to-br hover:from-blue-500/10 hover:to-purple-500/5 hover:shadow-lg hover:shadow-blue-500/10"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-400/30">
                    <Globe className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-wider text-white/60 font-medium mb-1">Destination</div>
                    <div className="text-lg font-semibold text-white truncate">
                      {countryLabel}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-white/40 group-hover:text-blue-400 transition-colors duration-200" />
                </div>
              </button>

              {/* Duration Card */}
              <button
                onClick={() => setShowDateSelector(true)}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.04] p-3 text-left transition-all duration-300 hover:border-emerald-400/40 hover:bg-gradient-to-br hover:from-emerald-500/10 hover:to-teal-500/5 hover:shadow-lg hover:shadow-emerald-500/10"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-400/30">
                    <Calendar className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-wider text-white/60 font-medium mb-1">Duration</div>
                    <div className="flex items-center gap-2 text-lg font-semibold text-white">
                      <span>{dayCount === 0 ? 'No days yet' : `${dayCount} ${dayCount === 1 ? 'day' : 'days'}`}</span>
                      <span className="text-white/40">•</span>
                      <span className="text-lg font-semibold text-white">{dateRangeLabel}</span>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors duration-200" />
                </div>
              </button>
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
        />
      )}
    </div>
  )
}

type CountryOption = ReturnType<typeof buildCountryOptions>[number]

interface CountrySelectModalProps {
  onClose: () => void
  onSelect: (code: string) => Promise<void>
  options: CountryOption[]
  selectedCode: string | null
  isSaving: boolean
}

function CountrySelectModal({ onClose, onSelect, options, selectedCode, isSaving }: CountrySelectModalProps) {
  const [query, setQuery] = useState('')

  const selectedName = useMemo(() => {
    if (!selectedCode) return 'Not set'
    return options.find(option => option.code === selectedCode)?.name ?? selectedCode
  }, [options, selectedCode])

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    if (!normalized) {
      return options
    }

    return options
      .filter(option => 
        option.name.toLowerCase().includes(normalized) || 
        option.code.toLowerCase().includes(normalized)
      )
      .sort((a, b) => {
        // Prioritize exact matches and matches at the beginning
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()
        
        if (aName.startsWith(normalized) && !bName.startsWith(normalized)) return -1
        if (!aName.startsWith(normalized) && bName.startsWith(normalized)) return 1
        if (aName === normalized && bName !== normalized) return -1
        if (aName !== normalized && bName === normalized) return 1
        
        return aName.localeCompare(bName)
      })
  }, [options, query])

  const handleSelect = async (code: string) => {
    if (isSaving) return
    await onSelect(code)
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
          </div>

          <div className="flex-1 overflow-y-auto rounded-xl border border-white/5 bg-white/[0.02]">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-white/50">No countries match your search.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredOptions.map((option) => {
                  const isSelected = option.code === selectedCode
                  return (
                    <button
                      key={option.code}
                      onClick={() => handleSelect(option.code)}
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
