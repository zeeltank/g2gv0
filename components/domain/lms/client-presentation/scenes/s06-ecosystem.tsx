'use client'

import { motion } from 'framer-motion'
import { useRef } from 'react'

import { linesOf, textOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { useBeatTimeline } from '../motion/use-beat-timeline'

import './s06.css'
import type { SceneProps } from './types'
import { PRODUCT_SCENE, splitName } from './util'

/**
 * Six products and how they relate: Core is the foundation, Learn, CCB and Compass stand on it, Insight spans above, and Scholar One
 * is the ring that connects them. Built bottom-up, one layer per beat. Tapping a product opens it.
 */
export const BEATS = 4

const BEAT_OF: Record<string, number> = { 'Scholar Core': 1, 'Scholar Learn': 2, 'Scholar CCB': 2, 'Scholar Compass': 2, 'Scholar Insight': 3 }

export default function Scene({ slide, beat, beats, entry, reduced, nav }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const products = linesOf(slide, 'product').map((l) => ({ ...splitName(l.text) }))
  const by = (n: string) => products.find((p) => p.name === n)!
  const one = by('Scholar One')

  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.s06-h'), { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 0)
    tl.addLabel('b0', 1.2)
    tl.fromTo(q('.s06-core'), { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0, duration: 1.0, ease: 'power3.out' }, 'b0+=0.1')
    tl.addLabel('b1', 'b0+=1.4')
    tl.fromTo(q('.s06-mid'), { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.14, ease: 'power3.out' }, 'b1+=0.1')
    tl.addLabel('b2', 'b1+=1.5')
    tl.fromTo(q('.s06-insight'), { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 1.0, ease: 'power3.out' }, 'b2+=0.1')
    tl.addLabel('b3', 'b2+=1.4')
    tl.fromTo(q('.s06-ring'), { autoAlpha: 0, scale: 0.96, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 1.2, ease: 'power2.out' }, 'b3+=0.1')
    tl.fromTo(q('.s06-note, .s06-onetab'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.12 }, 'b3+=0.7')
    tl.addLabel('b4', 'b3+=1.7')
  }, { beat, beats, entry, reduced })

  const tile = (name: string, cls: string) => {
    const p = by(name)
    const live = beat >= BEAT_OF[name]
    return (
      <motion.button
        key={name}
        type="button"
        className={`s06-tile ${cls}`}
        tabIndex={live ? 0 : -1}
        disabled={!live}
        whileHover={reduced ? undefined : { y: -5 }}
        whileTap={reduced ? undefined : { scale: 0.985 }}
        transition={{ duration: 0.18 }}
        onClick={() => nav.detour(PRODUCT_SCENE[name])}
      >
        <span className="s06-name cp-display">{p.name}</span>
        <span className="s06-desc">{p.desc}</span>
      </motion.button>
    )
  }

  return (
    <div ref={ref} className="cp-scene" data-theme="ink" style={themeVars('ink')}>
      <div className="s06-wash" />
      <h2 className="cp-display s06-h">{textOf(slide, 'headline')}</h2>
      <p className="s06-note">{textOf(slide, 'note')}</p>

      <div className="s06-ring" />
      <div className="s06-onetab">
        <span className="s06-onename cp-display">{one.name}</span>
        <span className="s06-desc">{one.desc}</span>
      </div>

      <div className="s06-insight-wrap">{tile('Scholar Insight', 's06-insight')}</div>
      <div className="s06-mid-row">
        <div className="s06-mid">{tile('Scholar Learn', '')}</div>
        <div className="s06-mid">{tile('Scholar CCB', '')}</div>
        <div className="s06-mid">{tile('Scholar Compass', '')}</div>
      </div>
      <div className="s06-core-wrap">{tile('Scholar Core', 's06-core')}</div>
    </div>
  )
}
