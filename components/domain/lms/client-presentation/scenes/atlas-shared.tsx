'use client'

import type { KeyboardEvent, ReactNode } from 'react'

import { HUB_KEY, PRODUCT_NAV } from '@/lib/client-presentation/atlas'

import type { SceneProps } from './types'

/** Pieces the Product Atlas scenes and the product tour share: the product rail, masked word reveals, and the key guard for buttons. */
export const pad2 = (n: number) => String(n).padStart(2, '0')
// A focused button must not also advance the deck (Enter and Space are "Next" for the presenter).
export const stopKeys = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }

export function Words({ text, split }: { text: string; split?: number }): ReactNode {
  const w = text.split(' ')
  const cut = split ?? Math.ceil(w.length / 2)
  return w.map((x, i) => (
    <span className="at-wm" key={i}><span className={`at-w ${i < cut ? 'light' : 'heavy'}`}>{x}</span></span>
  ))
}

/** The shortcut rail: all products, then one pill per product. Hidden in the video render (a video cannot be clicked). */
export function Rail({ current, nav }: { current?: string; nav: SceneProps['nav'] }) {
  return (
    <nav className="at-prodrail" aria-label="Products">
      <button type="button" className={`at-pill${current ? '' : ' on'}`} onKeyDown={stopKeys} onClick={() => nav.goto(HUB_KEY)}>All products</button>
      {PRODUCT_NAV.map((p) => (
        <button type="button" key={p.key} className={`at-pill${current === p.key ? ' on' : ''}`} onKeyDown={stopKeys} onClick={() => nav.goto(p.opener)}>{p.short}</button>
      ))}
    </nav>
  )
}
