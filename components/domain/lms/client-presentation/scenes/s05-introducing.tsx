'use client'

import { useRef } from 'react'

import { assetOf, linesOf, textOf, textsOf, type Badge } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { SplitText } from '../motion/gsap'
import { useBeatTimeline } from '../motion/use-beat-timeline'
import { StatusBadge } from '../ui/primitives'

import './s05.css'
import type { SceneProps } from './types'

/**
 * The first appearance of the name. The line from slide 4 closes into the brand ring; then the one-sentence positioning, then the
 * plain-language definition and the legend that says how every later slide separates what works today from what is ahead.
 */
export const BEATS = 2

const RING_R = 318

export default function Scene({ deck, slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const logo = assetOf(deck, 'img-logo')
  const legend = linesOf(slide, 'legend-item').map((l) => l.text as Badge)
  const hints = textsOf(slide, 'legend-hint')

  useBeatTimeline(ref, (tl, { q }) => {
    const split = SplitText.create(q('.s05-pos')[0], { type: 'lines', mask: 'lines', aria: 'none' })
    // b0: the ring draws itself, the logo settles inside it, the name appears.
    tl.fromTo(q('.s05-ring'), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 1.6, ease: 'power2.inOut' }, 0)
    tl.fromTo(q('.s05-logo'), { autoAlpha: 0, scale: 0.86, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 1.2, ease: 'power3.out' }, 0.9)
    tl.fromTo(q('.s05-brand'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 1.4)
    tl.addLabel('b0', 2.6)
    // b1: the positioning sentence.
    tl.fromTo(split.lines, { yPercent: 105, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.0, stagger: 0.12, ease: 'power3.out' }, 'b0+=0.1')
    tl.addLabel('b1', 'b0+=1.6')
    // b2: the definition and the legend.
    tl.fromTo(q('.s05-def'), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 'b1+=0.1')
    tl.fromTo(q('.s05-legend > *'), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12 }, 'b1+=0.7')
    tl.addLabel('b2', 'b1+=1.9')
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="ink" style={themeVars('ink')}>
      <div className="s05-wash" />
      <div className="s05-mark">
        <svg viewBox="-360 -360 720 720" className="s05-ring-svg" aria-hidden="true">
          <circle className="s05-ring" r={RING_R} fill="none" stroke="#1088f6" strokeWidth="3" transform="rotate(-90)" />
        </svg>
        {logo?.src && (
          <img className="s05-logo" src={logo.src} alt={logo.alt ?? 'ScholarClone logo'} draggable={false} />
        )}
      </div>
      <div className="s05-copy">
        <div className="s05-brand cp-kicker">{textOf(slide, 'brand')}</div>
        <p className="cp-display s05-pos">{textOf(slide, 'headline')}</p>
        <p className="s05-def">{textOf(slide, 'definition')}</p>
        <div className="s05-legend">
          <p className="s05-legend-t">{textOf(slide, 'legend')}</p>
          <ul>
            {legend.map((b, i) => (
              <li key={b}>
                <StatusBadge badge={b} />
                <span>{hints[i]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
