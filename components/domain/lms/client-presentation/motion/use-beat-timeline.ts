'use client'

import { useEffect, useRef, type RefObject } from 'react'

import { gsap, useGSAP } from './gsap'

export type Entry = 'forward' | 'back' | 'jump'

export interface BeatCtx {
  /** Scoped selector: q('.cp-x') only finds elements inside this scene. */
  q: gsap.utils.SelectorFunc
  reduced: boolean
}

interface Opts {
  beat: number
  beats: number
  entry: Entry
  reduced: boolean
  /** The longest a press of Next may take to play its step, in seconds (default 1.8). The product tour's steps are richer and ask for more. */
  maxTween?: number
}

/**
 * Drives a scene from one GSAP timeline that is divided into beats.
 *
 * The builder lays the whole scene out on a paused timeline and adds the labels b0 ... b<beats>:
 *   b0 sits at the end of the scene's entrance, b1 after the first reveal, and so on.
 * Going forward tweens to the next label at natural speed; going back tweens back the same way.
 * Arriving by Back or by a jump (and when the viewer prefers reduced motion) shows the finished state at once, with no movement.
 */
export function useBeatTimeline(scope: RefObject<HTMLElement | null>, build: (tl: gsap.core.Timeline, ctx: BeatCtx) => void, { beat, beats, entry, reduced, maxTween = 1.8 }: Opts): void {
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const mounted = useRef(false)

  useGSAP(
    () => {
      const tl = gsap.timeline({ paused: true })
      const q = gsap.utils.selector(scope)
      build(tl, { q, reduced })
      for (let i = 0; i <= beats; i++) {
        if (tl.labels[`b${i}`] === undefined) tl.addLabel(`b${i}`, tl.duration())
      }
      tlRef.current = tl
      // Render mode (render-atlas.mjs): the page steps the whole timeline by time, so hand it over and stay out of the way.
      if (typeof window !== 'undefined' && /\/client-presentation\/atlas\//.test(window.location.pathname)) {
        ;(window as unknown as { __atlasTl?: gsap.core.Timeline }).__atlasTl = tl
        return
      }
      if (reduced || entry !== 'forward') tl.seek(`b${beat}`, false)
      else {
        tl.seek(0, false)
        tl.tweenTo('b0', { ease: 'none' })
        if (beat > 0) tl.seek(`b${beat}`, false)
      }
      return () => {
        tlRef.current = null
      }
    },
    { scope, dependencies: [reduced] },
  )

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const tl = tlRef.current
    if (!tl) return
    // The latest press wins: a tween still running from an earlier press (or from Back) would otherwise go on moving the playhead after a jump or a new press.
    gsap.killTweensOf(tl)
    const label = `b${beat}`
    if (reduced) {
      tl.seek(label, false)
      return
    }
    const target = tl.labels[label]
    if (target === undefined) return
    // A jump (a click on a tab of the product tour) shows the beat at once: tweening would play through every beat in between.
    if (entry === 'jump') {
      tl.seek(label, false)
      return
    }
    tl.tweenTo(label, { ease: 'power1.inOut', duration: Math.min(maxTween, Math.max(0.35, Math.abs(target - tl.time()))) })
  }, [beat, reduced, entry, maxTween])
}
