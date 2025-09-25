'use client'

import { useState } from 'react'
import { Info, ChevronUp, ChevronDown } from 'lucide-react'

interface RouteSegment {
  color: string
  name: string
  distance: string
  duration: string
}

interface RouteLegendProps {
  segments: RouteSegment[]
}

export function RouteLegend({ segments }: RouteLegendProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!segments || segments.length === 0) {
    return null
  }

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <div className="glass-card rounded-lg overflow-hidden">
        {/* Legend Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors duration-200"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-white/80" />
            <span className="text-sm font-medium text-white">Route Legend</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-white/60" />
          ) : (
            <ChevronUp className="h-4 w-4 text-white/60" />
          )}
        </button>

        {/* Legend Content */}
        {isExpanded && (
          <div className="border-t border-white/10">
            <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
              {segments.map((segment, index) => (
                <div key={index} className="flex items-center gap-3 text-xs">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: segment.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">
                      {segment.name}
                    </div>
                    <div className="text-white/60 text-xs">
                      {segment.distance} • {segment.duration}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
