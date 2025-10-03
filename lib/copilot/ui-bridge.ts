import { CopilotMapBounds } from '@/lib/copilot/types'

interface CoordinatePoint {
  lng: number
  lat: number
}

interface CenterMapDetail {
  coordinates: CoordinatePoint[]
  bounds?: CopilotMapBounds | null
  center?: CoordinatePoint
  zoom?: number
}

const isBrowser = () => typeof window !== 'undefined'

const dispatchCustomEvent = (name: string, detail: unknown) => {
  if (!isBrowser()) return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

const deriveBounds = (coordinates: [number, number][]): CopilotMapBounds => {
  const lngs = coordinates.map(([lng]) => lng)
  const lats = coordinates.map(([, lat]) => lat)

  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)

  const paddingLng = Math.max((maxLng - minLng) * 0.1, 0.01)
  const paddingLat = Math.max((maxLat - minLat) * 0.1, 0.01)

  return {
    north: maxLat + paddingLat,
    south: minLat - paddingLat,
    east: maxLng + paddingLng,
    west: minLng - paddingLng,
  }
}

const deriveZoomFromSpread = (coordinates: [number, number][]): number => {
  if (coordinates.length <= 1) return 13

  const lngs = coordinates.map(([lng]) => lng)
  const lats = coordinates.map(([, lat]) => lat)
  const maxDiff = Math.max(Math.max(...lngs) - Math.min(...lngs), Math.max(...lats) - Math.min(...lats))

  if (maxDiff > 2) return 6
  if (maxDiff > 1) return 7
  if (maxDiff > 0.5) return 8
  if (maxDiff > 0.2) return 9
  if (maxDiff > 0.1) return 10
  if (maxDiff > 0.05) return 11
  if (maxDiff > 0.02) return 12
  return 13
}

export const centerMapOnCoordinates = (
  coordinates: [number, number][],
  options: { bounds?: CopilotMapBounds; zoom?: number } = {},
) => {
  if (!coordinates.length) return

  const coordinateDetail: CoordinatePoint[] = coordinates.map(([lng, lat]) => ({ lng, lat }))
  const center = coordinateDetail.length === 1
    ? coordinateDetail[0]
    : {
        lng: coordinateDetail.reduce((acc, point) => acc + point.lng, 0) / coordinateDetail.length,
        lat: coordinateDetail.reduce((acc, point) => acc + point.lat, 0) / coordinateDetail.length,
      }

  const bounds = options.bounds ?? (coordinateDetail.length > 1 ? deriveBounds(coordinates) : null)
  const zoom = options.zoom ?? deriveZoomFromSpread(coordinates)

  const detail: CenterMapDetail = {
    coordinates: coordinateDetail,
    center,
    zoom,
    ...(bounds ? { bounds } : {}),
  }

  dispatchCustomEvent('centerMapOnDestinations', detail)
}

export const centerMapWithBounds = (bounds: CopilotMapBounds) => {
  const cornerCoordinates: [number, number][] = [
    [bounds.west, bounds.south],
    [bounds.east, bounds.north],
  ]
  centerMapOnCoordinates(cornerCoordinates, { bounds })
}

export const dispatchOpenModal = (modalId: string, context?: Record<string, unknown>) => {
  if (!modalId) return
  dispatchCustomEvent('copilot:openModal', {
    modalId,
    context: context ?? {},
  })
}
