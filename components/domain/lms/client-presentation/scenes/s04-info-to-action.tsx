'use client'

import { motion } from 'framer-motion'
import { useRef } from 'react'

import { textOf, textsOf } from '@/lib/client-presentation/deck'
import { CHOOSER_TARGETS } from '@/lib/client-presentation/navigation'
import { themeVars } from '@/lib/client-presentation/palette'

import { useBeatTimeline } from '../motion/use-beat-timeline'

import './s04.css'
import type { SceneProps } from './types'

/**
 * Six steps from information to a reviewed result, walked one at a time. The last beat is the room's choice: the presenter asks which
 * situation matters most and one click opens it (and Return comes back here). Nothing is scored.
 */
export const BEATS = 8

const X0 = 230
const DX = 292
const LINE_Y = 520
const nodeX = (i: number) => X0 + i * DX

export default function Scene({ slide, beat, beats, entry, reduced, nav }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const steps = textsOf(slide, 'step')
  const chips = textsOf(slide, 'chip')
  const ask = textOf(slide, 'ask')
  const chooser = textOf(slide, 'chooser')

  useBeatTimeline(ref, (tl, { q }) => {
    // b0: the headline and the first step. Each beat after that adds one segment of the line and one step.
    tl.fromTo(q('.s04-h'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' }, 0)
    tl.fromTo(q('.s04-base'), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 1.1, ease: 'power2.inOut' }, 0.2)
    tl.fromTo(q('.s04-node-0'), { autoAlpha: 0, scale: 0.3, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2.4)' }, 0.7)
    tl.fromTo(q('.s04-lab-0'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.9)
    tl.addLabel('b0', 1.8)
    for (let i = 1; i < 6; i++) {
      const at = `b${i - 1}`
      tl.fromTo(q(`.s04-seg-${i}`), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.9, ease: 'power2.inOut' }, `${at}+=0.05`)
      tl.fromTo(q(`.s04-node-${i}`), { autoAlpha: 0, scale: 0.3, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(2.4)' }, `${at}+=0.8`)
      tl.fromTo(q(`.s04-lab-${i}`), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6 }, `${at}+=0.9`)
      tl.to(q(`.s04-node-${i - 1}`), { fill: '#7fb6ff', duration: 0.4 }, `${at}+=0.8`)
      tl.addLabel(`b${i}`, `${at}+=1.6`)
    }
    // b6: the review feeds back into the information, drawn as a dashed return.
    tl.fromTo(q('.s04-return'), { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 100%', duration: 1.4, ease: 'power2.inOut' }, 'b5+=0.1')
    tl.addLabel('b6', 'b5+=1.6')
    // b7: the question for the room.
    tl.fromTo(q('.s04-ask'), { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' }, 'b6+=0.1')
    tl.addLabel('b7', 'b6+=1.3')
    // b8: the line steps back and the room chooses.
    tl.to(q('.s04-ask'), { autoAlpha: 0, y: -24, duration: 0.6 }, 'b7')
    tl.to(q('.s04-lab'), { autoAlpha: 0, duration: 0.5 }, 'b7')
    tl.to(q('.s04-line'), { scale: 0.46, x: 1000, y: -120, transformOrigin: '0% 0%', duration: 1.1, ease: 'power3.inOut' }, 'b7')
    tl.fromTo(q('.s04-chooser'), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 'b7+=0.7')
    tl.fromTo(q('.s04-chip-item'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out' }, 'b7+=0.9')
    tl.addLabel('b8', 'b7+=2.0')
  }, { beat, beats, entry, reduced })

  const segPath = (i: number) => `M${nodeX(i - 1)} ${LINE_Y} L${nodeX(i)} ${LINE_Y}`
  const ret = `M${nodeX(5)} ${LINE_Y + 22} C${nodeX(5)} ${LINE_Y + 190}, ${nodeX(0)} ${LINE_Y + 190}, ${nodeX(0)} ${LINE_Y + 22}`
  const choosing = beat >= 8

  return (
    <div ref={ref} className="cp-scene" data-theme="ink" style={themeVars('ink')}>
      <div className="s04-glow" />
      <h2 className="cp-display cp-h2 s04-h">{textOf(slide, 'headline')}</h2>

      <div className="s04-line">
        <svg viewBox="0 0 1920 1080" className="s04-svg" aria-hidden="true">
          <defs>
            <linearGradient id="s04g" x1="0" x2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#1088f6" />
            </linearGradient>
          </defs>
          <path className="s04-base" d={`M${nodeX(0)} ${LINE_Y} L${nodeX(5)} ${LINE_Y}`} stroke="rgba(255,255,255,0.12)" strokeWidth="2" fill="none" />
          {steps.slice(1).map((_, k) => (
            <path key={k} className={`s04-seg-${k + 1}`} d={segPath(k + 1)} stroke="url(#s04g)" strokeWidth="5" fill="none" strokeLinecap="round" />
          ))}
          <path className="s04-return" d={ret} stroke="#7fb6ff" strokeWidth="2.5" strokeDasharray="3 11" strokeLinecap="round" fill="none" />
          {steps.map((_, i) => (
            <circle key={i} className={`s04-node-${i}`} cx={nodeX(i)} cy={LINE_Y} r="15" fill={i === steps.length - 1 ? '#1088f6' : '#ffffff'} />
          ))}
        </svg>
        {steps.map((t, i) => (
          <div key={t} className={`s04-lab s04-lab-${i}`} style={{ left: nodeX(i) - 150, top: LINE_Y + 40 }}>
            <span className="s04-num">{`0${i + 1}`}</span>
            {t}
          </div>
        ))}
      </div>

      <p className="cp-display s04-ask">{ask}</p>

      <div className="s04-chooser" aria-hidden={!choosing}>
        <p className="cp-display s04-chooser-q">{chooser}</p>
        <ul className="s04-chips">
          {chips.map((label, i) => (
            <li key={label} className="s04-chip-item">
              <motion.button
                type="button"
                className="s04-chip"
                tabIndex={choosing ? 0 : -1}
                disabled={!choosing}
                whileHover={reduced ? undefined : { y: -4 }}
                whileTap={reduced ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.18 }}
                onClick={() => nav.detour(CHOOSER_TARGETS[i])}
              >
                <span className="s04-chip-n">{`0${i + 1}`}</span>
                {label}
              </motion.button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
