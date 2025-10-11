'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Eye, EyeOff, ChevronDown, Heart } from 'lucide-react'
import { useExploreStore } from '@/lib/store/explore-store'
import { cn } from '@/lib/utils'
import { getExploreCategoryMetadata, MarkerColors } from '@/lib/explore/categories'

interface ExploreMarkersToggleProps {
  map: any
  className?: string
  positioned?: boolean
}

type CategoryOption = {
  key: string
  label: string
  count: number
  colors: MarkerColors
  order: number
}

export function ExploreMarkersToggle({ map, className, positioned = true }: ExploreMarkersToggleProps) {
  void map;
  // Map prop is currently not needed but kept for parity with other map controls

  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const activePlaces = useExploreStore((state) => state.activePlaces)
  const showMarkers = useExploreStore((state) => state.showMarkers)
  const visibleCategories = useExploreStore((state) => state.visibleCategories)
  const setVisibleCategories = useExploreStore((state) => state.setVisibleCategories)
  const markersFilter = useExploreStore((state) => state.markersFilter)
  const setMarkersFilter = useExploreStore((state) => state.setMarkersFilter)

  const hasFavorites = useMemo(
    () => activePlaces.some((place) => place.isFavorite),
    [activePlaces]
  )

  const filteredPlaces = useMemo(
    () => (markersFilter === 'favorites'
      ? activePlaces.filter((place) => place.isFavorite)
      : activePlaces),
    [activePlaces, markersFilter]
  )

  const visibleCount = useMemo(() => {
    if (!visibleCategories) {
      return filteredPlaces.length
    }
    if (visibleCategories.length === 0) {
      return 0
    }
    const allowed = new Set(visibleCategories)
    return filteredPlaces.filter((place) => allowed.has(getExploreCategoryMetadata(place.category).key)).length
  }, [filteredPlaces, visibleCategories])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const counts = new Map<string, CategoryOption>()

    filteredPlaces.forEach((place) => {
      const metadata = getExploreCategoryMetadata(place.category)
      const key = metadata.key
      const existing = counts.get(key)

      if (existing) {
        existing.count += 1
        return
      }

      counts.set(key, {
        key,
        count: 1,
        label: metadata.label,
        colors: metadata.colors,
        order: metadata.order,
      })
    })

    return Array.from(counts.values()).sort((a, b) => {
      if (a.order === b.order) {
        return a.label.localeCompare(b.label)
      }
      return a.order - b.order
    })
  }, [filteredPlaces])

  const totalCategories = categoryOptions.length

  if (activePlaces.length === 0) {
    return null
  }

  const allCategoryKeys = categoryOptions.map((option) => option.key)
  const selectedCategories = visibleCategories === null
    ? new Set(allCategoryKeys)
    : new Set(visibleCategories)

  const hasSelection = selectedCategories.size > 0
  const isAllSelected = selectedCategories.size === allCategoryKeys.length && allCategoryKeys.length > 0

  const summaryLabel = (() => {
    if (!showMarkers) return 'Hidden'
    if (markersFilter === 'favorites') {
      if (!hasFavorites) {
        return 'Favourites (none)'
      }
      if (visibleCount === 0) {
        return 'Favourites (filtered out)'
      }
    } else if (visibleCount === 0) {
      return 'All markers (filtered out)'
    }
    if (!hasSelection || totalCategories === 0) {
      return markersFilter === 'favorites' ? 'Favourites' : 'All markers'
    }
    if (isAllSelected) {
      return markersFilter === 'favorites' ? 'Favourites · All' : 'All markers'
    }
    if (selectedCategories.size === 1) {
      const selectedKey = Array.from(selectedCategories)[0]
      const match = categoryOptions.find((option) => option.key === selectedKey)
      if (match) {
        return `${markersFilter === 'favorites' ? 'Favourites' : 'All markers'} · ${match.label}`
      }
    }
    return `${markersFilter === 'favorites' ? 'Favourites' : 'All markers'} · ${selectedCategories.size} selected`
  })()

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev)
  }

  const handleCategoryToggle = (key: string) => {
    const nextSelection = new Set(selectedCategories)

    if (nextSelection.has(key)) {
      nextSelection.delete(key)
    } else {
      nextSelection.add(key)
    }

    if (nextSelection.size === 0) {
      setVisibleCategories([])
      return
    }

    if (nextSelection.size === allCategoryKeys.length) {
      setVisibleCategories(null)
      return
    }

    setVisibleCategories(Array.from(nextSelection).sort())
  }

  const handleSelectAll = () => {
    setVisibleCategories(null)
  }

  const handleHideAll = () => {
    setVisibleCategories([])
  }

  const containerClassName = positioned
    ? cn('absolute bottom-4 left-4 z-10 ml-36', className)
    : cn('relative w-full', className)

  return (
    <div ref={containerRef} className={containerClassName}>
      <div className="relative">
        <button
          type="button"
          onClick={toggleDropdown}
          className="flex w-full min-w-[220px] items-center gap-2 rounded-lg border border-white/10 bg-slate-900/90 px-3 py-2 text-left text-white shadow-lg transition-all duration-200 hover:bg-white/5"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <MapPin className="h-4 w-4 text-cyan-400" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">Explore Markers</span>
            <span className="text-xs text-white/60">{summaryLabel}</span>
          </div>
          {showMarkers && hasSelection && visibleCount > 0 ? (
            <Eye className="ml-auto h-4 w-4 text-white/60" />
          ) : (
            <EyeOff className="ml-auto h-4 w-4 text-white/60" />
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-white/60 transition-transform duration-200',
              isOpen ? 'rotate-0' : 'rotate-180'
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-20 min-w-[240px] rounded-lg border border-white/10 bg-slate-950/95 shadow-xl backdrop-blur-sm">
            <div className="border-b border-white/10 px-3 py-2">
              <p className="mb-2 text-xs uppercase tracking-wider text-white/50">Show</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMarkersFilter('all')}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                    markersFilter === 'all'
                      ? 'border-cyan-400/80 bg-cyan-500/15 text-cyan-100'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
                  )}
                >
                  All markers
                </button>
                <button
                  type="button"
                  onClick={() => hasFavorites && setMarkersFilter('favorites')}
                  disabled={!hasFavorites}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1',
                    markersFilter === 'favorites'
                      ? 'border-amber-400/80 bg-amber-500/20 text-amber-100'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white',
                    !hasFavorites && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <Heart className="h-3.5 w-3.5" /> Favourites
                </button>
              </div>
              {!hasFavorites && (
                <p className="mt-2 text-[11px] text-white/40">
                  Mark places as favourites to filter them here.
                </p>
              )}
            </div>
            {categoryOptions.length > 0 ? (
              <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
                {categoryOptions.map((option) => {
                  const isChecked = visibleCategories === null
                    ? true
                    : selectedCategories.has(option.key)

                  return (
                    <li key={option.key}>
                      <button
                        type="button"
                        onClick={() => handleCategoryToggle(option.key)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
                        role="option"
                        aria-selected={isChecked}
                      >
                        <span
                          className="relative flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] transition-opacity"
                          style={{
                            borderColor: option.colors.border,
                            opacity: isChecked ? 1 : 0.6,
                          }}
                        >
                          {isChecked && (
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: option.colors.border }}
                            />
                          )}
                        </span>
                        <span className="flex-1 truncate">{option.label}</span>
                        <span className="text-xs text-white/40">{option.count}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-3 py-3 text-xs text-white/50">
                {markersFilter === 'favorites'
                  ? 'No favourite markers to display yet.'
                  : 'No markers available for the current filters.'}
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-xs text-white/70">
              <button
                type="button"
                onClick={handleSelectAll}
                className="transition-colors hover:text-white"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={handleHideAll}
                className="transition-colors hover:text-white"
              >
                Hide all
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
