'use client'

import { useMemo, useState } from 'react'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'
import { CATEGORY_ORDER, getExploreCategoryMetadata, ExploreCategoryMetadata } from '@/lib/explore/categories'

interface MapControlsProps {
  map: any
}

export function MapControls({ map }: MapControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const categories: ExploreCategoryMetadata[] = useMemo(() => {
    return CATEGORY_ORDER.filter((key) => key !== 'hotel').map((key) => getExploreCategoryMetadata(key))
  }, [])

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <div className="bg-slate-900/90 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg overflow-hidden">
        {/* Legend Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-white/5 transition-all duration-200"
        >
          <Info className="h-4 w-4 text-white/60" />
          <span className="text-sm font-medium text-white">Legend</span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-white/60 ml-auto" />
          ) : (
            <ChevronUp className="h-4 w-4 text-white/60 ml-auto" />
          )}
        </button>

        {/* Legend Content */}
        {isExpanded && (
          <div className="px-3 pb-3 border-t border-white/10">
            <div className="space-y-3 pt-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Marker categories</p>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div key={category.key} className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded-full border border-white/20"
                        style={{ backgroundColor: category.colors.border }}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white">{category.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10">
                <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Marker styles</p>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-white">Outlined dots = Explore anywhere</p>
                  <p className="text-xs font-medium text-white">Filled dots = Itinerary destinations</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
