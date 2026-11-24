'use client'

import type { ReactNode } from 'react'

import { clipText, clipTexts, type Clip } from '@/lib/client-presentation/clips'

import { gsap } from '../motion/gsap'

/**
 * The scene of each clip: its cards (what is drawn) and its timeline steps (how they move), between 2.5 s and about 10.5 s.
 * The hook runs before and the outcome line after, in the player. Every card text comes from clips.json; nothing is typed here.
 */
export type Q = gsap.utils.SelectorFunc
export type Build = (tl: gsap.core.Timeline, q: Q) => void

const START = 2.5
const TILT = { rotationX: 24, transformPerspective: 1400, transformOrigin: '50% 100%' }
const enter = (tl: gsap.core.Timeline, target: gsap.TweenTarget, at: number, stagger = 0.18) =>
  tl.fromTo(target, { autoAlpha: 0, y: 150, ...TILT }, { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.9, stagger, ease: 'power3.out' }, at)

const svgProps = { viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const ICONS: ReactNode[] = [
  <svg key="fee" {...svgProps}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg>,
  <svg key="att" {...svgProps}><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M8 3v4M16 3v4M9 15l2 2 4-4" /></svg>,
  <svg key="mrk" {...svgProps}><path d="M5 20V10M12 20V4M19 20v-7" /></svg>,
]

/** A state that changes from "working" to "done". */
const swap = (tl: gsap.core.Timeline, q: Q, root: string, at: number) => {
  tl.to(q(`${root} .cl-from`), { autoAlpha: 0, y: -16, duration: 0.35, ease: 'power2.in' }, at)
  tl.fromTo(q(`${root} .cl-to`), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'back.out(2.2)' }, at + 0.15)
}

/* ------------------------------------------------------------------ Scholar Core */
function CoreBody({ clip }: { clip: Clip }) {
  const titles = clipTexts(clip, 'card-title')
  const details = clipTexts(clip, 'card-detail')
  const from = clipTexts(clip, 'card-from')
  const to = clipTexts(clip, 'card-to')
  return (
    <div className="cl-stack">
      {titles.map((t, i) => (
        <div key={t} className="cl-card cl-status" data-i={i}>
          <span className="cl-ico" data-k={i}>{ICONS[i]}</span>
          <div className="cl-card-text">
            <b>{t}</b>
            <span className="cl-detail">{details[i]}</span>
          </div>
          <span className="cl-state">
            <span className="cl-from">{from[i]}</span>
            <span className="cl-to">{to[i]}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
const buildCore: Build = (tl, q) => {
  tl.fromTo(q('.cl-to'), { autoAlpha: 0 }, { autoAlpha: 0, duration: 0.01 }, 0)
  enter(tl, q('.cl-status'), START)
  for (let i = 0; i < 3; i++) {
    const at = 5.0 + i * 1.9
    swap(tl, q, `.cl-status[data-i="${i}"]`, at)
    tl.fromTo(q(`.cl-status[data-i="${i}"] .cl-ico`), { scale: 1 }, { scale: 1.16, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' }, at + 0.1)
  }
}

/* ------------------------------------------------------------------ Scholar Learn */
const BANDS = ['weak', 'moderate', 'strong'] as const
function LearnBody({ clip }: { clip: Clip }) {
  const labels = clipTexts(clip, 'row-label')
  const bands = clipTexts(clip, 'row-band')
  const steps = clipTexts(clip, 'step')
  return (
    <div className="cl-learn">
      <div className="cl-card cl-diag">
        <div className="cl-card-head"><b>{clipText(clip, 'card-title')}</b></div>
        {labels.map((l, i) => (
          <div key={l} className="cl-row" data-i={i}>
            <span className="cl-row-label">{l}</span>
            <span className="cl-bar"><i className="cl-fill" data-band={BANDS[i]} /></span>
            <span className="cl-band">{bands[i]}</span>
          </div>
        ))}
      </div>
      <div className="cl-chips">
        {steps.map((s) => <span key={s} className="cl-step"><i />{s}</span>)}
      </div>
      <div className="cl-card cl-next">
        <span className="cl-next-label">{clipText(clip, 'next-label')}</span>
        <b className="cl-next-value">{clipText(clip, 'next-value')}</b>
      </div>
    </div>
  )
}
const buildLearn: Build = (tl, q) => {
  enter(tl, q('.cl-diag'), START)
  for (let i = 0; i < 3; i++) {
    tl.fromTo(q(`.cl-row[data-i="${i}"] .cl-fill`), { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.out' }, 3.5 + i * 0.85)
    tl.fromTo(q(`.cl-row[data-i="${i}"] .cl-band`), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 4.0 + i * 0.85)
  }
  tl.fromTo(q('.cl-step'), { autoAlpha: 0, x: -50 }, { autoAlpha: 1, x: 0, duration: 0.6, stagger: 0.35, ease: 'power3.out' }, 6.5)
  tl.fromTo(q('.cl-next'), { autoAlpha: 0, y: 60, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.6)' }, 8.6)
}

/* ------------------------------------------------------------------ Scholar CCB */
const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#2fa84f" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path className="cl-tick" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)
function CcbBody({ clip }: { clip: Clip }) {
  const labels = clipTexts(clip, 'row-label')
  const states = clipTexts(clip, 'row-state')
  const actions = clipTexts(clip, 'plan-action')
  const from = clipTexts(clip, 'plan-from')
  const to = clipTexts(clip, 'plan-to')
  return (
    <div className="cl-ccb">
      <div className="cl-card cl-rate">
        <div className="cl-card-head">
          <b>{clipText(clip, 'card-title')}</b>
          <span className="cl-sub">{clipText(clip, 'card-detail')}</span>
        </div>
        {labels.map((l, i) => (
          <div key={l} className="cl-row" data-i={i}>
            <span className="cl-row-label">{l}</span>
            <span className="cl-bar"><i className="cl-fill" data-lv={states[i] === 'Gap' ? 'gap' : 'met'} /><i className="cl-need" /></span>
            <span className="cl-tag" data-s={states[i] === 'Gap' ? 'gap' : 'met'}>{states[i]}</span>
          </div>
        ))}
      </div>
      <div className="cl-card cl-plan">
        <b>{clipText(clip, 'plan-title')}</b>
        {actions.map((a, i) => (
          <div key={a} className="cl-action" data-i={i}>
            <span className="cl-check">{CHECK}</span>
            <span className="cl-action-text">{a}</span>
            <span className="cl-state">
              <span className="cl-from">{from[i]}</span>
              <span className="cl-to">{to[i]}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
const buildCcb: Build = (tl, q) => {
  tl.fromTo(q('.cl-action .cl-to'), { autoAlpha: 0 }, { autoAlpha: 0, duration: 0.01 }, 0)
  tl.fromTo(q('.cl-tick'), { drawSVG: '0% 0%' }, { drawSVG: '0% 0%', duration: 0.01 }, 0)
  enter(tl, q('.cl-rate'), START)
  for (let i = 0; i < 3; i++) {
    tl.fromTo(q(`.cl-rate .cl-row[data-i="${i}"] .cl-fill`), { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.out' }, 3.4 + i * 0.6)
    tl.fromTo(q(`.cl-rate .cl-row[data-i="${i}"] .cl-tag`), { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2.2)' }, 4.0 + i * 0.6)
  }
  tl.fromTo(q('.cl-tag[data-s="gap"]'), { scale: 1 }, { scale: 1.18, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 5.4)
  tl.fromTo(q('.cl-plan'), { autoAlpha: 0, y: 90 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 6.4)
  for (let i = 0; i < 2; i++) {
    const at = 8.0 + i * 1.3
    swap(tl, q, `.cl-action[data-i="${i}"]`, at)
    tl.to(q(`.cl-action[data-i="${i}"] .cl-tick`), { drawSVG: '0% 100%', duration: 0.45, ease: 'power2.out' }, at + 0.1)
  }
}

/* ------------------------------------------------------------------ Scholar Insight */
function InsightBody({ clip }: { clip: Clip }) {
  const signals = clipTexts(clip, 'signal')
  const decisions = clipTexts(clip, 'decision')
  return (
    <div className="cl-ins">
      <div className="cl-signals">
        {signals.map((s) => <div key={s} className="cl-signal"><i />{s}</div>)}
      </div>
      <div className="cl-card cl-case">
        <p className="cl-case-title">{clipText(clip, 'case-title')}</p>
        <div className="cl-evidence">
          {signals.map((s) => <span key={s} className="cl-etag">{s}</span>)}
        </div>
        <div className="cl-decide">
          {decisions.map((d, i) => <span key={d} className="cl-btn" data-k={i === 0 ? 'approve' : 'reject'}>{d}</span>)}
        </div>
        <span className="cl-decided">{clipText(clip, 'decided')}</span>
      </div>
    </div>
  )
}
const buildInsight: Build = (tl, q) => {
  tl.fromTo(q('.cl-case'), { autoAlpha: 0 }, { autoAlpha: 0, duration: 0.01 }, 0)
  tl.fromTo(q('.cl-decided'), { autoAlpha: 0 }, { autoAlpha: 0, duration: 0.01 }, 0)
  tl.fromTo(q('.cl-signal'), { autoAlpha: 0, x: -90 }, { autoAlpha: 1, x: 0, duration: 0.7, stagger: 0.3, ease: 'power3.out' }, START)
  // The three signals converge into one case.
  tl.to(q('.cl-signal'), { y: 120, scale: 0.9, autoAlpha: 0, duration: 0.45, stagger: 0.08, ease: 'power2.in' }, 5.3)
  tl.fromTo(q('.cl-case'), { autoAlpha: 0, scale: 0.82, y: 40 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.8, ease: 'back.out(1.5)' }, 6.1)
  tl.fromTo(q('.cl-evidence .cl-etag'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.12 }, 6.7)
  tl.fromTo(q('.cl-btn'), { y: 14 }, { y: 0, duration: 0.4, stagger: 0.1 }, 7.3)
  // A person approves.
  tl.to(q('.cl-btn[data-k="approve"]'), { backgroundColor: '#1088f6', borderColor: '#1088f6', color: '#ffffff', duration: 0.3 }, 8.6)
  tl.fromTo(q('.cl-btn[data-k="approve"]'), { scale: 1 }, { scale: 1.06, duration: 0.2, yoyo: true, repeat: 1 }, 8.6)
  tl.to(q('.cl-btn[data-k="reject"]'), { opacity: 0.4, duration: 0.3 }, 8.9)
  tl.fromTo(q('.cl-decided'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 9.3)
}

/* ------------------------------------------------------------------ Scholar Compass */
function CompassBody({ clip }: { clip: Clip }) {
  const chips = clipTexts(clip, 'chip')
  const labels = clipTexts(clip, 'meter-label')
  const notes = clipTexts(clip, 'meter-note')
  return (
    <div className="cl-cmp">
      <div className="cl-chipsgrid">
        {chips.map((c) => <span key={c} className="cl-chip">{c}</span>)}
      </div>
      <div className="cl-card cl-align">
        <div className="cl-card-head"><b>{clipText(clip, 'card-title')}</b></div>
        <div className="cl-evidence">
          {chips.map((c) => <span key={c} className="cl-etag">{c}</span>)}
        </div>
        {labels.map((l, i) => (
          <div key={l} className="cl-meter" data-i={i}>
            <div className="cl-meter-top"><span className="cl-meter-label">{l}</span><span className="cl-note">{notes[i]}</span></div>
            <span className="cl-bar"><i className="cl-fill" data-k={i === 0 ? 'ok' : 'thin'} /></span>
          </div>
        ))}
        <p className="cl-honest">{clipText(clip, 'honest')}</p>
      </div>
    </div>
  )
}
const buildCompass: Build = (tl, q) => {
  tl.fromTo(q('.cl-align'), { autoAlpha: 0 }, { autoAlpha: 0, duration: 0.01 }, 0)
  tl.fromTo(q('.cl-chip'), { autoAlpha: 0, y: 50, scale: 0.92 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.32, ease: 'back.out(1.6)' }, START)
  // The profile flows into one comparison.
  tl.to(q('.cl-chip'), { y: 190, scale: 0.88, autoAlpha: 0, duration: 0.45, stagger: 0.07, ease: 'power2.in' }, 5.4)
  tl.fromTo(q('.cl-align'), { autoAlpha: 0, y: 80, ...TILT }, { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.9, ease: 'power3.out' }, 6.3)
  tl.fromTo(q('.cl-evidence .cl-etag'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.12 }, 6.8)
  tl.fromTo(q('.cl-meter[data-i="0"] .cl-fill'), { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.out' }, 7.6)
  tl.fromTo(q('.cl-meter[data-i="0"] .cl-note'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 8.1)
  tl.fromTo(q('.cl-meter[data-i="1"] .cl-fill'), { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.out' }, 8.6)
  tl.fromTo(q('.cl-meter[data-i="1"] .cl-note'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 9.1)
  tl.fromTo(q('.cl-honest'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 9.8)
}

/* ------------------------------------------------------------------ registry */
export const CLIP_BODY: Record<string, (p: { clip: Clip }) => ReactNode> = {
  core: CoreBody,
  learn: LearnBody,
  ccb: CcbBody,
  insight: InsightBody,
  compass: CompassBody,
}
export const CLIP_BUILD: Record<string, Build> = {
  core: buildCore,
  learn: buildLearn,
  ccb: buildCcb,
  insight: buildInsight,
  compass: buildCompass,
}
