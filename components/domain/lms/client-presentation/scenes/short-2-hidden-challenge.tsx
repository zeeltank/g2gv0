'use client'

import { useRef } from 'react'

import { slideByN, textOf, textsOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { SplitText } from '../motion/gsap'
import { useBeatTimeline } from '../motion/use-beat-timeline'

import './short2.css'
import type { SceneProps } from './types'

/**
 * Five-slide version, scene 2: the hidden challenge in one frame. Slide 2's question and its eight sources, then slide 4's six
 * steps as one line, so a short meeting still shows where information stops.
 */
export const BEATS = 2

const N = 6
const X0 = 230
const DX = 292
const Y = 800

export default function Scene({ deck, slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const s4 = slideByN(deck, 4)
  const tags = textsOf(slide, 'ring')
  const steps = textsOf(s4, 'step')

  useBeatTimeline(ref, (tl, { q }) => {
    const split = SplitText.create(q('.ss2-h')[0], { type: 'words', mask: 'words' })
    tl.fromTo(split.words, { yPercent: 110, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.0, stagger: 0.07, ease: 'power3.out' }, 0.2)
    tl.fromTo(q('.ss2-tag'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.09, ease: 'power3.out' }, 0.8)
    tl.addLabel('b0', 2.4)
    tl.fromTo(q('.ss2-support'), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 'b0+=0.1')
    tl.addLabel('b1', 'b0+=1.3')
    tl.fromTo(q('.ss2-base'), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 1.6, ease: 'power2.inOut' }, 'b1+=0.1')
    tl.fromTo(q('.ss2-node'), { autoAlpha: 0, scale: 0.3, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.5, stagger: 0.22, ease: 'back.out(2.4)' }, 'b1+=0.2')
    tl.fromTo(q('.ss2-lab'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.22 }, 'b1+=0.3')
    tl.addLabel('b2', 'b1+=2.2')
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="ink" style={themeVars('ink')}>
      <div className="ss2-wash" />
      <h2 className="cp-display ss2-h">{textOf(slide, 'headline')}</h2>
      <div className="ss2-tags">
        {tags.map((t) => <span key={t} className="ss2-tag">{t}</span>)}
      </div>
      <p className="ss2-support">{textOf(slide, 'support')}</p>
      <svg className="ss2-svg" viewBox="0 0 1920 1080" aria-hidden="true">
        <path className="ss2-base" d={`M${X0} ${Y} L${X0 + DX * (N - 1)} ${Y}`} stroke="url(#ss2g)" strokeWidth="5" fill="none" strokeLinecap="round" />
        <defs>
          <linearGradient id="ss2g" x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.9" /><stop offset="1" stopColor="#1088f6" /></linearGradient>
        </defs>
        {steps.map((_, i) => <circle key={i} className="ss2-node" cx={X0 + DX * i} cy={Y} r="14" fill={i === N - 1 ? '#1088f6' : '#fff'} />)}
      </svg>
      {steps.map((t, i) => (
        <div key={t} className="ss2-lab" style={{ left: X0 + DX * i - 140, top: Y + 36 }}><span>{`0${i + 1}`}</span>{t}</div>
      ))}
    </div>
  )
}
