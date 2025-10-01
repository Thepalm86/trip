'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Eye, EyeOff, ChevronDown } from 'lucide-react'
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

    activePlaces.forEach((place) => {
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
  }, [activePlaces])

  const totalCategories = categoryOptions.length

  if (activePlaces.length === 0 || totalCategories === 0) {
    return null
  }

  const selectedCategories = visibleCategories === null
    ? new Set(categoryOptions.map((option) => option.key))
    : new Set(visibleCategories)

  const hasSelection = selectedCategories.size > 0
  const isAllSelected = selectedCategories.size === totalCategories

  const summaryLabel = (() => {
    if (!showMarkers || selectedCategories.size === 0) return 'Hidden'
    if (isAllSelected) return 'All categories'
    if (selectedCategories.size === 1) {
      const selectedKey = Array.from(selectedCategories)[0]
      const match = categoryOptions.find((option) => option.key === selectedKey)
      if (match) return match.label
    }
    return `${selectedCategories.size} selected`
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

    if (nextSelection.size === totalCategories) {
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
    : cn('relative', className)

  return (
    <div ref={containerRef} className={containerClassName}>
      <div className="relative">
        <button
          type="button"
          onClick={toggleDropdown}
          className="flex min-w-[220px] items-center gap-2 rounded-lg border border-white/10 bg-slate-900/90 px-3 py-2 text-left text-white shadow-lg transition-all duration-200 hover:bg-white/5"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <MapPin className="h-4 w-4 text-cyan-400" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">Explore Markers</span>
            <span className="text-xs text-white/60">{summaryLabel}</span>
          </div>
          {showMarkers && hasSelection ? (
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
          <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-20 min-w-[220px] rounded-lg border border-white/10 bg-slate-950/95 shadow-xl backdrop-blur-sm">
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
