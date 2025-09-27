'use client'

import { useState } from 'react'
import { Calendar, MapPin, Clock, Share2, Settings, Edit3, HelpCircle } from 'lucide-react'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { TabSystem } from './TabSystem'
import { DateSelector } from './DateSelector'
import { UserProfile } from '@/components/auth/user-profile'

export function LeftPanel() {
  const { currentTrip, updateTrip } = useSupabaseTripStore()
  const [showDateSelector, setShowDateSelector] = useState(false)
  const [isEditingTripName, setIsEditingTripName] = useState(false)
  const [tripName, setTripName] = useState(currentTrip?.name || '')

  if (!currentTrip) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white text-lg">Loading trip...</div>
      </div>
    )
  }

  const handleTripNameSave = async () => {
    if (tripName.trim() && tripName !== currentTrip.name) {
      await updateTrip(currentTrip.id, { name: tripName.trim() })
    }
    setIsEditingTripName(false)
  }

  const handleTripNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTripNameSave()
    } else if (e.key === 'Escape') {
      setTripName(currentTrip.name)
      setIsEditingTripName(false)
    }
  }

  const handleRestartOnboarding = () => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem('trip3:onboardingSeen:v1')
    window.dispatchEvent(new Event('trip3:start-onboarding'))
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col" data-tour="left-panel">
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between mb-6">
          <div>
            {isEditingTripName ? (
              <input
                type="text"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                onBlur={handleTripNameSave}
                onKeyDown={handleTripNameKeyDown}
                className="text-xl font-semibold text-white bg-transparent border-none outline-none focus:outline-none"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setIsEditingTripName(true)}
                className="text-xl font-semibold text-white hover:text-blue-300 transition-colors duration-200 group flex items-center gap-2"
              >
                {currentTrip.name}
                <Edit3 className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </button>
            )}
            <button
              onClick={() => setShowDateSelector(true)}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-all duration-200 group mt-2"
            >
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                {currentTrip.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {currentTrip.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {currentTrip.days.length} days
              </span>
              <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </button>
          </div>
          <div className="flex items-center gap-2" data-tour="profile">
            <button className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-all duration-200">
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleRestartOnboarding}
              className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-all duration-200"
              title="Show guided tour"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <UserProfile />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <TabSystem />
      </div>

      {/* Date Selector Modal */}
      {showDateSelector && (
        <DateSelector onClose={() => setShowDateSelector(false)} />
      )}
    </div>
  )
}
