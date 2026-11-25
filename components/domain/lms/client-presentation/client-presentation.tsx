'use client'

import { PRODUCT_NAV } from '@/lib/client-presentation/atlas'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react'

import { DECKS, slideByN, type Deck } from '@/lib/client-presentation/deck'
import { detour as navDetour, orderOf, goto as navGoto, initial, keyAt, next as navNext, prev as navPrev, progress, returnFromDetour, setMode, type Mode, type NavState } from '@/lib/client-presentation/navigation'
import { rootVars } from '@/lib/client-presentation/palette'

import './styles/base.css'
import { beatsOf, SCENES } from './scenes'
import type { SceneNav } from './scenes/types'

type Action =
  | { t: 'next' } | { t: 'prev' } | { t: 'goto'; key: string; end?: boolean } | { t: 'detour'; key: string } | { t: 'return' } | { t: 'mode'; mode: Mode } | { t: 'sync'; state: NavState }

function reducer(s: NavState, a: Action): NavState {
  switch (a.t) {
    case 'next': return navNext(s, beatsOf)
    case 'prev': return navPrev(s, beatsOf)
    case 'goto': return navGoto(s, a.key, beatsOf, a.end)
    case 'detour': return navDetour(s, a.key)
    case 'return': return returnFromDetour(s)
    case 'mode': return setMode(s, a.mode)
    case 'sync': return a.state
  }
}

const CHANNEL = 'g2g-client-presentation'
export const STAGE_W = 1920
export const STAGE_H = 1080

interface Props {
  productKey: string
  /** Scene to open on ('s7'), or a slide number. */
  initialSlide?: number
  /** Open a scene already revealed to this beat (deep links and screenshots). */
  initialBeat?: number
  mode?: Mode
  embedded?: boolean
}

export function ClientPresentation({ productKey, initialSlide, initialBeat, mode = 'full', embedded = false }: Props) {
  const deck: Deck = DECKS[productKey]
  const reducedPref = useReducedMotion()
  const reduced = Boolean(reducedPref)
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const s = initial(mode, initialSlide ? (initialSlide > 200 ? `a${initialSlide - 200}` : `s${initialSlide}`) : undefined)   // 201 and up are the Product Atlas slides (a1, a2, ...)
    return initialBeat ? { ...s, beat: Math.min(Math.max(0, Math.floor(initialBeat)), beatsOf(keyAt(s))) } : s
  })
  const rootRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 1920, h: 1080 })
  const [uiOn, setUiOn] = useState(true)
  const [credits, setCredits] = useState(false)
  const channel = useRef<BroadcastChannel | null>(null)
  const stateRef = useRef(state)
  const uiTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const key = keyAt(state)
  const scene = SCENES[key]
  const slide = slideByN(deck, scene.slides[0])

  // Fit the fixed stage to the window, centred, never cropped.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const scale = Math.min(box.w / STAGE_W, box.h / STAGE_H)
  const frameStyle: CSSProperties = { transform: `translate(${(box.w - STAGE_W * scale) / 2}px, ${(box.h - STAGE_H * scale) / 2}px) scale(${scale})` }

  const showUi = useCallback(() => {
    setUiOn(true)
    if (uiTimer.current) clearTimeout(uiTimer.current)
    uiTimer.current = setTimeout(() => setUiOn(false), 3200)
  }, [])
  useEffect(() => {
    // The controls start visible and fade after a moment; the timer callback (not the effect body) changes state.
    const first = setTimeout(() => setUiOn(false), 3200)
    return () => {
      clearTimeout(first)
      if (uiTimer.current) clearTimeout(uiTimer.current)
    }
  }, [])

  const nav: SceneNav = useMemo(() => ({
    detour: (k) => dispatch({ t: 'detour', key: k }),
    goto: (k) => dispatch({ t: 'goto', key: k }),
    returnBack: () => dispatch({ t: 'return' }),
    canReturn: Boolean(state.back),
  }), [state.back])

  const openPresenter = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('view', 'presenter')
    url.searchParams.delete('embed')
    window.open(url.toString(), 'cp-presenter', 'width=900,height=900')
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.()
  }, [])

  // Keyboard: the presenter drives with arrows, space and page keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Enter') { e.preventDefault(); dispatch({ t: 'next' }) }
      else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); dispatch({ t: 'prev' }) }
      else if (k === 'Home') dispatch({ t: 'goto', key: keyAt(initial(state.mode)) })
      else if (k === 'End') dispatch({ t: 'goto', key: 's15', end: true })
      else if (k === 'Escape') { if (credits) setCredits(false); else if (state.back) dispatch({ t: 'return' }) }
      else if (/^[1-9]$/.test(k) && PRODUCT_NAV[Number(k) - 1]) dispatch({ t: 'goto', key: PRODUCT_NAV[Number(k) - 1].opener })   // 1 to 5: open a product of the Product Atlas
      else if (k === 'p' || k === 'P') openPresenter()
      else if (k === 'f' || k === 'F') toggleFullscreen()
      else if (k === 'c' || k === 'C') setCredits((v) => !v)
      else if (k === 'm' || k === 'M') dispatch({ t: 'mode', mode: state.mode === 'full' ? 'short' : 'full' })
      showUi()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [credits, openPresenter, showUi, state.back, state.mode, toggleFullscreen])

  // Presenter window: broadcast the state, accept commands.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(CHANNEL)
    channel.current = ch
    ch.onmessage = (e: MessageEvent) => {
      const m = e.data as { t?: string }
      if (m?.t === 'cmd-next') dispatch({ t: 'next' })
      else if (m?.t === 'cmd-prev') dispatch({ t: 'prev' })
      else if (m?.t === 'hello') ch.postMessage({ t: 'state', key: keyAt(stateRef.current), beat: stateRef.current.beat, mode: stateRef.current.mode })
    }
    return () => { ch.close(); channel.current = null }
  }, [])
  useEffect(() => {
    stateRef.current = state
    channel.current?.postMessage({ t: 'state', key: keyAt(state), beat: state.beat, mode: state.mode })
    if (embedded && typeof window !== 'undefined' && window.parent !== window) {
      const pct = Math.round(progress(state, beatsOf) * 100)
      const last = keyAt(state) === 's15' && state.beat >= beatsOf('s15')
      window.parent.postMessage({ src: 'g2g-client-presentation', key: productKey, type: last ? 'completed' : 'progress', slide: scene.slides[0], step: state.pos + 1, of: orderOf(state.mode).length, mode: state.mode, percent: pct }, window.location.origin)
    }
  }, [embedded, productKey, scene.slides, state])

  const pct = Math.round(progress(state, beatsOf) * 100)
  const Scene = scene.Component
  const credited = Object.entries(deck.assets).filter(([, a]) => a.src && a.credit)
  const atEnd = keyAt(state) === 's15' && state.beat >= beatsOf('s15')
  const lastOfShort = state.mode === 'short' && keyAt(state) === 's15'

  return (
    <div ref={rootRef} className="cp-root" data-ui={uiOn ? 'on' : 'off'} onMouseMove={showUi} style={rootVars as CSSProperties} role="region" aria-label={deck.title}>
      <div className="cp-progress" style={{ width: `${pct}%` }} aria-hidden="true" />
      <div className="cp-frame" style={frameStyle}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${state.mode}:${key}`}
            style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: reduced ? 1 : 0 }}
            transition={{ duration: reduced ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <Scene deck={deck} slide={slide} beat={state.beat} beats={scene.beats} entry={state.entry} reduced={reduced} nav={nav} short={state.mode === 'short'} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div aria-live="polite" className="cp-sr">{`${slide.section}: slide ${state.pos + 1} of ${orderOf(state.mode).length}`}</div>

      <div className="cp-ui">
        <div className="cp-ui-pill">
          <button type="button" onClick={() => dispatch({ t: 'prev' })} aria-label="Previous">‹ Back</button>
          <span style={{ padding: '0 8px', opacity: 0.8 }}>{state.mode === 'short' ? `Short ${state.pos + 1}/5` : `${state.pos + 1}/${orderOf(state.mode).length}`}</span>
          <button type="button" onClick={() => dispatch({ t: 'next' })} aria-label="Next" disabled={atEnd || lastOfShort && state.beat >= beatsOf('s15')}>Next ›</button>
          <span className="cp-sep" />
          {state.back && <button type="button" onClick={() => dispatch({ t: 'return' })}>↩ Return to journey</button>}
          <button type="button" onClick={() => dispatch({ t: 'mode', mode: state.mode === 'full' ? 'short' : 'full' })} title="M">{state.mode === 'full' ? 'Five-slide version' : 'Full deck'}</button>
          <button type="button" onClick={openPresenter} title="P">Presenter notes</button>
          <button type="button" onClick={() => setCredits(true)} title="C">Credits</button>
          <button type="button" onClick={toggleFullscreen} title="F">Full screen</button>
        </div>
      </div>

      {credits && (
        <div className="cp-credits" role="dialog" aria-label="Image credits" onClick={() => setCredits(false)}>
          <div className="cp-credits-card" onClick={(e) => e.stopPropagation()}>
            <h2>Image credits</h2>
            <p>Photographs are illustrative stock imagery. They do not show ScholarClone customers.</p>
            <ul style={{ padding: 0 }}>
              {credited.length === 0 && <li>No credited images are placed yet.</li>}
              {credited.map(([slot, a]) => <li key={slot}><b>{slot}</b>: {a.ai ? 'AI-generated image. ' : ''}{a.credit}</li>)}
            </ul>
            <button type="button" onClick={() => setCredits(false)} style={{ marginTop: 10, padding: '10px 18px', borderRadius: 8, border: 0, background: '#1088f6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
