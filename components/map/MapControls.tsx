'use client'

import { useState } from 'react'
import { MapPin, Info, ChevronDown, ChevronUp } from 'lucide-react'

interface MapControlsProps {
  map: any
}

export function MapControls({ map }: MapControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false)


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
              {/* Base Locations */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500 border border-white flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-2 w-2 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white">Base Locations</p>
                    <p className="text-xs text-white/50">Main cities/regions</p>
                  </div>
                </div>
              </div>

              {/* Activities */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500 border border-white flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-2 w-2 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white">Activities</p>
                    <p className="text-xs text-white/50">Day-specific destinations</p>
                  </div>
                </div>
              </div>

              {/* Clusters */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-orange-500 border border-white flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">3</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white">Clusters</p>
                    <p className="text-xs text-white/50">Grouped activities</p>
                  </div>
                </div>
              </div>

              {/* Base Routes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-shrink-0">
                    <div className="w-4 h-1 bg-green-500 rounded"></div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white">Base Routes</p>
                    <p className="text-xs text-white/50">Between cities (driving)</p>
                  </div>
                </div>
              </div>

              {/* Day Routes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-shrink-0">
                    <div className="w-4 h-1 bg-blue-500 rounded" style={{ 
                      backgroundImage: 'repeating-linear-gradient(90deg, #3b82f6, #3b82f6 1px, transparent 1px, transparent 2px)',
                      backgroundSize: '4px 1px'
                    }}></div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white">Day Routes</p>
                    <p className="text-xs text-white/50">Within cities (walking)</p>
                  </div>
                </div>
              </div>

              {/* Selection Highlight */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-green-400 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white">Selection</p>
                    <p className="text-xs text-white/50">Currently selected</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
