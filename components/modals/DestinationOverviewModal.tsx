'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ChevronUp, ChevronDown, MapPin, Loader2, Camera, User } from 'lucide-react'
import { Destination } from '@/types'

interface DestinationOverviewModalProps {
  destination: Destination
  onClose: () => void
}

interface Photo {
  id: string
  url: string
  thumbnail: string
  alt: string
  photographer: string
  photographerUrl: string
  source: string
  width: number
  height: number
}

export function DestinationOverviewModal({ destination, onClose }: DestinationOverviewModalProps) {
  const [overview, setOverview] = useState<string>('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [isLoadingOverview, setIsLoadingOverview] = useState(true)
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overviewSource, setOverviewSource] = useState<'cache' | 'api' | null>(null)
  const [photosSource, setPhotosSource] = useState<'cache' | 'api' | null>(null)

  const contentRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch destination overview from LLM
  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setIsLoadingOverview(true)
        const response = await fetch('/api/destination/overview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            destination: destination.name,
            city: destination.city,
            category: destination.category,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to fetch overview')
        }

        const data = await response.json()
        setOverview(data.overview)
        setOverviewSource(data.source || 'api')
      } catch (error) {
        console.error('Error fetching overview:', error)
        setError('Failed to load destination information')
        // Fallback to basic description
        setOverview(destination.description || `Discover ${destination.name}${destination.city ? ` in ${destination.city}` : ''}, a ${destination.category || 'destination'} worth exploring.`)
        setOverviewSource(null)
      } finally {
        setIsLoadingOverview(false)
      }
    }

    fetchOverview()
  }, [destination])

  // Fetch destination photos
  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        setIsLoadingPhotos(true)
        const searchQuery = `${destination.name}${destination.city ? ` ${destination.city}` : ''} travel`

        const response = await fetch(`/api/destination/photos?query=${encodeURIComponent(searchQuery)}&count=6`)

        if (!response.ok) {
          throw new Error('Failed to fetch photos')
        }

        const data = await response.json()
        setPhotos(data.photos)
        setPhotosSource(data.source || 'api')
      } catch (error) {
        console.error('Error fetching photos:', error)
        // Fallback to a single placeholder image
        setPhotos([{
          id: 'fallback',
          url: `https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&h=800&fit=crop&crop=center`,
          thumbnail: `https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=200&h=150&fit=crop&crop=center`,
          alt: `${destination.name} - Travel destination`,
          photographer: 'Unsplash',
          photographerUrl: 'https://unsplash.com',
          source: 'fallback',
          width: 1200,
          height: 800,
        }])
        setPhotosSource(null)
      } finally {
        setIsLoadingPhotos(false)
      }
    }

    fetchPhotos()
  }, [destination])

  // Auto-advance photo gallery
  useEffect(() => {
    if (photos.length > 1) {
      const interval = setInterval(() => {
        setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
      }, 5000) // Change photo every 5 seconds

      return () => clearInterval(interval)
    }
  }, [photos.length])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      } else if (event.key === 'ArrowLeft' && photos.length > 1) {
        setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)
      } else if (event.key === 'ArrowRight' && photos.length > 1) {
        setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, photos.length])

  // Handle scroll to expand/collapse
  const handleScroll = () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (contentRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
        const isAtTop = scrollTop <= 10

        if (isAtBottom && !isExpanded) {
          setIsExpanded(true)
        } else if (isAtTop && isExpanded) {
          setIsExpanded(false)
        }
      }
    }, 100)
  }

  // Handle photo navigation
  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
  }

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)
  }

  return (
    <>
      {/* Background Photo Gallery - Full viewport behind modal */}
      <div className="fixed inset-0 z-40">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
        {photos.length > 0 && (
          <div className="absolute inset-0">
            <img
              src={photos[currentPhotoIndex].url}
              alt={photos[currentPhotoIndex].alt}
              className="w-full h-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60"></div>
          </div>
        )}

        {/* Photo Navigation Dots */}
        {photos.length > 1 && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 z-50">
            {photos.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPhotoIndex(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentPhotoIndex
                    ? 'bg-white w-6'
                    : 'bg-white/50 hover:bg-white/75'
                }`}
                aria-label={`View photo ${index + 1} of ${photos.length}`}
              />
            ))}
          </div>
        )}

        {/* Photo Navigation Arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={prevPhoto}
              className="absolute left-6 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white/80 hover:text-white transition-all duration-300 z-50"
              aria-label="Previous photo"
            >
              <ChevronUp className="h-6 w-6 rotate-[-90deg]" />
            </button>
            <button
              onClick={nextPhoto}
              className="absolute right-6 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white/80 hover:text-white transition-all duration-300 z-50"
              aria-label="Next photo"
            >
              <ChevronUp className="h-6 w-6 rotate-90" />
            </button>
          </>
        )}

        {/* Photo Attribution */}
        {photos.length > 0 && photos[currentPhotoIndex].photographer && (
          <div className="absolute bottom-16 left-6 bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2 text-white/80 text-sm z-50">
            <a
              href={photos[currentPhotoIndex].photographerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-white transition-colors duration-200"
            >
              <Camera className="h-4 w-4" />
              <span>{photos[currentPhotoIndex].photographer}</span>
            </a>
          </div>
        )}
      </div>

      {/* Main Modal Container - Top Left Position */}
      <div className="fixed inset-0 z-50 flex items-start justify-start p-8">
        <div
          className="w-[70%] max-w-4xl h-[80vh] bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          role="dialog"
          aria-labelledby="modal-title"
          aria-modal="true"
        >
          {/* Modal Header */}
          <div className="relative p-6 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Location Icon */}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/30 to-purple-500/20 flex items-center justify-center border border-blue-400/30 shadow-lg">
                  <MapPin className="h-6 w-6 text-blue-400" />
                </div>

                {/* Title Section */}
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/60 mb-1">
                    {destination.city || 'Location'}
                  </div>
                  <h1 id="modal-title" className="text-2xl font-bold text-white mb-2">
                    {destination.name}
                  </h1>
                  <div className="text-sm font-semibold uppercase tracking-wide text-blue-400">
                    {destination.category || 'Destination'}
                  </div>

                  {/* Data Source Indicators */}
                  <div className="flex items-center gap-3 mt-2">
                    {overviewSource && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                        overviewSource === 'cache'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          overviewSource === 'cache' ? 'bg-green-400' : 'bg-blue-400'
                        }`}></div>
                        {overviewSource === 'cache' ? 'Cached' : 'Live'}
                      </div>
                    )}
                    {photosSource && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                        photosSource === 'cache'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        <Camera className="h-3 w-3" />
                        <div className={`w-2 h-2 rounded-full ${
                          photosSource === 'cache' ? 'bg-green-400' : 'bg-blue-400'
                        }`}></div>
                        {photosSource === 'cache' ? 'Cached' : 'Live'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all duration-200"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full flex">
              {/* Text Content Column */}
              <div className="flex-1 p-6 overflow-y-auto scrollbar-hide">
                <div
                  ref={contentRef}
                  onScroll={handleScroll}
                  className="max-w-2xl prose prose-invert prose-lg"
                >
                  {isLoadingOverview ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
                      <span className="ml-3 text-white/80">Loading destination information...</span>
                    </div>
                  ) : error ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  ) : (
                    <div className="text-white/90 leading-relaxed">
                      {overview.split('\n\n').map((paragraph, index) => (
                        <p key={index} className="mb-4 last:mb-0">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Expand/Collapse Indicator */}
              <div className="w-12 flex items-center justify-center border-l border-white/10">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all duration-200"
                  aria-label={isExpanded ? 'Collapse content' : 'Expand content'}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Click Outside to Close */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
    </>
  )
}