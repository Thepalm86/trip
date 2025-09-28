'use client'

import { 
  MapPin, 
  Plus, 
  Edit3, 
  BookOpen,
  Map,
  MoreVertical,
  Copy,
  X,
  Eye,
  ExternalLink,
  Info,
  GripVertical,
  Edit,
  Trash2
} from 'lucide-react'
import { TimelineDay, DayLocation, Destination } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { useState, useRef, useEffect } from 'react'
import { BaseLocationEditModal } from '../modals/BaseLocationEditModal'
import { DestinationEditModal } from '../modals/DestinationEditModal'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DestinationOverviewModal } from '../modals/DestinationOverviewModal'
import { getExploreCategoryMetadata } from '@/lib/explore/categories'

const CATEGORY_LABELS: Record<string, string> = {
  city: 'City',
  attraction: 'Attraction',
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  accommodation: 'Accommodation',
  activity: 'Activity',
}

function formatCategoryLabel(category?: string) {
  if (!category) {
    return 'Activity'
  }

  const normalized = category.toLowerCase()
  return CATEGORY_LABELS[normalized] ?? category
}

function withAlpha(hex: string, alpha: number) {
  if (!hex) return hex
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) {
    return hex
  }
  const alphaHex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
  return `#${normalized}${alphaHex}`
}

interface DayCardProps {
  day: TimelineDay
  dayIndex: number
  isExpanded: boolean
  onAddDestination: () => void
  onAddNotes: () => void
  onSetBaseLocation: () => void
  activeDestinationId: string | null
  activeTargetDayId: string | null
  draggingFromDayId: string | null
}

interface DraggableDestinationProps {
  dayId: string
  destination: Destination
  index: number
  isSelected: boolean
  activeDestinationId: string | null
  onDestinationClick: (destination: Destination) => void
  onEditDestination: (destination: Destination) => void
  onRemoveDestination: (destinationId: string) => void
  onOpenOverview: (destination: Destination) => void
}

function DraggableDestination({
  dayId,
  destination,
  index,
  isSelected,
  activeDestinationId,
  onDestinationClick,
  onEditDestination,
  onRemoveDestination,
  onOpenOverview
}: DraggableDestinationProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: `dest-${destination.id}`,
    data: {
      type: 'destination',
      destinationId: destination.id,
      dayId,
      index,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    boxShadow: isDragging ? '0 20px 40px rgba(37,99,235,0.35)' : isOver ? '0 0 0 2px rgba(59,130,246,0.35)' : 'none',
  }

  const isActiveDrag = activeDestinationId === destination.id

  const categoryMetadata = getExploreCategoryMetadata(destination.category)
  const accentColor = categoryMetadata.colors.border
  const accentRing = categoryMetadata.colors.ring
  const badgeLabel = formatCategoryLabel(destination.category)

  const containerStyle = {
    ...style,
    borderColor: isSelected || isOver || isActiveDrag ? accentColor : withAlpha(accentColor, 0.25),
    boxShadow: isSelected
      ? `0 24px 40px ${withAlpha(accentColor, 0.35)}`
      : isOver
      ? `0 16px 32px ${withAlpha(accentColor, 0.25)}`
      : isActiveDrag
      ? `0 16px 32px ${withAlpha(accentColor, 0.2)}`
      : undefined,
    backgroundImage: `linear-gradient(135deg, ${accentRing}, rgba(15, 23, 42, 0.12))`,
  }

  return (
    <div
      ref={setNodeRef}
      style={containerStyle}
      className="group relative overflow-hidden rounded-2xl border transition-all duration-500 cursor-pointer backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation()
        onDestinationClick(destination)
      }}
    >
      {/* Action Buttons - styled like drag handle */}
      <div className="absolute top-14 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenOverview(destination)
          }}
          className="p-2 rounded-lg transition-all duration-200"
          style={{
            backgroundColor: withAlpha(accentColor, 0.12),
            border: `1px solid ${withAlpha(accentColor, 0.25)}`,
          }}
          title="View Details"
        >
          <Eye className="h-4 w-4" style={{ color: withAlpha(accentColor, 0.85) }} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEditDestination(destination)
          }}
          className="p-2 rounded-lg transition-all duration-200"
          style={{
            backgroundColor: withAlpha(accentColor, 0.12),
            border: `1px solid ${withAlpha(accentColor, 0.25)}`,
          }}
          title="Edit Destination"
        >
          <Edit className="h-4 w-4" style={{ color: withAlpha(accentColor, 0.85) }} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemoveDestination(destination.id)
          }}
          className="p-2 rounded-lg transition-all duration-200"
          style={{
            backgroundColor: withAlpha(accentColor, 0.12),
            border: `1px solid ${withAlpha(accentColor, 0.25)}`,
          }}
          title="Remove Destination"
        >
          <Trash2 className="h-4 w-4" style={{ color: withAlpha(accentColor, 0.85) }} />
        </button>
        {/* Drag Handle - most right */}
        <div
          {...attributes}
          {...listeners}
          className="p-2 rounded-lg transition-all duration-200 cursor-grab active:cursor-grabbing"
          style={{
            backgroundColor: isDragging
              ? withAlpha(accentColor, 0.35)
              : withAlpha(accentColor, 0.12),
            border: `1px solid ${withAlpha(accentColor, isDragging ? 0.45 : 0.25)}`,
            boxShadow: isDragging ? `0 12px 24px ${withAlpha(accentColor, 0.3)}` : undefined,
          }}
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 transition-colors duration-200" style={{ color: withAlpha(accentColor, 0.9) }} />
        </div>
      </div>

      {badgeLabel && (
        <div
          className="absolute -right-0.5 -top-0.5 rounded-bl-2xl rounded-tr-2xl px-3 py-1 text-[11px] uppercase tracking-wide border border-white/10 backdrop-blur-sm"
          style={{
            backgroundColor: withAlpha(accentColor, 0.25),
            color: '#f8fafc',
            borderColor: withAlpha(accentColor, 0.35),
          }}
        >
          {badgeLabel}
        </div>
      )}

      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-60"
        style={{ background: `linear-gradient(135deg, ${withAlpha(accentColor, 0.2)}, rgba(15, 23, 42, 0))` }}
      ></div>
      
      {/* Content */}
      <div className="relative flex h-full min-h-[108px] flex-col justify-center gap-2.5 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border"
                style={{
                  background: `linear-gradient(135deg, ${withAlpha(accentColor, 0.28)}, rgba(15, 23, 42, 0.2))`,
                  borderColor: withAlpha(accentColor, 0.5),
                }}
              >
                <span className="text-lg font-bold" style={{ color: accentColor }}>
                  {String.fromCharCode(65 + index)}
                </span>
              </div>
              <div
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center"
                style={{ backgroundColor: accentColor }}
              >
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            </div>
            <div>
              <h4 className="mb-1 text-lg font-bold text-white">{destination.name}</h4>
              <div className="flex items-center gap-2 text-xs text-white/70">
                {destination.city && (
                  <span className="text-white/80 text-sm font-medium">{destination.city}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {destination.notes && (
          <div className="mt-3 p-2 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-white/60 italic">
              "{destination.notes}"
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function DayCard({ 
  day, 
  dayIndex, 
  isExpanded, 
  onAddDestination, 
  onAddNotes,
  onSetBaseLocation,
  activeDestinationId,
  activeTargetDayId,
  draggingFromDayId
}: DayCardProps) {
  const {
    removeDestinationFromDay,
    duplicateDay,
    removeDay,
    setSelectedDestination,
    selectedCardId, 
    setSelectedCard,
    removeBaseLocation,
    setSelectedBaseLocation,
  } = useSupabaseTripStore()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingLocation, setEditingLocation] = useState<{ location: DayLocation; index: number } | null>(null)
  const [showDestinationEditModal, setShowDestinationEditModal] = useState(false)
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null)
  const [showOverviewModal, setShowOverviewModal] = useState(false)
  const [overviewDestination, setOverviewDestination] = useState<Destination | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isTargetDay = activeTargetDayId === day.id
  const isSourceDay = draggingFromDayId === day.id

  const accommodationMetadata = getExploreCategoryMetadata('accommodation')
  const accommodationAccent = accommodationMetadata.colors.border
  const accommodationRing = accommodationMetadata.colors.ring

  const handleRemoveDestination = (destinationId: string) => {
    removeDestinationFromDay(destinationId, day.id)
  }

  const handleDuplicateDay = () => {
    duplicateDay(day.id)
    setShowDropdown(false)
  }

  const handleRemoveDay = () => {
    removeDay(day.id)
    setShowDropdown(false)
  }

  const handleBaseLocationClick = (location: DayLocation, index: number) => {
    const cardId = `base-${day.id}-${index}`
    
    // Toggle selection
    if (selectedCardId === cardId) {
      setSelectedCard(null)
      setSelectedDestination(null)
      setSelectedBaseLocation(null)
    } else {
      setSelectedCard(cardId)
      setSelectedDestination(null)
      setSelectedBaseLocation({ dayId: day.id, index }, 'timeline')

      if (location.coordinates) {
        const [lng, lat] = location.coordinates
        window.dispatchEvent(new CustomEvent('centerMapOnDestinations', {
          detail: {
            center: { lng, lat },
            zoom: 13,
          },
        }))
      }
    }
  }

  const handleEditBaseLocation = (location: DayLocation, index: number) => {
    setEditingLocation({ location, index })
    setShowEditModal(true)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditingLocation(null)
  }

  const handleEditDestination = (destination: Destination) => {
    setEditingDestination(destination)
    setShowDestinationEditModal(true)
  }

  const handleCloseDestinationEditModal = () => {
    setShowDestinationEditModal(false)
    setEditingDestination(null)
  }

  const handleOpenOverview = (destination: Destination) => {
    setOverviewDestination(destination)
    setShowOverviewModal(true)
  }

  const handleCloseOverviewModal = () => {
    setShowOverviewModal(false)
    setOverviewDestination(null)
  }

  const handleDestinationClick = (destination: Destination) => {
    const cardId = `dest-${destination.id}`
    
    // Toggle selection
    if (selectedCardId === cardId) {
      setSelectedCard(null)
      setSelectedDestination(null)
      setSelectedBaseLocation(null)
    } else {
      setSelectedCard(cardId)
      setSelectedBaseLocation(null)
      setSelectedDestination(destination, 'timeline')

      if (destination.coordinates) {
        const [lng, lat] = destination.coordinates
        window.dispatchEvent(new CustomEvent('centerMapOnDestinations', {
          detail: {
            center: { lng, lat },
            zoom: 13,
          },
        }))
      }
    }
  }

  const handleDayClick = () => {
    if (day.destinations.length > 0) {
      // Calculate bounds to fit all destinations
      const coordinates = day.destinations.map(dest => dest.coordinates)
      
      if (coordinates.length === 1) {
        // Single destination - center on it with default zoom
        const [lng, lat] = coordinates[0]
        // You can dispatch a custom event or use a callback to update the map
        window.dispatchEvent(new CustomEvent('centerMapOnDestinations', {
          detail: { coordinates: [{ lng, lat }], zoom: 12 }
        }))
      } else if (coordinates.length > 1) {
        // Multiple destinations - calculate bounds
        const lngs = coordinates.map(coord => coord[0])
        const lats = coordinates.map(coord => coord[1])
        
        const minLng = Math.min(...lngs)
        const maxLng = Math.max(...lngs)
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)
        
        // Add padding to the bounds
        const lngPadding = (maxLng - minLng) * 0.1
        const latPadding = (maxLat - minLat) * 0.1
        
        const bounds = {
          north: maxLat + latPadding,
          south: minLat - latPadding,
          east: maxLng + lngPadding,
          west: minLng - lngPadding
        }
        
        // Calculate center point
        const centerLng = (minLng + maxLng) / 2
        const centerLat = (minLat + maxLat) / 2
        
        // Calculate appropriate zoom level based on bounds
        const lngDiff = maxLng - minLng
        const latDiff = maxLat - minLat
        const maxDiff = Math.max(lngDiff, latDiff)
        
        let zoom = 12
        if (maxDiff > 0.1) zoom = 8
        else if (maxDiff > 0.05) zoom = 10
        else if (maxDiff > 0.01) zoom = 12
        else zoom = 14
        
        window.dispatchEvent(new CustomEvent('centerMapOnDestinations', {
          detail: { 
            coordinates: coordinates.map(([lng, lat]) => ({ lng, lat })),
            bounds,
            center: { lng: centerLng, lat: centerLat },
            zoom
          }
        }))
      }
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const containerClasses = [
    'h-full flex flex-col bg-white/[0.02] rounded-2xl border border-white/10 overflow-hidden hover:bg-white/[0.04] transition-all duration-200 cursor-pointer',
    isTargetDay ? 'ring-2 ring-blue-400/60 border-blue-400/50 shadow-lg shadow-blue-500/20' : '',
    isSourceDay && !isTargetDay ? 'border-blue-400/40' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div 
      className={containerClasses}
      onClick={handleDayClick}
      title={day.destinations.length > 0 ? "Click to center map on destinations" : "No destinations to center on"}
    >
      {/* Day Header - Compact */}
      <div className="p-4 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">
              {dayIndex + 1}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Day {dayIndex + 1}</h3>
              <p className="text-xs text-white/60">
                {day.date.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAddNotes()
              }}
              className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200"
              title="Add notes"
            >
              <BookOpen className="h-4 w-4" />
            </button>

            {/* Day Actions Dropdown */}
            <div className="relative" ref={dropdownRef}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowDropdown(!showDropdown)
              }}
                className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              
              {showDropdown && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={handleDuplicateDay}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors duration-200"
                  >
                    <Copy className="h-4 w-4 text-blue-400" />
                    <span>Duplicate Day</span>
                  </button>
                  
                  <button
                    onClick={handleRemoveDay}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-red-500/20 hover:text-red-400 transition-colors duration-200"
                  >
                    <X className="h-4 w-4 text-red-400" />
                    <span>Remove Day</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
        {/* Base Locations Section */}
        <div className="order-2 p-4 border-b border-white/10 bg-white/[0.01]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Map className="h-3 w-3 text-green-400" />
              </div>
              <h4 className="text-sm font-semibold text-white/80">Accommodations</h4>
              {day.baseLocations.length > 1 && (
                <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded-full">
                  {day.baseLocations.length}
                </span>
              )}
            </div>
            <button
              onClick={onSetBaseLocation}
              className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-all duration-200"
              title="Manage accommodations"
            >
              <Edit3 className="h-3 w-3" />
            </button>
          </div>

        {day.baseLocations.length > 0 ? (
          <div className="space-y-2">
            {/* Default Base Location */}
            <div className="relative group">
              <div 
                className="relative overflow-hidden rounded-2xl border transition-all duration-500 cursor-pointer backdrop-blur-sm"
                style={{
                  borderColor: selectedCardId === `base-${day.id}-0`
                    ? accommodationAccent
                    : withAlpha(accommodationAccent, 0.25),
                  boxShadow: selectedCardId === `base-${day.id}-0`
                    ? `0 24px 40px ${withAlpha(accommodationAccent, 0.28)}`
                    : undefined,
                  backgroundImage: `linear-gradient(135deg, ${accommodationRing}, rgba(15, 23, 42, 0.1))`,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleBaseLocationClick(day.baseLocations[0], 0)
                }}
              >
                {/* Background Pattern */}
                <div
                  className="absolute inset-0 opacity-60"
                  style={{ background: `linear-gradient(135deg, ${withAlpha(accommodationAccent, 0.18)}, rgba(15, 23, 42, 0))` }}
                ></div>
                
                {/* Content */}
                <div className="relative flex h-full min-h-[108px] flex-col justify-center gap-2.5 p-4">
                  {/* Header */}
                 <div className="flex items-start justify-between">
           <div className="flex items-center gap-3">
                     <div className="relative">
                       <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border" style={{
                         background: `linear-gradient(135deg, ${withAlpha(accommodationAccent, 0.28)}, rgba(15, 23, 42, 0.2))`,
                          borderColor: withAlpha(accommodationAccent, 0.35),
                        }}>
                         <Map className="h-6 w-6" style={{ color: accommodationAccent }} />
                       </div>
                       <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center" style={{ backgroundColor: accommodationAccent }}>
                         <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
              </div>
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">{day.baseLocations[0].name}</h3>
                          <div className="flex items-center gap-2">
                          {day.baseLocations[0].city && (
                            <span className="text-white/80 text-sm font-medium">
                              {day.baseLocations[0].city}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                  </div>
                  
                  {/* Notes */}
                  {day.baseLocations[0].notes && (
                    <div className="mb-4">
                      <div className="bg-white/5 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
                        <p className="text-sm text-white/80 italic leading-relaxed">
                          "{day.baseLocations[0].notes}"
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Links */}
                  {day.baseLocations[0].links && day.baseLocations[0].links.length > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/60 font-medium uppercase tracking-wide">Quick Access</span>
                      <div className="flex items-center gap-2">
                        {day.baseLocations[0].links.slice(0, 2).map((link, _linkIndex) => (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                            style={{
                              backgroundColor: withAlpha(accommodationAccent, 0.15),
                              border: `1px solid ${withAlpha(accommodationAccent, 0.3)}`,
                              color: withAlpha(accommodationAccent, 0.85),
                            }}
                          >
                            <ExternalLink className="h-3 w-3" />
                            {link.label}
                          </a>
                        ))}
                        {day.baseLocations[0].links.length > 2 && (
                          <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                            +{day.baseLocations[0].links.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div
                  className="absolute -right-0.5 -top-0.5 rounded-bl-2xl rounded-tr-2xl px-3 py-1 text-[11px] uppercase tracking-wide border border-white/10 backdrop-blur-sm"
                  style={{
                    backgroundColor: withAlpha(accommodationAccent, 0.25),
                    color: '#f8fafc',
                    borderColor: withAlpha(accommodationAccent, 0.35),
                  }}
                >
                  Accommodation
                </div>
                {/* Action Buttons */}
                <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Create a temporary destination for overview
                      const tempDestination: Destination = {
                        id: `temp-base-${day.baseLocations[0].name}`,
                        name: day.baseLocations[0].name,
                        description: day.baseLocations[0].context,
                        coordinates: day.baseLocations[0].coordinates,
                        city: day.baseLocations[0].city,
                        category: 'city'
                      }
                      handleOpenOverview(tempDestination)
                    }}
                    className="p-2 rounded-xl transition-all duration-200 backdrop-blur-sm"
                    style={{
                      backgroundColor: withAlpha(accommodationAccent, 0.12),
                      border: `1px solid ${withAlpha(accommodationAccent, 0.25)}`,
                      color: withAlpha(accommodationAccent, 0.85),
                    }}
                    title="View overview"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditBaseLocation(day.baseLocations[0], 0)
                    }}
                    className="p-2 rounded-xl transition-all duration-200 backdrop-blur-sm"
                    style={{
                      backgroundColor: withAlpha(accommodationAccent, 0.12),
                      border: `1px solid ${withAlpha(accommodationAccent, 0.25)}`,
                      color: withAlpha(accommodationAccent, 0.85),
                    }}
                    title="Edit accommodation"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Are you sure you want to remove this accommodation?')) {
                        removeBaseLocation(day.id, 0)
                      }
                    }}
                    className="p-2 rounded-xl transition-all duration-200 backdrop-blur-sm"
                    style={{
                      backgroundColor: withAlpha(accommodationAccent, 0.12),
                      border: `1px solid ${withAlpha(accommodationAccent, 0.25)}`,
                      color: withAlpha(accommodationAccent, 0.85),
                    }}
                    title="Remove accommodation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Additional Base Locations */}
            {day.baseLocations.length > 1 && (
              <div className="space-y-2">
                {day.baseLocations.slice(1).map((location, index) => (
                  <div key={index} className="relative group">
                    <div 
                      className="relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer backdrop-blur-sm"
                      style={{
                        borderColor: selectedCardId === `base-${day.id}-${index + 1}`
                          ? accommodationAccent
                          : withAlpha(accommodationAccent, 0.2),
                        boxShadow: selectedCardId === `base-${day.id}-${index + 1}`
                          ? `0 18px 32px ${withAlpha(accommodationAccent, 0.24)}`
                          : undefined,
                        backgroundImage: `linear-gradient(135deg, ${accommodationRing}, rgba(15, 23, 42, 0.08))`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBaseLocationClick(location, index + 1)
                      }}
                    >
                      {/* Content */}
                      <div className="relative flex h-full min-h-[104px] flex-col justify-center gap-2.5 p-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center border"
                            style={{
                              background: `linear-gradient(135deg, ${withAlpha(accommodationAccent, 0.24)}, rgba(15, 23, 42, 0.18))`,
                              borderColor: withAlpha(accommodationAccent, 0.45),
                            }}
                          >
                            <Map className="h-5 w-5" style={{ color: accommodationAccent }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-white/95 mb-1">{location.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-white/70">
                              {location.city && (
                                <span className="text-white/80 font-medium">
                                  {location.city}
                                </span>
                              )}
                            </div>
                          </div>
                          
                        </div>
                        
                        {location.notes && (
                          <div className="mt-3 bg-white/5 rounded-lg p-2 border border-white/10">
                            <p className="text-xs text-white/70 italic">
                              "{location.notes}"
                            </p>
                          </div>
                        )}
                        
                        {/* Links */}
                        {location.links && location.links.length > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs text-white/60 font-medium uppercase tracking-wide">Quick Access</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {location.links.slice(0, 2).map((link, _linkIndex) => (
                                <a
                                  key={link.id}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                                  style={{
                                    backgroundColor: withAlpha(accommodationAccent, 0.15),
                                    border: `1px solid ${withAlpha(accommodationAccent, 0.3)}`,
                                    color: withAlpha(accommodationAccent, 0.85),
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {link.label}
                                </a>
                              ))}
                              {location.links.length > 2 && (
                                <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                                  +{location.links.length - 2} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            // Create a temporary destination for overview
                            const tempDestination: Destination = {
                              id: `temp-base-${location.name}`,
                              name: location.name,
                              description: location.context,
                              coordinates: location.coordinates,
                              city: location.city,
                              category: 'city'
                            }
                            handleOpenOverview(tempDestination)
                          }}
                          className="p-1.5 rounded-lg transition-all duration-200"
                          style={{
                            backgroundColor: withAlpha(accommodationAccent, 0.12),
                            border: `1px solid ${withAlpha(accommodationAccent, 0.25)}`,
                            color: withAlpha(accommodationAccent, 0.85),
                          }}
                          title="View overview"
                        >
                          <Info className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditBaseLocation(location, index + 1)
                          }}
                          className="p-1.5 rounded-lg transition-all duration-200"
                          style={{
                            backgroundColor: withAlpha(accommodationAccent, 0.12),
                            border: `1px solid ${withAlpha(accommodationAccent, 0.25)}`,
                            color: withAlpha(accommodationAccent, 0.85),
                          }}
                          title="Edit accommodation"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('Are you sure you want to remove this accommodation?')) {
                              removeBaseLocation(day.id, index + 1)
                            }
                          }}
                          className="p-1.5 rounded-lg transition-all duration-200"
                          style={{
                            backgroundColor: withAlpha(accommodationAccent, 0.12),
                            border: `1px solid ${withAlpha(accommodationAccent, 0.25)}`,
                            color: withAlpha(accommodationAccent, 0.85),
                          }}
                          title="Remove accommodation"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="border border-dashed border-white/15 rounded-2xl py-12 flex items-center justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSetBaseLocation()
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              Add Accommodation
            </button>
          </div>
        )}

        {day.baseLocations.length > 0 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSetBaseLocation()
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition-all duration-200"
            >
              <Plus className="h-3 w-3" />
              Add Optional Accommodation
            </button>
          </div>
        )}
        </div>

        {/* Activities Section */}
        {isExpanded && (
          <div className="order-1 p-4 border-b border-white/10 bg-white/[0.01]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <MapPin className="h-3 w-3 text-indigo-300" />
                </div>
                <h4 className="text-sm font-semibold text-indigo-200/90">Activities & Destinations</h4>
                <span className="text-xs text-indigo-100/70 bg-indigo-500/10 px-2 py-1 rounded-full">
                  {day.destinations.length}
                </span>
              </div>
            </div>

          {/* Activities List */}
          <div className="space-y-3">
            {day.destinations.length === 0 ? (
              <div
                className={`flex flex-col items-center justify-center gap-4 py-12 border border-dashed rounded-2xl transition-colors duration-200 ${
                  isTargetDay
                    ? 'border-indigo-400/70 bg-indigo-500/10 text-indigo-100 shadow-md shadow-indigo-500/20'
                    : 'border-white/15'
                }`}
              >
                <button
                  onClick={onAddDestination}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-100 text-sm font-medium hover:bg-indigo-500/30 transition-all duration-200"
                >
                  <Plus className="h-4 w-4" />
                  Add Activity / Destination
                </button>
                {isTargetDay ? (
                  <span className="text-xs font-medium text-indigo-100/80">
                    Drop here to move activities into this day
                  </span>
                ) : null}
              </div>
            ) : (
              <SortableContext
                id={`day-${day.id}`}
                items={day.destinations.map(dest => `dest-${dest.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {day.destinations.map((destination, index) => (
                  <DraggableDestination
                    key={destination.id}
                    dayId={day.id}
                    destination={destination}
                    index={index}
                    isSelected={selectedCardId === `dest-${destination.id}`}
                    activeDestinationId={activeDestinationId}
                    onDestinationClick={handleDestinationClick}
                    onEditDestination={handleEditDestination}
                    onRemoveDestination={handleRemoveDestination}
                    onOpenOverview={handleOpenOverview}
                  />
                ))}
              </SortableContext>
            )}
            {day.destinations.length > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddDestination()
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-100 text-xs font-medium hover:bg-indigo-500/30 transition-all duration-200"
                >
                  <Plus className="h-3 w-3" />
                  Add Activity / Destination
                </button>
              </div>
            )}
          </div>
          </div>
        )}
      </div>

      {/* Edit Accommodation Modal */}
      {showEditModal && editingLocation && (
        <BaseLocationEditModal
          dayId={day.id}
          locationIndex={editingLocation.index}
          location={editingLocation.location}
          onClose={handleCloseEditModal}
        />
      )}

      {/* Edit Destination Modal */}
      {showDestinationEditModal && editingDestination && (
        <DestinationEditModal
          dayId={day.id}
          destination={editingDestination}
          onClose={handleCloseDestinationEditModal}
        />
      )}

      {/* Destination Overview Modal */}
      {showOverviewModal && overviewDestination && (
        <DestinationOverviewModal
          destination={overviewDestination}
          onClose={handleCloseOverviewModal}
        />
      )}
    </div>
  )
}
