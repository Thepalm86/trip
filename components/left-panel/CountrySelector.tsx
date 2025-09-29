'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { Globe2, Loader2, Search, X } from 'lucide-react'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'

interface CountryOption {
  code: string
  name: string
}

export function buildCountryOptions(): CountryOption[] {
  const regionSupport = typeof Intl !== 'undefined' && typeof (Intl as any).supportedValuesOf === 'function'
  const displayNameSupport = typeof Intl !== 'undefined' && typeof (Intl as any).DisplayNames === 'function'

  const fallback: CountryOption[] = [
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Germany' },
    { code: 'ES', name: 'Spain' },
    { code: 'IT', name: 'Italy' },
    { code: 'CA', name: 'Canada' },
    { code: 'AU', name: 'Australia' },
    { code: 'JP', name: 'Japan' },
    { code: 'BR', name: 'Brazil' },
  ]

  if (!regionSupport) {
    return fallback
  }

  const displayNames = displayNameSupport
    ? new (Intl as any).DisplayNames(['en'], { type: 'region' })
    : null

  let regions: string[] = []
  try {
    regions = (Intl as any).supportedValuesOf('region') as string[]
  } catch (error) {
    console.warn('CountrySelector: falling back to static country list', error)
    return fallback
  }

  const options = regions
    .filter(code => /^[A-Z]{2}$/.test(code))
    .map<CountryOption>((code) => ({
      code,
      name: displayNames?.of?.(code) ?? code
    }))
    .filter(option => !!option.name && option.name !== option.code)
    .sort((a, b) => a.name.localeCompare(b.name))

  return options.length ? options : fallback
}

export function CountrySelector() {
  const { currentTrip, updateTrip } = useSupabaseTripStore()
  const [query, setQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const countryOptions = useMemo(buildCountryOptions, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!currentTrip) {
    return null
  }

  const selectedCodes: string[] = Array.isArray(currentTrip.countries) && currentTrip.countries.length > 0
    ? currentTrip.countries.map((code) => code.toUpperCase())
    : currentTrip.country
      ? [currentTrip.country.toUpperCase()]
      : []

  const selectedOptions = selectedCodes.map((code) => {
    const option = countryOptions.find(opt => opt.code === code)
    return option ?? { code, name: code }
  })

  const queryLower = query.trim().toLowerCase()

  const filteredOptions = useMemo(() => {
    if (!queryLower) {
      return countryOptions.filter(opt => !selectedCodes.includes(opt.code.toUpperCase())).slice(0, 8)
    }

    return countryOptions
      .filter(opt => !selectedCodes.includes(opt.code.toUpperCase()))
      .filter(opt => 
        opt.name.toLowerCase().includes(queryLower) ||
        opt.code.toLowerCase().includes(queryLower)
      )
      .slice(0, 8)
  }, [countryOptions, queryLower, selectedCodes])

  const handleSelectCountry = async (option: CountryOption) => {
    const normalizedCode = option.code.toUpperCase()
    if (selectedCodes.includes(normalizedCode) || !currentTrip) return

    setIsSaving(true)
    try {
      const next = [...selectedCodes, normalizedCode]
      await updateTrip(currentTrip.id, { countries: next })
      setQuery('')
      setIsOpen(false)
    } catch (error) {
      console.error('CountrySelector: failed to add country', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveCountry = async (code: string) => {
    if (!currentTrip) return

    const normalizedCode = code.toUpperCase()
    const next = selectedCodes.filter((item) => item !== normalizedCode)
    setIsSaving(true)
    try {
      await updateTrip(currentTrip.id, { countries: next })
    } catch (error) {
      console.error('CountrySelector: failed to remove country', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mt-4 space-y-3" ref={containerRef}>
      <div className="flex items-center gap-2 text-sm font-medium text-white/70">
        <Globe2 className="h-4 w-4 text-blue-300" />
        Focus countries
      </div>

      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map(option => (
            <span
              key={option.code}
              className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 border border-blue-400/20 px-3 py-1 text-sm text-white/80 backdrop-blur"
            >
              <span>{option.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveCountry(option.code)}
                className="rounded-full p-0.5 text-white/60 hover:text-white hover:bg-blue-500/30 transition"
                disabled={isSaving}
                aria-label={`Remove ${option.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/50">Select one or more countries to keep the map focused.</p>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search countries..."
          className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
        />
        {isSaving && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/60" />
        )}

        {isOpen && filteredOptions.length > 0 && (
          <div className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur p-1 shadow-xl">
            {filteredOptions.map(option => (
              <button
                key={option.code}
                type="button"
                onClick={() => handleSelectCountry(option)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-blue-500/10"
              >
                <span>{option.name}</span>
                <span className="text-xs text-white/40">{option.code}</span>
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-white/40">No matches found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
