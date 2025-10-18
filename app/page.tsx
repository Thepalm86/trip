'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { InteractiveMap, InteractiveMapRef } from '@/components/map/InteractiveMap'
import { LeftPanel } from '@/components/left-panel/LeftPanel'
import { AuthGuard } from '@/components/auth/auth-guard'
import { TripLoader } from '@/components/trip/TripLoader'
import { ResearchCommandPalette } from '@/components/research/ResearchCommandPalette'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'

export default function HomePage() {
  const router = useRouter()
  const mapRef = useRef<InteractiveMapRef>(null)
  const [map, setMap] = useState<any>(null)
  const [leftPanelWidth, setLeftPanelWidth] = useState(60) // Percentage
  const [isResizing, setIsResizing] = useState(false)
  const animationFrameRef = useRef<number | null>(null)
  const hasLoadedTrips = useSupabaseTripStore((state) => state.hasLoadedTrips)
  const isLoadingTrips = useSupabaseTripStore((state) => state.isLoading)
  const trips = useSupabaseTripStore((state) => state.trips)

  useEffect(() => {
    if (hasLoadedTrips && !isLoadingTrips && trips.length === 0) {
      router.replace('/setup')
    }
  }, [hasLoadedTrips, isLoadingTrips, router, trips.length])

  // Get map instance after component mounts
  useEffect(() => {
    const interval = setInterval(() => {
      if (mapRef.current) {
        const mapInstance = mapRef.current.getMap()
        if (mapInstance && mapInstance.isStyleLoaded()) {
          setMap(mapInstance)
          clearInterval(interval)
        }
      }
    }, 100)

    return () => clearInterval(interval)
  }, [])

  // Handle resize functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const windowWidth = window.innerWidth
      const newLeftWidth = (e.clientX / windowWidth) * 100
      
      // Constrain between 30% and 80%
      const constrainedWidth = Math.min(Math.max(newLeftWidth, 30), 80)
      setLeftPanelWidth(constrainedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  // Trigger map resize when panel width changes (optimized to prevent blurring)
  useEffect(() => {
    if (map) {
      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      
      // Disable map interactions during resize to prevent rendering conflicts
      if (isResizing) {
        map.boxZoom.disable()
        map.scrollZoom.disable()
        map.dragPan.disable()
        map.dragRotate.disable()
        map.keyboard.disable()
        map.doubleClickZoom.disable()
        map.touchZoomRotate.disable()
      }
      
      // Use requestAnimationFrame with a small delay to let CSS transitions settle
      animationFrameRef.current = requestAnimationFrame(() => {
        // Additional small delay to prevent blurring during CSS transitions
        setTimeout(() => {
          map.resize()
          
          // Re-enable interactions after resize
          if (isResizing) {
            map.boxZoom.enable()
            map.scrollZoom.enable()
            map.dragPan.enable()
            map.dragRotate.enable()
            map.keyboard.enable()
            map.doubleClickZoom.enable()
            map.touchZoomRotate.enable()
          }
        }, isResizing ? 50 : 10) // Longer delay during active resizing
      })
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [map, leftPanelWidth, isResizing])

  const isReady = hasLoadedTrips && trips.length > 0 && !isLoadingTrips

  return (
    <AuthGuard>
      <TripLoader />
      {!isReady ? (
        <div className="flex h-screen items-center justify-center bg-gradient-dark text-white/70">
          Preparing your workspace...
        </div>
      ) : (
      <div className="h-screen bg-gradient-dark map-viewport-container page-container overflow-hidden">

        {/* Main Layout Container */}
        <div className="flex h-full max-h-full overflow-hidden">
        {/* Left Panel - Itinerary Planner */}
        <div 
          className="flex flex-col timeline-container"
          style={{ width: `${leftPanelWidth}%` }}
        >
          <div className="flex-1 overflow-hidden min-h-0">
            <LeftPanel />
          </div>
        </div>

        {/* Resize Handle */}
        <div
          className={`w-2 bg-white/5 hover:bg-white/15 transition-colors duration-200 cursor-col-resize flex items-center justify-center group ${
            isResizing ? 'bg-white/25' : ''
          }`}
          onMouseDown={handleMouseDown}
        >
          <div className="flex flex-col gap-1">
            <div className="w-0.5 h-2 bg-white/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <div className="w-0.5 h-2 bg-white/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <div className="w-0.5 h-2 bg-white/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
        </div>

        {/* Right Panel - Interactive Map */}
        <div 
          className={`border-l border-white/10 map-panel ${isResizing ? 'resizing' : ''}`}
          style={{ width: `${100 - leftPanelWidth}%` }}
        >
          <div className="relative h-full w-full">
            <div className="map-container h-full w-full">
              <InteractiveMap ref={mapRef} />
            </div>
          </div>
        </div>
      </div>
      <ResearchCommandPalette />
    </div>
      )}
    </AuthGuard>
  )
}
