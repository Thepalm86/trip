const cache = new Map<string, CountrySearchResult[]>()
const controllers = new Map<string, AbortController>()

export interface CountrySearchResult {
  code: string
  name: string
  center?: [number, number]
  bbox?: [number, number, number, number]
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

export async function searchCountries(query: string, token: string, limit = 10): Promise<CountrySearchResult[]> {
  const normalizedQuery = normalizeQuery(query)
  if (!normalizedQuery) {
    return []
  }

  if (!token) {
    return []
  }

  if (cache.has(normalizedQuery)) {
    return cache.get(normalizedQuery) ?? []
  }

  const previous = controllers.get(normalizedQuery)
  previous?.abort()

  const controller = new AbortController()
  controllers.set(normalizedQuery, controller)

  const endpoint = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalizedQuery)}.json`)
  endpoint.searchParams.set('types', 'country')
  endpoint.searchParams.set('language', 'en')
  endpoint.searchParams.set('limit', String(limit))
  endpoint.searchParams.set('access_token', token)

  try {
    const response = await fetch(endpoint.toString(), { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Mapbox geocoding error: ${response.status}`)
    }

    const data = await response.json()
    const features = (Array.isArray(data?.features) ? data.features : []) as any[]

    const results: CountrySearchResult[] = features.map((feature) => {
      const shortCode = feature?.properties?.short_code ?? feature?.properties?.wikidata ?? ''
      const code = typeof shortCode === 'string' && shortCode.length >= 2
        ? normalizeCode(shortCode.slice(-2))
        : ''
      const nameCandidate = feature?.text_en ?? feature?.text ?? feature?.place_name
      const name = typeof nameCandidate === 'string' ? nameCandidate : ''
      const center = Array.isArray(feature?.center) && feature.center.length === 2
        ? [Number(feature.center[0]), Number(feature.center[1])] as [number, number]
        : undefined
      const bbox = Array.isArray(feature?.bbox) && feature.bbox.length === 4
        ? feature.bbox.map((value: unknown) => Number(value)) as [number, number, number, number]
        : undefined

      return {
        code,
        name,
        center,
        bbox,
      }
    })
      .filter(entry => entry.code && entry.name)

    cache.set(normalizedQuery, results)
    controllers.delete(normalizedQuery)
    return results
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      return []
    }
    console.error('country-search: failed to search countries', { query: normalizedQuery, error })
    controllers.delete(normalizedQuery)
    return []
  }
}

export function clearCountrySearchCache() {
  cache.clear()
  controllers.forEach(controller => controller.abort())
  controllers.clear()
}
