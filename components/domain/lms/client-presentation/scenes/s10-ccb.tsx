'use client'

import { useRef } from 'react'

import { assetOf, linesOf, textOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { gsap } from '../motion/gsap'
import { useBeatTimeline } from '../motion/use-beat-timeline'
import { ShotFrame, StatusBadge, StepMark } from '../ui/primitives'

import './s10.css'
import type { SceneProps } from './types'

/**
 * Scholar CCB (PARTIAL): from occasional training to continuing development. Six steps climb a vertical path, one per beat. Each
 * step shows whether it is built or partial by shape as well as colour; the Gap step pulses once, the only pulse on the slide.
 */
export const BEATS = 6

const N = 6
const ROW_H = 92
const TOP = 120

export default function Scene({ deck, slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const steps = linesOf(slide, 'step')

  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.s10-badge, .s10-h, .s10-tag'), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out' }, 0)
    tl.fromTo(q('.s10-today, .s10-ahead'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.15, ease: 'power3.out' }, 0.7)
    tl.fromTo(q('.s10-shot'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 1.1)
    tl.fromTo(q('.s10-spine'), { drawSVG: '0% 0%' }, { drawSVG: '0% 0%', duration: 0.01 }, 0)
    tl.fromTo(q('.s10-step'), { autoAlpha: 0.0, x: 30 }, { autoAlpha: 0, x: 30, duration: 0.01 }, 0)
    tl.to(q('.s10-step-0'), { autoAlpha: 1, x: 0, duration: 0.7, ease: 'power3.out' }, 1.0)
    tl.addLabel('b0', 2.0)
    for (let i = 1; i < N; i++) {
      const at = `b${i - 1}`
      tl.to(q('.s10-spine'), { drawSVG: `0% ${(i / (N - 1)) * 100}%`, duration: 0.8, ease: 'power2.inOut' }, `${at}+=0.05`)
      tl.to(q(`.s10-step-${i}`), { autoAlpha: 1, x: 0, duration: 0.7, ease: 'power3.out' }, `${at}+=0.4`)
      // The Gap step (index 3) pulses once.
      if (steps[i].text === 'Gap') tl.fromTo(q(`.s10-step-${i} .s10-name`), { scale: 1 }, { scale: 1.08, duration: 0.35, yoyo: true, repeat: 1, transformOrigin: '0% 50%', ease: 'sine.inOut' }, `${at}+=0.8`)
      tl.addLabel(`b${i}`, `${at}+=1.4`)
    }
    gsap.set(q('.s10-spine'), { autoAlpha: 1 })
  }, { beat, beats, entry, reduced })

  const yOf = (i: number) => TOP + i * ROW_H + 30

  return (
    <div ref={ref} className="cp-scene" data-theme="paper" style={themeVars('paper')}>
      <div className="s10-wash" />
      <div className="s10-badge">{slide.badge && <StatusBadge badge={slide.badge} />}</div>
      <h2 className="cp-display s10-h">{textOf(slide, 'headline')}</h2>
      <span className="s10-tag">{textOf(slide, 'tag')}</span>
      <p className="s10-today">{textOf(slide, 'today')}</p>
      <p className="s10-ahead">{textOf(slide, 'ahead')}</p>

      <svg className="s10-svg" viewBox="0 0 1920 1080" aria-hidden="true">
        <line x1="1000" y1={yOf(0)} x2="1000" y2={yOf(N - 1)} stroke="rgba(12,42,74,0.14)" strokeWidth="3" />
        <line className="s10-spine" x1="1000" y1={yOf(0)} x2="1000" y2={yOf(N - 1)} stroke="#0a6ad0" strokeWidth="5" strokeLinecap="round" />
      </svg>

      {steps.map((l, i) => (
        <div key={l.text} className={`s10-step s10-step-${i}`} data-mark={l.mark ?? 'built'} style={{ top: yOf(i) - 30 }}>
          <span className="s10-mk"><StepMark mark={l.mark} size={34} /></span>
          <span className="s10-num">{`0${i + 1}`}</span>
          <span className="s10-name cp-display">{l.text}</span>
          <span className="s10-state">{l.mark === 'partial' ? 'Partly built' : 'Works today'}</span>
        </div>
      ))}

      <ShotFrame asset={assetOf(deck, 'shot-gap')} label={slide.slots.find((s) => s.id === 'shot-gap')?.brief ?? ''} proof={textOf(slide, 'proof')} className="s10-shot" />
    </div>
  )
}
