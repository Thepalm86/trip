'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Destination } from '@/types'
import { supabase } from '@/lib/supabase/client'

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token

  if (!accessToken) {
    throw new Error('Unable to authenticate request')
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  }
}

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
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.body.style.overflow = originalStyle
    }
  }, [])

  // Fetch destination overview from LLM
  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setIsLoadingOverview(true)
        const response = await fetch('/api/destination/overview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
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
      } catch (error) {
        console.error('Error fetching overview:', error)
        setError('Failed to load destination information')
        // Fallback to basic description
        setOverview(destination.description || `Discover ${destination.name}${destination.city ? ` in ${destination.city}` : ''}, a ${destination.category || 'destination'} worth exploring.`)
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
        const authHeaders = await getAuthHeaders()
        const response = await fetch(`/api/destination/photos?query=${encodeURIComponent(searchQuery)}&count=10`, {
          headers: authHeaders,
        })

        if (!response.ok) {
          throw new Error('Failed to fetch photos')
        }

        const data = await response.json()
        setPhotos(data.photos)
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
      } finally {
        setIsLoadingPhotos(false)
      }
    }

    fetchPhotos()
  }, [destination])

  // Auto-advance photo gallery
  useEffect(() => {
    if (photos.length <= 1) return

    const interval = setInterval(() => {
      setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
    }, 8000)

    return () => clearInterval(interval)
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

  // Handle photo navigation
  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
  }

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)
  }

  interface OverviewSection {
    title?: string
    body: string
  }

  const overviewSections = useMemo<OverviewSection[]>(() => {
    const paragraphs = overview
      .split('\n\n')
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)

    if (paragraphs.length === 0) {
      const trimmed = overview.trim()
      return trimmed ? [{ body: trimmed }] : []
    }

    return paragraphs.map((paragraph) => {
      const headingMatch = paragraph.match(/^([A-Z][^:\u2013\u2014-]{2,80})([:\u2013\u2014-])\s+/)
      if (headingMatch) {
        const [, rawTitle, separator] = headingMatch
        const remainder = paragraph.slice(headingMatch[0].length).trim()
        return {
          title: rawTitle.trim(),
          body: remainder.length > 0 ? remainder : paragraph.replace(`${rawTitle}${separator}`, '').trim(),
        }
      }
      return { body: paragraph }
    })
  }, [overview])

  const enrichedSections = useMemo(() => {
    const fallbackTitles = ['Overview', 'Highlights', "Why You'll Love It", 'Practical Notes', 'Insider Tips']
    return overviewSections.map((section, index) => {
      if (section.title && section.title.trim().length > 0) {
        return section
      }
      const fallback = fallbackTitles[index] || `Section ${index + 1}`
      return { ...section, title: fallback }
    })
  }, [overviewSections])

  const displaySections = enrichedSections

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        backgroundColor: '#060a16',
        overflow: 'hidden',
        cursor: 'pointer'
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="destination-overview-title"
    >
      {/* Background Image Stack */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {photos.length > 0 ? (
          photos.map((photo, index) => (
            <img
              key={photo.id || `${photo.url}-${index}`}
              src={photo.url}
              alt={photo.alt}
              loading={index === currentPhotoIndex ? 'eager' : 'lazy'}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: index === currentPhotoIndex ? 1 : 0,
                transition: 'opacity 0.8s ease-in-out',
                transform: 'scale(1)',
                willChange: 'opacity'
              }}
            />
          ))
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(135deg, rgba(27,38,59,1) 0%, rgba(40,54,82,1) 50%, rgba(17,24,39,0.85) 100%)'
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 20% 20%, rgba(8,15,30,0.18) 0%, rgba(7,11,22,0.55) 70%)'
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(120deg, rgba(5,9,20,0.28) 0%, rgba(6,11,24,0.18) 45%, rgba(6,10,22,0.32) 100%)'
          }}
        />
      </div>

      {/* Floating Card */}
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'absolute',
          top: 40,
          left: 40,
          width: 'min(500px, calc(100vw - 80px))',
          maxHeight: 'calc(100vh - 80px)',
          padding: '32px',
          borderRadius: '28px',
          background: 'rgba(7, 10, 22, 0.72)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 40px 120px rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(22px)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          cursor: 'default'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '11px',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: 'rgba(148, 163, 184, 0.9)',
                marginBottom: '12px'
              }}
            >
              {destination.city || destination.category || 'Destination'}
            </div>
            <h1
              id="destination-overview-title"
              style={{
                fontSize: '42px',
                lineHeight: 1.05,
                fontWeight: 300,
                margin: 0,
                color: 'rgba(255,255,255,0.96)'
              }}
            >
              {destination.name}
            </h1>
            {destination.category && (
              <div
                style={{
                  marginTop: '12px',
                  fontSize: '13px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: 'rgba(167, 243, 208, 0.8)'
                }}
              >
                {destination.category}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={(event) => {
                event.stopPropagation()
                setIsCollapsed((value) => !value)
              }}
              aria-label={isCollapsed ? 'Expand overview panel' : 'Collapse overview panel'}
              style={{
                flexShrink: 0,
                width: 44,
                height: 44,
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(15,23,42,0.28)',
                color: 'rgba(255,255,255,0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              className="transition-colors duration-200 hover:bg-slate-700/60 hover:text-white"
            >
              {isCollapsed ? '+' : '–'}
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation()
                onClose()
              }}
              aria-label="Close overview"
              style={{
                flexShrink: 0,
                width: 44,
                height: 44,
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(15,23,42,0.35)',
                color: 'rgba(255,255,255,0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              className="transition-colors duration-200 hover:bg-slate-700/60 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ height: '1px', width: '100%', background: 'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))' }} />

        <div style={{ position: 'relative' }}>
          {isCollapsed ? null : isLoadingOverview ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(148,163,184,0.85)' }}>
              <Loader2 className="animate-spin" size={20} />
              <span>Composing cinematic overview...</span>
            </div>
          ) : error ? (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '16px',
                border: '1px solid rgba(248,113,113,0.25)',
                background: 'rgba(127,29,29,0.25)',
                color: 'rgba(254,202,202,0.95)',
                fontSize: '14px'
              }}
            >
              {error}
            </div>
          ) : (
            <>
              <div
                ref={contentRef}
                style={{
                  maxHeight: isCollapsed ? '0px' : '52vh',
                  overflowY: 'auto',
                  paddingRight: '4px',
                  transition: 'max-height 0.6s ease',
                  color: 'rgba(226, 232, 240, 0.92)',
                  lineHeight: 1.6,
                  fontSize: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}
              >
                {displaySections.length === 0 ? (
                  <p style={{ margin: 0 }}>{overview}</p>
                ) : (
                  displaySections.map((section, index) => (
                    <div key={index}>
                      {section.title && (
                        <div
                          style={{
                            fontSize: '12px',
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'rgba(148,163,184,0.85)',
                            marginBottom: '10px'
                          }}
                        >
                          {section.title}
                        </div>
                      )}
                      <div>
                        {section.body.split('\n').map((line, lineIdx, arr) => (
                          <p
                            key={lineIdx}
                            style={{
                              margin: 0,
                              marginBottom: lineIdx === arr.length - 1 ? 0 : 12
                            }}
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {!isCollapsed && isLoadingPhotos && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '14px',
              background: 'rgba(15, 23, 42, 0.35)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: '13px',
              color: 'rgba(148,163,184,0.85)'
            }}
          >
            <Loader2 className="animate-spin" size={16} />
            <span>Loading cinematic imagery…</span>
          </div>
        )}

      </div>

      {/* Optional manual controls (hidden unless multiple photos) */}
      {photos.length > 1 && !isLoadingPhotos && !isCollapsed && (
        <div
          style={{
            position: 'fixed',
            bottom: 40,
            left: 40,
            display: 'flex',
            gap: '12px',
            zIndex: 70,
            pointerEvents: 'auto'
          }}
        >
          <button
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              prevPhoto()
            }}
            style={{
              width: 42,
              height: 42,
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(15,23,42,0.45)',
              color: 'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(20px)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(15,23,42,0.65)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.95)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(15,23,42,0.45)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.75)'
            }}
            aria-label="Previous scene image"
          >
            ‹
          </button>
          <button
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              nextPhoto()
            }}
            style={{
              width: 42,
              height: 42,
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(15,23,42,0.45)',
              color: 'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(20px)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(15,23,42,0.65)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.95)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(15,23,42,0.45)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.75)'
            }}
            aria-label="Next scene image"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
