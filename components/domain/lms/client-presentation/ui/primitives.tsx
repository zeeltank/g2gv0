'use client'

import type { CSSProperties, ReactNode } from 'react'

import { BADGE_COPY, type Asset, type Badge, type Mark } from '@/lib/client-presentation/deck'

/** Status badge. A glyph, a word and a colour: LIVE is a solid dot, PARTIAL a half dot, CONCEPTUAL a dashed ring. */
export function StatusBadge({ badge, className, style }: { badge: Badge; className?: string; style?: CSSProperties }) {
  return (
    <span className={`cp-badge ${className ?? ''}`} data-b={badge} title={BADGE_COPY[badge].hint} style={style}>
      <BadgeGlyph badge={badge} />
      {BADGE_COPY[badge].word}
    </span>
  )
}

export function BadgeGlyph({ badge }: { badge: Badge }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {badge === 'LIVE' && <circle cx="12" cy="12" r="8" fill="currentColor" />}
      {badge === 'PARTIAL' && (
        <>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
        </>
      )}
      {badge === 'CONCEPTUAL' && <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3.6 3.2" />}
    </svg>
  )
}

/** One step of a journey: built (solid), partial (half), concept (dashed). */
export function StepMark({ mark, size = 30 }: { mark: Mark | undefined; size?: number }) {
  const m = mark ?? 'built'
  return (
    <svg className="cp-mark" viewBox="0 0 30 30" width={size} height={size} role="img" aria-label={m === 'built' ? 'Works today' : m === 'partial' ? 'Partly built' : 'Not built'}>
      {m === 'built' && <circle cx="15" cy="15" r="11" fill="currentColor" />}
      {m === 'partial' && (
        <>
          <circle cx="15" cy="15" r="11" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M15 4a11 11 0 0 1 0 22z" fill="currentColor" />
        </>
      )}
      {m === 'concept' && <circle cx="15" cy="15" r="11" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="5 4.4" />}
    </svg>
  )
}

/**
 * A photograph slot. While no photo has been authorised and placed it shows a neutral field (never a stand-in picture),
 * and a photo that needs attribution carries its credit line. AI-generated images say so.
 */
export function Photo({ asset, alt, className, style, children, showCredit = true, pendingLabel }: {
  asset: Asset | null
  alt: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
  showCredit?: boolean
  pendingLabel?: string
}) {
  const has = Boolean(asset?.src)
  return (
    <div className={`cp-photo ${className ?? ''}`} data-missing={!has} style={style}>
      {has && (
        // Plain img on purpose: the deck is a fixed-size stage, files are already optimised WebP in /public.
        <img src={asset!.src!} alt={asset!.alt || alt} decoding="async" draggable={false} style={asset?.focus ? { objectPosition: asset.focus } : undefined} />
      )}
      {!has && pendingLabel && <span className="cp-pending">{pendingLabel}</span>}
      {has && showCredit && asset!.credit && <span className="cp-credit">{asset!.ai ? 'AI-generated image. ' : ''}{asset!.credit}</span>}
      {children}
    </div>
  )
}

/** Real-screenshot frame. Until a genuine screenshot from an authorised environment is placed, it says so plainly. */
export function ShotFrame({ asset, label, proof, className, style }: { asset: Asset | null; label: string; proof: string; className?: string; style?: CSSProperties }) {
  return (
    <div className={`cp-shot ${className ?? ''}`} style={style} data-placeholder={!asset?.src}>
      <div className="cp-shot-bar" aria-hidden="true"><i /><i /><i /></div>
      {asset?.src ? (
        <img src={asset.src} alt={asset.alt || label} draggable={false} />
      ) : (
        <div className="cp-shot-body">
          <div>
            <strong>{proof || 'Screenshot to be supplied'}</strong>
            <span>{label}</span>
          </div>
        </div>
      )}
    </div>
  )
}
