'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { searchCountries, type CountrySearchResult } from '@/lib/map/country-search'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

export interface LocationSelection {
  id: string
  title: string
  subtitle: string
  countryCode: string
  countryName: string
  coordinates: [number, number] | null
  kind: 'country' | 'region' | 'city'
}

interface LocationSearchInputProps {
  value: LocationSelection | null
  onSelect: (selection: LocationSelection) => void
}

export function LocationSearchInput({ value, onSelect }: LocationSearchInputProps) {
  const [query, setQuery] = useState<string>(value?.title ?? '')
  const [isFocused, setIsFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<LocationSelection[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (value) {
      setQuery(value.title)
    }
  }, [value])

  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setError('Mapbox token missing')
      return
    }
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      return
    }

    let isMounted = true
    const timer = setTimeout(async () => {
      try {
        setIsLoading(true)
        setError(null)
        const [countries, regionCitySelections] = await Promise.all([
          searchCountries(trimmed, MAPBOX_TOKEN, 8),
          fetchRegionAndCitySelections(trimmed),
        ])
        if (!isMounted) {
          return
        }
        const countrySelections = countries.map(mapCountryToSelection)
        const combined = mergeSelections(countrySelections, regionCitySelections)
        setResults(combined)
      } catch (fetchError) {
        console.error('LocationSearchInput: failed to fetch locations', fetchError)
        if (isMounted) {
          setError('Unable to fetch locations right now')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }, 250)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [query])

  const suggestionsVisible = useMemo(() => isFocused && (results.length > 0 || isLoading || error), [error, isFocused, isLoading, results.length])

  return (
    <div className="relative">
      <div
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur transition-all duration-200',
          'focus-within:border-white/40 focus-within:bg-white/[0.08]',
          error && 'border-red-500/60 bg-red-500/10'
        )}
      >
        <Search className="h-5 w-5 text-white/60" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay blur to allow click on suggestions
            setTimeout(() => setIsFocused(false), 150)
          }}
          placeholder="Search for a country, region, or city"
          className="flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none"
          autoComplete="off"
          spellCheck="false"
        />
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-white/60" aria-hidden="true" /> : null}
      </div>

      {suggestionsVisible ? (
        <div className="absolute z-20 mt-3 w-full rounded-2xl border border-white/10 bg-slate-900/95 p-2 shadow-[0_32px_60px_rgba(8,12,24,0.65)] backdrop-blur-xl">
          {results.length > 0 ? (
            <ul className="space-y-1">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl px-4 py-3 text-left transition-colors duration-150 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                    onClick={() => {
                      onSelect(result)
                      setQuery(result.title)
                      setResults([])
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-blue-500/20 p-2 text-blue-200">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{result.title}</div>
                        <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                          {result.kind === 'country' ? result.subtitle : `${result.kind === 'region' ? 'Region' : 'City'} · ${result.subtitle}`}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-5 text-sm text-white/60">
              {error ?? 'No matches yet. Try another search term.'}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function mapCountryToSelection(country: CountrySearchResult): LocationSelection {
  const title = country.name
  const subtitle = country.code
  const coordinates =
    Array.isArray(country.center) && country.center.length === 2
      ? [Number(country.center[0]), Number(country.center[1])] as [number, number]
      : null

  return {
    id: country.code,
    title,
    subtitle,
    countryCode: country.code,
    countryName: country.name,
    coordinates,
    kind: 'country',
  }
}

async function fetchRegionAndCitySelections(query: string): Promise<LocationSelection[]> {
  if (!MAPBOX_TOKEN) {
    return []
  }

  const endpoint = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`)
  endpoint.searchParams.set('types', 'region,place,locality')
  endpoint.searchParams.set('limit', '6')
  endpoint.searchParams.set('language', 'en')
  endpoint.searchParams.set('access_token', MAPBOX_TOKEN)

  try {
    const response = await fetch(endpoint.toString())
    if (!response.ok) {
      throw new Error(`Mapbox geocoding error: ${response.status}`)
    }
    const data = await response.json()
    const features: MapboxFeature[] = Array.isArray(data?.features) ? data.features : []
    const selections = features
      .map((feature) => mapFeatureToSelection(feature))
      .filter((selection): selection is LocationSelection => Boolean(selection))
    return selections
  } catch (error) {
    console.error('LocationSearchInput: failed to fetch region/city data', error)
    return []
  }
}

interface MapboxFeature {
  id: string
  place_name?: string
  text?: string
  center?: [number, number]
  place_type?: string[]
  context?: Array<Record<string, any>>
  properties?: Record<string, any>
}

function mapFeatureToSelection(feature: MapboxFeature | null): LocationSelection | null {
  if (!feature) return null

  const type = determineFeatureKind(feature)
  if (!type) {
    return null
  }

  const country = extractCountryContext(feature)
  if (!country) {
    return null
  }

  const title = feature.text ?? feature.place_name ?? country.countryName
  if (!title) {
    return null
  }

  const subtitle =
    type === 'region'
      ? `${country.countryName}`
      : `${country.countryName}`

  const coordinates =
    Array.isArray(feature.center) && feature.center.length === 2
      ? [Number(feature.center[0]), Number(feature.center[1])] as [number, number]
      : null

  return {
    id: feature.id,
    title,
    subtitle,
    countryCode: country.countryCode,
    countryName: country.countryName,
    coordinates,
    kind: type,
  }
}

function determineFeatureKind(feature: MapboxFeature): LocationSelection['kind'] | null {
  const types = Array.isArray(feature.place_type) ? feature.place_type : []
  if (types.includes('region')) {
    return 'region'
  }
  if (types.includes('place') || types.includes('locality')) {
    return 'city'
  }
  return null
}

function extractCountryContext(feature: MapboxFeature): { countryCode: string; countryName: string } | null {
  const contexts = Array.isArray(feature.context) ? feature.context : []
  const countryContext = contexts.find((context) => typeof context?.id === 'string' && context.id.startsWith('country'))

  const countryName =
    (countryContext?.text_en as string) ??
    (countryContext?.text as string) ??
    (countryContext?.place_name as string) ??
    (feature?.properties?.country as string) ??
    ''

  let countryCode =
    (countryContext?.short_code as string) ??
    (countryContext?.properties?.short_code as string) ??
    (feature?.properties?.short_code as string) ??
    ''

  if (typeof countryCode === 'string' && countryCode.includes('-')) {
    const parts = countryCode.split('-')
    countryCode = parts[parts.length - 1]
  }

  countryCode = (countryCode || '').toUpperCase()

  if (!countryCode || !countryName) {
    return null
  }

  return { countryCode, countryName }
}

function mergeSelections(
  countries: LocationSelection[],
  others: LocationSelection[]
): LocationSelection[] {
  const seen = new Set<string>()
  const ordered: LocationSelection[] = []

  const pushUnique = (selection: LocationSelection) => {
    if (seen.has(selection.id)) {
      return
    }
    seen.add(selection.id)
    ordered.push(selection)
  }

  countries.forEach((country) => pushUnique(country))
  others
    .filter((selection) => selection.kind === 'region')
    .forEach((selection) => pushUnique(selection))
  others
    .filter((selection) => selection.kind === 'city')
    .forEach((selection) => pushUnique(selection))

  return ordered
}
