'use client'

import { useRef } from 'react'

import { textOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { useBeatTimeline } from '../motion/use-beat-timeline'

import type { SceneProps } from './types'

/**
 * Plain fallback that shows a slide's lines in order. Every scene starts as this and is replaced by its designed version;
 * it keeps the deck complete, readable and testable at every step.
 */
export function GenericScene({ slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('[data-g]'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.05 })
    tl.addLabel('b0')
    for (let i = 1; i <= beats; i++) tl.addLabel(`b${i}`, '+=0')
  }, { beat, beats, entry, reduced })
  const head = textOf(slide, 'headline')
  return (
    <div ref={ref} className="cp-scene" data-theme="paper" style={{ padding: '110px 140px', ...themeVars('paper') }}>
      <div className="cp-kicker" data-g>{slide.section}</div>
      <h2 className="cp-display cp-h2" data-g style={{ margin: '18px 0 36px', maxWidth: 1400 }}>{head}</h2>
      <ul className="cp-body" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 14, maxWidth: 1500 }}>
        {slide.lines.filter((l) => l.role !== 'headline').map((l, i) => (
          <li key={i} data-g>{l.text}</li>
        ))}
      </ul>
    </div>
  )
}
