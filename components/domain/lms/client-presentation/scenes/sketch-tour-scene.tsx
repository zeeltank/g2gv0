'use client'

import { useRef } from 'react'

import { productOf, type AtlasProduct, type AtlasSlide } from '@/lib/client-presentation/atlas'
import { STOP_FPS, jitter, jitterTrack, tornPolygon } from '@/lib/client-presentation/sketch-motion'
import { TOUR_TAB_LABELS, firstBeatOfTab, stepsOfTab, tourSteps, tourTabs, type AtlasTour, type TourArtImage, type TourTab } from '@/lib/client-presentation/tour'

import { gsap } from '../motion/gsap'
import { useBeatTimeline } from '../motion/use-beat-timeline'

import { Rail, pad2, stopKeys } from './atlas-shared'
import './sketch-tour.css'
import type { SceneProps } from './types'

/**
 * The illustrated ("sketchbook") product tour: the same seven tabs, steps, keys and deep links as the Core tour (lib/client-presentation/tour.ts), played
 * in a different visual language. Paper, tape, torn scraps, a marker, photographs and cut-outs; the motion runs on twos (stepped eases at 12 fps), wipes
 * like paper being pulled, a marker that strokes words, and scraps that jitter by hand and then snap into order. The whole slide is ONE paused GSAP
 * timeline and every wobble comes from a seeded function of the frame (lib/client-presentation/sketch-motion.ts), so a state is a time on the
 * timeline and Next, Back, a tab click, ?beat= and the video renderer all show the same picture. The words are the checked tour text; the pictures
 * come from the tour's `art` slots (assets/tour-art.json). The test hooks (.sk-tab, .sk-panel, .sk-group, .sk-role, ...) mirror the Core scene's.
 */
type P = SceneProps & { plan: AtlasSlide }

const STEP = 'steps(6)'   // a stroke or a wipe is drawn in about six pictures
const SLOW = 'steps(9)'
const FAST = 'steps(4)'

// The Problem tab: a photograph of the mess, three torn scraps jittering on it, one tidy record sheet they snap into.
const PHOTO = { x: 980, y: 290, w: 800, h: 520, r: -1.2 }
const SCRAPS = [{ x: 1040, y: 350, r: -6 }, { x: 1400, y: 450, r: 4 }, { x: 1090, y: 660, r: -3 }]
const TIDY = [{ x: 1160, y: 560 }, { x: 1160, y: 640 }, { x: 1160, y: 720 }]
const RECORD = { x: 1160, y: 470 }
// The Intelligence tab: the school's records in the middle, up to four modules that ask questions of them.
const MAP_HUB = { x: 1360, y: 545 }
const MAP_NODES = [{ x: 1150, y: 345 }, { x: 1570, y: 345 }, { x: 1150, y: 760 }, { x: 1570, y: 760 }]

/** The last few words of a line, so the marker can stroke them. */
const tail = (line: string, n = 3): [string, string] => {
  const w = line.split(' ')
  return n >= w.length ? ['', line] : [w.slice(0, -n).join(' ') + ' ', w.slice(-n).join(' ')]
}

function buildTour(tl: gsap.core.Timeline, q: gsap.utils.SelectorFunc, tour: AtlasTour, modules: number): void {
  const steps = tourSteps(tour)
  const panel = (tab: TourTab) => q(`.sk-panel[data-tab="${tab}"]`)
  const tabIn = (tab: TourTab) => q(`.sk-tab[data-tab="${tab}"] .sk-tabin`)
  const tabMk = (tab: TourTab) => q(`.sk-tab[data-tab="${tab}"] .sk-mk`)
  const rule = (tab: TourTab) => q(`.sk-tab[data-tab="${tab}"] .sk-rule em`)
  const group = (g: number) => `.sk-group[data-i="${g}"]`
  const role = (i: number) => `.sk-role[data-i="${i}"]`
  const wipe = (from = 'inset(0 100% 0 0)') => ({ autoAlpha: 0, clipPath: from })
  const wiped = { autoAlpha: 1, clipPath: 'inset(0 0% 0 0)' }
  const pop = { autoAlpha: 0, scale: 0.8 }
  const popped = { autoAlpha: 1, scale: 1 }

  /* the bar: the tab being shown is lit, a marker is stroked behind its name, and its rule fills as its steps are shown */
  const emphasise = (tab: TourTab, at: number, from?: TourTab) => {
    if (from) {
      tl.to(tabIn(from), { opacity: 0.65, duration: 0.3, ease: FAST }, at)
      tl.to(tabMk(from), { scaleX: 0, duration: 0.3, ease: FAST }, at)
    }
    tl.to(tabIn(tab), { opacity: 1, duration: 0.3, ease: FAST }, at)
    tl.to(tabMk(tab), { scaleX: 1, duration: 0.5, ease: STEP }, at)
    tl.to(rule(tab), { scaleX: 1 / stepsOfTab(tour, tab), duration: 0.6, ease: STEP }, at)
  }
  const progress = (tab: TourTab, step: number, at: number) => tl.to(rule(tab), { scaleX: (step + 1) / stepsOfTab(tour, tab), duration: 0.6, ease: STEP }, at)
  const mark = (sel: string, at: number, dur = 0.5) => tl.fromTo(q(sel), { backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%', duration: dur, ease: STEP, stagger: 0.12 }, at)

  /* features: one group of modules per beat, taped to the page one after another */
  const groupIn = (g: number, at: number) => {
    tl.set(q(group(g)), { autoAlpha: 1 }, at)
    tl.fromTo(q(`${group(g)} .sk-gtitle`), wipe(), { ...wiped, duration: 0.8, ease: SLOW }, at)
    tl.fromTo(q(`${group(g)} .sk-col`), { autoAlpha: 0, y: 50, rotation: -2 }, { autoAlpha: 1, y: 0, rotation: 0, duration: 0.5, stagger: 0.2, ease: FAST }, at + 0.3)
    tl.to(q(`.sk-gchip[data-i="${g}"] .sk-gin`), { opacity: 1, backgroundColor: '#ffd84d', duration: 0.3, ease: FAST }, at)
    return at + 1.5 + (tour.features.groups[g]?.subs.length ?? 4) * 0.12
  }
  const groupOut = (g: number, at: number) => {
    tl.to(q(`${group(g)} .sk-col`), { autoAlpha: 0, y: -30, duration: 0.35, stagger: 0.04, ease: FAST }, at)
    tl.to(q(`${group(g)} .sk-gtitle`), { autoAlpha: 0, duration: 0.25 }, at)
    tl.to(q(`.sk-gchip[data-i="${g}"] .sk-gin`), { opacity: 0.65, backgroundColor: 'rgba(255,216,77,0)', duration: 0.3, ease: FAST }, at)
    tl.set(q(group(g)), { autoAlpha: 0 }, at + 0.5)
    return at + 0.5
  }

  /* roles: one role per beat */
  const roleIn = (i: number, at: number) => {
    tl.set(q(role(i)), { autoAlpha: 1 }, at)
    tl.fromTo(q(`${role(i)} .sk-who`), wipe(), { ...wiped, duration: 0.4, ease: STEP }, at)
    tl.fromTo(q(`${role(i)} .sk-rname`), wipe(), { ...wiped, duration: 0.8, ease: SLOW }, at + 0.1)
    tl.fromTo(q(`${role(i)} .sk-ben li`), { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.45, stagger: 0.25, ease: FAST }, at + 0.6)
    tl.fromTo(q(`${role(i)} .sk-use`), wipe(), { ...wiped, duration: 0.7, ease: STEP }, at + 1.5)
    tl.fromTo(q(`${role(i)} .sk-mods-h`), wipe(), { ...wiped, duration: 0.4, ease: STEP }, at + 1.7)
    tl.fromTo(q(`${role(i)} .sk-mods span`), pop, { ...popped, duration: 0.3, stagger: 0.1, ease: FAST }, at + 1.8)
    tl.fromTo(q(`${role(i)} .sk-cut`), { autoAlpha: 0, x: 60 }, { autoAlpha: 1, x: 0, duration: 0.5, ease: FAST }, at + 0.4)
    tl.to(q(`.sk-rolebtn[data-i="${i}"] .sk-rbin`), { opacity: 1, duration: 0.3, ease: FAST }, at)
    return at + 2.4
  }
  const roleOut = (i: number, at: number) => {
    tl.to(q(role(i)), { autoAlpha: 0, duration: 0.4, ease: FAST }, at)
    tl.to(q(`.sk-rolebtn[data-i="${i}"] .sk-rbin`), { opacity: 0.65, duration: 0.3, ease: FAST }, at)
    return at + 0.45
  }

  const enter: Record<TourTab, (at: number) => number> = {
    summary: (a) => {
      tl.set(panel('summary'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.sk-s1'), wipe(), { ...wiped, duration: 1, ease: SLOW }, a)
      tl.fromTo(q('.sk-s2'), wipe(), { ...wiped, duration: 0.8, ease: STEP }, a + 0.9)
      tl.fromTo(q('.sk-s3'), wipe(), { ...wiped, duration: 0.8, ease: STEP }, a + 1.5)
      mark('.sk-sum-mark', a + 2.3)
      tl.fromTo(q('.sk-sum-photo'), wipe('inset(0 100% 0 0)'), { ...wiped, duration: 0.9, ease: 'steps(8)' }, a + 0.2)
      tl.fromTo(q('.sk-sum-tape'), pop, { ...popped, duration: 0.3, stagger: 0.1, ease: FAST }, a + 1.0)
      tl.fromTo(q('.sk-sum-cut'), { autoAlpha: 0, x: 70 }, { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.2, ease: FAST }, a + 1.2)
      tl.fromTo(q('.sk-count'), pop, { ...popped, duration: 0.4, ease: FAST }, a + 0.6)
      const n = { v: 0 }
      const counter = q('.sk-count-n')[0] as HTMLElement | undefined
      tl.to(n, { v: modules, duration: 1.2, ease: 'steps(12)', onUpdate: () => { if (counter) counter.textContent = String(Math.round(n.v)) } }, a + 0.7)
      tl.fromTo(q('.sk-grow'), { autoAlpha: 0, x: 30 }, { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.2, ease: FAST }, a + 1.4)
      // the cut-outs drift at different depths for as long as the tab is up
      tl.to(q('.sk-sum-cut'), { x: -28, duration: 3.4, ease: 'none', stagger: 0.4 }, a + 1.6)
      return a + 3.6
    },
    problem: (a) => {
      tl.set(panel('problem'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.sk-illus'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: FAST }, a)
      tl.fromTo(q('.sk-photo'), wipe(), { ...wiped, duration: 0.9, ease: 'steps(8)' }, a + 0.1)
      tl.fromTo(q('.sk-ptape'), pop, { ...popped, duration: 0.3, stagger: 0.1, ease: FAST }, a + 0.9)
      const lines = tour.problem.beats.length
      tour.problem.beats.forEach((_, i) => {
        const at = a + 0.4 + i * 0.7
        tl.fromTo(q(`.sk-pl[data-i="${i}"]`), wipe(), { ...wiped, duration: 0.6, ease: STEP }, at)
        mark(`.sk-pl[data-i="${i}"] .sk-mark`, at + 0.5, 0.4)
      })
      // the mess: scraps land on the photo and then jitter by hand (the seed is the scrap, the frame is the time) until the turn
      const land = a + 0.6
      SCRAPS.forEach((s, i) => tl.fromTo(q(`.sk-reg[data-i="${i}"]`), { autoAlpha: 0, y: -60, rotation: s.r - 10 }, { autoAlpha: 1, y: 0, rotation: s.r, duration: 0.4, ease: FAST }, land + i * 0.25))
      const turn = a + 0.4 + lines * 0.7 + 0.9
      const jitterFrom = land + 0.7
      SCRAPS.forEach((s, i) => {
        jitterTrack(i + 3, Math.max(0, turn - jitterFrom), 1).forEach((f) => tl.set(q(`.sk-reg[data-i="${i}"]`), { x: f.x, y: f.y, rotation: s.r + f.r }, jitterFrom + f.at))
      })
      // the cut-out leans in and drifts for the length of the tab
      tl.fromTo(q('.sk-cut-p'), { autoAlpha: 0, x: 80 }, { autoAlpha: 1, x: 0, duration: 0.5, ease: FAST }, a + 1.0)
      tl.to(q('.sk-cut-p'), { x: -26, duration: turn - a, ease: 'none' }, a + 1.5)
      // the turn: the scraps snap into one tidy column on the record sheet
      tl.fromTo(q('.sk-record'), pop, { ...popped, duration: 0.4, ease: FAST }, turn - 0.2)
      SCRAPS.forEach((s, i) => tl.to(q(`.sk-reg[data-i="${i}"]`), { x: TIDY[i].x - s.x, y: TIDY[i].y - s.y, rotation: 0, scale: 0.78, duration: 0.9, ease: SLOW }, turn))
      tl.to(q('.sk-reg'), { autoAlpha: 0, duration: 0.3, ease: FAST }, turn + 1.0)
      tl.fromTo(q('.sk-record > *'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.15, ease: FAST }, turn + 1.0)
      tl.fromTo(q('.sk-turn'), wipe(), { ...wiped, duration: 0.8, ease: STEP }, turn + 0.4)
      mark('.sk-turn .sk-mark', turn + 1.1, 0.5)
      return turn + 2.0
    },
    intelligence: (a) => {
      tl.set(panel('intelligence'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.sk-panel[data-tab="intelligence"] .sk-lead'), wipe(), { ...wiped, duration: 0.9, ease: STEP }, a)
      tl.fromTo(q('.sk-hub'), pop, { ...popped, duration: 0.4, ease: FAST }, a + 0.3)
      const mods = tour.intelligence.modules
      mods.forEach((_, i) => {
        const at = a + 0.8 + i * 0.6
        tl.fromTo(q(`.sk-irow[data-i="${i}"]`), { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: FAST }, at)
        tl.fromTo(q(`.sk-ilink[data-i="${i}"]`), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.5, ease: STEP }, at)
        tl.fromTo(q(`.sk-inode[data-i="${i}"]`), pop, { ...popped, duration: 0.35, ease: FAST }, at + 0.3)
        tl.fromTo(q(`.sk-irow[data-i="${i}"] .sk-mark`), { backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%', duration: 0.5, ease: STEP }, at + 0.3)
      })
      const end = a + 0.8 + mods.length * 0.6 + 0.4
      tl.fromTo(q('.sk-close'), wipe(), { ...wiped, duration: 0.8, ease: STEP }, end)
      return end + 0.9
    },
    ai: (a) => {
      tl.set(panel('ai'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.sk-panel[data-tab="ai"] .sk-lead'), wipe(), { ...wiped, duration: 0.9, ease: STEP }, a)
      tl.fromTo(q('.sk-arow'), { autoAlpha: 0, rotation: -2, x: -40 }, { autoAlpha: 1, rotation: 0, x: 0, duration: 0.45, stagger: 0.3, ease: FAST }, a + 0.5)
      tl.fromTo(q('.sk-sheet'), { autoAlpha: 0, y: 50, rotation: 2 }, { autoAlpha: 1, y: 0, rotation: 0, duration: 0.6, ease: FAST }, a + 0.4)
      // the draft is written onto the sheet on twos; nothing is applied until the person approves
      const text = tour.ai.sample.text
      const typed = q('.sk-typed')[0] as HTMLElement | undefined
      const t = { n: 0 }
      tl.to(t, { n: text.length, duration: 2.8, ease: 'none', onUpdate: () => { if (typed) typed.textContent = text.slice(0, Math.round(t.n)) } }, a + 1.4)
      const done = a + 4.3
      if (q('.sk-btn.apply').length) {   // the button press and the stamp exist only where the product has an approve step
        tl.to(q('.sk-btn.apply'), { scale: 1.12, duration: 0.2, ease: FAST }, done)
        tl.to(q('.sk-btn.apply'), { scale: 1, duration: 0.2, ease: FAST }, done + 0.2)
        tl.fromTo(q('.sk-stamp'), { autoAlpha: 0, scale: 1.8 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: FAST }, done + 0.45)
      }
      tl.fromTo(q('.sk-guard'), wipe(), { ...wiped, duration: 0.8, ease: STEP }, done + 0.7)
      mark('.sk-guard .sk-mark', done + 1.2, 0.5)
      tl.fromTo(q('.sk-control'), wipe(), { ...wiped, duration: 0.7, ease: STEP }, done + 1.5)
      return done + 2.5
    },
    research: (a) => {
      tl.set(panel('research'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.sk-panel[data-tab="research"] .sk-lead'), wipe(), { ...wiped, duration: 0.7, ease: STEP }, a)
      tl.fromTo(q('.sk-banner'), wipe(), { ...wiped, duration: 0.9, ease: 'steps(8)' }, a + 0.2)
      tl.fromTo(q('.sk-ritem'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.3, ease: FAST }, a + 0.6)
      return a + 1.5 + tour.research.items.length * 0.3
    },
    features: (a) => {
      tl.set(panel('features'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.sk-gchip'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.1, ease: FAST }, a)
      return groupIn(0, a + 0.2)
    },
    roles: (a) => {
      tl.set(panel('roles'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.sk-rolebtn'), { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.1, ease: FAST }, a)
      return roleIn(0, a + 0.2)
    },
  }
  const leave = (tab: TourTab, at: number): number => {
    tl.to(panel(tab), { autoAlpha: 0, duration: 0.4, ease: FAST }, at)
    return at + 0.4
  }
  const within = (tab: TourTab, step: number, at: number): number => {
    progress(tab, step, at)
    if (tab === 'features') return groupIn(step, groupOut(step - 1, at) + 0.05)
    if (tab === 'roles') return roleIn(step, roleOut(step - 1, at) + 0.05)
    return at
  }

  // the entrance: the page, the titles, the index tabs, then the first tab
  tl.fromTo(q('.sk-grain'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 0)
  tl.fromTo(q('.at-kicker, .at-top'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08, ease: FAST }, 0.1)
  tl.fromTo(q('.sk-tab'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.07, ease: FAST }, 0.3)
  emphasise(steps[0].tab, 0.9)
  let t = enter[steps[0].tab](0.9)
  tl.addLabel('b0', t)
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]
    const cur = steps[i]
    if (prev.tab !== cur.tab) {
      const out = leave(prev.tab, t)
      emphasise(cur.tab, out - 0.2, prev.tab)
      t = enter[cur.tab](out - 0.1)
    } else {
      t = within(cur.tab, cur.step, t)
    }
    tl.addLabel(`b${i}`, t)
  }
  // The hand-drawn "boil": every figure and map node is redrawn on twos (12 pictures a second), a pixel or so off each time, as a stop-motion page is.
  // A pure function of the timeline time (the frame number and a seed per element), written to the individual CSS `translate` and `rotate`
  // properties so it composes with the transforms the timeline owns. Nodes only shift; figures and the stamp also turn a little.
  const figures = q('.sk-cut, .sk-stamp') as HTMLElement[]
  const marks = q('.sk-hub, .sk-inode') as HTMLElement[]
  const clock = { t: 0 }
  const total = tl.duration()
  tl.to(clock, {
    t: total, duration: total, ease: 'none',
    onUpdate: () => {
      const k = Math.floor(clock.t * STOP_FPS)
      figures.forEach((el, i) => { const j = jitter(i + 1, k, 0.55); el.style.translate = `${j.x}px ${j.y}px`; el.style.rotate = `${j.r}deg` })
      marks.forEach((el, i) => { const j = jitter(i + 41, k, 0.3); el.style.translate = `${j.x}px ${j.y}px` })
    },
  }, 0)
}

/** A cut-out stands in a corner of the stage: scaled to fit a box (max width and height), its right edge and its feet where they are asked for, so a tall figure can never run off the bottom. */
const cutBox = (im: TourArtImage, right: number, bottom: number, maxW: number, maxH: number) => {
  const k = Math.min(maxW / im.w, maxH / im.h)
  const w = Math.round(im.w * k)
  const h = Math.round(im.h * k)
  return { left: right - w, top: bottom - h, width: w }
}

/** The problem step's figure: a tall one stays in the narrow strip right of the record card; a wide one sits lower, under the photo, where there is room for it. */
const problemBox = (im: TourArtImage) => (im.w / im.h > 1.1 ? cutBox(im, 1795, 992, 300, 160) : cutBox(im, 1795, 990, 185, 380))

const Img = ({ im, className }: { im?: TourArtImage; className?: string }) => (im ? <img className={className} src={im.src} alt={im.alt} width={im.w} height={im.h} /> : null)

export function SketchTourScene({ plan, beat, beats, entry, reduced, nav }: P) {
  const ref = useRef<HTMLDivElement>(null)
  const p = productOf(plan.family ?? '') as AtlasProduct
  const tour = p.tour as AtlasTour
  const tabs = tourTabs(tour)
  const steps = tourSteps(tour)
  const beatOf = (tab: TourTab, step: number) => steps.findIndex((s) => s.tab === tab && s.step === step)
  const groups = tour.features.groups
  const mods = tour.intelligence.modules
  const art = (slot: string): TourArtImage | undefined => tour.art?.[slot]?.[0]
  const labels = tour.labels ?? { draft: 'Draft' }
  const hasButtons = !!(labels.apply && labels.discard)   // a read-only sample card (no approve step in the product) shows no buttons and no stamp

  useBeatTimeline(ref, (tl, { q }) => buildTour(tl, q, tour, p.subs.length), { beat, beats, entry, reduced, maxTween: 4.5 })

  return (
    <div ref={ref} className="cp-scene at sk" data-theme="paper" data-style="sketchbook">
      <div className="sk-grain" />
      <Rail current={p.key} nav={nav} />
      <div className="at-kicker">{p.product}</div>
      <div className="at-top">{p.k12_module} · {p.subs.length} modules</div>

      <nav className="sk-tabs" aria-label={`${p.product} tour`} style={{ gridTemplateColumns: tabs.map((t) => `${TOUR_TAB_LABELS[t].length + 8}fr`).join(' ') }}>
        {tabs.map((tab, i) => (
          <button type="button" className="sk-tab" data-tab={tab} key={tab} onKeyDown={stopKeys} onClick={() => nav.setBeat(firstBeatOfTab(tour, tab) ?? 0)}>
            <span className="sk-rule"><em /></span>
            <span className="sk-tabin"><i>{pad2(i + 1)}</i><b>{TOUR_TAB_LABELS[tab]}<span className="sk-mk" /></b></span>
          </button>
        ))}
      </nav>

      {/* 1 summary */}
      <section className="sk-panel" data-tab="summary" aria-label="Summary">
        <h2 className="sk-s1">{tour.summary.lines[0]}</h2>
        <p className="sk-s2">{tour.summary.lines[1]}</p>
        <p className="sk-s3">{tail(tour.summary.lines[2], 4)[0]}<span className="sk-mark sk-sum-mark">{tail(tour.summary.lines[2], 4)[1]}</span></p>
        <div className="sk-count"><b className="sk-count-n">0</b><span>modules</span></div>
        {art('summary.photo') && (
          <div className="sk-frame sk-sum-photo" style={{ left: 980, top: 290, width: 800, height: 520, transform: 'rotate(1.2deg)' }}><Img im={art('summary.photo')} /></div>
        )}
        <span className="sk-tape sk-sum-tape" style={{ left: 1040, top: 270, transform: 'rotate(-6deg)' }} />
        <span className="sk-tape sk-sum-tape" style={{ left: 1660, top: 780, transform: 'rotate(5deg)' }} />
        {art('summary.cut1') && <div className="sk-cut sk-sum-cut" style={cutBox(art('summary.cut1')!, 1790, 830, 260, 330)}><Img im={art('summary.cut1')} /></div>}
        <ul className="sk-groups">
          {groups.map((g) => (
            <li className="sk-grow" key={g.title}>{g.title} · {g.subs.length}</li>
          ))}
        </ul>
      </section>

      {/* 2 problem */}
      <section className="sk-panel" data-tab="problem" aria-label="Problem">
        <div className="sk-illus">{tour.problem.label}</div>
        {tour.problem.beats.map((line, i) => (
          <p className="sk-pl" data-i={i} key={i} style={{ top: 316 + i * 116 }}>
            <span className="sk-note" style={{ clipPath: tornPolygon(i + 11, { top: false, bottom: true, bite: 3 }) }}>{tail(line)[0]}<span className="sk-mark">{tail(line)[1]}</span></span>
          </p>
        ))}
        <p className="sk-turn">{tail(tour.problem.turn, 4)[0]}<span className="sk-mark">{tail(tour.problem.turn, 4)[1]}</span></p>
        {art('problem.photo') && (
          <div className="sk-frame sk-photo" style={{ left: PHOTO.x, top: PHOTO.y, width: PHOTO.w, height: PHOTO.h, transform: `rotate(${PHOTO.r}deg)` }}><Img im={art('problem.photo')} /></div>
        )}
        <span className="sk-tape sk-ptape" style={{ left: PHOTO.x + 60, top: PHOTO.y - 14, transform: 'rotate(-5deg)' }} />
        <span className="sk-tape sk-ptape" style={{ left: PHOTO.x + PHOTO.w - 180, top: PHOTO.y + PHOTO.h - 20, transform: 'rotate(4deg)' }} />
        <div className="sk-record" style={{ left: RECORD.x, top: RECORD.y }}><b>{p.product}</b><span>{tour.problem.record}</span></div>
        {tour.problem.scattered.map((name, i) => (
          <div className="sk-reg" data-i={i} key={name} style={{ left: SCRAPS[i].x, top: SCRAPS[i].y, clipPath: tornPolygon(i + 31, { top: true, bottom: true, left: true, right: true, bite: 6 }) }}>{name}</div>
        ))}
        {art('problem.cutout') && <div className="sk-cut sk-cut-p" style={problemBox(art('problem.cutout')!)}><Img im={art('problem.cutout')} /></div>}
      </section>

      {/* 3 intelligence */}
      <section className="sk-panel" data-tab="intelligence" data-tall={mods.reduce((n, m) => n + m.asks.split(' ').length, 0) > 40 ? 'true' : 'false'} aria-label="Intelligence">
        <p className="sk-lead">{tour.intelligence.lead}</p>
        <ul className="sk-irows">
          {mods.map((m, i) => (
            <li className="sk-irow" data-i={i} key={m.id}><b>{m.name}</b><span><span className="sk-mark">{m.asks}</span></span></li>
          ))}
        </ul>
        <svg className="sk-mapsvg" viewBox="0 0 1920 1080" aria-hidden="true">
          {mods.map((_, i) => <line className="sk-ilink" data-i={i} key={i} x1={MAP_HUB.x} y1={MAP_HUB.y} x2={MAP_NODES[i].x} y2={MAP_NODES[i].y} />)}
        </svg>
        <div className="sk-hub" style={{ left: MAP_HUB.x - 115, top: MAP_HUB.y - 55 }}>The school&apos;s records</div>
        {mods.map((m, i) => <div className="sk-inode" data-i={i} key={m.id} style={{ left: MAP_NODES[i].x - 130, top: MAP_NODES[i].y - 38 }}>{m.name}</div>)}
        <p className="sk-close">{tour.intelligence.close}</p>
      </section>

      {/* 4 AI capability */}
      <section className="sk-panel" data-tab="ai" aria-label="AI capability">
        <p className="sk-lead">{tour.ai.lead}</p>
        <ul className="sk-arows">
          {tour.ai.uses.map((u) => <li className="sk-arow" key={u.name}><b>{u.name}</b><span>{u.line}</span></li>)}
        </ul>
        <div className="sk-sheet">
          <div className="sk-sheet-h"><span>{labels.draft}</span><em>{tour.ai.sample.label}</em></div>
          <p className="sk-typed" />
          {hasButtons && <div className="sk-sheet-f"><span className="sk-btn apply">{labels.apply}</span><span className="sk-btn">{labels.discard}</span></div>}
          {hasButtons && <div className="sk-stamp" style={{ left: 560, top: 330 }}>{labels.apply}</div>}
        </div>
        <p className="sk-guard">{tail(tour.ai.guard, 4)[0]}<span className="sk-mark">{tail(tour.ai.guard, 4)[1]}</span></p>
        <p className="sk-control">{tour.ai.control}</p>
      </section>

      {/* 5 research (only when there is data) */}
      {tour.research.items.length > 0 && (
        <section className="sk-panel" data-tab="research" aria-label="Research">
          <p className="sk-lead" style={{ top: 252, width: 560 }}>{tour.research.lead ?? 'Designed from'}</p>
          {art('research.banner') && <div className="sk-banner" style={{ clipPath: tornPolygon(5, { top: false, bottom: true, bite: 14 }) }}><Img im={art('research.banner')} /></div>}
          <ul className="sk-research">
            {tour.research.items.map((r, i) => <li className="sk-ritem" key={i}><span>{r.text}</span><em>{r.source}</em></li>)}
          </ul>
        </section>
      )}

      {/* 6 features and modules: one group per beat */}
      <section className="sk-panel" data-tab="features" aria-label="Features and modules">
        <div className="sk-gchips" data-n={groups.length}>
          {groups.map((g, i) => (
            <button type="button" className="sk-gchip" data-i={i} key={g.title} onKeyDown={stopKeys} onClick={() => nav.setBeat(beatOf('features', i))}><span className="sk-gin"><i>{pad2(i + 1)}</i>{g.title}</span></button>
          ))}
        </div>
        {groups.map((g, gi) => (
          <div className="sk-group" data-i={gi} key={g.title}>
            <h3 className="sk-gtitle">{g.title}</h3>
            <div className="sk-cols" style={{ ['--n' as string]: g.subs.length, ['--ar' as string]: g.subs.length <= 3 ? '3 / 2' : '4 / 3' }}>
              {g.subs.map((s, si) => (
                <div className="sk-col" key={s.id} style={{ transform: `rotate(${((gi + si) % 3 - 1) * 0.8}deg)` }}>
                  {/* the Features step shows the working product's screen of each module (the owner asked for screenshots here and nowhere else) */}
                  <div className="sk-shot">{s.shot && <img src={s.shot} alt="" />}</div>
                  <b>{s.name}</b>
                  <span>{s.tagline}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* 7 role-wise benefits: one role per beat */}
      <section className="sk-panel" data-tab="roles" data-many={tour.roles.length > 3 ? 'true' : 'false'} aria-label="Role-wise benefits">
        <ul className="sk-rolelist">
          {tour.roles.map((r, i) => (
            <li key={r.role}><button type="button" className="sk-rolebtn" data-i={i} onKeyDown={stopKeys} onClick={() => nav.setBeat(beatOf('roles', i))}><span className="sk-rbin"><i>{pad2(i + 1)}</i>{r.role}</span></button></li>
          ))}
        </ul>
        {tour.roles.map((r, i) => (
          <div className="sk-role" data-i={i} key={r.role}>
            <span className="sk-who">{r.who}</span>
            <h3 className="sk-rname">{r.role}</h3>
            <ul className="sk-ben">{r.benefits.map((b) => <li key={b}>{b}</li>)}</ul>
            <div className="sk-use"><em>{`A day with ${p.product}. Illustrative.`}</em><p>{r.use}</p></div>
            <p className="sk-mods-h">Where it lives</p>
            <div className="sk-mods">{r.modules.map((m) => <span key={m.id}>{m.name}</span>)}</div>
            {(() => {
              // a cut-out stands in the right column, its feet above y 1000: up to 520 px tall, at most 380 px wide (a wide scene is limited by its width)
              const im = art(`roles.${i}`)
              if (!im) return null
              const h = Math.round(Math.min(520, 380 * (im.h / im.w)))
              const w = Math.round(h * (im.w / im.h))
              return <div className="sk-cut" style={{ left: 1780 - w, top: 1000 - h, width: w }}><Img im={im} /></div>
            })()}
          </div>
        ))}
      </section>
    </div>
  )
}
