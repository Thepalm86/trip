'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, MapPin, Building2, Loader2 } from 'lucide-react'
import { ExplorePlace } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { useExploreStore } from '@/lib/store/explore-store'
import { resolveCityFromPlace } from '@/lib/location/city'

interface AddExplorePlaceModalProps {
  place: ExplorePlace
  mode: 'destination' | 'base'
  onClose: () => void
  onComplete: () => void
}

export function AddExplorePlaceModal({ place, mode, onClose, onComplete }: AddExplorePlaceModalProps) {
  const {
    currentTrip,
    addDestinationToDay,
    addBaseLocation,
  } = useSupabaseTripStore()
  const removeActivePlace = useExploreStore((state) => state.removeActivePlace)

  const defaultDayId = currentTrip?.days[0]?.id ?? ''
  const [selectedDayId, setSelectedDayId] = useState(defaultDayId)
  const [isSaving, setIsSaving] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!selectedDayId && currentTrip?.days?.length) {
      setSelectedDayId(currentTrip.days[0].id)
    }
  }, [currentTrip?.days, selectedDayId])

  const modalTitle = mode === 'destination' ? 'Add as Activity' : 'Set as Accommodation'

  const dayOptions = useMemo(() => currentTrip?.days ?? [], [currentTrip?.days])

  const formatDate = (value: Date) => {
    try {
      return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return ''
    }
  }

  const handleConfirm = async () => {
    if (!currentTrip || !selectedDayId) return
    setIsSaving(true)

    try {
      const placeId = place.metadata?.place_id as string | undefined
      const city = await resolveCityFromPlace(placeId, place.fullName)

      if (mode === 'destination') {
        await addDestinationToDay({
          id: `explore-${Date.now()}`,
          name: place.name,
          description: place.fullName,
          coordinates: place.coordinates,
          city,
          category: (place.category as any) ?? 'activity',
          notes: notes || undefined,
        }, selectedDayId)
      } else {
        await addBaseLocation(selectedDayId, {
          name: place.name,
          coordinates: place.coordinates,
          context: place.fullName,
          city,
          notes: notes || undefined,
        })
      }

      onComplete()
      removeActivePlace(place.id)
    } catch (error) {
      console.error('AddExplorePlaceModal: Failed to add place', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/50">{mode === 'destination' ? 'Activity' : 'Base'}</div>
            <h3 className="mt-2 text-2xl font-light">{modalTitle}</h3>
            <p className="mt-1 text-sm text-white/60">{place.fullName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-white/40">Choose day</label>
            <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto pr-2">
              {dayOptions.map((day, index) => (
                <button
                  key={day.id}
                  onClick={() => setSelectedDayId(day.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    selectedDayId === day.id
                      ? 'border-blue-500/60 bg-blue-500/15 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-white'
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium">Day {index + 1}</div>
                    <div className="text-[11px] uppercase tracking-wide text-white/40">
                      {day.baseLocations?.[0]?.name || day.destinations[0]?.name || 'Open plan'}
                    </div>
                  </div>
                  <div className="text-xs text-white/40">{formatDate(day.date)}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-white/40">
              {mode === 'destination' ? 'Notes & details (optional)' : 'Context / notes (optional)'}
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder={mode === 'destination' ? 'Add reminders, booking links, timing...' : 'Describe why this works as a base, transportation notes...'}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-blue-400/40 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-xs text-white/50">
            {mode === 'destination' ? <MapPin className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
            <span>{place.coordinates[1].toFixed(3)}, {place.coordinates[0].toFixed(3)}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSaving || !selectedDayId}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-500/40"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
