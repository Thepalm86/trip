'use client'

import { useState } from 'react'
import { Calendar, MapPin, Clock, Share2, Settings, Edit3 } from 'lucide-react'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { ItineraryTab } from './ItineraryTab'
import { DateSelector } from './DateSelector'

export function LeftPanel() {
  const { currentTrip } = useSupabaseTripStore()
  const [showDateSelector, setShowDateSelector] = useState(false)

  if (!currentTrip) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white text-lg">Loading trip...</div>
      </div>
    )
  }

  const totalDestinations = currentTrip.days.reduce((acc, day) => acc + day.destinations.length, 0)
  const totalDuration = currentTrip.days.reduce((acc, day) => 
    acc + day.destinations.reduce((dayAcc, dest) => dayAcc + (dest.estimatedDuration || 2), 0), 0
  )

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`
    if (hours === Math.floor(hours)) return `${Math.floor(hours)}h`
    return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">{currentTrip.name}</h2>
            <button
              onClick={() => setShowDateSelector(true)}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-all duration-200 group"
            >
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                {currentTrip.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {currentTrip.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {currentTrip.days.length} days
              </span>
              <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-all duration-200">
              <Share2 className="h-4 w-4" />
            </button>
            <button className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-all duration-200">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-sm text-white/60">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{currentTrip.days.length} days planned</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>{totalDestinations} destinations</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{formatTime(totalDuration)} total</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ItineraryTab />
      </div>

      {/* Date Selector Modal */}
      {showDateSelector && (
        <DateSelector onClose={() => setShowDateSelector(false)} />
      )}
    </div>
  )
}
