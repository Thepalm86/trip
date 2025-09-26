'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { Destination } from '@/types'

interface MaybeLocationMarkersProps {
  map: mapboxgl.Map | null
  showMaybeLocations: boolean
}

export function MaybeLocationMarkers({ map, showMaybeLocations }: MaybeLocationMarkersProps) {
  const { maybeLocations, setSelectedDestination, selectedCardId, setSelectedCard } = useSupabaseTripStore()
  const markersRef = useRef<mapboxgl.Marker[]>([])

  useEffect(() => {
    if (!map || !showMaybeLocations) {
      // Remove all markers when not showing maybe locations
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = []
      return
    }

    // Remove existing markers
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    // Add markers for maybe locations
    maybeLocations.forEach((destination, index) => {
      const markerElement = document.createElement('div')
      markerElement.className = 'maybe-marker'
      markerElement.innerHTML = `
        <div class="relative">
          <!-- Outer ring -->
          <div class="absolute inset-0 w-8 h-8 bg-cyan-500 rounded-full opacity-20"></div>
          
          <!-- Main circle -->
          <div class="relative w-8 h-8 bg-cyan-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
            <div class="w-2 h-2 bg-white rounded-full"></div>
          </div>
          
          <!-- Label -->
          <div class="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-slate-800/90 text-white text-xs font-semibold rounded-lg shadow-lg border border-white/20 backdrop-blur-sm whitespace-nowrap max-w-48 truncate">
            ${destination.name}
          </div>
        </div>
      `

      const marker = new mapboxgl.Marker({
        element: markerElement,
        anchor: 'bottom'
      })
        .setLngLat(destination.coordinates)
        .addTo(map)

      // Add click handler
      const handleClick = () => {
        const cardId = `maybe-${destination.id}`
        if (selectedCardId === cardId) {
          setSelectedCard(null)
          setSelectedDestination(null)
        } else {
          setSelectedCard(cardId)
          setSelectedDestination(destination)
        }
      }

      // Add hover effects
      const handleMouseEnter = () => {
        const mainCircle = markerElement.querySelector('.relative.w-8')
        const label = markerElement.querySelector('.absolute.top-full')
        if (mainCircle) {
          mainCircle.style.transform = 'scale(1.1)'
        }
        if (label) {
          label.style.opacity = '1'
        }
      }

      const handleMouseLeave = () => {
        const mainCircle = markerElement.querySelector('.relative.w-8')
        const label = markerElement.querySelector('.absolute.top-full')
        if (mainCircle) {
          mainCircle.style.transform = 'scale(1)'
        }
        if (label) {
          label.style.opacity = '0.8'
        }
      }

      markerElement.addEventListener('click', handleClick)
      markerElement.addEventListener('mouseenter', handleMouseEnter)
      markerElement.addEventListener('mouseleave', handleMouseLeave)

      // Set initial label opacity and transition
      const label = markerElement.querySelector('.absolute.top-full')
      if (label) {
        label.style.opacity = '0.8'
        label.style.transition = 'opacity 0.2s ease'
      }
      
      // Add transition to main circle
      const mainCircle = markerElement.querySelector('.relative.w-8')
      if (mainCircle) {
        mainCircle.style.transition = 'transform 0.2s ease'
      }

      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = []
    }
  }, [map, maybeLocations, showMaybeLocations, selectedCardId, setSelectedCard, setSelectedDestination])

  return null
}
