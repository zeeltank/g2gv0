'use client'

import { useLayoutEffect, useRef, useState } from 'react'

import { FILM } from '@/lib/client-presentation/film'

import { gsap, useGSAP } from '../motion/gsap'

import './film.css'
import { FilmBeats, buildFilm } from './film-scenes'

/**
 * The 59-second film on one paused GSAP timeline. Playing (autoplay), a still at the last frame, or stepped to any second for
 * frame-by-frame rendering (window.__clip, the same contract the clip pages use).
 */
declare global {
  interface Window {
    __clip?: { ready: boolean; duration: number; seek: (t: number) => void }
  }
}

export function FilmPlayer({ autoplay = true, expose = false, loop = false, className }: { autoplay?: boolean; expose?: boolean; loop?: boolean; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const [fit, setFit] = useState({ s: 1, x: 0, y: 0 })

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      // Layout size, not getBoundingClientRect: a parent's CSS scale must not shrink the film a second time.
      const cw = el.clientWidth
      const ch = el.clientHeight
      const s = Math.min(cw / 1920, ch / 1080) || 1
      setFit({ s, x: (cw - 1920 * s) / 2, y: (ch - 1080 * s) / 2 })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useGSAP(
    () => {
      const q = gsap.utils.selector(stageRef)
      const tl = gsap.timeline({ paused: true })
      buildFilm(tl, q)
      tlRef.current = tl
      const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (expose) {
        tl.seek(0, false)
        window.__clip = { ready: true, duration: tl.duration(), seek: (t: number) => { tl.seek(t, false) } }
      } else if (reduced || !autoplay) {
        tl.seek(FILM.length - 0.5, false)
      } else {
        tl.play(0)
        if (loop) tl.eventCallback('onComplete', () => { gsap.delayedCall(2.5, () => tlRef.current?.restart()) })
      }
      return () => {
        tlRef.current = null
        if (expose) delete window.__clip
      }
    },
    { scope: stageRef, dependencies: [autoplay, expose, loop] },
  )

  return (
    <div ref={rootRef} className={`fm-root ${className ?? ''}`} data-film="scholarclone">
      <div ref={stageRef} className="fm-stage" style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.s})` }}>
        <FilmBeats />
      </div>
    </div>
  )
}
