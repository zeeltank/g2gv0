'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useRef } from 'react'

import { assetOf, textOf, textsOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { gsap } from '../motion/gsap'
import { useBeatTimeline } from '../motion/use-beat-timeline'
import { Photo } from '../ui/primitives'

import './s14.css'
import type { SceneProps } from './types'

/**
 * A principal's morning. Five questions the principal asks; each opens to name the product that holds its answer. The slide ends on the
 * leadership overview, which brings health, what changed, what is at risk and priority actions onto one page.
 */
export const BEATS = 5

export default function Scene({ deck, slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const questions = textsOf(slide, 'q')
  const answers = textsOf(slide, 'q-answer')
  const open = beat >= 1 ? beat - 1 : -1

  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.s14-photo'), { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, duration: 2.0, ease: 'power2.out' }, 0)
    tl.fromTo(q('.s14-h, .s14-tag'), { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' }, 0.5)
    tl.fromTo(q('.s14-q'), { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.8, stagger: 0.12, ease: 'power2.out' }, 0.9)
    tl.fromTo(q('.s14-note'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 1.8)
    tl.addLabel('b0', 2.6)
    for (let i = 1; i <= 5; i++) tl.addLabel(`b${i}`, `b${i - 1}+=0.6`)
    if (!reduced) gsap.to(q('.s14-photo img'), { scale: 1.05, duration: 16, ease: 'sine.inOut', yoyo: true, repeat: -1 })
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="paper" style={themeVars('paper')}>
      <div className="s14-photo-wrap">
        <Photo asset={assetOf(deck, 'img-arrival')} alt="Schoolgirls in uniform walking to school in the morning" className="s14-photo" />
        <div className="s14-photo-fade" />
      </div>
      <div className="s14-col">
        <div className="cp-kicker s14-kick">{slide.section}</div>
        <h2 className="cp-display s14-h">{textOf(slide, 'headline')}</h2>
        <span className="s14-tag">{textOf(slide, 'tag')}</span>

        <ol className="s14-qs">
          {questions.map((qt, i) => {
            const isOpen = open === i
            return (
              <li key={qt} className="s14-q" data-open={isOpen}>
                <div className="s14-q-row">
                  <span className="s14-q-n">{`0${i + 1}`}</span>
                  <span className="s14-q-t">{qt}</span>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      className="s14-a"
                      initial={reduced ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduced ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="s14-a-in">
                        <span className="s14-a-name">{answers[i]}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* Every answer stays in the page for readers who do not step through, and for the text check. */}
                {!isOpen && <span className="cp-sr">{answers[i]}</span>}
              </li>
            )
          })}
        </ol>
        <p className="s14-note">{textOf(slide, 'note')}</p>
      </div>
    </div>
  )
}
