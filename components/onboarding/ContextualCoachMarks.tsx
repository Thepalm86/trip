'use client'

import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import {
  CopyPlus,
  Edit,
  Edit3,
  GripVertical,
  Info,
  Map,
  Route,
  Timer,
  Trash2,
  X,
} from 'lucide-react'
import { useContextualOnboardingStore, ContextualTip } from '@/lib/store/contextual-onboarding-store'

type CoachContent = {
  title: string
  description: string
  highlight: ReactElement
}

function DestinationActionsPreview() {
  const actions = useMemo(
    () => [
      { icon: <Info className="h-3.5 w-3.5" />, label: 'Details', hint: 'Open full place overview' },
      { icon: <CopyPlus className="h-3.5 w-3.5" />, label: 'Duplicate', hint: 'Send to another day' },
      { icon: <Edit className="h-3.5 w-3.5" />, label: 'Edit', hint: 'Update notes & timing' },
      { icon: <Trash2 className="h-3.5 w-3.5" />, label: 'Remove', hint: 'Drop from itinerary' },
      { icon: <GripVertical className="h-3.5 w-3.5" />, label: 'Drag', hint: 'Reorder instantly' },
    ],
    [],
  )

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-white/50">Card quick actions</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <div
            key={action.label}
            className="flex min-w-[120px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-200">
              {action.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-white/90">{action.label}</p>
              <p className="text-xs text-white/60">{action.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AccommodationActionsPreview() {
  const actions = useMemo(
    () => [
      { icon: <Info className="h-3.5 w-3.5" />, label: 'Overview', hint: 'Check the place inline' },
      { icon: <CopyPlus className="h-3.5 w-3.5" />, label: 'Duplicate', hint: 'Reuse on another night' },
      { icon: <Edit3 className="h-3.5 w-3.5" />, label: 'Edit', hint: 'Tweak notes & links' },
      { icon: <Trash2 className="h-3.5 w-3.5" />, label: 'Remove', hint: 'Clear the stay' },
      { icon: <GripVertical className="h-3.5 w-3.5" />, label: 'Drag', hint: 'Rank alternates' },
    ],
    [],
  )

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-white/50">Accommodation tools</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <div
            key={action.label}
            className="flex min-w-[120px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-200">
              {action.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-white/90">{action.label}</p>
              <p className="text-xs text-white/60">{action.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RouteMetricsPreview() {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-white/50">What opens when you select a route</p>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/15 px-3 py-2">
          <Route className="h-4 w-4 text-blue-200" />
          <div>
            <p className="text-sm font-semibold text-white/90">Segment focus on the map</p>
            <p className="text-xs text-white/60">We zoom to the exact leg and highlight it in the itinerary color.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-400/30 bg-slate-400/10 px-3 py-2">
          <Timer className="h-4 w-4 text-slate-100" />
          <div>
            <p className="text-sm font-semibold text-white/90">Distance & travel time</p>
            <p className="text-xs text-white/60">A card appears with driving estimates; switch travel modes from the map toolbar.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ContextualCoachMarks() {
  const [mounted, setMounted] = useState(false)
  const activeTip = useContextualOnboardingStore((state) => state.activeTip)
  const dismissTip = useContextualOnboardingStore((state) => state.dismissTip)

  useEffect(() => {
    setMounted(true)
  }, [])

  const content = useMemo<Record<ContextualTip, CoachContent>>(
    () => ({
      'destination-actions': {
        title: 'Quick controls for each activity',
        description:
          'Hover any itinerary card to reveal fast actions. You can open details, duplicate to another day, edit notes, remove the stop, or drag to reorder.',
        highlight: <DestinationActionsPreview />,
      },
      'accommodation-actions': {
        title: 'Manage accommodations inline',
        description:
          'Every stay offers the same toolbox—open a quick overview, reuse the stay on another day, edit the context, remove it, or drag to rank alternates.',
        highlight: <AccommodationActionsPreview />,
      },
      'route-metrics': {
        title: 'Route cards show distance & time',
        description:
          'Selecting “Route to …” focuses the segment on the map and slides in a travel summary with distance and duration. Try clicking a few segments to plan drive times.',
        highlight: <RouteMetricsPreview />,
      },
    }),
    [],
  )

  if (!mounted || !activeTip) {
    return null
  }

  const coachContent = content[activeTip]

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[3000] flex items-end justify-end p-6">
      <div className="pointer-events-auto w-[360px] max-w-full rounded-2xl border border-white/10 bg-slate-950/95 p-6 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                <Map className="h-3.5 w-3.5 text-white/80" />
              </span>
              Traveal tips
            </div>
            <h3 className="mt-3 text-lg font-semibold text-white">{coachContent.title}</h3>
            <p className="mt-2 text-sm text-white/70">{coachContent.description}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss coach mark"
            onClick={dismissTip}
            className="rounded-full border border-white/10 bg-white/5 p-1.5 text-white/60 transition hover:border-white/20 hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {coachContent.highlight}
        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={dismissTip}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500/90 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
