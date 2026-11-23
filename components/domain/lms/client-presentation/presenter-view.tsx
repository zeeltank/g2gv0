'use client'

import { useEffect, useRef, useState } from 'react'

import { DECKS, slideByN } from '@/lib/client-presentation/deck'
import { orderOf, type Mode } from '@/lib/client-presentation/navigation'

import './styles/base.css'
import { SCENES } from './scenes'
import { StatusBadge } from './ui/primitives'

const CHANNEL = 'g2g-client-presentation'

/**
 * The presenter's own window: what to say, the question to ask, the link to the next slide, and Next / Previous that drive the
 * audience window. It only talks to the audience window over a BroadcastChannel; nothing leaves the browser.
 */
export function PresenterView({ productKey }: { productKey: string }) {
  const deck = DECKS[productKey]
  const [st, setSt] = useState<{ key: string; beat: number; mode: Mode } | null>(null)
  const ch = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const c = new BroadcastChannel(CHANNEL)
    c.onmessage = (e: MessageEvent) => {
      const m = e.data as { t?: string; key?: string; beat?: number; mode?: Mode }
      if (m?.t === 'state' && m.key) setSt({ key: m.key, beat: m.beat ?? 0, mode: m.mode ?? 'full' })
    }
    c.postMessage({ t: 'hello' })
    ch.current = c
    return () => { c.close(); ch.current = null }
  }, [])

  if (!st) {
    return (
      <div className="cp-presenter">
        <h1>Presenter notes</h1>
        <h2>Waiting for the presentation window</h2>
        <p>Open the presentation in another window, then press P there. This window follows it.</p>
      </div>
    )
  }
  const scene = SCENES[st.key]
  const slide = slideByN(deck, scene.slides[0])
  const order = orderOf(st.mode)
  const nextKey = order[order.indexOf(st.key) + 1]
  const nextSlide = nextKey ? slideByN(deck, SCENES[nextKey].slides[0]) : null

  return (
    <div className="cp-presenter">
      <h1>Presenter notes · {st.mode === 'short' ? 'five-slide version' : 'full deck'}</h1>
      <h2>{slide.n}. {slide.lines.find((l) => l.role === 'headline')?.text ?? slide.id}</h2>
      <div className="cp-p-row">
        {slide.badge && <StatusBadge badge={slide.badge} />}
        <span>Step {st.beat} of {scene.beats}</span>
      </div>
      <div className="cp-p-block"><b>Say</b><p>{slide.say}</p></div>
      <div className="cp-p-block"><b>Ask</b><p>{slide.ask}</p></div>
      {slide.transition && <div className="cp-p-block"><b>Then</b><p>{slide.transition}</p></div>}
      {nextSlide && <div className="cp-p-block"><b>Next slide</b><p>{nextSlide.n}. {nextSlide.lines.find((l) => l.role === 'headline')?.text}</p></div>}
      <div className="cp-p-row">
        <button type="button" className="cp-quiet" onClick={() => ch.current?.postMessage({ t: 'cmd-prev' })}>‹ Previous</button>
        <button type="button" onClick={() => ch.current?.postMessage({ t: 'cmd-next' })}>Next ›</button>
      </div>
    </div>
  )
}
