'use client'

import { useRef } from 'react'

import { assetOf, textOf, textsOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { useBeatTimeline } from '../motion/use-beat-timeline'
import { ShotFrame, StatusBadge } from '../ui/primitives'

import './s08.css'
import type { SceneProps } from './types'

/**
 * Scholar Learn (PARTIAL): one learner's journey from assessment to the next learning step. A marker travels the path one step per
 * beat. There is no "student sets a goal" step: the plan is drawn from the diagnosis, and the slide says so.
 */
export const BEATS = 7

const N = 7
const X0 = 210
const DX = 250
const Y = 380

export default function Scene({ deck, slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const steps = textsOf(slide, 'step')
  const x = (i: number) => X0 + i * DX

  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.s08-h, .s08-badge'), { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out' }, 0)
    tl.fromTo(q('.s08-base'), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 1.4, ease: 'power2.inOut' }, 0.4)
    tl.fromTo(q('.s08-node'), { autoAlpha: 0.25 }, { autoAlpha: 0.25, duration: 0.01 }, 0)
    tl.fromTo(q('.s08-lab'), { autoAlpha: 0, y: 14 }, { autoAlpha: 0, y: 14, duration: 0.01 }, 0)
    tl.fromTo(q('.s08-today, .s08-shot'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1.0, stagger: 0.15, ease: 'power3.out' }, 1.0)
    // The marker starts on the first step.
    tl.fromTo(q('.s08-marker'), { autoAlpha: 0, scale: 0.4, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' }, 1.3)
    tl.to(q('.s08-node-0'), { autoAlpha: 1, fill: '#1088f6', duration: 0.4 }, 1.4)
    tl.to(q('.s08-lab-0'), { autoAlpha: 1, y: 0, duration: 0.6 }, 1.5)
    tl.addLabel('b0', 2.4)
    for (let i = 1; i < N; i++) {
      const at = `b${i - 1}`
      tl.to(q('.s08-prog'), { drawSVG: `0% ${(i / (N - 1)) * 100}%`, duration: 0.9, ease: 'power2.inOut' }, `${at}+=0.05`)
      tl.to(q('.s08-marker'), { x: i * DX, duration: 0.9, ease: 'power2.inOut' }, `${at}+=0.05`)
      tl.to(q(`.s08-node-${i}`), { autoAlpha: 1, fill: '#1088f6', duration: 0.4 }, `${at}+=0.7`)
      tl.to(q(`.s08-lab-${i}`), { autoAlpha: 1, y: 0, duration: 0.6 }, `${at}+=0.7`)
      tl.to(q(`.s08-node-${i - 1}`), { fill: '#ffffff', duration: 0.3 }, `${at}+=0.7`)
      tl.addLabel(`b${i}`, `${at}+=1.5`)
    }
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="ink" style={themeVars('ink')}>
      <div className="s08-wash" />
      <div className="s08-badge">{slide.badge && <StatusBadge badge={slide.badge} />}</div>
      <h2 className="cp-display s08-h">{textOf(slide, 'headline')}</h2>

      <svg className="s08-svg" viewBox="0 0 1920 1080" aria-hidden="true">
        <path className="s08-base" d={`M${x(0)} ${Y} L${x(N - 1)} ${Y}`} stroke="rgba(255,255,255,0.18)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path className="s08-prog" d={`M${x(0)} ${Y} L${x(N - 1)} ${Y}`} stroke="#1088f6" strokeWidth="6" fill="none" strokeLinecap="round" style={{ strokeDasharray: 0 }} />
        {steps.map((_, i) => <circle key={i} className={`s08-node s08-node-${i}`} cx={x(i)} cy={Y} r="15" fill="#ffffff" />)}
        <circle className="s08-marker" cx={x(0)} cy={Y} r="30" fill="none" stroke="#9fd0ff" strokeWidth="3" />
      </svg>
      {steps.map((t, i) => (
        <div key={t} className={`s08-lab s08-lab-${i}`} style={{ left: x(i) - 120, top: Y + 44 }}>
          <span className="s08-num">{`0${i + 1}`}</span>
          {t}
        </div>
      ))}

      <p className="s08-today">{textOf(slide, 'today')}</p>
      <ShotFrame asset={assetOf(deck, 'shot-diagnostic')} label={slide.slots.find((s) => s.id === 'shot-diagnostic')?.brief ?? ''} proof={textOf(slide, 'proof')} className="s08-shot" />
    </div>
  )
}
