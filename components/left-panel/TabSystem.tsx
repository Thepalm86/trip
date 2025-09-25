'use client'

import { Calendar, MapPin } from 'lucide-react'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { ItineraryTab } from './ItineraryTab'
import { ExplorationTab } from './ExplorationTab'

export function TabSystem() {
  const { activeTab, setActiveTab } = useSupabaseTripStore()

  const tabs = [
    {
      id: 'timeline' as const,
      label: 'Timeline',
      icon: Calendar,
      description: 'Plan your daily itinerary'
    },
    {
      id: 'exploration' as const,
      label: 'Exploration',
      icon: MapPin,
      description: 'Discover new locations'
    }
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex-shrink-0 border-b border-white/10 bg-white/[0.02]">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 relative ${
                  isActive
                    ? 'text-white bg-white/[0.05]'
                    : 'text-white/60 hover:text-white/80 hover:bg-white/[0.02]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'timeline' && <ItineraryTab />}
        {activeTab === 'exploration' && <ExplorationTab />}
      </div>
    </div>
  )
}
