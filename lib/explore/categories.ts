export type MarkerColors = {
  border: string
  ring: string
}

const CATEGORY_ORDER: string[] = [
  'city',
  'attraction',
  'restaurant',
  'hotel',
  'accommodation',
  'activity',
  'other',
]

const CANONICAL_CATEGORIES = new Set(CATEGORY_ORDER)

const CATEGORY_LABELS: Record<string, string> = {
  city: 'City',
  attraction: 'Attraction',
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  accommodation: 'Accommodation',
  activity: 'Activity',
  other: 'Other',
}

const CATEGORY_COLORS: Record<string, MarkerColors> = {
  city: {
    border: '#22d3ee',
    ring: 'rgba(34, 211, 238, 0.25)',
  },
  attraction: {
    border: '#3b82f6',
    ring: 'rgba(59, 130, 246, 0.25)',
  },
  restaurant: {
    border: '#f97316',
    ring: 'rgba(249, 115, 22, 0.25)',
  },
  hotel: {
    border: '#a855f7',
    ring: 'rgba(168, 85, 247, 0.25)',
  },
  accommodation: {
    border: '#a855f7',
    ring: 'rgba(168, 85, 247, 0.25)',
  },
  activity: {
    border: '#22c55e',
    ring: 'rgba(34, 197, 94, 0.25)',
  },
  other: {
    border: '#06b6d4',
    ring: 'rgba(6, 182, 212, 0.25)',
  },
}

const CATEGORY_ALIAS_MAP: Record<string, string> = {
  locality: 'city',
  place: 'city',
  town: 'city',
  village: 'city',
  neighborhood: 'city',
  hamlet: 'city',
  borough: 'city',
  district: 'city',
  province: 'city',
  suburb: 'city',
  city: 'city',
  poi: 'attraction',
  attraction: 'attraction',
  museum: 'attraction',
  landmark: 'attraction',
  gallery: 'attraction',
  monument: 'attraction',
  church: 'attraction',
  cathedral: 'attraction',
  palace: 'attraction',
  castle: 'attraction',
  theme_park: 'attraction',
  amusement_park: 'attraction',
  restaurant: 'restaurant',
  food: 'restaurant',
  cafe: 'restaurant',
  bar: 'restaurant',
  dining: 'restaurant',
  hotel: 'hotel',
  motel: 'hotel',
  inn: 'hotel',
  accommodation: 'accommodation',
  lodging: 'accommodation',
  resort: 'accommodation',
  hostel: 'accommodation',
  spa: 'activity',
  wellness: 'activity',
  activity: 'activity',
  entertainment: 'activity',
  park: 'activity',
  nature: 'activity',
  beach: 'activity',
  hiking: 'activity',
  biking: 'activity',
  skiing: 'activity',
  recreation: 'activity',
}

const DEFAULT_COLORS: MarkerColors = CATEGORY_COLORS.other

const titleCase = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')

export interface ExploreCategoryMetadata {
  key: string
  label: string
  colors: MarkerColors
  order: number
}

export function normalizeExploreCategoryKey(category?: string): string {
  if (!category) return 'other'

  const trimmed = category.trim().toLowerCase()
  if (!trimmed) return 'other'

  const alias = CATEGORY_ALIAS_MAP[trimmed]
  if (alias) return alias

  if (CANONICAL_CATEGORIES.has(trimmed)) {
    return trimmed
  }

  return trimmed
}

export function getExploreCategoryMetadata(category?: string): ExploreCategoryMetadata {
  const normalizedKey = normalizeExploreCategoryKey(category)

  const label = CATEGORY_LABELS[normalizedKey] ?? titleCase(category ?? normalizedKey)
  const colors = CATEGORY_COLORS[normalizedKey] ?? DEFAULT_COLORS

  const orderIndex = CATEGORY_ORDER.indexOf(normalizedKey)
  const order = orderIndex === -1 ? CATEGORY_ORDER.length + 1 : orderIndex

  return {
    key: normalizedKey,
    label,
    colors,
    order,
  }
}

export function getExploreCategoryLabel(category?: string): string {
  return getExploreCategoryMetadata(category).label
}

export function getExploreCategoryColors(category?: string): MarkerColors {
  return getExploreCategoryMetadata(category).colors
}
