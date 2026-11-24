'use client'

import { useRef } from 'react'

import { textOf, textsOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { SplitText } from '../motion/gsap'
import { useBeatTimeline } from '../motion/use-beat-timeline'

import './s02.css'
import type { SceneProps } from './types'

/**
 * The eight places a school's information already lives, hung loosely around an empty centre. One thread passes between two of them
 * and holds: the data exists, what is missing is the connection. No photograph: the principal's photo slot is empty, so the
 * composition stands on type and a single quiet ring.
 */
export const BEATS = 2

export const CX = 1400
export const CY = 560
// Hand-placed positions (stage pixels) so the tags feel placed, not computed, and never touch each other or the headline.
const POS: { x: number; y: number; r: number }[] = [
  { x: 1610, y: 215, r: -2 }, { x: 1745, y: 440, r: 2 }, { x: 1700, y: 690, r: -2 }, { x: 1545, y: 880, r: 2 },
  { x: 1235, y: 905, r: -2 }, { x: 1065, y: 745, r: 2 }, { x: 1045, y: 480, r: -2 }, { x: 1235, y: 250, r: 2 },
]

export function tagPos(i: number): { x: number; y: number; r: number } {
  return POS[i % POS.length]
}

export default function Scene({ slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const tags = textsOf(slide, 'ring')
  const p1 = tagPos(1)
  const p2 = tagPos(4)
  const thread = `M${p1.x} ${p1.y} Q${CX + 20} ${CY - 30} ${p2.x} ${p2.y}`

  useBeatTimeline(ref, (tl, { q }) => {
    const split = SplitText.create(q('.s02-h')[0], { type: 'words', mask: 'words' })
    tl.fromTo(q('.s02-ring'), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 2.2, ease: 'power2.inOut' }, 0)
    tl.fromTo(split.words, { yPercent: 110, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.0, stagger: 0.07, ease: 'power3.out' }, 0.3)
    tl.fromTo(q('.s02-tag'), { autoAlpha: 0, scale: 0.86, y: 34 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.9, stagger: 0.14, ease: 'power3.out' }, 0.8)
    tl.addLabel('b0', 2.9)
    // b1: one thread passes between two of them and holds; the two tags it joins lift a little.
    tl.fromTo(q('.s02-thread'), { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 100%', duration: 1.5, ease: 'power2.inOut' }, 'b0+=0.1')
    tl.to(q('.s02-tag-1, .s02-tag-4'), { backgroundColor: '#9fd0ff', color: '#06182b', duration: 0.6 }, 'b0+=1.0')
    tl.addLabel('b1', 'b0+=1.9')
    // b2: the statement.
    tl.fromTo(q('.s02-support'), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 1.0, ease: 'power3.out' }, 'b1+=0.1')
    tl.addLabel('b2', 'b1+=1.4')
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="ink" style={themeVars('ink')}>
      <div className="s02-wash" />
      <svg className="s02-svg" viewBox="0 0 1920 1080" aria-hidden="true">
        <circle className="s02-ring" cx={CX} cy={CY} r="190" fill="none" stroke="rgba(159,208,255,0.35)" strokeWidth="1.5" strokeDasharray="2 9" transform={`rotate(-90 ${CX} ${CY})`} />
        <path className="s02-thread" d={thread} fill="none" stroke="#9fd0ff" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <h2 className="cp-display s02-h">{textOf(slide, 'headline')}</h2>
      <p className="s02-support">{textOf(slide, 'support')}</p>
      {tags.map((t, i) => {
        const p = tagPos(i)
        return (
          <span key={t} className={`s02-tag s02-tag-${i}`} style={{ left: p.x, top: p.y, transform: `translate(-50%, -50%) rotate(${p.r}deg)` }}>
            {t}
          </span>
        )
      })}
    </div>
  )
}
