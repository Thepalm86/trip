'use client'

import { useState } from 'react'
import { 
  Calendar, 
  MapPin, 
  Clock, 
  DollarSign, 
  Star, 
  Plus, 
  Edit3, 
  Trash2, 
  Share2, 
  Download, 
  Settings,
  Search,
  Filter,
  Heart,
  Navigation,
  Users,
  BookOpen,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Eye,
  EyeOff
} from 'lucide-react'

type TabType = 'overview' | 'itinerary' | 'destinations' | 'budget' | 'notes'

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<TabType>('itinerary')
  const [selectedDay, setSelectedDay] = useState(1)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['day-1', 'day-2']))

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Calendar },
    { id: 'itinerary', label: 'Itinerary', icon: MapPin },
    { id: 'destinations', label: 'Destinations', icon: Star },
    { id: 'budget', label: 'Budget', icon: DollarSign },
    { id: 'notes', label: 'Notes', icon: BookOpen },
  ]

  const days = [
    {
      id: 1,
      date: '2024-03-15',
      location: 'Rome, Italy',
      destinations: [
        { name: 'Colosseum', category: 'attraction', duration: 3, cost: 24, rating: 4.5, time: '09:00' },
        { name: 'Roman Forum', category: 'attraction', duration: 2, cost: 18, rating: 4.3, time: '12:30' },
        { name: 'Trattoria da Enzo', category: 'restaurant', duration: 1.5, cost: 35, rating: 4.4, time: '15:00' },
        { name: 'Trevi Fountain', category: 'attraction', duration: 1, cost: 0, rating: 4.2, time: '18:00' }
      ]
    },
    {
      id: 2,
      date: '2024-03-16',
      location: 'Rome, Italy',
      destinations: [
        { name: 'Vatican Museums', category: 'attraction', duration: 4, cost: 28, rating: 4.6, time: '09:00' },
        { name: 'Sistine Chapel', category: 'attraction', duration: 1, cost: 0, rating: 4.8, time: '13:00' },
        { name: 'Pizzeria da Baffetto', category: 'restaurant', duration: 1, cost: 22, rating: 4.3, time: '14:30' }
      ]
    },
    {
      id: 3,
      date: '2024-03-17',
      location: 'Florence, Italy',
      destinations: [
        { name: 'Uffizi Gallery', category: 'attraction', duration: 3, cost: 20, rating: 4.7, time: '10:00' },
        { name: 'Ponte Vecchio', category: 'attraction', duration: 1, cost: 0, rating: 4.1, time: '14:00' }
      ]
    }
  ]

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Trip Summary */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Trip Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white mb-1">7</div>
            <div className="text-sm text-white/60">Days</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white mb-1">12</div>
            <div className="text-sm text-white/60">Destinations</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white mb-1">€187</div>
            <div className="text-sm text-white/60">Estimated Cost</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white mb-1">4.5</div>
            <div className="text-sm text-white/60">Avg Rating</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <button className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
            <Share2 className="h-5 w-5 text-blue-400" />
            <span className="text-white">Share Trip</span>
          </button>
          <button className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
            <Download className="h-5 w-5 text-green-400" />
            <span className="text-white">Export PDF</span>
          </button>
          <button className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
            <Settings className="h-5 w-5 text-purple-400" />
            <span className="text-white">Trip Settings</span>
          </button>
          <button className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
            <Plus className="h-5 w-5 text-orange-400" />
            <span className="text-white">Add Day</span>
          </button>
        </div>
      </div>
    </div>
  )

  const renderItineraryTab = () => (
    <div className="space-y-4">
      {/* Day Selector */}
      <div className="flex gap-2 mb-6">
        {days.map((day) => (
          <button
            key={day.id}
            onClick={() => setSelectedDay(day.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedDay === day.id
                ? 'bg-blue-500 text-white'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            Day {day.id}
          </button>
        ))}
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-white/70 hover:bg-white/10 transition-all">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Day Details */}
      {days.map((day) => (
        <div key={day.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection(`day-${day.id}`)}
            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                {day.id}
              </div>
              <div className="text-left">
                <div className="font-semibold text-white">Day {day.id}</div>
                <div className="text-sm text-white/60">{day.date} • {day.location}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-white/60">{day.destinations.length} destinations</div>
              {expandedSections.has(`day-${day.id}`) ? 
                <ChevronDown className="h-4 w-4 text-white/60" /> : 
                <ChevronRight className="h-4 w-4 text-white/60" />
              }
            </div>
          </button>

          {expandedSections.has(`day-${day.id}`) && (
            <div className="border-t border-white/10 p-4 space-y-3">
              {day.destinations.map((dest, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white text-sm">{dest.name}</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400 fill-current" />
                        <span className="text-xs text-white/60">{dest.rating}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/50">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{dest.time}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Navigation className="h-3 w-3" />
                        <span>{dest.duration}h</span>
                      </div>
                      {dest.cost > 0 && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span>€{dest.cost}</span>
                        </div>
                      )}
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase">
                        {dest.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10">
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-red-500/20">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
              
              <button className="w-full flex items-center gap-2 p-3 border-2 border-dashed border-white/20 rounded-lg text-white/60 hover:text-white hover:border-white/40 transition-all">
                <Plus className="h-4 w-4" />
                Add Destination
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )

  const renderDestinationsTab = () => (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            type="text"
            placeholder="Search destinations..."
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400/50"
          />
        </div>
        <div className="flex gap-2">
          {['All', 'Attractions', 'Restaurants', 'Hotels', 'Activities'].map((category) => (
            <button
              key={category}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 text-white/70 hover:bg-white/10 transition-all"
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Saved Destinations */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Heart className="h-4 w-4 text-red-400" />
          Saved Destinations
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {[
            { name: 'Pantheon', category: 'attraction', rating: 4.4, saved: true },
            { name: 'Gelateria del Teatro', category: 'restaurant', rating: 4.6, saved: true },
            { name: 'Spanish Steps', category: 'attraction', rating: 4.2, saved: true },
          ].map((dest, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                <MapPin className="h-5 w-5 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white text-sm">{dest.name}</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-400 fill-current" />
                    <span className="text-xs text-white/60">{dest.rating}</span>
                  </div>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-white/60">
                  {dest.category}
                </span>
              </div>
              <button className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderBudgetTab = () => (
    <div className="space-y-6">
      {/* Budget Overview */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Budget Overview</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-white/80">Total Budget</span>
            <span className="text-2xl font-bold text-white">€1,500</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/80">Estimated Cost</span>
            <span className="text-xl font-semibold text-green-400">€1,187</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/80">Remaining</span>
            <span className="text-lg font-medium text-blue-400">€313</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Category Breakdown</h3>
        <div className="space-y-3">
          {[
            { category: 'Accommodation', amount: 450, percentage: 38 },
            { category: 'Food & Dining', amount: 280, percentage: 24 },
            { category: 'Attractions', amount: 200, percentage: 17 },
            { category: 'Transportation', amount: 150, percentage: 13 },
            { category: 'Shopping', amount: 107, percentage: 9 },
          ].map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white/80 text-sm">{item.category}</span>
                <span className="text-white font-medium">€{item.amount}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderNotesTab = () => (
    <div className="space-y-6">
      {/* Trip Notes */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Trip Notes</h3>
        <textarea
          placeholder="Add your trip notes, ideas, and important information..."
          className="w-full h-32 p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400/50 resize-none"
        />
      </div>

      {/* Checklist */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Pre-Trip Checklist</h3>
        <div className="space-y-3">
          {[
            'Book flights',
            'Reserve hotels',
            'Get travel insurance',
            'Check passport validity',
            'Download offline maps',
            'Book attraction tickets',
            'Pack essentials',
            'Notify bank of travel'
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-5 h-5 border border-white/30 rounded flex items-center justify-center">
                <CheckCircle className="h-3 w-3 text-green-400" />
              </div>
              <span className="text-white/80 text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Left Panel Demo</h1>
          <p className="text-white/60">Interactive itinerary planning interface</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Italy Adventure</h2>
                <p className="text-white/60">March 15-21, 2024 • 7 days</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-all">
                  <Share2 className="h-4 w-4" />
                </button>
                <button className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-all">
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-white/60">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>7 days planned</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>12 destinations</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span>€1,187 estimated</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-white/10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'text-white border-b-2 border-blue-400 bg-white/5'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'itinerary' && renderItineraryTab()}
            {activeTab === 'destinations' && renderDestinationsTab()}
            {activeTab === 'budget' && renderBudgetTab()}
            {activeTab === 'notes' && renderNotesTab()}
          </div>
        </div>
      </div>
    </div>
  )
}
