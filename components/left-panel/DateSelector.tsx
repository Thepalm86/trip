'use client'

import { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useTripStore } from '@/lib/store/trip-store'

interface DateSelectorProps {
  onClose: () => void
}

export function DateSelector({ onClose }: DateSelectorProps) {
  const { currentTrip, updateTripDates } = useTripStore()
  const [startDate, setStartDate] = useState(currentTrip.startDate)
  const [endDate, setEndDate] = useState(currentTrip.endDate)
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    setIsLoading(true)
    try {
      updateTripDates(startDate, endDate)
      await new Promise(resolve => setTimeout(resolve, 300)) // Small delay for UX
    } catch (error) {
      console.error('Error updating trip dates:', error)
    } finally {
      setIsLoading(false)
      onClose()
    }
  }

  const calculateDays = () => {
    const timeDiff = endDate.getTime() - startDate.getTime()
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const isEndDateValid = endDate >= startDate

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Trip Dates</h3>
              <p className="text-sm text-white/60">Select your travel dates</p>
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
          {/* Start Date */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-white/80">
              Start Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate.toISOString().split('T')[0]}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-400/50 transition-all duration-200"
              />
            </div>
            <div className="text-sm text-white/60">
              {formatDate(startDate)}
            </div>
          </div>

          {/* End Date */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-white/80">
              End Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate.toISOString().split('T')[0]}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                min={startDate.toISOString().split('T')[0]}
                className={`w-full px-4 py-3 bg-white/5 border rounded-lg text-white focus:outline-none transition-all duration-200 ${
                  isEndDateValid 
                    ? 'border-white/10 focus:border-blue-400/50' 
                    : 'border-red-500/50 focus:border-red-400/50'
                }`}
              />
            </div>
            <div className="text-sm text-white/60">
              {formatDate(endDate)}
            </div>
            {!isEndDateValid && (
              <div className="text-sm text-red-400">
                End date must be after start date
              </div>
            )}
          </div>

          {/* Trip Summary */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <h4 className="text-sm font-medium text-white/80 mb-3">Trip Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Duration</span>
                <span className="text-white font-medium">{calculateDays()} days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Start</span>
                <span className="text-white font-medium">{formatDate(startDate)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">End</span>
                <span className="text-white font-medium">{formatDate(endDate)}</span>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-white/80">
              Quick Presets
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Weekend (2 days)', days: 1 },
                { label: 'Long Weekend (3 days)', days: 2 },
                { label: 'Week (7 days)', days: 6 },
                { label: 'Two Weeks (14 days)', days: 13 }
              ].map((preset, index) => (
                <button
                  key={index}
                  onClick={() => {
                    const newEndDate = new Date(startDate)
                    newEndDate.setDate(startDate.getDate() + preset.days)
                    setEndDate(newEndDate)
                  }}
                  className="p-3 text-left rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all duration-200 text-sm"
                >
                  {preset.label}
                </button>
              ))}
            </div>
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
            disabled={!isEndDateValid || isLoading}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium transition-all duration-200 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </div>
            ) : (
              'Save Dates'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
