'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { ItineraryTab } from '@/components/left-panel/ItineraryTab'
import { TripHeader } from '@/components/left-panel/TripHeader'

const COLLAPSE_STORAGE_KEY = 'trip3:itinerary:panel-collapsed'
const COLLAPSE_PEEK_WIDTH = 84

export function ItineraryOverlay() {
  const currentTrip = useSupabaseTripStore((state) => state.currentTrip)

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1'
    } catch (error) {
      console.warn('ItineraryOverlay: failed to read collapse preference', error)
      return false
    }
  })

  const [isPeeking, setIsPeeking] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      if (isCollapsed) {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, '1')
      } else {
        window.localStorage.removeItem(COLLAPSE_STORAGE_KEY)
      }
    } catch (error) {
      console.warn('ItineraryOverlay: failed to persist collapse preference', error)
    }
  }, [isCollapsed])

  const handleToggleCollapse = useCallback(() => {
    setIsPeeking(false)
    setIsCollapsed((previous) => !previous)
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (isCollapsed) {
      setIsPeeking(true)
    }
  }, [isCollapsed])

  const handleMouseLeave = useCallback(() => {
    if (isCollapsed) {
      setIsPeeking(false)
    }
  }, [isCollapsed])

  const isCompact = isCollapsed && !isPeeking

  const translateStyle = useMemo(() => {
    if (!isCompact) {
      return 'translateX(0)'
    }

    return `translateX(calc(-100% + ${COLLAPSE_PEEK_WIDTH}px))`
  }, [isCompact])

  if (!currentTrip) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-y-6 left-4 z-[55] flex max-h-[calc(100vh-3rem)]">
      <div
        className="pointer-events-auto relative flex h-full w-[min(980px,calc(100vw-5rem))] flex-col gap-4 transition-transform duration-300 ease-in-out"
        style={{ transform: translateStyle }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <TripHeader className={clsx('transition-opacity duration-200', isCompact ? 'pointer-events-none opacity-0' : 'opacity-100')} />
        <div
          className={clsx(
            'relative flex-1 overflow-hidden rounded-[32px] border border-white/12 bg-slate-950/80 shadow-[0_45px_120px_-40px_rgba(8,15,35,0.95)] backdrop-blur-2xl transition-opacity duration-200',
            isCompact ? 'pointer-events-none opacity-0' : 'opacity-100'
          )}
        >
          <ItineraryTab />
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-end pr-2">
          <button
            type="button"
            onClick={handleToggleCollapse}
            className={clsx(
              'pointer-events-auto inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-slate-950/90 text-xs font-medium text-white/80 shadow-[0_20px_40px_-20px_rgba(8,15,35,0.9)] backdrop-blur transition hover:border-white/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50',
              isCompact ? 'h-12 w-12' : 'px-4 py-2'
            )}
            aria-label={isCompact ? 'Expand itinerary editor' : 'Collapse itinerary editor'}
            aria-expanded={!isCompact}
          >
            {isCompact ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden text-sm md:inline">Hide itinerary</span>
                <span className="md:hidden">Hide</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
