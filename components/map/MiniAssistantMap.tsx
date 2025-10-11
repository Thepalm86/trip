'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { X } from 'lucide-react'

import { InteractiveMap, InteractiveMapRef } from './InteractiveMap'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface MiniAssistantMapProps {
  isOpen: boolean
  label?: string
  onClose?: () => void
  initialPosition?: { x: number; y: number }
  initialSize?: { width: number; height: number }
  className?: string
  onTransformChange?: (state: {
    position: { x: number; y: number }
    size: { width: number; height: number }
  }) => void
}

const MIN_WIDTH = 220
const MIN_HEIGHT = 160
const MAX_WIDTH = 640
const MAX_HEIGHT = 480

export function MiniAssistantMap({
  isOpen,
  onClose,
  label = 'Itinerary Map',
  initialPosition,
  initialSize,
  className,
  onTransformChange,
}: MiniAssistantMapProps) {
  const [isClient, setIsClient] = useState(false)
  const [position, setPosition] = useState(() => ({
    x: initialPosition?.x ?? 32,
    y: initialPosition?.y ?? 120,
  }))
  const [size, setSize] = useState(() => ({
    width: initialSize?.width ?? 260,
    height: initialSize?.height ?? 180,
  }))
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  const dragStateRef = useRef<{
    pointerId: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const resizeStateRef = useRef<{
    pointerId: number
    startWidth: number
    startHeight: number
    startX: number
    startY: number
    startTop: number
    startRight: number
  } | null>(null)

  const positionRef = useRef(position)
  const sizeRef = useRef(size)
  const mapRef = useRef<InteractiveMapRef>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    positionRef.current = position
  }, [position])

  useEffect(() => {
    sizeRef.current = size
  }, [size])

  useEffect(() => {
    if (!isOpen) return
    if (!initialSize) return

    const clamped = clampSize(initialSize.width, initialSize.height)
    setSize((prev) => {
      if (prev.width === clamped.width && prev.height === clamped.height) {
        return prev
      }
      return clamped
    })
  }, [initialSize?.width, initialSize?.height, isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (!initialPosition) return

    const clamped = clampPosition(initialPosition.x, initialPosition.y, sizeRef.current.width, sizeRef.current.height)
    setPosition((prev) => {
      if (prev.x === clamped.x && prev.y === clamped.y) {
        return prev
      }
      return clamped
    })
  }, [initialPosition?.x, initialPosition?.y, isOpen])

  useEffect(() => {
    const mapInstance = mapRef.current?.getMap()
    if (!mapInstance) return

    const frame = requestAnimationFrame(() => {
      mapInstance.resize()
    })

    return () => cancelAnimationFrame(frame)
  }, [size.width, size.height])

  useEffect(() => {
    if (!isClient) return

    const handleWindowResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y, sizeRef.current.width, sizeRef.current.height))
      setSize((prev) => {
        const { width, height } = clampSize(prev.width, prev.height)
        return { width, height }
      })
    }

    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [isClient])

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handleDragMove)
      window.removeEventListener('pointerup', handleDragEnd)
      window.removeEventListener('pointermove', handleResizeMove)
      window.removeEventListener('pointerup', handleResizeEnd)
    }
  }, [])

  const clampPosition = (x: number, y: number, width = sizeRef.current.width, height = sizeRef.current.height) => {
    if (typeof window === 'undefined') {
      return { x, y }
    }

    const padding = 16
    const maxX = window.innerWidth - width - padding
    const maxY = window.innerHeight - height - padding

    return {
      x: Math.min(Math.max(padding, x), Math.max(padding, maxX)),
      y: Math.min(Math.max(padding, y), Math.max(padding, maxY)),
    }
  }

  const clampSize = (width: number, height: number) => {
    if (typeof window !== 'undefined') {
      width = Math.min(width, Math.max(MIN_WIDTH, window.innerWidth - 48))
      height = Math.min(height, Math.max(MIN_HEIGHT, window.innerHeight - 96))
    }

    return {
      width: Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH),
      height: Math.min(Math.max(height, MIN_HEIGHT), MAX_HEIGHT),
    }
  }

  const handleDragMove = (event: PointerEvent) => {
    const dragState = dragStateRef.current
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return
    }

    const nextX = event.clientX - dragState.offsetX
    const nextY = event.clientY - dragState.offsetY
    const clamped = clampPosition(nextX, nextY)
    setPosition((prev) => {
      if (prev.x === clamped.x && prev.y === clamped.y) {
        return prev
      }
      const result = clamped
      onTransformChange?.({
        position: result,
        size: sizeRef.current,
      })
      return result
    })
  }

  const handleDragEnd = (event: PointerEvent) => {
    const dragState = dragStateRef.current
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return
    }

    dragStateRef.current = null
    setIsDragging(false)
    window.removeEventListener('pointermove', handleDragMove)
    window.removeEventListener('pointerup', handleDragEnd)
  }

  const handleResizeMove = (event: PointerEvent) => {
    const resizeState = resizeStateRef.current
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return
    }

    const deltaX = event.clientX - resizeState.startX
    const deltaY = event.clientY - resizeState.startY

    const proposedWidth = resizeState.startWidth - deltaX
    const proposedHeight = resizeState.startHeight + deltaY
    const { width, height } = clampSize(proposedWidth, proposedHeight)
    const baseLeft = resizeState.startRight - width
    const nextPosition = clampPosition(baseLeft, resizeState.startTop, width, height)
    const nextSize = { width, height }

    setSize((prev) => {
      if (prev.width === width && prev.height === height) {
        return prev
      }
      return nextSize
    })

    setPosition((prev) => {
      if (prev.x === nextPosition.x && prev.y === nextPosition.y) {
        return prev
      }
      return nextPosition
    })

    onTransformChange?.({
      position: nextPosition,
      size: nextSize,
    })
  }

  const handleResizeEnd = (event: PointerEvent) => {
    const resizeState = resizeStateRef.current
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return
    }

    resizeStateRef.current = null
    setIsResizing(false)
    window.removeEventListener('pointermove', handleResizeMove)
    window.removeEventListener('pointerup', handleResizeEnd)
  }

  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - positionRef.current.x,
      offsetY: event.clientY - positionRef.current.y,
    }
    setIsDragging(true)
    window.addEventListener('pointermove', handleDragMove)
    window.addEventListener('pointerup', handleDragEnd)
  }

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    resizeStateRef.current = {
      pointerId: event.pointerId,
      startWidth: sizeRef.current.width,
      startHeight: sizeRef.current.height,
      startX: event.clientX,
      startY: event.clientY,
      startTop: positionRef.current.y,
      startRight: positionRef.current.x + sizeRef.current.width,
    }
    setIsResizing(true)
    window.addEventListener('pointermove', handleResizeMove)
    window.addEventListener('pointerup', handleResizeEnd)
  }

  if (!isClient || !isOpen) {
    return null
  }

  const node = (
    <div
      style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
      className={clsx(
        'fixed z-[90] flex flex-col rounded-2xl border border-white/10 bg-[rgba(9,16,30,0.96)] shadow-2xl shadow-black/50 backdrop-blur transition-[box-shadow,transform]',
        (isDragging || isResizing) && 'shadow-emerald-500/20',
        className
      )}
    >
      <div
        className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200/70"
        onPointerDown={handleDragStart}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <span>{label}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onClose?.()
          }}
          className="rounded-full border border-white/10 bg-white/5 p-1.5 text-white/60 transition hover:border-white/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-b-2xl">
        <InteractiveMap ref={mapRef} variant="mini" interactive className="rounded-b-2xl" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
        <div
          className="absolute left-3 bottom-3 flex h-7 w-7 cursor-sw-resize items-center justify-center rounded-md border border-white/25 bg-white/15 text-white/70 transition hover:border-white/40 hover:bg-white/25"
          onPointerDown={handleResizeStart}
        >
          <svg viewBox="0 0 8 8" className="h-3.5 w-3.5" aria-hidden="true" focusable="false">
            <path d="M1 7L7 1M3 7L7 3M5 7L7 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
