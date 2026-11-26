'use client'

import { useRef, type KeyboardEvent, type ReactNode } from 'react'

import { atlasByN, HUB_KEY, PRODUCT_NAV, productOf, type AtlasProduct, type AtlasSlide, type AtlasSub } from '@/lib/client-presentation/atlas'
import { themeVars } from '@/lib/client-presentation/palette'

import { gsap } from '../motion/gsap'
import { useBeatTimeline } from '../motion/use-beat-timeline'

import './atlas.css'
import { Rail, Words, pad2, stopKeys } from './atlas-shared'
import FilmScene from './film-scene'
import { TourScene } from './tour-scene'
import type { SceneProps } from './types'

/**
 * The Product Atlas scenes, organised by product (see lib/client-presentation/atlas.ts): a hub with one button per product, then for each
 * product an opener, its sub-modules (a press of Next opens the next one), a "how it works" slide and its screens. Every slide has a product
 * rail: one click opens any product, so a client interested in one module never has to see the others. Fixed 1920 x 1080 stage, equal columns,
 * one baseline, labels in the same place in every cell.
 */
type P = SceneProps & { plan: AtlasSlide }




/* the hub: choose a product */
function Hub({ plan, beat, beats, entry, reduced, nav }: P) {
  const ref = useRef<HTMLDivElement>(null)
  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.at-dots'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2 }, 0)
    tl.fromTo(q('.at-kicker'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.1)
    tl.fromTo(q('.at-w'), { yPercent: 115 }, { yPercent: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' }, 0.25)
    tl.fromTo(q('.at-hubsub'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.9)
    PRODUCT_NAV.forEach((_, i) => {
      const at = 1.1 + i * 0.22; const col = `.at-hubcol[data-i="${i}"]`
      tl.to(q(`${col} .at-vrule`), { scaleY: 1, duration: 0.8, ease: 'power2.inOut' }, at)
      tl.fromTo(q(`${col} > *:not(.at-vrule)`), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out' }, at + 0.1)
    })
    tl.addLabel('b0', 3.2)
  }, { beat, beats, entry, reduced })
  return (
    <div ref={ref} className="cp-scene at" data-theme="ink" style={themeVars('ink')}>
      <div className="at-glow" /><div className="at-dots" />
      <Rail nav={nav} />
      <div className="at-kicker">{plan.kicker}</div>
      <h2 className="at-hubtitle"><Words text={plan.title} split={2} /></h2>
      <p className="at-hubsub">Open one product, or press Next to see them in order. Keys 1 to 5 open a product from anywhere.</p>
      <div className="at-hubgrid" style={{ gridTemplateColumns: `repeat(${PRODUCT_NAV.length}, 1fr)` }}>
        {PRODUCT_NAV.map((pn, i) => {
          const p = productOf(pn.key) as AtlasProduct
          return (
            <button type="button" className="at-hubcol" data-i={i} key={pn.key} onKeyDown={stopKeys} onClick={() => nav.goto(pn.opener)}>
              <span className="at-vrule" />
              <span className="at-idx">{pad2(i + 1)}</span>
              <span className="at-prod">{p.product}</span>
              <span className="at-mod">{p.k12_module}</span>
              <span className="at-sum">{p.family?.summary ?? p.subs[0]?.summary}</span>
              <span className="at-num">{p.subs.length}</span>
              <span className="at-numl">sub-modules</span>
              <span className="at-open">Open ›</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* the opener of a product */
function Opener({ plan, beat, beats, entry, reduced, nav }: P) {
  const ref = useRef<HTMLDivElement>(null)
  const p = productOf(plan.family ?? '') as AtlasProduct
  const f = p.family
  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.at-dots'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2 }, 0)
    tl.fromTo(q('.at-kicker, .at-top'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.1)
    tl.fromTo(q('.at-intro-name'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' }, 0.2)
    tl.fromTo(q('.at-intro .at-r'), { autoAlpha: 0, y: 24, filter: 'blur(7px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.18, ease: 'power3.out' }, 0.7)
    tl.addLabel('b0', 3.6)
  }, { beat, beats, entry, reduced })
  return (
    <div ref={ref} className="cp-scene at" data-theme="ink" style={themeVars('ink')}>
      <div className="at-glow" /><div className="at-dots" />
      <Rail current={p.key} nav={nav} />
      <div className="at-kicker">{p.product}</div>
      <div className="at-top">{p.k12_module} · {p.subs.length} sub-modules</div>
      <section className="at-intro" aria-label={`${p.product} overview`} style={{ opacity: 1, visibility: 'visible' }}>
        <h2 className="at-intro-name" style={{ opacity: 0 }}>{p.product.split(' ').map((w, i, a) => (i === a.length - 1 ? <b key={i}>{w}</b> : <span key={i}>{w} </span>))}</h2>
        {f && <>
          <div className="at-r" style={{ top: 440, opacity: 0 }}><div className="at-lab">What it is</div><div className="at-txt">{f.summary}</div></div>
          <div className="at-r" style={{ top: 625, opacity: 0 }}><div className="at-lab">The problem it removes</div><div className="at-txt">{f.problem}</div></div>
          <div className="at-r" style={{ top: 800, opacity: 0 }}><div className="at-lab">Technology</div><div className="at-txt">{f.technology.join(' · ')}</div></div>
          <div className="at-r" style={{ top: 440, left: 980, width: 760, opacity: 0 }}><div className="at-lab">What could become easier</div><div className="at-txt">{f.benefit}</div></div>
          <div className="at-r" style={{ top: 625, left: 980, width: 760, opacity: 0 }}><div className="at-lab">{f.ai.length ? 'Where AI and intelligence help' : 'How it is built'}</div><div className="at-txt">{f.ai.length ? f.ai.join(' · ') : (f.research ?? f.technology.join(' · '))}</div></div>
        </>}
      </section>
    </div>
  )
}

/* the sub-module spotlight: one sub-module per press of Next */
function Subs({ plan, beat, beats, entry, reduced, nav }: P) {
  const ref = useRef<HTMLDivElement>(null)
  const p = productOf(plan.family ?? '') as AtlasProduct
  const subs = (plan.subs ?? []).map((id) => p.subs.find((s) => s.id === id)).filter(Boolean) as AtlasSub[]
  const n = subs.length

  useBeatTimeline(ref, (tl, { q }) => {
    const sel = (cls: string, i: number) => q(`.at-sub[data-i="${i}"] ${cls}`)
    tl.fromTo(q('.at-dots'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 0)
    tl.fromTo(q('.at-kicker, .at-top, .at-rail'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.1)
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
    const tOut = (target: gsap.TweenTarget, at: number) => tl.to(target, { autoAlpha: 0, y: -24, filter: 'blur(8px)', duration: 0.45, ease: 'power2.in' }, at)
    let t = tIn(0, 0.2)
    tl.addLabel('b0', t)
    for (let i = 1; i < n; i++) {
      tOut(q(`.at-sub[data-i="${i - 1}"]`), t)
      t = tIn(i, t + 0.35)
      tl.addLabel(`b${i}`, t)
    }
  }, { beat, beats, entry, reduced })

  return (
    <div ref={ref} className="cp-scene at" data-theme="ink" style={themeVars('ink')}>
      <div className="at-glow" /><div className="at-dots" />
      <Rail current={p.key} nav={nav} />
      <div className="at-kicker">{p.product}</div>
      <div className="at-top">{p.k12_module} · {plan.ghost}</div>
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
    </div>
  )
}

/* how a product works: its workflow, what it runs on, where AI and intelligence help */
function Glance({ plan, beat, beats, entry, reduced, nav }: P) {
  const ref = useRef<HTMLDivElement>(null)
  const p = productOf(plan.family ?? '') as AtlasProduct
  const f = p.family
  const wf = f?.workflow ?? []
  const cols: { label: string; lines: string[] }[] = []
  if (f?.technology.length) cols.push({ label: 'What it runs on', lines: f.technology })
  if (f?.ai.length) cols.push({ label: 'Where AI and intelligence help', lines: f.ai })
  if (f?.research) cols.push({ label: 'Designed from', lines: [f.research] })
  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.at-dots'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 0)
    tl.fromTo(q('.at-kicker, .at-top'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.1)
    tl.fromTo(q('.at-glname, .at-gllab'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1 }, 0.3)
    tl.to(q('.at-wfline'), { scaleX: 1, duration: 1.4, ease: 'power1.inOut' }, 0.6)
    wf.forEach((_, k) => {
      const t = 0.6 + (k / Math.max(1, wf.length - 1)) * 1.4
      tl.fromTo(q(`.at-wfnode[data-k="${k}"]`), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'back.out(2.4)' }, t)
      tl.fromTo(q(`.at-wflab[data-k="${k}"]`), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45 }, t + 0.1)
    })
    tl.to(q('.at-glcol .at-vrule'), { scaleY: 1, duration: 0.9, stagger: 0.15, ease: 'power2.inOut' }, 1.6)
    tl.fromTo(q('.at-glcol .at-gllines > *'), { autoAlpha: 0, x: 26 }, { autoAlpha: 1, x: 0, duration: 0.6, stagger: 0.12, ease: 'power3.out' }, 1.9)
    tl.addLabel('b0', 4.2)
  }, { beat, beats, entry, reduced })
  return (
    <div ref={ref} className="cp-scene at" data-theme={plan.theme} style={themeVars(plan.theme)}>
      <div className="at-glow" /><div className="at-dots" />
      <Rail current={p.key} nav={nav} />
      <div className="at-kicker">{p.product} — how it works</div>
      <div className="at-top">{p.k12_module}</div>
      <div className="at-gllab" style={{ opacity: 0 }}>How the work flows</div>
      <div className="at-wfwrap">
        <div className="at-wfline" />
        {wf.map((s, k) => {
          const x = 110 + (k / Math.max(1, wf.length - 1)) * 1420
          return (
            <div key={k}>
              <div className={`at-wfnode${k === wf.length - 1 ? ' last' : ''}`} data-k={k} style={{ left: x, opacity: 0 }} />
              <div className="at-wflab" data-k={k} style={{ left: x, opacity: 0 }}>{s}</div>
            </div>
          )
        })}
      </div>
      <div className="at-glcols" style={{ gridTemplateColumns: `repeat(${Math.max(1, cols.length)}, 1fr)` }}>
        {cols.map((c, i) => (
          <div className="at-glcol" key={c.label}>
            {i > 0 && <div className="at-vrule" style={{ height: 430 }} />}
            <div className="at-glname" style={{ opacity: 0 }}>{c.label}</div>
            <div className="at-gllines">{c.lines.map((l) => <div className="at-pline" key={l} style={{ opacity: 0 }}>{l}</div>)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* the screens of a product (nine to a slide) */
function Gallery({ plan, beat, beats, entry, reduced, nav }: P) {
  const ref = useRef<HTMLDivElement>(null)
  const p = productOf(plan.family ?? '') as AtlasProduct
  const tiles = (plan.subs ?? []).map((id) => p.subs.find((s) => s.id === id)).filter((s): s is AtlasSub => Boolean(s && s.shots.length))
  useBeatTimeline(ref, (tl, { q }) => {
    tl.fromTo(q('.at-dots'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 0)
    tl.fromTo(q('.at-kicker'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.1)
    tl.fromTo(q('.at-gal-title, .at-gal-mod'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out' }, 0.3)
    tl.fromTo(q('.at-gal-plane'), { rotateX: 26, rotateY: -30, y: 120, autoAlpha: 0 }, { rotateX: 6, rotateY: -11, y: 0, autoAlpha: 1, duration: 1.4, ease: 'power3.out' }, 0.35)
    tl.fromTo(q('.at-gal-item'), { autoAlpha: 0, z: -160, y: 50 }, { autoAlpha: 1, z: 0, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' }, 0.7)
    tl.addLabel('b0', 3.4)
  }, { beat, beats, entry, reduced })
  return (
    <div ref={ref} className="cp-scene at" data-theme={plan.theme} style={themeVars(plan.theme)}>
      <div className="at-glow" /><div className="at-dots" />
      <Rail current={p.key} nav={nav} />
      <div className="at-kicker">{p.product} — screens{plan.ghost ? ` ${plan.ghost}` : ''}</div>
      <div className="at-gal-title">{p.product}</div>
      <div className="at-gal-mod">{p.k12_module}</div>
      <div className="at-gal-grid"><div className="at-gal-plane">
        {tiles.map((s, k) => (
          <div className="at-gal-item" key={s.id} style={{ left: (k % 3) * 366, top: Math.floor(k / 3) * 262 }}>
            <div className="at-gshot"><img src={s.shots[0]} alt={`${s.name}: screen`} draggable={false} /></div>
            <b>{s.name}</b>
          </div>
        ))}
      </div></div>
      <div className="at-gal-note">Screens from the working product, edited for this presentation. Personal details are removed.</div>
    </div>
  )
}

export default function AtlasScene(props: SceneProps) {
  const plan = atlasByN(props.slide.n)
  if (!plan) return null
  const p: P = { ...props, plan }
  switch (plan.kind) {
    case 'hub': return <Hub {...p} />
    case 'opener': return <Opener {...p} />
    case 'subs': return <Subs {...p} />
    case 'glance': return <Glance {...p} />
    case 'gallery': return <Gallery {...p} />
    case 'film': return <FilmScene {...p} />
    case 'tour': return <TourScene {...p} />
    default: return null
  }
}
