'use client'

import clsx from 'clsx'
import { InteractiveMap } from './InteractiveMap'

interface MiniAssistantMapProps {
  className?: string
  label?: string
}

export function MiniAssistantMap({ className, label = 'Itinerary Map' }: MiniAssistantMapProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-white/10 bg-black/30 p-2 shadow-2xl shadow-black/40 backdrop-blur-sm',
        className
      )}
    >
      <div className="relative h-[170px] w-[240px] overflow-hidden rounded-xl">
        <InteractiveMap variant="mini" />
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-200/90">
          {label}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" />
      </div>
    </div>
  )
}
