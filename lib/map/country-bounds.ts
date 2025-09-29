import { getCountryMeta, setCountryMeta } from './country-cache'

const boundsCache = new Map<string, [number, number, number, number]>()
const inFlight = new Map<string, Promise<[number, number, number, number] | null>>()

function normalize(code: string): string {
  return code.trim().toUpperCase()
}

async function fetchCountryBounds(code: string, token: string): Promise<[number, number, number, number] | null> {
  const endpoint = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(code)}.json`)
  endpoint.searchParams.set('types', 'country')
  endpoint.searchParams.set('access_token', token)

  const response = await fetch(endpoint.toString())
  if (!response.ok) {
    throw new Error(`Mapbox geocoding error: ${response.status}`)
  }

  const data = await response.json()
  const feature = data?.features?.find((entry: any) => entry.place_type?.includes('country')) ?? data?.features?.[0]

  if (feature?.bbox && Array.isArray(feature.bbox) && feature.bbox.length === 4) {
    return feature.bbox as [number, number, number, number]
  }

  if (feature?.center && Array.isArray(feature.center)) {
    const [lng, lat] = feature.center
    const delta = 3
    return [lng - delta, lat - delta, lng + delta, lat + delta]
  }

  return null
}

export async function getCountryBounds(code: string, token: string): Promise<[number, number, number, number] | null> {
  if (!code) return null
  const normalized = normalize(code)

  if (boundsCache.has(normalized)) {
    return boundsCache.get(normalized) ?? null
  }

  const storedMeta = getCountryMeta(normalized)
  if (storedMeta?.bbox) {
    boundsCache.set(normalized, storedMeta.bbox)
    return storedMeta.bbox
  }

  if (!token) {
    return null
  }

  if (inFlight.has(normalized)) {
    return inFlight.get(normalized) ?? null
  }

  const request = fetchCountryBounds(normalized, token)
    .then((bbox) => {
      if (bbox) {
        boundsCache.set(normalized, bbox)
        setCountryMeta(normalized, { bbox })
      }
      inFlight.delete(normalized)
      return bbox
    })
    .catch((error) => {
      console.error('country-bounds: failed to fetch bounds', { code: normalized, error })
      inFlight.delete(normalized)
      return null
    })

  inFlight.set(normalized, request)
  return request
}

export function clearCountryBoundsCache() {
  boundsCache.clear()
  inFlight.clear()
}
