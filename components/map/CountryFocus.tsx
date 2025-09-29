'use client'

import { useEffect, useMemo, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { getCountryBounds } from '@/lib/map/country-bounds'

interface CountryFocusProps {
  map: mapboxgl.Map | null
}

const WORLD_VIEW = {
  center: [0, 20] as [number, number],
  zoom: 1.25,
}

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

  const lastHashRef = useRef<string>('__initial__')

  useEffect(() => {
    if (!map) return

    const hash = normalizedCountries.join(',')
    if (hash === lastHashRef.current) {
      return
    }
    lastHashRef.current = hash

    if (!normalizedCountries.length) {
      map.flyTo({
        center: WORLD_VIEW.center,
        zoom: WORLD_VIEW.zoom,
        duration: 700,
      })
      return
    }

    let cancelled = false

    const focus = async () => {
      if (!token) {
        return
      }
      try {
        const boundsList = await Promise.all(
          normalizedCountries.map(code => getCountryBounds(code, token))
        )

        if (cancelled) return

        const validBounds = boundsList.filter((entry): entry is [number, number, number, number] => Array.isArray(entry))

        if (!validBounds.length) {
          map.flyTo({
            center: WORLD_VIEW.center,
            zoom: WORLD_VIEW.zoom,
            duration: 700,
          })
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
          map.fitBounds(combined, {
            padding: { top: 120, bottom: 140, left: 160, right: 160 },
            duration: 700,
            maxZoom: 6,
          })
        }
      } catch (error) {
        console.error('CountryFocus: failed to focus map', error)
      }
    }

    focus()

    return () => {
      cancelled = true
    }
  }, [map, normalizedCountries, token])

  return null
}
