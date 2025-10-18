'use client'

import { useEffect, useMemo, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { getCountryBounds } from '@/lib/map/country-bounds'
import { getCountryMeta } from '@/lib/map/country-cache'

interface CountryFocusProps {
  map: mapboxgl.Map | null
}

const WORLD_VIEW = {
  center: [0, 20] as [number, number],
  zoom: 1.25,
}

const MAP_FOCUS_COMPLETE_EVENT = 'trip3:map-focus-complete'

export function CountryFocus({ map }: CountryFocusProps) {
  const trip = useSupabaseTripStore((state) => state.currentTrip)

  const normalizedCountries = useMemo(() => {
    if (!trip) return [] as string[]
    const base = Array.isArray(trip.countries) && trip.countries.length > 0
      ? trip.countries
      : trip.country
        ? [trip.country]
        : []

    return Array.from(
      new Set(
        base
          .map((code) => (typeof code === 'string' ? code.trim().toUpperCase() : ''))
          .filter(Boolean)
      )
    )
  }, [trip?.countries, trip?.country])

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

  const normalizedCountriesRef = useRef<string[]>([])
  const normalizedKey = useMemo(() => normalizedCountries.join(','), [normalizedCountries])
  const focusTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    normalizedCountriesRef.current = normalizedCountries
  }, [normalizedCountries])

  useEffect(() => {
    if (!map) return

    if (focusTimeoutRef.current) {
      window.clearTimeout(focusTimeoutRef.current)
      focusTimeoutRef.current = null
    }

    const countries = normalizedCountriesRef.current

    if (!countries.length) {
      map.flyTo({
        center: WORLD_VIEW.center,
        zoom: WORLD_VIEW.zoom,
        duration: 1200,
      })
      map.once('moveend', () => {
        window.dispatchEvent(new Event(MAP_FOCUS_COMPLETE_EVENT))
      })
      return
    }

    let cancelled = false

    const zoomToBounds = (bounds: mapboxgl.LngLatBounds) => {
      map.flyTo({
        center: WORLD_VIEW.center,
        zoom: WORLD_VIEW.zoom,
        duration: 600,
      })

      focusTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return
        map.fitBounds(bounds, {
          padding: { top: 120, bottom: 140, left: 160, right: 160 },
          duration: 1400,
          maxZoom: 6,
        })
        map.once('moveend', () => {
          window.dispatchEvent(new Event(MAP_FOCUS_COMPLETE_EVENT))
        })
      }, 1000)
    }

    const focus = async () => {
      if (!token) {
        return
      }
      try {
        const cachedBounds = countries
          .map(code => getCountryMeta(code)?.bbox ?? null)
          .filter((entry): entry is [number, number, number, number] => Array.isArray(entry))

        if (cachedBounds.length) {
          const combinedCached = cachedBounds.reduce<mapboxgl.LngLatBounds | null>((acc, bbox) => {
            const [west, south, east, north] = bbox
            if (!acc) {
              return new mapboxgl.LngLatBounds([west, south], [east, north])
            }
            acc.extend([west, south])
            acc.extend([east, north])
            return acc
          }, null)

          if (combinedCached) {
            zoomToBounds(combinedCached)
          }
        }

        const boundsList = await Promise.all(
          countries.map(code => getCountryBounds(code, token))
        )

        if (cancelled) return

        const validBounds = boundsList.filter((entry): entry is [number, number, number, number] => Array.isArray(entry))

        if (!validBounds.length) {
          if (!cachedBounds.length) {
            map.flyTo({
              center: WORLD_VIEW.center,
              zoom: WORLD_VIEW.zoom,
              duration: 1200,
            })
            map.once('moveend', () => {
              window.dispatchEvent(new Event(MAP_FOCUS_COMPLETE_EVENT))
            })
          }
          return
        }

        const combined = validBounds.reduce<mapboxgl.LngLatBounds | null>((acc, bbox) => {
          const [west, south, east, north] = bbox
          if (!acc) {
            return new mapboxgl.LngLatBounds([west, south], [east, north])
          }
          acc.extend([west, south])
          acc.extend([east, north])
          return acc
        }, null)

        if (combined) {
          zoomToBounds(combined)
        }
      } catch (error) {
        console.error('CountryFocus: failed to focus map', error)
      }
    }

    focus()

    return () => {
      cancelled = true
      if (focusTimeoutRef.current) {
        window.clearTimeout(focusTimeoutRef.current)
        focusTimeoutRef.current = null
      }
    }
  }, [map, normalizedKey, token])

  return null
}
