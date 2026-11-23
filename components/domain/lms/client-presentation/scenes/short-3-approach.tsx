'use client'

import { useRef } from 'react'

import { assetOf, linesOf, slideByN, textOf, textsOf, type Badge } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { SplitText } from '../motion/gsap'
import { useBeatTimeline } from '../motion/use-beat-timeline'
import { StatusBadge } from '../ui/primitives'

import './short3.css'
import type { SceneProps } from './types'
import { splitName } from './util'

/**
 * Five-slide version, scene 3: the approach. The positioning sentence, the six products each with its status, and the legend.
 * No product detail: that belongs to the full deck.
 */
export const BEATS = 2

export default function Scene({ deck, slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const s6 = slideByN(deck, 6)
  const logo = assetOf(deck, 'img-logo')
  const products = linesOf(s6, 'product').map((l) => ({ ...splitName(l.text), badge: l.badge! }))
  const legend = linesOf(slide, 'legend-item').map((l) => l.text as Badge)
  const hints = textsOf(slide, 'legend-hint')

  useBeatTimeline(ref, (tl, { q }) => {
    const split = SplitText.create(q('.ss3-pos')[0], { type: 'lines', mask: 'lines', aria: 'none' })
    tl.fromTo(q('.ss3-logo'), { autoAlpha: 0, scale: 0.88, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 1.1, ease: 'power3.out' }, 0)
    tl.fromTo(q('.ss3-brand'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.5)
    tl.fromTo(split.lines, { yPercent: 105, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.0, stagger: 0.12, ease: 'power3.out' }, 0.7)
    tl.addLabel('b0', 2.3)
    tl.fromTo(q('.ss3-row'), { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out' }, 'b0+=0.1')
    tl.addLabel('b1', 'b0+=1.6')
    tl.fromTo(q('.ss3-legend > *'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12 }, 'b1+=0.1')
    tl.addLabel('b2', 'b1+=1.3')
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="ink" style={themeVars('ink')}>
      <div className="ss3-wash" />
      {logo?.src && (
        <img className="ss3-logo" src={logo.src} alt={logo.alt ?? 'ScholarClone logo'} draggable={false} />
      )}
      <div className="ss3-brand cp-kicker">{textOf(slide, 'brand')}</div>
      <p className="cp-display ss3-pos">{textOf(slide, 'headline')}</p>
      <ul className="ss3-rows">
        {products.map((p) => (
          <li key={p.name} className="ss3-row">
            <span className="ss3-name cp-display">{p.name}</span>
            <span className="ss3-desc">{p.desc}</span>
            <StatusBadge badge={p.badge} />
          </li>
        ))}
      </ul>
      <div className="ss3-legend">
        {legend.map((b, i) => (
          <span key={b} className="ss3-key"><StatusBadge badge={b} /><em>{hints[i]}</em></span>
        ))}
      </div>
    </div>
  )
}
