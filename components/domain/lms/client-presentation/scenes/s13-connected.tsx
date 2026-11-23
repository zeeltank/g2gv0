'use client'

import { useRef } from 'react'

import { textOf, textsOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { useBeatTimeline } from '../motion/use-beat-timeline'
import { StatusBadge } from '../ui/primitives'

import './s13.css'
import type { SceneProps } from './types'

/**
 * What is connected today and what is not. Only real connections move: solid lines draw once, dashed lines (design intent) never animate.
 * The teacher-capability node is drawn hollow and dashed because, in the school product, nothing is connected to it yet.
 */
export const BEATS = 4

type NodeKey = 'ops' | 'learning' | 'teacher' | 'leadership' | 'career'
// Text order in the story: School operations, Student learning, Teacher capability, Leadership, Career exploration.
const ORDER: NodeKey[] = ['ops', 'learning', 'teacher', 'leadership', 'career']
const POS: Record<NodeKey, { x: number; y: number; label: 'above' | 'below' | 'left' }> = {
  ops: { x: 960, y: 360, label: 'above' },
  learning: { x: 1200, y: 640, label: 'left' },
  teacher: { x: 1020, y: 900, label: 'below' },
  leadership: { x: 1680, y: 360, label: 'above' },
  career: { x: 1680, y: 800, label: 'below' },
}
const BUILT = [
  { id: 'l1', d: 'M1200 640 C1360 700 1540 760 1680 800', n: '1', at: [1450, 735] },
  { id: 'l2', d: 'M960 360 L1680 360', n: '2', at: [1320, 360] },
  { id: 'l3', d: 'M1200 640 C1330 520 1500 430 1680 360', n: '3', at: [1445, 498] },
] as const
const CONCEPT = [
  'M1020 900 L1200 640',
  'M1020 900 C1250 800 1500 770 1680 800',
]

export default function Scene({ slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const nodes = textsOf(slide, 'node')
  const built = textsOf(slide, 'link-built')
  const unbuilt = textOf(slide, 'link-concept')

  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.s13-head > *'), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' }, 0)
    tl.fromTo(q('.s13-node'), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.6, stagger: 0.1, ease: 'back.out(2)' }, 0.5)
    tl.fromTo(q('.s13-legend'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 1.2)
    tl.fromTo(q('.s13-item'), { autoAlpha: 0.22 }, { autoAlpha: 0.22, duration: 0.01 }, 0)
    tl.addLabel('b0', 2.0)
    BUILT.forEach((l, i) => {
      const at = `b${i}`
      tl.fromTo(q(`.s13-${l.id}`), { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 100%', duration: 1.3, ease: 'power2.inOut' }, `${at}+=0.05`)
      tl.fromTo(q(`.s13-num-${l.id}`), { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2.4)' }, `${at}+=1.0`)
      tl.to(q(`.s13-item-${l.id}`), { autoAlpha: 1, duration: 0.7 }, `${at}+=0.4`)
      tl.addLabel(`b${i + 1}`, `${at}+=1.7`)
    })
    // b4: the connections that are not built: dashed, they fade in and never move.
    tl.fromTo(q('.s13-dash'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.0, stagger: 0.15 }, 'b3+=0.1')
    tl.fromTo(q('.s13-concept'), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 'b3+=0.4')
    tl.addLabel('b4', 'b3+=1.7')
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="ink" style={themeVars('ink')}>
      <div className="s13-wash" />
      <div className="s13-head">
        <div className="s13-kick">
          {slide.badge && <StatusBadge badge={slide.badge} />}
        </div>
        <h2 className="cp-display s13-h">{textOf(slide, 'headline')}</h2>
      </div>

      <ol className="s13-items">
        {built.map((t, i) => (
          <li key={t} className={`s13-item s13-item-${BUILT[i].id}`}><span className="s13-n">{BUILT[i].n}</span>{t}</li>
        ))}
      </ol>
      <div className="s13-legend">
        <span><i className="s13-key s13-key-solid" />{textOf(slide, 'legend').split('. ')[0]}.</span>{' '}
        <span><i className="s13-key s13-key-dash" />{textOf(slide, 'legend').split('. ')[1]}</span>
      </div>
      <p className="s13-concept">{unbuilt}</p>

      <svg className="s13-svg" viewBox="0 0 1920 1080" aria-hidden="true">
        {CONCEPT.map((d, i) => <path key={i} className="s13-dash" d={d} fill="none" stroke="#b7c7da" strokeOpacity="0.75" strokeWidth="2.5" strokeDasharray="4 11" strokeLinecap="round" />)}
        {BUILT.map((l) => <path key={l.id} className={`s13-${l.id}`} d={l.d} fill="none" stroke="#9fd0ff" strokeWidth="4.5" strokeLinecap="round" />)}
      </svg>

      {BUILT.map((l) => (
        <span key={l.id} className={`s13-num s13-num-${l.id}`} style={{ left: l.at[0] - 22, top: l.at[1] - 22 }} aria-hidden="true">{l.n}</span>
      ))}

      {ORDER.map((k, i) => (
        <div key={k} className={`s13-node s13-node-${k}`} data-built={k !== 'teacher'} data-label={POS[k].label} style={{ left: POS[k].x, top: POS[k].y }}>
          <i className="s13-dot" />
          <span className="s13-lab">{nodes[i]}</span>
        </div>
      ))}
    </div>
  )
}
