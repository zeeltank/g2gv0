'use client'

import type { CSSProperties, ReactNode } from 'react'

import type { Asset } from '@/lib/client-presentation/deck'

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
