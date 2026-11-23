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
}

/**
 * Drives a scene from one GSAP timeline that is divided into beats.
 *
 * The builder lays the whole scene out on a paused timeline and adds the labels b0 ... b<beats>:
 *   b0 sits at the end of the scene's entrance, b1 after the first reveal, and so on.
 * Going forward tweens to the next label at natural speed; going back tweens back the same way.
 * Arriving by Back or by a jump (and when the viewer prefers reduced motion) shows the finished state at once, with no movement.
 */
export function useBeatTimeline(scope: RefObject<HTMLElement | null>, build: (tl: gsap.core.Timeline, ctx: BeatCtx) => void, { beat, beats, entry, reduced }: Opts): void {
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
    const label = `b${beat}`
    if (reduced) {
      tl.seek(label, false)
      return
    }
    const target = tl.labels[label]
    if (target === undefined) return
    tl.tweenTo(label, { ease: 'power1.inOut', duration: Math.min(1.8, Math.max(0.35, Math.abs(target - tl.time()))) })
  }, [beat, reduced])
}
