export type AddressComponent = {
  long_name: string
  short_name: string
  types: string[]
}

const CITY_TYPE_PRIORITY_GROUPS: string[][] = [
  ['locality'],
  ['postal_town'],
  ['administrative_area_level_3'],
  ['sublocality_level_1'],
  ['sublocality'],
  ['colloquial_area'],
  ['administrative_area_level_2'],
  ['administrative_area_level_1'],
]

const CITY_PREFIX_PATTERNS: RegExp[] = [
  /^metropolitan city of\s+/i,
  /^città metropolitana di\s+/i,
  /^province of\s+/i,
  /^provincia di\s+/i,
  /^municipality of\s+/i,
  /^comune di\s+/i,
  /^city of\s+/i,
]

const CITY_SUFFIX_PATTERNS: RegExp[] = [
  /\s+capital$/i,
  /\s+province$/i,
  /\s+district$/i,
  /\s+[A-Z]{2}$/,
]

const CITY_NAME_OVERRIDES: Record<string, string> = {
  roma: 'Rome',
  milano: 'Milan',
  firenze: 'Florence',
  torino: 'Turin',
  venezia: 'Venice',
  napoli: 'Naples',
  genova: 'Genoa',
  bologna: 'Bologna',
  livorno: 'Livorno',
  brescia: 'Brescia',
}

const INVALID_PATTERNS: RegExp[] = [
  /^\d+$/,
  /^rm$/i,
]

function applyOverrides(name: string): string {
  const normalized = name.toLowerCase()
  return CITY_NAME_OVERRIDES[normalized] ?? name
}

function stripPrefixesAndSuffixes(name: string): string {
  let result = name.trim()
  CITY_PREFIX_PATTERNS.forEach((pattern) => {
    result = result.replace(pattern, '')
  })
  CITY_SUFFIX_PATTERNS.forEach((pattern) => {
    result = result.replace(pattern, '')
  })
  result = result.replace(/^\d+\s*/, '')
  result = result.replace(/\s*\(.*?\)\s*$/, '')
  return applyOverrides(result.trim())
}

function isValidCityCandidate(name: string): boolean {
  if (!name) return false
  if (name.length < 3) return false
  if (!/[a-zA-Z]/.test(name)) return false
  if (/metropolitan city/i.test(name)) return false
  if (/province/i.test(name) && !/province of paris/i.test(name)) return false
  return !INVALID_PATTERNS.some((pattern) => pattern.test(name))
}

function normalizeCityCandidate(
  primary?: string | null,
  secondary?: string | null
): string | null {
  const primaryClean = primary ? stripPrefixesAndSuffixes(primary) : ''
  if (isValidCityCandidate(primaryClean)) {
    return primaryClean
  }

  const secondaryClean = secondary ? stripPrefixesAndSuffixes(secondary) : ''
  if (isValidCityCandidate(secondaryClean)) {
    return secondaryClean
  }

  return null
}

export function extractCityFromComponents(components: AddressComponent[]): string | null {
  for (const typesGroup of CITY_TYPE_PRIORITY_GROUPS) {
    const component = components.find((candidate) =>
      typesGroup.some((type) => candidate.types.includes(type))
    )

    if (component) {
      const normalized = normalizeCityCandidate(component.long_name, component.short_name)
      if (normalized) {
        return normalized
      }
    }
  }

  for (const component of components) {
    const normalized = normalizeCityCandidate(component.long_name, component.short_name)
    if (normalized) {
      return normalized
    }
  }

  return null
}

export function fallbackCityFromFullName(fullName: string | null | undefined): string {
  if (!fullName) return 'Unknown'

  const parts = fullName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  for (let i = parts.length - 2; i >= 0; i--) {
    const normalized = normalizeCityCandidate(parts[i])
    if (normalized) {
      return normalized
    }
  }

  if (parts.length > 0) {
    const firstNormalized = normalizeCityCandidate(parts[0])
    if (firstNormalized) {
      return firstNormalized
    }
  }

  return 'Unknown'
}

export async function resolveCityFromPlace(
  placeId: string | undefined,
  fallbackSource: string | null | undefined
): Promise<string> {
  const fallbackCity = fallbackCityFromFullName(fallbackSource)

  if (!placeId) {
    return fallbackCity
  }

  try {
    const response = await fetch(`/api/explore/details?placeId=${encodeURIComponent(placeId)}`)
    if (!response.ok) {
      console.warn('resolveCityFromPlace: Place details fetch failed', { placeId, status: response.status })
      return fallbackCity
    }

    const data = await response.json()
    if (data?.city && typeof data.city === 'string') {
      const normalized = normalizeCityCandidate(data.city)
      if (normalized) {
        return normalized
      }
    }
  } catch (error) {
    console.error('resolveCityFromPlace: Error fetching place details', { placeId, error })
  }

  return fallbackCity
}
