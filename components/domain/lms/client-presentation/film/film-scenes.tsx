'use client'

import type { ReactNode } from 'react'

import deckJson from '@/lib/client-presentation/generated/scholarclone.deck.json'
import { FILM, beatOf, lineOf, linesOf, splitProduct } from '@/lib/client-presentation/film'

import { gsap } from '../motion/gsap'

/**
 * The nine beats of the 59-second film: their markup (FilmBeats) and the one master timeline that moves them (buildFilm).
 * All words come from film.json through film.ts. Beat times come from film.json too, so retiming a beat there retimes the film.
 * Seams use five kinds only, each caused by something on screen: zoom-through a ring, colour flood, object becomes world, whip, dip cut.
 */
type Q = gsap.utils.SelectorFunc
type Asset = { src: string | null; credit: string | null }
const ASSETS = (deckJson as { assets: Record<string, Asset> }).assets
const src = (id: string): string | undefined => ASSETS[id]?.src ?? undefined
const credit = (id: string): string => ASSETS[id]?.credit ?? ''

/** Windows (seconds) in which things move fast; the renderer adds sub-frames here for motion blur. */
export const FILM_BLUR_WINDOWS: [number, number][] = [[3.2, 4.0], [9.5, 10.9], [18.0, 19.0], [24.7, 25.3], [32.3, 32.6], [39.7, 40.3], [44.9, 46.0], [51.2, 51.6]]

const Words = ({ text, className = '' }: { text: string; className?: string }) => (
  <>{text.split(' ').map((w, i) => <span key={i} className={`fm-wd ${className}`}>{`${w} `}</span>)}</>
)
const Tiles = ({ words, className = '' }: { words: string[]; className?: string }) => (
  <>{words.map((w, i) => <span key={i} className={`fm-tile ${className}`}><i>{w}</i></span>)}</>
)
const Letters = ({ text }: { text: string }) => <>{text.split('').map((c, i) => <span key={i} className="fm-wd fm-ltr">{c}</span>)}</>

const RING = 'M150 10a140 140 0 1 0 0 280a140 140 0 1 0 0-280z'
const SPARK_CIRCLE = 'M32 8a24 24 0 1 0 0 48a24 24 0 1 0 0-48z'
const SPARK_STAR = 'M32 2C36 22 42 28 62 32C42 36 36 42 32 62C28 42 22 36 2 32C22 28 28 22 32 2Z'

function Lockup({ cls, top, word }: { cls: string; top: number; word: number }) {
  return (
    <div className={`fm-lockup ${cls}`}>
      <svg className="fm-ringsvg" style={{ left: 810, top, width: 300, height: 300 }} viewBox="0 0 300 300"><path className={`${cls}-ring`} d={RING} fill="none" stroke="#9fd0ff" strokeWidth="6" strokeLinecap="round" /></svg>
      <img className={`fm-logo ${cls}-logo`} src={src('img-logo')} alt="" style={{ left: 850, top: top + 40, width: 220, height: 220 }} draggable={false} />
      <div className={`fm-word fm-disp fm-heavy ${cls}-word`} style={{ top: top + 320, fontSize: word }}><Letters text="ScholarClone" /></div>
      <div className={`fm-sweep ${cls}-sweep`} style={{ top: top + 300, height: word * 1.3, left: -300 }} />
    </div>
  )
}

export function FilmBeats(): ReactNode {
  const hook = beatOf('hook'); const prob = beatOf('problem'); const rev = beatOf('reveal'); const mods = beatOf('modules')
  const wf = beatOf('workflow'); const views = beatOf('views'); const con = beatOf('connects'); const cl = beatOf('claim'); const end = beatOf('end')
  const hookWords = lineOf(hook, 'l1').split(' ')
  const products = linesOf(mods, 'product').map(splitProduct)
  const prod = (n: string) => products.find((p) => p.name === n)!
  const roles = linesOf(views, 'role'); const qs = linesOf(views, 'q'); const ans = linesOf(views, 'a')
  const nodes = linesOf(con, 'node'); const links = linesOf(con, 'link'); const reports = linesOf(con, 'report')
  const cards = linesOf(prob, 'card'); const steps = linesOf(wf, 'step'); const path = linesOf(wf, 'path')
  const WINPOS = [[140, 130], [980, 130], [140, 520], [980, 520]]
  const NODE = [[520, 330, 'above'], [640, 770, 'below'], [1340, 330, 'above'], [1340, 800, 'below']]
  return (
    <>
      <svg className="fm-defs" aria-hidden="true">
        <defs>
          <filter id="fm-bx" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur id="fm-bxg" stdDeviation="0 0" /></filter>
        </defs>
      </svg>

      {/* 1 hook */}
      <section className="fm-beat fm-cream" data-b="hook">
        <div className="fm-bg" /><div className="fm-dots fm-h-dots" />
        <h1 className="fm-hook-text fm-disp" aria-label={hookWords.join(' ')}>
          <div className="fm-hl1" style={{ whiteSpace: 'nowrap', fontSize: 168 }}><Tiles words={hookWords.slice(0, 4)} className="fm-light fm-ink-t" /></div>
          <div className="fm-hl2" style={{ whiteSpace: 'nowrap', fontSize: 196 }}><Tiles words={hookWords.slice(4)} className="fm-heavy fm-blue" /></div>
        </h1>
        <svg className="fm-hook-ring" viewBox="0 0 1920 1080"><ellipse className="fm-h-ring" cx="775" cy="565" rx="700" ry="175" fill="none" stroke="#1088f6" strokeWidth="8" /></svg>
      </section>

      {/* 2 problem */}
      <section className="fm-beat fm-deep" data-b="problem">
        <div className="fm-bg" /><div className="fm-grid" />
        <div className="fm-3d fm-p-cam">
          <div className="fm-photo fm-p-photo"><img src={src('img-student')} alt="A student at a desk with an exercise book" draggable={false} /></div>
          <div className="fm-p-lines fm-disp">
            <span className="fm-ln fm-p-l1 fm-light" style={{ color: '#eaf2fb' }}><Words text={lineOf(prob, 'l1')} /></span>
            <span className="fm-ln fm-p-l2 fm-light" style={{ color: '#eaf2fb' }}><Words text={lineOf(prob, 'l2')} /></span>
            <span className="fm-ln fm-p-l3 fm-heavy fm-sky"><Words text={lineOf(prob, 'l3')} /></span>
          </div>
          <div className="fm-tag fm-p-tag" style={{ left: 850, top: 556 }}>{lineOf(prob, 'tag')}</div>
          {cards.map((c, i) => <div key={c} className={`fm-slip fm-p-slip fm-p-slip${i}`} style={{ left: [860, 1000, 1140][i], top: [610, 735, 860][i] }}>{c}</div>)}
        </div>
      </section>

      {/* 3 reveal */}
      <section className="fm-beat fm-ink" data-b="reveal">
        <div className="fm-bg" /><div className="fm-grid" />
        <Lockup cls="fm-rv" top={220} word={132} />
        <div className="fm-sent fm-disp">
          <span className="fm-c fm-c1 fm-light fm-rv-c1" style={{ color: '#eaf2fb' }}><Words text={lineOf(rev, 'c1')} /></span>
          <span className="fm-c fm-c2 fm-heavy fm-sky fm-rv-c2"><Words text={lineOf(rev, 'c2')} /></span>
          <span className="fm-c fm-c3 fm-heavy fm-rv-c3" style={{ color: '#fff' }}><Words text={lineOf(rev, 'c3')} /></span>
          <span className="fm-c fm-c4 fm-heavy fm-green fm-rv-c4"><Words text={lineOf(rev, 'c4')} /></span>
        </div>
      </section>

      {/* 4 modules */}
      <section className="fm-beat fm-ink" data-b="modules">
        <div className="fm-bg" /><div className="fm-grid" />
        <div className="fm-m-seam" />
        <div className="fm-count"><div className="fm-count-n fm-disp">0</div><div className="fm-count-t">{lineOf(mods, 'count')}</div></div>
        <div className="fm-world">
          <div className="fm-rig">
            <svg className="fm-m-ringsvg" style={{ position: 'absolute', left: -860, top: -470, width: 1720, height: 940, overflow: 'visible' }} viewBox="0 0 1720 940"><ellipse className="fm-m-ring" cx="860" cy="470" rx="840" ry="440" fill="none" stroke="#9fd0ff" strokeWidth="5" strokeDasharray="1 0" /></svg>
            <div className="fm-slab fm-s-insight fm-m-slab fm-m-insight"><b>{prod('Scholar Insight').name}</b><span>{prod('Scholar Insight').desc}</span></div>
            <div className="fm-slab fm-s-mid fm-s-learn fm-m-slab fm-m-mid"><b>{prod('Scholar Learn').name}</b><span>{prod('Scholar Learn').desc}</span></div>
            <div className="fm-slab fm-s-mid fm-s-ccb fm-m-slab fm-m-mid"><b>{prod('Scholar CCB').name}</b><span>{prod('Scholar CCB').desc}</span></div>
            <div className="fm-slab fm-s-mid fm-s-compass fm-m-slab fm-m-mid"><b>{prod('Scholar Compass').name}</b><span>{prod('Scholar Compass').desc}</span></div>
            <div className="fm-slab fm-s-core fm-m-slab fm-m-core"><b>{prod('Scholar Core').name}</b><span>{prod('Scholar Core').desc}</span></div>
          </div>
        </div>
        <div className="fm-chip fm-m-one" style={{ left: 140, top: 960, background: '#0f3d78', border: '2px solid #9fd0ff', fontSize: 28 }}>{prod('Scholar One').name}: {prod('Scholar One').desc}</div>
      </section>

      {/* 5 workflow */}
      <section className="fm-beat fm-cream" data-b="workflow">
        <div className="fm-bg" /><div className="fm-dots fm-w-dots" />
        <h2 className="fm-w-h fm-disp fm-ink-t">
          <span className="fm-light"><Words text="Information is not yet" className="fm-w-hw" /></span>
          <span className="fm-heavy fm-blue"><Words text="action." className="fm-w-hw" /></span>
        </h2>
        <svg className="fm-chain" viewBox="0 0 1920 1080">
          <path className="fm-w-line" d="M220 430H1700" stroke="#0c2a4a" strokeWidth="5" strokeLinecap="round" fill="none" />
          {steps.map((_, i) => <circle key={i} className={`fm-w-dot fm-w-dot${i}`} cx={220 + i * 296} cy="430" r="17" fill={i === 5 ? '#1088f6' : '#0c2a4a'} />)}
        </svg>
        {steps.map((s, i) => <div key={s} className={`fm-step fm-w-step fm-w-step${i}`} style={{ left: 220 + i * 296 - 135, top: 470 }}>{s}</div>)}
        <div className="fm-chip fm-w-chip" style={{ left: 200, top: 572 }}>{prod('Scholar Learn').name}</div>
        <div className="fm-path fm-w-path">
          {path.map((p, i) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              <div className={`fm-pcard fm-w-pcard fm-w-pcard${i}`}>{p}</div>
              {i < path.length - 1 && <svg className="fm-parrow fm-w-arrowsvg" viewBox="0 0 70 28"><path className={`fm-w-arrow fm-w-arrow${i}`} d="M2 14H62M52 4l10 10-10 10" fill="none" stroke="#1088f6" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
          ))}
        </div>
        <div className="fm-ai fm-w-ai">
          <svg viewBox="0 0 64 64"><path className="fm-w-spark" d={SPARK_CIRCLE} fill="#1088f6" /></svg>
          <span className="fm-w-ai-t"><Words text={lineOf(wf, 'ai')} className="fm-w-aiw" /></span>
        </div>
      </section>

      {/* 6 views */}
      <section className="fm-beat fm-ink" data-b="views">
        <div className="fm-bg" /><div className="fm-grid" />
        <div className="fm-3d fm-v-cam" style={{ perspective: 1500 }}>
          {roles.map((r, i) => (
            <div key={r} className={`fm-win fm-v-win fm-v-win${i}`} style={{ left: WINPOS[i][0], top: WINPOS[i][1] }}>
              <div className="fm-win-bar"><i /><i /><i /></div>
              <div className="fm-win-role">{r}</div>
              <div className="fm-win-q">{qs[i]}</div>
              <div className="fm-win-a fm-v-ans">{ans[i]}</div>
              <div className="fm-win-glow fm-v-glow" />
            </div>
          ))}
          <svg className="fm-cursor fm-v-cursor" viewBox="0 0 84 84"><path d="M12 6 L12 62 L28 48 L40 76 L52 71 L40 44 L62 44 Z" fill="#fff" stroke="#0c2a4a" strokeWidth="4" strokeLinejoin="round" /></svg>
        </div>
      </section>

      {/* 7 connects */}
      <section className="fm-beat fm-deep" data-b="connects">
        <div className="fm-bg" /><div className="fm-grid" />
        <div className="fm-c-cam" style={{ position: 'absolute', inset: 0 }}>
          <svg className="fm-chain" viewBox="0 0 1920 1080">
            <path className="fm-c-l1" d="M640 770 C900 810 1100 810 1340 800" stroke="#9fd0ff" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path className="fm-c-l2" d="M520 330 L1340 330" stroke="#9fd0ff" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path className="fm-c-l3" d="M640 770 C800 560 1100 420 1340 330" stroke="#9fd0ff" strokeWidth="6" strokeLinecap="round" fill="none" />
          </svg>
          {nodes.map((n, i) => (
            <div key={n} className={`fm-node fm-c-node fm-c-node${i}`} style={{ left: NODE[i][0] as number, top: NODE[i][1] as number }}>
              <i className="fm-dot" /><span className="fm-nlab" style={{ top: NODE[i][2] === 'above' ? -88 : 36 }}>{n}</span>
            </div>
          ))}
          <div className="fm-link-cap fm-c-cap fm-c-cap2" style={{ left: 640, top: 360 }}>{links[1]}</div>
          <div className="fm-link-cap fm-c-cap fm-c-cap3" style={{ left: 1000, top: 560 }}>{links[2]}</div>
          <div className="fm-link-cap fm-c-cap fm-c-cap1" style={{ left: 800, top: 716, width: 470 }}>{links[0]}</div>
          {reports.map((r, i) => (
            <div key={r} className={`fm-sheet fm-c-sheet fm-c-sheet${i}`} style={{ left: [90, 200][i], top: [500, 690][i], transform: `rotate(${[-4, 3][i]}deg)` }}>{r}<i /><i /><i /></div>
          ))}
        </div>
      </section>

      {/* 8 claim */}
      <section className="fm-beat fm-cream" data-b="claim">
        <div className="fm-bg" /><div className="fm-dots" />
        <div className="fm-cl-text fm-disp">
          <div className="fm-cl-v1 fm-sans"><Words text={lineOf(cl, 'v1')} className="fm-cl-w1" /></div>
          <div className="fm-cl-v2"><span className="fm-light fm-ink-t"><Words text="a clearer picture of" className="fm-cl-w2" /></span><span className="fm-heavy fm-blue"><Words text="collection, absence and results" className="fm-cl-w2" /></span></div>
          <div className="fm-cl-v3 fm-sans"><Words text={lineOf(cl, 'v3')} className="fm-cl-w3" /></div>
        </div>
        <div className="fm-photo fm-c-photo"><img src={src('img-arrival')} alt="Schoolgirls in uniform walking to school" draggable={false} /></div>
        <div className="fm-fit">{linesOf(cl, 'fit').map((f) => <span key={f} className="fm-cl-chip">{f}</span>)}</div>
      </section>

      {/* 9 end */}
      <section className="fm-beat fm-deep" data-b="end">
        <div className="fm-bg" /><div className="fm-grid" />
        <Lockup cls="fm-en" top={110} word={96} />
        <div className="fm-e-invite fm-disp fm-light" style={{ color: '#fff' }}><Words text={lineOf(end, 'invite')} className="fm-en-w" /></div>
        <div className="fm-e-close fm-sans fm-en-close">{lineOf(end, 'close')}</div>
      </section>

      {/* overlays */}
      <div className="fm-flood fm-flood-blue" style={{ background: '#1088f6' }} />
      <div className="fm-flood fm-flood-cream" style={{ background: '#f3eee3' }} />
      <div className="fm-dip" />
      <div className="fm-vig" /><div className="fm-grain" />
      <div className="fm-hud fm-hud-l fm-hud-brand">ScholarClone · K–12</div>
      {FILM.beats.filter((b) => b.chapter).map((b) => <div key={b.id} className={`fm-hud fm-hud-r fm-hud-ch fm-hud-ch-${b.id}`}>{b.chapter}</div>)}
      <div className="fm-hud fm-hud-b fm-hud-disc">{FILM.disclosure}</div>
      <div className="fm-hud fm-hud-c fm-hud-cr fm-hud-cr-problem">Photo: {credit('img-student').replace(/^Photo: /, '')}</div>
      <div className="fm-hud fm-hud-c fm-hud-cr fm-hud-cr-claim">Photo: {credit('img-arrival').replace(/^Photo: /, '')}</div>
    </>
  )
}

/* ------------------------------------------------------------------------------------------------------------------------------ */

export function buildFilm(tl: gsap.core.Timeline, q: Q): void {
  const t = (id: string) => beatOf(id)
  const hookB = t('hook'); const probB = t('problem'); const revB = t('reveal'); const modB = t('modules'); const wfB = t('workflow')
  const viewB = t('views'); const conB = t('connects'); const clB = t('claim'); const endB = t('end')
  const vis = (sel: string, from: number, to: number) => { tl.set(q(sel), { visibility: 'visible' }, from); tl.set(q(sel), { visibility: 'hidden' }, to) }
  const wordsIn = (sel: string, at: number, step = 0.09, dur = 0.28) => tl.fromTo(q(sel), { autoAlpha: 0, filter: 'blur(7px)' }, { autoAlpha: 1, filter: 'blur(0px)', duration: dur, stagger: step, ease: 'power2.out' }, at)
  const out = (sel: string, at: number, dur = 0.2) => tl.to(q(sel), { autoAlpha: 0, filter: 'blur(8px)', duration: dur, ease: 'power3.in' }, at)
  const hud = (sel: string, from: number, to: number, color: string) => { tl.set(q(sel), { color }, from - 0.01); tl.fromTo(q(sel), { opacity: 0 }, { opacity: 0.85, duration: 0.4 }, from); tl.to(q(sel), { opacity: 0, duration: 0.25 }, to - 0.25) }
  const whip = (sel: string, at: number, dir: number, outgoing: boolean) => {
    // A 0.25 s smear along x on the moving beat; the SVG filter's blur is driven by its own stdDeviation attribute.
    const d = 0.25
    if (outgoing) {
      tl.set(q(sel), { filter: 'url(#fm-bx)' }, at)
      tl.fromTo(q('#fm-bxg'), { attr: { stdDeviation: '0 0' } }, { attr: { stdDeviation: '46 0' }, duration: d, ease: 'power2.in' }, at)
      tl.fromTo(q(sel), { x: 0 }, { x: dir * -760, duration: d, ease: 'power3.in' }, at)
    } else {
      tl.set(q(sel), { filter: 'url(#fm-bx)', x: dir * 760 }, at)
      tl.fromTo(q('#fm-bxg'), { attr: { stdDeviation: '46 0' } }, { attr: { stdDeviation: '0 0' }, duration: 0.14, ease: 'power2.out' }, at)
      tl.fromTo(q(sel), { x: dir * 760 }, { x: 0, duration: 0.25, ease: 'expo.out' }, at)
      tl.set(q(sel), { filter: 'none' }, at + 0.26)
    }
  }
  const flood = (sel: string, from: number, swapAt: number, to: number) => {
    tl.fromTo(q(sel), { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: swapAt - from, ease: 'power2.inOut' }, from)
    // immediateRender false: two tweens drive this element, and the retract must not paint its "from" state at time zero.
    tl.fromTo(q(sel), { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: to - swapAt, ease: 'power2.inOut', immediateRender: false }, swapAt)
  }
  const dip = (at: number) => { tl.fromTo(q('.fm-dip'), { opacity: 0 }, { opacity: 0.45, duration: 0.1, ease: 'none' }, at); tl.set(q('.fm-dip'), { opacity: 0 }, at + 0.1) }

  /* persistent overlays */
  tl.fromTo(q('.fm-grain'), { backgroundPosition: '0px 0px' }, { backgroundPosition: '-1200px 800px', duration: 59, ease: 'steps(1770)' }, 0)
  hud('.fm-hud-brand', modB.start + 0.4, endB.start - 0.1, '#cfe3f8')
  tl.set(q('.fm-hud-brand'), { color: '#0c2a4a' }, wfB.start); tl.set(q('.fm-hud-brand'), { color: '#cfe3f8' }, viewB.start); tl.set(q('.fm-hud-brand'), { color: '#0c2a4a' }, clB.start)
  tl.set(q('.fm-hud-ch'), { color: '#cfe3f8' }, 0)
  for (const b of FILM.beats.filter((x) => x.chapter)) hud(`.fm-hud-ch-${b.id}`, b.start + 0.5, b.end - 0.1, ['workflow', 'claim'].includes(b.id) ? '#0c2a4a' : '#cfe3f8')
  hud('.fm-hud-disc', probB.start + 0.2, 59, '#cfe3f8')
  tl.set(q('.fm-hud-disc'), { color: '#0c2a4a' }, wfB.start); tl.set(q('.fm-hud-disc'), { color: '#cfe3f8' }, viewB.start); tl.set(q('.fm-hud-disc'), { color: '#0c2a4a' }, clB.start); tl.set(q('.fm-hud-disc'), { color: '#cfe3f8' }, endB.start)
  hud('.fm-hud-cr-problem', probB.start + 0.6, probB.end - 0.1, '#cfe3f8'); hud('.fm-hud-cr-claim', clB.start + 0.6, clB.end - 0.1, '#0c2a4a')

  /* 1 hook 0-4: offset tile-mask type, a ring drawn round the question, the ring zooms through into the next beat */
  vis('[data-b="hook"]', 0, probB.start + 0.1)
  tl.fromTo(q('.fm-h-dots'), { backgroundPosition: '0px 0px' }, { backgroundPosition: '-96px -48px', duration: 4, ease: 'none' }, 0)
  tl.fromTo(q('.fm-hl1 .fm-tile'), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, stagger: 0.1, ease: 'expo.out' }, 0.2)
  tl.fromTo(q('.fm-hl1 .fm-tile > i'), { x: -110, y: (i: number) => (i % 2 ? 26 : -26) }, { x: 0, y: 0, duration: 0.55, stagger: 0.1, ease: 'expo.out' }, 0.2)
  tl.fromTo(q('.fm-hl2 .fm-tile'), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.55, stagger: 0.14, ease: 'expo.out' }, 0.95)
  tl.fromTo(q('.fm-hl2 .fm-tile > i'), { x: -140, y: (i: number) => (i % 2 ? 30 : -30) }, { x: 0, y: 0, duration: 0.6, stagger: 0.14, ease: 'expo.out' }, 0.95)
  tl.fromTo(q('.fm-h-ring'), { drawSVG: '0% 0%', transformOrigin: '50% 50%', scale: 1 }, { drawSVG: '0% 100%', duration: 0.8, ease: 'power2.inOut' }, 1.9)
  tl.to(q('.fm-h-ring'), { scale: 11, strokeWidth: 12, duration: 0.65, ease: 'power3.in' }, 3.2)
  tl.to(q('.fm-hook-text'), { scale: 1.12, filter: 'blur(10px)', transformOrigin: '775px 565px', duration: 0.6, ease: 'power3.in' }, 3.25)

  /* 2 problem 4-10.5: the next beat opens through the ring; a photograph, three slips flying in from depth, then the camera drives through them */
  vis('[data-b="problem"]', 3.3, revB.start + 0.05)
  tl.fromTo(q('[data-b="problem"]'), { clipPath: 'circle(0px at 775px 565px)' }, { clipPath: 'circle(1900px at 775px 565px)', duration: 0.7, ease: 'power3.in' }, 3.3)
  tl.set(q('[data-b="problem"]'), { clipPath: 'none' }, 4.02)
  tl.fromTo(q('.fm-p-photo'), { autoAlpha: 0, x: -90, rotationY: 16, scale: 1.06, transformPerspective: 1700 }, { autoAlpha: 1, x: 0, rotationY: 7, scale: 1, duration: 1.0, ease: 'expo.out' }, 3.9)
  tl.fromTo(q('.fm-p-photo img'), { scale: 1.0 }, { scale: 1.16, duration: 6.4, ease: 'none' }, 4.0)
  tl.fromTo(q('.fm-p-photo'), { rotationY: 7 }, { rotationY: 2, duration: 5.0, ease: 'sine.inOut' }, 4.9)
  wordsIn('.fm-p-l1 .fm-wd', 4.5); wordsIn('.fm-p-l2 .fm-wd', 5.5); wordsIn('.fm-p-l3 .fm-wd', 6.6)
  tl.fromTo(q('.fm-p-tag'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 5.2)
  tl.fromTo(q('.fm-p-slip'), { autoAlpha: 0, z: -1500, x: 380, y: -60, rotationX: 38, rotationZ: (i: number) => [-12, 9, -7][i] }, { autoAlpha: 1, z: 0, x: 0, y: 0, rotationX: 0, rotationZ: (i: number) => [-4, 2, -2][i], duration: 0.95, stagger: 0.34, ease: 'expo.out' }, 6.1)
  tl.fromTo(q('.fm-p-slip'), { y: 0 }, { y: (i: number) => [-16, 12, -10][i], duration: 2.3, ease: 'sine.inOut' }, 7.85)
  tl.fromTo(q('.fm-p-cam'), { scale: 1 }, { scale: 2.7, transformOrigin: '62% 55%', duration: 0.7, ease: 'power3.in' }, 9.45)
  tl.to(q('.fm-p-photo, .fm-p-lines'), { filter: 'blur(14px)', duration: 0.5, ease: 'power2.in' }, 9.5)
  flood('.fm-flood-blue', 9.9, revB.start, revB.start + 0.4)

  /* 3 reveal 10.5-18.5: a ring draws, the logo lands, the wordmark types on, the lockup moves up, the approved sentence lands in four chunks */
  vis('[data-b="reveal"]', revB.start, modB.start + 0.4)
  tl.fromTo(q('.fm-rv-ring'), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.85, ease: 'power2.inOut' }, 10.7)
  tl.fromTo(q('.fm-rv-logo'), { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'back.out(1.5)' }, 11.1)
  tl.fromTo(q('.fm-rv-word .fm-ltr'), { autoAlpha: 0.25, filter: 'blur(7px)', y: 24 }, { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: 0.3, stagger: 0.06, ease: 'power3.out' }, 11.7)
  tl.fromTo(q('.fm-rv-sweep'), { x: 0 }, { x: 2500, duration: 1.0, ease: 'power2.inOut' }, 12.5)
  tl.set(q('.fm-rv-sweep'), { autoAlpha: 0 }, 13.5)
  tl.fromTo(q('.fm-rv'), { x: 0, y: 0, scale: 1, transformOrigin: '960px 370px' }, { x: -770, y: -252, scale: 0.42, duration: 0.75, ease: 'power3.inOut' }, 12.9)
  wordsIn('.fm-rv-c1 .fm-wd', 13.5, 0.1); wordsIn('.fm-rv-c2 .fm-wd', 14.9, 0.12); wordsIn('.fm-rv-c3 .fm-wd', 15.7, 0.12); wordsIn('.fm-rv-c4 .fm-wd', 16.6, 0.12)
  tl.to(q('[data-b="reveal"]'), { scale: 1.45, filter: 'blur(16px)', autoAlpha: 0, transformOrigin: '50% 50%', duration: 0.5, ease: 'power3.in' }, 18.0)

  /* 4 modules 18.5-25: the six products assemble in depth while the camera orbits; a counter climbs to six */
  vis('[data-b="modules"]', 18.2, 25.3)
  const cnt = { n: 0 }
  const setN = () => { const el = q('.fm-count-n')[0] as HTMLElement | undefined; if (el) el.textContent = String(Math.round(cnt.n)) }
  // Object becomes world: the logo ring of the lockup swells until it is the stage the six products stand on.
  tl.fromTo(q('.fm-m-seam'), { opacity: 1, scale: 1, transformOrigin: '50% 50%' }, { opacity: 0.0, scale: 34, duration: 0.8, ease: 'power3.in' }, 18.15)
  tl.fromTo(q('.fm-count'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 18.5)
  tl.fromTo(q('.fm-m-ring'), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.9, ease: 'power2.inOut' }, 22.2)
  tl.fromTo(q('.fm-rig'), { rotationY: -26, rotationX: 14, z: -260 }, { rotationY: 14, rotationX: 3, z: 80, duration: 6.6, ease: 'sine.inOut' }, 18.5)
  const rise = (sel: string, at: number, z: number, stagger = 0) => tl.fromTo(q(sel), { autoAlpha: 0, y: 150, z: z - 420, scale: 0.9 }, { autoAlpha: 1, y: 0, z, scale: 1, duration: 0.9, stagger, ease: 'expo.out' }, at)
  tl.set(q('.fm-m-slab'), { autoAlpha: 0 }, 0)
  rise('.fm-m-core', 18.8, 0); tl.to(cnt, { n: 1, duration: 0.2, ease: 'none', onUpdate: setN }, 18.8)
  rise('.fm-m-mid', 20.0, 90, 0.28); tl.to(cnt, { n: 4, duration: 0.8, ease: 'none', onUpdate: setN }, 20.0)
  rise('.fm-m-insight', 21.3, 190); tl.to(cnt, { n: 5, duration: 0.2, ease: 'none', onUpdate: setN }, 21.4)
  tl.to(cnt, { n: 6, duration: 0.2, ease: 'none', onUpdate: setN }, 22.9)
  tl.fromTo(q('.fm-m-one'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 23.1)
  whip('[data-b="modules"]', 24.75, 1, true)

  /* 5 workflow 25-32.5: the chain from information to action, the Learn path along it, AI drafting, a circle morphing into a spark */
  vis('[data-b="workflow"]', 24.93, 32.55)
  whip('[data-b="workflow"]', 24.93, 1, false)
  tl.fromTo(q('.fm-w-dots'), { backgroundPosition: '0px 0px' }, { backgroundPosition: '-120px -60px', duration: 7.5, ease: 'none' }, 25)
  wordsIn('.fm-w-hw', 25.5, 0.13)
  tl.fromTo(q('.fm-w-line'), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 1.1, ease: 'power2.inOut' }, 26.0)
  tl.fromTo(q('.fm-w-dot'), { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.4, stagger: 0.16, ease: 'back.out(2)' }, 26.1)
  tl.fromTo(q('.fm-w-step'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.16, ease: 'power3.out' }, 26.25)
  tl.fromTo(q('.fm-w-chip'), { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.4 }, 27.6)
  tl.fromTo(q('.fm-w-pcard'), { autoAlpha: 0, y: 110 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.36, ease: 'expo.out' }, 27.8)
  tl.fromTo(q('.fm-w-arrow'), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.3, stagger: 0.36, ease: 'power2.out' }, 28.1)
  tl.fromTo(q('.fm-w-ai'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 29.4)
  tl.to(q('.fm-w-spark'), { morphSVG: SPARK_STAR, duration: 0.6, ease: 'power2.inOut' }, 29.6)
  tl.to(q('.fm-w-spark'), { rotation: 90, transformOrigin: '50% 50%', duration: 0.9, ease: 'power3.out' }, 29.6)
  wordsIn('.fm-w-aiw', 29.8, 0.09)
  dip(32.35)

  /* 6 views 32.5-40: four windows tilt in, a cursor clicks through them */
  vis('[data-b="views"]', 32.5, 40.05)
  const dirs = [[-1, 0], [1, 0], [-1, 0], [1, 0]]
  tl.fromTo(q('.fm-v-win'), { autoAlpha: 0, x: (i: number) => dirs[i][0] * 320, y: (i: number) => (i < 2 ? -80 : 80), rotationY: (i: number) => dirs[i][0] * -30, z: -260 }, { autoAlpha: 1, x: 0, y: 0, rotationY: 0, z: 0, duration: 0.85, stagger: 0.28, ease: 'expo.out' }, 32.6)
  tl.set(q('.fm-v-ans'), { autoAlpha: 0, scale: 0.8 }, 0)
  tl.fromTo(q('.fm-v-cam'), { x: -24, rotationY: -2 }, { x: 24, rotationY: 2, duration: 7.2, ease: 'sine.inOut' }, 32.6)
  const tgt = [[470, 340], [1310, 340], [470, 730], [1310, 730]]
  tl.fromTo(q('.fm-v-cursor'), { x: 1600, y: 1000, autoAlpha: 0, scale: 1 }, { autoAlpha: 1, duration: 0.3 }, 33.5)
  let ct = 33.6
  tgt.forEach(([x, y], i) => {
    tl.fromTo(q('.fm-v-cursor'), { x: i === 0 ? 1600 : tgt[i - 1][0], y: i === 0 ? 1000 : tgt[i - 1][1] }, { x, y, duration: 0.8, ease: 'power2.inOut' }, ct)
    tl.fromTo(q('.fm-v-cursor'), { scale: 1 }, { scale: 0.82, duration: 0.09, yoyo: true, repeat: 1, ease: 'power1.inOut' }, ct + 0.8)
    tl.fromTo(q(`.fm-v-win${i} .fm-v-glow`), { opacity: 0 }, { opacity: 1, duration: 0.2 }, ct + 0.82)
    tl.to(q(`.fm-v-win${i} .fm-v-ans`), { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, ct + 0.85)
    ct += 1.35
  })
  tl.to(q('.fm-v-cursor'), { autoAlpha: 0, duration: 0.3 }, 38.9)
  whip('[data-b="views"]', 39.75, -1, true)

  /* 7 connects 40-45.5: four parts of the school and the three connections the code really makes; report sheets peel off */
  vis('[data-b="connects"]', 39.93, 45.7)
  whip('[data-b="connects"]', 39.93, -1, false)
  tl.fromTo(q('.fm-c-cam'), { scale: 1.0 }, { scale: 1.06, transformOrigin: '50% 50%', duration: 5.5, ease: 'sine.inOut' }, 40)
  tl.fromTo(q('.fm-c-node'), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, stagger: 0.12, ease: 'back.out(2)' }, 40.3)
  tl.set(q('.fm-c-cap'), { autoAlpha: 0 }, 0)
  const capIn = (sel: string, at: number) => tl.fromTo(q(sel), { autoAlpha: 0, filter: 'blur(7px)', y: 10 }, { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: 0.4, ease: 'power2.out' }, at)
  tl.fromTo(q('.fm-c-l1'), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.8, ease: 'power2.inOut' }, 41.0); capIn('.fm-c-cap1', 41.5)
  tl.fromTo(q('.fm-c-l2'), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.8, ease: 'power2.inOut' }, 41.9); capIn('.fm-c-cap2', 42.4)
  tl.fromTo(q('.fm-c-l3'), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.8, ease: 'power2.inOut' }, 42.8); capIn('.fm-c-cap3', 43.3)
  tl.fromTo(q('.fm-c-sheet'), { autoAlpha: 0, x: -240, y: -120, rotation: -14 }, { autoAlpha: 1, x: 0, y: 0, rotation: (i: number) => [-4, 3][i], duration: 0.7, stagger: 0.3, ease: 'expo.out' }, 43.7)
  flood('.fm-flood-cream', 44.95, clB.start, clB.start + 0.4)

  /* 8 claim 45.5-51.5 */
  vis('[data-b="claim"]', clB.start, endB.start + 0.05)
  wordsIn('.fm-cl-w1', 46.0, 0.1); wordsIn('.fm-cl-w2', 46.6, 0.1); wordsIn('.fm-cl-w3', 48.0, 0.1)
  tl.fromTo(q('.fm-c-photo'), { autoAlpha: 0, x: 130, rotationY: -20, scale: 1.05, transformPerspective: 1700 }, { autoAlpha: 1, x: 0, rotationY: -6, scale: 1, duration: 1.0, ease: 'expo.out' }, 46.0)
  tl.fromTo(q('.fm-c-photo img'), { scale: 1 }, { scale: 1.15, duration: 6, ease: 'none' }, 46)
  tl.fromTo(q('.fm-cl-chip'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.12, ease: 'power3.out' }, 49.6)
  dip(endB.start - 0.15)

  /* 9 end 51.5-59: the lockup lands, the approved invitation, the closing line (held 2 s) */
  vis('[data-b="end"]', endB.start, 59.0)
  tl.fromTo(q('.fm-en-ring'), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.8, ease: 'power2.inOut' }, 51.7)
  tl.fromTo(q('.fm-en-logo'), { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'back.out(1.5)' }, 52.1)
  tl.fromTo(q('.fm-en-word .fm-ltr'), { autoAlpha: 0.25, filter: 'blur(7px)', y: 20 }, { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: 0.3, stagger: 0.05, ease: 'power3.out' }, 52.6)
  tl.fromTo(q('.fm-en-sweep'), { x: 0 }, { x: 2500, duration: 1.0, ease: 'power2.inOut' }, 53.2)
  tl.set(q('.fm-en-sweep'), { autoAlpha: 0 }, 54.3)
  wordsIn('.fm-en-w', 54.2, 0.12)
  tl.fromTo(q('.fm-en-close'), { autoAlpha: 0, filter: 'blur(8px)' }, { autoAlpha: 1, filter: 'blur(0px)', duration: 0.25, ease: 'power2.out' }, 56.7)

  tl.to({}, { duration: 0.001 }, 58.999)
}
