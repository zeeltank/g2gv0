'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import deckJson from '@/lib/client-presentation/generated/scholarclone.deck.json'
import { CLIP_SET, STAGE, clipById, clipText, type Ratio, type UiName } from '@/lib/client-presentation/clips'

import { gsap, useGSAP } from '../motion/gsap'

import './clip.css'
import { CLIP_BODY, CLIP_BUILD } from './clip-scenes'

/**
 * One product explainer clip. A single paused GSAP timeline holds the whole clip (hook, scene, outcome line, closing card), so it can be
 * played on a loop inside a slide, shown as a still, or stepped to any second for frame-by-frame rendering (window.__clip).
 */
declare global {
  interface Window {
    __clip?: { ready: boolean; duration: number; seek: (t: number) => void }
  }
}

/** Seconds at which the parts of a clip start. The scene runs from 2.5 to about 10.5. */
export const CLIP_TIMES = { outcome: 11.0, end: 13.4, total: 15.0, totalNoEnd: 13.6 } as const

const logoSrc = (deckJson as { assets: Record<string, { src: string | null }> }).assets['img-logo']?.src ?? null

export interface ClipPlayerProps {
  clipId: string
  ratio: Ratio
  /** "shown": the product's own screen name (Teach Connect) is visible at the top of the cards. "hidden": it is not. */
  ui?: UiName
  /** Add the closing card with the product name (used for the video files; the slides keep the outcome line on screen). */
  endCard?: boolean
  /** Play on a loop. Off for a still (the finished frame) and for frame rendering. */
  autoplay?: boolean
  /** Make the timeline steppable from outside (window.__clip), for the video renderer. */
  expose?: boolean
  className?: string
}

export function ClipPlayer({ clipId, ratio, ui = 'hidden', endCard = false, autoplay = true, expose = false, className }: ClipPlayerProps) {
  const clip = clipById(clipId)
  const { w, h } = STAGE[ratio]
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const [fit, setFit] = useState({ s: 1, x: 0, y: 0 })

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      // Layout size, not getBoundingClientRect: the deck shell scales the whole 1920 x 1080 stage with a CSS transform, and a
      // transformed rectangle would shrink the clip a second time in any window that is not 1920 wide.
      const cw = el.clientWidth
      const ch = el.clientHeight
      const s = Math.min(cw / w, ch / h) || 1
      setFit({ s, x: (cw - w * s) / 2, y: (ch - h * s) / 2 })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [w, h])

  useGSAP(
    () => {
      if (!clip) return
      const total = endCard ? CLIP_TIMES.total : CLIP_TIMES.totalNoEnd
      const q = gsap.utils.selector(stageRef)
      const tl = gsap.timeline({ paused: true })
      tl.fromTo(q('.cl-brand'), { autoAlpha: 0, y: -20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0.1)
      tl.fromTo(q('.cl-glow-a'), { x: -80, y: 50 }, { x: 80, y: -50, duration: total, ease: 'none' }, 0)
      tl.fromTo(q('.cl-glow-b'), { x: 50, y: 0 }, { x: -90, y: 60, duration: total, ease: 'none' }, 0)
      tl.fromTo(q('.cl-hook .cl-w > i'), { yPercent: 115 }, { yPercent: 0, duration: 0.85, stagger: 0.09, ease: 'power3.out' }, 0.4)
      tl.fromTo(q('.cl-appbar'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 2.3)
      tl.fromTo(q('.cl-disclosure'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 2.6)
      CLIP_BUILD[clip.id]?.(tl, q)
      tl.fromTo(q('.cl-outcome'), { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' }, CLIP_TIMES.outcome)
      tl.addLabel('final', CLIP_TIMES.outcome + 1.0)
      if (endCard) tl.fromTo(q('.cl-end'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'power1.inOut' }, CLIP_TIMES.end)
      tl.to({}, { duration: 0.001 }, total - 0.001)
      tlRef.current = tl

      const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (expose) {
        tl.seek(0, false)
        window.__clip = { ready: true, duration: tl.duration(), seek: (t: number) => { tl.seek(t, false) } }
      } else if (reduced || !autoplay) {
        tl.seek('final', false)
      } else {
        tl.play(0)
        tl.eventCallback('onComplete', () => { gsap.delayedCall(2.2, () => tlRef.current?.restart()) })
      }
      return () => {
        tlRef.current = null
        if (expose) delete window.__clip
      }
    },
    { scope: stageRef, dependencies: [clipId, ratio, ui, endCard, autoplay, expose] },
  )

  // A clip that is off screen (another slide, a hidden tab) rests instead of running.
  useEffect(() => {
    const el = rootRef.current
    if (!el || expose || !autoplay || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      const tl = tlRef.current
      if (!tl) return
      if (e.isIntersecting) tl.resume()
      else tl.pause()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [autoplay, expose, clipId, ratio])

  if (!clip) return null
  const Body = CLIP_BODY[clip.id]
  const words = clipText(clip, 'hook').split(' ')
  return (
    <div ref={rootRef} className={`cl-root ${className ?? ''}`} data-clip={clip.id} data-ratio={ratio} data-ui={ui}>
      <div ref={stageRef} className="cl-stage" data-ratio={ratio} data-ui={ui} style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.s})` }}>
        <div className="cl-bg" />
        <div className="cl-glow cl-glow-a" />
        <div className="cl-glow cl-glow-b" />
        <div className="cl-brand">
          {logoSrc && <img src={logoSrc} alt="" draggable={false} />}
          <span>ScholarClone</span>
        </div>
        <h2 className="cl-hook">
          {words.map((wd, i) => <span key={i} className="cl-w"><i>{wd}</i></span>)}
        </h2>
        <div className="cl-zone">
          {ui === 'shown' && <div className="cl-appbar"><i />Teach Connect</div>}
          {Body && <Body clip={clip} />}
        </div>
        <p className="cl-outcome">{clipText(clip, 'outcome')}</p>
        <p className="cl-disclosure">{CLIP_SET.disclosure}</p>
        {endCard && (
          <div className="cl-end">
            {logoSrc && <img src={logoSrc} alt="" draggable={false} />}
            <p className="cl-end-name">{clip.product}</p>
            <p className="cl-end-desc">{clip.descriptor}</p>
            <p className="cl-end-brand">ScholarClone</p>
          </div>
        )}
      </div>
    </div>
  )
}
