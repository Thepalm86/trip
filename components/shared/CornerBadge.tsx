import { memo } from 'react'

interface CornerBadgeProps {
  label: string
  accent: string
  className?: string
}

const applyAlpha = (hex: string, alpha: string) => {
  if (hex.startsWith('#') && hex.length === 7) {
    return `${hex}${alpha}`
  }
  return hex
}

const buildBadgeStyle = (accent: string) => ({
  background: `linear-gradient(135deg, ${applyAlpha(accent, '36')} 0%, ${applyAlpha(accent, '14')} 100%)`,
  borderColor: applyAlpha(accent, '7A'),
  boxShadow: `0 18px 36px ${applyAlpha(accent, '22')}`,
  color: '#f1f5f9',
})

export const CornerBadge = memo(({ label, accent, className = 'top-0 right-0' }: CornerBadgeProps) => (
  <div className={`pointer-events-none absolute z-10 select-none ${className}`}>
    <div
      className="rounded-bl-3xl rounded-tr-2xl border px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-lg"
      style={buildBadgeStyle(accent)}
    >
      {label}
    </div>
  </div>
))

CornerBadge.displayName = 'CornerBadge'

