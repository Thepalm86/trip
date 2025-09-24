'use client'

import { useState } from 'react'
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
  DollarSign
} from 'lucide-react'
import { useTripStore } from '@/lib/store/trip-store'
import { DayCard } from './DayCard'
import { AddDestinationModal } from './AddDestinationModal'
import { DayNotesModal } from './DayNotesModal'
import { BaseLocationPicker } from './BaseLocationPicker'

export function ItineraryTab() {
  const { currentTrip, addNewDay, selectedDayId, setSelectedDay } = useTripStore()
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [showAddDestination, setShowAddDestination] = useState(false)
  const [showDayNotes, setShowDayNotes] = useState(false)
  const [showBaseLocationPicker, setShowBaseLocationPicker] = useState(false)
  const [targetDayId, setTargetDayId] = useState<string | null>(null)

  const toggleDayExpansion = (dayId: string) => {
    const newExpanded = new Set(expandedDays)
    if (newExpanded.has(dayId)) {
      newExpanded.delete(dayId)
    } else {
      newExpanded.add(dayId)
    }
    setExpandedDays(newExpanded)
  }

  const handleAddDestination = (dayId: string) => {
    setTargetDayId(dayId)
    setShowAddDestination(true)
  }

  const handleAddNotes = (dayId: string) => {
    setTargetDayId(dayId)
    setShowDayNotes(true)
  }

  const handleSetBaseLocation = (dayId: string) => {
    setTargetDayId(dayId)
    setShowBaseLocationPicker(true)
  }

  const selectedDay = currentTrip.days.find(day => day.id === selectedDayId) || currentTrip.days[0]

  return (
    <div className="h-full flex">
      {/* Days List */}
      <div className="w-80 border-r border-white/10 bg-white/[0.02] overflow-y-auto scrollbar-hide">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/80">Timeline</h3>
            <button
              onClick={addNewDay}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all duration-200 text-sm font-medium"
            >
              <Plus className="h-3 w-3" />
              Add Day
            </button>
          </div>
          
          <div className="space-y-2">
            {currentTrip.days.map((day, index) => (
              <button
                key={day.id}
                onClick={() => setSelectedDay(day.id)}
                className={`w-full p-3 rounded-lg text-left transition-all duration-200 ${
                  selectedDayId === day.id
                    ? 'bg-blue-500/20 border border-blue-400/30'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                    selectedDayId === day.id ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/80'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm">Day {index + 1}</div>
                    <div className="text-xs text-white/60 truncate">
                      {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {day.location && ` • ${day.location.name}`}
                    </div>
                  </div>
                  <div className="text-xs text-white/60">
                    {day.destinations.length}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Day Details */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {selectedDay ? (
          <DayCard
            day={selectedDay}
            dayIndex={currentTrip.days.findIndex(d => d.id === selectedDay.id)}
            isExpanded={expandedDays.has(selectedDay.id)}
            onToggleExpansion={() => toggleDayExpansion(selectedDay.id)}
            onAddDestination={() => handleAddDestination(selectedDay.id)}
            onAddNotes={() => handleAddNotes(selectedDay.id)}
            onSetBaseLocation={() => handleSetBaseLocation(selectedDay.id)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                <Calendar className="h-8 w-8 text-white/40" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">No days yet</h3>
                <p className="text-sm text-white/60 max-w-sm mx-auto">
                  Add your first day to start planning your itinerary
                </p>
              </div>
              <button
                onClick={addNewDay}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white font-medium transition-all duration-200 hover:bg-blue-600"
              >
                <Plus className="h-4 w-4" />
                Add First Day
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddDestination && targetDayId && (
        <AddDestinationModal
          dayId={targetDayId}
          onClose={() => {
            setShowAddDestination(false)
            setTargetDayId(null)
          }}
        />
      )}

      {showDayNotes && targetDayId && (
        <DayNotesModal
          dayId={targetDayId}
          onClose={() => {
            setShowDayNotes(false)
            setTargetDayId(null)
          }}
        />
      )}

      {showBaseLocationPicker && targetDayId && (
        <BaseLocationPicker
          dayId={targetDayId}
          onClose={() => {
            setShowBaseLocationPicker(false)
            setTargetDayId(null)
          }}
        />
      )}
    </div>
  )
}
