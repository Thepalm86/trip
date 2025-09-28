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
  Trash2,
  ArrowRight,
} from 'lucide-react'
import { TimelineDay, DayLocation, Destination } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { useState, useRef, useEffect, Fragment, type CSSProperties, type ReactNode } from 'react'
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
import {
  BASE_ROUTE_COLOR,
  buildInterDayKey,
  buildIntraFinalKey,
  buildIntraSequenceKey,
  getDestinationColor,
  getWaypointKey,
} from '@/lib/map/route-style'

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
  accentColor: string
}

const coordinatesAreEqual = (
  a?: [number, number],
  b?: [number, number]
) => {
  if (!a || !b) {
    return false
  }
  return a[0] === b[0] && a[1] === b[1]
}

const applyAlpha = (hex: string, alpha: string) => {
  if (hex.startsWith('#') && hex.length === 7) {
    return `${hex}${alpha}`
  }
  return hex
}

const formatCategoryLabel = (category?: string) => {
  if (!category) {
    return 'Destination'
  }

  const normalized = category.replace(/[_-]+/g, ' ').trim()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const buildBadgeStyle = (accent: string): CSSProperties => ({
  background: `linear-gradient(135deg, ${applyAlpha(accent, '36')} 0%, ${applyAlpha(accent, '12')} 100%)`,
  borderColor: applyAlpha(accent, '80'),
  boxShadow: `0 18px 36px ${applyAlpha(accent, '22')}`,
  color: '#e2e8f0'
})

function CornerBadge({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="pointer-events-none absolute top-0 right-0 z-10 select-none">
      <div
        className="rounded-bl-3xl rounded-tr-2xl border px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-lg"
        style={buildBadgeStyle(accent)}
      >
        {label}
      </div>
    </div>
  )
}

interface RouteConnectorProps {
  color: string
  label: string
  routeKey: string
  isSelected: boolean
  onSelect: (routeKey: string) => void
  showTopSegment?: boolean
  showBottomSegment?: boolean
}

function RouteConnector({
  color,
  label,
  routeKey,
  isSelected,
  onSelect,
  showTopSegment = true,
  showBottomSegment = true,
}: RouteConnectorProps) {
  const capsuleStyle: CSSProperties = {
    borderColor: applyAlpha(color, isSelected ? 'AA' : '66'),
    background: isSelected
      ? `linear-gradient(135deg, ${applyAlpha(color, '48')} 0%, ${applyAlpha(color, '18')} 100%)`
      : `linear-gradient(135deg, rgba(15,23,42,0.65) 0%, rgba(30,41,59,0.35) 100%)`,
    boxShadow: isSelected
      ? `0px 16px 40px ${applyAlpha(color, '30')}`
      : `0px 12px 30px rgba(15, 23, 42, 0.35)`
  }

  const iconRingStyle: CSSProperties = {
    borderColor: applyAlpha(color, 'AA'),
    background: `linear-gradient(135deg, ${applyAlpha(color, '38')} 0%, ${applyAlpha(color, '14')} 100%)`,
    color: applyAlpha(color, 'F2')
  }

  const topSegmentStyle: CSSProperties = {
    background: `linear-gradient(180deg, rgba(148, 163, 184, 0) 0%, ${applyAlpha(color, '66')} 100%)`,
    top: 0,
    bottom: '50%'
  }

  const bottomSegmentStyle: CSSProperties = {
    background: `linear-gradient(180deg, ${applyAlpha(color, '66')} 0%, rgba(148, 163, 184, 0) 100%)`,
    top: '50%',
    bottom: 0
  }

  return (
    <div className="relative my-4 flex flex-col items-center py-5">
      {showTopSegment ? (
        <div
          className="pointer-events-none absolute left-1/2 w-[2px] -translate-x-1/2 opacity-80"
          style={topSegmentStyle}
        />
      ) : null}
      {showBottomSegment ? (
        <div
          className="pointer-events-none absolute left-1/2 w-[2px] -translate-x-1/2 opacity-80"
          style={bottomSegmentStyle}
        />
      ) : null}
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(routeKey)
        }}
        onMouseDown={(event) => event.stopPropagation()}
        className={`relative z-10 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold text-slate-100 transition-all duration-200 ${
          isSelected
            ? 'ring-2 ring-white/20'
            : 'hover:border-white/30 hover:text-white'
        }`}
        style={capsuleStyle}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-white"
          style={iconRingStyle}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
        <span className="whitespace-nowrap leading-none">{label}</span>
      </button>
    </div>
  )
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
  onOpenOverview,
  accentColor,
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

  const shadowDragging = `0 20px 40px ${applyAlpha(accentColor, '40')}`
  const shadowOver = `0 0 0 2px ${applyAlpha(accentColor, '40')}`
  const shadowSelected = `0 18px 36px ${applyAlpha(accentColor, '26')}`

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    boxShadow: isDragging ? shadowDragging : isOver ? shadowOver : isSelected ? shadowSelected : 'none',
    borderColor: isSelected ? accentColor : applyAlpha(accentColor, '55'),
    background: `linear-gradient(135deg, ${applyAlpha(accentColor, '14')} 0%, rgba(15, 23, 42, 0.55) 100%)`,
  }

  const isActiveDrag = activeDestinationId === destination.id

  const accentBarStyle: CSSProperties = {
    background: `linear-gradient(180deg, ${applyAlpha(accentColor, 'b3')} 0%, ${applyAlpha(accentColor, '33')} 75%, transparent 100%)`
  }

  const badgeStyle: CSSProperties = {
    background: `linear-gradient(135deg, ${applyAlpha(accentColor, '30')} 0%, transparent 100%)`,
    borderColor: applyAlpha(accentColor, '55')
  }

  const dotStyle: CSSProperties = {
    backgroundColor: accentColor
  }

  const cityTextStyle: CSSProperties = {
    color: '#cbd5f5'
  }

  const actionButtonStyle: CSSProperties = {
    background: applyAlpha(accentColor, '20'),
    borderColor: applyAlpha(accentColor, '55'),
    color: '#e0ecff'
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex min-h-[100px] cursor-pointer flex-col justify-center rounded-2xl border bg-white/[0.02] transition-all duration-500 hover:bg-white/[0.04] overflow-visible ${
        isSelected
          ? 'border-white/50'
          : isOver
          ? 'border-white/30'
          : isActiveDrag
          ? 'border-white/20'
          : 'border-white/10 hover:border-white/20'
      }`}
      onClick={(e) => {
        e.stopPropagation()
        onDestinationClick(destination)
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-3 left-[2px] w-[2px] rounded-r-full opacity-70"
        style={{ ...accentBarStyle, background: `linear-gradient(180deg, ${applyAlpha(accentColor, '99')} 0%, ${applyAlpha(accentColor, '22')} 90%)` }}
      />
      {/* Action Buttons moved to bottom */}
      <div className="absolute bottom-3 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenOverview(destination)
          }}
          className="p-2 rounded-lg border transition-all duration-200 hover:scale-105"
          style={actionButtonStyle}
          title="View Details"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEditDestination(destination)
          }}
          className="p-2 rounded-lg border transition-all duration-200 hover:scale-105"
          style={actionButtonStyle}
          title="Edit Destination"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemoveDestination(destination.id)
          }}
          className="p-2 rounded-lg border transition-all duration-200 hover:scale-105"
          style={{ ...actionButtonStyle, color: '#ffd5d5', borderColor: applyAlpha('#ef4444', '70'), background: applyAlpha('#ef4444', '18') }}
          title="Remove Destination"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        {/* Drag Handle - most right */}
        <div
          {...attributes}
          {...listeners}
          className="p-2 rounded-lg border transition-all duration-200 cursor-grab active:cursor-grabbing"
          style={actionButtonStyle}
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className={`h-4 w-4 transition-colors duration-200 ${
            isDragging ? 'text-white' : 'text-slate-100'
          }`} />
        </div>
      </div>

      <CornerBadge label={formatCategoryLabel(destination.category)} accent={accentColor} />

      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-40"
        style={{ background: `linear-gradient(140deg, ${applyAlpha(accentColor, '12')} 0%, transparent 70%)` }}
      ></div>
      
      {/* Content */}
      <div className="relative flex h-full flex-col justify-center gap-3 px-5 pt-5 pb-7">
        {/* Header */}
        <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl border shadow-lg"
                style={badgeStyle}
              >
                <span className="text-lg font-bold" style={{ color: accentColor }}>
                  {String.fromCharCode(65 + index)}
                </span>
              </div>
              <div
                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-slate-900"
                style={dotStyle}
              >
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            </div>
            <div>
              <h4 className="mb-1 text-lg font-bold text-white">{destination.name}</h4>
              <div className="flex items-center gap-2">
                {destination.city && (
                  <span className="text-sm font-medium" style={cityTextStyle}>
                    {destination.city}
                  </span>
                )}
              </div>
            </div>
          </div>
        {destination.notes && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <p className="text-xs italic text-white/60">"{destination.notes}"</p>
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
    setSelectedDay,
    selectedRouteSegmentId,
    setSelectedRouteSegmentId,
    currentTrip,
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
  const allTripDays = currentTrip?.days ?? []

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

  const handleRouteSelect = (routeKey: string) => {
    setSelectedDay(day.id)
    const nextRouteKey = selectedRouteSegmentId === routeKey ? null : routeKey
    setSelectedRouteSegmentId(nextRouteKey)
    window.dispatchEvent(new CustomEvent('timelineRouteSelect', {
      detail: { routeId: nextRouteKey }
    }))
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
                    onClick={() => {
                      onAddDestination()
                      setShowDropdown(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors duration-200"
                  >
                    <Plus className="h-4 w-4 text-blue-400" />
                    <span>Add Activity / Destination</span>
                  </button>

                  <button
                    onClick={() => {
                      onSetBaseLocation()
                      setShowDropdown(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors duration-200"
                  >
                    <Map className="h-4 w-4 text-green-400" />
                    <span>Add Accommodation</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      onAddNotes()
                      setShowDropdown(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors duration-200"
                  >
                    <BookOpen className="h-4 w-4 text-green-400" />
                    <span>Add Notes</span>
                  </button>
                  
                  <div className="border-t border-white/10 my-1"></div>
                  
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
              <h4 className="text-[0.95rem] font-semibold text-white/80">Accommodations</h4>
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
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500/15 via-green-500/10 to-emerald-500/5 border transition-all duration-500 cursor-pointer hover:shadow-xl hover:shadow-green-500/10 ${
                  selectedCardId === `base-${day.id}-0` 
                    ? 'border-green-400 border-2 shadow-xl shadow-green-500/20' 
                    : 'border-green-400/20 hover:border-green-400/40'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleBaseLocationClick(day.baseLocations[0], 0)
                }}
              >
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-50"></div>
                
                {/* Content */}
                <div className="relative px-5 py-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/30 to-emerald-500/20 flex items-center justify-center shadow-lg border border-green-400/30">
                          <Map className="h-5 w-5 text-green-400" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
              </div>
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">{day.baseLocations[0].name}</h3>
                          {day.baseLocations[0].city && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-green-400 font-medium">
                                {day.baseLocations[0].city}
                              </span>
                            </div>
                          )}
                        </div>
                    </div>
                    
                  </div>
                  
                  {/* Notes */}
                  {day.baseLocations[0].notes && (
                    <div className="mb-3">
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 rounded-lg text-xs font-medium transition-all duration-200 border border-blue-500/30 hover:border-blue-400/50"
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
                
                <CornerBadge label="Accommodation" accent={BASE_ROUTE_COLOR} />

                {/* Action Buttons */}
                <div className="absolute bottom-3 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
                    className="p-2 rounded-xl bg-white/10 hover:bg-blue-500/20 text-white/70 hover:text-blue-400 transition-all duration-200 backdrop-blur-sm"
                    title="View overview"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditBaseLocation(day.baseLocations[0], 0)
                    }}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all duration-200 backdrop-blur-sm"
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
                    className="p-2 rounded-xl bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-400 transition-all duration-200 backdrop-blur-sm"
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
                      className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-white/8 via-white/5 to-white/3 border transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-white/5 ${
                        selectedCardId === `base-${day.id}-${index + 1}` 
                          ? 'border-white/40 border-2 shadow-lg shadow-white/10' 
                          : 'border-white/15 hover:border-white/25'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBaseLocationClick(location, index + 1)
                      }}
                    >
                      {/* Content */}
                      <div className="relative p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                            <Map className="h-5 w-5 text-white/70" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-white/95 mb-1">{location.name}</h4>
                            <div className="flex items-center gap-2">
                              {location.city && (
                                <span className="text-xs font-medium" style={{ color: '#cbd5f5' }}>
                                  {location.city}
                                </span>
                              )}
                              {location.city && <div className="w-1 h-1 bg-white/40 rounded-full"></div>}
                              <span className="text-xs text-white/50">Alternative</span>
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
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 rounded-lg text-xs font-medium transition-all duration-200 border border-blue-500/30 hover:border-blue-400/50"
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
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-blue-500/20 text-white/60 hover:text-blue-400 transition-all duration-200"
                          title="View overview"
                        >
                          <Info className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditBaseLocation(location, index + 1)
                          }}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all duration-200"
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
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all duration-200"
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
            <div className="flex justify-end pt-4">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSetBaseLocation()
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm font-medium transition-all duration-200 hover:bg-emerald-500/30 hover:border-emerald-400/60"
              >
                <Plus className="h-4 w-4" />
                Add Alternative Accommodation
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end py-6">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSetBaseLocation()
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm font-medium transition-all duration-200 hover:bg-emerald-500/30 hover:border-emerald-400/60"
            >
              <Plus className="h-4 w-4" />
              Add Alternative Accommodation
            </button>
          </div>
        )}
        </div>

        {/* Activities Section */}
        {isExpanded && (
          <div className="order-1 p-4 border-b border-white/10 bg-white/[0.01]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <MapPin className="h-3 w-3 text-blue-400" />
                </div>
                <h4 className="text-[0.95rem] font-semibold text-white/80">Activities & Destinations</h4>
                <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded-full">
                  {day.destinations.length}
                </span>
              </div>
            </div>

          {/* Activities List */}
          <div className="space-y-3">
            {day.destinations.length === 0 ? (
              <div
                className={`text-center py-12 border border-dashed rounded-2xl transition-colors duration-200 flex flex-col items-center gap-4 ${
                  isTargetDay
                    ? 'border-blue-400/70 bg-blue-500/10 text-blue-100 shadow-md shadow-blue-500/20'
                    : 'border-white/10 text-white'
                }`}
              >
                <button
                  onClick={onAddDestination}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all duration-200"
                >
                  <Plus className="h-4 w-4" />
                  Add First Activity
                </button>
                {isTargetDay ? (
                  <p className="text-xs font-medium text-blue-100/80">
                    Drop to move destination into this day
                  </p>
                ) : null}
              </div>
            ) : (
              <>
              <SortableContext
                id={`day-${day.id}`}
                items={day.destinations.map(dest => `dest-${dest.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {day.destinations.map((destination, index) => {
                  const accentColor = getDestinationColor(index)
                  const nextDestination = day.destinations[index + 1]
                  const segmentNodes: ReactNode[] = []
                  const preConnectorNodes: ReactNode[] = []

                  if (index === 0 && dayIndex > 0 && allTripDays.length > dayIndex) {
                    const previousDay = allTripDays[dayIndex - 1]
                    if (previousDay) {
                      const previousBase = previousDay.baseLocations?.[0]
                      const previousDestFallback = previousDay.destinations[previousDay.destinations.length - 1]
                      const originName = previousBase?.name ?? previousDestFallback?.name ?? 'Previous Day'
                      const originCoordinates = previousBase?.coordinates ?? previousDestFallback?.coordinates

                      if (
                        originCoordinates &&
                        destination.coordinates &&
                        !coordinatesAreEqual(originCoordinates, destination.coordinates)
                      ) {
                        const routeKey = buildInterDayKey(previousDay.id, day.id)
                        preConnectorNodes.push(
                          <RouteConnector
                            key={`connector-${routeKey}`}
                            color={accentColor}
                            label={`Route from ${originName}`}
                            routeKey={routeKey}
                            isSelected={selectedRouteSegmentId === routeKey}
                            onSelect={handleRouteSelect}
                            showTopSegment={false}
                          />
                        )
                      }
                    }
                  }

                  if (
                    nextDestination &&
                    !coordinatesAreEqual(destination.coordinates, nextDestination.coordinates)
                  ) {
                    const fromKey = getWaypointKey(destination.id, destination.coordinates)
                    const toKey = getWaypointKey(nextDestination.id, nextDestination.coordinates)
                    const routeKey = buildIntraSequenceKey(day.id, index, fromKey, toKey)

                    segmentNodes.push(
                      <RouteConnector
                        key={`connector-${routeKey}`}
                        color={getDestinationColor(index + 1)}
                        label={`Route to ${nextDestination.name}`}
                        routeKey={routeKey}
                        isSelected={selectedRouteSegmentId === routeKey}
                        onSelect={handleRouteSelect}
                      />
                    )
                  }

                  const isLastDestination = index === day.destinations.length - 1
                  const primaryBase = day.baseLocations[0]

                  if (
                    isLastDestination &&
                    primaryBase &&
                    primaryBase.coordinates &&
                    !coordinatesAreEqual(destination.coordinates, primaryBase.coordinates)
                  ) {
                    const fromKey = getWaypointKey(destination.id, destination.coordinates)
                    const toKey = getWaypointKey(undefined, primaryBase.coordinates)
                    const routeKey = buildIntraFinalKey(day.id, fromKey, toKey)

                    segmentNodes.push(
                      <RouteConnector
                        key={`connector-${routeKey}`}
                        color={BASE_ROUTE_COLOR}
                        label={`Route to ${primaryBase.name}`}
                        routeKey={routeKey}
                        isSelected={selectedRouteSegmentId === routeKey}
                        onSelect={handleRouteSelect}
                        showBottomSegment={false}
                      />
                    )
                  }

                  return (
                    <Fragment key={destination.id}>
                      {preConnectorNodes}
                      <DraggableDestination
                        dayId={day.id}
                        destination={destination}
                        index={index}
                        isSelected={selectedCardId === `dest-${destination.id}`}
                        activeDestinationId={activeDestinationId}
                        onDestinationClick={handleDestinationClick}
                        onEditDestination={handleEditDestination}
                        onRemoveDestination={handleRemoveDestination}
                        onOpenOverview={handleOpenOverview}
                        accentColor={accentColor}
                      />
                      {segmentNodes}
                    </Fragment>
                  )
                })}
              </SortableContext>
              <div className="flex justify-end pt-4">
                <button
                  onClick={onAddDestination}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all duration-200"
                >
                  <Plus className="h-4 w-4" />
                  Add Activity / Destination
                </button>
              </div>
              </>
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
