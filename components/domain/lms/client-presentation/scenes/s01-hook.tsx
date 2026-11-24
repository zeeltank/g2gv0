'use client'

import { useRef } from 'react'

import { assetOf, textOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { gsap, SplitText } from '../motion/gsap'
import { useBeatTimeline } from '../motion/use-beat-timeline'

import { HookBackdrop } from './hook-backdrop'
import './s01-hook.css'
import type { SceneProps } from './types'

/** Opening slide: a question, a photograph that is never fully in focus, and threads that start and stop. It does not answer. */
export const BEATS = 2

export default function Scene({ deck, slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const head = textOf(slide, 'headline')
  const [before, after] = head.split(' not ')

  useBeatTimeline(ref, (tl, { q }) => {
    const h = q('.s01-h')[0]
    const split = SplitText.create(h, { type: 'words', mask: 'words' })

    // Entrance (b0): the room fades in, points appear, one thread starts and stops, the question rises word by word.
    tl.fromTo(q('.hb-base'), { autoAlpha: 0, scale: 1.1 }, { autoAlpha: 1, scale: 1.06, duration: 2.4, ease: 'power2.out' }, 0)
    tl.fromTo(q('.hb-sharp'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 2.4, ease: 'power2.out' }, 0.2)
    tl.fromTo(q('.hb-pt'), { autoAlpha: 0, scale: 0.2, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.8, stagger: 0.12, ease: 'back.out(2)' }, 0.9)
    tl.fromTo(split.words, { yPercent: 115, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.1, stagger: 0.1, ease: 'power3.out' }, 0.9)
    tl.fromTo(q('.hb-t1'), { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 58%', duration: 1.2, ease: 'power2.inOut' }, 1.5)
    tl.to(q('.hb-t1'), { autoAlpha: 0, duration: 0.9, ease: 'power1.in' }, 2.8)
    tl.addLabel('b0', 3.7)

    // b1: the supporting line; a second thread starts and stops.
    tl.fromTo(q('.s01-support'), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 'b0+=0.1')
    tl.fromTo(q('.hb-t2'), { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 52%', duration: 1.1, ease: 'power2.inOut' }, 'b0+=0.2')
    tl.to(q('.hb-t2'), { autoAlpha: 0, duration: 0.8 }, 'b0+=1.4')
    tl.addLabel('b1', 'b0+=2.3')

    // b2: the closing line; a third thread starts and stops; the pool of focus widens a little, but never to the whole room.
    tl.fromTo(q('.s01-closing'), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 'b1+=0.1')
    tl.fromTo(q('.hb-t3'), { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 60%', duration: 1.1, ease: 'power2.inOut' }, 'b1+=0.2')
    tl.to(q('.hb-t3'), { autoAlpha: 0, duration: 0.8 }, 'b1+=1.4')
    tl.to(q('.hb-sharp'), { '--fr': '440px', duration: 1.8, ease: 'sine.inOut' }, 'b1')
    tl.addLabel('b2', 'b1+=2.4')

    // The pool of focus drifts slowly across the room: part of the picture is always clear, never all of it.
    if (!reduced) gsap.to(q('.hb-sharp'), { '--fx': '72%', '--fy': '52%', duration: 11, ease: 'sine.inOut', yoyo: true, repeat: -1 })
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="ink" style={themeVars('ink')}>
      <HookBackdrop asset={assetOf(deck, 'img-hook')} />
      <div className="s01-copy">
        <h1 className="cp-display cp-h1 s01-h">{after === undefined ? head : <>{before} <em>not</em> {after}</>}</h1>
        <p className="s01-support">{textOf(slide, 'support')}</p>
      </div>
      <p className="s01-closing">{textOf(slide, 'closing')}</p>
    </div>
  )
}
