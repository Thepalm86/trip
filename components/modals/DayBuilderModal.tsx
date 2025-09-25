'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  X, 
  Plus, 
  MapPin, 
  Clock, 
  DollarSign, 
  Star, 
  Camera,
  Upload,
  Edit3,
  Trash2,
  Save,
  Calendar,
  Navigation,
  Heart,
  Share2,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  ChevronRight,
  ChevronDown,
  Play,
  Pause,
  RotateCcw,
  Eye,
  EyeOff,
  MoreVertical,
  Copy,
  Move,
  GripVertical,
  Search,
  Map,
  Zap,
  Sparkles,
  Target,
  Route,
  Layers,
  Compass,
  Bed,
  Building,
  Utensils,
  Coffee,
  ShoppingBag,
  Car,
  Plane,
  Train,
  Bus,
  Bike,
  MapIcon
} from 'lucide-react'
import { TimelineDay, Destination } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { DayMiniMap } from './DayMiniMap'

interface DayBuilderModalProps {
  day: TimelineDay
  dayIndex: number
  isOpen: boolean
  onClose: () => void
}

interface TimeSlot {
  id: string
  startTime: string
  endTime: string
  activity: string
  location?: string
  notes?: string
  duration?: number
  cost?: number
  images?: string[]
  tags?: string[]
  destination?: Destination
  category?: 'accommodation' | 'attraction' | 'restaurant' | 'transport' | 'activity'
}

interface SearchResult {
  id: string
  name: string
  fullName: string
  coordinates: [number, number]
  category: string
  contextLabel: string
  rating?: number
}

export function DayBuilderModal({ day, dayIndex, isOpen, onClose }: DayBuilderModalProps) {
  const { 
    addDestinationToDay, 
    removeDestinationFromDay, 
    updateTrip,
    currentTrip 
  } = useSupabaseTripStore()
  
  const [dayTitle, setDayTitle] = useState(`Day ${dayIndex + 1}`)
  const [dayDescription, setDayDescription] = useState('')
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [activeCard, setActiveCard] = useState<'accommodation' | 'attraction' | 'activity' | 'transport'>('activity')
  const [showAddSlot, setShowAddSlot] = useState(false)
  const [newSlot, setNewSlot] = useState<Partial<TimeSlot>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Search functionality
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Initialize with existing destinations as time slots
      const initialSlots: TimeSlot[] = day.destinations.map((dest, index) => ({
        id: `slot-${dest.id}`,
        startTime: `${9 + index * 2}:00`,
        endTime: `${11 + index * 2}:00`,
        activity: dest.name,
        location: dest.description,
        notes: '',
        duration: dest.estimatedDuration || 2,
        cost: dest.cost || 0,
        images: [],
        tags: [],
        destination: dest,
        category: dest.category as TimeSlot['category'] || 'attraction'
      }))
      setTimeSlots(initialSlots)
    }
  }, [isOpen, day.destinations])

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    const controller = new AbortController()
    const fetchResults = async () => {
      try {
        setIsSearching(true)
        
        const apiEndpoint = new URL('/api/places/search', window.location.origin)
        apiEndpoint.searchParams.set('query', searchQuery)

        const response = await fetch(apiEndpoint.toString(), { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()
        const googleResults = data.results ?? []
        
        const mapped: SearchResult[] = googleResults.slice(0, 6).map((place: any) => ({
          id: `google-${place.place_id}`,
          name: place.name,
          fullName: place.formatted_address,
          coordinates: [place.geometry.location.lng, place.geometry.location.lat] as [number, number],
          category: place.types?.[0] || 'attraction',
          contextLabel: place.formatted_address.split(',').slice(-2).join(', ').trim(),
          rating: place.rating || Math.random() * 2 + 3
        }))

        setSearchResults(mapped)
        setShowSearchResults(true)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Places search error:', error)
        }
      } finally {
        setIsSearching(false)
      }
    }

    fetchResults()
    return () => controller.abort()
  }, [searchQuery])

  const addTimeSlot = async () => {
    if (!newSlot.activity || !newSlot.destination) return

    try {
      // Add destination to the day in the store (this will sync with the map)
      await addDestinationToDay(newSlot.destination, day.id)
      
      const slot: TimeSlot = {
        id: `slot-${Date.now()}`,
        startTime: newSlot.startTime || '09:00',
        endTime: newSlot.endTime || '11:00',
        activity: newSlot.activity,
        location: newSlot.destination.description,
        notes: newSlot.notes || '',
        duration: calculateDuration(newSlot.startTime || '09:00', newSlot.endTime || '11:00'),
        cost: newSlot.cost || 0,
        images: [],
        tags: [],
        destination: newSlot.destination,
        category: newSlot.category || 'attraction'
      }
      
      setTimeSlots(prev => [...prev, slot].sort((a, b) => a.startTime.localeCompare(b.startTime)))
      setNewSlot({})
      setShowAddSlot(false)
      setSearchQuery('')
      setShowSearchResults(false)
    } catch (error) {
      console.error('Error adding destination:', error)
    }
  }

  const removeTimeSlot = async (slotId: string) => {
    const slot = timeSlots.find(s => s.id === slotId)
    if (!slot || !slot.destination) return

    try {
      // Remove destination from the day in the store (this will sync with the map)
      await removeDestinationFromDay(slot.destination.id, day.id)
      
      setTimeSlots(prev => prev.filter(s => s.id !== slotId))
      if (selectedSlot === slotId) setSelectedSlot(null)
    } catch (error) {
      console.error('Error removing destination:', error)
    }
  }

  const calculateDuration = (start: string, end: string) => {
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)
    return (endHour - startHour) + (endMin - startMin) / 60
  }

  const handleImageUpload = (slotId: string, files: FileList) => {
    const imageUrls = Array.from(files).map(file => URL.createObjectURL(file))
    setTimeSlots(prev => prev.map(slot => 
      slot.id === slotId 
        ? { ...slot, images: [...(slot.images || []), ...imageUrls] }
        : slot
    ))
  }

  const removeImage = (slotId: string, imageIndex: number) => {
    setTimeSlots(prev => prev.map(slot => 
      slot.id === slotId 
        ? { ...slot, images: slot.images?.filter((_, i) => i !== imageIndex) }
        : slot
    ))
  }

  const updateSlot = (slotId: string, updates: Partial<TimeSlot>) => {
    setTimeSlots(prev => prev.map(slot => 
      slot.id === slotId ? { ...slot, ...updates } : slot
    ))
  }

  const duplicateSlot = (slotId: string) => {
    const slot = timeSlots.find(s => s.id === slotId)
    if (slot && slot.destination) {
      const newSlot: TimeSlot = {
        ...slot,
        id: `slot-${Date.now()}`,
        startTime: slot.endTime,
        endTime: addTimeToSlot(slot.endTime, slot.duration || 2)
      }
      setTimeSlots(prev => [...prev, newSlot].sort((a, b) => a.startTime.localeCompare(b.startTime)))
    }
  }

  const addTimeToSlot = (time: string, hours: number) => {
    const [hour, min] = time.split(':').map(Number)
    const newHour = hour + hours
    return `${newHour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
  }

  const selectSearchResult = (result: SearchResult) => {
    const destination: Destination = {
      id: result.id,
      name: result.name,
      description: result.fullName,
      coordinates: result.coordinates,
      category: result.category as Destination['category'],
      rating: result.rating,
      estimatedDuration: 2
    }
    
    setNewSlot(prev => ({ 
      ...prev, 
      destination,
      activity: result.name,
      location: result.contextLabel
    }))
    setSearchQuery(result.name)
    setShowSearchResults(false)
  }

  const getTotalCost = () => timeSlots.reduce((sum, slot) => sum + (slot.cost || 0), 0)
  const getTotalDuration = () => timeSlots.reduce((sum, slot) => sum + (slot.duration || 0), 0)

  const getSlotsByCategory = (category: TimeSlot['category']) => {
    return timeSlots.filter(slot => slot.category === category)
  }

  const getCategoryIcon = (category: TimeSlot['category']) => {
    switch (category) {
      case 'accommodation': return Bed
      case 'attraction': return MapPin
      case 'restaurant': return Utensils
      case 'transport': return Car
      case 'activity': return Target
      default: return MapPin
    }
  }

  const getCategoryColor = (category: TimeSlot['category']) => {
    switch (category) {
      case 'accommodation': return 'from-purple-500 to-indigo-500'
      case 'attraction': return 'from-blue-500 to-cyan-500'
      case 'restaurant': return 'from-orange-500 to-red-500'
      case 'transport': return 'from-green-500 to-emerald-500'
      case 'activity': return 'from-pink-500 to-rose-500'
      default: return 'from-gray-500 to-slate-500'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg z-50 flex items-center justify-center p-2">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border border-white/20 w-full max-w-[98vw] h-[98vh] flex overflow-hidden shadow-2xl">
        
        {/* Left Panel - Cards & Content */}
        <div className="w-2/3 flex flex-col">
          {/* Premium Header */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20" />
            <div className="absolute inset-0 opacity-40" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }} />
            
            <div className="relative flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-white text-xl shadow-2xl">
                    {dayIndex + 1}
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    value={dayTitle}
                    onChange={(e) => setDayTitle(e.target.value)}
                    disabled={!isEditing}
                    className="text-4xl font-bold text-white bg-transparent border-none focus:outline-none disabled:opacity-70 placeholder-white/40"
                    placeholder="Enter day title..."
                  />
                  <div className="flex items-center gap-6 mt-3">
                    <span className="text-white/70 text-sm font-medium">
                      {day.date.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric',
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                    <div className="flex items-center gap-6 text-sm text-white/60">
                      <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10">
                        <Clock className="h-4 w-4" />
                        {getTotalDuration().toFixed(1)}h
                      </span>
                      <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10">
                        <DollarSign className="h-4 w-4" />
                        €{getTotalCost()}
                      </span>
                      <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10">
                        <Target className="h-4 w-4" />
                        {timeSlots.length} activities
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                    isEditing 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg hover:shadow-green-500/25' 
                      : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20'
                  }`}
                >
                  <Edit3 className="h-4 w-4" />
                  {isEditing ? 'Done Editing' : 'Edit Mode'}
                </button>
                
                <button
                  onClick={() => console.log('Save day:', { dayTitle, dayDescription, timeSlots })}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 font-medium"
                >
                  <Save className="h-4 w-4" />
                  Save Day
                </button>
                
                <button
                  onClick={onClose}
                  className="p-2.5 rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200 backdrop-blur-sm border border-white/20"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Card Navigation */}
          <div className="flex border-b border-white/10 bg-slate-800/30">
            {[
              { id: 'accommodation', label: 'Accommodation', icon: Bed, count: getSlotsByCategory('accommodation').length },
              { id: 'attraction', label: 'Attractions', icon: MapPin, count: getSlotsByCategory('attraction').length },
              { id: 'activity', label: 'Activities', icon: Target, count: getSlotsByCategory('activity').length },
              { id: 'transport', label: 'Transport', icon: Car, count: getSlotsByCategory('transport').length }
            ].map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                onClick={() => setActiveCard(id as any)}
                className={`flex items-center gap-3 px-6 py-4 text-sm font-medium transition-all duration-300 relative ${
                  activeCard === id
                    ? 'text-white bg-white/10'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
                {count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeCard === id ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
                  }`}>
                    {count}
                  </span>
                )}
                {activeCard === id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500" />
                )}
              </button>
            ))}
          </div>

          {/* Card Content */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-800/30 to-slate-900/30">
            <div className="p-6">
              {/* Add New Item */}
              {isEditing && (
                <div className="mb-6 p-6 bg-gradient-to-br from-white/5 to-white/10 rounded-2xl border border-white/20 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-blue-400" />
                    <h4 className="text-lg font-semibold text-white">Add New {activeCard.charAt(0).toUpperCase() + activeCard.slice(1)}</h4>
                  </div>
                  <div className="space-y-4">
                    {/* Location Search */}
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={`Search for ${activeCard}...`}
                          className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-white/40 backdrop-blur-sm"
                        />
                        {isSearching && (
                          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                            <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/20 border-t-blue-400" />
                          </div>
                        )}
                      </div>
                      
                      {/* Search Results */}
                      {showSearchResults && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
                          {searchResults.map((result) => (
                            <button
                              key={result.id}
                              onClick={() => selectSearchResult(result)}
                              className="w-full text-left p-4 hover:bg-white/10 transition-all duration-200 border-b border-white/10 last:border-b-0"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                                  <MapPin className="h-5 w-5 text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-white font-semibold text-sm truncate">{result.name}</div>
                                  <div className="text-white/60 text-xs truncate mt-1">{result.contextLabel}</div>
                                  {result.rating && (
                                    <div className="flex items-center gap-1 mt-2">
                                      <Star className="h-3 w-3 text-yellow-400 fill-current" />
                                      <span className="text-white/60 text-xs">{result.rating.toFixed(1)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Activity Name */}
                    <input
                      type="text"
                      value={newSlot.activity || ''}
                      onChange={(e) => setNewSlot(prev => ({ ...prev, activity: e.target.value }))}
                      placeholder="Name..."
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-white/40 backdrop-blur-sm"
                    />
                    
                    {/* Time Fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-white/60 mb-2 font-medium">Start Time</label>
                        <input
                          type="time"
                          value={newSlot.startTime || ''}
                          onChange={(e) => setNewSlot(prev => ({ ...prev, startTime: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-2 font-medium">End Time</label>
                        <input
                          type="time"
                          value={newSlot.endTime || ''}
                          onChange={(e) => setNewSlot(prev => ({ ...prev, endTime: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={addTimeSlot}
                        disabled={!newSlot.activity || !newSlot.destination}
                        className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-green-500/25 transition-all duration-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add {activeCard.charAt(0).toUpperCase() + activeCard.slice(1)}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddSlot(false)
                          setNewSlot({})
                          setSearchQuery('')
                          setShowSearchResults(false)
                        }}
                        className="px-4 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all duration-300 text-sm font-medium backdrop-blur-sm border border-white/20"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Card Items */}
              <div className="space-y-4">
                {getSlotsByCategory(activeCard).map((slot, index) => {
                  const Icon = getCategoryIcon(slot.category!)
                  const colorClass = getCategoryColor(slot.category!)
                  
                  return (
                    <div
                      key={slot.id}
                      className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-white truncate">{slot.activity}</h3>
                            <span className="text-white/60 text-sm">{slot.startTime} - {slot.endTime}</span>
                          </div>
                          
                          {slot.location && (
                            <p className="text-white/60 text-sm flex items-center gap-2 mb-3">
                              <MapPin className="h-4 w-4" />
                              {slot.location}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-4 text-sm text-white/60">
                            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10">
                              <Clock className="h-3 w-3" />
                              {slot.duration}h
                            </span>
                            {slot.cost && slot.cost > 0 && (
                              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10">
                                <DollarSign className="h-3 w-3" />
                                €{slot.cost}
                              </span>
                            )}
                            {slot.images && slot.images.length > 0 && (
                              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10">
                                <ImageIcon className="h-3 w-3" />
                                {slot.images.length}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {isEditing && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => duplicateSlot(slot.id)}
                              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => removeTimeSlot(slot.id)}
                              className="p-2 rounded-lg text-white/60 hover:text-red-400 hover:bg-white/10 transition-all duration-200"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                
                {getSlotsByCategory(activeCard).length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                      {(() => {
                        const Icon = getCategoryIcon(activeCard as TimeSlot['category'])
                        return <Icon className="h-8 w-8 text-white/40" />
                      })()}
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">No {activeCard} yet</h3>
                    <p className="text-white/60 mb-4">Add your first {activeCard.slice(0, -1)} to get started</p>
                    {isEditing && (
                      <button
                        onClick={() => setShowAddSlot(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200"
                      >
                        <Plus className="h-4 w-4" />
                        Add {activeCard.charAt(0).toUpperCase() + activeCard.slice(1)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Interactive Map */}
        <div className="w-1/3 border-l border-white/10 bg-gradient-to-b from-slate-800/50 to-slate-900/50">
          <div className="h-full flex flex-col">
            {/* Map Header */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <MapIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Interactive Map</h3>
                  <p className="text-white/60 text-sm">Real-time day overview</p>
                </div>
              </div>
            </div>
            
            {/* Map Container */}
            <div className="flex-1 p-4">
              <DayMiniMap 
                day={day}
                timeSlots={timeSlots}
                className="h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}