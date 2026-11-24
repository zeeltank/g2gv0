'use client'

import { useEffect, useState, type KeyboardEvent } from 'react'

import { clipById } from '@/lib/client-presentation/clips'

import { ClipPlayer } from './clip-player'

/**
 * A product slide's link to its explainer: the clip's closing frame as a still, with "Watch the explainer". Opening it plays the clip
 * across the whole stage; Close (or Esc) comes back to the slide exactly as it was. No navigation state changes.
 */
export function ClipTile({ clipId, className }: { clipId: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const clip = clipById(clipId)

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!clip) return null
  const press = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
    }
  }
  return (
    <>
      <div className={`cl-tile ${className ?? ''}`} role="button" tabIndex={0} aria-label={`Watch the ${clip.product} explainer`} onClick={() => setOpen(true)} onKeyDown={press}>
        <ClipPlayer clipId={clipId} ratio="h" autoplay={false} />
        <span className="cl-play"><i />Watch the explainer</span>
      </div>
      {open && (
        <div className="cl-overlay" role="dialog" aria-label={`${clip.product} explainer`}>
          <ClipPlayer clipId={clipId} ratio="h" autoplay endCard={false} />
          <button type="button" className="cl-close" autoFocus onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </>
  )
}
