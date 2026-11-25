'use client'

import { useRef, type ReactNode } from 'react'

import { ATLAS, atlasByN, productOf, type AtlasProduct, type AtlasSlide, type AtlasSub } from '@/lib/client-presentation/atlas'
import { themeVars } from '@/lib/client-presentation/palette'

import { gsap } from '../motion/gsap'
import { useBeatTimeline } from '../motion/use-beat-timeline'

import './atlas.css'
import type { SceneProps } from './types'

/**
 * The Product Atlas scenes. One component per kind of slide, all driven by lib/client-presentation/atlas.ts (the sheets written from source).
 * Every scene sits on the 1920 x 1080 stage with equal columns and one baseline. Beats: a press of Next opens the next sub-module (spotlight)
 * or the next family (gallery); the other scenes play by themselves.
 */
type P = SceneProps & { plan: AtlasSlide }

const filledProducts = (): AtlasProduct[] => ATLAS.products.filter((p) => p.subs.length)
const pad2 = (n: number) => String(n).padStart(2, '0')

function Words({ text, split }: { text: string; split?: number }): ReactNode {
  const w = text.split(' ')
  const cut = split ?? Math.ceil(w.length / 2)
  return w.map((x, i) => (
    <span className="at-wm" key={i}><span className={`at-w ${i < cut ? 'light' : 'heavy'}`}>{x}</span></span>
  ))
}

/* 1 big letters */
function Big({ plan, beat, beats, entry, reduced }: P) {
  const ref = useRef<HTMLDivElement>(null)
  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.at-dots'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4 }, 0)
    tl.fromTo(q('.at-ghost'), { xPercent: 14, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 1.8, ease: 'power3.out' }, 0)
    tl.fromTo(q('.at-kicker'), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.2)
    tl.fromTo(q('.at-w'), { yPercent: 115 }, { yPercent: 0, duration: 1.05, stagger: 0.14, ease: 'power3.out' }, 0.35)
    tl.to(q('.at-rule'), { scaleX: 1, duration: 1.3, ease: 'power2.inOut' }, 0.5)
    tl.fromTo(q('.at-count'), { autoAlpha: 0 }, { autoAlpha: 0.9, duration: 0.6 }, 1.2)
    tl.addLabel('b0', 2.6)
  }, { beat, beats, entry, reduced })
  return (
    <div ref={ref} className="cp-scene at" data-theme={plan.theme} style={themeVars(plan.theme)}>
      <div className="at-glow" /><div className="at-dots" />
      <div className="at-ghost" aria-hidden="true">{plan.ghost}</div>
      <div className="at-kicker">{plan.ghost} — {plan.kicker}</div>
      <h2 className="at-big-title"><Words text={plan.title} /></h2>
      <div className="at-rule" />
      <div className="at-count">{ATLAS.products.reduce((a, p) => a + p.subs.length, 0)} sub-modules · {filledProducts().length} product families</div>
    </div>
  )
}

/* 2 every module: five equal columns */
function Families({ plan, beat, beats, entry, reduced }: P) {
  const ref = useRef<HTMLDivElement>(null)
  const ps = filledProducts()
  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.at-dots'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 0)
    tl.fromTo(q('.at-kicker'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.1)
    ps.forEach((p, i) => {
      const at = 0.4 + i * 0.55
      const col = `.at-col[data-i="${i}"]`
      tl.to(q(`${col} .at-vrule`), { scaleY: 1, duration: 0.9, ease: 'power2.inOut' }, at)
      tl.fromTo(q(`${col} .at-idx, ${col} .at-prod, ${col} .at-mod`), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' }, at + 0.1)
      tl.fromTo(q(`${col} .at-sum`), { autoAlpha: 0, filter: 'blur(8px)' }, { autoAlpha: 1, filter: 'blur(0px)', duration: 0.9 }, at + 0.4)
      const o = { v: 0 }; const el = q(`${col} .at-num`)[0] as HTMLElement
      tl.fromTo(q(`${col} .at-num, ${col} .at-numl`), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, at + 0.5)
      tl.to(o, { v: p.subs.length, duration: 1.1, ease: 'power2.out', onUpdate: () => { el.textContent = String(Math.round(o.v)) } }, at + 0.5)
    })
    tl.addLabel('b0', 0.4 + ps.length * 0.55 + 1.2)
  }, { beat, beats, entry, reduced })
  return (
    <div ref={ref} className="cp-scene at" data-theme={plan.theme} style={themeVars(plan.theme)}>
      <div className="at-glow" /><div className="at-dots" />
      <div className="at-kicker">{plan.ghost} — {plan.kicker}</div>
      <div className="at-cols" style={{ gridTemplateColumns: `repeat(${ps.length}, 1fr)` }}>
        {ps.map((p, i) => (
          <div className="at-col" data-i={i} key={p.key}>
            <div className="at-vrule" />
            <div className="at-idx" style={{ opacity: 0 }}>{pad2(i + 1)}</div>
            <div className="at-prod" style={{ opacity: 0 }}>{p.product}</div>
            <div className="at-mod" style={{ opacity: 0 }}>{p.k12_module}</div>
            <div className="at-sum" style={{ opacity: 0 }}>{p.family?.summary ?? p.subs[0]?.summary}</div>
            <div className="at-num" style={{ opacity: 0 }}>0</div>
            <div className="at-numl" style={{ opacity: 0 }}>sub-modules</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* 3 problems and 6 benefits: one row per family */
function Rows({ plan, beat, beats, entry, reduced, mode }: P & { mode: 'problem' | 'benefit' }) {
  const ref = useRef<HTMLDivElement>(null)
  const ps = filledProducts()
  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.at-dots'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 0)
    tl.fromTo(q('.at-kicker'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.1)
    ps.forEach((p, i) => {
      const at = 0.4 + i * 0.6; const row = `.at-row[data-i="${i}"]`
      tl.to(q(`${row} .at-hline`), { scaleX: 1, duration: 0.8, ease: 'power2.inOut' }, at)
      tl.fromTo(q(`${row} .at-rp, ${row} .at-rm`), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' }, at + 0.1)
      tl.fromTo(q(`${row} .at-arrow path`), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.7, ease: 'power2.inOut' }, at + 0.3)
      tl.fromTo(q(`${row} .at-rt`), { autoAlpha: 0, x: 40, filter: 'blur(8px)' }, { autoAlpha: 1, x: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out' }, at + 0.5)
    })
    tl.addLabel('b0', 0.4 + ps.length * 0.6 + 1.4)
  }, { beat, beats, entry, reduced })
  return (
    <div ref={ref} className={`cp-scene at${mode === 'benefit' ? ' at-ben' : ''}`} data-theme={plan.theme} style={themeVars(plan.theme)}>
      <div className="at-glow" /><div className="at-dots" />
      <div className="at-kicker">{plan.ghost} — {plan.kicker}</div>
      <div className="at-rows">
        {ps.map((p, i) => (
          <div className={`at-row${mode === 'benefit' ? ' at-ben' : ''}`} data-i={i} key={p.key}>
            <div className="at-hline" />
            <div className="at-rp" style={{ opacity: 0 }}>{p.product}</div>
            <div className="at-rm" style={{ opacity: 0 }}>{p.k12_module}</div>
            <svg className="at-arrow" viewBox="0 0 150 40" aria-hidden="true"><path d="M2 20 H138 M122 6 L138 20 L122 34" fill="none" stroke="var(--cp-blue)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div className="at-rt" style={{ opacity: 0 }}>{mode === 'problem' ? (p.family?.problem ?? p.subs[0]?.problem) : (p.family?.benefit ?? p.subs[0]?.benefit)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* 4 workflows */
function Workflows({ plan, beat, beats, entry, reduced }: P) {
  const ref = useRef<HTMLDivElement>(null)
  const ps = filledProducts().filter((p) => p.family?.workflow?.length)
  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.at-dots'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 0)
    tl.fromTo(q('.at-kicker'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.1)
    ps.forEach((p, i) => {
      const at = 0.4 + i * 0.9; const row = `.at-wfrow[data-i="${i}"]`
      tl.fromTo(q(`${row} .at-wfname, ${row} .at-wfmod`), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08 }, at)
      tl.to(q(`${row} .at-wfline`), { scaleX: 1, duration: 1.3, ease: 'power1.inOut' }, at + 0.2)
      const n = p.family!.workflow.length
      for (let k = 0; k < n; k++) {
        const t = at + 0.2 + (k / Math.max(1, n - 1)) * 1.3
        tl.fromTo(q(`${row} .at-wfnode[data-k="${k}"]`), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'back.out(2.4)' }, t)
        tl.fromTo(q(`${row} .at-wflab[data-k="${k}"]`), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45 }, t + 0.1)
      }
    })
    tl.addLabel('b0', 0.4 + ps.length * 0.9 + 1.6)
  }, { beat, beats, entry, reduced })
  return (
    <div ref={ref} className="cp-scene at" data-theme={plan.theme} style={themeVars(plan.theme)}>
      <div className="at-glow" /><div className="at-dots" />
      <div className="at-kicker">{plan.ghost} — {plan.kicker}</div>
      <div className="at-wf">
        {ps.map((p, i) => {
          const wf = p.family!.workflow
          return (
            <div className="at-wfrow" data-i={i} key={p.key}>
              <div className="at-wfname" style={{ opacity: 0 }}>{p.product}</div>
              <div className="at-wfmod" style={{ opacity: 0 }}>{p.k12_module}</div>
              <div className="at-wfline" />
              {wf.map((s, k) => {
                const x = 440 + (k / Math.max(1, wf.length - 1)) * 1200
                return (
                  <div key={k}>
                    <div className={`at-wfnode${k === wf.length - 1 ? ' last' : ''}`} data-k={k} style={{ left: x, opacity: 0 }} />
                    <div className="at-wflab" data-k={k} style={{ left: x, opacity: 0 }}>{s}</div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* 5 AI and technology: three pillars, then what it is designed from */
function Tech({ plan, beat, beats, entry, reduced }: P) {
  const ref = useRef<HTMLDivElement>(null)
  const t = ATLAS.tech
  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.at-dots'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 0)
    tl.fromTo(q('.at-kicker'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.1)
    tl.fromTo(q('.at-pname'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.25, ease: 'power3.out' }, 0.4)
    tl.fromTo(q('.at-vrule'), { scaleY: 0 }, { scaleY: 1, duration: 1, stagger: 0.2, ease: 'power2.inOut' }, 0.5)
    tl.addLabel('b0', 2.2)
    tl.fromTo(q('.at-pline'), { autoAlpha: 0, x: 30 }, { autoAlpha: 1, x: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' }, 'b0+=0.1')
    tl.addLabel('b1', 'b0+=2.2')
    tl.fromTo(q('.at-from'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 'b1+=0.1')
    tl.addLabel('b2', 'b1+=1.3')
  }, { beat, beats, entry, reduced })
  if (!t) return <div ref={ref} className="cp-scene at" data-theme={plan.theme} style={themeVars(plan.theme)} />
  return (
    <div ref={ref} className="cp-scene at" data-theme={plan.theme} style={themeVars(plan.theme)}>
      <div className="at-glow" /><div className="at-dots" />
      <div className="at-kicker">{plan.ghost} — {plan.kicker}</div>
      <div className="at-pillars">
        {t.pillars.map((p, i) => (
          <div className="at-pillar" key={p.name}>
            {i > 0 && <div className="at-vrule" style={{ height: 520 }} />}
            <div className="at-pname" style={{ opacity: 0 }}>{p.name.split(' ').map((w, k, a) => (k === a.length - 1 ? <b key={k}>{w}</b> : <span key={k}>{w} </span>))}</div>
            {p.lines.map((l) => <div className="at-pline" key={l}>{l}</div>)}
          </div>
        ))}
      </div>
      <div className="at-from"><h4>Designed from</h4><p>{t.designed_from.map((d) => <span key={d}>{d}</span>)}</p></div>
    </div>
  )
}

/* 7 the sub-module spotlight: one sub-module per press of Next */
function Subs({ plan, beat, beats, entry, reduced }: P) {
  const ref = useRef<HTMLDivElement>(null)
  const p = productOf(plan.family ?? '') as AtlasProduct
  const subs = (plan.subs ?? []).map((id) => p.subs.find((s) => s.id === id)).filter(Boolean) as AtlasSub[]
  const intro = Boolean(plan.intro && p.family)
  const n = subs.length

  useBeatTimeline(ref, (tl, { q }) => {
    const sel = (cls: string, i: number) => q(`.at-sub[data-i="${i}"] ${cls}`)
    let t = 0
    tl.fromTo(q('.at-dots'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 0)
    tl.fromTo(q('.at-kicker, .at-top, .at-rail'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.1)
    const showRail = (i: number, at: number) => q('.at-rail span').forEach((el, j) => tl.to(el, { opacity: j === i ? 1 : 0.4, duration: 0.3 }, at))
    const markRail = (i: number, at: number) => q('.at-rail span').forEach((el, j) => tl.call(() => { el.classList.toggle('on', j === i) }, undefined, at))
    const tIn = (i: number, at: number) => {
      const v = i % 3; const shot = sel('.at-shot', i)
      tl.set(q(`.at-sub[data-i="${i}"]`), { autoAlpha: 1 }, at)
      if (v === 0) tl.fromTo(shot, { x: 160, rotateY: -26, autoAlpha: 0 }, { x: 0, rotateY: -9, autoAlpha: 1, duration: 1.15, ease: 'power3.out' }, at)
      else if (v === 1) tl.fromTo(shot, { y: 110, rotateX: 22, autoAlpha: 0 }, { y: 0, rotateX: 6, rotateY: -5, autoAlpha: 1, duration: 1.15, ease: 'power3.out' }, at)
      else tl.fromTo(shot, { scale: 1.2, filter: 'blur(14px)', autoAlpha: 0 }, { scale: 1, filter: 'blur(0px)', rotateY: 8, autoAlpha: 1, duration: 1.15, ease: 'power3.out' }, at)
      tl.fromTo(sel('.at-sheen', i), { xPercent: -120 }, { xPercent: 130, duration: 1.3, ease: 'power2.inOut' }, at + 0.8)
      tl.fromTo(sel('.at-name span', i), { yPercent: 112 }, { yPercent: 0, duration: 0.9, ease: 'power3.out' }, at + 0.15)
      tl.fromTo(sel('.at-r', i), { autoAlpha: 0, y: 24, filter: 'blur(7px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.75, stagger: 0.14, ease: 'power3.out' }, at + 0.35)
      tl.fromTo(sel('.at-lens', i), { scale: 0, autoAlpha: 0, transformOrigin: '50% 50%' }, { scale: 1, autoAlpha: 1, duration: 0.7, ease: 'back.out(1.8)' }, at + 1.0)
      tl.fromTo(sel('.at-feat li', i), { autoAlpha: 0, x: -26 }, { autoAlpha: 1, x: 0, duration: 0.55, stagger: 0.1, ease: 'power2.out' }, at + 0.55)
      markRail(i, at + 0.2)
      return at + 2.0
    }
    const tOut = (sel2: gsap.TweenTarget, at: number) => tl.to(sel2, { autoAlpha: 0, y: -24, filter: 'blur(8px)', duration: 0.45, ease: 'power2.in' }, at)
    if (intro) {
      tl.fromTo(q('.at-intro-name'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' }, 0.2)
      tl.set(q('.at-intro'), { autoAlpha: 1 }, 0)
      tl.fromTo(q('.at-intro .at-r'), { autoAlpha: 0, y: 24, filter: 'blur(7px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.2 }, 0.7)
      t = 3.6
      tl.addLabel('b0', t)
      for (let i = 0; i < n; i++) {
        tOut(i === 0 ? q('.at-intro') : q(`.at-sub[data-i="${i - 1}"]`), t)
        t = tIn(i, t + 0.35)
        tl.addLabel(`b${i + 1}`, t)
      }
    } else {
      t = tIn(0, 0.2)
      tl.addLabel('b0', t)
      for (let i = 1; i < n; i++) {
        tOut(q(`.at-sub[data-i="${i - 1}"]`), t)
        t = tIn(i, t + 0.35)
        tl.addLabel(`b${i}`, t)
      }
    }
    void showRail
  }, { beat, beats, entry, reduced })

  const rows: [string, ReactNode][] = []
  return (
    <div ref={ref} className="cp-scene at" data-theme="ink" style={themeVars('ink')}>
      <div className="at-glow" /><div className="at-dots" />
      <div className="at-kicker">{p.product}</div>
      <div className="at-top">{p.k12_module} · {plan.ghost}</div>
      {intro && p.family && (
        <section className="at-intro" aria-label={`${p.product} overview`}>
          <h2 className="at-intro-name">{p.product.split(' ').map((w, i, a) => (i === a.length - 1 ? <b key={i}>{w}</b> : <span key={i}>{w} </span>))}</h2>
          <div className="at-r" style={{ top: 440 }}><div className="at-lab">What it is</div><div className="at-txt">{p.family.summary}</div></div>
          <div className="at-r" style={{ top: 625 }}><div className="at-lab">The problem it removes</div><div className="at-txt">{p.family.problem}</div></div>
          <div className="at-r" style={{ top: 800 }}><div className="at-lab">Technology</div><div className="at-txt">{p.family.technology.join(' · ')}</div></div>
          <div className="at-r" style={{ top: 440, left: 980, width: 760 }}><div className="at-lab">What could become easier</div><div className="at-txt">{p.family.benefit}</div></div>
          <div className="at-r" style={{ top: 625, left: 980, width: 760 }}><div className="at-lab">{p.family.ai.length ? 'Where AI and intelligence help' : 'How it is built'}</div><div className="at-txt">{p.family.ai.length ? p.family.ai.join(' · ') : (p.family.research ?? p.family.technology.join(' · '))}</div></div>
        </section>
      )}
      {subs.map((s, i) => (
        <section className={`at-sub${s.shots[0] ? '' : ' at-noshot'}`} data-i={i} key={s.id} aria-label={s.name}>
          {s.shots[0] && (
            <div className="at-stage3d">
              <div className="at-shot">
                <img src={s.shots[0]} alt={`${s.name}: ${s.screens[0] ?? 'screen'}`} draggable={false} />
                <div className="at-sheen" />
              </div>
            </div>
          )}
          {s.shots[0] && <div className="at-lens" style={{ backgroundImage: `url(${s.shots[0]})` }} aria-hidden="true" />}
          <div className="at-feat r-feat"><div className="at-lab at-r" style={{ marginBottom: 14 }}>Features</div><ul>{s.features.map((f) => <li key={f}>{f}</li>)}</ul></div>
          <h3 className="at-name" style={s.name.length > 16 ? { fontSize: 58 } : s.name.length > 11 ? { fontSize: 70 } : undefined}><span>{s.name}</span></h3>
          <div className="at-rcol at-r" style={{ top: 300 }}><div className="at-lab">What it is</div><div className="at-txt">{s.summary}</div></div>
          <div className="at-rcol at-r" style={{ top: 445 }}><div className="at-lab">The problem it removes</div><div className="at-txt">{s.problem}</div></div>
          <div className="at-rcol at-r" style={{ top: 595 }}><div className="at-lab">What could become easier</div><div className="at-txt">{s.benefit}</div></div>
          <div className="at-rcol at-r" style={{ top: 752 }}><div className="at-lab">Technology</div><div className="at-txt">{s.technology.join(' · ')}</div></div>
          {(s.research || s.screens.length > 0) && <div className="at-rcol at-r" style={{ top: 895 }}>
            {s.research
              ? <><div className="at-lab">Designed from</div><div className="at-txt">{s.research}</div></>
              : <><div className="at-lab">{s.screen_count} screens, for example</div><div className="at-txt" style={{ fontSize: 23 }}>{s.screens.slice(0, 5).join(' · ')}</div></>}
          </div>}
        </section>
      ))}
      <nav className="at-rail" aria-hidden="true">{subs.map((s, i) => <span key={s.id} className={i === 0 ? 'on' : ''}>{s.name}</span>)}</nav>
      {rows.length ? null : null}
    </div>
  )
}

/* 8 the screens, a family at a time */
function Gallery({ plan, beat, beats, entry, reduced }: P) {
  const ref = useRef<HTMLDivElement>(null)
  const ps = filledProducts()
  const tiles = (p: AtlasProduct) => p.subs.filter((s) => s.shots.length).slice(0, 6)
  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.at-dots'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 0)
    tl.fromTo(q('.at-kicker'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.1)
    let t = 0.3
    ps.forEach((p, f) => {
      const set = `.at-gal-set[data-f="${f}"]`
      if (f > 0) tl.to(q(`.at-gal-set[data-f="${f - 1}"]`), { autoAlpha: 0, x: -60, duration: 0.5, ease: 'power2.in' }, t)
      tl.set(q(set), { autoAlpha: 1 }, t + (f > 0 ? 0.4 : 0))
      tl.fromTo(q(`${set} .at-gal-title, ${set} .at-gal-mod`), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out' }, t + 0.3)
      tl.fromTo(q(`${set} .at-gal-plane`), { rotateX: 30, rotateY: -34, y: 120, autoAlpha: 0 }, { rotateX: 8, rotateY: -14, y: 0, autoAlpha: 1, duration: 1.4, ease: 'power3.out' }, t + 0.35)
      tl.fromTo(q(`${set} .at-gal-item`), { autoAlpha: 0, z: -160, y: 50 }, { autoAlpha: 1, z: 0, y: 0, duration: 0.8, stagger: 0.14, ease: 'power3.out' }, t + 0.7)
      t += 3.4
      tl.addLabel(`b${f}`, t)
    })
  }, { beat, beats, entry, reduced })
  return (
    <div ref={ref} className="cp-scene at" data-theme={plan.theme} style={themeVars(plan.theme)}>
      <div className="at-glow" /><div className="at-dots" />
      <div className="at-kicker">{plan.ghost} — {plan.kicker}</div>
      {ps.map((p, f) => (
        <div className="at-gal-set" data-f={f} key={p.key}>
          <div className="at-gal-title">{p.product}</div>
          <div className="at-gal-mod">{p.k12_module}</div>
          <div className="at-gal-grid"><div className="at-gal-plane">
            {tiles(p).map((s, k) => (
              <div className="at-gal-item" key={s.id} style={{ left: (k % 3) * 375, top: Math.floor(k / 3) * 330 }}>
                <div className="at-gshot">
                  <img src={s.shots[0]} alt={`${s.name}: screen`} draggable={false} />
                </div>
                <b>{s.name}</b>
              </div>
            ))}
          </div></div>
        </div>
      ))}
      <div className="at-gal-note">Screens from the working product, edited for this presentation. Personal details are removed.</div>
    </div>
  )
}

export default function AtlasScene(props: SceneProps) {
  const plan = atlasByN(props.slide.n)
  if (!plan) return null
  const p: P = { ...props, plan }
  switch (plan.kind) {
    case 'big': return <Big {...p} />
    case 'families': return <Families {...p} />
    case 'problems': return <Rows {...p} mode="problem" />
    case 'benefits': return <Rows {...p} mode="benefit" />
    case 'subs': return <Subs {...p} />
    case 'workflows': return <Workflows {...p} />
    case 'tech': return <Tech {...p} />
    case 'gallery': return <Gallery {...p} />
    default: return null
  }
}
