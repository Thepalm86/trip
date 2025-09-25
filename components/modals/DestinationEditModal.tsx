'use client'

import { useState, useEffect } from 'react'
import { X, MapPin, Edit3, Trash2, Save, Clock, DollarSign, Plus, ExternalLink, Link as LinkIcon } from 'lucide-react'
import { Destination } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'

interface DestinationEditModalProps {
  dayId: string
  destination: Destination
  onClose: () => void
}

const linkTypeOptions = [
  { value: 'website', label: 'Website', icon: '🌐' },
  { value: 'google_maps', label: 'Google Maps', icon: '🗺️' },
  { value: 'tripadvisor', label: 'TripAdvisor', icon: '⭐' },
  { value: 'airbnb', label: 'Airbnb', icon: '🏠' },
  { value: 'booking', label: 'Booking.com', icon: '🏨' },
  { value: 'hotels', label: 'Hotels.com', icon: '🏨' },
  { value: 'other', label: 'Other', icon: '🔗' }
]

export function DestinationEditModal({ dayId, destination, onClose }: DestinationEditModalProps) {
  const { updateDestination } = useSupabaseTripStore()
  const [editedDestination, setEditedDestination] = useState<Destination>(destination)
  const [isLoading, setIsLoading] = useState(false)
  const [showAddLink, setShowAddLink] = useState(false)
  const [newLink, setNewLink] = useState({ type: 'website', label: '', url: '' })

  const handleSave = async () => {
    console.log('DestinationEditModal: handleSave called', {
      dayId,
      destinationId: editedDestination.id,
      destination: editedDestination,
      originalDestination: destination
    })
    
    setIsLoading(true)
    try {
      await updateDestination(dayId, editedDestination.id, editedDestination)
      onClose()
    } catch (error) {
      console.error('DestinationEditModal: Error updating destination:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemove = async () => {
    if (confirm('Are you sure you want to remove this destination?')) {
      setIsLoading(true)
      try {
        // TODO: Implement remove destination functionality
        console.log('Remove destination:', editedDestination.id)
        onClose()
      } catch (error) {
        console.error('Error removing destination:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleAddLink = () => {
    if (newLink.label.trim() && newLink.url.trim()) {
      const link = {
        id: Date.now().toString(),
        type: newLink.type as any,
        label: newLink.label.trim(),
        url: newLink.url.trim()
      }
      
      setEditedDestination(prev => ({
        ...prev,
        links: [...(prev.links || []), link]
      }))
      
      setNewLink({ type: 'website', label: '', url: '' })
      setShowAddLink(false)
    }
  }

  const handleRemoveLink = (linkId: string) => {
    setEditedDestination(prev => ({
      ...prev,
      links: (prev.links || []).filter(link => link.id !== linkId)
    }))
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
              <h3 className="text-lg font-semibold text-white">Edit Destination</h3>
              <p className="text-sm text-white/60">Update destination details and information.</p>
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
          {/* Destination Info */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-600/10 border border-blue-400/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/20 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-white text-lg">{destination.name}</div>
                {destination.city && (
                  <div className="text-sm text-white/70 mt-1">{destination.city}</div>
                )}
              </div>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-white">
              Duration
            </label>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Clock className="h-4 w-4 text-blue-400" />
              </div>
              <input
                type="number"
                value={editedDestination.estimatedDuration || ''}
                onChange={(e) => setEditedDestination(prev => ({ 
                  ...prev, 
                  estimatedDuration: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
                placeholder="Duration in hours"
                className="flex-1 px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-green-400/20 focus:border-green-400/50 transition-all duration-200"
              />
              <span className="text-sm text-white/60">hours</span>
            </div>
          </div>

          {/* Cost */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-white">
              Cost
            </label>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-400" />
              </div>
              <input
                type="number"
                value={editedDestination.cost || ''}
                onChange={(e) => setEditedDestination(prev => ({ 
                  ...prev, 
                  cost: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
                placeholder="Cost in euros"
                className="flex-1 px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-green-400/20 focus:border-green-400/50 transition-all duration-200"
              />
              <span className="text-sm text-white/60">€</span>
            </div>
          </div>


          {/* Category */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-white">
              Category
            </label>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-purple-400" />
              </div>
              <input
                type="text"
                value={editedDestination.category || ''}
                onChange={(e) => setEditedDestination(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g., Museum, Restaurant, Park"
                className="flex-1 px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-green-400/20 focus:border-green-400/50 transition-all duration-200"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-white/80">
              Notes
            </label>
            <textarea
              value={editedDestination.notes || ''}
              onChange={(e) => setEditedDestination(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add notes about this destination (e.g., what to see, best time to visit, tips, etc.)"
              className="w-full h-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-green-400/50 transition-all duration-200 resize-none"
            />
            <div className="text-xs text-white/50">
              {editedDestination.notes?.length || 0} characters
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
            {editedDestination.links && editedDestination.links.length > 0 && (
              <div className="space-y-2">
                {editedDestination.links.map((link) => (
                  <div key={link.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
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
                        className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200"
                        title="Open link"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <button
                        onClick={() => handleRemoveLink(link.id)}
                        className="p-1 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all duration-200"
                        title="Remove link"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
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
                  <select
                    value={newLink.type}
                    onChange={(e) => setNewLink(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/20 transition-all duration-200"
                  >
                    {linkTypeOptions.map(option => (
                      <option key={option.value} value={option.value} className="bg-slate-800 text-white">
                        {option.icon} {option.label}
                      </option>
                    ))}
                  </select>
                  
                  <input
                    type="text"
                    value={newLink.label}
                    onChange={(e) => setNewLink(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="Link label"
                    className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/20 transition-all duration-200"
                  />
                  
                  <input
                    type="url"
                    value={newLink.url}
                    onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/20 transition-all duration-200"
                  />
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
                    onClick={() => {
                      setShowAddLink(false)
                      setNewLink({ type: 'website', label: '', url: '' })
                    }}
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
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-t border-white/10">
          <button
            onClick={handleRemove}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all duration-200"
            disabled={isLoading}
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 border border-white/20 text-white hover:bg-slate-700 transition-all duration-200"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white font-medium transition-all duration-200 hover:bg-green-600"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
