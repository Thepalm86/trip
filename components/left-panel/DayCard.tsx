'use client'

import { 
  MapPin, 
  Clock, 
  Star, 
  Plus, 
  Edit3, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  BookOpen,
  Navigation,
  DollarSign,
  Calendar,
  Map,
  MoreVertical,
  Copy,
  X
} from 'lucide-react'
import { TimelineDay } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { useState, useRef, useEffect } from 'react'

interface DayCardProps {
  day: TimelineDay
  dayIndex: number
  isExpanded: boolean
  onToggleExpansion: () => void
  onAddDestination: () => void
  onAddNotes: () => void
  onSetBaseLocation: () => void
}

export function DayCard({ 
  day, 
  dayIndex, 
  isExpanded, 
  onToggleExpansion, 
  onAddDestination, 
  onAddNotes,
  onSetBaseLocation
}: DayCardProps) {
  const { removeDestinationFromDay, duplicateDay, removeDay } = useSupabaseTripStore()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const totalDuration = day.destinations.reduce((acc, dest) => acc + (dest.estimatedDuration || 2), 0)
  const totalCost = day.destinations.reduce((acc, dest) => acc + (dest.cost || 0), 0)
  const averageRating = day.destinations.length > 0 
    ? day.destinations.reduce((acc, dest) => acc + (dest.rating || 0), 0) / day.destinations.length 
    : 0

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`
    if (hours === Math.floor(hours)) return `${Math.floor(hours)}h`
    return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`
  }

  const handleRemoveDestination = (destinationId: string) => {
    removeDestinationFromDay(destinationId, day.id)
  }

  const handleDuplicateDay = () => {
    duplicateDay(day.id)
    setShowDropdown(false)
  }

  const handleRemoveDay = () => {
    removeDay(day.id)
    setShowDropdown(false)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="h-full flex flex-col bg-white/[0.02] rounded-2xl border border-white/10 overflow-hidden">
      {/* Day Header - Compact */}
      <div className="p-4 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">
              {dayIndex + 1}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Day {dayIndex + 1}</h3>
              <p className="text-xs text-white/60">
                {day.date.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleExpansion}
              className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            
            {/* Day Actions Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              
              {showDropdown && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={handleDuplicateDay}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors duration-200"
                  >
                    <Copy className="h-4 w-4 text-blue-400" />
                    <span>Duplicate Day</span>
                  </button>
                  
                  <button
                    onClick={handleRemoveDay}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-red-500/20 hover:text-red-400 transition-colors duration-200"
                  >
                    <X className="h-4 w-4 text-red-400" />
                    <span>Remove Day</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Base Location Section - Prominent */}
      <div className="p-4 border-b border-white/10 bg-gradient-to-r from-green-500/5 to-blue-500/5">
        {day.location ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Map className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-white/60 uppercase tracking-wide">Base Location</p>
                <p className="text-sm font-semibold text-green-400">{day.location.name}</p>
                {day.location.context && (
                  <p className="text-xs text-white/50">{day.location.context}</p>
                )}
              </div>
            </div>
            <button
              onClick={onSetBaseLocation}
              className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-all duration-200"
            >
              <Edit3 className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={onSetBaseLocation}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-white/20 hover:border-green-400/50 hover:bg-green-500/5 transition-all duration-200"
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Map className="h-4 w-4 text-white/40" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Set Base Location</p>
              <p className="text-xs text-white/60">Choose the main city or region</p>
            </div>
          </button>
        )}
      </div>


      {/* Action Buttons */}
      <div className="p-4 border-b border-white/10">
        <div className="flex gap-2">
          <button
            onClick={onAddDestination}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500 text-white font-medium transition-all duration-200 hover:bg-blue-600 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Activity
          </button>
          <button
            onClick={onAddNotes}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-medium transition-all duration-200 hover:bg-white/10 text-sm"
          >
            <BookOpen className="h-4 w-4" />
            Add Notes
          </button>
        </div>
      </div>

      {/* Activities Section - Clear Separation */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Section Header */}
          <div className="p-4 border-b border-white/10 bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <MapPin className="h-3 w-3 text-blue-400" />
                </div>
                <h4 className="text-sm font-semibold text-white/80">Activities & Destinations</h4>
                {day.location && (
                  <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded-full">
                    in {day.location.name}
                  </span>
                )}
              </div>
              <div className="text-xs text-white/50">
                {day.destinations.length} {day.destinations.length === 1 ? 'activity' : 'activities'}
              </div>
            </div>
          </div>

          {/* Activities List */}
          <div className="p-4 space-y-3">
            {day.destinations.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-8 w-8 text-white/30" />
                </div>
                <h4 className="text-sm font-medium text-white/60 mb-2">No activities yet</h4>
                <p className="text-xs text-white/40 mb-4">
                  {day.location 
                    ? `Add places to visit in ${day.location.name}` 
                    : 'Set a base location first, then add activities'
                  }
                </p>
                <button
                  onClick={onAddDestination}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all duration-200"
                >
                  <Plus className="h-4 w-4" />
                  Add First Activity
                </button>
              </div>
            ) : (
              day.destinations.map((destination, index) => (
                <div
                  key={destination.id}
                  className="group relative p-4 rounded-xl border border-white/10 bg-white/[0.02] transition-all duration-200 hover:border-white/20 hover:bg-white/[0.05]"
                >
                  {/* Activity Number */}
                  <div className="absolute -left-2 -top-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
                    {index + 1}
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-blue-400" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-white text-sm mb-1">
                            {destination.name}
                          </h4>
                          {destination.description && (
                            <p className="text-xs text-white/60 leading-relaxed">
                              {destination.description}
                            </p>
                          )}
                        </div>
                        
                        {destination.rating && (
                          <div className="flex items-center gap-1 ml-2">
                            <Star className="h-3 w-3 text-yellow-400 fill-current" />
                            <span className="text-xs text-white/60 font-medium">{destination.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-white/50">
                        {destination.estimatedDuration && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatTime(destination.estimatedDuration)}</span>
                          </div>
                        )}
                        {destination.cost && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            <span>€{destination.cost}</span>
                          </div>
                        )}
                        {destination.category && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase">
                            {destination.category}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleRemoveDestination(destination.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 flex-shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
