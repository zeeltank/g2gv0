'use client'

import { useRef } from 'react'

import { assetOf, textOf, textsOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { gsap, SplitText } from '../motion/gsap'
import { useBeatTimeline } from '../motion/use-beat-timeline'

import { HookBackdrop } from './hook-backdrop'
import './s01-hook.css'
import type { SceneProps } from './types'

/** The invitation reverses the opening: the same room comes fully into focus and one thread completes. */
export const BEATS = 1

export default function Scene({ deck, slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const items = textsOf(slide, 'item')

  useBeatTimeline(ref, (tl, { q }) => {
    const split = SplitText.create(q('.s15-h')[0], { type: 'words', mask: 'words' })
    tl.fromTo(q('.hb-base'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4 }, 0)
    tl.fromTo(q('.hb-sharp'), { autoAlpha: 0, '--fr': '300px' }, { autoAlpha: 1, '--fr': '2600px', duration: 3.2, ease: 'power2.inOut' }, 0)
    tl.fromTo(q('.hb-pt'), { autoAlpha: 0, scale: 0.3, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.7, stagger: 0.08 }, 0.6)
    tl.fromTo(q('.hb-t1'), { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 100%', duration: 2.2, ease: 'power2.inOut' }, 1.4)
    tl.fromTo(split.words, { yPercent: 115, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.1, stagger: 0.08, ease: 'power3.out' }, 0.7)
    tl.fromTo(q('.s15-support'), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 1.8)
    tl.addLabel('b0', 3.6)

    tl.fromTo(q('.s15-item'), { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.14, ease: 'power2.out' }, 'b0+=0.1')
    tl.fromTo(q('.s15-close, .s15-contact'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.1 }, 'b0+=0.9')
    tl.addLabel('b1', 'b0+=2.0')
    // Threads two and three stay hidden: only the single completed line is shown.
    gsap.set(q('.hb-t2, .hb-t3'), { autoAlpha: 0 })
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="ink" style={themeVars('ink')}>
      <HookBackdrop asset={assetOf(deck, 'img-hook')} />
      <div className="s15-band" />
      <div className="s15-copy">
        <h2 className="cp-display s15-h">{textOf(slide, 'headline')}</h2>
        <p className="s15-support">{textOf(slide, 'support')}</p>
      </div>
      <ol className="s15-items">
        {items.map((t) => {
          const m = /^(\d)\.\s+(.*)$/.exec(t)
          return <li key={t} className="s15-item">{m ? <><b>{m[1]}.</b>{' '}{m[2]}</> : t}</li>
        })}
      </ol>
      <p className="s15-close">{textOf(slide, 'close')}</p>
      <div className="s15-contact">{textOf(slide, 'contact')}</div>
    </div>
  )
}
