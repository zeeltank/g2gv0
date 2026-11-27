'use client'

import { useRef } from 'react'

import { productOf, type AtlasProduct, type AtlasSlide } from '@/lib/client-presentation/atlas'
import { themeVars } from '@/lib/client-presentation/palette'
import { TOUR_TAB_LABELS, firstBeatOfTab, stepsOfTab, tourSteps, tourTabs, type AtlasTour, type TourTab } from '@/lib/client-presentation/tour'

import { gsap } from '../motion/gsap'
import { useBeatTimeline } from '../motion/use-beat-timeline'

import { Rail, Words, pad2, stopKeys } from './atlas-shared'
import './tour.css'
import type { SceneProps } from './types'

/**
 * The product tour: ONE slide per product with seven tabs (lib/client-presentation/tour.ts). Every tab is a panel of the same slide; the whole
 * slide is one paused GSAP timeline whose beats are the tab steps, so Next, Back, a click on a tab, Shift + a digit, ?beat= links and the
 * video renderer all land on exactly the same picture. Nothing here keeps its own state: a state is a time on the timeline.
 * Fixed 1920 x 1080 stage, equal columns, one baseline, labels in the same place in every cell, nothing clickable below y 1000.
 */
type P = SceneProps & { plan: AtlasSlide }

// The three scattered registers of the Problem tab and the one record they merge into (px on the stage). Used by the markup and by the motion.
const REG = [{ x: 1140, y: 350, r: -7 }, { x: 1420, y: 440, r: 5 }, { x: 1200, y: 780, r: -3 }]
const REG_W = 330
const REG_H = 92
const REC = { x: 1275, y: 540, w: 430, h: 240 }
// The hexagon of the Intelligence tab: the school's records in the middle, one node per module that asks questions of them.
const RING = { x: 1400, y: 600, r: 235 }
const ringAt = (i: number, n: number) => {
  const a = ((-90 + (360 / n) * i) * Math.PI) / 180
  return { x: RING.x + RING.r * Math.cos(a), y: RING.y + RING.r * Math.sin(a) }
}

const EASE = 'power3.out'
const mask = { yPercent: 115 }
const fadeUp = (y = 24) => ({ autoAlpha: 0, y, filter: 'blur(8px)' })
const shown = { autoAlpha: 1, y: 0, filter: 'blur(0px)' }

function buildTour(tl: gsap.core.Timeline, q: gsap.utils.SelectorFunc, tour: AtlasTour, modules: number): void {
  const steps = tourSteps(tour)
  const panel = (tab: TourTab) => q(`.tr-panel[data-tab="${tab}"]`)
  const tabIn = (tab: TourTab) => q(`.tr-tab[data-tab="${tab}"] .tr-tabin`)
  const rule = (tab: TourTab) => q(`.tr-tab[data-tab="${tab}"] .tr-rule em`)
  const group = (g: number) => `.tr-group[data-i="${g}"]`
  const role = (i: number) => `.tr-role[data-i="${i}"]`

  /* the bar: the tab being shown is lit and its rule fills as its steps are shown */
  const emphasise = (tab: TourTab, at: number, from?: TourTab) => {
    if (from) tl.to(tabIn(from), { opacity: 0.45, duration: 0.4 }, at)
    tl.to(tabIn(tab), { opacity: 1, duration: 0.4 }, at)
    tl.to(rule(tab), { scaleX: 1 / stepsOfTab(tour, tab), duration: 0.6, ease: 'power2.out' }, at)
  }
  const progress = (tab: TourTab, step: number, at: number) => tl.to(rule(tab), { scaleX: (step + 1) / stepsOfTab(tour, tab), duration: 0.6, ease: 'power2.out' }, at)

  /* features: one group of modules per beat */
  const groupIn = (g: number, at: number) => {
    tl.set(q(group(g)), { autoAlpha: 1 }, at)
    tl.fromTo(q(`${group(g)} .at-w`), mask, { yPercent: 0, duration: 0.9, stagger: 0.1, ease: 'power4.out' }, at)
    tl.fromTo(q(`${group(g)} .tr-col`), { autoAlpha: 0, y: 70, rotateX: -22, transformPerspective: 1400 }, { autoAlpha: 1, y: 0, rotateX: 0, duration: 0.9, stagger: 0.13, ease: EASE }, at + 0.15)
    tl.fromTo(q(`${group(g)} .tr-shot img`), { scale: 1.3 }, { scale: 1, duration: 1.7, stagger: 0.13, ease: 'power2.out' }, at + 0.15)
    tl.to(q(`.tr-gchip[data-i="${g}"] .tr-gin`), { opacity: 1, duration: 0.4 }, at)
    return at + 1.9
  }
  const groupOut = (g: number, at: number) => {
    tl.to(q(`${group(g)} .tr-col`), { autoAlpha: 0, y: -40, duration: 0.45, stagger: 0.05, ease: 'power2.in' }, at)
    tl.to(q(`${group(g)} .tr-gtitle`), { autoAlpha: 0, duration: 0.3 }, at)
    tl.to(q(`.tr-gchip[data-i="${g}"] .tr-gin`), { opacity: 0.4, duration: 0.4 }, at)
    tl.set(q(group(g)), { autoAlpha: 0 }, at + 0.6)
    return at + 0.55
  }

  /* roles: one role per beat */
  const roleIn = (i: number, at: number) => {
    tl.set(q(role(i)), { autoAlpha: 1 }, at)
    tl.fromTo(q(`${role(i)} .tr-who`), fadeUp(14), { ...shown, duration: 0.6, ease: EASE }, at)
    tl.fromTo(q(`${role(i)} .at-w`), mask, { yPercent: 0, duration: 0.9, stagger: 0.1, ease: 'power4.out' }, at + 0.1)
    tl.fromTo(q(`${role(i)} .tr-ben li`), { autoAlpha: 0, x: -40 }, { autoAlpha: 1, x: 0, duration: 0.7, stagger: 0.2, ease: EASE }, at + 0.5)
    tl.fromTo(q(`${role(i)} .tr-use`), fadeUp(22), { ...shown, duration: 0.8, ease: EASE }, at + 1.3)
    tl.fromTo(q(`${role(i)} .tr-mods span`), { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.4, stagger: 0.08, ease: 'back.out(2)' }, at + 1.6)
    tl.to(q(`.tr-rolebtn[data-i="${i}"] .tr-rbin`), { opacity: 1, duration: 0.4 }, at)
    return at + 2.1
  }
  const roleOut = (i: number, at: number) => {
    tl.to(q(role(i)), { autoAlpha: 0, y: -22, duration: 0.45, ease: 'power2.in' }, at)
    tl.to(q(`.tr-rolebtn[data-i="${i}"] .tr-rbin`), { opacity: 0.45, duration: 0.4 }, at)
    return at + 0.5
  }

  const enter: Record<TourTab, (at: number) => number> = {
    summary: (a) => {
      tl.set(panel('summary'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.tr-s1 .at-w'), mask, { yPercent: 0, duration: 1, stagger: 0.1, ease: 'power4.out' }, a)
      tl.fromTo(q('.tr-s2'), fadeUp(), { ...shown, duration: 0.8, ease: EASE }, a + 0.9)
      tl.fromTo(q('.tr-s3'), fadeUp(), { ...shown, duration: 0.8, ease: EASE }, a + 1.4)
      tl.fromTo(q('.tr-count'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: EASE }, a + 0.4)
      const n = { v: 0 }
      const counter = q('.tr-count-n')[0] as HTMLElement | undefined
      tl.to(n, { v: modules, duration: 1.5, ease: 'power2.out', onUpdate: () => { if (counter) counter.textContent = String(Math.round(n.v)) } }, a + 0.5)
      tl.fromTo(q('.tr-grow'), { autoAlpha: 0, x: 44 }, { autoAlpha: 1, x: 0, duration: 0.7, stagger: 0.16, ease: EASE }, a + 1.0)
      tl.fromTo(q('.tr-gdots i'), { opacity: 0.12, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.35, stagger: 0.04, ease: 'back.out(2)' }, a + 1.3)
      return a + 3.0
    },
    problem: (a) => {
      tl.set(panel('problem'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.tr-illus'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: EASE }, a)
      const lines = tour.problem.beats.length
      tour.problem.beats.forEach((_, i) => tl.fromTo(q(`.tr-pl[data-i="${i}"] .tr-pl-in`), { yPercent: 108 }, { yPercent: 0, duration: 0.85, ease: 'power3.out' }, a + 0.3 + i * 0.6))
      // the mess: three registers drift in, then they collapse into one record at the turn
      tl.fromTo(q('.tr-reg'), { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.6, stagger: 0.25, ease: 'back.out(1.6)' }, a + 0.5)
      const turn = a + 0.3 + lines * 0.6 + 0.4
      REG.forEach((r, i) => {
        tl.to(q(`.tr-reg[data-i="${i}"]`), { x: REC.x + REC.w / 2 - (r.x + REG_W / 2), y: REC.y + REC.h / 2 - (r.y + REG_H / 2), rotation: 0, scale: 0.7, autoAlpha: 0, duration: 0.9, ease: 'power3.inOut' }, turn)
      })
      tl.fromTo(q('.tr-record'), { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.8, ease: 'back.out(1.5)' }, turn + 0.5)
      tl.fromTo(q('.tr-turn'), fadeUp(30), { ...shown, duration: 0.9, ease: EASE }, turn + 0.35)
      return turn + 1.7
    },
    intelligence: (a) => {
      tl.set(panel('intelligence'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.tr-panel[data-tab="intelligence"] .tr-lead'), fadeUp(), { ...shown, duration: 0.8, ease: EASE }, a)
      tl.fromTo(q('.tr-hubc'), { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'back.out(1.6)' }, a + 0.2)
      const mods = tour.intelligence.modules
      mods.forEach((_, i) => {
        const at = a + 0.7 + i * 0.55
        tl.fromTo(q(`.tr-irow[data-i="${i}"]`), { autoAlpha: 0, x: -36 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: EASE }, at)
        tl.fromTo(q(`.tr-ilink[data-i="${i}"]`), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.6, ease: 'power2.inOut' }, at)
        tl.fromTo(q(`.tr-inode[data-i="${i}"]`), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, at + 0.25)
      })
      const end = a + 0.7 + mods.length * 0.55 + 0.4
      tl.fromTo(q('.tr-close'), fadeUp(), { ...shown, duration: 0.8, ease: EASE }, end)
      return end + 0.9
    },
    ai: (a) => {
      tl.set(panel('ai'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.tr-panel[data-tab="ai"] .tr-lead'), fadeUp(), { ...shown, duration: 0.8, ease: EASE }, a)
      tl.fromTo(q('.tr-arow'), { autoAlpha: 0, x: -36 }, { autoAlpha: 1, x: 0, duration: 0.6, stagger: 0.3, ease: EASE }, a + 0.5)
      tl.fromTo(q('.tr-card'), { autoAlpha: 0, y: 60, rotateX: -14, transformPerspective: 1400 }, { autoAlpha: 1, y: 0, rotateX: 0, duration: 0.9, ease: EASE }, a + 0.4)
      // the draft is typed into the preview; nothing is applied until the person presses Apply
      const text = tour.ai.sample.text
      const typed = q('.tr-typed')[0] as HTMLElement | undefined
      const t = { n: 0 }
      tl.to(t, { n: text.length, duration: 2.6, ease: 'none', onUpdate: () => { if (typed) typed.textContent = text.slice(0, Math.round(t.n)) } }, a + 1.4)
      const typedEnd = a + 4.1
      tl.fromTo(q('.tr-cursor'), { autoAlpha: 0, x: -150, y: -90 }, { autoAlpha: 1, x: 0, y: 0, duration: 0.8, ease: 'power2.inOut' }, typedEnd)
      tl.to(q('.tr-btn.apply'), { scale: 0.93, duration: 0.12 }, typedEnd + 0.85)
      tl.to(q('.tr-btn.apply'), { scale: 1, backgroundColor: '#74cd23', color: '#06182b', duration: 0.3 }, typedEnd + 0.97)
      tl.fromTo(q('.tr-guard'), fadeUp(), { ...shown, duration: 0.7, ease: EASE }, typedEnd + 1.2)
      tl.fromTo(q('.tr-control'), fadeUp(), { ...shown, duration: 0.7, ease: EASE }, typedEnd + 1.6)
      return typedEnd + 2.5
    },
    research: (a) => {
      tl.set(panel('research'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.tr-panel[data-tab="research"] .tr-lead'), fadeUp(), { ...shown, duration: 0.8, ease: EASE }, a)
      tl.fromTo(q('.tr-ritem'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.35, ease: EASE }, a + 0.5)
      return a + 1.4 + tour.research.items.length * 0.35
    },
    features: (a) => {
      tl.set(panel('features'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.tr-gchip'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.07, ease: EASE }, a)
      return groupIn(0, a + 0.2)
    },
    roles: (a) => {
      tl.set(panel('roles'), { autoAlpha: 1 }, a)
      tl.fromTo(q('.tr-rolebtn'), { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.08, ease: EASE }, a)
      return roleIn(0, a + 0.2)
    },
  }
  const leave = (tab: TourTab, at: number): number => {
    tl.to(panel(tab), { autoAlpha: 0, y: -24, duration: 0.5, ease: 'power2.in' }, at)
    return at + 0.5
  }
  const within = (tab: TourTab, step: number, at: number): number => {
    progress(tab, step, at)
    if (tab === 'features') return groupIn(step, groupOut(step - 1, at) + 0.05)
    if (tab === 'roles') return roleIn(step, roleOut(step - 1, at) + 0.05)
    return at
  }

  // the entrance: backdrop, titles, the bar, then the first tab
  tl.fromTo(q('.at-dots'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2 }, 0)
  tl.fromTo(q('.tr-aurora'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 2.4 }, 0)
  tl.fromTo(q('.at-kicker, .at-top'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.1)
  tl.fromTo(q('.tr-tab'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.07 }, 0.3)
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
  // a slow drift of the light behind everything, over the whole length
  tl.to(q('.tr-aurora.a'), { x: -140, y: 50, duration: tl.duration(), ease: 'none' }, 0)
  tl.to(q('.tr-aurora.b'), { x: 120, y: -40, duration: tl.duration(), ease: 'none' }, 0)
}

export function TourScene({ plan, beat, beats, entry, reduced, nav }: P) {
  const ref = useRef<HTMLDivElement>(null)
  const p = productOf(plan.family ?? '') as AtlasProduct
  const tour = p.tour as AtlasTour
  const tabs = tourTabs(tour)
  const steps = tourSteps(tour)
  const beatOf = (tab: TourTab, step: number) => steps.findIndex((s) => s.tab === tab && s.step === step)
  const groups = tour.features.groups
  const mods = tour.intelligence.modules

  useBeatTimeline(ref, (tl, { q }) => buildTour(tl, q, tour, p.subs.length), { beat, beats, entry, reduced, maxTween: 4.5 })

  return (
    <div ref={ref} className="cp-scene at tr" data-theme="ink" style={themeVars('ink')}>
      <div className="at-glow" /><div className="tr-aurora a" /><div className="tr-aurora b" /><div className="at-dots" />
      <Rail current={p.key} nav={nav} />
      <div className="at-kicker">{p.product}</div>
      <div className="at-top">{p.k12_module} · {p.subs.length} modules</div>

      <nav className="tr-tabs" aria-label={`${p.product} tour`} style={{ gridTemplateColumns: tabs.map((t) => `${TOUR_TAB_LABELS[t].length + 8}fr`).join(' ') }}>
        {tabs.map((tab, i) => (
          <button type="button" className="tr-tab" data-tab={tab} key={tab} onKeyDown={stopKeys} onClick={() => nav.setBeat(firstBeatOfTab(tour, tab) ?? 0)}>
            <span className="tr-rule"><em /></span>
            <span className="tr-tabin"><i>{pad2(i + 1)}</i><b>{TOUR_TAB_LABELS[tab]}</b></span>
          </button>
        ))}
      </nav>

      {/* 1 summary */}
      <section className="tr-panel" data-tab="summary" aria-label="Summary">
        <h2 className="tr-s1"><Words text={tour.summary.lines[0]} split={3} /></h2>
        <p className="tr-s2">{tour.summary.lines[1]}</p>
        <p className="tr-s3">{tour.summary.lines[2]}</p>
        <div className="tr-count"><b className="tr-count-n">0</b><span>modules</span></div>
        <ul className="tr-groups">
          {groups.map((g) => (
            <li className="tr-grow" key={g.title}>
              <span className="tr-gname">{g.title}</span>
              <span className="tr-gdots">{g.subs.map((s) => <i key={s.id} />)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 2 problem */}
      <section className="tr-panel" data-tab="problem" aria-label="Problem">
        <div className="tr-illus">{tour.problem.label}</div>
        <div className="tr-pls">
          {tour.problem.beats.map((line, i) => (
            <p className="tr-pl" data-i={i} key={i}><span className="tr-pl-in">{line}</span></p>
          ))}
        </div>
        <p className="tr-turn">{tour.problem.turn}</p>
        {tour.problem.scattered.map((name, i) => (
          <div className="tr-reg" data-i={i} key={name} style={{ left: REG[i].x, top: REG[i].y, width: REG_W, height: REG_H, transform: `rotate(${REG[i].r}deg)` }}>{name}</div>
        ))}
        <div className="tr-record" style={{ left: REC.x, top: REC.y, width: REC.w, height: REC.h }}><b>{p.product}</b><span>{tour.problem.record}</span></div>
      </section>

      {/* 3 intelligence */}
      <section className="tr-panel" data-tab="intelligence" aria-label="Intelligence">
        <p className="tr-lead">{tour.intelligence.lead}</p>
        <ul className="tr-rows tr-irows">
          {mods.map((m, i) => (
            <li className="tr-irow" data-i={i} key={m.id}><b>{m.name}</b><span>{m.asks}</span></li>
          ))}
        </ul>
        <svg className="tr-ringsvg" viewBox="0 0 1920 1080" aria-hidden="true">
          {mods.map((_, i) => {
            const pt = ringAt(i, mods.length)
            return <line className="tr-ilink" data-i={i} key={i} x1={RING.x} y1={RING.y} x2={pt.x} y2={pt.y} />
          })}
        </svg>
        <div className="tr-hubc" style={{ left: RING.x - 95, top: RING.y - 48 }}>Your school&apos;s records</div>
        {mods.map((m, i) => {
          const pt = ringAt(i, mods.length)
          return <div className="tr-inode" data-i={i} key={m.id} style={{ left: pt.x - 100, top: pt.y - 28 }}>{m.name}</div>
        })}
        <p className="tr-close">{tour.intelligence.close}</p>
      </section>

      {/* 4 AI capability */}
      <section className="tr-panel" data-tab="ai" aria-label="AI capability">
        <p className="tr-lead">{tour.ai.lead}</p>
        <ul className="tr-rows tr-airows">
          {tour.ai.uses.map((u) => (
            <li className="tr-arow" key={u.name}><b>{u.name}</b><span>{u.line}</span></li>
          ))}
        </ul>
        <div className="tr-card">
          <div className="tr-card-h"><span>Draft preview</span><em>{tour.ai.sample.label}</em></div>
          <p className="tr-typed" />
          <div className="tr-card-f"><span className="tr-btn apply">Apply</span><span className="tr-btn">Discard</span></div>
          <i className="tr-cursor" />
        </div>
        <p className="tr-guard">{tour.ai.guard}</p>
        <p className="tr-control">{tour.ai.control}</p>
      </section>

      {/* 5 research (only when there is data) */}
      {tour.research.items.length > 0 && (
        <section className="tr-panel" data-tab="research" aria-label="Research">
          <p className="tr-lead">Designed from</p>
          <ul className="tr-research">
            {tour.research.items.map((r, i) => <li className="tr-ritem" key={i}><span>{r.text}</span><em>{r.source}</em></li>)}
          </ul>
        </section>
      )}

      {/* 6 features and modules: one group of five per beat */}
      <section className="tr-panel" data-tab="features" aria-label="Features and modules">
        <div className="tr-gchips">
          {groups.map((g, i) => (
            <button type="button" className="tr-gchip" data-i={i} key={g.title} onKeyDown={stopKeys} onClick={() => nav.setBeat(beatOf('features', i))}><span className="tr-gin"><i>{pad2(i + 1)}</i>{g.title}</span></button>
          ))}
        </div>
        {groups.map((g, gi) => (
          <div className="tr-group" data-i={gi} key={g.title}>
            <h3 className="tr-gtitle"><Words text={g.title} split={1} /></h3>
            <div className="tr-cols">
              {g.subs.map((s) => (
                <div className="tr-col" key={s.id}>
                  <div className="tr-shot">{s.shot && <img src={s.shot} alt="" />}</div>
                  <b>{s.name}</b>
                  <span>{s.tagline}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* 7 role-wise benefits: one role per beat */}
      <section className="tr-panel" data-tab="roles" aria-label="Role-wise benefits">
        <ul className="tr-rolelist">
          {tour.roles.map((r, i) => (
            <li key={r.role}><button type="button" className="tr-rolebtn" data-i={i} onKeyDown={stopKeys} onClick={() => nav.setBeat(beatOf('roles', i))}><span className="tr-rbin"><i>{pad2(i + 1)}</i>{r.role}</span></button></li>
          ))}
        </ul>
        {tour.roles.map((r, i) => (
          <div className="tr-role" data-i={i} key={r.role}>
            <span className="tr-who">{r.who}</span>
            <h3 className="tr-rname"><Words text={r.role} split={1} /></h3>
            <ul className="tr-ben">{r.benefits.map((b) => <li key={b}>{b}</li>)}</ul>
            <div className="tr-use"><em>{`A day with ${p.product}. Illustrative.`}</em><p>{r.use}</p></div>
            <div className="tr-mods">{r.modules.map((m) => <span key={m.id}>{m.name}</span>)}</div>
          </div>
        ))}
      </section>
    </div>
  )
}
