'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useRef } from 'react'

import { assetOf, linesOf, textOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { useBeatTimeline } from '../motion/use-beat-timeline'
import { ShotFrame } from '../ui/primitives'

import './s07.css'
import type { SceneProps } from './types'
import { splitName } from './util'

/**
 * Scholar Core (LIVE): the everyday work of the school. One workflow opens at a time, next to its screen. The screens are labelled
 * placeholders until genuine screenshots from an authorised environment are supplied; nothing here is a drawn interface.
 */
export const BEATS = 3

export default function Scene({ deck, slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const rows = linesOf(slide, 'row').map((l) => splitName(l.text))
  const open = Math.min(beat, rows.length - 1)
  const slots = slide.slots.filter((s) => s.type === 'screenshot')
  const slot = slots[open]

  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.s07-h, .s07-badge'), { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out' }, 0)
    tl.fromTo(q('.s07-row'), { autoAlpha: 0, x: -40 }, { autoAlpha: 1, x: 0, duration: 0.8, stagger: 0.14, ease: 'power3.out' }, 0.5)
    tl.fromTo(q('.s07-shotwrap'), { autoAlpha: 0, x: 60 }, { autoAlpha: 1, x: 0, duration: 1.0, ease: 'power3.out' }, 0.7)
    tl.fromTo(q('.s07-more'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 1.4)
    tl.addLabel('b0', 2.2)
    tl.addLabel('b1', 'b0+=0.5')
    tl.addLabel('b2', 'b1+=0.5')
    tl.fromTo(q('.s07-situation, .s07-value'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.15 }, 'b2+=0.4')
    tl.addLabel('b3', 'b2+=1.5')
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="paper" style={themeVars('paper')}>
      <h2 className="cp-display s07-h">{textOf(slide, 'headline')}</h2>

      <ol className="s07-rows">
        {rows.map((r, i) => (
          <li key={r.name} className="s07-row" data-open={open === i}>
            <div className="s07-row-head"><span className="s07-n">{`0${i + 1}`}</span><span className="s07-name">{r.name}</span></div>
            <motion.div
              className="s07-row-body"
              initial={false}
              animate={{ height: open === i ? 'auto' : 0, opacity: open === i ? 1 : 0 }}
              transition={{ duration: reduced ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              <p>{r.desc}</p>
            </motion.div>
          </li>
        ))}
      </ol>

      <p className="s07-situation">{textOf(slide, 'situation')}</p>
      <p className="s07-value">{textOf(slide, 'value')}</p>

      <div className="s07-shotwrap">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={slot.id} className="s07-shotswap" initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: reduced ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.35 }}>
            <ShotFrame asset={assetOf(deck, slot.id)} label={slot.brief} proof={textOf(slide, 'proof')} className="s07-shot" />
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="s07-more">{textOf(slide, 'more')}</p>
    </div>
  )
}
