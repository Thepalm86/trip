'use client'

import { ItineraryTab } from './ItineraryTab'

export function TabSystem() {
  return (
    <div className="h-full flex flex-col">
      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <ItineraryTab />
      </div>
    </div>
  )
}
