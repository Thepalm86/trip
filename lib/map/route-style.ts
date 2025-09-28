const DESTINATION_ROUTE_COLORS = [
  '#60a5fa', // sky blue
  '#f97316', // orange
  '#a855f7', // purple
  '#facc15', // amber
  '#22d3ee', // cyan
  '#f472b6', // pink
  '#34d399', // emerald
  '#ef4444', // red
]

export const BASE_ROUTE_COLOR = '#10b981'

export function getDestinationColor(index: number): string {
  if (index < 0) {
    return DESTINATION_ROUTE_COLORS[0]
  }

  return DESTINATION_ROUTE_COLORS[index % DESTINATION_ROUTE_COLORS.length]
}

export function getWaypointKey(
  locationId?: string | null,
  coordinates?: [number, number]
): string {
  if (locationId && locationId.length > 0) {
    return locationId
  }

  if (!coordinates) {
    return 'unknown'
  }

  return `${coordinates[0]},${coordinates[1]}`
}

export function buildIntraSequenceKey(
  dayId: string,
  sequenceIndex: number,
  fromKey: string,
  toKey: string
): string {
  return `intra-${dayId}-sequence-${sequenceIndex}-${fromKey}-${toKey}`
}

export function buildIntraFinalKey(
  dayId: string,
  fromKey: string,
  toKey: string
): string {
  return `intra-${dayId}-final-${fromKey}-${toKey}`
}

export function buildInterDayKey(fromDayId: string, toDayId: string): string {
  return `inter-${fromDayId}-${toDayId}`
}

export function getRouteColorForWaypoint(
  waypoint: {
    type: 'base' | 'destination'
    listIndex?: number
  }
): string {
  if (waypoint.type === 'base') {
    return BASE_ROUTE_COLOR
  }

  const index = typeof waypoint.listIndex === 'number' ? waypoint.listIndex : 0
  return getDestinationColor(index)
}
