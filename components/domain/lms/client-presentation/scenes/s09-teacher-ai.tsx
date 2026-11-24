'use client'

import { useRef } from 'react'

import { assetOf, textOf, textsOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { useBeatTimeline } from '../motion/use-beat-timeline'
import { Photo } from '../ui/primitives'

import './s09.css'
import type { SceneProps } from './types'

/**
 * AI that helps teachers prepare (PARTIAL). One source, three forms: chapter content becomes flashcards, true/false questions or a
 * short presentation. The teacher stays in charge, which the slide says in its own words.
 */
export const BEATS = 2

// Output chip centres, in stage pixels; the source chip sits to the left and threads fan out to them.
const SRC = { x: 410, y: 668 }
const OUT_X = 640
const OUT_Y = [606, 668, 730]

export default function Scene({ deck, slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const rows = textsOf(slide, 'row')
  const outs = textsOf(slide, 'output')

  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.s09-photo'), { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, duration: 1.8, ease: 'power2.out' }, 0)
    tl.fromTo(q('.s09-h'), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out' }, 0.3)
    tl.fromTo(q('.s09-row'), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.14 }, 0.9)
    tl.addLabel('b0', 2.2)
    // b1: one source becomes three forms.
    tl.fromTo(q('.s09-src'), { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.7 }, 'b0+=0.1')
    tl.fromTo(q('.s09-thread'), { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 100%', duration: 0.9, stagger: 0.12, ease: 'power2.inOut' }, 'b0+=0.5')
    tl.fromTo(q('.s09-out'), { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: 0.7, stagger: 0.12 }, 'b0+=1.0')
    tl.addLabel('b1', 'b0+=2.0')
    // b2: what it frees up, and who stays in charge.
    tl.fromTo(q('.s09-value, .s09-principle'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.15, ease: 'power3.out' }, 'b1+=0.1')
    tl.addLabel('b2', 'b1+=1.6')
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="paper" style={themeVars('paper')}>
      <div className="s09-photo-wrap">
        <Photo asset={assetOf(deck, 'img-teacher')} alt="A teacher with a small group of students" className="s09-photo" />
        <div className="s09-fade" />
      </div>
      <h2 className="cp-display s09-h">{textOf(slide, 'headline')}</h2>
      <div className="s09-rows">
        {rows.map((t) => <p key={t} className="s09-row">{t}</p>)}
      </div>

      <svg className="s09-svg" viewBox="0 0 1920 1080" aria-hidden="true">
        {OUT_Y.map((y, i) => <path key={i} className="s09-thread" d={`M${SRC.x + 125} ${SRC.y} C${SRC.x + 200} ${SRC.y} ${OUT_X - 80} ${y} ${OUT_X - 14} ${y}`} fill="none" stroke="#0a6ad0" strokeWidth="3.5" strokeLinecap="round" />)}
      </svg>
      <div className="s09-src" style={{ left: SRC.x - 270, top: SRC.y - 40 }}>{textOf(slide, 'source')}</div>
      {outs.map((t, i) => <div key={t} className="s09-out" style={{ left: OUT_X, top: OUT_Y[i] - 25 }}>{t}</div>)}

      <p className="s09-value">{textOf(slide, 'value')}</p>
      <p className="cp-display s09-principle">{textOf(slide, 'principle')}</p>
    </div>
  )
}
