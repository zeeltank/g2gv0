'use client'

import { useRef } from 'react'

import { assetOf, linesOf, textOf, textsOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { useBeatTimeline } from '../motion/use-beat-timeline'
import { ShotFrame } from '../ui/primitives'

import './s11.css'
import type { SceneProps } from './types'

/**
 * Scholar Insight: decision support, not a dashboard. Three signals converge into one case, which forks into the three
 * things a person can do with a recommendation. The diagram is a schematic of how a case is formed; it mimics no screen.
 */
export const BEATS = 3

const THREAD_Y = [350, 470, 590]
const CASE = { x: 1110, y: 470 }
const DEC_Y = [360, 470, 580]
const DEC_X = 1390

export default function Scene({ deck, slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const steps = linesOf(slide, 'step')
  const threads = textsOf(slide, 'thread')
  const decisions = textsOf(slide, 'decision')

  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.s11-h, .s11-tag'), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out' }, 0)
    tl.fromTo(q('.s11-step'), { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: 0.7, stagger: 0.1 }, 0.6)
    tl.fromTo(q('.s11-thread'), { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.8, stagger: 0.14, ease: 'power3.out' }, 1.0)
    tl.addLabel('b0', 2.4)
    // b1: the three signals converge into one case.
    tl.fromTo(q('.s11-in'), { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 100%', duration: 1.1, stagger: 0.12, ease: 'power2.inOut' }, 'b0+=0.1')
    tl.fromTo(q('.s11-case'), { autoAlpha: 0, scale: 0.6, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.8, ease: 'back.out(1.8)' }, 'b0+=1.0')
    tl.addLabel('b1', 'b0+=2.0')
    // b2: the case forks into three decisions a person can make.
    tl.fromTo(q('.s11-out'), { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 100%', duration: 1.0, stagger: 0.12, ease: 'power2.inOut' }, 'b1+=0.1')
    tl.fromTo(q('.s11-dec'), { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: 0.7, stagger: 0.12 }, 'b1+=0.8')
    tl.addLabel('b2', 'b1+=1.8')
    // b3: what the product does, the honest limit of the reading, and where it appears.
    tl.fromTo(q('.s11-today, .s11-limit, .s11-shot'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.14, ease: 'power3.out' }, 'b2+=0.1')
    tl.addLabel('b3', 'b2+=1.6')
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="ink" style={themeVars('ink')}>
      <div className="s11-wash" />
      <h2 className="cp-display s11-h">{textOf(slide, 'headline')}</h2>
      <span className="s11-tag">{textOf(slide, 'tag')}</span>

      <ol className="s11-steps">
        {steps.map((l, i) => (
          <li key={l.text} className="s11-step">
            <span className="s11-mk"><i /></span>
            <span className="s11-sn">{`0${i + 1}`}</span>
            {l.text}
          </li>
        ))}
      </ol>

      <svg className="s11-svg" viewBox="0 0 1920 1080" aria-hidden="true">
        {THREAD_Y.map((y, i) => <path key={i} className="s11-in" d={`M900 ${y} C990 ${y} 1020 ${CASE.y} ${CASE.x - 95} ${CASE.y}`} fill="none" stroke="#9fd0ff" strokeWidth="4" strokeLinecap="round" />)}
        {DEC_Y.map((y, i) => <path key={i} className="s11-out" d={`M${CASE.x + 95} ${CASE.y} C${CASE.x + 170} ${CASE.y} ${DEC_X - 90} ${y} ${DEC_X - 12} ${y}`} fill="none" stroke="#9fd0ff" strokeWidth="4" strokeLinecap="round" />)}
      </svg>
      {threads.map((t, i) => <div key={t} className="s11-thread" style={{ top: THREAD_Y[i] - 26 }}>{t}</div>)}
      <div className="s11-case" style={{ left: CASE.x - 95, top: CASE.y - 95 }}><span>{textOf(slide, 'case')}</span></div>
      {decisions.map((t, i) => <div key={t} className="s11-dec" style={{ left: DEC_X, top: DEC_Y[i] - 28 }}>{t}</div>)}

      <p className="s11-today">{textOf(slide, 'today')}</p>
      <p className="s11-limit">{textOf(slide, 'limit')}</p>
      <ShotFrame asset={assetOf(deck, 'shot-case')} label={slide.slots.find((s) => s.id === 'shot-case')?.brief ?? ''} proof={textOf(slide, 'proof')} className="s11-shot" />
    </div>
  )
}
