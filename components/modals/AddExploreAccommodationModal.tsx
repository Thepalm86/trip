'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Hotel, Loader2, MapPin } from 'lucide-react'
import type { DayLocation, ExplorePlace } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { useExploreStore } from '@/lib/store/explore-store'
import { resolveCityFromPlace } from '@/lib/location/city'

interface AddExploreAccommodationModalProps {
  place: ExplorePlace
  onClose: () => void
  onComplete: () => void
}

export function AddExploreAccommodationModal({ place, onClose, onComplete }: AddExploreAccommodationModalProps) {
  const { currentTrip, addBaseLocation } = useSupabaseTripStore()
  const removeActivePlace = useExploreStore((state) => state.removeActivePlace)

  const [selectedDayIds, setSelectedDayIds] = useState<string[]>(() => {
    const firstDayId = currentTrip?.days?.[0]?.id
    return firstDayId ? [firstDayId] : []
  })
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const days = currentTrip?.days ?? []

    if (days.length === 0) {
      setSelectedDayIds([])
      return
    }

    setSelectedDayIds((previous) => {
      const validSelections = previous.filter((id) => days.some((day) => day.id === id))
      if (validSelections.length > 0) {
        return validSelections
      }
      return [days[0].id]
    })
  }, [currentTrip?.days])

  const dayOptions = useMemo(() => currentTrip?.days ?? [], [currentTrip?.days])

  const formatDate = (value: Date) => {
    try {
      return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return ''
    }
  }

  const handleConfirm = async () => {
    if (!currentTrip || selectedDayIds.length === 0) {
      return
    }

    setIsSaving(true)

    try {
      const placeId = place.metadata?.place_id as string | undefined
      const city = await resolveCityFromPlace(placeId, place.fullName)
      const resolvedCity = city === 'Unknown' ? undefined : city

      const trimmedNotes = notes.trim()

      const template: DayLocation = {
        name: place.name,
        coordinates: place.coordinates,
        context: place.fullName ?? place.context,
        city: resolvedCity,
        category: (place.category as string) ?? 'accommodation',
        notes: trimmedNotes ? trimmedNotes : undefined,
        links: Array.isArray(place.links) && place.links.length
          ? place.links.map((link) => ({ ...link }))
          : undefined,
      }

      for (const dayId of selectedDayIds) {
        const dayLocation: DayLocation = { ...template }
        await addBaseLocation(dayId, dayLocation)
      }

      onComplete()
      removeActivePlace(place.id)
    } catch (error) {
      console.error('AddExploreAccommodationModal: failed to add base location', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/80">
              <Hotel className="h-3.5 w-3.5" /> Stay
            </div>
            <h3 className="mt-2 text-2xl font-light text-white">Add as accommodation</h3>
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
            <label className="text-xs font-semibold uppercase tracking-wide text-white/40">Choose days</label>
            <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto pr-2">
              {dayOptions.map((day, index) => {
                const isSelected = selectedDayIds.includes(day.id)

                return (
                  <button
                    key={day.id}
                    onClick={() => {
                      setSelectedDayIds((previous) =>
                        previous.includes(day.id)
                          ? previous.filter((id) => id !== day.id)
                          : [...previous, day.id]
                      )
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-emerald-400/70 bg-emerald-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium">Day {index + 1}</div>
                      <div className="text-[11px] uppercase tracking-wide text-white/40">
                        {day.baseLocations?.[0]?.name || day.destinations?.[0]?.name || 'Open plan'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-xs text-white/60">
                      <span>{formatDate(day.date)}</span>
                      {isSelected && (
                        <span className="mt-0.5 rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-100">
                          Selected
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-white/40">Stay notes (optional)</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Check-in details, host instructions, confirmation numbers..."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-emerald-400/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-xs text-white/50">
            <MapPin className="h-3 w-3" />
            <span>
              {place.coordinates[1].toFixed(3)}, {place.coordinates[0].toFixed(3)}
            </span>
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
              disabled={isSaving || selectedDayIds.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {selectedDayIds.length > 1 ? `Add to ${selectedDayIds.length} days` : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
