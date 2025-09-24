'use client'

import { useEffect, useRef } from 'react'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'
import mapboxgl from 'mapbox-gl'
import { Search, MapPin } from 'lucide-react'
import { Destination } from '@/types'
import { useTripStore } from '@/lib/store/trip-store'

interface MapboxGeocoderComponentProps {
  map: mapboxgl.Map | null
  onResultSelect?: (result: any) => void
}

export function MapboxGeocoderComponent({ map, onResultSelect }: MapboxGeocoderComponentProps) {
  const geocoderContainer = useRef<HTMLDivElement>(null)
  const geocoderRef = useRef<MapboxGeocoder | null>(null)
  const { addDestinationToDay, currentTrip } = useTripStore()

  useEffect(() => {
    if (!map || !geocoderContainer.current || geocoderRef.current) return

    // Get Mapbox token from environment variables
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!mapboxToken) {
      console.error('Mapbox token not found for geocoder.')
      return
    }

    // Configure Mapbox Geocoder
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxToken,
      mapboxgl: mapboxgl,
      marker: false, // We'll handle markers ourselves
      placeholder: 'Search for destinations...',
      countries: 'IT', // Limit to Italy as per env config
      types: 'poi,place,address', // Points of interest, places, addresses
      proximity: {
        longitude: 12.4964,
        latitude: 41.9028
      } as [number, number], // Rome coordinates for proximity bias
      flyTo: {
        zoom: 15,
        speed: 1.5
      }
    })

    geocoderRef.current = geocoder

    // Add geocoder to container
    geocoderContainer.current.appendChild(geocoder.onAdd(map))

    // Handle result selection
    geocoder.on('result', (event) => {
      const result = event.result
      
      // Create destination object from geocoder result
      const destination: Destination = {
        id: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: result.place_name.split(',')[0], // Get the main place name
        description: result.place_name,
        coordinates: result.center as [number, number],
        category: getDestinationCategory(result.properties?.category || result.place_type?.[0]),
        rating: undefined,
        estimatedDuration: getEstimatedDuration(result.properties?.category || result.place_type?.[0])
      }

      // Add marker to map
      if (map) {
        addSearchMarker(map, destination)
      }

      // Call optional callback
      if (onResultSelect) {
        onResultSelect({ result, destination })
      }
    })

    // Handle clear
    geocoder.on('clear', () => {
      // Remove all search markers
      const markers = document.querySelectorAll('.search-marker')
      markers.forEach(marker => marker.remove())
    })

    return () => {
      if (geocoderRef.current) {
        geocoderRef.current.onRemove()
        geocoderRef.current = null
      }
    }
  }, [map, onResultSelect, addDestinationToDay, currentTrip])

  const getDestinationCategory = (category?: string): Destination['category'] => {
    if (!category) return 'attraction'
    
    if (category.includes('restaurant') || category.includes('food')) return 'restaurant'
    if (category.includes('hotel') || category.includes('accommodation')) return 'hotel'
    if (category.includes('activity') || category.includes('entertainment')) return 'activity'
    return 'attraction'
  }

  const getEstimatedDuration = (category?: string): number => {
    if (!category) return 2
    
    if (category.includes('restaurant')) return 1.5
    if (category.includes('hotel')) return 0.5
    if (category.includes('museum') || category.includes('gallery')) return 3
    if (category.includes('church') || category.includes('religious')) return 1
    return 2
  }

  const addSearchMarker = (map: mapboxgl.Map, destination: Destination) => {
    // Create marker element
    const markerElement = document.createElement('div')
    markerElement.className = 'search-marker marker-container'
    markerElement.innerHTML = `
      <div class="bg-primary/90 border-2 border-white/50 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform duration-200">
        <div class="w-3 h-3 bg-white rounded-full"></div>
      </div>
    `

    // Add click event to marker for adding to timeline
    markerElement.addEventListener('click', () => {
      showDestinationPopup(map, destination, markerElement)
    })

    // Add marker to map
    new mapboxgl.Marker(markerElement)
      .setLngLat(destination.coordinates)
      .addTo(map)
  }

  const showDestinationPopup = (map: mapboxgl.Map, destination: Destination, markerElement: HTMLElement) => {
    // Create popup HTML with dynamic day options
    const dayOptions = currentTrip.days.map((day, index) => 
      `<option value="${day.id}">Day ${index + 1} (${new Date(day.date).toLocaleDateString()})</option>`
    ).join('')
    
    // Create and show popup
    const popup = new mapboxgl.Popup({
      offset: 25,
      closeButton: true,
      closeOnClick: false,
      className: 'destination-popup'
    }).setHTML(`
      <div class="destination-popup-container p-4 max-w-sm">
        <h3 class="font-display font-semibold text-white text-lg mb-2">${destination.name}</h3>
        <p class="text-white/80 text-sm mb-3">${destination.description}</p>
        <div class="flex items-center justify-between text-xs text-white/60 mb-4">
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
            ${destination.category}
          </span>
          ${destination.estimatedDuration ? `
          <span class="flex items-center gap-1">
            🕐 ${destination.estimatedDuration}h
          </span>
          ` : ''}
        </div>
        <div class="mb-3">
          <label class="block text-white/60 text-xs mb-2">Add to day:</label>
          <select 
            id="day-select-${destination.id}" 
            class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none"
          >
            ${dayOptions}
          </select>
        </div>
        <button 
          class="w-full bg-primary hover:bg-primary/80 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-gray-900 outline-none"
          onclick="addSearchResultToTimeline('${destination.id}', '${encodeURIComponent(JSON.stringify(destination))}')"
        >
          Add to Timeline
        </button>
      </div>
    `)

    new mapboxgl.Marker({ element: markerElement })
      .setLngLat(destination.coordinates)
      .setPopup(popup)
      .addTo(map)
      .togglePopup()
  }

  // Global function for popup button integration
  useEffect(() => {
    (window as any).addSearchResultToTimeline = (destinationId: string, destinationData: string) => {
      try {
        const destination: Destination = JSON.parse(decodeURIComponent(destinationData))
        
        // Get selected day from dropdown
        const selectElement = document.getElementById(`day-select-${destinationId}`) as HTMLSelectElement
        const selectedDayId = selectElement ? selectElement.value : currentTrip.days[0]?.id
        
        if (selectedDayId) {
          addDestinationToDay(destination, selectedDayId)
          
          // Close all popups
          const popups = document.querySelectorAll('.mapboxgl-popup')
          popups.forEach(popup => popup.remove())
          
          console.log(`Added ${destination.name} to timeline`)
        }
      } catch (error) {
        console.error('Error adding search result to timeline:', error)
      }
    }

    return () => {
      delete (window as any).addSearchResultToTimeline
    }
  }, [currentTrip, addDestinationToDay])

  return (
    <div className="search-container">
      {/* Search Icon and Label */}
      <div className="flex items-center gap-2 mb-3">
        <Search className="h-4 w-4 text-primary" />
        <span className="text-white/80 text-sm font-display font-semibold">Search Destinations</span>
      </div>
      
      {/* Geocoder Container */}
      <div 
        ref={geocoderContainer} 
        className="geocoder-container"
      />
      
      {/* Search Tips */}
      <div className="mt-3 text-white/50 text-xs">
        <p className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          Try searching for restaurants, museums, or attractions in Italy
        </p>
      </div>
    </div>
  )
}