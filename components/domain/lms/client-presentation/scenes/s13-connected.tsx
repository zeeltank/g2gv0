'use client'

import { useRef } from 'react'

import { textOf, textsOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { useBeatTimeline } from '../motion/use-beat-timeline'

import './s13.css'
import type { SceneProps } from './types'

/**
 * How the pieces work together: four parts of the school and the three connections between them, drawn one at a time.
 * Every line is a connection the code really makes; nothing is drawn that does not exist.
 */
export const BEATS = 3

type NodeKey = 'ops' | 'learning' | 'leadership' | 'career'
// Text order in the story: School operations, Student learning, Leadership, Career exploration.
const ORDER: NodeKey[] = ['ops', 'learning', 'leadership', 'career']
const POS: Record<NodeKey, { x: number; y: number; label: 'above' | 'below' | 'left' }> = {
  ops: { x: 1000, y: 380, label: 'above' },
  learning: { x: 1180, y: 680, label: 'left' },
  leadership: { x: 1680, y: 380, label: 'above' },
  career: { x: 1680, y: 840, label: 'below' },
}
const LINKS = [
  { id: 'l1', d: 'M1180 680 C1330 750 1520 810 1680 840', n: '1', at: [1440, 790] },
  { id: 'l2', d: 'M1000 380 L1680 380', n: '2', at: [1340, 380] },
  { id: 'l3', d: 'M1180 680 C1330 560 1500 450 1680 380', n: '3', at: [1445, 508] },
] as const

export default function Scene({ slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const nodes = textsOf(slide, 'node')
  const links = textsOf(slide, 'link-built')

  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.s13-head > *'), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' }, 0)
    tl.fromTo(q('.s13-node'), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.6, stagger: 0.1, ease: 'back.out(2)' }, 0.5)
    tl.fromTo(q('.s13-item'), { autoAlpha: 0.22 }, { autoAlpha: 0.22, duration: 0.01 }, 0)
    tl.addLabel('b0', 2.0)
    LINKS.forEach((l, i) => {
      const at = `b${i}`
      tl.fromTo(q(`.s13-${l.id}`), { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 100%', duration: 1.3, ease: 'power2.inOut' }, `${at}+=0.05`)
      tl.fromTo(q(`.s13-num-${l.id}`), { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2.4)' }, `${at}+=1.0`)
      tl.to(q(`.s13-item-${l.id}`), { autoAlpha: 1, duration: 0.7 }, `${at}+=0.4`)
      tl.addLabel(`b${i + 1}`, `${at}+=1.7`)
    })
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="ink">
      <div className="s13-wash" />
      <div className="s13-head">
        <h2 className="cp-display s13-h">{textOf(slide, 'headline')}</h2>
      </div>

      <ol className="s13-items">
        {links.map((t, i) => (
          <li key={t} className={`s13-item s13-item-${LINKS[i].id}`}><span className="s13-n">{LINKS[i].n}</span>{t}</li>
        ))}
      </ol>

      <svg className="s13-svg" viewBox="0 0 1920 1080" aria-hidden="true">
        {LINKS.map((l) => <path key={l.id} className={`s13-${l.id}`} d={l.d} fill="none" stroke="#9fd0ff" strokeWidth="4.5" strokeLinecap="round" />)}
      </svg>

      {LINKS.map((l) => (
        <span key={l.id} className={`s13-num s13-num-${l.id}`} style={{ left: l.at[0] - 22, top: l.at[1] - 22 }} aria-hidden="true">{l.n}</span>
      ))}

      {ORDER.map((k, i) => (
        <div key={k} className={`s13-node s13-node-${k}`} data-label={POS[k].label} style={{ left: POS[k].x, top: POS[k].y }}>
          <i className="s13-dot" />
          <span className="s13-lab">{nodes[i]}</span>
        </div>
      ))}
    </div>
  )
}
