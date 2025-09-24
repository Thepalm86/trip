'use client'

import { useState, useEffect } from 'react'
import { X, BookOpen, Save } from 'lucide-react'
import { useTripStore } from '@/lib/store/trip-store'

interface DayNotesModalProps {
  dayId: string
  onClose: () => void
}

export function DayNotesModal({ dayId, onClose }: DayNotesModalProps) {
  const { currentTrip, setDayLocation } = useTripStore()
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const day = currentTrip.days.find(d => d.id === dayId)
  const dayIndex = currentTrip.days.findIndex(d => d.id === dayId)

  // Load existing notes (in a real app, this would come from the store or API)
  useEffect(() => {
    // Mock loading existing notes
    setNotes('')
  }, [dayId])

  const handleSave = async () => {
    setIsLoading(true)
    // In a real app, this would save to the store or API
    await new Promise(resolve => setTimeout(resolve, 500))
    setIsLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Day {dayIndex + 1} Notes</h3>
              <p className="text-sm text-white/60">
                {day?.date.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Notes Editor */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-white/80">
              Notes for Day {dayIndex + 1}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your notes, ideas, and important information for this day..."
              className="w-full h-64 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400/50 resize-none transition-all duration-200"
            />
            <div className="text-xs text-white/50">
              {notes.length} characters
            </div>
          </div>

          {/* Quick Templates */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-white/80">
              Quick Templates
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                'Morning: Early start, breakfast at hotel',
                'Afternoon: Main attractions, lunch break',
                'Evening: Dinner reservation, night walk',
                'Transport: Metro/bus routes, walking times',
                'Weather: Check forecast, pack accordingly',
                'Budget: Daily spending limit, cash needed'
              ].map((template, index) => (
                <button
                  key={index}
                  onClick={() => setNotes(prev => prev + (prev ? '\n\n' : '') + template)}
                  className="p-3 text-left rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all duration-200 text-sm"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <h4 className="text-sm font-medium text-blue-400 mb-2">Tips for effective notes:</h4>
            <ul className="text-xs text-blue-300 space-y-1">
              <li>• Include specific times and locations</li>
              <li>• Note any reservations or bookings</li>
              <li>• Add contact information for important places</li>
              <li>• Include weather considerations</li>
              <li>• Note any special requirements or accessibility needs</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white font-medium transition-all duration-200 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Notes
          </button>
        </div>
      </div>
    </div>
  )
}
