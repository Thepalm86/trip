'use client'

import { useState } from 'react'
import { X, MapPin, Edit3, Save, Plus, ExternalLink, Link as LinkIcon, Edit } from 'lucide-react'
import { DayLocation, LocationLink } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'

interface BaseLocationEditModalProps {
  dayId: string
  locationIndex: number
  location: DayLocation
  onClose: () => void
}

export function BaseLocationEditModal({ dayId, locationIndex, location, onClose }: BaseLocationEditModalProps) {
  const { updateBaseLocation } = useSupabaseTripStore()
  const [editedLocation, setEditedLocation] = useState<DayLocation>(location)
  const [isLoading, setIsLoading] = useState(false)
  const [showAddLink, setShowAddLink] = useState(false)
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [newLink, setNewLink] = useState<Omit<LocationLink, 'id'>>({
    type: 'website',
    label: '',
    url: ''
  })
  const [editingLink, setEditingLink] = useState<Omit<LocationLink, 'id'>>({
    type: 'website',
    label: '',
    url: ''
  })

  const linkTypeOptions = [
    { value: 'airbnb', label: 'Airbnb', icon: '🏠' },
    { value: 'booking', label: 'Booking.com', icon: '🏨' },
    { value: 'hotels', label: 'Hotels.com', icon: '🏨' },
    { value: 'google_maps', label: 'Google Maps', icon: '🗺️' },
    { value: 'tripadvisor', label: 'TripAdvisor', icon: '⭐' },
    { value: 'website', label: 'Website', icon: '🌐' },
    { value: 'other', label: 'Other', icon: '🔗' }
  ]

  const handleSave = async () => {
    setIsLoading(true)
    try {
      await updateBaseLocation(dayId, locationIndex, editedLocation)
      onClose()
    } catch (error) {
      console.error('Error updating base location:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddLink = () => {
    if (newLink.label.trim() && newLink.url.trim()) {
      const link: LocationLink = {
        id: `link-${Date.now()}`,
        ...newLink
      }
      setEditedLocation(prev => ({
        ...prev,
        links: [...(prev.links || []), link]
      }))
      setNewLink({ type: 'website', label: '', url: '' })
      setShowAddLink(false)
    } else {
      console.log('Link validation failed:', { label: newLink.label.trim(), url: newLink.url.trim() })
    }
  }

  const handleRemoveLink = (linkId: string) => {
    setEditedLocation(prev => ({
      ...prev,
      links: prev.links?.filter(link => link.id !== linkId) || []
    }))
  }

  const handleEditLink = (link: LocationLink) => {
    setEditingLinkId(link.id)
    setEditingLink({
      type: link.type,
      label: link.label,
      url: link.url
    })
  }

  const handleSaveEditLink = () => {
    if (editingLinkId && editingLink.label.trim() && editingLink.url.trim()) {
      setEditedLocation(prev => ({
        ...prev,
        links: prev.links?.map(link => 
          link.id === editingLinkId 
            ? { ...link, ...editingLink }
            : link
        ) || []
      }))
      setEditingLinkId(null)
      setEditingLink({ type: 'website', label: '', url: '' })
    }
  }

  const handleCancelEditLink = () => {
    setEditingLinkId(null)
    setEditingLink({ type: 'website', label: '', url: '' })
  }

  const generateLinkUrl = (type: string, locationName: string) => {
    const encodedName = encodeURIComponent(locationName)
    switch (type) {
      case 'airbnb':
        return `https://www.airbnb.com/s/${encodedName}`
      case 'booking':
        return `https://www.booking.com/searchresults.html?ss=${encodedName}`
      case 'hotels':
        return `https://www.hotels.com/search.do?q-destination=${encodedName}`
      case 'google_maps':
        return `https://www.google.com/maps/search/${encodedName}`
      case 'tripadvisor':
        return `https://www.tripadvisor.com/Search?q=${encodedName}`
      default:
        return ''
    }
  }

  const handleLinkTypeChange = (type: string, isEditing: boolean = false) => {
    const url = generateLinkUrl(type, location.name)
    if (isEditing) {
      setEditingLink(prev => ({ ...prev, type: type as any, url }))
    } else {
      setNewLink(prev => ({ ...prev, type: type as any, url }))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
              <Edit3 className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Edit Accommodation</h3>
              <p className="text-sm text-white/60">Update location details and notes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-6">
          {/* Location Info */}
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-green-400" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white text-base">{location.name}</div>
                {location.city && (
                  <div className="text-sm text-white/70 mt-1">{location.city}</div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-white/80">
              Notes
            </label>
            <textarea
              value={editedLocation.notes || ''}
              onChange={(e) => setEditedLocation(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add notes about this accommodation (e.g., why you chose it, what to do there, etc.)"
              className="w-full h-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-green-400/50 transition-all duration-200 resize-none"
            />
            <div className="text-xs text-white/50">
              {editedLocation.notes?.length || 0} characters
            </div>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-white/80">
                Links
              </label>
              <button
                onClick={() => setShowAddLink(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-all duration-200"
              >
                <Plus className="h-3 w-3" />
                Add Link
              </button>
            </div>

            {/* Existing Links */}
            {editedLocation.links && editedLocation.links.length > 0 && (
              <div className="space-y-2">
                {editedLocation.links.map((link) => (
                  <div key={link.id}>
                    {editingLinkId === link.id ? (
                      /* Edit Link Form */
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-3">
                        <div className="flex items-center gap-2">
                          <Edit className="h-4 w-4 text-green-400" />
                          <span className="text-sm font-medium text-white">Edit Link</span>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs text-white/60 mb-1">Type</label>
                            <select
                              value={editingLink.type}
                              onChange={(e) => handleLinkTypeChange(e.target.value, true)}
                              className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/20 transition-all duration-200"
                            >
                              {linkTypeOptions.map((option) => (
                                <option key={option.value} value={option.value} className="bg-slate-800 text-white">
                                  {option.icon} {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-xs text-white/60 mb-1">Label</label>
                            <input
                              type="text"
                              value={editingLink.label}
                              onChange={(e) => setEditingLink(prev => ({ ...prev, label: e.target.value }))}
                              placeholder="e.g., Book on Airbnb"
                              className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/20 transition-all duration-200"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs text-white/60 mb-1">URL</label>
                            <input
                              type="url"
                              value={editingLink.url}
                              onChange={(e) => setEditingLink(prev => ({ ...prev, url: e.target.value }))}
                              placeholder="https://..."
                              className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/20 transition-all duration-200"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveEditLink}
                            disabled={!editingLink.label.trim() || !editingLink.url.trim()}
                            className="flex-1 px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                          >
                            Save Changes
                          </button>
                          <button
                            onClick={handleCancelEditLink}
                            className="px-3 py-1 bg-white/10 text-white text-sm rounded hover:bg-white/20 transition-all duration-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Link Display */
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all duration-200" onClick={() => handleEditLink(link)}>
                        <span className="text-sm">{linkTypeOptions.find(opt => opt.value === link.type)?.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{link.label}</div>
                          <div className="text-xs text-white/50 truncate">{link.url}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200"
                            title="Open link"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditLink(link)
                            }}
                            className="p-1 rounded hover:bg-blue-500/20 text-white/60 hover:text-blue-400 transition-all duration-200"
                            title="Edit link"
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveLink(link.id)
                            }}
                            className="p-1 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all duration-200"
                            title="Remove link"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add Link Form */}
            {showAddLink && (
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-medium text-white">Add New Link</span>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Type</label>
                            <select
                              value={newLink.type}
                              onChange={(e) => handleLinkTypeChange(e.target.value, false)}
                              className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/20 transition-all duration-200"
                            >
                      {linkTypeOptions.map((option) => (
                        <option key={option.value} value={option.value} className="bg-slate-800 text-white">
                          {option.icon} {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Label</label>
                    <input
                      type="text"
                      value={newLink.label}
                      onChange={(e) => setNewLink(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="e.g., Book on Airbnb"
                      className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/20 transition-all duration-200"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-white/60 mb-1">URL</label>
                    <input
                      type="url"
                      value={newLink.url}
                      onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/20 transition-all duration-200"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddLink}
                    disabled={!newLink.label.trim() || !newLink.url.trim()}
                    className="flex-1 px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Add Link
                  </button>
                  <button
                    onClick={() => setShowAddLink(false)}
                    className="px-3 py-1 bg-white/10 text-white text-sm rounded hover:bg-white/20 transition-all duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-green-500/40"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
