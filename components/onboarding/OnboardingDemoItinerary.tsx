'use client'

import type { ComponentType } from 'react'
import { BedDouble, CalendarDays, CopyPlus, Edit, GripVertical, Info, MapPin, Route, Trash2 } from 'lucide-react'
import { useOnboardingStore } from '@/lib/store/onboarding-store'

export function OnboardingDemoItinerary() {
  const currentStepId = useOnboardingStore((state) => state.currentStepId)
  const showActionCallouts = currentStepId === 'itinerary-card-actions'

  return (
    <div className="h-full flex" data-tour="day-plan-wrapper">
      <div className="w-80 border-r border-white/10 bg-white/[0.02] overflow-y-auto scrollbar-hide" data-tour="timeline">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/80">Timeline</h3>
            <div className="rounded-lg border border-white/10 px-3 py-1 text-xs uppercase text-white/50">
              Demo
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-xl border border-white/15 bg-white/[0.04] p-4 shadow-lg shadow-black/20">
              <div className="flex items-center justify-between text-xs text-white/60">
                <span className="font-semibold text-white/80">Day 1 · Amsterdam</span>
                <span>3 activities</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
                <CalendarDays className="h-3.5 w-3.5 text-blue-300" />
                <span>Demo day shown for onboarding</span>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-xs text-white/40">
              Additional days appear here once you add them.
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide bg-white/[0.01]" data-tour="day-details">
        <div className="mx-auto max-w-3xl p-6 space-y-6">
          <div className="flex items-start justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div>
              <div className="flex items-center gap-2 text-sm uppercase tracking-widest text-white/50">
                <span>Base stay</span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span>Amsterdam, NL</span>
              </div>
              <h3 className="mt-2 text-xl font-semibold text-white">Canal Boutique Hotel</h3>
              <div className="mt-3 flex items-center gap-2 text-sm text-white/60">
                <MapPin className="h-4 w-4 text-emerald-300" />
                Keizersgracht 148, Grachtengordel-West
              </div>
            </div>
            <div className="flex flex-col gap-2 text-xs text-white/60">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-100">
                <BedDouble className="h-3.5 w-3.5" />
                Accommodation saved for the day
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3 py-1.5">
                <Route className="h-3.5 w-3.5 text-blue-300" />
                Demo view · no changes saved
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/12 bg-white/[0.03] px-5 py-4 shadow-inner">
            <div className="flex items-center gap-3 text-sm text-white/80">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/40 to-indigo-500/30 text-lg font-semibold text-white">
                1
              </div>
              <div>
                <p className="font-semibold">Day 1 · Amsterdam</p>
                <p className="text-xs text-white/55">Friday · 3 destinations scheduled · Route overlay on</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <button className="inline-flex items-center gap-2 rounded-lg border border-blue-400/40 bg-blue-500/15 px-3 py-1.5 font-semibold text-blue-100 shadow">
                <Route className="h-3 w-3" />
                Day routes
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-white/75">
                <CopyPlus className="h-3 w-3" />
                Duplicate day
              </button>
            </div>
          </div>

          <div
            className="relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] shadow-xl"
            data-tour="itinerary-card-demo"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-indigo-500/10 opacity-70" />
            <div className="relative flex flex-col gap-4 p-6">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/40 bg-blue-500/15 text-lg font-bold text-blue-200 shadow-lg">
                    A
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-white">Van Gogh Museum</h4>
                    <div className="mt-1 flex items-center gap-2 text-sm text-white/60">
                      <MapPin className="h-4 w-4 text-blue-300" />
                      Museumplein 6, Amsterdam
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm text-white/70 leading-relaxed">
                  Famous works from Vincent van Gogh alongside rotating exhibitions. Use the quick actions below to dive into details, duplicate to other days, or tidy up the plan.
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-xs text-white/60">
                <span className="font-semibold text-white/80">Tip:</span>
                Use the quick actions to view details, duplicate this stop to another day, or tweak the notes without leaving the card.
              </div>
            </div>

            <div className={`pointer-events-none absolute bottom-4 right-4 flex gap-2 transition-opacity ${
              showActionCallouts ? 'opacity-100' : 'opacity-60'
            }`}>
              <ActionCallout icon={Info} label="View details" accent="info" />
              <ActionCallout icon={CopyPlus} label="Duplicate" accent="sky" />
              <ActionCallout icon={Edit} label="Edit info" accent="violet" />
              <ActionCallout icon={Trash2} label="Remove" accent="rose" />
              <ActionCallout icon={GripVertical} label="Drag" accent="slate" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ActionCalloutProps {
  icon: ComponentType<{ className?: string }>
  label: string
  accent: 'info' | 'sky' | 'violet' | 'rose' | 'slate'
}

function ActionCallout({ icon: Icon, label, accent }: ActionCalloutProps) {
  const palettes = {
    info: 'border-cyan-300/60 bg-cyan-500/15 text-cyan-100',
    sky: 'border-sky-300/60 bg-sky-500/15 text-sky-100',
    violet: 'border-violet-300/60 bg-violet-500/15 text-violet-100',
    rose: 'border-rose-300/60 bg-rose-500/15 text-rose-100',
    slate: 'border-slate-300/40 bg-slate-500/15 text-slate-100',
  }

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-lg shadow-black/20 ${palettes[accent]}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  )
}
