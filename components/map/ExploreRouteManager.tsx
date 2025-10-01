'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Feature, FeatureCollection, LineString } from 'geojson'
import { useExploreStore } from '@/lib/store/explore-store'

const EMPTY_GEOJSON: FeatureCollection<LineString> = {
  type: 'FeatureCollection',
  features: [],
}

type RouteStatus = 'idle' | 'loading' | 'ready' | 'error'

interface RouteSummary {
  distance: number
  duration: number
}

interface ExploreRouteManagerProps {
  map: mapboxgl.Map | null
}

function formatDistance(meters: number) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (remainingMinutes === 0) {
    return `${hours} hr`
  }
  return `${hours} hr ${remainingMinutes} min`
}

export function ExploreRouteManager({ map }: ExploreRouteManagerProps) {
  const routeSelection = useExploreStore((state) => state.routeSelection)
  const clearRouteSelection = useExploreStore((state) => state.clearRouteSelection)
  const [status, setStatus] = useState<RouteStatus>('idle')
  const [summary, setSummary] = useState<RouteSummary | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const start = routeSelection.start
  const end = routeSelection.end

  useEffect(() => {
    if (!map) {
      return
    }

    const source = map.getSource('explore-route') as mapboxgl.GeoJSONSource | undefined
    if (!source) {
      return
    }

    abortRef.current?.abort()
    abortRef.current = null

    if (!start || !end) {
      source.setData(EMPTY_GEOJSON)
      setSummary(null)
      setStatus('idle')
      return
    }

    if (
      start.coordinates[0] === end.coordinates[0] &&
      start.coordinates[1] === end.coordinates[1]
    ) {
      source.setData(EMPTY_GEOJSON)
      setSummary(null)
      setStatus('error')
      console.warn('ExploreRouteManager: identical coordinates selected for start and end')
      return
    }

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) {
      console.error('ExploreRouteManager: Missing Mapbox token')
      source.setData(EMPTY_GEOJSON)
      setSummary(null)
      setStatus('error')
      return
    }

    const coordinates = [start.coordinates, end.coordinates]

    const placeholderFeature: Feature<LineString> = {
      type: 'Feature',
      properties: {
        state: 'loading',
        lineColor: '#38bdf8',
      },
      geometry: {
        type: 'LineString',
        coordinates,
      },
    }

    source.setData({
      type: 'FeatureCollection',
      features: [placeholderFeature],
    })
    setSummary(null)
    setStatus('loading')

    const controller = new AbortController()
    abortRef.current = controller

    const requestUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates
      .map((coord) => `${coord[0]},${coord[1]}`)
      .join(';')}?access_token=${token}&geometries=geojson&overview=full`

    const fetchRoute = async () => {
      try {
        const response = await fetch(requestUrl, { signal: controller.signal })

        if (!response.ok) {
          throw new Error(`Directions request failed with status ${response.status}`)
        }

        const data = await response.json()
        const route = data.routes?.[0]

        if (!route || !route.geometry) {
          throw new Error('Directions response contained no route geometry')
        }

        const feature: Feature<LineString> = {
          type: 'Feature',
          properties: {
            state: 'ready',
            lineColor: '#38bdf8',
            distance: route.distance,
            duration: route.duration,
            startName: start.name,
            endName: end.name,
          },
          geometry: route.geometry,
        }

        source.setData({
          type: 'FeatureCollection',
          features: [feature],
        })

        setSummary({ distance: route.distance, duration: route.duration })
        setStatus('ready')
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        console.error('ExploreRouteManager: Error fetching route', error)
        source.setData(EMPTY_GEOJSON)
        setSummary(null)
        setStatus('error')
      }
    }

    fetchRoute()

    return () => {
      controller.abort()
      abortRef.current = null
    }
  }, [map, start, end])

  const overlayContent = useMemo(() => {
    if (!start || !end) {
      return null
    }

    if (status === 'loading') {
      return 'Calculating route…'
    }

    if (status === 'error') {
      return 'Unable to calculate route'
    }

    if (status === 'ready' && summary) {
      return `${formatDistance(summary.distance)} • ${formatDuration(summary.duration)}`
    }

    return null
  }, [start, end, status, summary])

  if (!start || !end) {
    return null
  }

  return (
    <div className="pointer-events-none absolute top-24 left-1/2 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/85 px-4 py-3 text-white shadow-xl backdrop-blur-xl">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-white/40">Explore route</div>
          <div className="text-sm font-medium text-white/90">
            {start.name} <span className="text-white/40">→</span> {end.name}
          </div>
          {overlayContent && (
            <div className="text-xs text-white/60">{overlayContent}</div>
          )}
        </div>
        <button
          onClick={(event) => {
            event.stopPropagation()
            clearRouteSelection()
          }}
          className="rounded-xl border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/20"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
