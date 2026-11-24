'use client'

import { useRef, useState } from 'react'

import { CLIP_SET } from '@/lib/client-presentation/clips'
import { textOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { ClipPlayer } from '../clips/clip-player'
import { useBeatTimeline } from '../motion/use-beat-timeline'

import './s16.css'
import type { SceneProps } from './types'

/**
 * See it work: the five product explainers on one slide. A large player on the left, the five products on the right; each press of Next
 * moves to the next product, and a tap on a product picks it. Each clip plays once and rests on its outcome line.
 */
export const BEATS = 4

export default function Scene({ slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  // A tap picks a product for the current step; the next press of Next (a new beat) takes over again.
  const [pick, setPick] = useState<{ beat: number; i: number } | null>(null)
  const clips = CLIP_SET.clips
  const active = pick && pick.beat === beat ? pick.i : beat

  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.s16-h, .s16-note'), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' }, 0)
    tl.fromTo(q('.s16-player'), { autoAlpha: 0, y: 40, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 1.0, ease: 'power3.out' }, 0.4)
    tl.fromTo(q('.s16-item'), { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out' }, 0.8)
    tl.addLabel('b0', 2.0)
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="ink" style={themeVars('ink')}>
      <div className="s16-wash" />
      <h2 className="cp-display s16-h">{textOf(slide, 'headline')}</h2>
      <div className="s16-player">
        <ClipPlayer key={clips[active].id} clipId={clips[active].id} ratio="h" autoplay endCard={false} />
      </div>
      <ol className="s16-list">
        {clips.map((c, i) => (
          <li key={c.id}>
            <button type="button" className="s16-item" data-active={active === i} aria-pressed={active === i} onClick={() => setPick({ beat, i })}>
              <span className="s16-n">{`0${i + 1}`}</span>
              <span className="s16-name cp-display">{c.product}</span>
              <span className="s16-desc">{c.descriptor}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="s16-note">{textOf(slide, 'note')}</p>
    </div>
  )
}
