'use client'

import { useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useRouter } from 'next/navigation'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { CalendarRange, ChevronDown, Loader2, MapPin, Layers, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TripSwitcherProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  highlight?: boolean
}

export function TripSwitcher({ open, onOpenChange, highlight }: TripSwitcherProps) {
  const trips = useSupabaseTripStore((state) => state.trips)
  const currentTrip = useSupabaseTripStore((state) => state.currentTrip)
  const currentTripId = currentTrip?.id ?? null
  const selectTrip = useSupabaseTripStore((state) => state.setCurrentTripById)
  const [pendingTripId, setPendingTripId] = useState<string | null>(null)
  const router = useRouter()

  const primaryLabel = useMemo(() => {
    if (currentTrip?.name) return currentTrip.name
    if (trips.length > 0) return 'Select a trip'
    return 'Create your first trip'
  }, [currentTrip?.name, trips.length])

  const secondaryLabel = useMemo(() => {
    if (currentTrip?.name) {
      return null
    }
    if (trips.length === 0) {
      return 'No trips yet'
    }
    if (trips.length === 1) {
      return 'Only trip'
    }
    return `${trips.length} trips available`
  }, [currentTrip?.name, trips.length])

  const handleSelectTrip = async (tripId: string) => {
    if (pendingTripId) return
    if (tripId === currentTripId) {
      onOpenChange(false)
      return
    }

    setPendingTripId(tripId)
    try {
      await selectTrip(tripId)
      onOpenChange(false)
    } catch (error) {
      console.error('TripSwitcher: Failed to switch trip', error)
    } finally {
      setPendingTripId(null)
    }
  }

  const handleCreateTrip = () => {
    onOpenChange(false)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('trip3:force-setup', 'true')
    }
    router.push('/setup')
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            'relative group flex h-12 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-left text-white/90 shadow-sm backdrop-blur transition focus:outline-none focus:ring-2 focus:ring-blue-300/40 hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-white',
            highlight && 'border-blue-400/50 shadow-[0_0_0_4px_rgba(59,130,246,0.18)]'
          )}
        >
          <span className="min-w-0">
            <span className="block text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
              Trip
            </span>
            <span className="block truncate text-sm font-semibold text-white">
              {primaryLabel}
            </span>
            {secondaryLabel ? (
              <span className="block truncate text-[11px] text-white/45">
                {secondaryLabel}
              </span>
            ) : null}
          </span>
          <ChevronDown className="h-4 w-4 text-white/40 transition group-hover:text-blue-300" />
          {highlight ? (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-lg">
              New
            </span>
          ) : null}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[61] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-slate-950/95 p-0 shadow-[0_40px_120px_rgba(15,23,42,0.55)] backdrop-blur-xl focus:outline-none">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div>
              <Dialog.Title className="text-xl font-semibold text-white">Your Trips</Dialog.Title>
              <Dialog.Description className="text-sm text-white/60">
                Switch between itineraries or start a new planning workspace.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-lg border border-white/10 px-3 py-1 text-sm text-white/70 transition hover:border-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-300/40">
                Close
              </button>
            </Dialog.Close>
          </div>

          <div className="max-h-[360px] overflow-y-auto px-6 py-4">
            {trips.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-8 text-center text-white/70">
                No trips found yet. Create a new itinerary to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {trips.map((trip) => {
                  const isActive = trip.id === currentTripId
                  const isPending = pendingTripId === trip.id
                  const dateSummary = formatTripDateRange(trip.startDate, trip.endDate)
                  return (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => handleSelectTrip(trip.id)}
                      className={cn(
                        'w-full rounded-2xl border px-5 py-4 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-400/40',
                        isActive
                          ? 'border-blue-500/60 bg-blue-500/15 text-white shadow-[0_12px_32px_rgba(59,130,246,0.25)]'
                          : 'border-white/10 bg-white/[0.03] text-white/85 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-white'
                      )}
                      disabled={isPending}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-base font-semibold">{trip.name}</span>
                            {isActive ? (
                              <span className="rounded-full border border-blue-400/40 bg-blue-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-100">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/60">
                            {dateSummary ? (
                              <span className="inline-flex items-center gap-1">
                                <CalendarRange className="h-3.5 w-3.5" />
                                {dateSummary}
                              </span>
                            ) : null}
                            {trip.country ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {trip.country}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1">
                              <Layers className="h-3.5 w-3.5" />
                              {trip.days.length} day{trip.days.length === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                        {isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin text-white/70" />
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 px-6 py-4">
            <button
              type="button"
              onClick={handleCreateTrip}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            >
              <Plus className="h-4 w-4" />
              Start a new trip
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function formatTripDateRange(start?: Date | string, end?: Date | string) {
  if (!start || !end) {
    return null
  }
  try {
    const startDate = start instanceof Date ? start : new Date(start)
    const endDate = end instanceof Date ? end : new Date(end)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return null
    }
    const formatter = new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
    })
    return `${formatter.format(startDate)} – ${formatter.format(endDate)}`
  } catch (error) {
    console.warn('TripSwitcher: Failed to format date range', error)
    return null
  }
}
