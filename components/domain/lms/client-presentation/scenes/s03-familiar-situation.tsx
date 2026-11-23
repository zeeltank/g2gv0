'use client'

import { useRef } from 'react'

import { assetOf, textOf, textsOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { gsap } from '../motion/gsap'
import { useBeatTimeline } from '../motion/use-beat-timeline'
import { Photo } from '../ui/primitives'

import './s03.css'
import type { SceneProps } from './types'

/**
 * One struggling student and three records. Beat 1 gathers the records into a stack; beat 2 shows the same records two ways:
 * left on the shelf (recorded) or carried forward (understood). The right-hand copies are decorative (aria-hidden).
 */
export const BEATS = 2

// Slip positions in stage pixels (top-left of each 270 x 150 slip).
const SHELF = [{ x: 880, y: 420, r: -3 }, { x: 1160, y: 548, r: 2 }, { x: 1440, y: 676, r: -2 }]
// A stack is three slips each 52 px lower than the last, so every label stays readable.
const stackAt = (x: number, y: number, r: number[]) => [0, 1, 2].map((i) => ({ x: x + i * 8, y: y + i * 52, r: r[i] }))
const STACK = stackAt(1060, 450, [-1, 1, -1])
const LEFT_COL = stackAt(880, 440, [-1, 1, -1])
const RIGHT_COL = stackAt(1290, 440, [0, 0, 0])

export default function Scene({ deck, slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const slips = textsOf(slide, 'card')

  useBeatTimeline(ref, (tl, { q }) => {
    const base = q('.s03-slip-base')
    const fwd = q('.s03-slip-fwd')
    gsap.set(fwd, { autoAlpha: 0 })
    tl.fromTo(q('.s03-photo'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out' }, 0)
    tl.fromTo(q('.s03-h, .s03-tag'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' }, 0.4)
    base.forEach((el, i) => {
      tl.fromTo(el, { autoAlpha: 0, x: SHELF[i].x, y: SHELF[i].y - 60, rotation: SHELF[i].r - 6 }, { autoAlpha: 1, x: SHELF[i].x, y: SHELF[i].y, rotation: SHELF[i].r, duration: 0.9, ease: 'power3.out' }, 0.9 + i * 0.18)
    })
    tl.addLabel('b0', 2.6)
    // b1: gather into one stack.
    base.forEach((el, i) => tl.to(el, { x: STACK[i].x, y: STACK[i].y, rotation: STACK[i].r, duration: 1.1, ease: 'power3.inOut' }, `b0+=${i * 0.08}`))
    tl.addLabel('b1', 'b0+=1.5')
    // b2: the same records, two outcomes.
    base.forEach((el, i) => tl.to(el, { x: LEFT_COL[i].x, y: LEFT_COL[i].y, rotation: LEFT_COL[i].r, opacity: 0.55, duration: 0.9, ease: 'power3.inOut' }, 'b1+=0.1'))
    fwd.forEach((el, i) => {
      tl.fromTo(el, { autoAlpha: 0, x: STACK[i].x, y: STACK[i].y, rotation: STACK[i].r }, { autoAlpha: 1, x: RIGHT_COL[i].x, y: RIGHT_COL[i].y, rotation: 0, duration: 1.1, ease: 'power3.inOut' }, `b1+=${0.15 + i * 0.12}`)
    })
    tl.fromTo(q('.s03-arrow'), { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 100%', duration: 1.2, ease: 'power2.inOut' }, 'b1+=0.6')
    tl.fromTo(q('.s03-col'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.15 }, 'b1+=0.6')
    tl.addLabel('b2', 'b1+=2.0')
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="paper" style={themeVars('paper')}>
      <Photo asset={assetOf(deck, 'img-student')} alt="A student writing in a notebook" className="s03-photo" />
      <h2 className="cp-display s03-h">{textOf(slide, 'headline')}</h2>
      <span className="s03-tag">{textOf(slide, 'tag')}</span>

      {slips.map((t, i) => <div key={t} className="s03-slip s03-slip-base">{t}</div>)}
      {slips.map((t, i) => <div key={`f${i}`} className="s03-slip s03-slip-fwd" aria-hidden="true">{t}</div>)}

      <svg className="s03-svg" viewBox="0 0 1920 1080" aria-hidden="true">
        <path className="s03-arrow" d="M1650 548 L1872 548" fill="none" stroke="#0a6ad0" strokeWidth="5" strokeLinecap="round" />
        <path className="s03-arrow" d="M1846 522 L1878 548 L1846 574" fill="none" stroke="#0a6ad0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div className="s03-col s03-col-left"><p>{textOf(slide, 'compare-left')}</p></div>
      <div className="s03-col s03-col-right"><p>{textOf(slide, 'compare-right')}</p></div>
    </div>
  )
}
