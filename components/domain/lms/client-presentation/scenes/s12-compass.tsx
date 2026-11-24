'use client'

import { useRef } from 'react'

import { assetOf, textOf, textsOf } from '@/lib/client-presentation/deck'
import { themeVars } from '@/lib/client-presentation/palette'

import { useBeatTimeline } from '../motion/use-beat-timeline'
import { Photo, ShotFrame } from '../ui/primitives'

import './s12.css'
import type { SceneProps } from './types'

/**
 * Scholar Compass (PARTIAL): a career conversation that starts from evidence. Two circles (interests, learning evidence) and an
 * aspiration. The three possible results are shown in turn, and the last, honest one is "not enough evidence": the circles stay
 * apart and the product says so instead of guessing.
 */
export const BEATS = 3

const CX = 1130
const CY = 700
const R = 130

export default function Scene({ deck, slide, beat, beats, entry, reduced }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const rows = textsOf(slide, 'row')
  const circles = textsOf(slide, 'circle')
  const results = textsOf(slide, 'result')
  const shown = Math.min(beat, 3)

  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.s12-badge, .s12-h'), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out' }, 0)
    tl.fromTo(q('.s12-photo, .s12-tag'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1.0, stagger: 0.12, ease: 'power3.out' }, 0.3)
    tl.fromTo(q('.s12-row'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.14 }, 0.9)
    tl.fromTo(q('.s12-c'), { autoAlpha: 0, scale: 0.7, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.9, stagger: 0.14, ease: 'back.out(1.6)' }, 1.3)
    tl.fromTo(q('.s12-asp, .s12-shot'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.12 }, 1.7)
    tl.fromTo(q('.s12-limit'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 2.1)
    tl.fromTo(q('.s12-res'), { autoAlpha: 0, x: 20 }, { autoAlpha: 1, x: 0, duration: 0.8, stagger: 0.12 }, 2.0)
    tl.addLabel('b0', 2.8)
    // b1: aligned (circles overlap); b2: not aligned (circles part); b3: not enough evidence (circles stay apart, dashed).
    tl.to(q('.s12-c-0'), { x: 50, duration: 1.0, ease: 'power2.inOut' }, 'b0+=0.1')
    tl.to(q('.s12-c-1'), { x: -50, duration: 1.0, ease: 'power2.inOut' }, 'b0+=0.1')
    tl.addLabel('b1', 'b0+=1.3')
    tl.to(q('.s12-c-0'), { x: -30, duration: 1.0, ease: 'power2.inOut' }, 'b1+=0.1')
    tl.to(q('.s12-c-1'), { x: 30, duration: 1.0, ease: 'power2.inOut' }, 'b1+=0.1')
    tl.addLabel('b2', 'b1+=1.3')
    tl.to(q('.s12-c-0'), { x: -55, duration: 1.0, ease: 'power2.inOut' }, 'b2+=0.1')
    tl.to(q('.s12-c-1'), { x: 55, duration: 1.0, ease: 'power2.inOut' }, 'b2+=0.1')
    tl.addLabel('b3', 'b2+=1.3')
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene" data-theme="paper" style={themeVars('paper')}>
      <h2 className="cp-display s12-h">{textOf(slide, 'headline')}</h2>

      <Photo asset={assetOf(deck, 'img-counsel')} alt="An adult and a student talking calmly across a table" className="s12-photo" />
      <span className="s12-tag">{textOf(slide, 'tag')}</span>
      <ShotFrame asset={assetOf(deck, 'shot-alignment')} label={slide.slots.find((s) => s.id === 'shot-alignment')?.brief ?? ''} proof={textOf(slide, 'proof')} className="s12-shot" />

      <div className="s12-rows">
        {rows.map((t) => <p key={t} className="s12-row">{t}</p>)}
      </div>

      <div className="s12-diagram" style={{ left: CX - 300, top: CY - 190, width: 600, height: 380 }}>
        <div className="s12-c s12-c-0" style={{ left: 300 - R - 110, top: 190 - R, width: R * 2, height: R * 2 }}><span>{circles[0]}</span></div>
        <div className="s12-c s12-c-1" style={{ left: 300 - R + 110, top: 190 - R, width: R * 2, height: R * 2 }}><span>{circles[1]}</span></div>
        <div className="s12-asp"><i />{textOf(slide, 'aspiration')}</div>
      </div>

      <ul className="s12-results">
        {results.map((t, i) => (
          <li key={t} className="s12-res" data-on={shown === i + 1} data-honest={i === 2}>{t}</li>
        ))}
      </ul>
      <p className="s12-limit">{textOf(slide, 'limit')}</p>
    </div>
  )
}
